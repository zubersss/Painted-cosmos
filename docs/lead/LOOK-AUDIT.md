# LOOK AUDIT: the light and the paint of the oil look (group F, the look director)

Branch `look-director` (= `look-proto` = `main` at v37). Written 24 Nov 2026. Nothing in the game was changed for this
audit: every finding below is a still of the game as it is, opened and looked at, and a cause found in the code.

**How the stills were taken.** The painter's gallery (`/gallery.html`), one headless page kept open by
`tools/lab.mjs`, at **1024 x 480** (the owner's phone draws 1028 x 480 or 936 x 372), with the phone's own settings:
`look=oil&lite=1&quality=1` (the lighter paint, tier 1), the clock frozen (`t=0`). Earth's autumn wood with
`season=1` (deep autumn; the game itself starts every load in high summer and takes six minutes to turn).
Hours on Earth: **8** (sun 25 degrees, morning), **12** (58 degrees, noon), **16.8** (15 degrees, golden hour),
**18.4** (5 degrees under the horizon, dusk), **23** (night). Views: `stream` (on foot, 1.5-2 m), `vista` (the
painter's vantage of the place, on foot), `jet&dy=30&pitch=5` (60 m up, the middle of the picture on land 275 m off:
the owner's 275 m test), `high` (420 m up, from the air). Every still is in `docs/shots/painter/look-director/`
under the name `<body>_<place>_<view>_<hour>.jpg` (`275m` for the 275 m view; the autumn wood's are all at
`season=1`); the numbers quoted were measured on the PNGs with a small script
(luminance by the game's own weights 0.3 / 0.5 / 0.2; HSV saturation), described where used.

**What software drawing cannot tell** (said once, applies throughout): how any of this looks in motion, and what
anything costs on the phone. Every cost below is derived from the owner's v37 speed table and the operation counts,
not measured here.

---

## The short version, worst first

| # | what is wrong | where it shows | cause (file:line at v37) | fix lane | shifts other groups' pictures |
| --- | --- | --- | --- | --- | --- |
| F1 | **Night is daylight under a night sky.** Lemon grass, orange leaves and yellow banks keep their day colours at full strength; the night is no darker than the golden hour | every warm or green place at 23:00, Earth and Mars | moonlit `pcTone` is the day's lit paint (chunks.js:195) + the last pass excuses every warm pixel from the night key (post.js:773) | F, L1 | yes: every night still |
| F2 | **The far view is grey.** From the air the whole picture measures saturation 0.10; the autumn wood from 420 m is beige (S 0.30) where the references' aerial wood is amber (S ~0.8) | every `high` still | the air from the air: distance x2.4 against 2,600 m of visibility, ceiling off, a near-grey haze (chunks.js:409-410, 470-473) | F, L5 with C | yes: C's whole lane |
| F3 | **The same shadow is five different values.** A sun-facing thing in full cast shadow is level 1 on the ground, 1 on a near leaf, 2 on bark, 2.4 on a far crown's dabs, and 3 (full sun) on the explorer and the creatures, which do not read the shadow at all | trunks and the figure in a wood's shade | each material builds its own "in shadow" (materials.js:488, 1857, 2157, 2190, 2226, 2367; FIG_FRAG 2703-2724; beastmat.js:527, 599) | F, L3 | yes: A (bark), figure, creatures |
| F4 | **Lurid darks.** Shadows on foliage, grass and far crowns at saturation 0.91-0.94 before the last pass; the last pass then raises every dark's saturation by about 0.13 and clips those to 1.00; stills measure S 0.53-0.65 under V 0.3 where the references sit at 0.31-0.49 | the golden hour, the green wood, crowns from the air (maroon) | five private copies of one foliage shade (materials.js:514, 1864, 2232, 2968; 2325 a variant) + the per-channel S curve and the saturation push in post.js:785-795 | F, L2 + L7 | yes: A, B (their shade), everything (post) |
| F5 | **The day has two looks.** Gold from sunrise to 10:00 and from 14:00 to sunset, blue at noon; 8:00 is the same picture as 16:48; dusk with the sun 5 degrees down is the golden hour again, still lit and shadowless; the dawn's rose key is never seen | morning and dusk stills of every place | `pcGold()` at 0.5 or more whenever the sun is under 42 degrees (chunks.js:162; its twin sky.js:630), the same gold morning and evening; no horizon term on the direct light | F, L4 | yes: everyone's morning and dusk |
| F6 | **The golden hour from the air is khaki.** A flat beige sky and a beige land | `high` at 16.8 | the far air is a fixed mix of the gold and the blue-violet everywhere (chunks.js:470-473): complementary colours mixed make grey-brown | F, L5 | yes: C |
| F7 | **From the air the crowns are darker than the ground between them** (maroon dots on yellow); the references' crowns are the bright thing | `high`, both woods | far crowns' shaded pieces go to the lurid deep foliage shade (F4) and a crown's pieces in shade outnumber the lit ones from above (materials.js:1840-1866) | A (with F's L2) | A |
| F8 | **Shaded meadows and mountainsides are plum mud.** A slope turned from the sun in the alpine meadow is a dark violet mass (V median 0.13-0.16), the meadow's own colour gone | alpine on foot, sea-coast cliffs at 16.8 | the shade is two fifths a fixed plum whatever the body (chunks.js:207, 217); the deep-green exception only fires on strongly green dabs (materials.js:513-514) | F, L6 | yes: B, C |
| F9 | **Water ignores the golden hour.** Stream and sea stay ice-blue under a cream-gold sky, and the stream is the brightest, coldest thing in a dark golden picture | every stream and sea at 8 and 16.8 | the water mirrors the keys' sky (uSkyHorizon / uSkyZenith, materials.js:1184), which does not carry the gold the sky shader adds (sky.js:630); "half the wash laid heavy and blue whatever the sky gives" (materials.js:344-348 in WATER_FRAG) | F (the shared sky colour), E (the call) | E |
| F10 | **Lit grass is lime, not olive-gold.** Lit floor: hue 82, S 0.80, V 0.76 (reference meadow in sun: hue 62, S 0.72, V 0.57); in the green wood a sea of lemon | every lit meadow | the palette (earth.js `grassLight` [0.82, 0.90, 0.38] etc.) + the lit gain 1.12 (chunks.js:195, uOilB.x) + the last pass's push | B, C (data); F only via L7 | B, C |
| F11 | **Nothing far away throws a shadow.** Past the shadow square (about 113 m ahead on the phone's tier 1; 160 m only on tier 2) a tree in a meadow and every tree seen from the air stands without one; at a 15-degree sun the 275 m meadow has no tree shadow at all | `high`, 275 m | the shadow map's reach (shadow.js); the far trees carry no shadow of their own | A, with F's rule R1.3d | A |
| F12 | **Things read as polygons.** Far crowns are faceted lumps with one flat light per facet; a lone wetland tree is a low-poly ball; mountains from the air are flat-coloured triangles | wetland, `high`, the autumn wood's far bank | the far tree's flat facets (A); the far ground's large triangles carrying large flat colour (C) | A, C | -- |
| F13 | **Cliffs smear.** On steep faces the ground's dabs are stretched into long vertical streaks; on the alpine massif from the air a smear | alpine `high`, sea-coast and canyon walls | the ground's stroke chart is a cube-face projection (chunks.js `pcGroundChart`), edge-on on a cliff | F (a slope chart in chunks.js) with C | C |
| F14 | **Near-black discs on the floor**, in full sun as well as shade: the darkest things in the picture are random pebbles, not trunks | wetland, green wood, coast | not settled: most likely small stones in the rock branch (materials.js:2355-2372) at their own dark bark colour and a level step of 0.5 | B / C to find | -- |
| F15 | **Two copies of the air.** The plants' air (materials.js:91-110) is a hand copy of the ground's (chunks.js:393-455); it drifted once already (22 Nov) | -- (a trap, not yet a picture) | structure | F, L0 | no |
| F16 | **Bark streaks run across the trunk** like stacked bricks; the clip's run up it | the big trunks on foot | the bark's stroke chart in PROP_FRAG | A | -- |

What is RIGHT, and must not be lost by any fix: **the golden hour on foot in the autumn wood** (the painter's vantage at
16.8: long cast shadows across the floor, pools of gold light, the air going pale gold into the distance, dark trunks
with violet in them, warm against cool: the clip's picture); the shadow masses on the green wood's slope at noon (clean
shapes, whole strokes); the trunks' dark violet streaks; Neptune's snow night (see below); the noon sky with flat clouds.

---

## The findings, each with its frames and its cause

### F1. Night is daylight under a night sky

**Frames:** `earth_autumn_woodland_stream_23`, `earth_autumn_woodland_vista_23`,
`earth_temperate_forest_stream_23`, `earth_sea_coast_stream_23`, `earth_misty_wetland_stream_23` (the grass blades).

**What is seen.** The sky is a good blue night with streaks. Under it the meadow is lit lemon and yellow-green, the autumn
crowns are bright orange and red, the coast's bank is cream and orange. Measured (lookstats): the autumn wood on foot
has a median value of **0.54 at 23:00 against 0.42 at the golden hour and 0.64 at noon**, and the lightest fifteenth of
the night picture is MORE saturated (S 0.57-0.71) than the day's (0.25-0.44). The night is a bright, saturated
picture with a blue sky pasted over it. The clip's night is "blue and green and readable, never black", the lantern
the only warm thing; the owner's rule (R1.4b): by night only lights are warm.

**Cause, in two places, and they need fixing together:**
1. `chunks.js:130-131` hands the moon the key as the sun's twin (`x = 0.12 + x * 0.78`), so open ground under the moon
   reaches level 3, and `pcTone`'s lit paint (`chunks.js:195`) takes only three tenths of the key's colour and none of
   its strength: `lit = pcDensity(c, 1.38) * mix(1, pow(uLight, 2), 0.30) * 1.12`. With Earth's night light
   (0.80, 0.86, 1.0) that is the body colour times **(1.00, 1.03, 1.12)**: the moonlit ground is as bright as the
   sunlit ground and only a breath bluer. Nothing in `pcTone` darkens or cools for the night.
2. `post.js:773` excuses a pixel from the night's grade if it is warm: `lamp = max(lamp, smoothstep(0.10, 0.32,
   col.r - col.b) * uNight)`. It was written so that the lantern's pool keeps its gold. It also excuses every orange
   leaf, every yellow-green blade and every sand bank, because they are all "warm" by that test. The grade itself
   (Earth's night `grade` (0.70, 0.76, 0.94)) is a mild multiply.

**Why Neptune's night survived it** (the owner liked it): snow is blue-white, so it is never excused, and Neptune has its
own night key. A fix must keep that picture within a breath of what it is.

### F2. The far view is grey (the air from the air)

**Frames:** `earth_autumn_woodland_high_12`, `earth_temperate_forest_high_12`, `earth_alpine_meadow_high_12`.

**What is seen.** A pale grey-blue sky with nothing in it, and land that goes pale and grey within a few hundred metres.
Measured: the median saturation of the whole picture is **0.10** in all three noon stills from 420 m; the autumn wood
in the middle of the frame (a crop 300 x 150) averages (0.64, 0.57, 0.45), **S 0.30, a beige**; the air itself on
screen is (0.79, 0.82, 0.88), S 0.10. The owner's eight aerial references keep their colour all the way out: canopy
S 0.71-0.86, meadow 0.72, the distant hills blue-violet at S 0.24, V 0.63. The owner's newest standing ask is the
view from the air to a mile.

**Cause.** `chunks.js:409-410`: from the air (`pcHigh` 1) the distance is taken **2.4 times** against a visibility of
2,600 m, so the land 700 m off is about half air and a mile off three quarters; the v33 ceiling that keeps a quarter of
the far paint is switched off from the air (`pcHigh * pcHigh`, chunks.js:449-450); and the haze it goes to is the day's
near-white haze key leaned a third of the way to (0.48, 0.50, 0.63) (`pcOilHaze`, chunks.js:470-473): a pale grey.
`pcFarLight` (v34) carries the far land's value, not its colour. The 2.4 was chosen on 18 Nov, when the land from the
air had no value structure of its own and needed the air to give it depth; `pcFarLight` and the ten bands do that now.

### F3. The same shadow is five different values

**Frames:** `earth_autumn_woodland_vista_16.8` (trunks in the floor's shadow), `earth_temperate_forest_vista_12`;
the figure and the creatures were not in these stills: this one is settled by the code and the arithmetic below, and
the build lane's stills must show it.

**What the arithmetic says** (a JS copy of `pcLevel` at the oil remap, by day; a surface FACING the sun, in full cast
shadow, `x` = 1):

| material | its formula | level reached |
| --- | --- | --- |
| ground, open | `min(x, 0.44) - 0.10 * canopy` (materials.js:488) | 1.0 |
| ground under a closed canopy | same, canopy 1 | 0.0 |
| near leaf | `x * 0.50`, floor 0.30-0.45 (materials.js:1857) | 1.0 |
| far crown leaf | `x * 0.30`, floor 0.18-0.30 | 0.0 |
| bark | `x * mix(0.55, 1, sunny)` (materials.js:2157) | **2.0** |
| crown dabs | `x * mix(0.62, 1, sunny)` (materials.js:2226) | **2.4** |
| rock | `x * mix(0.45, 1, sunny)` (materials.js:2367) | 1.0 |
| the explorer, the creatures | no shadow read at all (materials.js:2703-2724, beastmat.js:527, 599) | **3.0** |

So in a wood's shade a trunk's sun side stands a full step lighter than the floor beside it, crown dabs nearly two
steps, and the explorer walking into the shade of a tree stays in full sunlight. A painter keeps one value for one
light.

### F4. Lurid darks

**Frames:** `earth_temperate_forest_stream_8`, `_16.8` (S under V 0.3: 0.58 and 0.65), `earth_autumn_woodland_stream_16.8`
(0.55), `_18.4` (0.62), `earth_temperate_forest_vista_16.8` (0.54); the maroon crowns from the air.

**Cause 1, the foliage shade.** Leaves, blades, the far crowns and green floor dabs take their shade not from `pcTone` but
from `pcBody(pcDensity(c, 1.35)) * mix(vec3(1.0), pcOilShadeC(), 0.5) * 0.80`, written out five times (materials.js
514, 1864, 2232, 2968, and a variant at 2325). Worked through: the autumn wood's orange leaf (0.94, 0.62, 0.24) comes
out (0.57, 0.20, 0.03), **S 0.94**; a green blade (0.45, 0.70, 0.20) comes out (0.10, 0.27, 0.03), **S 0.91, V 0.27**
(reference meadow in shade: S 0.49, V 0.33; conifer 0.31, 0.26). The 22 Nov fix that took the deepest paint a fifth
toward its own grey was made in `pcTone`; these five copies never got it.

**Cause 2, the last pass** (post.js:785-795). The gentle S over the values is applied to each channel, which pushes the
small channels of a dark colour down faster than the large one; and the saturation push measures "dull" as max - min,
which is small for every dark colour, so every dark gets the full +28 per cent. Worked through: (0.20, 0.12, 0.18)
S 0.40 -> **0.53**; (0.13, 0.15, 0.20) S 0.35 -> 0.47; (0.30, 0.22, 0.16) S 0.47 -> 0.61; the two foliage shades
above clip to **S 1.00** (their blue channel goes to 0). This is the same fault the art pass of 18 Nov measured
(the game's darks at 0.93 against the references' 0.33), and it is why the shadows read as poster paint.

### F5. The day has two looks

**Frames:** `earth_autumn_woodland_stream_8` against `_16.8`; `earth_temperate_forest_stream_8` against
`_16.8`; `earth_misty_wetland_stream_8`; `earth_autumn_woodland_stream_18.4`.

**What is seen.** At 8:00 (sun 25 degrees east) the sky is the same cream-gold as at 16:48 (15 degrees west), and the
land is the same gold-lit picture. At 18:24 (sun 5 degrees under the horizon, dayness 0.81) the sky is still gold, the
west-facing bank is lit yellow-green at local colour and nothing throws a shadow: it reads as a dimmer golden hour,
not dusk.

**Cause.** `pcGold()` (chunks.js:162) = `1 - smoothstep(0.48, 0.86, dot(sun, up))`: full under 29 degrees, a half at
42, zero only at 59 -- Earth's noon sun is 58 degrees. So gold is 0.5 or more for about nine and a half of Earth's
twelve hours of day, morning and evening alike, and it covers the keys (the dawn key's rose light (1.0, 0.88, 0.82)
loses to the fixed gold (1.0, 0.84, 0.52) at 0.75). The sky's twin (sky.js:630) does the same to the sky. And the
direct light has no horizon: with the sun under it, `pcLevel` still lights what faces it (only flattened by `mk`, a
third of the way at 18:24), while the cast shadows have already gone (world/index.js:880: `SHADOW.strength` follows
`mk`): lit and shadowless.

### F6. The golden hour from the air is khaki

**Frames:** `earth_autumn_woodland_high_16.8`, `earth_alpine_meadow_high_16.8`.

**What is seen.** A flat beige sky (on screen (0.83, 0.75, 0.60), S 0.28) and the land going to the same beige.

**Cause.** `pcOilHaze` (chunks.js:470-473) mixes the golden air (0.95, 0.85, 0.63) with the blue-violet (0.48, 0.50,
0.63) at 0.35 EVERYWHERE: (0.78, 0.75, 0.70), S 0.11, a khaki. The owner's references put the gold toward the sun
and the blue-violet away from it and in the far distance; mixed in one place they cancel to grey-brown.
`pcAtmosV` already works out how much a line of sight looks toward the sun (`toward`, chunks.js:496); it is not used
for the hue.

### F7. From the air the crowns are darker than the ground

**Frames:** `earth_autumn_woodland_high_12` (crop `crop_high_forest`), `earth_temperate_forest_high_12`.

**What is seen.** The wood from 420 m is a speckle of dark maroon balls (green-black in the green wood) on a bright
yellow floor: the trees read as holes. In the references from a few hundred metres each crown is the bright thing --
"lit on the sun's side and shaded cool on the other" -- with darker gaps and shadows between.

**Cause: half settled.** What is known: the far crowns' shaded pieces are painted with the lurid deep foliage shade
(F4: V 0.28, S 0.94 for the orange leaf), which is why they are maroon and not a cool shade; and the floor under the
wood is painted the canopy's colour, lit (`c = mix(col2C, colC.rgb, gMid)`, materials.js:446: "far away the forest
floor is its canopy"), so the far floor comes out lighter than the far crowns. What is NOT known is why so many of a
crown's pieces are in shade from above at noon. **Two A/Bs were tried.** `?trees=full` is not valid: it also shortens
the far trees' range, and in that still the far trees are simply not drawn (`earth_autumn_woodland_high_trees_full_12`,
crop `crop_high_forest_full`). `?farcrown=0`, the switch that is meant to take the far crowns' coherent lit side and
deepened shade (materials.js:1840-1853) back out, **changes nothing measurable**: over the same 300 x 150 crop the mean
luminance is 0.565 with it on and 0.564 off, the darkest tenth and the share under 0.35 identical
(`earth_autumn_woodland_high_farcrown_0_12`). The switch is read correctly (materials.js:24), so the crowns seen from
420 m do not go through the code it controls. Group A to find which path draws them and why it is mostly shade.

### F8. Shaded meadows and mountainsides are plum mud

**Frames:** `earth_alpine_meadow_stream_12`, `_16.8` (median V 0.15 and 0.13), `earth_alpine_meadow_vista_12`,
`_16.8`, `earth_sea_coast_vista_16.8` (the cliff in shade).

**What is seen.** The mountain meadow's slope turned from the sun is a dark violet mass of leaf dabs; the green of the
meadow is gone. The cliffs at the golden hour are plum-brown.

**Cause.** `pcTone`'s shade (chunks.js:207, 217) lays half of a shade as a fixed plum at the shade's own value
(`shH` = the cool key's hue with its green drawn down, by day about (1.12, 0.73, 1.12)), whatever the body. On the
clip's orange leaf floor that is right (it was measured there). On a grey-green alpine meadow it is mud. The
exception that paints shaded GRASS deep green (materials.js:513-514) only fires where the dab's wash is clearly green
(`k.g - max(k.r, k.b)` over 0.02-0.10), which the alpine's grey greens are not. The references (16 Nov) put the shade
on grass blue-green.

### F9. Water ignores the golden hour

**Frames:** `earth_autumn_woodland_stream_8`, `_16.8`, `earth_temperate_forest_stream_8`, `_16.8`,
`earth_sea_coast_stream_16.8`, `earth_sea_coast_vista_16.8`.

**What is seen.** Under a cream-gold sky the stream is ice-blue with navy dashes, and in the dark golden picture it is
the lightest and coldest thing; the sea stays blue-grey.

**Cause.** The water's sky colour is `mix(uSkyHorizon, uSkyZenith, ...)` (materials.js:1184): the KEYS' sky. The gold
of the golden hours is added later, inside the sky's own shader (sky.js:630-631), and never reaches those uniforms; so
the water mirrors a blue day sky the picture does not show. On top of that the oil water lays "half the water's own
wash heavy and blue, whatever the sky gives it" (WATER_FRAG, materials.js ~1440). (In the game, last frame's picture
is mirrored too, where it can be found; a still has none, so these stills show the fallback. The fallback is most of
a stream's surface in a wood seen at a grazing angle.)

### F10. Lit grass is lime, not olive-gold

**Frames:** `earth_autumn_woodland_vista_12` (crop of the floor: hue 82, S 0.80, V 0.76, p90 S 0.92),
`earth_temperate_forest_stream_12`, `earth_temperate_forest_vista_12`.

**Cause.** Mostly data: the green wood's `grassLight` [0.82, 0.90, 0.38] and `grassMid` [0.58, 0.78, 0.34] (earth.js
~755) are light and green as washes; the lit paint lays them richer (`pcDensity` 1.38) and 1.12 times lighter
(`uOilB.x`, chunks.js:195); the last pass pushes them another tenth (post.js:795). The reference meadow in sun is
(0.56, 0.57, 0.16): a darker olive gold. Group B (grass) and C (ground) own the data; R2.4 gives the target; the
last pass's part is in L7.

### F11. Nothing far away throws a shadow

**Frames:** every `high`; `earth_autumn_woodland_275m_16.8` and `earth_temperate_forest_275m_16.8` (a 15-degree sun,
and not one tree shadow on the meadow between 80 and 300 m); the far bank in `earth_autumn_woodland_stream_*`. Past the
shadow square the trees stand on the ground with nothing under them. On the phone's tier 1 the square is 90 m to each
side and reaches about 113 m ahead of the feet: the 22 Nov step that carries it to 160 m when looking along the land
runs only at `QUALITY.level >= 2` (shadow.js:233), and from 60 m up the square stays at 90 m (it grows only while the
eye's height times 1.5 exceeds it). From the air that is every tree. The
coordinator's log of 23 Nov holds back a second coarse square to 400 m on cost. A cheaper way that serves the air and
275 m: each far tree carries its own flat shadow shape laid on the ground (one quad a tree in the far mesh, offset
along the sun's bearing, painted the ground's level-1 paint). Group A's files; the rule is R1.3d.

### F12. Things read as polygons

**Frames:** `earth_misty_wetland_stream_12` (the lone tree: a faceted ball, a flat light per facet), the far bank's
crowns in every `earth_autumn_woodland_stream_*` (lumps with lit and dark facets), `earth_*_high_*` (the mountains:
flat-coloured triangles, and large flat patches of yellow, orange and blue-grey in the far ground). R3.6.

### F13. Cliffs smear

**Frames:** `earth_alpine_meadow_high_12` (a vertical smear down the massif's middle), `earth_sea_coast_vista_12`,
`earth_desert_canyon_stream_12`, `earth_desert_canyon_vista_12`. On the canyon walls the long vertical strokes read
almost as painted strata, which is not bad; on the alpine face and the coast's cliff they read as a stretched texture.
**Cause:** `pcGroundChart` (chunks.js) lays the strokes in metres along the sphere on the face of the cube the place
lies on, which is right for ground and edge-on for a cliff: a dab one cell wide on the chart is many metres tall on a
vertical face. A slope chart (the face's own two axes where the land is steep, chosen per stroke at its centre so a
stroke is never cut) is group F's to add to the shared stroke code; group C uses it for rock.

### F14. Near-black discs on the floor

**Frames:** `earth_misty_wetland_stream_8`, `_12` (in full sun), `earth_temperate_forest_stream_*`, `earth_sea_coast_
stream_*`. Ovals at V about 0.10, lying on the floor near the eye; in the misty wetland they are the darkest thing
in a pale picture. **Not settled.** Most likely the small stones of the rock branch (materials.js:2355-2372, `c =
mix(barkA, barkB, ...)` with a dark `barkB`) at a half-level step; possibly a near-ground mark. Group B / C to find with
one A/B (stones off); the rule they break is R1.2c (the darkest things are trunks, V 0.08-0.18, and only in shade).

### F15. Two copies of the air

`materials.js:91-110` (`pcFogAmountV`, the plants' air in the vertex shader) is the ground's `pcFogAmount` copied by
hand; on 22 Nov it was found to have drifted (1.6 against 2.4, and no shoulder ease) under a comment saying the two
matched. Any change to the air (F2 is one) has to be made twice. One chunk included by both is the cure (L8).

### F16. Bark streaks run across the trunk

**Frame:** `earth_autumn_woodland_stream_16.8` (crop `crop_trunk`: the three big trunks on the right). The
streaks on a heavy trunk lie horizontally, stacked like courses of bricks; the clip and the owner's references have
long streaks running UP the trunk ("a thick trunk in long flowing strokes"). R3.5. Group A (the bark's chart in
`PROP_FRAG`).

---

## The other worlds

### Mars (rust canyons, dust dunes)

**Frames:** `mars_rust_canyons_stream_12`, `_16.8`, `_23`, `mars_rust_canyons_275m_12`, `mars_dust_dunes_high_12`.

- **By day Mars reads as a painting**, the best of the worlds after the autumn wood: at the golden hour long violet
  shadows lie across the orange floor and the spires take orange on their sun side; from 60 m the canyon walls are
  stratified bands of strokes that keep their colour into the distance.
- **Its night is F1 again:** at 23:00 the floor is the day's orange at nearly full strength (median V 0.61 against
  0.83 at noon; the lightest fifteenth S 0.65 against 0.34 by day) under a blue night sky. Mars' `nightNear` (0.30)
  is read only by the watercolour's sheet, not by the oil look's last pass.
- The spires are faceted planes with a flat light each (`PROP_FRAG`'s rock branch, as designed: "planes of flat
  paint"); at this size they read as painted rock, not as polygons, so they do not count under F12. Their
  silhouettes are stair-stepped (no edge smoothing at tier 1); that is aliasing, not blur, and the cure is NOT a
  softening filter (R4.1).
- From 420 m the sky over the dunes is seven tenths space, with stars at noon: Mars' air is 450 m deep, and the land's
  air and the sky's agree (both read the same height since v34). Correct for this scale. The space wisps in that sky
  are soft-edged (group D: R4.1, the aurora is the only soft thing).
- Darks: S(V<.3) 0.58-0.59 by day (R2.2 wants 0.50): F4.

### Pluto (lilac mountains)

**Frames:** `pluto_lilac_mountains_stream_12`, `_23`, `pluto_lilac_mountains_275m_12`.

- A world in one family of violet: strokes that run with the land ("flow"), pale shards. It reads painted.
- **Its night survives F1**, because nothing on it is warm: noon and 23:00 are the same violet picture a step bluer.
  That is also its fault: Pluto's day and night are hard to tell apart (median V 0.65 at noon, 0.60 at 23:00, and
  the night MORE saturated, 0.60 against 0.37): its day is dim by design, but the night key should still take a step
  of value and some colour out (L1's per-world night numbers).
- **The far hills are a quilt of rectangles:** past about 60 m the long flow strokes come out as short courses of
  pink, white and violet bricks with straight cut ends, a grid. The shared thin-stroke function (`pcThinR` /
  `pcThinLayer`, chunks.js) gives square ends and courses of equal width at a distance; the owner rejected exactly
  that look on snow ("it looks like tiles"). Group F's (the shared stroke) with C (the far ground): the far octaves of
  a flow stroke want a ragged end (`pcThinR`'s `rag`) and a longer length.

### Venus (fungal towers)

**Frame:** `venus_fungal_towers_stream_12`.

- One warm family from sky to floor (amber sky with darker amber clouds, red caps, pale stems, a yellow floor):
  Venus' own character, and it reads painted. What it lacks is the clip's second half: there is no cool shade
  anywhere, so the shade under the caps is a red-brown and the picture has no opposite colour (R2.5). The cool key
  on a hot world can be a muted violet-grey and still be Venus; that is a palette call for the owner's eye, not a
  fault in the code. Its darks are the most lurid measured anywhere: S(V<.3) 0.72 (F4).
- The stems' streaks run across them in bands, as the trunks' do on Earth (F16, group A's bark chart).
- The floor is a confetti of green and red flecks on yellow: the dab tint's strays (`pcDabTint`'s `odd` leaves, 7 per
  cent red, 13 per cent green, chunks.js) are meant for a leaf floor and read as noise on a fungal world's ground.

### Neptune (the aurora tundra, the snow the owner liked)

**THE SNOW WORLD DOES NOT LOAD IN THE OIL LOOK AT v37.** The gallery page threw `ReferenceError: spec is not defined
at bareGeometry (src/world/florakit.js:102)` from `Flora._init` and never became ready. Cause: commit 496623d (19 Nov)
put `oilCurve(p0, p1, p2, spec)` and `oilCurveR(spec, ...)` into `bareGeometry(seed, lod)`, which takes no `spec`;
the bare tree exists only in the oil look (neptune.js:46, `kit: 'broadleaf', bare: 1`), so the watercolour game is
untouched. The game's frame loop does not catch, so the snow world very likely freezes in the game too, which would
also explain why the 23 Nov Neptune stills never came. **Reported to the coordinator at once (send_message).** The
one-line fix (`bareGeometry(seed, lod, spec)` in its signature and in `KITS.broadleaf`, florakit.js:76 and :804) is
group B's file and was NOT made on this branch. **The Neptune stills below were taken from a scratch copy of the tree
with exactly that one line changed and nothing else**; the repository is as it was.

**Frames:** `neptune_aurora_tundra_stream_12`, `_16.8`, `_23`, `neptune_aurora_tundra_275m_23`,
`neptune_aurora_tundra_high_12`.

- **The night is still the night the owner liked:** a teal sky, the aurora as soft green rays (the one soft thing),
  the snow the lightest thing in pale blue, firs and bare trees dark. At 275 m by night the snow lies in long sweeping
  blue strokes with the firs as small dark marks: a blue night seen from the air that reads, as The Pathless
  reference asks. Any night fix (L1) must leave this within a breath: Neptune's own night numbers.
- **The noon snow is too bright:** 14 per cent of the noon still is over V 0.90 (the owner, 16 Nov: "I also dont like
  how Bright the snow area is"). R1.2c: snow in sun at most 0.92; `pcIce`'s pale end and the lit gain are where.
- **The aurora shows by day,** as soft rays in a blue noon sky and a peach golden-hour sky: sky.js keeps 30 per cent
  of it at full day (`aStr = uAurora.x * (0.30 + 0.70 * (1 - dayness))`, sky.js:350). The owner's aurora is a night
  light; by day the soft rays are the one soft thing where nothing else is soft. Group D.
- **The lake by night is a loud field of neon-green and navy dashes** (the water carrying the aurora's green,
  `uAuroraK`), louder than the aurora itself: the darks there measure S 0.86 under V 0.3 (F4). Group E: the aurora's
  green on the water wants to be a few dashes in the path below the aurora, not every other dash.
- **Dark discs on the snow** (F14), near-black ellipses on the white near the eye.
- **From the air at noon the snow world is pale all through** (`neptune_aurora_tundra_high_12`): a near-white ball
  under a flat grey-blue sky, the firs as specks, and the open water and ice as flat saturated-blue triangles (F2 and
  F12 together).

### What was not covered, said plainly

Uranus, Jupiter, Saturn, Mercury and the Moon were not shot in this audit (the brief asked for three worlds besides
Earth; four were done). No still was taken in weather (rain, storm, snowfall, fog), in motion, with the explorer or a
creature in frame (the gallery draws neither), or of the lantern's pool (the gallery has no wanderer): F3's claim about
the figure and the creatures rests on the code and the arithmetic, and the build lane's own stills must show it in
the game. Nothing here says what anything costs on the phone; every cost is derived.

---

## The build lane of group F (the shared light and paint), in order

Each item: what changes, in which file, its switch (off = the picture before, to the bit), its phone cost (derived from
the owner's v37 table and the instruction count, NOT measured here), the stills that judge it, and whether it shifts
the pictures other groups are judged under -- so the coordinator can order the merges. **Nothing here is built yet:
the go-ahead is the coordinator's.**

How the costs are derived. The v37 table: the ground's whole paint and shape 4.8 ms ("no ground drawn"); the leaves'
own paint, worked out once a leaf in the vertex shader, 0.6 ms ("a leaf in its own colour"); the air on the plants
1.8 ms; the light in the air (one full-screen pass of up to sixteen taps of two reads) about 2 ms. A change of k
instructions in a shader that does about N is costed at k / N of that shader's row. Where a branch is on a uniform
(the same for every pixel, e.g. `uMoon > 0.0`), the side not taken costs nothing measurable.

| # | what | files | switch | phone cost | judged by | shifts others? |
| --- | --- | --- | --- | --- | --- | --- |
| L0 | **One air chunk** (F15): `pcFogAmount` moved to one chunk included by both `FRAG_PARS` and the plants' `FOG_VERT`; the hand copy deleted | chunks.js, materials.js (FOG_VERT only) | none: it must be bit-identical | 0 | a pixel diff of S1-S4 against v37: 0 pixels differ | no |
| L1 | **The night key** (F1). In `pcTone`, by the moon only (`uMoon`, a uniform branch): the colour goes a world-set share toward its own value in the night key's hue (Earth about 0.55; the key's hue keeps its own green, so Neptune stays teal), the lit and local paints come down to a world-set strength (Earth about 0.60, Neptune about 0.85: a look's `oil.night.v`), the shade a little. In the last pass the warm excuse is taken from the lantern's own reach (the pixel's place from its depth against `uLampV`, within 4.5-6 m) and region 8, not from a hue | chunks.js, post.js, world/index.js (the night's two numbers), shared.js (a `uOilN` and `?nightkey=`) | `?nightkey=0` | by day 0 (the branch is not taken); by night about +8 instructions in the ground (~250) = 0.15 ms, in a leaf's paint (~60) = 0.08 ms, post +6 = under 0.05: at most 0.3 ms, only at night | S5, autumn wood on foot and at 275 m at 23, coast and wetland at 23; Neptune tundra at 23 must stay within a breath of today; the lantern in the GAME (the gallery has no lantern): `/?body=earth&time=23&look=oil` | **yes: every night picture** -- land first, before any group judges a night still |
| L2 | **One foliage shade** (F4 cause 1, half of F7). `pcShadeLeaf(c)` added to `PAINT`; the five copies replaced by the call. Targets: V 0.22-0.35, S at most 0.50; shaded grass blue-green, a shaded orange leaf plum-brown | chunks.js; the five one-line swaps in materials.js (514 C's ground, 1864 and 2232 A's leaves and crowns, 2968 B's near ground, 2325 A's variant), **done by F in one commit with the coordinator's leave**, because it is one expression five times | `?leafshade=0` | +3-4 instructions: leaves' vertex paint 0.04 ms, ground's green dabs under 0.05 ms | S1, S2, S4 and its crop of the crowns, S(V<.3) by lookstats before and after | **yes: A, B, C's shade** -- land with L7, early |
| L7 | **Quiet darks in the last pass** (F4 cause 2): the S curve on the luminance (the colour scaled by S(L)/L, so the hue and saturation are kept); the saturation push weighted by the HSV saturation and faded out under V 0.30 | post.js (`OIL_FRAG`), shared.js | `?postdark=0` | +6 instructions on one full-screen pass: under 0.05 ms | S1-S6 before and after; S(V<.3) must fall to 0.50 or under; the lit canopy's saturation must not fall | **yes: every picture, a little** -- land with L2 |
| L3 | **One light** (F3): `pcLit(x, sunny, canopy, soft)` in `PAINT` (the ground's own formula, which is the reference); every material calls it (bark, crown dabs, rock, near and far leaves); the explorer and the creatures read the shadow at their own place (`pcSunAt`, one fetch) and call it | chunks.js; one line each in materials.js (A: 1857, 2157, 2190, 2226; C: 2367), FIG_FRAG and beastmat.js (no group owns the figure or the creatures: F, with the coordinator's leave) | `?onelight=0` | the same instructions where it replaces a formula; +1 fetch on the figure's and creatures' pixels (a few per cent of the screen): under 0.05 ms | autumn vista at 16.8 (trunks against the floor), S1; the explorer under a tree (the game) | **yes: A (bark, crowns go darker in shade), the figure, the creatures** |
| L5 | **The air from the air, and its hue** (F2, F6): from the air the distance taken about 1.4 times (not 2.4) and a share of the far paint kept at every height (about 0.20, not 0 from the air); the far air leans gold TOWARD the sun and blue-violet away from it and with distance (`toward` is already worked out in `pcAtmosV`). On the ground (`pcHigh` 0) nothing changes | chunks.js, the twin lines in world/index.js (`SHADOW.air`), shared.js | `?airfar=0` | +3 instructions in `pcAtmosV` (every material, fragment) and the vertex twin: about 0.1 ms | S4 at 12 and 16.8, alpine `high`, S3; S1 must be identical on foot (pixel diff) | **yes: C's whole lane** -- land before C judges its far stills |
| L6 | **The shade follows the body** (F8): the plum share of a shade kept for warm bodies (the clip's orange floor) and turned toward blue-green for green and grey ones | chunks.js (`pcTone`) | `?shadehue=0` | +4 instructions in `pcTone`: about 0.1 ms | alpine on foot and vista at 12 and 16.8; S1 must not move (the orange floor keeps its plum) | yes: B, C (meadows, slopes) |
| L4 | **The hours** (F5): the morning takes a third of the gold (the dawn key's own rose-pearl and a clear morning show); the evening's golden hour unchanged (the owner approved it: S1 at 16.8 must not move); the direct light fades out over the last degrees above the horizon, so dusk is flat and lit by the sky, as the shadows already go | chunks.js (`pcGold`, `pcLevel`), sky.js:630 (the gold's twin: one line, moved in the same commit, with group D's agreement), world/index.js (morning or evening, the sun's height: two numbers into a `uOilH`), shared.js | `?hours=0` | 0 (two uniforms; two instructions in `pcLevel`) | autumn wood on foot at 8, 16.8, 18.4; the wetland at 8 | **yes: everyone's mornings and dusks; the owner should see the new morning** |
| L8 | **A slope chart for cliffs** (F13): the stroke chart takes the steep face's own two axes where the land is steep, chosen at the stroke's centre so no stroke is cut | chunks.js (a `pcSlopeChart` beside `pcGroundChart`); group C calls it for rock and cliffs | `?cliffchart=0` | only on steep pixels (a branch): +10 instructions on a few per cent of the ground: about 0.1-0.2 ms | alpine `high` at 12, coast vista at 12, canyon vista at 12 | yes: C |
| L9 | **The sky as painted, for whoever mirrors it** (F9): `pcSkyAt(dir)` in chunks.js giving the sky's colour as the sky shader lays it (the keys, the gold, the air's band), so the water mirrors the picture's own sky; E calls it where it reads `uSkyHorizon` / `uSkyZenith` | chunks.js; one call in E's WATER_FRAG | `?watersky=0` | +6 instructions in the water ("no water drawn" is 0.6 ms in all): under 0.05 ms | streams at 8 and 16.8, the coast at 16.8 | yes: E |
| L10 | **Flow strokes far off are not tiles** (Pluto, the ice worlds' far ground): past the near octaves a thin stroke keeps a ragged end (`pcThinR`'s `rag`, today 0 there) and grows longer rather than wider, so the far land is not a quilt of square-ended bricks | chunks.js (`pcThinR`, `pcThinLayer`); group C judges the far ground | `?farflow=0` | about +4 instructions where the flow strokes are laid (a few worlds' ground only): under 0.05 ms | `pluto_lilac_mountains_275m_12`, Uranus' and Neptune's far snow | yes: C, the ice worlds |

**The whole lane: at most about 1.0 ms on the phone by day, 1.3 ms at night, inside the 1.0 ms budget of LOOK-RULES
R7 by day.** If the trees group's redesign changes the leaves' shader counts, the costs above move with them and are
restated.

**The order, and why.** L0 first: it is free, it changes no pixel, and every later air change (L5) would otherwise have
to be made twice. L1 next: it is the largest fault on screen and it touches only the night. L2 + L7 together: they are
the darks, and the trees, flora and far-view groups will judge their own shade against them. L3 before group A builds
new tree materials, so the new ones are born calling `pcLit`. L5 before group C's far stills are judged. L6, L4, L8, L9
after, each when its group is ready.

## What the other groups must change (for the coordinator to pass on)

- **A (trees):** F7 a far crown's mean value seen from the air must be its near mean (crowns the bright thing, not
  holes), and `?farcrown=0` changing no pixel of the far wood from 420 m must be explained (the switch is read; the
  far crowns there do not go through it); F11 far trees carry their own shadow shape on the ground (R1.3d; and note
  that on the phone's tier 1 the shadow square stays at 90 m, `shadow.js` reach step is `QUALITY.level >= 2` only);
  F12 no faceted lumps, near or far (R3.6); F16 bark streaks along the trunk (R3.5); and every new tree material
  calls the shared light (R5), so build after L2 and L3 land.
- **B (flora), URGENT FIRST:** the one-line fix to `bareGeometry` (florakit.js:76 and :804) so the snow world loads
  in the oil look at all (Neptune, above). Then F10 lit grass to olive-gold by the data (R2.4: hue 55-75, S at most 0.75, V 0.50-0.72); F14 the
  near-black discs (with C); new plants call `pcTone` / the shared shade (R1.2b), never a private recipe.
- **C (far view):** F12 the mountains and the far ground as large flat-coloured triangles (R3.6); F13 cliffs with the
  slope chart (L8); judge the far view only after L5.
- **D (weather and sky):** the sky's gold twin (sky.js:630) moves with L4 in one commit; the clouds' violet shade is
  laid in blotchy camouflage patches (`earth_sea_coast_stream_12`, `earth_desert_canyon_vista_12`): a cloud's shade
  wants one or two flat shapes, not a mottle; from the air the sky is one flat colour (`*_high_*`); the aurora by day (sky.js:350 keeps 30 per cent at noon) wants
  to be a night light only; the space wisps over Mars are soft-edged (R4.1).
- **E (water):** F9: mirror the sky as painted (L9's `pcSkyAt`); the stream's navy dashes beside near-white ones are
  the strongest contrast in the golden pictures: hold the water's value range inside the land's (R1.2c: V 0.45-0.70); on Neptune by night the aurora's green on the lake
  is every other dash and louder than the aurora (a few dashes in the path below it); a faint seam across the sea where
  two patches of dashes meet (`earth_sea_coast_275m_12`).
