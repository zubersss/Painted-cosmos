# LOOK RULES: the light and the paint every group follows (group F, the look director)

Branch `look-director`. Written 24 Nov 2026 from the audit (`docs/lead/LOOK-AUDIT.md`, with its stills), the code
as it stands at v37, the owner's standing instructions (`docs/HANDOVER.md` section 2 on `r2`) and the references
(`docs/references/README.md` on `r2`). **The owner's word overrides anything here; this file only makes it exact.**

Who follows this: every group that changes how something is drawn (A trees, B flora, C far view, D weather,
E water, and anyone touching the figure, the creatures or the powers' marks). The look director (group F) owns the
SHARED light and paint code -- `src/render/chunks.js` (the light, the air, the strokes), the light the world hands
out each frame in `src/world/index.js`, `src/render/post.js` and `src/render/shared.js` -- and reviews every
group's stills before a merge (section 8). A group that needs a shared function to behave differently does not
edit it: it asks the coordinator, who passes the ask to group F.

The rules are numbered so a review can cite them ("fails R3.2"). **MUST** is a merge blocker; **SHOULD** is a
finding the review writes down and the group answers.

---

## R0. What the look is, in five lines

1. The clip, closely, with the game's own spin: an oil painting come to life. Strokes ON the world's surfaces,
   each ONE flat colour with a clean edge, small, no outlines.
2. ONE low strong sun (by day) or ONE moon (by night), warm light against cool shade, deep but never lurid darks,
   the air carrying the distance in flat steps of colour.
3. Colours that pop WITHOUT losing detail: the colour lives in the middle values and the lights; the darks are
   deep and quiet; nothing is clipped to white.
4. No blur, no grain. Ever. The aurora is the one soft thing.
5. The test of the look is a still taken looking at land 275 m away and a still from the air, as well as the
   ground at the feet; on the owner's phone (Samsung S23 Ultra), at its own settings.

---

## R1. The light model: one light for everything

### R1.1 Where the light comes from (all of it is already handed out by `src/world/index.js` each frame)

| source | what it is | uniform(s) | who sets it |
| --- | --- | --- | --- |
| the key | the sun by day; from the middle of twilight on, the MOON (lifted 50 degrees and more, opposite the sun) | `uSunDirW` / `uSunDirL` (direction), `uLight` (colour), `uMoon` (0 sun .. 1 moon), `uDayness` | world/index.js (`blendKeys`, the moon swap) |
| the golden hours | the key's colour and the air's go gold when the sun is low | `pcGold()` in chunks.js (and its twin in sky.js) | chunks.js |
| the cool key | the colour of a shade: the sky's light where the sun does not reach | `uGlaze` -> `pcOilShadeC()` | world/index.js, chunks.js |
| the sky's fill | how much sky a shaded surface sees: flat ground looking up takes 1.48 of it, a wall 0.52 | `pcUp` (set by the material) x `uOilD.y` | the material sets `pcUp` |
| the ground's bounce | warm light off the lit ground into what faces down (under a bough, under a chin) | `pcUp` < 0.5 x `uOilAir.w` | the material sets `pcUp` |
| cast shadow | the shadow map (plants and figures, 90 m to each side of the square, about 113 m ahead of the feet; carried to 160 m when looking along the land on tier 2 only -- NOT on the phone's tier 1; larger from the air); past it the canopy's own pattern settled into masses | `pcSunAt`, `pcSunAtSoft`, `pcDappleS`, `pcDappleMass` | shadow.js, chunks.js |
| the figure's blot | the soft shade under the explorer and the ship when there is no map | `pcCast` | world/index.js |
| the lantern | a pool of warm light round the wanderer by night, painted into the strokes (not a scene light) | `pcLamp`, `uLamp*` | world/index.js, chunks.js |
| the air | distance in flat bands; the far land keeps a quarter of its paint and its own light | `pcFogAmount` (+`pcFogBank`), `pcAtmosV`, `pcFarLight` | chunks.js |
| light in the air | the sun's shafts through the shadow map | post.js `OIL_FRAG` | post.js |

**R1.1a MUST:** no material adds a light source of its own (a rim, a glow, a second sun, a fake fill) except the
ones already in the table, and the explorer's rim (`FIG_FRAG`, the side turned from the eye on the sun's side), the
lantern on the figure (`uLampV`) and a thing that is itself a light (region 8: a flame, a lamp). A new light is
asked of group F.

### R1.2 The value ladder (what `pcLevel` gives and `pcTone` paints)

A surface's light is a LEVEL from 0 to 3, and the paint for a level comes from ONE function, `pcTone(colour, level)`:

| level | name | what it is | where it is wanted |
| --- | --- | --- | --- |
| 3 | lit | the body colour laid a little thinner and warmed by the key | what faces the sun and is not shaded |
| 2 | local | the body colour as it is, a breath of the key | what turns from the sun; the light half of an overcast |
| 1 | shade | the cool key over the body, two fifths of it the key's own hue, plus the sky's fill | cast shadow on open ground; what faces away |
| 0 | deep | a step below the shade in VALUE, a fifth of it toward its own grey | under a closed canopy; the core of a crown; the inside of a fold |

**R1.2a MUST: the same light gives the same level on every material.** Today it does not (audit F3: a sun-facing
surface in full cast shadow is level 1 on the ground, 2 on bark, 2.4 on a far crown's dabs, and 3 on the figure,
which ignores shadow). Until the shared `pcLit` exists (build lane L3), a material works out its level the way
the ground does, which is the reference:

    float x = dot(n, sun) * 0.5 + 0.5 + jitter;            // jitter at most +-0.06, from the stroke's own number
    float sunny = <pcSunAtSoft for the ground | pcSunAt for anything above it> at the STROKE'S CENTRE,
                  min'ed with 1.0 - pcCast(...);
    float level = pcLevel(mix(min(x, 0.44) - 0.10 * canopy, x, sunny), soft);   // soft 0.03 .. 0.06

and NOT `x * mix(k, 1.0, sunny)` with a k of its own (bark 0.55, crowns 0.62, rock 0.45 today). Once `pcLit` is in,
every material calls it and nothing else.

**R1.2b MUST: one shade recipe.** Foliage and grass take their shade from `pcTone` (or the shared foliage shade
group F adds in build lane L2), never from a private formula. Today five copies of
`pcBody(pcDensity(c, 1.35)) * mix(vec3(1.0), pcOilShadeC(), 0.5) * 0.80` paint every leaf, blade and far crown in
shade (materials.js lines 514, 1864, 2232, 2968; 2325 a variant); that recipe takes an orange leaf to saturation
0.94 and a green blade to 0.91 (audit F4). Do not add a sixth.

**R1.2c MUST: on-screen values by day** (HSV value V = the largest channel, as the owner's reference table is
measured; on the PNG of a still, after the last pass):

| what | V on screen | reference (the owner's twenty oils, `docs/references/README.md`) |
| --- | --- | --- |
| the lightest lights (snow in sun, cloud tops, a glint) | <= 0.92; nothing pure white except glints | mist and cloud 0.78 |
| lit foliage, lit canopy | 0.60 .. 0.82 | 0.59 .. 0.72 (lemon 0.68, amber 0.72, orange 0.65, red 0.59) |
| lit grass and meadow | 0.50 .. 0.72 | 0.57 |
| shaded grass and floor | 0.25 .. 0.42 | 0.33 |
| conifers, deep foliage | 0.18 .. 0.32 | 0.26 |
| trunks, the darkest things | 0.08 .. 0.18 | 0.12 |
| distant hills | 0.55 .. 0.70, blue-violet | 0.63 |
| water | 0.45 .. 0.70, carrying the sky's colour | 0.56 |

And for the whole picture: **under 4 per cent of a still above V 0.90** (the shoulder in post.js already holds
most of this), the darkest five per cent between V 0.08 and 0.20.

### R1.3 Shadows

- **R1.3a MUST:** everything opaque in the world reads the shadow at its stroke's centre: the ground through
  `pcSunAtSoft` (the smoothed map, so the canopy throws masses and pools); everything standing above the ground
  (plants, rocks, the figure, the creatures, the powers' solid marks) through `pcSunAt`. **The figure and the
  creatures do not today** (audit F3): the explorer and a deer under a tree are painted as if in the sun.
- **R1.3b MUST:** a shadow is a LEVEL, never a darkening multiplied on afterwards (no `c *= 0.6`), so its colour is
  the cool key's and the review can read one value ladder.
- **R1.3c MUST:** past the shadow square the floor settles into the canopy's lit share (`pcDappleMass`); nobody
  re-introduces a per-stroke coin toss on noise the size of a stroke (the far floor's confetti and flicker).
- **R1.3d SHOULD (a gap, audit F11):** past the square nothing standing in the open throws a shadow, so a far tree
  in a meadow and every tree seen from the air stands on the ground without one. The references from a few hundred
  metres show "each tree ... with its shadow lying on the grass beside it". The far trees must carry their own
  (group A, with group F's rule for its colour: the ground's own level-1 paint, never black).
- **R1.3e MUST:** a shadow's edge is a stroke's edge (whole strokes in or out), never a soft gradient.

### R1.4 The hours (what each must look like; audit F5 says the day today has only two looks)

The keys are per world (`src/data/looks/*.js`, `day`, `dawn`, `dusk`, `night`, and a look's `oil.night`); the
golden hours are `pcGold()`. Targets for Earth (other worlds keep their own keys and take the gold by `oil.gold`):

| hour | sun | the light | the shade | the sky and air | today |
| --- | --- | --- | --- | --- | --- |
| first light | 0 .. 8 deg, east | rose-pearl, low, long cool shadows | blue-violet | rose low, pale blue above | the dawn key shows for an hour and is then covered by the same gold as the evening |
| morning | 8 .. 30 deg, east | clear, a breath warm | violet-blue | blue above a pale warm horizon | **gold at 0.95**: 8:00 is the same picture as 16:00 |
| noon | over 30 deg | near white | violet, the sky's fill | blue, flat clouds | right |
| golden hour | under ~22 deg, west | gold | plum-violet; grass deep blue-green | cream-gold air toward the sun, blue-violet away from it | right on foot (the clip); muddy khaki from the air (F6) |
| dusk (blue hour) | 0 .. -8 deg | **no direct light**: forms flat, the light from the sky | the cool key | warm band at the horizon, blue above; the lantern comes on | west-facing land still lit by a sun under the horizon; looks like the golden hour |
| night | under -8 deg | the moon: values a step or two down, colours toward the night key, chroma at most half the day's | deep blue, never black | the night key (blue; teal on Neptune) | **broken** (F1): the land keeps its daylight orange and lemon under a night sky |

- **R1.4a MUST:** no group sets an hour's look in its own shader (no `if (uDayness < 0.5) colour = blue`). The
  hour comes in through the keys and `pcTone`; a material that needs to know night uses `uMoon` / `uDayness` only
  to choose WHAT is painted (a lit window, a lantern), never to re-light it.
- **R1.4b MUST:** by night the only warm things are lights and what a light lights (the lantern's pool, a fire,
  a region-8 light). Autumn leaves and lemon grass are NOT warm at night.
- **R1.4c SHOULD:** the aurora is a night light (dusk to dawn); by day its soft rays are a soft thing where nothing
  else may be soft (today sky.js keeps 30 per cent of it at noon).

### R1.5 The air

- **R1.5a MUST: one air.** Every material takes its distance colour from `pcFogAmount(dist * pcFogBank(vBody))`
  and `pcAtmosV(c, f, vView)` (fragment), or, in a vertex shader, `pcFogAmountV` (materials.js), which is a LINE
  FOR LINE copy and must stay one until group F merges the two (build lane L0). The numbers 200 and 2400 in it
  live in three files and change together (chunks.js, materials.js, world/index.js `AIR_HIGH_*`).
- **R1.5b MUST:** distance changes COLOUR and VALUE in flat steps; it never softens an edge, never lowers a
  stroke's crispness, never fades alpha.
- **R1.5c MUST:** the far land keeps a quarter of its own paint (`uOilAir.x` 0.25) and its own light
  (`pcFarLight`); no group lowers either to hide a far fault. A far fault is fixed in the far paint.
- **R1.5d SHOULD:** the far air leans warm toward the sun and blue-violet away from it (today one mix of the two
  everywhere, which at a golden hour from the air is khaki: audit F6; build lane L5).

---

## R2. The palette

- **R2.1 MUST: colours are set as data, not in shaders.** A biome's colours are its `oil.pal`, `oil.under`, a
  species' `oil.leaf` / `leafSum` / `leafAut` / `fam` / `bark` in `src/data/looks/*.js`. A shader may vary a stroke
  round its colour (`pcDabTint`, by its own number) but never invents a hue.
- **R2.2 MUST: darks are deep and quiet.** On screen, anything with V under 0.30 has HSV saturation at most 0.50
  (the references: conifer 0.31, trunk 0.33, meadow in shade 0.49). Today the stills measure 0.41 .. 0.57 for the
  darkest fifteenth of a still and the five private foliage shades reach 0.91 .. 0.94 (audit F4).
- **R2.3 MUST: the lights carry the colour, not the darks**: the most saturated paint in a picture is in the
  middle and light values (canopy 0.6 .. 0.9, as the references' 0.71 .. 0.86), and only the accents go over 0.90
  (the cloak, the lantern, flowers, fire, the aurora).
- **R2.4 MUST: lit grass is olive-gold, not lime.** Meadow in sun on screen: hue 55 .. 75 degrees, S <= 0.75,
  V 0.50 .. 0.72 (reference: hue 62, S 0.72, V 0.57). Today the lit floor measures hue 82, S 0.80, V 0.76 in the
  autumn wood and greener still in the green wood (audit F10).
- **R2.5 MUST: one accent in the opposite colour.** The cloak's rich blue in a warm world, the lantern's gold on
  a blue night. A group does not add a second competing accent of the same strength.
- **R2.6 SHOULD:** each tree its own colour family (`fam`), dark conifers among them, a few green trees: never one
  even gold (references, 16 Nov).
- **R2.7 MUST: snow and ice** in white, pale blue, blue and blue-grey only, smooth, through `pcIce`; never warm
  confetti (owner, 16 Nov).

---

## R3. The paint and the strokes

- **R3.1 MUST: a stroke is ONE flat colour.** Everything that colours it (its pigment, its light, its shadow, the
  lantern) is asked at the stroke's CENTRE and is the same for every pixel of it. No per-pixel light inside a
  stroke, no gradient across one.
- **R3.2 MUST: the strokes lie on the world**, in a chart of the surface (`pcGroundChart`, a figure's own space,
  a crown's mass), and stay put when the eye moves. Nothing is drawn in screen space except the last pass.
- **R3.3 MUST: size.** A stroke is `uOilA.x` = 4.6 pixels wide at 720 lines (scaled with the picture), laid in
  octaves of the distance (`pcStrokeOct`, `pcStrokeOct4`, `pcStrokeOctCap`), so it is the same size on the screen
  near and far. A dab is `uOilS.w` = 2.6 stroke widths to a cell, `uOilS.z` = 2.4 times as long as wide. No group
  sets a stroke size of its own in pixels or metres without group F.
- **R3.4 MUST: no outlines.** No dark line drawn round a stroke or a shape. Between strokes the only thing allowed
  is `pcLay`'s hairline (what lies under, a step darker, `uOilD.w`) and `pcStrokeCover`'s one-pixel edge.
- **R3.5 MUST: the habit of each thing** (the clip, 15 Nov; the owner, 16 Nov): the forest floor in leaf-shaped
  dabs lying every way; grass in upright lancet blades, each one flat piece; trunks and boughs in long thin streaks
  that run ALONG the wood (never across it); snow in thin, close strokes with no ridges; water in long thin dashes
  along the current; the sky in flat bands and flat cloud shapes; the cloak in thin strips.
- **R3.6 MUST: nothing reads as a polygon.** A flat-shaded face of a mesh that is larger on the screen than about
  two strokes (10 px at 720 lines) carries strokes, or is broken into pieces: a far crown's facets, a mountain's
  triangles, a leaf card at the lens. Today the far crowns and the far mountains read as low-polygon models (audit
  F12).
- **R3.7 MUST: no smooth gradient across a form** wider than about 12 px. Light comes in the four levels with clean
  edges between them (the figure already does this in half-tone steps).
- **R3.8 MUST: leaves are separate shapes with sky between them**, never one solid mass, near and far; a crown's
  mean value seen from far must be the mean of its lit and shaded leaves near (a thinned crown must not show more
  of its dark core: audit F7).

## R4. The crispness rule (the owner, 15 Nov: "I hate the blur the most")

- **R4.1 MUST:** no blur, no depth of field, no motion blur, no glow that softens, no bloom, no FXAA or TAA on the
  oil picture, no mip-softened stroke edge, no soft alpha fade on a surface. The ONE soft thing is the aurora (and
  the light in the air, which is light added, not an edge softened).
- **R4.2 MUST:** no grain, no dithering, no noise that changes from pixel to pixel or frame to frame.
- **R4.3 MUST:** the picture is drawn at the canvas's full size in the oil look (`render/index.js applySize`);
  where the controller does cut it, the last pass's sharp read (`?upscale=`) stays on.
- **R4.4 MUST:** no derivative of a planet-sized coordinate (`vBody` or anything made from it); use `vRel` /
  `vRelO` / the ground chart's own derivative (`pcGroundChartD`). This is how strokes turn to dots.
- **R4.5 MUST:** a stroke that would be smaller than about 1.3 px is not drawn: the surface takes its mean colour
  there (`pcStrokeOctCap`'s z). Nothing finer than a pixel flickers.

## R5. How a material calls the shared functions (the contract)

Every painted material in the oil look is compiled with `PC_OIL` and includes `FRAG_PARS` (fragment) and, if it
lights in the vertex shader, `VERT_PARS` + `PAINT`. In `main`, in this order:

1. `pcFp = pcFootprint(<eye-relative position>);` and, if it lays the leaf shadow from afar, `pcDist = length(vView);`
   -- before any discard.
2. Find the stroke (its centre `Bc`, its numbers `rnd`, its cover) with the shared stroke functions: `pcDabLayer`
   (ground, crowns), `pcThinLayer` / `pcThinLayerUV` (bark, figure, water, snow), `pcStrokeOct*` for the size.
3. `pcUp = dot(normalize(<body position at the centre>), <normal at the centre>);` through the `SKYUP(...)` macro
   (materials.js) -- from the normal, never from a derivative.
4. The colour at the centre from DATA (R2.1), varied by `pcDabTint(c, rnd, leafy)`; wet by `pcWetWash`; snow by
   `pcSnowCover`.
5. The light at the centre: `x`, `sunny`, `level` as R1.2a (later: `pcLit`).
6. `vec3 paint = pcTone(colour, level);` -- the ONLY way from a colour and a level to paint. Snow then `pcIce`.
7. `paint = pcLamp(paint, colour, Bc, rnd.y);`
8. Lay the stroke over what is under: `pcLay(under, paint, cover, present)` (or the material's own mix with the
   same one-pixel cover).
9. `float f = pcFogAmount(dist * pcFogBank(vBody));` (vertex: `pcFogAmountV`) and `c = pcAtmosV(c, f, vView);`
10. `pcWrite(c, wet, nV, viewZ, region)` with the right region (0 sky, 1 ground, 2 water, 3 solid, 4 foliage,
    5 figure, 6 small crisp marks, 7 in the air, 8 a light of its own: post.js leaves 8 out of the night key).

**DO NOT:** write `gl_FragColor` past `pcWrite`; make a private copy of `pcTone`, `pcLevel`, the air, the shade or
the gold; read a shared uniform and re-light with it (`uLight`, `uGlaze`, `uHaze` are inputs to the shared
functions, not paint); multiply a shadow on afterwards; take a derivative of `vBody`; key anything on a hue in the
last pass (the night's warm exemption does that today and it is a bug: audit F1).

**Speed-test flat modes.** `uOilL.y` 1 (ground flat), 2 (plants flat), 4, 5, 6 (bench rows) are honoured by every
new branch of a material, so the speed test still answers its questions.

## R6. Switches, stills and the phone

- **R6.1 MUST:** everything new behind a switch (`?name=0|1`, read in shared.js or baked like `?farlight=`), off =
  the picture before, to the bit, so every change has an A and a B. The watercolour game (no `look=oil`) does not
  change at all.
- **R6.2 MUST: a speed-test row** (`src/core/bench.js`, `[label, on, off]`) for every change that adds work on the
  GPU, and a stated PHONE BUDGET derived from the owner's v37 table (section R7), not from this machine.
- **R6.3 MUST:** render after every shader change (a mistake only shows when a browser compiles it); no backtick in
  a shader comment; a function above its first use.

## R7. The phone budget for look work (derived from the v37 table, 24 Nov)

The frame is about 89 ms; the target is 33 ms; trees are ~70 of it and are group A's. The look's own share is
small and must stay small:

| item (v37 row) | ms on the phone |
| --- | --- |
| the full paint against the lighter one | +3.2 |
| the air on the plants | 1.8 |
| all shadows | 4.2 (trees' share 1.2) |
| the ground's whole paint and shape | 4.8 |
| everything that is not a tree | about 16.7 (at the 60 cap) |

**Budget:** each shared-light change in build lane L costs at most **0.3 ms** on the phone, the whole lane at most
**1.0 ms by day** (the night key adds up to 0.3 ms at night only), and any change that touches every fragment of the plants (the trees' 34 ms of fragment work after the
fragment starts) is costed as a share of that 34 ms by its instruction count, and stated. A change in the vertex
shader of the leaves (where their paint is worked out once a leaf) is costed against the near trees' vertex load,
not their pixels.

## R8. THE REVIEW CHECKLIST (applied to every group's stills before a merge)

**What a group sends (through the coordinator):**
1. For each switch: an **A/B pair** (switch off / on), same camera, same hour, same size, named
   `<group>_<what>_<view>_<hour>_A.png` / `_B.png`.
2. The **standard set** for what the change can be seen in, at 1024 x 480, `look=oil&lite=1&quality=1&t=0`,
   B side only unless the change shows there:
   - S1 `body=earth&biome=autumn_woodland&season=1&cam=stream&time=16.8` (the clip's hour)
   - S2 `body=earth&biome=temperate_forest&cam=vista&time=12` (noon, the first place)
   - S3 `body=earth&biome=autumn_woodland&season=1&cam=jet&dy=30&pitch=5&time=12` (275 m)
   - S4 `body=earth&biome=autumn_woodland&season=1&cam=high&time=12` (from the air)
   - S5 `body=earth&biome=temperate_forest&cam=stream&time=23` (night)
   - S6 `body=neptune&biome=aurora_tundra&cam=stream&time=23` (the snow night the owner liked; at v37 this page does
     not load until the one-line `bareGeometry` fix is in: audit, Neptune)
3. The speed-test row's label and the phone budget, with how it was derived.
4. The numbers from `docs/lead/lookstats.py` on the A and B PNGs.

**How a check is judged.** The faults already recorded in `docs/lead/LOOK-AUDIT.md` (today's baseline: lime grass, lurid
darks, the broken night, and so on) do NOT block a group's merge by themselves. A change FAILS a check if its B still
is worse than its A still on that check, or if it brings a new fault the rules forbid; it is CREDITED where it moves a
number toward the target. The absolute targets bind the group that owns the thing: group F for the shared light (its
build lane), B and C for the palettes they own.

**What the review checks (each a pass, a fail with the rule number, or "cannot tell from a still"):**

| # | check | how | fails if |
| --- | --- | --- | --- |
| C1 | No blur, no soft edge | look at 200 % on stroke edges, silhouettes, the far land | any edge softer than one pixel that was crisp in A; any new filter in post |
| C2 | No grain | flat areas at 200 % | pixel-to-pixel noise inside a stroke |
| C3 | Strokes on the surface, flat, small, no outlines | 200 % crops near and at 275 m | a gradient inside a stroke; a dark line round shapes; strokes over ~2x the 4.6 px size outside the octave rule |
| C4 | Nothing reads as a polygon | the far land, crowns, rocks | a flat facet over ~10 px with no strokes on it |
| C5 | One light | sun side and shadow side of the new things against the ground beside them | a sun-facing thing in shadow lighter than the shaded ground by a full step; a new thing that ignores shadow |
| C6 | Value ladder | `lookstats.py`: V>0.90 share, darkest 5 %, the families of R1.2c sampled by eye-picked crops | V>0.90 over 4 %; lit grass V over 0.72; darks under 0.08 |
| C7 | Quiet darks | `lookstats.py` S(V<0.3) | over 0.50 (today's baseline is recorded per still in the audit; a change may not raise it) |
| C8 | Lit grass olive-gold | crop of lit meadow | hue over 75 deg or S over 0.75 |
| C9 | The hour reads | S1 and S5 against the table of R1.4 | warm leaves or lemon grass at night; a gold morning |
| C10 | The air | S3, S4: the far land keeps its own colour and light; no seam where land meets sky | the far land a flat haze; a hard skyline frieze |
| C11 | Water carries the sky | any still with water | blue water under a gold sky; water the brightest thing in a dark picture |
| C12 | The accent | the cloak and the lantern | a new colour as strong as the cloak |
| C13 | The phone | the row and the budget | no row; a cost not derived from the device table |
| C14 | The watercolour untouched | the same address without `look=oil` | any pixel different |
| C15 | Nothing disappears | the A/B pair | things missing or popping between the two (also in the 275 m and air views) |

The review answers within the same turn it is asked, with the stills it opened named, and says plainly what it
could not settle from a still (motion, speed).
