# PAINTER notes

## Hand-over of THE FAR VIEW, group C, branch `farview` (READ THIS FIRST if you are group C; kept current)

A helper session of the coordinator (24 Nov) works here on the ground seen from the air, after the owner's words of
24 Nov: "things should look good far before I get there like when im flying high in the sky up to a mile I want trees
from a distance to look good rocks the water the grass". The design is `docs/lead/FARVIEW-DESIGN.md` on `r2`; the look's
rules and audit are `docs/lead/LOOK-RULES.md` and `LOOK-AUDIT.md` on `look-director`. This lane's packages: FV2 (the
canopy painted into the ground), FV3 (the floor and the far colour follow the year), FV4 (rock faces, strata and snow
from afar; the audit's F12 faceted mountains and F13 cliff smears, with the look director). Not this lane's: FV1 (the
sky to a mile: look director), FV2-T and FV7 (the far trees and the air speed test: trees-far group), FV5 (water), FV6
(meadows). Files of this lane: `src/render/farground.js` (new), `src/world/farstand.js` (new), TERRAIN_VERT/FRAG in
`src/render/materials.js`, `src/world/terrain.js`, `src/world/patchgen.js`, `src/world/surface.js` (recipes and far
colour only). NOT chunks.js, post.js, shared.js, world/index.js (look director), NOT flora.js, florakit.js (trees groups).

**STATE (24 Nov, second session):** FV2 and FV3 ON by default (FV2 merged into look-proto as v39). FV4 step 2, THE
COAST CLIFF, built and SEEN at E-W2's widest fall, behind `?rockfield=1` (still off by default; the look director
called step 1 fine to turn on once FV3's summer re-measure on look-proto is in). The canopy's 3 px floor (look director)
built: `?canfloor=` (2.6 px; 0 none), its stills being taken. The ground's "30 ms from the air" is CLOSED (A2 measured
about 50 patches and 60k vertices at 400 m: no such cost); my side note: terrain.js sets `material.uniformsNeedUpdate` for
every patch, so three.js re-sends 59 uniforms per patch (4.7 us a patch here, 0.6 ms a frame at 150 m up: a small saving
for later, e.g. a short uniform list after the first patch of a frame, textures always). SLOTS: in v39.2 the water keeps
sample slot 23 (`still`), my snowK moves to 24 (the coordinator did it); W3's runoff cap/swell go to 25/26. QUEUED (in
order): the mountain faces; merge v39.2 and check a ?rockfield=1 still, re-measure FV3 summer on foot for the look
director; FV6(b) bloom from the air with flora B (a new 4-byte ground attribute: cover and a palette index, o.fd / o.fi
from world/bloom.js on design-flora, palette bloomPalette(S).colours as a uniform vec3[16], behind ?bloomfar=1); E's
runoff bed in dry colours where c.capOnly (behind ?runoff=1), the sand colour and the bar's under. Scratch: a worktree of
farview + water-bodies (not pushed) for the falls stills; `fallcam.sh` places the camera relative to the widest fall
(window.__pcGallery.state, S.hydro.falls).

**STATE (24 Nov, end of the first session):** FV2 and FV3 built, seen, pushed, ON by default; FV4 a first step, pushed,
OFF by default (`?rockfield=1`). Reviews asked of the look director and the coordinator for all three (stills in
`docs/shots/painter/farview/`). Waiting on: the look director's ruling, the slope chart (L8) for FV4, the canopy's row in
bench.js's air table (sent to the coordinator; PILOT's file). The branch merges clean with look-proto, look-director,
trees-far and main. Guards: the watercolour game identical to v37.1 (0 pixels), the autumn wood on foot identical (0).
The lab: `PC_LAB_STATE=<scratch>/lab.json node tools/lab.mjs serve` (background, it is stopped after two hours), then
`open` a gallery address and `grab`; the views used are cam=high with dy/pitch (150 m dy=-270, 400 m dy=-20, 1 km dy=580,
pitch -16.4 for 45 deg, -61 for straight down; alpine pitch -1.4), phone 1024x480 quality=1 lite=1 t=0, desktop 1280x720
quality=2 lite=0. `?candebug=1` colours each canopy dab by what it is.

**FV2, THE PAINTED CANOPY (`?canopy=0|1`, default 1; the oil look on Earth only).** BUILT AND SEEN in stills (list below).
- `src/world/farstand.js` `standAt`: at every ground vertex, the tree placer's OWN keep share there (`stand`, 0..1: the
  clump field, s.trees, the outside-the-woods group field, water) and the share of needle trees (the grove field picks
  the pair, the roll the kind). A copy of `floraplace.js placeTrees`' arithmetic, not a call: `src/world/farstand.test.mjs`
  counts the placer's real trees over 147 cells against it (MEASURED: autumn wood 1,901 real against 1,855 predicted,
  green wood 2,590 / 2,557, mountain 42 / 42; needle share 0.186 real / 0.169 predicted). If the placer changes, the
  test fails. Packed by `patchgen.js` into the far wash's spare alpha byte (stand) and the parameters' fourth byte (the
  needle share: a crack's depth, which the oil ground never painted), only when `canopyOn(S.id)`; otherwise the bytes
  are the old ones. MEASURED in Node: +0.26 ms a patch (+8.5 %) of the mesher's time slice.
- `src/render/farground.js`: the GLSL and the uniforms. The canopy is laid in ITS OWN TWO LAYERS OF DABS
  (`pcCanopyLayers`, called first in TERRAIN_FRAG's leaf-dab branch), at `?candab=` (0.5) and twice that of the ground's
  finest cell: from a few hundred metres up the ground's own dab is as big as a whole crown (SEEN in the debug view,
  `?candebug=1`), so a cap and a shaded side could not be laid with it. Each dab asks, at its own centre, which crown of a
  jittered 8 m grid on the ground chart it lies on (four cells tried; a cell holds a crown by 1 - exp(-3 stand), the
  placer's cover): a lit cap toward the sun (larger with a high sun), the body, the shaded side, a taller neighbour's
  shadow, or the floor between crowns (in a crown's shadow or under a close roof: the crowns' own deepest wash, little
  sky fill; at an open edge: left to the ground's own dabs). Where a crown is no bigger than a canopy dab, one cell, one
  hash, the crown's mean light turned by the hill. Needle trees in groups of a few crowns (`pcCanNeedle`), dark, narrower.
  Colours: `syncCanopy` (called by terrain.js each frame) writes the far trees' own washes for the season (the same look
  data and rule as flora.js setSeason: each kind with its `oil` entry, broadleaf summer/autumn dresses averaged, the
  family red riding the season), and each crown takes its place on the family run as the far tree does. Gate, at the
  dab's centre: the eye looks down on it (5 degrees or more), 15 to 30 m above it or more, 60 m away or more; a pixel
  with the eye less than 10 m above it skips everything at one comparison (on foot, nearly every pixel).
- The ground's own dabs under the roof also ask the canopy (so the slivers between canopy dabs are crown-coloured), and
  the bare ground between dabs takes the crowns' mean over the share they cover.
- The canopy's lights are held at level 2.6 (between local and lit paint): with the full lit paint the lemon crowns
  passed V 0.90 (a 1 km still went 11.1 to 13.7 per cent over 0.90; with the cap 11.1, as before).
- Speed test handle: `CANOPY_BENCH.off` (farground.js) lays no canopy at run time (MEASURED: the same picture as
  `?canopy=0` but for 465 pixels at most 2/255 apart). The row for core/bench.js's air table is sent to the coordinator
  (bench.js is PILOT's): `['canopy painted off (FV2)', () => { CANOPY_BENCH.off = true; }, () => { CANOPY_BENCH.off = false; }]`.
- **SEEN (stills opened, `docs/shots/painter/farview/fv2_*`, A above B):** autumn wood 150 m, 400 m, 1 km at 45 degrees
  and 400 m straight down at the phone's settings (1024x480, tier 1, lighter paint), 150 m and 400 m in summer, 150 m and
  400 m on the desktop's top tier (1280x720, tier 2, full paint), the alpine range at 400 m (unchanged but for a few
  pixels: few trees there), and on foot (S1, 16.8 h): IDENTICAL, 0 of 491,520 pixels differ. The watercolour game at the
  400 m view: 0 pixels differ. In summer the change is largest: the green wood no longer stands on a gold floor and the
  far hill is green. From 1 km the "carpet of giant leaves" becomes a roof of smaller crown-coloured strokes in stands of
  yellow, orange and red, with dark conifer groups.
- **lookstats (docs/lead/lookstats.py on look-director), A -> B:** V over 0.90: 150 m 11.8 -> 9.9 %, 400 m 10.5 -> 6.9,
  1 km 11.1 -> 11.1, down 21.3 -> 14.6, summer 150 m 10.1 -> 4.2, summer 400 m 9.3 -> 2.4, desktop 150 m 12.4 -> 9.8,
  desktop 400 m 11.6 -> 7.3. S(V<0.3): never higher (150 m 0.40 -> 0.35; 1 km 0.82 both: that is the space sky, FV1).
- **PHONE COST, DERIVED (nothing measured on a phone).** On foot: one dot product and a comparison per pixel in main,
  then one comparison each where the canopy is asked (its layers, each ground dab, the bare ground) and two derivatives:
  about 12 instructions of the ground's about 700, so at most 1.7 % of the v37 table's 4.8 ms, 0.08 ms. From the air:
  where crowns are no bigger than a canopy dab (most of a view from 400 m up) a canopy dab is about 300 instructions and
  2 to 3 texture reads and it REPLACES a ground dab (about 400 and 3 to 4) wherever it covers, so roughly even (within
  plus or minus 10 % of the ground's pixel work: at most 1.7 ms either way on the design's 17 ms bound); in the near band
  of a 150 m view a canopy dab tries four crowns, about 550 instructions, so about +15 % of the ground's pixel work over
  the picture: between +0.4 ms (if the ground's 2.4 ms were all triangles) and +2.5 ms (if the 17 ms were all pixels).
  SOFTWARE DRAWING here (CPU, not a phone, for direction only), whole frame, canopy on against off in the same page:
  150 m +3.3 %, 400 m within noise (-2.6 % / +0.5 %), 1 km +6 to 7 %. The mesher: +0.26 ms a patch (+8.5 %) in Node.
  Confirm on the phone with the air table's row.
- Suites: unit 325, world 59 (57 + farstand.test.mjs's 2), physics 416; all.mjs static passes.

**FV3, THE FLOOR AND THE FAR COLOUR FOLLOW THE YEAR (`?groundseason=0|1`, default 1; oil look, Earth).** BUILT AND SEEN.
- `surface.js` sample: two blended shares of TREES, those of woods painted in a summer palette (`canS`, every wood but
  one whose look says `autumn: 1`) and in an autumn one (`canA`); `patchgen.js` packs them into the parameters' first two
  bytes (dry and wet, which the oil ground never reads), only with the switch on.
- `farground.js` SEASON_VERT: in the VERTEX shader the far colour vCol2 moves by (now - summer mean) x canS + (now -
  autumn mean) x canA, broadleaves only (x (1 - needle share)); the means are the painted canopy's own (`crownMean`, the
  family run at each season). SEASON_FRAG: the fallen leaves' share is 0.7 of itself in high summer, all of it in autumn,
  and a summer leaf is last year's (the floor's own wash toward its brown, a third to grey).
- MEASURED / SEEN: at the top of autumn the autumn wood is IDENTICAL on foot (0 of 491,520 pixels) and, from 400 m, the
  only pixels that move (20,966) are the green wood and the wetland on the horizon, whose broadleaves do turn gold
  (fv3_wood_400m_45deg_12h_autumn_changed_pixels_magenta.jpg). Three earlier forms were measured wrong and replaced: the
  season read off the palette's hue (19,518 pixels of the autumn wood moved on foot), a blended palette-season byte
  (43,595 pixels where the wood meets the mountain), and canopy in place of trees (the river banks turned turquoise in
  summer: the canopy counts a bank's shade). In summer: the far hills lose their orange, fewer red leaves on the floor
  (fv3_* sheets). lookstats: summer 400 m V>0.90 2.4 -> 2.7 %, 150 m 4.2 -> 4.1; ON FOOT IN SUMMER S(V<0.3) 0.61 -> 0.63
  (worse by 0.02 on C7; the darkest 15 % 0.47 -> 0.45): the dark pixels that change were brown leaves in shade, now
  grass in shade, whose paint is today's saturated green (audit F4, the look director's L2). Phone cost: per vertex for
  the far colour; about 10 instructions a dab for the leaves (about 1.5 % of the ground's: at most 0.07 ms on foot,
  0.25 ms in the air on the design's bounds).

**FV4, ROCK FACES AND SNOW FROM AFAR (`?rockfield=0|1`, DEFAULT 0 until the look director rules; oil look, Earth).**
BUILT AND SEEN, a first step; NOT the cure for the smear (F13 needs the look director's slope chart, L8: asked 24 Nov).
- `surface.js` sample `snowK`: how much SNOW the recipe laid over the wash (alpine: by height and noise only).
  `patchgen.js`: once the patch's normals are known, the snow is taken off faces from about 49 degrees, all but a fifth by
  61 (the surface's own mix undone, laid again with less), in both washes. First tried from 38 degrees: it took the snow
  off nearly every summit at a far patch's spacing and the range went grey (SEEN; fixed).
- `farground.js` ROCK_FRAG (`pcRockWash`, uRockK Earth only): on steep dabs (35 to 48 degrees) from 80 m out (all by
  250 m) the wash goes half way to its own value (the alpine green and cream patches off the faces), two densities of it
  by height band where the biome has strata; in pcGroundPaint no dab on rock is laid a step darker by its own number and
  its pigment and stray are halved. Without the distance fade the whole green slope at the alpine easel went grey (SEEN:
  the ground cannot tell steep turf from rock; there is no spare byte left to tell it).
- SEEN (fv4_* sheets): alpine 400 m at 30 deg: summits keep snow, steepest faces dark rock, the lilac/mint mottle calmer
  (V>0.90 4.8 -> 3.3 %, S(V<0.3) 0.11 -> 0.13); 1 km: rock ribs through the snow (V>0.90 5.8 -> 4.2 %); coast cliffs at
  400 m: next to no change; on foot at the alpine easel: the same to the hundredth in lookstats (only the far peak loses
  its lilac). Honest verdict: a modest step; the faces still smear vertically and the far mountains still read faceted
  (F12 is the coarse mesh's silhouette: triangle count, unpriced). Phone cost: per vertex for the snow; about 25
  instructions on a steep dab only (at most 0.7 ms on an alpine air view on the design's bound, nothing on foot in a wood).
- **STEP 2 (24 Nov, second session): THE COAST CLIFF, behind the same `?rockfield=1`.** The coordinator put it first:
  the berm's ruled wall round E-W2's falls (`water-bodies`), which read as vertical rainbow stripes from the sea.
  WHY IT STRIPED (SEEN, `?rockdebug=1..4`): (1) the ground's chart is laid from straight above, so on a face a dab is
  stretched down it; (2) the wall is a STAIRCASE of upright facets (the coast runs across the terrain's grid), its
  smoothed vertex facing has gentle columns every few metres, and everything carried to a dab's centre by screen
  derivatives jumped at every facet's edge; (3) the vertex washes at the wall's top are the coast's patchy colours.
  WHAT IS DONE (all in `farground.js` ROCK_FRAG and TERRAIN_FRAG's dab loop):
  - L8 `pcSlopeChart(pB, nB, upB, cell)` and the UPRIGHT CHARTS: u along the strike, v the height running down. The
    strike is taken in EIGHT FIXED WAYS (22.5 deg apart on the ground's chart, at most 2 % stretch), never turned
    smoothly (a smoothly turned u swims by metres: the chart counts kilometres). `pcFaceLayer` lays each of the three
    ground layers on steep land: the strike's two nearest ways and the ground's own chart, each dab kept by its own
    number against the shares (face share 37 to 50 deg; the two ways by the strike's place between them), so there is
    no seam and no crushed band: the look director asked for a smooth blend, which two charts kilometres apart in number
    cannot give; whole dabs crossing over is the same idea without one.
  - The shares are asked AT THE PIXEL (smoothed facing, continuous), not carried to the centre. The facing for the face
    decisions is the STEEPER of the smoothed and the triangle's own (cross of gBdx, gBdy): on the staircase every
    triangle is upright. A face dab's centre is EXACT from its chart (`pcFaceCentre`: v is the height there), and it
    takes the pixel's own washes (no carry). Its LIGHT is a plane facing straight out from its way of the strike
    (`pcFaceLight`), mapped into the eye's axes by the frame the smoothed facing and up make in both: before, each
    column of the staircase was lit apart (stripes of light and shade).
  - THE CLIFF'S ROCK (`pcCliffC`), from 49 deg (all by 60), at every distance, where the land has beds (strata over
    0.2: the coast, the range; never a wood's cut bank): beds by height (`ROCK_LOOK.earth`: 5.5 m mean, leaning and
    wandering along the face), a light bed and a dark one in turn (pale yellow ochre or slate; warm grey or red umber:
    mixes of the shared pigments, data/looks/common.js), a dark seam at a bed's foot and a lit lip at its top; GULLIES
    down the face where a slow field across it runs high (22 m), the beds lost under scree and the light taken to the
    shade (level 0.9); the last 1 to 3 m over the sea wet and dark. The cliff's edge with the turf is broken by whole
    dabs (each rock or turf by its own number and a 4 m field against the share at its centre). No leaf shadow and no
    fallen leaves on rock (the leaf-shadow pattern, laid flat, ran down the cliff in dark blocks: SEEN, fixed). Between
    the dabs on a cliff the rock at the pixel's own place.
  - SEEN at E-W2's widest fall (scratch merge of farview + water-bodies, `?rivers=tree&falls=1`): from the sea at 68 m
    the wall reads as a layered sea cliff (cream, umber and slate beds, dark gullies, wet foot); 150 m: a rock wall
    under the turf; 400 m straight down: a thin rock edge along the coast. Stills `fv4_cliff_*` (A rockfield=0 above,
    B below).
  - NOT DONE: the TOP SILHOUETTE is still ruled from the sea (a geometry change in surface.js near the wall; not without
    E-W2, hydro.js measures the lip on that surface); NO BEACH (the wall drops into 22 m of water at the falls: there is
    no ground at its foot to paint); the staircase itself shows from 150 m (zig-zag of the wall in plan).
  - Debug: `?rockdebug=1` dab charts (red/orange upright, blue/cyan ground chart on steep land, grey between), `=2`
    the smoothed facing, `=3` the triangle's, `=4` the beds' heights.
- **Next for FV4:** judge the mountain faces with the cliff paint (it applies to every steep bedded face on Earth),
  then the broken top with E-W2; a per-vertex rock value (a new 4-byte attribute, `aFar`, offered to the water and
  flora groups) to keep steep turf green.

Branch: `cosmos` (shared with PILOT and PHYSICS, one working tree). Commits: `tools/commit.sh painter`.
This file was rewritten by the second PAINTER agent (the first ran out of working context). The
first agent's record of M1 is kept at the end ("Earlier answers").

## Hand-over of THE WATER'S PAINT and THE PLAYER AND THE WORLD (water group, lanes W3 and W4; branch `water-paint`)

A helper session of the coordinator, kept current after every step (the container can restart). The design is
`docs/lead/WATER-DESIGN.md` (3.4, 3.6, 3.7, 5.3, 5.4 are these lanes; 6 the speed-test rows). Everything is behind
`?wpaint=2` / `?wakes=2` / `?splash=1` with the oil look; without them the game is v37 exactly (checked: the bank view
at 936 x 372 with `&t=5`, before and after, 0 pixels differ).

**The order** (the coordinator's brief): 1 still water and the stroke octaves; 2 the night (the water through the look
director's night pull); 3 colour, far shine and water from the air (FV5, with group C); 4 the player's wakes and
splashes; 5 rain on water.

**Step 1, DONE (24 Nov), `?wpaint=2`:**
- `src/render/waterchunk.js` (new; its `pcWStrokes(ch, wdx, wdy, d, spd, w0, asp, oc, out rnd, out rndN, out own)` is
  the interface the falls' material may include): the water's strokes in TWO octaves, each stroke of the finer one
  there or not by its own number, asked at its centre (no size jump: the circle at E12 and the line across the river at
  E2 are gone); and cells (26 m, or 66 strokes' widths when the strokes are larger) each with its own way and pace, a
  stroke belonging to the cell its centre lies in or just past the edge of, two cells' strokes overlapping by their
  numbers along an edge (no edge drawn, no stroke cut: the wood grain at E4 is gone). Nothing in it takes a
  derivative, so it runs inside a branch. One uniform `uWPaint` (1 new, 0 v37) for the speed test; its rows
  ("v37 water paint" at the bank and the shore) register themselves in `WATER_BENCH`.
- `WATER_FRAG` (materials.js): the new branch under `#ifdef PC_WPAINT` + `uWPaint`; still water's strokes lie along
  the crests of PHYSICS' waves (`pcPhysWaterDir(pcPhysSeaDir)`; in the gallery, which runs no physics, that is a fixed
  way), do not run; a current's run with it as v33 made them. Strokes 6 times as long as wide (11 was a river-length
  streak from the air); laid larger where the rows are squeezed on the screen (up to 3x), from the angle, not from a
  derivative. `WATER_VERT`: `vStill = aTurb.w`.
- `patchgen.js` water section: the still byte `aTurb.w` (only with the switch): the sample's own `still`, 1 where there
  is no current, and 1 where water reaches 27 m to BOTH sides across its current (two surface samples on a 6 m grid):
  v37's river is at most about 44 m wide, so that is a pool. This is what found the junction pond (E3) that v37 painted
  as a whorl; measured in Node, a turn of the current or its coherence over 8 to 14 m could not tell it from the river.
  One new float per sample in the sampling loop (`_col` slot 21, `s.still`).
- SEEN (A/B, opened): E3, E4, E12, E2 at the phone's settings (936 x 372, tier 1, lighter paint) and E3, E12, E2 at
  desktop top tier (1280 x 720, tier 2); stills in `docs/shots/painter/water-paint/s1-*`.
- MEASURED (software, this machine; phone DERIVED by the design's method, 14 ns a water pixel): bank view (water 24 %
  of the picture) the new paint adds 23 % of the water's own cost: about +0.27 ms on the phone (0.13 to 0.55); the sea
  from above (all water) +2 to +6 %: about +0.1 to +0.2 ms at a shore. No draw call, no memory; patch build no
  measurable change (4.8 against 4.3 ms a patch, 16 patches, after warm-up).
- NOT fixed, and now plainly visible where the whorl was: thin pale contour lines in the pond and the wide water (E3,
  E4), the BED showing through where the water is under 0.42 m deep round submerged bumps (`WATER_FRAG` "the bed shows
  through"); v37 has them too, masked by the whorl. It is the water's colour: step 3 (body by depth).
- Tools (scratch, not committed): `tools/lab.mjs` with the design's camera helper (its appendix A) and a script that
  opens a page once and grabs each station with `uWPaint` 1 and 0 (no recompile between A and B).

**Step 2, DONE (24 Nov): the night.** Merged `origin/look-director` (its night key L1: `pcNight`, `uLookF`, `uLookN`;
its master switch is `?light=old`). At the end of `WATER_FRAG`, before the air: by the moon the water takes the same pull
and strength as the land's lit paint (`c = mix(c, pcNight(c) * mix(1.0, uLookN.x, uMoon * uLookF.x), liq)`; lava and a
sea of cloud keep their own colour). Not behind `?wpaint`: it is the look director's switch (`?nightkey=0`, or
`?light=old`, is the night water as it was); by day `uMoon` is 0 and nothing moves. SEEN (E1 at 23:00, phone settings,
`s2-E1-night-23h-phone-ab.jpg`): the stream from the brightest thing in the wood (median V 0.71 against the land's
0.22) to V 0.43, in the night's blue; saturation unchanged (0.61). Phone cost: nil by day, a few instructions a water
pixel by night. Waiting on the look director's word on the exact line (asked 24 Nov). Not done: the aurora's green on
Neptune's lake (every other dash: LOOK-AUDIT) -- its share is `wau` in `WATER_FRAG`, for the look director to rule.

**Step 3, DONE (24 Nov), `?wpaint=2`: the water's colour and its far shine (design 3.4; FARVIEW FV5 in part).** Why water
from the air was grey, found in `WATER_FRAG`: (1) seen from above v37 laid 42 % of the bed's SAND colour over every water
however deep; (2) the mirrored sky was mixed with 30 % white; (3) a blue body and a cream golden-hour sky MIXED pixel by
pixel make grey; (4) the haze. The new paint: the bed shows by depth (`exp(-depth / 0.6)` from above; the shallows' 0.42 m
band let go from 30 to 150 m, it drew contour lines round submerged bumps); the sky as it is (the keys'; LOOK-AUDIT L9's
`pcSkyAt` not in yet); the body laid heavier the deeper and the farther (`wBodyD` 1.45 to 2.15 by depth, + 0.9 from 80 to
450 m); from 40 m out (all by 220 m) the strokes are BROKEN COLOUR -- the deep ones the body, the light ones the mirror
(three quarters, a quarter body), the middle ones the two by the angle (mirror share 0.12 + 0.45 x fresnel), more light
strokes the lower the angle; near the eye v37's strokes (the bank view reads as before: E2); the sun's lobe widened with
the distance (56 near, 22 from a kilometre: a path of broken light); the haze on water a third less from 450 m (a
water-only factor on `pcAtmosV`'s amount: TO BE AGREED with the look director); the waterline's dark band let go beyond
20 to 80 m (it was an outline). `waterchunk.js` gained `WATERCHUNK_FAR_GLSL` (`pcWaterFar`, `pcWaterFarC`,
`pcWaterShine`) for group C's far ground: interface sent to C, the byte for `frac` asked of C, not wired yet.
SEEN and MEASURED (phone settings; `s3-E3/E4/E5-phone-ab.jpg`, median of the water's pixels): E4 saturation 0.21 to
0.60, value 0.68 to 0.58 (the band 0.45-0.70); E3 the pond a step darker than the river (0.69 against 0.75 for the whole
water), the river still a little over the band; E5 0.12 to 0.37 saturation, value 0.56. After the look director's step-1
note still water is the calmest thing: a step deeper, less mirror, strokes 10:1 and in close values, white only on the sun's
path. NIGHT (F's ask): the light strokes keep a step of light over the pulled body, the moon's marks are left out of the
pull (`s2-E1-night-23h-wpaint2-crest-ab.jpg`: water V 0.45, land 0.22).
**THE DEFAULT since 24 Nov** (the owner's leave, the coordinator's word, F passed step 1): `?wpaint=1` -- the strokes of
step 1 -- is the default; `?wpaint=2` adds the colour of step 3 (under review); `?wpaint=0` is v37's water, PROVEN: by day
at the bank view (936 x 372, `&t=5`) 0 pixels differ from the build before steps 2 and 3. `uWPaint` holds the level.
**E-W2's blue curtain** (the coordinator's request): patchgen's water index loop drops a cell whose four corners hold
liquid but whose levels spread over 2 m and over half the cell (a face steeper than 1 in 2), only with a water world
switch (`MODE.water.on`). MEASURED over all 30,720 patches of levels 5 and 6 and 800 of 7 and 8: 0 dropped in today's
world, with or without the drainage.

**Step 4 (24 Nov), `?wakes=2` and `?splash=1`: the player and the water.** PHYSICS (1cca92d): `physics/water.js` WAKES2, 32
per-pixel sources with a kind (bow, footfall, stroke, press) kept apart from the 16 per-vertex wakes; `physics/splash.js`
`stepWaterPlay` (rings at each footfall in water over 3 cm, two at the hands each arm stroke, a furrow under a low fast
flight, a crown of spray going in at speed, flecks at footfalls, a trail low over water; `wet01`; `here.water` for the
audio); `index.js` single points (the explorer's call in the wake block, `_dEx.phys`, `here.water`). PAINT: `WAKE2_GLSL`
summed per pixel within 30 m in `WATER_FRAG` (`PC_WWAKE`), the ring's steep faces taking the light step; `waterchunk.js`
`wakesOn` turns physics' switches on with the material. SEEN IN THE REAL GAME (headless, 936 x 372, the explorer put on the
landing brook's bank and walked in with synthetic W key events on the document; then dropped 3.5 m into the brook):
`s4-game-wading-in-3-frames.jpg` (footfall rings counted 1 to 6, wet01 0 to 0.98, the wading spray), `s4-game-dropped-in-
splash-and-rings.jpg` (entry at 3.9 m/s: splash 0.58, 70 spray drops, crisp rings spreading round the figure),
`s4-game-wading-rings-crop-ab.jpg`. NOT SEEN: the swimmer's stroke V (the brook is waist deep: no swimming there), the
low flight's furrow, the gust and tornado. The script is in the scratch (lab: open the game, `bank.js` puts the explorer,
`walk.sh` presses W and steps `__pc.step(0.1, 2)`, reads WAKES2 and `here.water`). For PILOT: `physics.here.water`
{ near, submerged, wet01, splash, speed, fallD, fallDrop, rainOn } -- the audio's voices; the figure's paint can read
`wet01`. Phone cost DERIVED (not measured): the ring sum is about 30 instructions a source a pixel, only within 30 m
and only while a ring lives; a wader keeps 10 to 16 alive.

NOT done of FV5: shore-tangent dashes (they would bring the whorl back; the design lays still water along the wind)
and the shore hairline (the owner's rule: no outlines) -- both said to C; the current made visible from 400 m.

## Hand-over of THE FLORA LANE, branch `design-flora` (kept current after every step; read with the oil look's below)

Built by a painter helper session at the coordinator's word (24 Nov), after its design `docs/lead/FLORA-DESIGN.md` was
accepted. The lane follows that design's section 11 order. The coordinator merges this branch into `look-proto`; this
lane never merges. HELD by the coordinator until the trees lane lands: package O and F4 (anything in `flora.js`,
`floraplace.js placeUnder`, a new `underkit.js`). NOT TO BE TOUCHED by this lane: `PROP_VERT` / `PROP_FRAG`, `kitmat.js`,
`chunks.js`, `post.js`, `shared.js` (a look-director session owns the shared light and paint: `docs/lead/LOOK-RULES.md`
on branch `look-director`: READ, and followed; its R3.1 took out this lane's root step, below). In `surface.js` only ONE
`bloomTint` call (the far-view lane edits that file).

**Switches** (oil look only; 1 by default; 0 gives the package back exactly as it was): `world/nearground.js` `FLORA`:
`?grass2=0` the whole grass package; `?nearcull=0` the off-screen cull alone; `?sheen=0` the gusts' sheen;
`world/bloom.js` `bloomSwitches`: `?bloom=0` the flowers from the map (the rings lay their old flowers, no tint);
`?bloomair=0` the drifts' colour in the ground alone. The watercolour game: SEEN pixel for pixel the same as the clean
commit (the alpine meadow's easel, every change of this lane in).

**Done:**
1. Speed-test rows (`core/bench.js`, after 'no small plants'): 'no near grass', 'near grass: the blades only (the fine
   ring)', 'grass not culled off-screen'. The near grass was in no row before (its material is `pc-near`).
2. G1, THE CULL (`materials.js NEAR_VERT`, under `PC_OIL`, uniform `uNearK.x` set by `nearground.js`): a mark whose root
   is outside the picture by more than its own reach, or past its range, is sent outside the clip volume before the bend
   field and the air are worked out. SEEN: the autumn landing at 1.8 m and 10 m with the cull on and off, pixel for pixel
   the same (0 pixels at 1.8 m; 3 at 10 m, and the same 3 differ between two grabs with the cull on: frame noise).
   COUNTED earlier at the landing: 60-70 per cent of the near marks are outside the picture. The phone's saving is
   derived (-0.3 to -1.9 ms) until the row 'grass not culled off-screen' measures it.

3. G4 and G2 (`nearground.js` `CARPET`, `layCarpet`, `styleOf` `leafB` / `gmB` / `carpet`; `materials.js` `NEAR_VERT`
   `vSheen`, `NEAR_FRAG` the root step and the sheen, uniform `uNearL` = (paint on, sheen strength, the bend in rad the
   sheen grows over: 0.03 to 0.35)). THE CARPET: a fifth ring, first, cell 0.45 m, reach 7 m (8 at the top tier, none at
   the low one), fades in 0.5-1.2 m, gone above 14 m: three times the fine ring's blades a square metre, each blade's
   own range 5 to 7 m. THE BLADES' OWN GREENS: a blade takes a quarter of the ground's wash where it took six tenths, and
   in the oil look the biome's `oil.under.leaf` (the greens its PROP undergrowth wears; the autumn wood's watercolour
   `under` is straw); a biome may set `oil.flora.sward` = { gm, carpet }. (A step deeper at a blade's root was built and
   TAKEN OUT in step 5: LOOK-RULES R3.1, a stroke is one flat colour; the sward's dark roots are the ground's paint under
   it, `bloom.js bloomTint` with a biome's `oil.flora.sward.floor`.) THE SHEEN: PHYSICS' bend leaning a blade away from the eye lifts it a step (needs physics: the game, or the
   gallery's `&physics=1`). SEEN, before and after at the same camera (`docs/shots/painter/flora-design/g2g4-*`): the
   autumn landing at 1.8 m goes from a leaf carpet with straw blades to a sward of green and yellow-green blades; the
   green wood gets dark spiky blades against the light; the meadow fills in near the feet; from 10 m nothing changes (the
   carpet reaches 7 m from the eye), as designed. The sheen SEEN working only at an exaggerated setting (`g4-sheen-test-*`:
   5,524 pixels change); the gallery's weather at the landing is nearly calm (0.67 m/s, a 2 degree bend), so at the
   default it shows nothing here: it is for the game's wind and cannot be judged in motion on this machine.
   MEASURED (`tools/overdraw.mjs`, scratch copy, tier 1, 936 x 372): the carpet adds 65,500 fragments (5,300 to 6,460 of
   its marks in range, 15,900 to 19,400 triangles) at the meadow looking 24 degrees down and at the landing looking level.
   DERIVED for the phone: +1.3 ms (0.8 to 2.3), before G1's and G3's savings.
   NOT LIKED YET, for the next steps: the PROP undergrowth's big tufts (orange in autumn) still stand out of the sward
   (flora.js: HELD); some dark accent blades in shade are near black (a look-director question: the root step and the
   dark tone together).

4. G3, THE MIDDLE BAND (`materials.js NEAR_VERT` `vTeeth` and the fan's growth, `NEAR_FRAG` the fan's blade count;
   `nearground.js` the mid ring's own ranges and `layBroad`'s grass touches): a fan-brush touch is cut into as many blades
   as leave each about two pixels (never under two; it was five to ten whatever its size); each touch's own range is
   0.4 to 1 of the ring's (was 0.66 to 1), so past about 25 m the band thins, and a touch grows up to 1.4 times by 40 m
   to keep the cover; the touches are narrower (0.6), more upright, and in the blades' own greens. SEEN
   (`g3-meadow-10m-before-after.jpg`, `g234-*`): from 10 m the meadow's speckle of tiny yellow combs is mostly gone; from
   1.8 m the band at 12-40 m is calmer, with its white flower dashes still there (they go in step 5). MEASURED (scratch
   overdraw counter, the touches' growth mirrored in it; `tools/overdraw.mjs` itself, the coordinator's file, does not know
   it yet): the middle ring's fragments 114,040 -> 59,756 at the meadow (self-lap 2.12 -> 1.53) and 140,971 -> 99,057 at
   the landing (3.76 -> 2.89; its stones by the river are unchanged). THE WHOLE NEAR GRASS, carpet included, against
   24 Nov: +11,300 fragments at the meadow (205,826 -> 217,000) and +23,600 at the landing (230,452 -> 254,100). DERIVED
   for the phone: +0.2 to +0.5 ms for four times the blades near the feet, before the cull's saving (-0.3 to -1.9 ms).

5. THE FLOWERS, F1-F3 AND A1 (`world/bloom.js` new; `data/looks/earth.js` `FLORA_TF` ... `FLORA_MW` as each biome's
   `oil.flora`; `nearground.js` `layBlooms`, `layBroad`'s drift touches, `iTone` (a mark's second colour, packed:
   `packTone`), `BLOOM_HEAD` 2.0; `materials.js` the six heads in `NEAR_FRAG` (kinds 7 rayed, 8 cup, 9 bell, 10 spike,
   11 froth, 12 cushion), `vTone`, the head's height in pixels in `vTeeth`, the `lying` test now 5.5 to 6.5;
   `surface.js` ONE call `bloomTint` at the end of `sample`; `core/bench.js` 'no flower heads' (`uNearK.z`).)
   THE MAP: `bloomAt` decides for any point which of the biome's kinds blooms there and how densely, from its habitat
   (canopy, wet -- near a river or a little above standing water --, meadow, height, cliff lip, rock), drifts at the
   kind's own size, colonies four times that, and slopes rich or poor at 430 m. Every distance reads it: the fine ring
   lays PLANTS (a stalk, a leaf, one to six heads by kind, each head one of six shapes in two flat colours, its second
   colour data, details cut only where a piece is two pixels or more); the middle ring lays the drift's colour as round
   touches (a spike taller, a cushion a cushion); the ground's colour takes the drift (near paint 0.4 of its cover, far
   colour up to 0.7). Five or six kinds a place in named pigments (bluebell, anemone, campion, buttercup, foxglove;
   aster, harebell, hawkbit, goldenrod; gentian, alpine aster, ox-eye, globe flower, alpine pink, poppy; thrift, sea
   campion, sea aster, trefoil; marigold, loosestrife, meadowsweet, cotton grass, yellow flag; desert marigold,
   globemallow). SEEN, bloom off and on at the same cameras (`f-*-bloom-off-on.jpg`): the meadow at 1.8 m a real
   wildflower meadow, a drift of violet asters with gold eyes in front, ox-eye and poppies behind (`f-meadow-asters-crop-
   3x.jpg`: the petals and eyes clean, lit and shaded whole); the green wood a bluebell drift under the trees with
   anemones; the autumn landing harebells and hawkbit; the coast pink thrift cushions and violet asters (its yellow
   trefoil had vanished on the ochre grass: cut back); the wetland cotton grass and marigolds; from 10 m the meadow's
   drifts are pale and red patches. NOT GOOD ENOUGH YET: from 150 m a drift is only a faint pale patch (the colour mixed
   into the ground is a mixture; the cure is a dab that takes the flower's colour WHOLE, which needs a channel in
   `patchgen.js` and a branch in `TERRAIN_FRAG`: the far-view lane's files, asked of the coordinator); the first heads
   at real size (two to three centimetres) sank into the denser sward as dots, hence `BLOOM_HEAD` 2.
   MEASURED: Node, 61,206 full surface samples over the six places, 331 ms with the map against 364 without (noise: the
   map costs nothing measurable in the ground's build); the scratch overdraw counter at the meadow: fine ring 91,786 ->
   93,821 fragments, middle ring 59,756 -> 54,873 (the touches replace the old dashes): THE FLOWERS COST NO FRAGMENTS
   NET; about 2,500 more marks in the fine ring, most of them outside the picture and dropped by the cull. DERIVED for
   the phone: about 0 to +0.1 ms. Row: 'no flower heads'.
   NOT DONE IN THIS STEP: the year (the flowers are laid once and do not follow `SEASON`; a ground's colour baked at
   different moments would seam).
6. A2-A3, THE FAR MARKS, AND THE DARKS QUIETER (`nearground.js layVista`: in a drift's heart its first sward drag is
   the drift's colour, close to the ground's as these drags are, `?vistaink=`; `grassTurn`: on level grass the drags
   are combed one way -- a westerly wandering a fifth of a turn over 1.5 km --, on a slope they keep the contour, handed
   over by the slope drag by drag; `bloom.js bloomTint`: the floor under a dense sward a step deeper in VALUE and a
   little quieter, `oil.flora.sward.floor` 0.06 to 0.10; dark accent blades keep the ground's share they had, 0.6).
   SEEN (`a-*-flora-off-on.jpg`, all of the lane off against all on): from 60 m and 150 m the change is SUBTLE: the
   meadow a little deeper in tone with faint pale drift patches; the comb cannot be told by eye in these frames. The
   look director's numbers (`docs/lead/lookstats.py` on `look-director`, run on the A and B PNGs): the meadow at 1.8 m
   S(V<.3) 0.96 -> 0.85, V>.90 2.5 -> 1.3 per cent; the autumn landing 0.53 -> 0.52, V>.90 3.1 -> 1.9; from 150 m 0.26
   -> 0.25 and the whole picture's saturation 0.52 -> 0.46; BUT from 60 m S(V<.3) 0.43 -> 0.47 (the picture as a whole
   quieter, 0.63 -> 0.55) and in the green wood 0.41 -> 0.46: both under R2.2's 0.50, both raised. The green wood's
   cause is the shared shade recipe (materials.js `deepO`, R1.2b: a green blade in shade to saturation 0.91) laid on
   four times the blades; its cure is the look director's shared foliage shade (their build lane L2), not this lane's.
   A floor deepened as a glaze of its own colour (tried first) raised the meadow's darks to 0.52 from 60 m and was
   changed to the quieter step above.
7. THE MEADOW FIXES (the coordinator on step 5: "the 'on' still is LESS striking than 'off' near the eye ... small violet
   asters sprinkled evenly, like confetti"; asked: drifts clustered near the eye, heads bigger and bolder, the bold kinds
   in every place's near mix). What was done, in the order it was SEEN:
   - FIRST TRY, NOT GOOD (7fdc02e): one patch field shared by every kind. COUNTED with a Node script over 1,500 random
     60 m squares of Earth (the scratch `bloomstats.mjs`, its method in the commit): it halved the ground in a drift
     (meadow 29 -> 19 %, green wood 16 -> 8 %) and the landing had no flower in view.
   - `bloom.js bloomAt`: the density is BIMODAL, ss(0.06, 0.28) of the product of the fields (a drift solid inside, a
     short ragged step, almost nothing between: four soft fields multiplied had lain at a middling density everywhere,
     which IS the confetti); a softer shared patch field (`PT`); drift hearts with a 0.30 step and edge 0.05; sprinkle
     0.03. COUNTED: meadow 47 % of its ground in a drift (40 % dense), 2 % of 60 m views without one; green wood 25 %;
     coast 36 %; autumn wood 15 % (its kinds now grow under its open crowns, ramps to 0.88-0.92, and `edge: -0.2`).
   - THE LANDING always stands in a patch (`bloom.js`: full within 18 m of `S._spawn`, gone by 45 m): the patch field
     happened to leave the first view's bank bare.
   - HEADS: `BLOOM_HEAD` 2.0 -> 2.5, a cell's plants in one tuft; NEAR_VERT gives every head (kinds 7-12) a least size on
     screen, half-width 2.6 px (bells 2.0, spikes and froth 1.4), the whole head grown, as a share per ring (`uNearK.w`:
     middle 0.85, far 0.6). The middle and far rings lay the drift's own head kind where they laid 1-2 px round touches.
   - THE BOLD KINDS: the alpine meadow led by the poppy, the ox-eye and a new meadow buttercup (the aster a sprinkle);
     the green wood's buttercup in every glade (most in the damp) and an ox-eye in the open; the autumn wood's hawkbit
     bigger.
   - THE GROUND'S TINT for a flower far round the wheel from the grass (red, violet) is a third as strong (`hueNear`):
     from 10 m the poppy drifts were rust-brown mud; such drifts are carried by their heads now.
   - C6 (V > 0.90 at most 4 %): the dense meadow at 1.8 m measured 6.9 %, then 5.7, 3.1 (but the buttercups read as
     orange marigolds), and 3.8 % with the yellow cups' gold a glaze of lemon over quinacridone gold mixed six tenths back
     to lemon, their upper part four tenths, and the ox-eye D 0.75.
   SEEN (`m-*-bloom-off-on.jpg`, `?bloom=0` against on, the f-* cameras): the meadow at 1.8 m is dense drifts of
   buttercups, ox-eyes, asters and poppies, and from 10 m the drifts read as dots of their colours; the green wood a solid
   bluebell drift; the landing drifts of violet asters on the bank, goldenrod and hawkbit at the water and the feet. From
   150 m a few more red and white flecks, no drifts: that still waits for the far-view lane's channel (FV6 with C).
   lookstats A -> B: meadow 1.8 m S(V<.3) 0.89 -> 0.88, V>.90 2.5 -> 3.8 %; 10 m 0.81 -> 0.77, 0.3 -> 1.3 %; 150 m 0.17
   -> 0.19; green wood 0.47 -> 0.48; landing 0.47 -> 0.43, 2.4 -> 2.4 %.
   COST (the scratch overdraw counter, 936 x 372 class, the level eye; the heads' least size replayed): the meadow's near
   marks 149,344 -> 143,649 fragments (the new flowers replace the old ones); THE LANDING 279,137 -> 352,549 (+73k: +1.5 ms
   at K2's 20 ns, 0.9-2.6, and about 1.4 times that at the phone's picture), of which the heads' least size is 13.7k. OVER
   the design's F budget (+1, at most +1.8 ms). The dials: the least size (2.6 px), the landing's patch, a kind's `peak`.
   RULED by the coordinator: hold the look (the owner's own ask), trim only what does not show: the middle and far rings'
   least size is 1.9k of the 73k (COUNTED, near ring only against all) and makes the drifts read from 10 m: kept.
8. THE LOOK DIRECTOR'S NOTES on 7 (a PASS with two notes): the near buttercup drift "one orange carpet": `bloomAt` gives a
   runner-up kind where its drift is nearly as strong (`out.bloom2`, `out.mix`), a cell is a clump of one or the other,
   and one cell in three in a drift is grass; buttercups and hawkbits butter-yellow (a glaze of lemon on lemon, hue 51);
   asters violet (hue 269) and harebells cobalt violet (257). THE CLOAK'S BLUE (CLOAK_BLUES, hue ~226): no head at hue
   210-240 over S 0.45: the bluebell to hue 249, the gentian (which sat AT 226) to 248; `flora.test.mjs` guards it.
   Lit heads S <= 0.90 and V <= 0.88, two flat colours, no head bigger than the cloak at 2 m: F's four limits, agreed.
9. THE YEAR (the coordinator's ruling: build it behind its own switch; no place ever flowerless near the eye; season-true
   kinds). `?bloomyear=0` off. Each kind `season: [from, to]` on SEASON.t in sevenths and `bold: 1` on the bold kinds;
   autumn kinds added where a place had none: the ivy-leaved cyclamen and an autumn hawkbit (green wood), the autumn
   crocus and the hawkbit (high meadow), heather (cliff tops), knapweed for the autumn wood's summer (its hawkbit alone was
   one yellow carpet). `bloomAt(..., tEval)` chooses for a point of the year and spreads the kinds in flower over the
   ground the others left (their drift edge lowered by 0.45 of the share out of flower). HELD (`?season=`): one clump as
   the map says now, and the ground's colour and far marks follow it. TURNING (the game): a cell holds a summer clump and
   an autumn clump, each packed with its half of the year in iTone's top six bits (`packWin`), a third of the cells one, a
   third the other, a third both with the room shared; NEAR_VERT thins out-of-window marks one by one (stalks too) and
   shrinks heads before they go; nothing is laid again. The fine ring's pool +25 % while the year turns. The ground's
   colour and the far marks do NOT follow a turning year (a colour baked at two moments would seam).
   SEEN (`y-*`): the year moved from 0.15 to 0.85 in one page (not held): the landing's knapweed and hawkbits give way to
   asters and goldenrod with asters at the feet; the green wood's bluebells to pink cyclamen up to the feet; the meadow's
   buttercups and ox-eyes to late poppies and hawkbits with crocus beyond. At ?season=0.85 against ?bloomyear=0 likewise.
   FIRST TRIES that failed and why: laid one after the other, the summer clump took the whole room (the turning autumn all
   but bare); held without the spreading, the green wood's feet were bare in autumn. COUNTED in Node, ground in a drift
   at year 0.15 / 0.5 / 0.85: meadow 56 / 55 / 59 %, coast 50 / 42 / 41, green wood 34 / 23 / 40, autumn wood 16 / 16 / 16.
   lookstats: V > 0.90 under 4 % in every year still (3.0-3.7 %); S(V<.3) moves 0.02-0.03 at most.
10. THE LIME (F10, agreed with the look director: the blades' own data, the ground C's, the light F's): `oil.flora.sward.leaf`
   per biome (the green wood: olive with yellow ochre / olive / olive with hooker's; the autumn wood a step more golden)
   and `sward.gm` 0.12, behind `?bladegreen=0`. MEASURED, the lit grass of the 1.8 m stills (`l-*`, off -> on): the landing
   hue 72 -> 61, V 0.72 -> 0.66; the green wood 70 -> 63, 0.71 -> 0.69: inside R2.4's hue and value; BUT S 0.84 -> 0.82 and
   0.79 -> 0.78, over R2.4's 0.75: it is the ground under the blades (C's palette) and the paint's own richness (F's chain),
   which the blades' data cannot move. The meadow (no sward.leaf) measures hue 70, S 0.81, V 0.65.

**Tests:** `tests/` 325 of 325, `src/world/` + `src/data/looks/` 65 of 65. `src/physics/` 415 of 416: the one failure is
`loose.test.mjs` P25 ("under the closed wood the litter still puffs: 2"), which is FLAKY ON THE CLEAN COMMIT TOO (it
failed 1 run in 5 there with none of this lane's changes): reported to the coordinator, not this lane's.

**Next:** the look director's standard set (S1-S6 at 1024 x 480) with `lookstats.py`; then FV6 (meadows from the air)
with C (C owns patchgen.js and TERRAIN_FRAG; the bloom channel from `bloomAt` is to be agreed with it). The coordinator
will put the new flora in front of the owner behind one switch once told. O and F4 wait for the trees lanes.
**THE SWITCH (the owner, 24 Nov: "No do make it look different"):** the lane is ON by default in the oil look; `?flora=old`
(also `=0`) is the ONE opt-out, today's flora for comparison. The cull of unseen marks (G1) stays on either way.
**PROVED** (bc04da1, five gallery views, each world settled before the grab: the autumn wood at 16.8, the alpine meadow at
11, the green wood at night, the autumn wood from 420 m, the meadow in the watercolour game): `?flora=old` on design-flora
against look-proto 0d5533b with no switch: 0 pixels differ in all five.
**Branch state:** design-flora = look-proto v39 d9d9ed7 + this lane's seven files (`git diff origin/look-proto` shows only
them); ?flora=old proved against v39 too (0 pixels, five views). The coordinator merged design-flora into look-proto for the
next release after batch 1 of the final set (ACCEPTED by the coordinator, PASS by the look director).
**THE FINAL SET** (`final-<place>-<height>-<season>-old-new.jpg`, ?flora=old above, the default below, ?season=0.15 and 0.85,
the f-* cameras): the autumn landing, the meadow (and from 150 m), the green wood, the coast, the wetland, at 1.8 m and 10 m.
Folded in while it was taken: under v39's brighter light the yellow, scarlet and white heads a step deeper for C6; past the
near ring the runner-up kind a fifth of its share (the look director: no confetti at 10-30 m) and whites from the far ring a
step deeper (no paper flecks at 150 m); a yellow cup's upper part its own yellow deeper, no gold (the coordinator: near
buttercups leaned orange), the marsh marigold and yellow flag the same; the cotton grass a soft grey-white, fewer. Every
still of the set inside C6 but the landing at 10 m in autumn, 4.2 % (4.9 % in the old picture) and the coast (25 %, 30 % in
the old: its cliffs and sea). A2 (trees near) counted the lane at the landing: 26,928 marks against 12,967, 357k fragments
against 272k (the rebuilt middle band halves today's 176k to 92k); its rows in ?bench=foot price it on the phone. A2's hooks
(NEAR_VERT uNearCut, NEAR_FRAG flat mode 8) are to be kept when they reach look-proto.
A lesson recorded: af83f25 copied data/looks/earth.js from a scratch copy older than a merge and dropped the look director's
`airTop` (found by the 420 m proof, fixed in 2f779d8); never copy a whole shared file over a merge, apply the lane's diff. ASKED OF THE FAR-VIEW LANE through the coordinator: a ground dab that takes a drift's colour WHOLE
(pointillist) from `bloomAt`, the one thing that would make drifts read from 150 m and a mile.

## Hand-over of LANE W1 CLOUDS, branch `weather-clouds` (group D; READ THIS FIRST if you are the clouds session)

Helper session for group D's clouds lane (coordinator `session_01R5Bri1TV3HBTyuxNZZuhNw`; look director, who reviews
every still and owns world/index.js, chunks.js, post.js, shared.js, render/index.js: `session_01R5Brhzz2JPPF6Ecz6XRQHx`;
the weather group, who owns src/physics/: `session_01R5Bri2bBgFSfCmxpKKuURT`). The design is
`docs/lead/WEATHER-DESIGN.md` section 4 (A1 already built by the look director) with the budget in 7, the files in 8
and the contracts in 9. Branch = look-proto v37.1 + design-weather 03c3f1c + look-director fff5694. Files this lane
owns: src/world/clouds.js, src/world/wxfield.js (new), src/world/sky.js, src/world/orbit.js (makeCloudShell only), the
`weather:` rows of src/data/looks/*.js, its own block at the END of src/core/bench.js's rows, docs/shots/clouds/.
Commit code with `tools/commit.sh painter`; docs/shots/clouds/ is not in that script's paths, so stills go up with a
plain `git add docs/shots/clouds && git commit` naming the path.

**State (24 Nov, late afternoon): MERGE-READY for v39.2** -- the look director ACCEPTED rework 3 (storm edges, the flash, the noon form as far as it goes, the near cloud by whole strokes, the shadow field) and asked for no further rework of the clouds for v39.2; the coordinator's hybrid, shadow field, land storm in the game and storm from afar are in. Branch head after merging design-weather df68c45 (the 10 m/s drift cap, thunder, wxguard): suites 328 / 107 / 443; the merged tree's 1 km golden hour identical to the pixel with the one before the merge. PROOF STILLS: docs/shots/clouds/rework2 (ground stations A/B, 1 km golden hour rows, the shadow map K vs K0, the game storm at 3690 s and 3745 s) and docs/shots/clouds/rework3 (the shadow field from 150 m, smooth storm edges and the two-step flash, 600 m noon, the storm from the coast at 3.3 km). Known weak, said plainly: front-lit noon from the air (the look director: stop here for now), a mountain-caught cloud reads as a flat cap, the anvil not yet apart from the tower's top, the land under a storm deck still lit like fair noon (the look director's, in the shared light). Off by default: the cirrus (`?cirrus=1`) and the sky strokes from the air (dropped).
**After d6f4fa4 (the merge point stays d6f4fa4):** every cloud program behind the weather group's guard (world/wxguard.js
watchPrograms: the lobes' program failing switches the module off, `world.clouds.failed`, and the sky takes its own
painted cloud back; a sheet's hides that sheet; the shadow pass's programs looked at in renderShadow, a failure turns the
shadows off; tested in clouds.test.mjs with a faked failed program). THE FLIP for the release (the coordinator: the 3D
clouds the oil look's default, `?clouds3d=0` the opt-out, `?weather=old` takes them out with the rest):
docs/shots/clouds/CLOUDS3D_FLIP.patch, two lines -- world/index.js CLOUDS3D (the look director's file) and core/bench.js
CLOUDS3D (this lane's block); clouds.js and wx2.js need nothing (clouds.js's own default is already 1; the weather
group's flip turns the maps on). Checked in a scratch copy with the patch applied: no switch in the address, the 3D
clouds draw (180 at 1 km); `?clouds3d=0`, the module is never fetched. Given to the weather group for their
weather-release branch.

| step | state | what was done, seen, measured |
| --- | --- | --- |
| 1. wxfield.js | DONE | `WX` (uWxField, uWxField2, uWxN, uWxOn, uCloudShadow, uCloudShadowM, uCloudShadowK) and `WXFIELD_GLSL` (pcWxField, pcWxField2, pcRainAt, pcWindAt, pcCloudBase, pcCloudTop, pcCloudShadow), the contract of design 9.4; `createWxField().update(fields)` rebuilds the atlases when a map's version moves, at most twice a second. MEASURED: 6 tests (src/world/wxfield.test.mjs: seams and corners, wind vectors, zeros when off, the 2 Hz gate, Earth's real cloud map); rebuild 0.09 ms (cloud) + 0.16 ms (wind) warm in Node here. The GLSL COMPILED AND RAN in headless Chromium, vertex and fragment, and matches the CPU twin to half an 8-bit step (docs/shots/clouds/wxfield-glsl-check/RESULT.txt). Nothing in the picture changes: nothing reads it yet. |
| 2. clouds.js A2, A3, A5 | FIRST FORM IN, for review; second pass in step 3's commit (the sky's golden wash on the clouds, a storm a step lighter, broader deck gaps, the tones made real value steps: half-tone, belly, deep about 0.68 / 0.60 / 0.48 under a 0.78 top, the clouds' air lighter; MEASURED with masks: W150 building 18.6 % of the frame in cloud, two value peaks 0.67 and 0.80 (criterion 2 wants 3-4: from below a cloud is mostly belly, a still from the side is needed); storm overhead 73 % of the frame, i.e. above 90 % of the sky (criterion 1); V over 0.85 in 0.5 % of cloud pixels at noon, 5.6 % at 16:30 (the gold wash); A5 the valley cloud SEEN at dawn, forced: step3/W1_A5_*; the sea of cloud from 1.6 km SEEN as a field of puffs and deck below with the peak through it: step3/W1_A1K6_* (the puffs still read as cotton balls). C7: the watercolour and the oil look with ?clouds3d=0 at W-G render 0 pixels different from the lane's base d059e6a) | `src/world/clouds.js` (behind `?clouds3d=1`, oil look only; the look director's hook in world/index.js fetches it). A2: cumulus as clusters of lobes (icosphere levels 1-3 chosen by how far the outline would stand off the round on the screen), slots ~220 m apart in a frame that turns with the wind aloft, life cycles on the painter's clock, cover from the cloud map (`fields.cloud`) plus the world's fair share, base and thickness from the map (towers in a storm's area, capped 900 m), thunderstorms from the map's storm cells (a column and an anvil fanned downwind). Painted: normals bent toward the cloud's centre (`?cloudlobes=`, 0.72), FOUR FLAT TONES from the world's keys (as sky.js's cloud) chosen once per thin stroke at its centre (pcThinLayerUV on each lobe's own sphere), the outline never the deepest tone, flecks of half-tone in the belly, the planet's shadow (tops lit after the land's sunset), its own stepped air, the sky cap. A3: the deck, a 32x32 sheet round the eye at the map's base, its cover per vertex, gaps from a broad field, rolls in three tones from below, heaps from above; under a closed deck the cumulus are not drawn. A5: the valley cloud, the same sheet low (H2 - 40 m), carrying the map's `valley` channel (zero until the weather group's W3.2; `?valleycloud=1.6` forces 0.6 for looking). sky.js: `uCloud3D` (the sky's shell lifted to the altocumulus at 1 km over the land, 0.45 of its cover, the horizon fade down to ~3 degrees, the night streaks kept to clear sky: A10). Earth's `weather:` row (values = the defaults). MEASURED (Node, `src/world/clouds.test.mjs`, 4 tests): at the phone's pixel angle 86k / 108k / 112k triangles from the ground / 150 m / 1 km (design ~120k); the rebuild 0.31-0.54 ms here, 0.06-0.08 ms a frame on average; from the lobes themselves the world's fair 0.45 covers 17 % of the open sky, 0.55 27 %, 0.75 48 % (criterion 1). SEEN (docs/shots/clouds/step2, A = `?clouds3d=0`, B = 1, 960 x 540): fair cumulus over the wood, the alpine flanks (a cloud lying in front of a slope) and the coast, receding in perspective; a storm 0.9 km off now SEEN (A: nothing); a storm overhead as a ceiling of rolls (A: the old mottled wash); the night and dusk clouds flat shapes a step lighter than the sky. NOT RIGHT YET, said plainly: bellies seen from below are mostly lilac and far clouds can read as lilac pills; at 16:30 the clouds were lilac against a gold sky (fixed in the next commit: the sky's golden wash laid on them); the storm ceiling too dark (L median 0.41 against the old 0.59; lightened next); the deck's gaps at a storm's edge were slivers (broader next); the sea of cloud from 1 km (A1K, forced rain) did not show as a sea: puffs only, and the land's haze at 1 km (not this lane's) hides it. Not measured: edge width, value steps per cloud (the next set has masks). |
| 3c. THE REWORK after the reviews of 24 Nov (look director: "NOT YET a pass ... lilac pills ... stickers"; coordinator: "a cauliflower on a shelf, not a bunch of grapes"; lit warm tops, flat darker bases, today's painted high clouds kept, a slate storm tower with a sunlit flank, a storm ceiling of big masses) | DONE, stills sent | Merged origin/look-proto (0d5533b: the plant-wind binding; the near plants draw again, SEEN) and origin/design-weather (95d2317: ?clouds3d implies the maps; W3.2-W3.6). Clouds: slots 380 m apart, a cumulus 110-240 m across its shelf (fewer, bigger: fair 16 % of the open sky, building 38 %); the template a SHELF of wide squashed lobes centred on the base plane, a body, a heap building upward, a cap (shelf first: a far cloud is its shelf); normals bent from just over the BASE (the heap faces the light); the flat base told in the fragment by its height (pressing vertices onto it had bent every shelf side down: grey saucers); far clouds painted as their lit shape over a thin base; a silver lining on backlit edges as a tone, no rim line. Palette (F's): lit top in the light's own colour (warm at the golden hours, 0.9 of the sky's gold on the lit top), half-tone the sky's blue-grey a step under, belly a further step in the zenith key's hue, a deep tone only in a storm (slate, indigo). Deck from below: big masses from the gap field with lighter seams even when closed, rolls only move a stroke. The sky's own flat cloud kept as today's painted high cloud (altoShare 0.75). Sky audit items (uSkyFix, on with the clouds, ?skyfix=0 off): aurora a night light only, the storm's mass and the far rain veil in flat steps, the sky's own cloud one shade step, the edge of space crisp, the sky laid in strokes from the air. MEASURED (Node): 102k / 116k / 93k triangles at the phone's pixel angle from the ground / 150 m / 1 km; script 0.04 ms a frame here. With masks: W150 front-lit 18 % of the frame in cloud, 3-4 value peaks. The shadow uniforms are ready to be F's (wxfield.js takes render/shared.js CLOUDSHADOW, the look director's name; K 0 by default, set by clouds.js); F's lines, second form: docs/shots/clouds/T3_T5_look_director_v2.txt. |
| 3d. REWORK 2 after the coordinator's verdict on rework1 (24 Nov: "NOT YET ... grey saucers ... the gap is the value, not the form"; two directions: lift the shade to a soft lavender-grey a step or two under the sky's horizon value with near-white lit edges, flat tones broken only at the edges, irregular outlines; and a HYBRID: today's painted sky from the ground, 3D clouds where depth matters) | DONE, stills sent (docs/shots/clouds/rework2) | Merged origin/look-proto (v39 d9d9ed7), the look director's T5 + T3 (look-director a40647e: `PREPASSES` and `CLOUDSHADOW` in render/shared.js; wxfield.js `WX` points at those very uniform objects, clouds.js pushes its shadow pass onto `PREPASSES`) and design-weather c359e12. THE HYBRID (`CLOUDS.hybrid`, on; `?cloudhybrid=0` the 3D cumulus from the ground too): the 3D cumulus come in with the eye's height between 250 and 700 m over the land under it (`CLOUDS.airH`); sky.js `uCloud3D.x` is that share (0 on the ground: the sky's own painted cloud exactly as it was; the first half thins the painted shell, about 400 m up, away as the eye climbs to it, the second brings it back lifted as the altocumulus with masses twice the size), `uCloud3D.w` 1 while the module draws. Storm cells drawn from anywhere. A cumulus whose land stands 120-320 m and more over the land under the eye is drawn in 3D from the ground: CAUGHT ON A MOUNTAIN, its base set from the highest land in 180 m round it (-50..+40 m), the range holding 0.22 more cover (Earth's range: 444 m within 4 km of the landing, 409 m over the wood: measured). VALUES (lobes and sheets): built from the painted sky cloud's own tones (sky.js: lit top `mix(0.78, horizon, 0.18)`, half-tone `dens(uCloudShade, 1.85)`): a near-white light for the most lit strokes, the lit top a quarter in the light's colour, the half-tone that lavender a third toward the horizon, the belly `dens(half, 1.25)`; stroke jitter 0.04 (was 0.10); belly flecks only near its edge. The golden wash now reads the SKY'S OWN WARMTH (its horizon key's red over blue), not the sun's height: on this small world the sun at 13:00 is low enough that the old wash laid cream on every cloud under a blue sky. FORM: lobe bend 0.62 (was 0.85), each head's own turned-away side and the creases between heads in the half-tone, the far lift only for a cloud seen from below. SHAPES: each shelf drawn out along its own way, uneven lobes, one sometimes left out, the heap off the middle. STORMS: anvil along the cell's own drift (`anvilE` / `anvilN`), growing with its `stage`. LIGHTNING: the four brightest of `fields.cloud.flashes`, a light 280 m (cloud to ground) or 650 m (in cloud) over the map's base, light the cloud within 150-600 m in WHOLES (a lobe by its number, a ceiling mass by its thickness) to a pale cool flat tone; `world.clouds.flashTest` stands in for the list in a still. OFF by default, said plainly: A4 the cirrus (`?cirrus=1`; seen from the ground and from 1 km as pale ghost shapes, not mare's tails) and the audit's sky strokes from the air (`?skystrokes=1`; from 1 km dark blue blotches, seen against `?skyfix=0`). MEASURED (Node): with the hybrid 8 clouds (mountain) from the ground at the autumn wood, 91 at 450 m (share 0.42), 181 at 1 km; worst case (`cloudhybrid=0`) 89k / 101k / 83k triangles at the phone's pixel angle; script 0.03 ms a frame; suites 325 / 107 / 441. SEEN (A = `clouds3d=0`, B = 1, 960 x 540): W150 sun behind, W-G 16:30 building and the coast: B is today's painted sky with the audit's lighter cloud shade (3.2 / 1.7 / 1.8 % of pixels differ, all sky). From 600 m and 1 km at 13:00: light grey-white cumulus with irregular bumpy outlines and lavender undersides (2 value peaks 0.77 / 0.86), the altocumulus as larger masses; front-lit, the near clouds are still mostly one light tone (the creases are faint). From 1 km at 16:30: warm lit tops, lavender turned-away sides, cauliflower heads, their shadows across the peak (the best of the set). The shadow map through F's binding: K vs K0 4.4 % of the frame, all land. The far storm (16:30, 2.5 km): a tower with a sunlit flank behind the range, lighter than the asked slate, its base hidden by the range. The flash: a broad patch of the storm ceiling to a flat pale tone with an edge along the masses (17 % of the frame against the twin without it). A cloud caught on the left peak from 150 m, its shadow on the slope: it reads as a flat white cap, a bit of a lid. NOT YET: the game's own storm at 3750 s (the weather group's test case), the K 0 pixel check against F's tree (F said they would). |
| 3e. after the look director's review of rework 1 (fair weather: "saucers ... macarons"; a thin base, a light half-tone one step under the top, clouds crowding into rows toward the horizon, fewer near-identical sizes) and the naming ruling | DONE, stills in rework2/*_rows | wxfield.js takes only render/shared.js `CLOUDSHADOW` (one name, as committed by the look director). A cumulus' size skewed (95 + 230 h^2.2 m: a few large among many smaller); a far cloud 1.5-6 km off up to 1.7 times wider and 0.7 as thick, so toward the horizon they overlap into rows; the creases a little wider. SEEN (1 km at 13:00 and 16:30, 600 m at 13:00): the far clouds on the right now a band of overlapping rows; the near front-lit ones still mostly one light tone. MEASURED (Node, triangles): at the phone's pixel angle a fair sky (0.36) from 600 / 1000 / 1600 m 82k / 71k / 61k, a building sky (0.55) 190k / 184k / 159k -- OVER the design's ~120k: a phone setting (a coarser level of detail) is needed before the owner's phone tries a building sky from the air. At the gallery's 960 x 540 angle 213-232k fair, 506-527k building. |
| 3f. the weather group's land storm IN THE GAME (their test case: a new game's land storm over the spawn at 3750 s) and the phone's triangle budget | DONE, stills in rework2/W1_game_* | The game (index.html) in the lab, `?look=oil&card=0&audio=0&save=0&fresh=1&dynres=0&quality=1&stormland=1&nearmap=1&farwind=1&rainlook=1&rainshaft=1&bolts=1&clouds3d=1`, 960 x 540: `__pc.hold()`, the painter's render swapped for a no-op, `setClock(T - 20)`, 300 steps of 1/15 s, the render back, the foot camera's `viewFwd` turned to the nearest land cell, `hold(false)`, grab. FOUND: with the hybrid, a storm in its early stage (still a `cloud`-kind cell, a towering cumulus in the map) was not drawn from the ground at all -- now a cumulus of the map 350-800 m thick and convective (conv 0.25-0.6) is drawn from the ground too. FOUND: the deck at the storm's front, the map's storm field still low there, came as a huge pale lavender bank -- now a deck 250-600 m thick goes a step deeper beneath, toward the storm's slate. SEEN: 3690 s, 980 m: a dark slate-violet ceiling with lighter seams coming in, the tower's lit top over it, fair sky beside (the weather group's A at the same moment: fair sky, nothing coming); 3745 s overhead: slate masses with lighter seams and rain; 3530 s: no storm in view (the nearest land cell then a dying one 4.5 km off; the one that passes is born later and grows on its way, so the 3.7 km sight could not be tested on this storm). PHONE BUDGET (`CLOUDS.budget` 95k, `?cloudtris=`, quality levels under 2 only): once the nearest clouds have spent it the rest take the coarsest lobe, past 1.25 times it a far cloud keeps three lobes. MEASURED at the phone's pixel angle: building sky from the air 133k-137k (was 159k-190k), fair unchanged 61k-82k; the desktop (level 2) unaffected. Suites 325 / 107 / 441. |
| 3g. the coordinator's yes to an unseen shadow field, and the look director's review of rework 2 (shadows PASS, golden hour from 1 km PASS, sky strokes off right; NOT YET: noon form from the air, a near cloud as a flat sheet, storm mass edges stair-stepped, the flash one flat block) | DONE, stills in docs/shots/clouds/rework3 | THE UNSEEN SHADOW FIELD (`CLOUDS.shadowField`, `?cloudshadow=0` off; `world.clouds.shadowField`; bench row 'weather: no unseen cloud shadow field (fair)'): from the ground in the hybrid, every cumulus the air would show and the hybrid does not is laid, at the air's size, into a mesh of the coarsest lobe on the shadow's layer only (never in the picture), up to 8 lobes a cloud within 4.5 km, so the shadows sweep the land and are the clouds the player rises into. MEASURED (Node, phone angle): 336 unseen lobes on foot, 624 at 150 m (80 triangles each, into the 256 x 256 map every second frame); the seen clouds unchanged (8 on foot); a rebuild about 1.3 ms here (twice a second). FOUND on the way: a slot with nothing to keep still slipped through the share's soft window when its own number was under 0.12 -- fixed. Storm masses (deck from below): the tone told from the continuous fields with a one-pixel edge from fwidth, as the sky's bands, not stroke by stroke. The flash: two value steps falling off from the light, by the sheet's mass (a half step, then the pale flash tone), edges a pixel wide; on lobes by a lobe's number. Noon form: the half-tone a clear step under the top (lavender only 0.20 toward the horizon), each head's turned-away side and the creases over more of each head. A cloud the eye is within 280 m of thins by whole strokes (from 450 m a cloud at 600 m read as lace: W1_W600_13_fair_B_fade450_lace). SEEN: from 150 m the shadow field lays cool patches on the left hill and the far wood (2.8 % of the frame, nothing else moves); on foot at the landing no shadow fell in view at that moment (62 pixels); the storm masses smooth-edged; the flash a pale core with a half-step ring along the masses (22 % of the frame lighter against its twin); 600 m noon: modest lavender half-tone along the heads' lower edges, still mostly light; 1 km noon about as before. Suites 325 / 107 / 441. |
| 3h. front-lit form at noon, and a storm seen from 3.3 km (the coordinator's next two) | DONE, stills in rework3 | NOON: each head its own lit cap while the sun stands high (the lower half of every head by its own normal in the half-tone, weighted by the sun's height, so the golden hour, passed, is untouched). SEEN from 600 m and 1 km at 13:00: a little more lavender low on the heads; still mostly light -- front-lit noon remains the weak case. PHONE BUDGET: the three-lobe cap on far clouds removed (at the golden hour from 1 km the far heads went: W1_W1K_165_bld_B_lobecap3_lostheads); past the budget the rest only take the coarsest lobe. MEASURED at the phone's angle: building sky from the air 137k-142k, fair 61k-82k. STORM FROM AFAR: found from the coast at 150 m (biome sea_coast) a storm cell 3.3 km off at weather time 5580 s (a sea storm, w 0.98); A shows nothing there. First B: a thin column of stacked balls under a puffy top, a MUSHROOM CLOUD (W1_CG150_15_storm3300m_B1_mushroom). Now: the tower's radius from the cell's own size (0.55 of r, 300-800 m) and never under 0.45 of its height; tiers that barely narrow, 4-7 lobes each; the anvil a flat shelf of 18 smaller lobes squashed to 0.2, streaming out downwind. SEEN: a massive storm tower with a cauliflower top rising off the horizon, its shadow darkening the sea; front-lit, so white rather than slate; the anvil does not yet read apart from the top; big round towering cumulus of the map beside it read as cotton balls. Suites 325 / 107 / 441. |
| 3b. refinements after step 3 | DONE (see git log) | Over a closed deck seen from above, a cumulus is one of the deck's heaps (wide, low, a third sunk in the sheet): the sea of cloud from 1.6 km now reads as one rolling floor with the peak through it (step3b/W1_A1K6_*; was a field of cotton balls). The base seen from below in three values: a deep core where the cloud is thickest, a belly ring, the half-tone edge: MEASURED W-G noon fair 3 value peaks (0.45, 0.67, 0.83), 12 % of the frame in cloud; 16:30 building 2 peaks (0.52, 0.67). The dark core's strokes may read busy: the look director's call. |
| 3. A6 shadow map, T5/T3 lines to the look director | BUILT; draws only once the look director lands T5 | `clouds.js`: the lobes and the deck drawn along the sun into 256 x 256 every second frame (layer 7, their own simple materials swapped in), `WX.uCloudShadow`, `uCloudShadowM` (body -> uv) and `uCloudShadowV` (view -> uv, set by a frame hook), nothing at night or with `uCloudShadowK` 0; `world.clouds.renderShadow(renderer)` or any `PREPASSES` list in shared.js runs it. THE LOOK DIRECTOR'S LINES (not committed here): `docs/shots/clouds/T3_T5_look_director.patch.txt` (T5: `PREPASSES` in shared.js, run in render/index.js before the shadow pass; T3: a cool glaze in post.js OIL_FRAG reading `uCloudShadowV`, crisp at the map's half-way line, weaker past 2 km, never on region 0). SEEN with the lines applied locally (step3/W1_A6_*): cloud shapes as cool patches on the alpine flank, the hill and the lake; 13 % of the frame changed, 26 % of its lower half, against about a third of the sky in cloud (criterion 5: 50-100 % of the cover). |
| 4. A4, A9, A10 in sky.js; A8 orbit shell; earth weather row | BUILT, SEEN once each | A4 cirrus: wind-aligned tapered strokes, the map's `high` at 2.2 km along the view or the world's `weather.cirrus` (0.25), gold and rose at a low sun (seen as white wisps, step3 W150). A9 the rainbow: four flat bands 40.5-42.5 degrees from the antisolar point and a faint second at 50.5-53, where the map has rain 1.5 km along the view, the sun up and under 42 degrees and no overcast at the eye (SEEN: step3/W1_A9_*, staged with a rain cell set 1.7 km antisolar through weather.js setForcedCell). A10 in step 2. A8 orbit.js makeCloudShell reads the map's low cover and comes in from the sky's ceiling to 1.6 times it (`uWx3D`, set by clouds.js), the fair cumulus going out one by one from 0.8 to 1.4 times the ceiling (SEEN at 4 km before that fade was added: the shell and the 3D clouds together, a storm tower standing over the limb, a scatter of far puffs along the limb that read as specks -- the fade answers that, not yet seen). Earth's row: `cirrus: 0.25, rainbow: 1`. |
| 5. bench rows | DONE in step 2's commit | `src/core/bench.js`, own block after the weather group's: 'weather: no clouds drawn (fair)', 'weather: clouds as before' (world.clouds.enabled), 'storm: no clouds drawn', 'storm: no cloud shadows' (the storm rows only with ?cloudmap=1). |

**How the stills were taken** (scratch tools, lost on a restart; what they do): `node tools/lab.mjs serve`, then for each
station `open` the gallery at 960 x 540 with `body=earth&look=oil&ui=0&t=30&season=1&` + the station + `clouds3d=0|1`,
wait for `world.clouds.stats.ms > 0`, `grab out.png 3`. Storms: `physics=1&cloudmap=1&windmap=1&pre=12`, then by
`eval` either `physics.forceWeather({ kind: 'storm', radius: 1400, strength: 1 })` and `fields.cloud.refresh(...)`, or
at `wtime=1590` aim `state.yaw` at the strongest storm cell (0.9 km from the autumn wood then). A forced sky
(`sky=cloud:0.55`) moves only the sky numbers, which the clouds read only when the cloud map is off.

**Needed from others.** `?clouds3d=1` alone does not switch the maps on (`?cloudmap=1` / `?windmap=1` are the
weather group's switches in src/physics/wx2.js); asked the weather group to make clouds3d imply both.

## Hand-over of THE FAR TREES (trees lane A1, branch `trees-far`; kept current by that session)

Started 24 Nov 2026 by helper session A1 (TREES FAR) of the coordinator. Branch `trees-far`, cut from `look-proto` =
`main` at v37.1. The design is `docs/lead/TREES-DESIGN.md` on `r2` (packages T0, T1, T4, T6 are this lane's) and FV2-T /
FV7 of `docs/lead/FARVIEW-DESIGN.md`. A second session (A2, branch `trees-near`) rebuilds the NEAR and MIDDLE trees at
the same time: this lane touches only the far parts of `flora.js`, `florakit.js`, the plant material's far branch,
`render/impostor.js`, `render/shadow.js` and new rows in `core/bench.js`.

**State (update this line every step):** (24 Nov, about 17:45) look-proto v39.2 (c7d8d9e: my small crowns and the
shadow saving live) merged into trees-far (e85dabd), rendered, pushed. THE GUST ON THE FAR CROWNS ACCEPTED BY F at
150 m and 600 m (11738e6: a small turned crown's one tone at its cap, two-thirds step); dormant until F's binding
(look-director 43540c5) reaches look-proto, with D's physics (design-weather d2f4277). READY, NOT BUILT: F's audit finding
1 (the wood as confetti from the air). THE COORDINATOR'S PLAN, on F's ?canopy=0 verdict: if it names the impostors,
build behind ONE switch (a) crowns under 4-6 px as one tone lit on the sunward side (the gust block without the band;
vGust.z's lit share is there for it), (b) crowns of 15-30 px at 150 m with fewer, bigger strokes so each tree is one
mass with a lit and a shaded side (first idea: read a coarser atlas level there, which doubles a stroke on the screen,
with the two light steps; the silhouette stays smooth by its cover), (c) a glade or two where the stand thins; if it
names C's canopy dabs, give C the one-tone rule. Scratch worktrees removed, lab closed. Before that: THE GUST BANDS ON THE FAR CROWNS: F accepted 150 m;
for 600 m F picked (a): under a band a crown under about 4-6 px is ONE tone (the tree's colour stepped paler, at the
crown's mean light), fading in over 4-10 px of crown width. BUILT and pushed (dormant until F's binding PHYS.uPhysGust,
look-director 43540c5, is merged here). SEEN in the scratch merge `gw` (trees-far + design-weather d2f4277 + D's two
patches, never pushed): 600 m patches quieter and unified, not paler on the mean (V 0.67 -> 0.66); asked F how far to
raise the tone toward the cap. F's audit finding 1 (the whole wood confetti from the air: one tone for EVERY crown under
4-6 px) is proposed to the coordinator; the code is shaped for it (the band is one input) but NOT built until the
coordinator gives it a lane. Before that: THE FAR CROWNS IN D'S GUST BANDS built and pushed,
DORMANT until F's binding (render/shared.js PHYS.uPhysGust): render/impostor.js GUST (per tree, read once at its foot,
each tree at its own threshold 0.15 + 0.45 seed, the ground's pale cooler step; ?gustbands=1 or ?wx2=1 from the address),
flora.setImpGust, row 'far crowns: no gust bands' at 150 m. SEEN in a scratch merge with design-weather d2f4277 and D's
two patches (gust held at 1.0): about 9 percent of the picture changes at 150 m and 600 m, turned crowns V +0.04 S -0.15
(`A1_gust_*`); sent to F and D; not judged in motion. Waiting: F on the step's strength; F's audit. Before that: SMALL CROWNS ARE THE DEFAULT (`?impsmall=0` the old
way), after F passed them with its colour fixes, and F signed off the real-branch pair (ea41746); look-director at 64f1742 merged into trees-far on the coordinator's
word (8f3848d; the impostor.js conflict kept my azL line and added F's pcSummerTree line). SEEN on the real branch,
phone settings, autumn wood 15.4 h, roof on (`A1_small_default_*`): 1 km, the impostor zone hue 92 S 0.36 V 0.56 with
?impsmall=0, hue 85 S 0.46 V 0.68 by default, C's roof past the reach hue 77 S 0.46 V 0.74; 150 m V 0.48 -> 0.51,
pixels under V 0.3 29 -> 26 percent; the same to 2/255 as the scratch measurement. Goes into v39.3. Before that: look-proto v39 (d9d9ed7) merged into trees-far and
pushed (my far trees compile under the new light: guard not tripped, swap 21 ms). NEXT, ON THE COORDINATOR'S WORD
"v39.2 is on look-proto" (it carries F's colour fixes, look-director up to 64f1742): merge origin/look-proto, make the
small crowns the default (IMP.small 12, ?impsmall=0 the opt-out), run the 1 km seam check F asked for (hue and
saturation of the impostor zone against C's roof), push, tell F and the coordinator. Do NOT merge look-director into
trees-far (the coordinator). MEASURED under v39, phone settings, 1 km, roof on: rule off V 0.65 S 0.35 hue 80, rule on V
0.75 S 0.42 hue 78, the roof past the reach V 0.68 S 0.37 hue 70 (the new air lifts the darks: no pixel under V 0.3
either way). The same with F's colour fixes is being measured in a scratch copy (`ld`, never pushed). T6 extra (the
coordinator): the split trees drawn whole in the shadow pass behind `?shwhole=1` (OFF), row 'split trees whole in
shadow pass'; MEASURED on foot with ?trees2=1: 226 -> 207 draws (every visible casting split mesh), picture
byte-identical; the default is the coordinator's call. The bake fix's 1-2/255 difference: accepted by the coordinator.
Scratch worktrees removed. URGENT FIX DONE for v39.1 (the coordinator): during
the bake over frames the far wood was gone; now today's far trees stand in until the bake is done and hand over in that
frame (flora.js impWant / impOn, _impReady; impostor.js step(), onReady, bakeTick), the bake counts as busy from the
frame it is asked for. SEEN, gallery autumn wood 16.8 h on foot, phone settings: mid-bake (step 5 of 78, not ready,
busy 1) today's far trees across the river, 5,915 drawn, 0 impostors; after (78 frames, 10.7 s of bake in software) the
swap in one frame, 20.4 ms here, then 4,920 impostors and only the 1,068 conifers in today's form on foot (no tree
drawn twice, no impostor kind left in today's form), page ready only then; 400 m up 83,520 impostors
(`A1_bake_foot_mid_vs_after.jpg`, `A1_bake_after_air400.jpg`). Before that: SMALL CROWNS IN TWO STEPS built behind `?impsmall=1`
(OFF by default), as F ruled (11:07): at a view of 12 texels or fewer the strokes facing the sun take the cap's level and
the rest exactly one level under it, no stroke jitter, no inner shade; 24+ texels and the conifer core untouched. SEEN
at phone settings with C's roof (`A1_small_*`): 150 m the far crowns a lit mass and a mid shade instead of lit/black
confetti, near crowns unchanged; 1 km the wood V 0.49 -> 0.75 (the roof past it 0.74), pixels under V 0.3 37 -> 7
percent, so the value step at the seam is gone, but the wood is now a bright lime, S 0.80 against the roof's 0.50 (the
lime-not-olive question, F's). Desktop A/B (1920x1080 tier 2) being shot; then to F for the ruling on the default. All
speed-test alpha-0 writes in materials.js now write 1 (coordinator's leave). Coordinator: v39.1 (impostor default +
guard) is in its gate on look-proto; merge origin/look-proto when told. look-proto 0d5533b merged into
trees-far (1ecf744, pushed). SEAM, SEEN in a scratch merge of trees-far with C's branch farview (d720b02, never pushed),
phone settings 936x372, autumn wood 15.4 h, impostors drawn in marker colours (?impdebug=1) and A/B ?canopy=0 / 1
(`docs/shots/painter/trees-far/A1_seam_*`): the impostors' reach is the horizon or nearly at 150 m (farScale 1.75,
about 1,050 m; horizon 1,106 m) and at 400 m (2.5, 1,500 m; horizon 1,833 m): the roof alone is under half a percent of
the wood there, so no seam. At 1 km (farScale 3, 1,800 m; horizon 3,000 m) the roof alone carries a ring at the disc's
edge and the change is plain: MEASURED inside the reach V 0.49 with 37 percent of pixels under V 0.3, the roof-only band
V 0.74 with none; the roof alone over the same zone (impostors not drawn) V 0.68, 12 percent. The darks are the
impostors' own leaf strokes at the two coarsest levels (84 percent of their pixels at 1 km; trunks 3, conifer cores 5),
each crown of 1-3 px still split into a lit stroke and a shaded one: the confetti R1.3c forbids, and what C's roof
avoids by taking a crown smaller than a dab to its mean light. So the seam and the crown-size note are one fix. Inside
the reach C's roof replaces the yellow and orange leaf floor between the trees with crowns (V unchanged, 0.50 to 0.49).
Also FIXED (0c873ea): the debug colours and the speed test's flat rows wrote alpha 0, which with alpha to coverage
laid nothing on a multisampled picture (the first marker stills showed no far tree; the far flat row measured less than
it said); the plant program's own rows 2 and 4 outside the far branch still write 0 (not this lane's; told the
coordinator). Waiting: F on the crown-size note; C on the seam. THE IMPOSTORS ARE THE DEFAULT FAR TREES of the oil look (after F passed the
grain fix on foot and from the air, and the owner's phone timed them: 150 m up 151 ms -> 16.7, the screen's cap);
`?fartree=old` (or cards, lump, blob) is today's far tree. THE GUARD (`render/impostor.js` probe / fail): before the first
bake step the impostor program is compiled on a one-tree mesh and three's own diagnostics read; a compile failure, a
bake that throws or an atlas that comes out empty puts the far tier back to today's form (and the hand-over as it was)
and the console says '[painted cosmos] far impostors off, today's far trees instead: <why>'. PROVEN in headless Chromium
with `?impfail=compile` and `?impfail=bake`: impFailed set, 0 impostor trees, 5,915 trees in today's form. Row 'no
shadows at all (400 m up)' added to `?bench=trees`. Earlier, after the look director's review: the grain fix (cb5666f), the bake in steps
(7a48921) and the far wind (`?farwind=1`) committed; impostors still behind `?fartree=impostor`, waiting for the owner's
`&bench=trees` table and F's verdict on the grain crops. Before that: T0 committed (rows built and run in software: they work; their timings mean
nothing here, only the owner's phone can time them). T1 (impostors) committed behind `?fartree=impostor`, SEEN in A/B
stills at the phone's and the desktop's settings (`docs/shots/painter/trees-far/`); not yet the default (waits for the
owner's phone: `&bench=trees` has the row). T4 committed: with the impostors on, the middle tree hands to the impostor
at 45 m (was 57); the near hand-over stays at 27 m (18 m waits for A2's middle tree). T6: the impostors' own shadows
from the air built behind `?impshadow=1`, NOT the default (the low-sun A/B is mixed); T6's main part, cheaper shadows of
the near and middle trees drawn as clusters, waits for A2's cluster trees. Nothing merged.

**T0, the speed test's tenth form (`src/core/bench.js`).** `?bench=1` the whole table with the new rows; `?bench=trees`
the tree questions alone, on foot and from the air (24 rows); `?bench=air` or `?bench=air,<m>` the air table (FV7: 400 m
up, 45 degrees down, then 1 km). New rows: near trees leaves only / wood only (`flora.benchNear`, the sorted index's
`leaf.base`), near bark one flat colour (`uOilL.y = 7`, one line in `PROP_FRAG`), no wind in the near trees' vertex
shader (their own `uPhysOn` set to 0), one-sided, drawn after the ground, plants without alpha-to-coverage, far trees
as two crossed cards (`flora.setFarForm('blob')`), and the AIR: the pin lifted 150 m (30 deg
down) and 400 m (45 deg down) over the same spot (`lift` / `land` in bench.js; the wanderer hovers there, held). Each
row now prints its triangles. SEEN in software at 936x372: leaves only 972k triangles against 1,124k as set, wood only
1,026k (so near wood about 152k triangles, near leaves about 98k, both passes).
**Found on the way:** the far material's tables were 8 long and Earth has 13 kinds in the oil look: the far trees of
the poplar, oak, birch, willow and sapling read past the end (drawn with another kind's colours, taper and family).
FIXED with T1 (`PC_NFAR`, the tables sized to the kinds; `?farfix=0` keeps eight): A/B at 150 m changes 5 % of the
picture, the poplars taking their own taper and colours (`A1_farfix_air150_*`). And the flat test of the far branch caught
rows 5 and 6 (a leaf in its own colour, no air on the plants) too, so those two v37 rows also flattened every far tree:
fixed in T0 (the far flat now only for 2 and 3).

## Hand-over of THE TREES NEAR lane (group A2, branch `trees-near`; kept current; 2026-11-24)

The brief (from the coordinator): the owner wants 30 a second on the S23 Ultra (v37: about 89 ms a frame, the NEAR trees
about 52 ms of it) without losing the look; the near trees at 5-15 m are approved as they look now. This lane builds
packages T2, T3 and T5 of `docs/lead/TREES-DESIGN.md` (on `r2`), each behind a switch and a speed-test row, and does not
touch the far trees, the hand-over distances or the shadows' cost (session A1, branch `trees-far`), nor chunks.js,
post.js, shared.js or world/index.js (the look director's).

**A FINDING THAT SHAPES THE LANE (measured in Node, not on a device).** A scratch rasteriser over the real grove kit
(roundmaple seed 11, the phone's 372 lines, fov 58, today's leaf thinning applied to both): leaf CARDS carrying a dab
spray RASTERISE 5 TO 9 TIMES THE FRAGMENTS of today's leaf polygons for the same leaves on screen (6 m: 153k-179k
against 24.8k; 12 m: 78k-82k against 15.8k), because a spray card is mostly sky round its leaves and every one of those
fragments runs the lookup before it is discarded, while a leaf polygon covers exactly its leaf and its paint is already
done in the vertex shader. Cards save 3,000-5,000 triangles a tree. Told to the coordinator; so BOTH forms are built and
the phone prices both in one run.

**STATE ON 24 NOV, LATE (the owner's phone priced the forms: two short programs 40.3 ms a frame, no near trees at all
36.6; cards dropped).** The two short programs are THE DEFAULT in the oil look; `?trees2=0` gives the trees as before
(SEEN pixel-identical to the previous default, `1d7e54f`, at 5 and 10 m). A GUARD: if a device cannot link either
program, every tree goes back to the one program at once and the console says why (`materials.js TREE_GUARD`, checked by
the painter after each frame, `render/index.js`; `flora.js update` falls back). PROVEN in headless Chromium with
`?trees2fail=wood` (or `leaf`), a test switch that puts a line that is not GLSL into that program: in the GAME
(`/?look=oil&quality=1&body=earth&time=14&trees2fail=wood`) three logged the four broken wood programs at 57 s (its own
`THREE.WebGLProgram: Shader Error`, with the material's name and the compiler's line), the guard's warning followed in
the same second, and by the next look every tree mesh was the one program (25 of them, none of the two), no other
error; in the gallery, both `wood` and `leaf` give a still PIXEL-IDENTICAL to `?trees2=0` at 5 m once the trees have
been built again. THE BARK'S STREAK CONTRAST (the look director's note: at the 5 m trunk crop the split's streaks were
flatter and less broken than today's) is today's again: SEEN, the cause was the SIDE TAKEN OFF EVERY TUBE, not the
programs and not the hair twigs (the split programs on today's tubes match today to 0.11 of 255 in the trunk crop; with
the hairs back and the side still off it was 4.5), so every tube keeps today's sides (near trees in the sample: 114,712
triangles against 110,874 with the side off, today 146,800). New default against today: mean difference 0.31 of 255
at 5 m and at 10 m (was 2.0 at 5 m with the side off). Stills: `A2_default_*`, and the crop
`A2_default_autumn-phone-5m-trunk-x3_*` (today | the default now | the first split). The wood program also lays the
two layers as the big program did, each at its own light (it made a small difference, about 9,000 pixels, 0.08 of 255).

**MERGED v39 (look-proto, 24 Nov): the new light.** The split's leaves follow the look director's L2 shade with no line
of their own (their paint is made in `PROP_VERT`, shared with the one program; `LEAF_SUN`'s `pcLeafDeep` is now
`pcShadeLeaf`). The WOOD program needed one change: v39 lights the big program's bark by the ONE LIGHT (L3, `pcLit`,
picked by `uLookF.z`, on by default; `?light=old` turns it off), so `pcWoodLevel` and the wash under the layers now take
it the same way. SEEN at the phone's settings, autumn wood 16.8 h: under v39's light the default against `?trees2=0`
is 0.30 of 255 at 5 m and at 10 m (0.31 with `?light=old`, as before the merge); the new light itself moves the
picture by 1.7, so the wood follows it; `?light=old&trees2=0` is pixel-identical to the still before the merge. Stills
`A2_*-v39_*`. (The cards' own program, `CARD_FRAG`, does not take the one light: cards are dropped.)

**THE PINES AS POLES (24 Nov, the coordinator's urgent check and the cure, `?pines=1`, OFF by default until F passes).**
Not the split: on v39.1 the poles are the same with the one program (0.2 of 255; stills `A2_pines-v391_*`), and every
leaf of every kit is identical with and without trees2 (Node). In the autumn wood the 'tall pines' near the camera are
SPRUCES (no tall pine within the loaded patches): the spruce kit shares its needle budget out by limb length, so 685 of
its 880 cards are in its lower half and its top is sparse (the middle form has whole tenths empty); behind the maples
only that top shows. THE CURE (materials.js PROP_VERT `uNeedle`, flora.js `NEEDLE_KITS` tallpine and spruce,
`_leafLod`, `setNeedles`; row 'pines: needles kept wide at range' in bench=trees): from 10 m out a needle card grows
about its centre up to NEEDLE_FILL (2.2; `?needlefill=` to judge another) at 30 m; a needle is kept at least 3 px across;
the needle kinds are thinned to at least 45 / 60 per cent (near / middle) instead of 20 / 35. SEEN (gallery, autumn wood,
936 x 372 tier 1, the same spruce at 20, 40, 60 m, the switch flipped on one page): the spruces gain dark needle
sprays up their stems and tufts at their tips; at 40 m still a pole with tufts rather than a mass (the kit's top is
sparse); with ?needlefill=3 the tops read darker, but the low whorls seen between the maples' trunks become big dark
spiky shapes. Triangles +2,834 at the landing (Node). The default is the picture before to the pixel. For F: stills
`A2_pines_*` (A off, B on) and `A2_pines-fill3_*`. If a true needle mass is wanted at 40-60 m, the spruce kit's budget
by limb COUNT rather than length (a denser top) is the next step: it changes the near spruce too.

**ON FOOT TO UNDER 33 ms (the coordinator's job, 24 Nov, after the ground from the air was found to hold no 30 ms:
the v38.2 table had the whole 400 m frame at 17.9 ms with impostors, ground included).** DERIVED from the phone's own
rows: v39.1 (split trees + impostors) is about 22 ms on foot (40.3 split - 18.5 old far trees + 0.7 impostors; and
'no trees' was at the 16.7 cap in v37, so all that is not a tree fits under 16.7). Never timed together: the owner's
next table decides. Built for that table: `?bench=foot` (core/bench.js), the frame on foot without the trees'
questions, and THE NEAR GRASS AND FLOWERS' FIRST ROWS (in the full table too): 'no near grass or flowers', 'near
grass: half its marks' (`materials.js NEAR_VERT uNearCut`, folded away before any is rasterised, by place in
half-metre cells so a flower plant of several marks goes whole, the flora lane's ask; at 0, the default, not worked
out at all), 'near grass one flat colour' (`uOilL.y` 8 in `NEAR_FRAG`). Also fixed: my wood
program honours the flat mode 7, so 'near bark one flat colour' measures the split's bark. SEEN: the default still
pixel-identical to before; each mode acts (half: fewer blades and leaves; flat: every mark in its flat wash; bark flat).
The speed test's panel now lists the three tests (trees, air, foot) with their addresses and how to send each.
STANDING BY (24 Nov, 13:10) for the owner's three tables (bench=trees, bench=air, bench=foot on v39.2): no cut is
built until they show where the on-foot frame goes. COUNTED (Node, landing, phone tier 1, 936 x 442, on foot): the near grass today 12,967 marks (fine ring 6,941, middle
4,333, vista 1,693), 38,901 triangles, 272k fragments rasterised, 107k pixels covered, about 110k painted after the
depth test; the flora lane's branch (design-flora e55f6cc) 26,928 marks (fine 15,608, carpet 6,460, middle 3,167),
80,784 triangles, 357k fragments, about 172k painted after the depth test.

**COUNTED AT THE LANDING after v39 (Node, the scratch copy of `tools/overdraw.mjs`, `where=spawn`, phone tier 1, the
counter's 787 x 443 = 0.348 Mpixel at fov 55, on foot; `?trees2=0` against the default):** near wood 71,504 -> 39,920
triangles, near leaves 47,110 both, middle trees unchanged (wood 21,310, leaves 34,356: the middle tree never had hair);
the whole frame 1,509,543 -> 1,477,959. Wood fragments rasterised (only the faces seen are drawn now): near 111,117 ->
56,581, middle 39,873 -> 24,250. Tree fragments painted: the old program discards, so it cannot test depth first
(about 379k: every fragment of the near and middle trees); the split, with the depth test first in three's own order,
about 148k (simulated). DRAW CALLS: near 11 -> 22, middle 18 -> 36 in the colour pass, and as many again for each of
those meshes inside the shadow square (three draws a mesh with two materials group by group even under the shadow
pass's one material): up to +58 a frame. All of that was already in the phone's 40.3 ms; since then only +3,128 near
wood triangles (the sides kept), 0.2 % of the frame. (A shadow-only mesh of one material per split mesh would take the
shadow pass back to one draw a tree mesh; not built: the shadow pass is A1's.)

**What is built (the oil look only; `?trees2=0` puts every tree back as it was):**
- THE DEFAULT (was `?trees2=1`): the near AND middle trees drawn by TWO SHORT PROGRAMS (`materials.js` `WOOD_FRAG`,
  `LEAF_FRAG`, chosen by `makePropMaterial(..., { tree: 'wood' | 'leaf' })`), over two groups of one index (wood, then
  leaves; `flora.js` `splitGroups`), with the near tree's haze of HAIR TWIGS NOT BUILT (`kits/grove.js`, `trees2`; the
  hairs were 1,072 to 2,500 triangles a tree). THE SAME TREE: every random number is still drawn, so the skeleton and
  every leaf are where they were, the trunk to the bit (`src/world/trees2.test.mjs` holds it).
  The leaf program has NO DISCARD and no alpha to coverage: the lens window, the explorer's window, the wash and the fire
  drop WHOLE LEAVES in the vertex shader (`PROP_VERT`, `PC_TREE_LEAF`), so the card can test depth before painting. The
  wood program lays the bark's two layers of streaks as the big program did, each at its own light, leaving out only
  the flat wash the coarse layer covers whole and the fine layer's work where neither of its streaks is there; it
  pinches a branch in round the lens (`PC_TREE_WOOD`, with `Builder.axis`: a tube's ring carries its centre in `aCard`)
  instead of discarding, and lays the branches of a wash one by one.
- `?trees2=cards`: the same wood, and the near tree's leaves as CLUSTERS ON CARDS (`kitbuild.js clusterCard`, part 7;
  one six-cornered card where a clump of leaves hung; its chart in DAB CELLS so the shader needs no number of the
  kind's own). The leaves on a card are the ground's own baked dab layer (`dabtex.js SPRAY_GLSL`, shared by the card's
  paint `CARD_FRAG` and the shadow map, so a card throws exactly the leaves it is painted with); a leaf is laid only if
  it lies whole inside the card (the outline is leaves); painted at its own centre with one tone. Cards thin and grow by
  distance as leaves do (`sortLeafCards`, `uLeafLod`: part 7 counts as a leaf).
- `?treedepth=1` (with `?trees2=cards`): package T5. The cards are drawn in DEPTH ONLY before the scene
  (`render/index.js treeDepthFirst`, `materials.js TREE_DEPTH`), then in colour where the depth is EQUAL, with no discard
  and no alpha to coverage; `invariant gl_Position` keeps the two passes' corners identical.
- Speed-test rows (`core/bench.js`): 'trees in one program as before' (it reads 'trees: two short programs' when the
  run starts with `?trees2=0`), 'near trees as clusters', 'middle trees as clusters', 'clusters with a depth pass
  first', each swapped in while the test runs (`flora.js setTrees2(mode, depth)`; after the guard has fallen back only
  the one program is given).
- Hunks in files of other lanes, each small and said in the commit: `shadow.js` (a card's shadow through its spray;
  cards thinned as leaves), `core/bench.js` (the rows, and its helpers now see a mesh with two materials).

**Seen / measured / not (2026-11-24):**
- SEEN, phone settings (936 x 372, tier 1, lighter paint, fov 58), the autumn wood at 16.8 h, the same tree framed from
  5, 10, 18, 30, 45 m (`docs/shots/painter/trees-near/`, `A2_today_*` A, `A2_split_*` B, `A2_cards_*` C):
  `?trees2=1` is the same picture to the eye (leaves identical, bark streaks the same kind; mean difference 0.35-2.0 of
  255; the look director's `lookstats.py` equal to the hundredth). `?trees2=cards` reads as crowns of separate crisp
  leaves; at 18-45 m it looks at least as good as today (the middle tree of many small leaves in place of big kites);
  at 5-10 m it is SPARSER than today and a little lighter and less saturated (more sky between leaves).
- MEASURED in Node at the spawn wood, phone tier (`tools/overdraw.mjs`, a scratch copy taught material arrays and the
  wood/leaf split): near wood 71,504 -> 36,792 triangles with `split` (fragments 81.6k -> 77.7k); leaves unchanged.
  With `cards`: near leaves 47,110 -> 14,718 triangles but RASTERISED FRAGMENTS 127k -> 461k; middle leaves 34,356 ->
  21,778 triangles but 105k -> 749k fragments. So cards trade about 45k triangles for about a million more fragments
  run through the leaf lookup (most of them discarded): almost certainly a LOSS on the phone unless the depth pass
  (T5) makes discarded fragments nearly free, and even then the depth pass runs the lookup on every one of them.
- NOT KNOWN: what the two short programs save on the phone (the design's reading: the bark's long program in every
  near-tree wave; only the bench can say), anything in motion, anything on a real graphics card.

- T5 SEEN: with no multisampling, as the phone draws (`?aa=0`), the cards with and without `?treedepth=1` are
  PIXEL-IDENTICAL (0 pixels of 348,192 differ at 5 m and at 10 m). With multisampling (the gallery's tier 1 in
  software) they first differed at leaf edges only, because the painter's loop forced alpha to coverage back on for
  the colour pass (fixed: `render/index.js` leaves the trees' programs alone).
- DESKTOP top tier (1280 x 600, quality 2, full paint), autumn wood, 5-45 m: `?trees2=1` equals today (lookstats to
  the hundredth; bark warm-streak share 0.259 against 0.257). Committed: `A2_*_autumn-desktop-*`.
- THE WOOD DRAWN BACKSIDE (half the wood rasterised): the same picture as DoubleSide once its facing is kept
  (`PC_WOOD_FLIP`): B2 against B at the phone's settings, mean difference 0.13 of 255. FOUND ON THE WAY: every tube
  in the kits is wound with its front facing INWARD, so today's bark is lit with its normals pointing into the trunk
  (the sun side painted as the shade side). Told to the look director; not changed.
- THE GREEN WOOD (the birches, noon, phone settings, 5-45 m): `?trees2=1` equals today (mean difference 0.31-0.96 of
  255). The first still after the camera's jump from the spawn differs in its leaves as much as its bark in BOTH A
  and B (a settling transient after the jump, not the programs); taken after a warm-up frame, 5 m is 0.34.
- THE SWITCH OFF IS THE PICTURE BEFORE, TO THE BIT (LOOK-RULES R6.1): the look director's S1 (the stream at 16.8 h,
  1024 x 480) drawn by this branch with no `?trees2` against the same still from the commit the lane started from
  (`a54173a`, served from a worktree): 0 of 491,520 pixels differ. S1 and S2 with `?trees2=1`: lookstats identical,
  mean difference 0.72 and 0.18 of 255 (`A2_split_S1-*`, `A2_split_S2-*`).
- Cards with the denser spray (SPRAY.pres 0.9): still sparser than today at 5 m (`A2_cards-pres09_*`); more cards would
  close it at more cost. Left there until the phone says cards are worth anything.

**How the stills are made** (the tools are scratch, not committed; recreate from this): `tools/lab.mjs serve`, then
open `/gallery.html?body=earth&biome=autumn_woodland&season=1&cam=trees&time=16.8&look=oil&lite=1&quality=1&t=0&ui=0&fov=58`
(+ `&trees2=...`) at 936 x 372; eval a helper that picks the tallest tree within 30 m of the first camera place
(`world.sampleObstacles`) and sets `__pcGallery.state.pos/yaw/pitch` to stand d metres from it, eye 1.7 m, aimed at
0.55 of its height; `resume`, wait for `world.busy === 0`, `grab out.png 3`. THE GREEN WOOD is not reachable by
`?biome=temperate_forest` in the oil look (the first two sites swap: that address lands in the autumn wood); use the
world's own `findBiome('earth', 'autumn_woodland')` stand, which in the oil look IS the green wood.
Counts: a copy of `tools/overdraw.mjs` with `QUALITY.level` from the environment (1 is the phone's tier), material
arrays counted group by group, part 7 thinned as a leaf, `where=spawn` (the spawn is the autumn wood of grove trees;
its `where=autumn` stand is the green wood's broadleaves, where `?trees2` changes no geometry).

**`?treesway=whole` (the coordinator's ask for a cheaper sway, 24 Nov):** the NEAR trees bend whole, as the middle trees
already do (T3), without PHYSICS' per-branch crown (`pcPhysCrown`: two field lookups, 24 sines, 4 powers, 3 arctangents
a vertex). Built as the near tier being given the middle tier's own programs (`-mid`, branch off; each mesh sets its
tier's ranges before it is drawn, so one program serves both). With the two short programs only. Speed-test row 'near
trees bend whole (no branch sway)' (`flora.js setTreeSway`, `core/bench.js`). SEEN: compiles and draws; the near
programs are the `-mid` ones and swap back; the still at rest is PIXEL-IDENTICAL to the default (the gallery's held clock
has no wind, so no still can show the sway): HOW IT LOOKS IN MOTION IS NOT KNOWN, only the owner's phone can show it.
Note for the bench: the 9.5 ms 'near trees: no wind in shader' row cuts the wind of every tall material, the middle tier
too, and the middle tier lost its crown sway with the split already; that row wants running again on the split default.

**Next:** when the look director's
L2 is final, merge `origin/look-director` and have the split's leaf paint call the same `pcShadeLeaf` (`LEAF_SUN`'s
`pcLeafDeep` sits on those lines). Keep `PC_WOOD_FLIP` on (today's inside-out bark facing) until the look director
settles it. NOT KNOWN: the guard on a real phone's driver (it rests on three's own link check, which is on by default
and which nothing in the game turns off), anything in motion.

(A1, the far trees lane, kept its T1 note here in look-proto; it is theirs and kept as they wrote it:)

**Next:** A/B stills (5/10/18/30/45 m, autumn and green wood, phone and desktop) -> commit T2 split -> stills of cards
and T5 (pixel-identical check) -> commit -> T3 (the middle tree) -> report each step to the coordinator and the look
director (session_01R5Brhzz2JPPF6Ecz6XRQHx).
**THE FAR WOOD IN THE WIND (`?farwind=1`, the weather group's far wind field).** With it the impostor material takes the
plants' physics uniforms (`PHYS`, shared) and its vertex shader leans the quad over the tree's foot by `pcPhysBendLite`
(one bend a tree, read at its foot; stiff 1), so the top moves and the foot does not. Today that function reads the bend
field near the eye; once the look director binds `uPhysFar` (look-director shared.js) and the weather group's
flora.glsl.js lands, the same call reads the far field beyond 128 m with no change here. SEEN only as a still (with
`physics=1`): the impostors draw whole and lean a little; motion is for the phone. Row: 'far trees still in the wind'
(on foot and 150 m up), which sets the impostors' own `uPhysOn` to 0.

**THE BAKE IN STEPS (`ImpostorAtlas.bake(renderer, budgetMs)`).** One step is one tree at one level: its 64 views drawn
into its own square of the target and that square read back (at most 2.4 MB) into the level's array. The frame hook runs
as many steps as fit in 4 ms of a frame (`?impbake=<ms>`, 0 = all at once, which the stills here use), always at least
one; the impostors draw nothing until the last step (Earth: 13 trees x 6 levels = 78 steps). CHECKED: baked step by step
it is byte for byte the one-shot atlas (0 of 50,319,360 bytes differ); here a step is about 0.13 s of software drawing.
On the phone the steps' time is not measured; with one step a frame the far trees come in after 78 frames at worst.

**THE GRAIN FIX (after the look director's review of T1, 24 Nov; it supersedes the T1 paragraph below where they
differ).** Every leaf of a stroke now takes the stroke's ONE normal (the crown's front surface) and ONE inner shade, and is
written at the stroke's own depth, so overlapping strokes are laid whole (no texel of the one behind pokes through);
strokes 4.5 texels (so at least 2.5 px at the phone's level; `?impstroke=`); half the inner shade a stroke's depth gives
(`?impdeep=`) and 0.35 of a near leaf's light jitter (`?impjit=`), so a crown reads as a lit mass and a shaded one; no
read of the shadow map (a texel's place would cut a stroke at a shadow's edge); the silhouette by COVER: the four texels
round the point weighed bilinearly, nothing laid under a half (a quarter on a multisampled picture, with alpha to
coverage), so the outline is a smooth line at the pixel, not stair-steps (4 fetches a fragment instead of 1); the shade
through the shared `pcShadeLeaf` wherever chunks.js has it (look-director c4306fc; detected in the text, else pcTone);
nothing of a crown under V 0.18 (the ruling for the darkest conifer); the level a stroke is read from is coarser on a
taller picture (about 3.5 px at 1080 lines, not yet seen on a desktop). ON FOOT the conifer kinds keep today's far form
(their dark spikes, which the look director judged better on the skyline) below 40 m of height and become impostors
from the air; the broadleaves are impostors at every height (`?impfoot=all|none`; flora.js tier 4 = far as impostor).
MEASURED (phone, 150 m): lit crowns hue 67, S 0.60 (ruling: under about 80 and 0.75), but V 0.91 (R1.2c's lit canopy
0.60-0.82: the lit step of the shared data colour, not a gain of the impostor's); V under 0.18 1.4 % of the picture
(today 13.5 %); S(V<0.3) 0.35 -> 0.16. On foot the frame is 719k triangles (all impostors 609k, today 1,247k): the
conifer cards cost about 145k. Stills `A1_grainfix_*`, 3x crops `A1_grainfix_crops_3x.jpg`.

**T1, far trees as painted impostors (`src/render/impostor.js`; `?fartree=impostor`).** For every kind drawn far off as
leaves (`CAN_CARD`), its lod-0 tree (one variant; `?impvar=2` two) is baked once per world, in a frame hook the first
time an impostor is drawn (the painter's hooks run outside a render; the renderer is handed over by the first impostor
mesh's `onBeforeRender`), into one atlas: 8 x 8 hemi-octahedral views from the horizon to nearly straight down, 96
texels each (`?impres=`), 6 levels each BAKED again at half the size (no averaging, no blur), read back and uploaded as
a DataTexture with its own mip chain (NEAREST_MIPMAP_NEAREST). Earth: 13 kinds, 3072 x 3072, 48 MB with levels; the bake
took 8.5 s in software here (the phone's graphics card: not measured; a second or so of script is the guess).
A texel holds a stroke's number, the normal, the inner shade, what it is (wood, leaf, snow leaf, core) and where its
centre lies along the line of sight. What the bake does to make a far crown read (each SEEN to be needed, in order):
leaves drawn larger until each kind's crown is equally dense (`?impdens=` 3.0; Earth's kinds run from 0.13, the spruce,
to 1.3, the round maple, so one factor left conifers bare poles), never under 2 texels; leaves gathered into strokes of
3.4 texels (a grid through the crown that nests from level to level); each stroke lit by the crown's FRONT surface along
the line of sight (an ellipsoid round the leaves: a crown reads as a round lit mass with a shaded side, the references'
"round crowns"; with each leaf's own normal the canopy was a speckle), with how deep behind that surface it lies as its
inner shade; half the near leaf's light jitter (`?impjit=`); the trunk thickened by a third of a texel, the limbs only at
the finest level. Drawn as two triangles a tree with the near tree's own matrix (size, lean, a felled tree's fall), the
quad framed on the tree's upright cylinder as seen from the chosen view, stood 0.35 of its radius toward the eye; the
fragment does one fetch and the leaf's steps of `PROP_VERT` with `pcTone` (not the private deep-shade recipe, R1.2b),
the crown's lit side by the far rule, inside the shadow square the map as well (min of the two: impostors cast nothing).
FROM THE AIR their reach is hypot(height, 1.5 km), held to the horizon (`?farreach=`; FV2-T): 1 km up on the phone a
forest is drawn where today nothing is.
COUNTED (gallery, autumn wood, 15.4 h, summer dress; frame = every pass): phone 936x372 tier 1, on foot 1,247k -> 651k
triangles (far tier 816k -> 12k, 5,915 trees), 194 calls both; 150 m 2,942k -> 221k (far 5.88M -> 130k before the
frustum's cut; 42,631 -> 64,816 trees as the reach grows to 1,050 m), calls 137 -> 162; 400 m 3,545k -> 221k, 128 ->
188 calls (83,520 trees to 1.5 km); 1 km 96k (no trees) -> 171k, 62 -> 166 calls. Desktop 1280x720 tier 2: on foot
3,220k -> 2,751k; 150 m 2,867k -> 385k; 400 m 3,354k -> 301k.
DERIVED phone cost (T1 design's rate, 0.026 ms per 1000 far triangles from the v37 lumps row; the paint per pixel is
not known): on foot about -20 ms of far geometry, plus 1 to 3 ms of impostor paint (design's figure, not measured);
from the air the far tier from about 150 ms (5.9M triangles) to about 3 ms of geometry plus its paint. The extra draw
calls from the air (+25 to +60) cost the script about 0.5 to 1.2 ms. Confirm with `&bench=trees`: rows 'far trees as
impostors' on foot and at 150 m and 400 m.
STILL WRONG / NOT KNOWN: the view switches (about 13 degrees apart, nearest, no blend) and the level switches are not
seen in motion; the hard edge where the trees end 1 km up (the far-view lane's painted canopy, FV2, is meant for it);
the darkest conifer strokes are V 0.13 (R1.2c asks 0.18 for conifers); the hand-over at 57 m to the middle tree (T4);
the bake is one long step at the first far draw (could be spread over frames).

**T4, the hand-over distances (`flora.js` `setHandover`, `?treenear=` / `?treemid=` in metres at the phone's scale).**
The full tree's and the middle tree's reach (T0 90 m, T1 190 m before the picture's scale) are per world now
(`flora.t0`, `flora.t1`; the leaves-by-distance schedule reads `t0` as it is drawn, so they can move while the game runs;
`shadow.js` `SHADOW_TIERS.mid` follows). With the impostors on, the middle tree stops at 45 m at the phone's picture
(was 57) and the impostor takes over there; without them nothing changes unless the address says so. The design's full
tree to 18 m is NOT taken by default: SEEN, with today's middle tree a tree 15 to 20 m off turns into an umbrella of
big kites (`A1_handover_near18_phone.jpg`); it waits for the near lane's new middle tree (`?treenear=18` tries it).
SEEN at 45 m (`A1_handover_stream_15h_{A,B}_phone.jpg`, `A1_handover_bank_3x.jpg`): the 40 to 57 m band of the far bank
becomes impostors that match the ones behind them. Found and fixed on the way: a young oak at 50 m drew as a bare stump
-- each quad stood 0.35 of its radius toward the eye, so a big neighbour's quad came out nearer and hid the small
tree's crown; quads now stand at the tree's middle (`IMP.push` 0, `?imppush=`), and the limbs are kept to the third
level (left out from the second, a small tree's crown floated over its trunk); `A1_impostor_stumpfix_4x.jpg`.
COUNTED (phone, gallery, on foot, impostors on): middle tree to 57 m 651k triangles, 194 calls; to 45 m 609k, 178 calls.
DERIVED: the middle trees from 45 to 57 m, about 42k triangles a frame at 0.043 to 0.124 ms per 1000 (the skeptic's
range) and their pixels painted by the impostor instead: about -2 to -6 ms. Rows: 'middle trees only to 45 m',
'trees hand over at 18 / 45 m', 'impostors from 45 m' (the package as `?fartree=impostor` ships it).
Debug: `?impdebug=1` paints each impostor texel flat by what it is and the level it was read from.

**T6, the impostors' shadows from the air (`render/impostor.js` `makeImpostorShadowMaterial`; `?impshadow=1`).** Above
60 m (where no near or middle tree stands in the shadow square) each far impostor mesh joins the shadow pass's own list
(`SHADOW_CROWD`, as the animals do) with a shadow twin: the quad turned to face the SUN, the baked view nearest the
sun's direction read at the map's own texel, a third of the crown's strokes casting (`uThinLeaf`, as a near crown). SEEN
at 17 h (`A1_impshadow_{air150,air400}_17h_{A,B}_phone.jpg`, `A1_impshadow_air150_2x.jpg`): plum shade lies beside the
crowns in the glades and along the river banks, but the canopy as a whole gets darker (lookstats V median 0.51 -> 0.42 at
150 m) and at 400 m the gain is slight. Not clearly earned, so OFF by default; the look director and the owner to rule.
COUNTED: +33 calls and +48k triangles at 150 m, +41 calls at 400 m (the shadow pass's fragments not measured).
T6's main part (the near and middle trees casting as clusters with the spray's coverage, about -0.8 ms) needs A2's
cluster trees first.

## Hand-over of THE OIL LOOK, prototype on branch `look-proto` (READ THIS FIRST; kept current)

Branch: `look-proto`, cut from `main` at `5e85754`. Nothing here is live. The plan, the owner's instructions, the sort of
the references and the crispness rule are on branch `r2`: `docs/HANDOVER.md` (section 2, and 4a-2: the overhaul plan the
owner approved) and `docs/references/README.md`. Read those before touching the look. Built by the coordinator itself
(no workflow). The log of every decision is `docs/COORDINATOR.md` on `r2`.

**What it is.** `?look=oil` paints the same world in opaque paint with strokes laid on the surfaces themselves, after the
owner's reference clip. Without the flag nothing changes: the switch is the compile-time define `PC_OIL` in every painted
material (`src/render/shared.js`: `LOOK`, `OIL`, `register`), and the watercolour's code paths are untouched.
`src/data/mode.js` (`MODE.oil`, `MODE.wanderer`) carries the switch to the data, the surface and the player code, which
must not load the page's modules.

**The owner on the checkpoint of 2026-11-16:** the look is approved ("I like the look so far keep it up"); the cloak
was "clunky" and wants thinner or more strips so that it flows (done: about six hundred thin strips in nine tiers,
`cloakRow` in `src/art/models.js`); the aurora read as "stripes instead of lights like the reference" (done: it is
LIGHT ADDED TO THE SKY and soft, `pcAuroraLight` in `src/world/sky.js`: the one soft thing in the picture, by the
owner's word; the crispness rule stands for everything else); go on without stopping for approval.

**The owner's choices so far** (each logged on `r2`): STYLE 5, leaf dabs lying every way, a little thinner than the
clip's (the five other styles are gone); match the clip very closely, changing ground and plants where that helps; no
blur at all; colours that pop with no detail lost; the cloak a rich blue; no jetpack, the explorer flies by itself.

**After the owner's first play on a phone (2026-11-16; the log on `r2` has the whole account).** The look went live
behind `?look=oil` (pull request #4) and the owner played it on a Samsung S23 Ultra at the pinned top settings: the
snow world liked (about 35 pictures a second), the FOREST "choppy and slow" (about 9) and "not as pretty as the snow
one"; rivers wanted with tributaries, "split off into many with diverting paths that connect". 23 new pictures of
autumn woods and forests from the air came with it (`docs/references/README.md` on `r2`). What was built for that, all
behind the look's switch:
- **Trees by their size on the screen** (`src/world/flora.js` `update`: `treeScale`, `farScale`; `SCREEN` in
  `shared.js`, written by the painter's `resize`). The tiers' ranges (full tree to 90 m, middle to 190 m, far to
  600 m) were made for a desktop's picture; on a phone's 618 lines they scale by 0.55, never under 0.5. The far trees
  also follow the air (from the ground to twice the world's ground visibility, Earth 370 m; from the air up to twice
  their range). `?trees=full` gives the old ranges and no leaf thinning, for comparisons.
- **Leaves by distance** (`florakit.js` `sortLeafCards`, `leafDrawCount`; `materials.js` `PROP_VERT` `uLeafLod`;
  `shadow.js` `VERT`; `flora.js` `_instanced`). A tree's leaf cards are put in the order of their numbers (aData.w);
  beyond a quarter of the full tree's range a share of them is drawn, the highest numbers, each larger by as much as
  keeps the crown as full (to a fifth at the end of the range); a leaf at the edge of the share shrinks into its own
  centre. A mesh draws only as much of its index as its nearest tree needs (`geometry.setDrawRange` in
  `onBeforeRender`, per pass: the shadow pass, where only a third of the leaves throw a shadow at all, draws fewer
  still, larger). MEASURED in software drawing at the phone's picture size: see the log.
- **The landing wood is the autumn wood** (`data/mode.js` `overlayOil`: a look's `oil.sites`; `earth.js`): the first
  site and the first autumn site change places in the oil look.
- **Each tree its own colour** (`PROP_FRAG` `uLeafFam` / `uFarFam`; a species' `oil.fam = [r, g, b, strength]`): a
  tree keeps to a short piece of the run yellow, orange, red by its own number (four in ten yellow, four orange, two
  red), near and far. Conifers stand in groups among the broadleaves (`oil.tallMix` as a pair, `surface.js`
  `_forest`), glades are wider (`oil.glade`), the air clearer (`oil.over.mist`).
- **The floor is grass** (`earth.js` autumn `oil.pal`; a look's `oil.leaves`: the share of fallen-leaf dabs under
  trees, `uGroundK.w`). THE SWARD IS BACK (`uOilG.x` 1; `?sward=0` turns it off): the near ground's strokes
  (`nearground.js`, unchanged) painted in the oil hand in `NEAR_FRAG` under `PC_OIL`: each stroke one flat piece with
  a clean edge, lit WHOLE from its root (`vRootB`), a tuft cut into separate lancet blades each its own tone, a
  flower a round touch, a fallen leaf a pointed oval; never darker than a middle wash; its shade its own colour laid
  heavier with half the cool key (the same for GREEN ground dabs, `pcGroundPaint`: shaded grass is deep green, not
  violet-brown).
- **Leaves smaller and rounder near the eye** (`florakit.js` `birchGeometry`, the slender tree: 104 and 160 six-cornered
  leaves a bough where there were 84 and 130 kites, a fifth shorter).
- **The rivers** (`surface.js` `_riversOil`, `_sf2`; a look's `oil.rivers`; Earth only): the stream's line becomes a
  system: the main channel (8 m) wanders off its line and a second keeps it (islands), a third swings wide, pools up
  to six times the width and deeper, and side streams (the lines of a second field, taken at a different level on
  either side of a river so that every meeting is a fork) in narrower valleys. It returns the same "distance to the
  nearest water" the recipes read, so banks, beds, trees and colours follow. From the air a river is drawn into the
  far colour as wide as the ground's samples lie apart (`patchgen.js` `S.foot`). Scratch maps of the system were
  drawn in Node before any browser was opened (described in the log).
- **Water is blue** (`WATER_FRAG` under `PC_OIL`): half the water's own wash laid heavy and blue whatever the sky
  gives; the sun's path a narrow run of marks (it was a wide pale sheet: "a gravel road").
- **A speed test for a real device** (PILOT's `src/core/bench.js`, `?bench=1`; the painter's `_bench`): the same view
  drawn ten ways, the table left on the screen for the owner to photograph.
**Still wrong after this pass:** rivers are only faint from high up; the meadow from above is a little lemon; dark
maroon flowers and stalks in the shade of the sward; the far land beyond the trees' range is a mosaic of large dabs;
nothing of it has been seen in motion or on a real graphics card.

**After the owner's SECOND play on the phone (2026-11-16, pull request #5 merged; the phone's own settings; the
speed test's first table and a recording; "it feels bad ... most of the things haven't rendered and it looks blurry
and blotchy"). What the table said and what was wrong is in the log on `r2`. In short: the phone's own settings drew
the look at 822 x 384 and then the controller halved that and dropped a tier, because it asks for 60 pictures a second
and the phone gave 28; the look's strokes are sized in picture pixels, so every stroke was a blotch; a softening
filter (FXAA) ran on top; and the morning's tree ranges, right for a sharp small picture, stacked with the low tier's
and ended the wood a few dozen metres off. Built for that, all behind the look's switch:
- **The picture is not drawn small** (`render/index.js` `applySize`: every tier draws the whole canvas in the oil
  look; `main.js`: the controller's floor is 0.85 of the size on a phone or tablet, 0.8 on a desktop, and on a phone
  or tablet it asks for 30 pictures a second, not 60). **No softening filter on a touch device** in the oil look.
- **The lighter paint** (`shared.js` `uOilL.x`; on for touch devices, `?lite=0|1` pins it): the ground in two layers
  of dabs where it has three, no noise looked up for a dab's hue (`pcGroundAt`) nor for a plant's wash, the leaf
  shadow's pattern from one lookup where it had two, and none at all under a grey sky (`pcDappleS`). SEEN in stills
  at the phone's picture size: the same picture to the eye.
- **The ground's mesh follows the picture's height** (`terrain.js` `update`: `splitK`): 380,000 triangles where it had
  615,000 at the phone's size, most of which were smaller than a pixel. **The ground is drawn last** (`renderOrder`
  5), so that ground hidden behind plants is not painted where the graphics card can skip it.
- **Trees**: a tree's ranges are never under the middle tier's; the far trees reach the haze on every tier.
- **The speed test's second form** (`core/bench.js`): thirteen rows that are questions (the lighter paint against the
  full one; the ground one flat colour; the plants one flat colour; without trees, small plants, near grass, ground,
  water; without the light in the air, without shadows; half size; the low tier), and a header that says how the depth
  is kept (reversed or logarithmic: with the second nothing hidden is skipped, and the cure is another), whether the
  sun was out, the script's own time and the draw calls and triangles of a frame.
- **The rivers, second form** (after the owner's two sheets of rivers from the air; `surface.js` `_riversOil`, `_sfO`,
  `_sf3`): the main river is the line of a field four times as broad as the default stream's (`_sfO`; `oil.riverAt`
  moves it so that it passes the first landing): ONE long river, eleven to twenty-two metres wide and more in a pool,
  with pale SAND BARS along one side for stretches (`c.bar`: bare, no trees), a second arm round islands and a third
  that swings wide. Tributaries are TREES: side streams (the second field) that end at the river, thick where they
  join and a thread far from it, and their twigs (a third field, `_sf3`), which end at a side stream and are gone
  within a hundred metres of it. Drawn as maps in Node first.
**Not known:** whether any of this makes the phone fast enough; the second table is how that is found out. **Next, if
the table says so:** a sharp enlargement of a small picture in the last pass (the phone's screen is three times the
picture's size each way, and the browser's own stretch is soft); the plants' cost, which does not follow the picture's
size.

**After the phone's SECOND speed table (2026-11-16; the new code, 1028 x 480, the lighter paint; the log on `r2`
has the table).** With the plants in one flat colour the phone drew 61 pictures a second, as set 26: THE PLANTS' PAINT
IS 23 ms OF A 39 ms FRAME, nearly all of it the trees'. The ground's paint is 3 ms; the script 11 ms. Built for that:
- **A leaf's paint once a leaf** (`PROP_VERT`, under `PC_OIL`, after `vCardD`; `chunks.js` `PAINT`): a leaf card's
  colour, light and tone are worked out in the VERTEX shader from what is the same at all its corners (its centre at
  rest `cB`, its numbers `aData`, its tree `inst`, the crown's mass `aMass`) and handed on as `vLeafC.rgb` (toned) and
  `vLeafK.rgb` (its own colour, for the lantern); `PROP_FRAG`'s leaf branch only lays it and calls `pcLamp`. The
  paint's functions (`pcDensity`, `pcLevel`, `pcTone` and the oil look's keys) are the piece `PAINT`, which
  `FRAG_PARS` includes where they stood and `PROP_VERT` includes too; `pcDabTintV`, `pcWetWashV` are copies of
  `pcDabTint`, `pcWetWash` (keep them alike), `pcSunAtV` is `pcSunAt` with a leaf's own number where the fragment
  shader reads the noise outside the shadow map's square. `vCardD` and `vScaleO` ride in the two new varyings' fourth
  parts (`#define`), so the count of varyings is what it was. SEEN: the wood at the phone's size, the same picture.
  NOT YET per leaf: the bark's streaks and the far trees' crowns (painted across a surface, two layers of strokes
  each): the next table says what they cost.
- **The rivers flow** (`surface.js` `_riversOil`: `c.fu`, `c.fv`, the current in the place's two tangent axes, along
  the winning channel's line; tributaries toward the river; `sample` hands them on as `o.fu`, `o.fv`; `patchgen.js`
  puts them in the two spare bytes of the water's `aLiqP`; `WATER_VERT`/`WATER_FRAG` `vFlow`): the water's dashes are
  laid along the current and slid with the clock, in patches twenty-six metres across with wavy bounds; where two
  currents that disagree are blended (a meeting of waters) the water is laid still. SEEN from above at two moments:
  the dashes lie along the channel and have moved. Still wrong: a faint seam where two patches meet.
- **The version on the screen** (PILOT's `core/build.js`, `build.txt`): change both with every pull request.

**What is built, file by file.**
- `src/render/shared.js`: `LOOK.oil`; the dials `OIL.uOilA..uOilG`, `uOilPx`, the shadow map's uniforms, `uLamp`, the
  dab textures `uDabP`/`uDabId`, the light in the air `uShV`/`uSunV`/`uShaftC`/`uShaft` (each documented there);
  `SHADOW` (what the world tells the shadow map each frame); `register(material, kind, opts)`.
- `src/render/dabtex.js` (overhaul 3, "strokes baked"): the layer of leaf dabs laid ONCE at start-up as a tile of 32 x 32
  cells: `par`, a float texel a dab (place in its cell, turn, number); `id`, 32 texels a cell, the four topmost dabs
  that can lie on each texel. Checked against a brute-force search (the scratch tool `dabcheck.mjs`, described in the
  log): the top dab is among the four at 99.98 % of places.
- `src/render/chunks.js` (`FRAG_PARS`, under `PC_OIL`): the paint (`pcBody`, `pcTone`: lit, local and shade paints; the
  shade is two fifths a violet at its own value, measured against the clip; `pcGold`: the look's golden hours;
  `pcOilHaze`, `pcAtmosV`); the shadow (`pcSunAt`: the shadow map inside its square, the old pattern `pcDappleS`
  outside); the lantern's pool (`pcLamp`); the strokes: `pcDabLayer` / `pcDabHit` (the baked dabs: a pixel reads its
  texel and tries one or two dabs; a dab comes and goes WHOLE, asked at its own centre, and grows small before it
  goes; its edge is still drawn here, a pixel wide), `pcThin` / `pcThinLayer` (thin streaks: bark, the figure, water),
  `pcBrick` / `pcStrokeLayer` / `pcLay` (tiles with a light edge: snow worlds), `pcStrokeOct` / `pcStrokeOct4` (a
  stroke's size on the screen, in octaves of the distance), `pcGroundChart` with `pcGroundChartD` (its derivative, from
  a position measured from the eye) and `pcGroundUnchart` (a dab's exact place on the body from its centre's chart).
  RULE LEARNT THE HARD WAY: never take a screen derivative of `vBody` or of anything made from it (kilometres, known
  to half a millimetre: a tenth of the difference between two pixels is noise near the eye); use `vRel` / `vRelO`.
- `src/render/materials.js`: `TERRAIN_FRAG` has its own `main` under `PC_OIL`: tiles on snow worlds (`uGroundK.x`),
  else three layers of leaf dabs an octave apart LAID FROM THE TOP DOWN (a pixel stops at the first dab that covers
  it whole; a third of the finest layer is never laid, so leaves of three sizes show), each dab's paint worked out at
  its own exact centre by `pcGroundAt` and `pcGroundPaint`. `PROP_FRAG`: leaf cards (part 5: a leaf is one flat colour,
  lit whole at its centre `vCardB`), bark in thin streaks, far crowns in dabs; blades thinned by `uOilG.y`.
  `FIG_FRAG`, `NEAR_FRAG`, `WATER_FRAG`: thin streaks and the oil light.
- `src/render/shadow.js`: the shadow map (plants only, 2048 texels over 180 m round the eye, laid in the body's space,
  moved in whole texels), and what the light in the air needs.
- `src/render/post.js`: `_finishOil` and `OIL_FRAG`: the scene as painted, the glazes, last frame kept for the water,
  LIGHT IN THE AIR (overhaul 4: sixteen places along each line of sight asked of the shadow map; light added or taken,
  no neighbour read), the world's last key, a gentle S, the saturation lift. No brush, pooling, pencil or paper pass.
- `src/world/florakit.js`: `leafCards` (crowns, needles, saplings and floor plants as separate leaf-shaped pieces;
  attribute `aCard`), the slender tree forms (`spec.slender`; overhaul 5: nine boughs from under half the height, a
  fuller crown), grass as tufts and the near patch as two tufts, the fern as a low leafy plant (all only with
  `spec.oil`; the default kits draw the same random numbers as before).
- `src/world/flora.js`, `src/world/surface.js`, `src/data/looks/*.js`: a species' or a biome's `oil` entry laid over
  it in the oil look (form, bark, leaves, palette `pal`, undergrowth colours `under`, the wood's mix `tallMix`, the
  ground's laying `ground: 'tiles'`).
- `src/world/leaffall.js` (falling leaves), `src/world/sky.js` (the sky under `PC_OIL`: gold through the golden hours,
  the aurora in upright strokes, night dashes), `src/world/index.js` (the shadow's and the lantern's state, the air).
- `src/art/models.js` (`wandererParts`: hood, lantern, no jets; the flying pose; THE CLOAK IN STRIPS, overhaul 8:
  `cloakRow` hangs three rows of thin pointed ribbons over a dark lining, each one flat blue of `CLOAK_BLUES`, marked
  `dry: 1`, which `FIG_FRAG` paints as one flat piece with no streaks; a rim of light where the form turns from the eye
  on the sun's side), `src/player/explorer.js` (the flight: Space lifts, W goes where the view looks, C sinks, no fuel),
  `tests/flycheck.mjs`; the words and the touch buttons for the flight (`src/ui/hud.js`, `theme.css` `pc-t-wing`,
  `src/core/game.js`, `sim.js`: all behind `MODE.wanderer`).
- THE NIGHT (overhauls 6 to 8, after the clip's night frames): a world's own night keys in the oil look
  (`look.oil.night`, read in `world/index.js blendKeys`; Neptune's is a deep green-blue: nothing in the clip's night is
  violet); the shade's hue is the cool key's own (`pcTone`: a plum by day, a deep blue by a teal night); snow in long
  strokes that run with the land (`TERRAIN_FRAG`, `uGroundK.x`, a look's `oil.ground: 'flow'`; the outlined tiles are
  gone from the ground, `pcBrick` is unused); the aurora in thin pointed strokes with a level foot (`sky.js`); the
  lantern's pool in rings of orange, yellow and yellow-green strokes and the wanderer's own shadow in it (`pcLamp`,
  `uLampF`); by night what is warm is kept out of the night's cool key (`OIL_FRAG`).
- THE FIGURES' REAL SHADOWS: `shadow.js` draws whatever is marked `pcCaster` and is moved by bones (`uPart`) into the
  shadow map with those bones; `pcCast`'s soft blot gives way while the map is on.
- WATER (overhaul 7, first pass): long thin dashes that carry the sky's colour, a path of broken marks of the light
  toward the sun or the moon, and by night under an aurora a share of them its green (`uAuroraK`). Seen only as the
  wood's stream, which was pale and faceted with short dashes (they are long and thin since; not yet seen again). In a
  still there is no last frame, so the stream shows no reflections; the game keeps one (`post.js _finishOil`).
- THE SKY (overhaul 6): by day flat bands from the horizon to the zenith with wandering edges (no wash turbulence, no
  backruns: they were smudges and rings in opaque paint); clouds flat shapes with clean edges, two tones by day, one a
  step lighter than the sky by night; the night sky two layers of dense fine streaks.
- AFTER THE INDEPENDENT CRITIC (2026-11-16; the log on `r2` has its findings one by one): the ground's strokes ask a
  SMOOTHED shadow (`pcSunAtSoft`: the shadow map taken down, `uShAir`; plants and the base still ask the fine map), so
  the canopy throws masses and pools, not a spatter of single lit dabs; a dab never comes under 0.58 of its size (the
  youngest dabs were dots); dabs are laid larger at a low angle (`graze` in `TERRAIN_FRAG`: a hatching of lines a pixel
  high on a far level floor); the wood's palette moved toward gold and its shade to a violet umber; bark dark, lit by
  the sun only, in long streaks; the air's reach 2.7 times the watercolour's (was 4) and the glow toward the sun 0.5
  (was 0.8); a conifer one tree in thirty in the autumn wood (`oil.tallMix` 1.5); six-cornered leaves on small plants
  (`leafCards` `round`); the figure's light in flat half-tone steps; the cloak six tiers of short narrow strips in a
  wider bell; the aurora one ribbon of flames (since replaced: see the owner on the checkpoint); the tundra a pale snowfield (`oil.pal`)
  in long strokes with a slow wide bend (`pcThinLayer` with a negative bend).
- `tools/lab.mjs`: the look lab (see its header): one long-lived headless page on the painter's gallery. In software
  GL the first frame after a load compiles the shaders: eight to eleven minutes at 1280x720; every frame after takes
  20 to 60 s. **A background process is stopped by the session after two hours:** start the lab inside the job that
  needs it and close it at the end. `swap` crashed the page once; a reload is the safe way.

**Checks:** unit 251 of 251 and world 47 of 47 on the tree with overhauls 3 to 5 (the default look's code paths are
behind `#ifdef PC_OIL` / `LOOK.oil` and unchanged). Not yet run on the oil look after its flicker treatments: the
station numbers (`tests/stations.mjs --query look=oil`), `tests/all.mjs`.

**What the software renderer cannot tell.** How fast the look runs on a real graphics card, and how it looks in
motion. The baked strokes cut the stills' time here by nought to a fifth only, because this machine's frame is mostly
other work (the shadow pass, the leaves' vertices); the pixel's own work on the ground fell from 36 dabs tried and two
layers shaded to about two dabs and 1.3 layers. Only the owner's desktop can say whether it plays.

**OVERHAUL 9, every world (begun 2026-11-16 with a survey: thirteen biomes on ten worlds drawn from one page, the
scratch tool `survey.sh`, described in the log on `r2`).** Most worlds already held up in the oil look with no settings
of their own (the colour model, the strokes and the shadows are general). What the survey called for, and where each
is set:
- a world's share of the look's golden hours: a look's top-level `oil.gold` (1 on Earth; 0.33 where none is given),
  read in `world/index.js` into `OIL.uOilG.w`, used by `pcGold()` and the sky. With the full gold everywhere every
  world's sky was the same cream at a low sun.
- every `broadleaf` species, on every world, has its crown in leaves one by one in the oil look (`flora.js` adds
  `leafy: 1, double: 1`; `florakit.js birchGeometry` `leafy`: the tree's own form, `leafCards` where it had `blob`s).
  A species' `oil` entry may still make it `slender` (Earth's three).
- the ground's laying, per world: a look's `oil.ground: 'flow'` (long strokes that run with the land): Uranus, Pluto;
  `'snow'`: Neptune (the owner, 2026-11-16: "I also dont like how Bright the snow area is why is the snow colorful fix
  it and shade it the color of ice and snow and make the lines closer to the ice in the reference"): short broad knife
  strokes in slow swirls, and where the ground's wash is pale the stroke's paint goes through `pcIce` (`TERRAIN_FRAG`):
  its value picks from ONE ramp of ice colours (deep blue, slate, pale blue, blue-white), darker by night, each stroke
  its own value, one in ten a step paler, and it never strays toward a warm colour. Everything else is leaf dabs.
  DO NOT let snow take `pcDabTint`'s warm and cool straying again: on near-white it is a pastel confetti.
  SNOW IS SMOOTH (the owner's LAST word on it, 2026-11-16, with two pictures described in `docs/references/README.md`
  on `r2`: "make the snow lines thinner and more frequent and get rid of the deep ridges between them it looks like
  tiles make it closer to this photo"): thin strokes, many and close (eleven times as long as wide), each flat with a
  clean edge and differing little from the next, NO ridge or dark line between them; a slow shading from drift to
  drift read at the stroke's centre (`pcIce`'s `dr`, from `pcFlowPaint`). The relief described next (`pcImpasto`) was
  the answer before that and is GONE; `pcSnowLayer`, the exact placement, stays.
  THE CLIP STILL COUNTS (the owner, right after: "but still use the reference video as well"): the pictures are added
  to the clip, not put in its place. On snow the clip gives the night's colours, strokes one can see sweeping in arcs
  and the lantern's light (`pcLamp`: a quiet cream-gold that dies away over five metres through whole strokes, no ring,
  no pure orange); the pictures give thin, many strokes with no ridges and the soft shading. `pcIce`'s stroke-to-stroke
  difference sits between the two on purpose.
  THE TREES OF THE SNOW (the same message: "start adding trees like this as well in the snowy areas"): kinds that
  exist only in the oil look. `src/data/mode.js overlayOil` (called once from `render/shared.js` when the look is on)
  appends a look's `flora.tallOil` to its `flora.tall` and lays a biome's `oil.over` over the biome (`tallOil: [a, b]`
  there names two of those kinds). Neptune's `aurora_tundra` has a FIR (`kit: 'conifer', fir: 1, snowy: 1`:
  `florakit.js firGeometry`: tiers of needles one by one with snow lying on them, pale pieces of their own, part 6) and
  a BARE TREE (`kit: 'broadleaf', bare: 1`: `bareGeometry`: a stem, forking boughs, and twigs as thin slivers one by
  one, painted in the kind's "leaf" washes). In `PROP_FRAG`: `uOilKind` / `uFarKind[]` (1 snowy: what faces up on the
  far tree is snow; 2 twigs: no leaf strays, no light through, the far tree a thin haze), part 6 in snow's colours, and
  a ragged WINDOW in a tree's leaves within a few metres of the eye (`vCardD`: a leaf at the lens was a slab across the
  picture). To give another snowy place these trees, add the two kinds to its look's `tallOil` and an `oil.over` to
  the biome.
  (WITHDRAWN, kept for the record) SNOW AS PAINT LAID ON (the owner, 2026-11-16: "make the snow strokes look closer to the reference like its actually
  been painted on the ground"): each stroke is a slab with a bright ridge along one long edge, a dark line along the
  other, the brush's hairs down its length and an uneven end (`pcImpasto`, `pcThinR`'s `rag` and `uv`), and it sweeps
  in arcs. A stroke is lit, shaded and lamp-lit WHOLE, so its centre must be the same to the millimetre from all its
  pixels: `pcSnowLayer` reads the swirl's noise exactly (`pcBend8`: eight texels, a smooth weight, its slope from the
  same eight) and finds the centre by Newton's rule on the plain chart of the sphere. Found from each pixel by the
  chart's screen derivatives (`pcThinLayer`, still used by bark, the figure, water and the ice worlds' ground) the
  centre differs from pixel to pixel near the eye, and every edge decided at the centre is a stipple of dots there.
- THE NIGHT SKY'S STREAKS (the owner, same day: "the patterns in the sky" as the reference's): long, thin, nearly
  straight streaks drawn to a point at both ends, in four families, each a set of level lines about an axis that leans
  a little from straight up, so that two families cross at a shallow angle (`sky.js`, under `PC_OIL`). Short dashes in
  bent rows were curls and worms.
- a biome's `oil.pal` (its colours given outright as paint), `oil.under` (undergrowth colours), `oil.tallMix` (the
  wood's mix of kinds): the autumn wood, the green wood (the game's first place), the aurora tundra.
- a world's own night: a look's `oil.night` (Neptune's teal).
- space is laid in flat shapes with clean edges (`sky.js`, under `PC_OIL`): as washes it was the one soft, blotted
  thing left (the Moon's sky).
To give another biome its own colours, copy the pattern of `autumn_woodland` in `src/data/looks/earth.js`.

**Not done yet (the overhaul plan's order).** Overhauls 6 to 8 have a first pass each (above); what is still owed in
them: the sky by day against an open horizon and the night sky's streaks judged in stills; water judged in stills
(a lake by night, the stream in the wood), a foam line at the shore; the lantern's own glow in the air. 9 every world
by the pattern of the autumn wood and the aurora tundra; cliffs and strata in strokes (a boulder is planes of flat
paint now, `PROP_FRAG`'s rock branch under `PC_OIL`, built but not yet seen in a still; a crystal goes the same way
and wants its own look); flowers are big star-shaped pieces; the view from the air; PHYSICS' kits (`src/render/kitmat.js` is not registered); the README still says
"jetpack" (to be changed when the look goes live); the play-tests still fly the old explorer.

**Known faults.**
- From the air the far crowns are lumps with flat facets and clearings a flat yellow: the far tree (`PC_FAR`) and the
  far ground are not the look yet.
- The snow's long strokes (and bark, the figure, water: every `pcThinLayer`) bend their chart by a slow noise and carry
  a stroke's centre by derivatives: a stroke at a shadow's edge may come out in dots, as the dabs did before their
  centres were made exact. Not seen on the tundra (few shadows there).
- The ground's chart has a seam along the twelve edges of the cube, and a crown's chart one where the axis its mass
  faces most changes: strokes are cut straight there. Not seen in the prototype's scenes.
- The dab tile repeats every 32 cells: only places and shapes repeat (colour and light come from the world), and it
  has not been seen in a still.

## Hand-over of RELEASE 1, RE-FIX pass of the PAINTER lane (the watercolour; kept current after every item)

The verifier did not accept W2.1, W2.2, W2.4, W2.5 and listed nine regressions (the task text of this pass; its evidence
under `/home/user/.pc-scratch/verify/r1-painter/`). This pass fixes them with proof, or shows by a measurement why a
finding does not hold, and says plainly what is not fixed. Began 17:00 UTC 2026-11-14 on head `3cd414b`.
Commits: `5faee9f` (part A: post.js, index.js, shared.js, tests), `55fb1c2` (part B: chunks.js, materials.js),
`26ea990` (part C: post.js, the laid targets laid again after any resize; it also carried the first evidence files), then
notes. My first commit's parent: `ca3a56a` (PILOT's).

Scratch: `/home/user/.pc-scratch/painter/r1/rf/`. `bin/lab.mjs`: one browser on PILOT's station page, kept open while a
series of commands runs (each command a Node module in `cmd*/`, its result in `cmd*/*.out`, the log `lab*.log`);
`bin/abhelp.mjs`: the head's Post (a copy of the head's post.js put into the lab tree only, as `post_head.js`) run on the
same held scene as the new one: exact before/after of the post passes; `bin/mhelp.mjs`: PILOT's metrics on captures;
`node/b2truth.mjs` (bands of frames), `node/blurpal.mjs` (the guard's palette rule on a blurred final). Runs: `cmd/` (lab
1, on the head plus the first code), `cmd2/` (lab 2, the near-final code), `cmd4/` (lab 4, `55fb1c2`), `cmd5/` (lab 5,
`26ea990`), `cmd3/` (the phone run, iPhone 14 emulation, the controller free); the station runs `st-final/` (PILOT's
harness on a clean export of `26ea990`, guard `st-final/guard.txt`) and `st-final-55fb1c2/` (before part C).

**STATE:** done (22:00 UTC). All code committed (`5faee9f`, `55fb1c2`, `26ea990`); nothing of mine is half-done in the tree.
Checks on a clean export of the code: world 47/47, unit 251/251, physics 325/325, coast.mjs PASS at both stands,
ghostfield.mjs 6 of 6 all zeros (physics, coast and ghostfield on `55fb1c2`'s code; `26ea990` touched post.js and a
world test only, world and unit rerun on it). PILOT's harness on a clean export of `26ea990`, all 25 stations, q2
1280x720, `--alias --flicker --taps`: `st-final/`, no page problem; guard against the baseline
`docs/shots/painter/r1/rf-guard-26ea990-vs-784183b.txt` (38 flags at 18 stations, every one a "look" flag: the colour
of small regions and the L* percentiles, below; no detail, false-sharpness or cost flag), every number
`docs/shots/painter/r1/rf-table-26ea990.txt`, frames before/after opened (`rf-before-after-q2-1280.jpg`,
`rf-1km-dashes-before-after-3x.jpg`: the verifier's head run against `st-final-55fb1c2/`, made before part C, whose
numbers agree with `26ea990`'s to the second decimal at every station).

### W2.1 the prefilter (verifier: A at the 0.6 lines, the old-brush mean at 1 km, the 1:1 dashes, the b2 floor)
- **The 1 km dashes are in the design, not an aliasing left over.** A 16x supersampled render of the marks as drawn (W2.1
  off, 4x each way, box-filtered down: `w21/E_1000_*_truth4x_v1.png`, `cmd/008-truth`) shows the same hatch. It is the leaf
  shadow's 13 m channel (its noise cells 3.25 m: one or two pixels from 1 km): knocked out, the hatch is gone; the 4.1 m
  channel eased to its mean, unchanged (`cmd/004e`, `w21/`). **Fixed in the design** (chunks.js pcDappleOct, `55fb1c2`):
  past 500 m the 13 m channel is laid at twice its size for each doubling of the distance (the terrain's brush marks keep
  their size on the sheet the same way), the two sizes cross-faded, each thresholded on its own (the share of sun the same
  at every size), read with the place's own gradients (textureGrad: the scale steps with the distance); under 500 m
  nothing changes. The 4.1 m channel eases to its mean from 0.20 to 0.40 of its repeat a pixel (from 0.12-0.30 first:
  that raised A at E_400_90, 0.2925 -> 0.3052; at 0.20-0.40 it is unchanged there). Frames opened at 1:1 and 3x
  (`w21/E_1000_*_a26_v0.png` against `_asis_`, and the station run's): flecks of a few pixels, no rows of dashes.
- **A** (raw, lab 2 `cmd2/104-oct`, against 2x box): E_1000_90 0.3205 -> **0.210** (line 0.3198), E_1000_45 0.3789 ->
  **0.249** (line 0.3778); E_400_90 **0.293, NOT MET** (line 0.2412). What E_400_90's A is made of (`cmd/004b-amap`):
  77 % of the error energy on the ground, a fine speckle along the leaf shadow's ragged edges at 0.65 m a pixel, which the
  2x render resolves. Tried: the leaf shadow knocked out (A 0.63: the reference has it), its far octaves from 350 or 300 m
  (A 0.356, 0.372: worse), every mark's threshold read on a footprint 1.5 or 2 times wider (0.268, 0.263, at the cost of
  lapvar 345 -> 278 and b2 39.9 -> 38.8), wider thresholds (k 5: 0.289). None reaches 0.241; left.
- **b2 floor (rule 1) at 1 km: met with the far octaves** (lab 2): E_1000_90 raw b2 33.6 (floor 0.95 x 26.7 = 25.4),
  E_1000_45 25.5 (floor 21.3), E_400_45 26.8 (floor 25.7). And the finding's reference: the 16x supersampled design has b2
  23.7 / 21.2 / 25.9 at E_1000_90 / E_1000_45 / E_400_45, the baseline 26.7 / 22.4 / 27.0: the baseline's extra b2 was
  aliasing (the truth itself fails the floor at 1 km); the head's raw had been within 3 % of the truth. With the octaves the
  new design's 16x truth (`cmd2/105-truth`) has b2 33.4 / 25.9 against today's 33.6 / 25.5: no aliasing energy left.
- **"Final frames change by at most 1/255 on average under today's brush": not met, and it should not be.** The old
  brush's final at 1 km carries the aliasing's bias: the 16x supersampled design is darker than the baseline by 4.2-5.5
  levels (R G) at 1 km and 2.3-2.6 at 400 m (`cmd/008-truth`, mean RGB over the land); the head's W2.1 lay between them.
  With the far octaves the raw land at 1 km is 3-4.5 levels under the baseline and within 1-3 levels of its own 16x truth
  (`cmd2/105-truth`). The plan's own W2.1 colour rule (raw land dE76 at most 2): met: raw land dE76 at most 1.63 (E_1000_45; 1.44 at E_1000_90, 0.64 at E_400_45, under 0.3 elsewhere). The
plan's "raw b3 within +-10 %": E_1000_90 +11.6 %, E_1000_45 +4.0 % (up: the far octaves' flecks are coarser than the
hatch; within 1 % of the new design's own 16x truth), elsewhere within 1.6 %. E_foot and E_50_45 raw b1/b2: -4.6/-0.8 %
and -3.6/-0.7 % (within 5 %).

### W2.2 the brush (verifier: night t2, halo, palette, L*)
- **Halo of the abstraction output: fixed.** It was all the wet-in-wet bleed (bleed off: 0.000 %). The bleed keeps its
  colour but its step in value is capped at 6/255 (post.js ABS): E_1000_45 0.70 % -> **0**, storm 0.82 % -> **0.003 %**
  (`cmd/002d`), the mean colour of the output within 0.1 level, the abstraction output's t2 up (0.89 -> 0.93 at 1 km);
  frames opened (`halo/`): the far mountain's wash as before, the storm's crowns a little crisper. Station run: the abstraction output's halo share is 0.000 % at 22 stations, 0.001 % (S_150_45), 0.003 % (storm), 0.005 %
(E_foot_night).
- **Night t2: fixed.** The night's last glaze (0.70, 0.76, 0.94 on Earth) darkened the whole sheet, the marks with it
  (grade set to 1: t2 0.935; `cmd/003-night`). The glaze is laid over the broad washes only (the pooling's surround) and
  the detail weighted twice (it still holds part of the 6-16 px band): E_150_45 night t2 0.70 -> **0.936**, t1 0.99,
  land dE 1.71 (`cmd/002f`); by day the grade is 1 and nothing changes (the A/B is 0 there). Frames opened (`night/`):
  the wood and its gaps readable, still the nocturne's indigo. Station run: E_150_45 night final land t1 1.02, t2 **0.94** (was 0.70), land dE76 0.80 against the baseline (dusk 1.08/0.98).
- **Palette (mean colour per region within dE 3).** The moves come from the brush turn, not from the raw scene or the
  palette: the OLD brush and sheet laid over today's raw scene give the baseline's colours (E_400_90 land 0.31, ground
  0.52, foliage 0.22, water 0.13; M_150_90 props 0.12, foliage 0.06; `cmd/006-palette`). Of what the sharp picture moved,
  the edge pooling was most: over the sharp picture every small mark took the wide pool and the rim. **Changed:** the wide
  pool from a step of 0.02 up and the rim from a gradient of 0.10 (post.js SHEET): E_400_90 land 2.90 -> 1.54, ground 3.04
  -> 2.0, foliage 3.28 -> 2.28, E_1000_90 land 3.29 -> 2.27 (`cmd2/106-pool`), t1/t2 still 1.09-1.16; frames opened
  (`w21n/*_pool_*`): the same picture a shade lighter. Station run: every land, ground and foliage region on Earth within 3 (E_400_90 land 1.54, ground 2.00, foliage 2.27;
E_1000_90 land 2.28, ground 2.25; were 3.10, 3.23, 3.41 and 3.3); over 3 only regions of 0.06-1.25 % of the frame:
E_400_90's stream (963 pixels) 4.30, E_50_45's props (1,416) 4.19, M_150_45 props/foliage (549/858 pixels) 10.9/9.2,
M_150_90 (1,161/831) 13.4/12.4, S_150_45 foliage (2,515) 13.5, N_150_45 foliage (11,508) 15.5.
  **Not changed (shown not to hold as a palette shift):** small regions (Mars props/foliage 13-16, Saturn and Neptune
  foliage 16-18, E_50_45 props 6.7, E_400_90's stream 4-5): a few hundred pixels at class edges whose baseline colour was
  the neighbours' colour the old brush smeared in (the old brush over today's raw gives 0.06-0.13 there); and the L*
  10/50/90 percentiles: a picture with t2 near 1 has a wider spread of values than one at t2 0.2 by its nature (L10
  darker, L90 lighter, L50 within 1-3); blurring today's final by a 3 px Gaussian brings most stations within 3
  (`node/blurpal.mjs` on the verifier's st-head-q2: E_150_45 3 flags -> 0, E_400_45 2 -> 0, E_1000_45 3 -> 0, dusk 3 -> 0,
  night 3 -> 0). The rule t2 >= 0.95 and the rule L* within 3 of a blurred baseline cannot both hold.

### W2.4 post savings (verifier: sheet reads 19 > 11, post reads, the 8-bit path not run)
- **The sheet reads 9 times a pixel** (10 by night, under a storm or a world's glaze; was 19): the paper laid once per
  size into three targets (half floats: the tremor and the border's terms; ph pmidR ploR skD; 8-bit: the grain's four),
  three fetches (were two fetches and two live reads); the washes' value at a few pixels, its surround and its change in x
  and y from a new half-size pool pass (two reads, were seven); the outline test and the pencil's line from a new edges
  pass at the scene's size (two fetches, were six reads of the region target; the line is precomputed four ways and the
  sheet picks the one its old reads 1.5 texels over gave: `src/world/sheetreads.test.mjs` proves the pick on 20,000
  random points); the region where the picture is read only where something reads it (night, storm, lightning, a world's
  glaze). A first version packed the paper into one RGBA32UI word (one fetch): PILOT's read counter has no overload for an
  integer sampler and the instrumented sheet failed to compile (console error), so float targets it is.
- **Post reads a frame** (lab 2 `cmd2/101-ab`, 1280x720 q2, per output pixel): near stations E_foot 30.98, E_50 31.2,
  E_150_90 31.3, M_50/M_150_90 30.5 against the baseline's 30.5 plus W2.5's region pass (1.0-1.5): within it at every
  station (margins 0.5-1.0); far stations E_400_90 23.3, E_1000_45 23.0 (-24 %, the plan asked about -22 %); E_150_45
  28.7 (-6 %). The brush's two paper reads are laid once per size in full floats (one fetch at near pixels, was two; in
  8 bits the bleed's colour, a ratio of two small sums where a wash is barely wet, moved visibly: lab 2 `101b`, `101c`),
  and the bleed is not read where the pixel is dry. Station run: post reads a frame (M at 1280x720; baseline 28.11 at every station, the verifier's head in brackets): E_foot 28.55
(32.65), E_50_45 28.73 (32.88), E_150_90 28.83 (32.98), M_50_45 28.17 (32.31), M_150_90 28.13 (32.28): +0.1 to +2.6 %
over the baseline, each under W2.5's region pass (0.9-1.35 M); E_150_45 26.44 (-6 %); 400 m and 1 km 20.7-21.5 (-24 to
-26 %, the plan's -22 % met there, not at the near stations). Sheet 9 reads a pixel (10 by night, dusk and storm); no
keep pass at the eight Mars stations.
- **The same picture?** The restructure is exact but for the half-size pool (lab 5 `cmd5/501`, the committed code at
  `26ea990` against the head's post.js of `3cd414b` on the same held scene, this pass's intended changes (the bleed's cap,
  the pooling's two floors) patched out of the new): with the pool's three values read as the head read them, within
  1/255 everywhere but 1-2 pixels a station (max 1-4/255; one pixel at 25 at M_foot, 8 at S_150_90), mean 0.002-0.005;
  as committed, the pool's values interpolated between half-size texels differ from the head's exact reads: mean 0.26
  (E_foot), 0.34 (E_50_45), 0.47 (E_150_45), 0.59 (E_400_90), 0.17 (E_1000_45), 0.09-0.13 (Mars, Saturn, Neptune),
  0.2-1.7 % of pixels over 2/255, a few hundred over 8/255 (max 38-71) at edges (`ab5/*_diffx32.png`). The pool's lod 0.6
  is 60 % the quarter-size level, whose bilinear kinks fall between the half-size texels, so no half-size table of it is
  exact; the exact reads cost five more reads a pixel, which the near stations' budget has not got. **NOT within 1/255
  everywhere**; the frames side by side are the same picture (`docs/shots/painter/r1/rf-before-after-q2-1280.jpg`).
  Found on the way (part C): the brush's paper (and the sheet's) were keyed by size, so a size changed and changed back
  with no frame between (the harness's settle at every station) drew with cleared targets; laid again after any resize
  now (test in postsave.test.mjs), and the baked brush paper then equals its live reads in effect (`cmd5/502`: 0).
- **The 8-bit fallback, run in the browser** (lab 2 `cmd2/107-fallback`: a second Post built as on a machine without
  float targets, the same as `?float=0`, the held scene drawn through it): no console error, its sheet reads the paper
  live (12 reads), frames opened (`fallback/`): the same picture as the float path's, a mean of 0.2-2.0/255 from it (8-bit
  region, depth and pool by design).

### W2.5 anti-aliasing (verifier: raw b1 within 5 %, F at most 0.8 x, post AA not built)
- **Post AA built** (post.js FXAA_FRAG, index.js): FXAA's nine reads a pixel of the scene on the abstraction output,
  where no samples are drawn: tier 0, a touch device (coarse pointer), `?aa=post`; at a desktop tier the MSAA budget
  failing (4K) falls back to it too. Its edge threshold is FXAA's own (an eighth of the brightest, at least 1/16).
  `painter.info.postAA`, `painter.aaMode()` ('msaa 4x' | 'post (fxaa)' | 'none': PILOT's read-out reads it). q0
  (`cmd2/103-postaa`): the final's F E_foot 0.411 -> 0.364, M_foot 0.372 -> 0.298, E_150_45 0.099 -> 0.092; frames
  opened at 3x (`postaa/`): the hat's brim and the figure's outline lose their stair-steps. The raw scene's F cannot move
  (the pass is after it). Phone run (`cmd3/201-phone`, iPhone 14 landscape emulation, the real game with the controller
  free, no pins): `painter.aaMode()` 'post (fxaa)' and info.postAA true at every sample, aa 0.
- **Raw b1 within 5 %: shown not to hold as a loss.** Against the supersampled reference (one sample at 2x, box-filtered
  down; `cmd/005-b1`): MSAA's b1 is -5.1 % (M_foot), +1.8 % (S_150_90), +4.9 % (storm), +4.3 % (N_150_45) from it; one
  sample is +0.8 to +10.4 % above it. The baseline's b1 was aliasing energy; at M_foot MSAA does lose 5 % in the 2-6 px
  band to the outlines of Mars' stones (the reference keeps more of the ground's own texture at its half footprint).
- **F at most 0.8 x the baseline raw's: NOT MET** at 9 of 22 air stations (station run: E_50_45 0.359 against 0.325,
  E_50_90 0.343/0.309, E_150_90 0.286/0.278, M_150_45 0.254/0.250, M_400_45 0.114/0.111, dusk 0.330/0.325, storm
  0.392/0.375, N_150_45 0.424/0.400, E_150_45 night 0.318/0.317; E_150_45 on the line, 0.334). The props' light steps prefiltered (pcLevelF)
  change raw F by 0.3 % (`cmd/007`); what flickers is the crowns' leaf cut-outs, discards, which MSAA cannot smooth.
  Alpha-to-coverage would, but it takes its coverage from the colour target's alpha, which is the wetness: moving the
  wetness out of it is a change to every material's output and to the post's reads; left for W7.

### The regressions
1. Post cost at near stations: fixed (W2.4 above).
2. Final F at 50-150 m: shown to be the raw's. The final's F is the raw's or under it (E_50_45 0.33 against 0.36 raw;
   `cmd/007b`); the wobble switching at edges adds nothing (an even 0.3 px wobble: the same F), the fine pooling 4 %
   (pooling off: 0.321). The old brush's final scored 0.25 because it blurred the detail the raw scene draws.
3. Colour past the guard's bounds: see W2.2's palette above (the large regions fixed, the small ones and L* shown).
4. b2 below the floor at 1 km: fixed by the far octaves (W2.1 above), and the finding's baseline was aliased.
5. The 1 km dash and hatch: fixed in the design (W2.1 above).
6. The halo share: fixed (W2.2 above).
7. The old brush in play: fixed (index.js). The old brush and sheet only where the URL pins the resolution (`?scale=` or
   `?dynres=0`: the tests' pinned low runs, unchanged); the resolution controller's low steps draw the new brush's picture,
   enlarged by the soft cubic. Phone run (`cmd3/201-phone`): the controller went q1 x 0.79 (592x269 for 937x425) and
   then q0 x 0.5 (290x132), uBrushR.y 0 and uSheetOld 0 at every sample (the new brush); the frame
   (`phone/game-phone.png`, opened): the figure, trees and ship clear but soft, a 3.2x enlargement of a 290x132 picture
   (the old blots are gone; the softness at this scale is the resolution's, which W6's floor at 0.67-0.75 addresses).
8. No AA on phones, tablets, tier 0: fixed (post AA above).
9. (a) The keep pass's first frame: the keep pass runs on a world once its water has been drawn there, every frame while
   the eye stays on that world (PREV.body from the mood, shared.js), so water coming back into view reflects at once;
   Mars never keeps it (the station run's taps: no keep pass at the Mars stations). Only the first water a world ever shows
   (or the first frame after a resize) reflects nothing for a frame. Test: postsave.test.mjs. (b) The AA budget is
   reckoned on the tier's full size, not the controller's current scale: at 1920x1080 q2 two samples at every scale, the
   multisampled target resized, not rebuilt (aaregion.test.mjs).

### For other roles and the lead
- PILOT (the harness): `tests/stationlib/inpage.js` names the new passes 'pool', 'edges', 'post-aa', 'brush-paper',
  'paper-bake'; the counter has no overload for integer samplers (usampler2D/isampler2D), which is why the paper is not
  one RGBA32UI fetch; adding `pcTapFetch(highp usampler2D, ivec2, int)` returning uvec4 would allow it later.
- PILOT (W6, the controller): `painter.aaMode()` for the read-out; the MSAA samples no longer change with the render
  scale; post AA where no samples. The old brush is no longer reachable from the controller (only the URL pins).
- The lead: E_400_90's raw A (0.293 against 0.241) and the canopy stations' raw F are this lane's misses; the reasons and
  what was tried are above. The guard's L* percentile rule and its small-region colours flag the sharp picture by its
  nature (measured above); a minimum region share and a percentile rule read on a blurred copy would judge colour, not
  sharpness.

## Hand-over of RELEASE 1, part 2: W2.3, W2.4, W2.5 (the lane's part 2; the re-fix pass above supersedes it where they differ)

The plan: `docs/lead/SHARP-SMOOTH-PLAN.md` (W2 items 3-5, section 5). Part 1 (W2.1, W2.2) is the section after this one.
Began 10:50 UTC 2026-11-14 on head `e87f6be`. Scratch: `/home/user/.pc-scratch/painter/r1/` (`trees/`: the exports I
measured, base plus each item's files and clean exports for the checks, deleted at the end; `w23/bench.mjs`
the Node world bench for W2.3; `bin/ab.mjs` the in-page A/B driver on PILOT's harness page (`--mode under`: the frame as
drawn against the same held frame with every undergrowth mesh the range test left out shown; `--mode post`: this tree's
post passes against the BASE tree's sheet and backdrop on the same held scene; `--mode msaa`: the region view with MSAA
and the rule against the same view drawn with one sample), `bin/basesrc.mjs` (a tree's post shader sources from its own
Post class), `bin/runcmp.mjs` (two station runs: cost and frames), `bin/diffimg.py`; runs `st-w23`, `ab-w24`, ...).

**STATE (end of part 2): W2.3 `f9cf6fe`, W2.4 `fb40efe`, W2.5 `d22ea35`, all COMMITTED.** Nothing of mine is half-done
in the tree. What was not met, and why, is with each item's numbers and gathered in "For other roles and the lead".
Final checks on a clean export of `d22ea35` (with PILOT's W3.3, `trees/final`): world 43, unit 234, physics 325,
coast.mjs PASS at both stands, ghostfield.mjs 6 of 6 all zeros; the real game from that export (`tools/shot.mjs`, q2
pinned, 960x540): no console error, `__pc.info().fallback` empty, `painter.info.aa` 4, depth 'reversed-z'; its frame
30 s after ready OPENED (`docs/shots/painter/r1/w25-final-game-q2-msaa.jpg`: the spawn as it should be; a frame taken at
ready is pale, the arrival's picture still coming up from the paper).
My first commit's parent: `77b9d9e` (PILOT's, made after I began on `e87f6be`).

### W2.3 free wins: what was done (src/world/flora.js, src/world/index.js; test src/world/undergrowth.test.mjs)
- **Undergrowth and grass cells by the distance from the eye, at every height.** Their strokes are drawn only while the
  root is nearer than the mesh's reach (PROP_VERT: `uLod.y x (1 + (seed - 0.5) uLod.z)`, at most `lod[1] x (1 + lod[2]/2)`
  times the tier's range scale: grass 43.5 m, ferns 137.5 m at q2), yet the cells were picked on the ground under the
  eye, built only below 400 m and never let go above it: from the ship at 150 m every one was built and submitted for
  nothing, and at 1 km the cells of the last low pass stayed. Now `_wanted(..., reach)` keeps the old walk at the ground
  but wants a cell only while its ground (origin) lies within its reach (the old radius: reach + margin) of the eye
  itself; beyond reach plus the old margin a cell is let go at any height (and taken off the build queue). The walk
  is skipped while the eye is higher above the ground under it than reach + 250 m (RELIEF: a hill that high within the
  reach is a cliff). Where cells were looked at and not wanted, their places are cached (`_origins`, cleared past 4096).
- **A mesh is submitted only while a stroke of it can be seen** (`_showUnder`, every frame and on release): the box round
  its roots (`rootC`, `rootR`, made with the instances) against its reach; where the box straddles the reach, root by
  root. Held cells stay hidden, the bushes stay out at tier 0 (as before).
- **The forced matrix walks**: `world.update` called `root.updateMatrixWorld(true)` for the active body and again for
  every body, every frame: two forced walks of every mesh (the renderer walks them again before it draws). Now
  `root.updateWorldMatrix(true, false)`: the root's own matrix (game.js already sets it each frame); its meshes are
  brought up to date by the renderer, as before.
- **Not done: "upload only the per-patch uniforms instead of uniformsNeedUpdate"** (terrain.js, flora.js). Three r187
  offers no way to upload a few uniforms of a program from onBeforeRender (it runs before the program is bound), and its
  setters cache every value, so the flag costs a walk of the material's uniform list in JS, not GL calls. Left; not in
  this part's brief.

### W2.3 numbers
- PILOT's harness, q2 1280x720, all 25 stations (`st-w23`, the head plus these files) against W2.2's run (`st-w22d`):
  draw calls / triangles at E_1000_90 442 / 669,284 -> **139 / 233,608** (plan: at most 160 / 260k; the lead's
  reproduction 138 / 233,607); E_150_45 451 / 910,624 -> 283 / 655,924; E_150_90 493 -> 232; E_400_90 539 / 822k -> 236
  / 387k; E_foot 463 -> 414 (meshes with no stroke in reach were drawn on foot too); M_150_90 238 -> 158; S_150_90 372 ->
  251; N_150_45 312 -> 188. Every station fewer or equal (`docs/shots/painter/r1/w23-cost-and-frames-vs-w22.txt`).
  Final land t1/t2/t3, raw lapvar and the bands the same at every station to the harness's two decimals.
- Node world bench (`w23/bench.mjs`, q2, Earth, budget 5 ms; `docs/shots/painter/r1/w23-node-bench-before.json`,
  `-after.json`): matrix walks' share of world.update standing 53.5 % -> 5.9 % (0.29 -> 0.015 ms a frame; what is left
  is the thirteen roots' own matrices and their getWorldPosition calls), walking 4.2 m/s 25.0 % -> **1.2 %**, flying at
  150 m 10.7 % -> 0.5 % (plan: at most 5 % of world.update; the audit's 24.7 % was its whole bench, my walking figure
  matches it). Undergrowth on a scripted descent from 1 km at 15 m/s (cells built / laid, meshes submitted): before 104
  cells and 275 meshes at every height (393k triangles submitted at 1 km, 0 strokes seen); after 0 cells at 1 km and at
  400 m, 29 cells and **0 meshes submitted at 150 m**, at 110 m 47 cells laid and every mesh with a stroke in reach laid
  and submitted (48 of 48), touchdown 103 laid cells against 104 before (**-1 %**, plan within 10 %), submitted 142
  meshes (the 142 with a stroke in reach; before 275).
- Test `src/world/undergrowth.test.mjs` (4): on foot a mesh is submitted exactly when a stroke of it can be seen; 150 m
  up none submitted, 1 km up none kept; the descent: laid by 110 m, as many cells at touchdown as on a standing start;
  world.update updates no mesh's matrix (2,686 a frame before). FAILS 4 of 4 on the head I began on (`e87f6be`).
- Frames: every station before | after OPENED (`docs/shots/painter/r1/w23-before-after-q2-1280-1..4.jpg`): the same
  pictures. Between two runs the frames differ only where the game's state moves from page to page (crowns swaying in
  PHYSICS' field, the stream): `w23-cost-and-frames-vs-w22.txt`. The exact check is in-page:
- **In-page A/B** (`bin/ab.mjs --mode under`, run `ab-w24`, the W2.4 tree, which holds these files): at each station the
  held frame as drawn, then every undergrowth mesh the range test left out shown and the frame drawn again. Shown: 122
  meshes at E_foot, 183 at E_50_45/90, 247 at E_150_45/90 (none built at 400 m and 1 km). Outside the water (region 2
  grown by 4 px) the final frames differ by **at most 2/255** (E_foot 6 pixels over 1/255; E_50 none; E_150 one pixel),
  which is the page's own noise floor: at E_400 and E_1000, where nothing was shown and nothing changed, two renders
  differ by up to 2-3/255 near the water (the water reflects the frame before, and the wet-in-wet bleed spreads it a
  few pixels; the lead's reproduction saw the same 2/255). The region view is identical everywhere. Undergrowth meshes
  submitted at E_150_45 and E_150_90: **0** (plan: 0; 98 before).
- Checks on a clean export of `e87f6be` with these files (`trees/chk23`): world 34 (30 + the 4 new), unit 225, physics
  325, coast.mjs PASS at both stands, ghostfield.mjs 6 of 6 all zeros; the station run's page and the A/B page: no
  console error, fallback empty. `tests/all.mjs`' painted-play and painted-m3 are run at the end of this part, on the
  last state (one browser at a time).

### W2.4 post savings with the same picture: what was done (src/render/post.js, shared.js, materials.js; test src/world/postsave.test.mjs)
- **The backdrop pass is gone.** It drew a triangle over the whole scene target writing white and (normal 0, log depth
  20, region 0); `beginScene` now clears the target white and clears the second attachment alone with
  `gl.clearBufferfv(COLOR, 1, ...)` to that value (the 8-bit fallback: its packed value 0.5, 0.5, 20/32, 0).
- **Last frame's painting is kept only while there is water** (`PREV.water`, shared.js; the water material says so in its
  onBeforeRender): the keep pass (half size, 2 reads a pixel) runs in a frame where water was drawn and in the frame
  after; where it did not run the frame before, `uPrevOn` is 0 and the water reflects nothing for that one frame
  rather than an old picture (the same as the first frame after a resize already did). A held frame is unchanged.
- **The paper is laid once per size.** Of the sheet's six reads of the paper texture, the two the tremor is taken from
  (plo, pmid) stay live: the tremor moves where the picture and the region target are read, and the region is read
  without filtering, so a half float's rounding of the offset moved a few pencil pixels by up to 4/255 in a first
  version that baked the offset (4 pixels of 921,600 at E_foot; that version is gone). The other four (paper, psoft,
  pfine, pmed) depend only on the pixel and the sheet's size: laid by PAPER_FRAG into two targets at the sheet's size
  (RGBA16F: the paper's value, the dark wash's dry-edge measure without its live part, and the two terms the paper adds
  to the ragged border, small numbers where a half float is finest; RGBA8: the grain's three) and read back with two
  `texelFetch`. Laid again when the size, uBoil or the border's settings change; not on the 8-bit fallback (the sheet
  reads the paper itself there, `PC_PAPER_BAKED` undefined). The sheet's code reads the paper through PAPER_LIVE and
  PAPER_STATIC, the same text in the bake and in the live path.
- Memory: the two targets are 12 bytes a pixel of the sheet (1920x1080: 23.7 MiB; 1280x720: 10.5 MiB; 1266x585: 8.5
  MiB). Whether two full-size fetches beat four reads of a small cached texture on a phone's bandwidth is not measurable
  here; the live path stays (PC_PAPER_BAKED undefined, as on the 8-bit fallback, `post.paperBaked`): W6 can choose it
  per device with a one-line switch at the Post's construction.

### W2.4 numbers
- **The same picture** (in-page A/B, `bin/ab.mjs --mode post`, run `ab-w24`: this tree's post passes against the base's
  sheet and backdrop on the same held scene, all 25 stations; `docs/shots/painter/r1/w24-ab-summary.txt`): outside the
  water every station's final frame is **within 1/255** (max 1, mean 0.006-0.011/255: rounding); on Mars, Saturn and
  Neptune, the whole frame within 1/255. In and round the water of the Earth stations up to 2-3/255 at a few pixels
  (E_1000_45 184 pixels, E_1000_90 128): there the raw scene itself differs by as much (the B render is one more round
  of the reflection's feedback), not the post passes. The region view identical everywhere. Diff maps OPENED:
  `w24-ab-diff-same-held-scene.jpg` (six stations, |diff| x32: speckle of 1/255 only).
  A first version that also laid the tremor's paper put 4 pixels of E_foot at 2-4/255 (pencil texels flipped by the
  half float's rounding of the offset): the tremor's reads were made live again before this run.
- **Reads** (PILOT's --taps instrument, post passes): the sheet 21 -> **19** reads an output pixel (plan: 17 -> at most
  11, NOT met: W2.2 added the edge test's 4 reads and the pooling's 4 at the washes' scale, and with the same picture
  only the paper's reads can go); post reads a frame at 1280x720: near stations 33.6 -> 31.8 M, far stations 25.3 -> 23.5
  M, and on a world without water also the keep pass (0.46 M, 2 reads a half-size pixel) and always the backdrop's
  full-size write (12 bytes a pixel, no reads). At 1920x1080 (the same reads per pixel): near 75.7 -> 71.6 M, far
  57.0 -> 52.9 M (the plan's 147 -> 115 M was the performance audit's model, which counted differently; PILOT's harness
  counted 63.2 M at 784183b at that size). The phone at 1266x585 (sheet only): 15.6 -> 14.1 M.
- Test `src/world/postsave.test.mjs` (4): no backdrop pass, the clears and their values; the keep pass only with water
  and the frame after, and uPrevOn; the paper laid once per size (again on resize and on a border change), its targets'
  types; the 8-bit fallback reads the paper itself and clears to the packed value. FAILS 4 of 4 on `f9cf6fe`.
- Checks on a clean export of `f9cf6fe` with these files (`trees/chk24`): world 38, unit 227, physics 325, coast.mjs
  PASS at both stands, ghostfield.mjs 6 of 6 all zeros; the A/B page (this tree): no console error, fallback empty.

### W2.5 anti-aliasing: what was done (src/render/post.js, index.js, chunks.js; test src/world/aaregion.test.mjs)
- **MSAA on the scene pass** (`Post.setAA(n)`, `_sceneTarget(samples)`): a second scene target with 4 (or 2) samples, made
  only when asked and dropped when not; three draws it into multisampled renderbuffers and resolves both colour
  attachments after the scene pass; the depth is a multisampled 32-bit float renderbuffer (the reversed-Z needs float;
  three takes the format from the target's DepthTexture type, so the single-sample depth texture stays attached and
  unused), neither resolved (`resolveDepthBuffer: false`) nor kept after the pass (`storeMultisampledDepthBuffer: false`,
  invalidated). Every reader of the scene's targets is pointed at the ones in use (`_bindScene`: prep, full prep, brush,
  sheet, keep, the debug views, the glazes' `G.uSceneAux` / `G.uSceneCol`). Not on the 8-bit fallback.
- **The region through the resolve (the plan's new risk 1).** An average of regions is not a region: half sky (0) and
  half foliage (4) resolved to 2, water. `pcWrite` (chunks.js) now writes the region squared into aux.y (it held the view
  normal's y, which nothing read; the sky already writes 0 there and region 0), so after the resolve `y - w^2` is the
  spread of the regions under the pixel. AUXFIX_FRAG (one pass at the scene's size, into `rtAux`, before anything reads
  the second target): a pixel whose samples lay on one region (spread under 0.12; half floats keep a pure pixel under
  0.07) is kept as resolved (its depth and normal the mean of its samples on one surface); a mixed pixel takes the whole
  aux of the neighbour nearest it in depth among the pure ones (3x3, then the 5x5 ring); with none, the region its
  samples' spread points to (w2/w, exact when one of the regions is the sky). So the region, depth and normal every
  reader sees are a real surface's, as with one sample; only the colour is the resolve's.
- **The tier's samples** (index.js): MSAA at tiers 2 and 1, not at tier 0 and not on a touch device with a coarse
  pointer (its GPU pays for samples in bandwidth; ruling 4 says post AA on phones until a real phone shows MSAA holds).
  Four samples while what they add (colour 4, region 8, depth 4 bytes a sample, and the repaired region 8 bytes a
  pixel: 72 bytes a pixel at 4x) stays under 100 MiB, else two (40 bytes), else none: 1280x720 at q2 4x (63 MiB);
  1920x1080 at q2 2x (79 MiB; 4x would be 142 MiB); 1920x1080 at q1 4x (91 MiB). The plan's rule for over 100 MB was
  "pack aux into RGBA8 while MSAA is on": not taken, the 8-bit pack holds the log depth in 1/8 steps of log2 metres,
  coarser than the brush's, the edge test's and the pencil's thresholds, so the picture would change; fewer samples
  keep it. `painter.setAA('auto'|'off'|'msaa'|'msaa2')`, `?aa=0|msaa|2` read by index.js; `painter.info.aa` (samples
  drawn) and `painter.info.depth` ('reversed-z' | 'log' | 'standard') for the stats line. 'post' AA is not built.

### W2.5 numbers (PILOT's harness, q2 1280x720, all 25 stations with A, F and taps: run `st-w25`; the region check: run
`ab-w25`; tables `docs/shots/painter/r1/w25-table.txt`, `w25-region-check.txt`, guard `w25-guard-vs-w23.txt`)
- **Aliasing index A (raw scene)**: E_150_45 0.447 (base) -> 0.397 (one sample, after W2.1) -> **0.350** (plan at most
  0.40: met; the live MSAA patch had 0.397); E_400_90 0.402 -> 0.321 -> **0.293** (plan at most 0.85 x base = 0.342:
  met). Elsewhere: E_foot 0.521 -> 0.461, E_50_45 0.413 -> 0.372, M_foot 0.452 -> 0.368, S_150_45 0.336 -> 0.254; at 1 km
  unchanged (0.378, 0.320: no geometry edges there, the land's own marks are W2.1's). A of the abstraction output at most
  the baseline raw's at every station (guard).
- **The region honest through the resolve** (`bin/ab.mjs --mode msaa`, run `ab-w25`: the region view with MSAA and the
  rule against the same held view drawn with one sample, all 25 stations; `w25-region-check.txt`): pixels whose region
  is none of their 3x3 one-sample neighbours **0 to 0.008 %** (plan at most 0.05 %: met; the most, E_150_45 at night, 73
  pixels, in the canopy; not examined one by one); **no water** away from water at any station (plan:
  none); 0.04-2 % of pixels take the other side of an edge than one sample did. OPENED: `w25-region-view-E150-crop.jpg`
  (the two region views alike; the differences are edge pixels).
- **Raw b1/b2 within 5 %** (against the one-sample run `st-w23`): b2 within 1.1 % at every station (no blur); b1 +0.1 to
  -5.1 % at 19 of 25, NOT met at M_foot -5.9 %, M_50_45 -5.7 %, M_50_90 -5.7 %, S_150_90 -6.2 % (and E_150_45_storm -5.1,
  N_150_45 -5.0 on the line): the 2-6 px band is where a stair-stepped edge has its energy, and on Mars' and Saturn's
  plain ground the spires', rocks' and cliffs' outlines are a good part of it; the crops show the outlines smooth, no
  softer marks.
- **Flicker index F (raw) at most 0.8 x the baseline raw's at every air station**: met at 12 of 22 (E_400 0.63/0.66,
  E_1000 0.41, M_50 0.74/0.76, M_150_90 0.74, M_400_90 0.77, M_1000 0.69/0.74, S_150 0.71/0.76, ...); NOT met at 10:
  E_50_45 0.89, E_50_90 0.89, E_150_90 0.83, E_150_45 0.80 (0.8004, on the line), M_150_45 0.81, M_400_45 0.82,
  E_150_45_dusk 0.81, storm 0.84, N_150_45 0.85, E_150_45_night 0.80 (0.8033). What still flickers there is inside surfaces and
  at cut-outs: the crowns' leaf cut-outs are discards, which MSAA does not smooth (alpha-to-coverage would take its
  coverage from the colour target's alpha, which is the wetness), and the crowns' own marks (W2.1 prefiltered the
  ground's marks, the leaf shadow and the near strokes, not every crown mark). The plan: "shader aliasing is item 1's
  job, not MSAA's"; left for W7.
- Look against the one-sample run (`st-w23`, the guard's rules): only the two halo flags W2.2 already had (abstraction
  output at E_1000_45 0.70 %, storm 0.82 %; were 0.72 / 0.95): every region's mean colour, L* percentiles, the border
  strip, detail and cost within the rules. Final land t1/t2 the same or a hair higher (E_foot 0.84/1.03 -> 0.86/1.03,
  M_foot 0.90 -> 0.94: measured against a raw scene with fewer stair steps).
- **Cost**: draw calls and triangles unchanged (the scene is drawn once); the region pass 1.0-1.5 reads a pixel (0.9-1.35
  M a frame at 1280x720; post reads E_foot 31.3 -> 32.6 M), the item's stated cost. **Extra target memory at 1920x1080**:
  the auto policy draws 2 samples there, 79 MiB (4 samples would be 142 MiB, over the plan's 100 MB); at 1280x720 4
  samples, 63 MiB; at 1920x1080 q1 4 samples, 91 MiB. Real GPUs' bandwidth for this: not measurable here.
- Frames OPENED: every station one sample | MSAA (`w25-before-after-q2-1280-1..3.jpg`: the same pictures at sheet scale) and 1:1
  crops at 2x of ten stations, raw and final (`w25-crops-2x-1..3.jpg`): the figure's hat and outline, Mars' spires,
  Saturn's cliff and Neptune's spires lose their stair steps; crowns' outlines smoother, their leaf cut-outs still
  stepped; no rim, halo or dark edge round any silhouette (the region rule keeps the brush, the pooling and the pencil
  on real surfaces).
- Test `src/world/aaregion.test.mjs` (5): pcWrite writes the region squared, the sky and the clear agree; the rule runs
  before every reader and the glazes read its output; the shader's rule read and mirrored on made pictures drawn with 4
  samples (edges between every pair of regions at seven angles, lines a quarter pixel wide, three regions meeting): no
  repaired pixel takes a region not among its one-sample neighbours, no water away from water (the plain resolve has
  some: checked); the tier's samples (4 at 1280x720 q2, 2 at 1920x1080 q2, 4 at 1920x1080 q1, 0 at q0, the overrides),
  the depth unresolved and not kept, 32-bit float. FAILS 5 of 5 on `fb40efe`.
- Checks on a clean export of `fb40efe` with these files (`trees/chk25`, so with W2.3 and W2.4): world 43, unit 227,
  physics 325, coast.mjs PASS at both stands, ghostfield.mjs 6 of 6 all zeros; `tests/all.mjs --only
  static,painted-play,painted-m3` in that tree: ALL 3 PASSED (static rules hold, painted-play 39 checks, painted-m3 33
  checks; these run at q0 half scale: no MSAA there); the station run's and the region check's pages (q2, 4 samples): no
  console error, fallback empty. Not run in a browser: q1, `?aa=` in the URL, a touch profile (the policy is covered by
  the test, with a stand-in renderer).

### For other roles and the lead (from this part of the lane)
- PILOT (tiers, W6; the stats line): `painter.info.aa` is the samples drawn (4, 2 or 0) and `painter.info.depth` the depth
  mode ('reversed-z' where EXT_clip_control exists, else 'log'); `painter.setAA('auto'|'off'|'msaa'|'msaa2')` and the URL
  `?aa=0|msaa|2` (read in render/index.js, since the painter builds the targets; move it to main.js if you prefer: one
  line, `if (q.aa) painter.setAA(q.aa)`). MSAA is the tier's: the controller should drop it (setAA('off')) before it
  drops pixels, as ruling 4 says. On a touch device with a coarse pointer the painter draws no MSAA (no post AA either:
  'post' is not built; ruling 4's phone post AA is open for W6/W7). The budget rule (4 samples under 100 MiB of extra
  targets, else 2) is in index.js (AA_MB); at 1920x1080 q2 it gives 2 samples.
- PILOT (the harness): `tests/stationlib/inpage.js` still names a 'backdrop' pass (post.mBackdrop is gone: harmless);
  the new passes show as 'region-resolve' and 'paper-bake' (the latter only in a frame that lays the paper) in `--taps`.
  Two renders of a held frame differ near the water by up to 3/255 (the reflection reads the frame before): an in-page
  A/B must mask it (my `bin/ab.mjs` grows region 2 by 4 px).
- PILOT/PHYSICS: the scene target's aux.y is now the region squared (pcWrite), no longer the view normal's y; nothing in
  the tree read it (searched: post passes, sky.js, kitmat.js, PHYSICS' lab).
- The lead: W2.4's sheet reads (19, plan 11) and W2.5's flicker index at the canopy stations (10 of 22 air stations over
  0.8 x) and raw b1 on Mars' and Saturn's plain ground (4 stations at -5.7 to -6.2 %) are the misses of this part; the
  reasons are with the numbers above. The phone question for the paper bake (two full-size fetches against four cached
  reads) and for MSAA's bandwidth can only be answered on the owner's devices (plan section 6).

## Hand-over of RELEASE 1, W2.1 and W2.2 (part 1 of the lane; done; part 2 is the section above)

The owner's request after play: much sharper (the ground seen from the ship, "not some blurry blobs"), smoother, mobile,
without losing quality. The plan: `docs/lead/SHARP-SMOOTH-PLAN.md` (sections 0, 2, 4 W2, 5). This lane, part 1: W2.1
(prefilter the procedural marks by the pixel footprint) and W2.2 (reverse the abstraction brush; wobble on edges only).
Began 05:01 UTC 2026-11-14 on head `0efcc3b` (render code the same as the live game and as the plan's base `784183b`).

Scratch: `/home/user/.pc-scratch/painter/r1/` (`bin/` = the sharpness audit's harness copied, port 9461, frames in
`frames/`, plus `alias2.py` (alias index A, 1x vs 2x box-filtered), `cmp.py` (the quality guard's numbers for a
before/after pair: t, raw bands, halo share, dE76 per region, L* percentiles, border strip, mean differences) and `run.sh`
(every station, q2 1280x720, A at E_150_45, E_400_90, E_1000_45, E_1000_90); `trees/base` an export of the head;
`node/mipstats.mjs`, `node/crackstats.mjs` the noise statistics the prefilter's constants come from).

**State:** W2.1 COMMITTED (`9d8c0ba`), W2.2 COMMITTED (`afe8c40`; numbers below). Nothing of mine is
half-done in the tree. Part 2 of the lane (W2.3 free wins, W2.4 post savings, W2.5 anti-aliasing) is not begun.

Final checks on a clean export of `3138a65` (my last code-bearing state plus PILOT's W3.1): world 30, unit 225, physics
325, coast PASS at both stands, ghostfield 6 of 6 all zeros; the real game from that export (`tools/shot.mjs`, 960x540):
no console or page error, `__pc.info().fallback` empty (its screenshot timed out in SwiftShader at 180 s, the tool's own
limit). My exports under `/home/user/.pc-scratch/painter/r1/trees/` are deleted; the runs (`st-*`), frames and sheets stay.

### For other roles (from this part of the lane)
- PILOT (tiers, W6): the old brush and old sheet come back whenever the scene is drawn under 0.6 of the sheet's size
  (`index.js`: `post.inH < 0.6 * post.outH`). Today dynres can still reach that in play (q1 x 0.5, q0 x 0.5); with the
  plan's resolution floor (0.67, W6) only the URL pins reach it, as the plan intends. Until then a slow machine sees the
  brush change style when the controller drops that low.
- PILOT (the guard, `tests/stations.mjs --compare`): its L* 10/50/90 rule flags nearly every station once the brush
  stops averaging (a sharp picture has a wider spread of values than a blurred one); the plan's W2.2 acceptance names
  the mean colour only. Its region means also flag tiny regions (a few hundred pixels of props or foliage at class edges
  on Mars, Saturn, Neptune). A minimum region share for the colour rule would read better. The `--sheet` mode needs
  `thumbs/` in the before run's directory (I copied the baseline run's).
- The lead: the leaf shadow's fine hatch at 1 km straight down (above) is a choice between the 2x alias index and that
  texture; and the two halo misses are the wet-in-wet bleed I kept as part of the washes.
- Part 2 of this lane (W2.3, W2.4, W2.5) is not begun. W2.4 should count the sheet at 21 reads now (was 16) and the
  new full-size prep pass (one read a pixel, one mip chain); W2.5's aux readers now include the sheet's edge test (3 aux
  reads, class change and depth step) as well as the graphite line.

### W2.2 what was done (post.js, index.js)
- **The brush turned round** (ABS_FRAG): keep = mix(near keep, 1, far) (near keep as before: 0.30 ground and foliage,
  0.72 props and figures, 0.92 marks, 0.85 lights); the radius is in internal pixels, `BRUSH_PX` 1.4 (index.js), broader
  by night (x1.45, the night factor now only on the near brush), capped at 2 px, 0 far; where keep >= 0.995 the
  rotation tap and the 8 sector taps are not read (far land: 4 reads a pixel, was 13, counted by PILOT's --taps). The
  near brush's statistics come from a new full-size prep (PREPF_FRAG into `rtFull`, colour and luma squared, mipmapped;
  drawn only while the near brush is in use): from the half-size prep (a 4 px box at its finest) a 1.4 px brush was a 4 px
  blur and E_foot's t1 was 0.56. The half-size prep stays for the bleed and the pooling.
- **The old brush below 0.6 of the sheet's size** (only a pinned scale reaches it after R4; today also dynres at its
  lowest scales): `uBrushR.y` / `uSheetOld` = internal height < 0.6 x output: the old ABS path (far radius, far pixels
  repainted) and the old sheet (wobble everywhere, the old per-pixel pooling), exactly as before (the tests' pinned
  q0/0.5 runs: static, painted-play, painted-m3 run on it, below).
- **The wobble on edges only** (SHEET_FRAG): 0.3 px (`uWobIn`, px at 1080p like uPig.z) inside a wash, the full 2.6 px
  where an edge is: a value step at the wash's scale (the half-size prep at lod 0.6 against lod 2.2, 0.05-0.12), a
  depth step (log2 depth 0.3-0.8 across 2 px), the sky, the water or a figure/ship meeting something else, and the
  ragged border. A first, wider test (trunks and every crown's depth step counted) took t1 from 0.95 to 0.74 at
  E_150_45 for little visible tremor; the 0.3 px everywhere variant (no edge wobble) is within 0.02 of the kept one in the
  air (it differs at M_foot: 1.09 against 0.90).
- **The pooling at the washes' scale** (SHEET_FRAG): the wide pool and the edge gradient are read on the half-size prep
  (lod 0.6, the old blots' scale) instead of the brushed picture's own pixels, and the pixel against that few-pixel
  picture pools both ways (`uPoolFine` 2.0, clamp 0.08): read on the scene's own pixels, as the brush no longer repaints
  them, every fine mark from the air took a pool and a dark rim and the far land went 3-5.6 dE76 darker (run a: E_400_90
  land 5.63, E_1000_90 5.08, E_150_45 4.14); one-sided at the washes' scale alone it kept the colour (2.9 at most) but t1
  fell to 0.74-0.88 (run b); the two-sided fine term gives the sharpness back with no mean (run c/d).
- Sheet reads 16 -> 21 a pixel (the edge test 4, the pooling's prep reads); total post reads a frame at 1280x720: far
  stations 28.1 M -> 25.3 M, near stations 28.1 M -> 33.1 M (the full-size prep). W2.4 is where the sheet's reads go down.

### W2.2 numbers (PILOT's harness, q2 1280x720, all 25 stations, run `st-w22d` on a clean export of `0902c56` + post.js
and index.js; guard against `tests/baselines/stations-784183b.json`: `docs/shots/painter/r1/w22-guard-compare.txt`,
one line a station: `w22-summary-q2-1280.txt`)
- Final land t1 / t2 (plan: at least 0.9 / 0.95 at every 150 m, 400 m, 1 km station on Earth, Mars, Saturn): E_150_45
  1.10/1.13, E_150_90 1.10/1.11, E_400_45 1.18/1.19, E_400_90 1.16/1.19, E_1000_45 1.18/1.05, E_1000_90 1.15/1.18,
  M_150_45 1.21/1.18, M_150_90 1.14/1.19, M_400_45 1.27/1.17, M_400_90 1.25/1.16, M_1000_45 1.23/1.22, M_1000_90
  1.24/1.23, S_150_45 1.09/1.09, S_150_90 0.98/1.04: ALL MET (baseline 0.00-0.13 / 0.13-0.44). t1 at most 1.4: met
  everywhere (largest 1.27).
- On foot (plan: t1 0.6, t2 0.85): E_foot 0.84/1.03 (0.30/0.72), M_foot 0.90/1.09 (0.34/0.71): MET.
- Halo of the abstraction output at most 0.5 %: met at 23 of 25; E_1000_45 0.72 % (baseline 3.4) and E_150_45_storm
  0.95 % (6.1): NOT MET, both the wet-in-wet bleed (kept: the washes) at the 2-3 km limb and under the rain; no brush at
  all gives the same 0.72 %.
- Palette, mean colour per region within dE76 3: land and ground within 3 at every station but E_400_90 (land 3.13,
  ground 2.93): the brush's averaging lifted the darkest marks, the sharp picture restores them (L10 53 -> 39, L50 62.7
  -> 61.9). Larger dE in tiny regions only: props/foliage slivers on Mars (14-18), Saturn and Neptune foliage (16-18,
  share 0.00-0.01), E_50_45 props 7.5 (share 0.00), E_400_90 water 5.2 (a narrow stream): pixels at class edges that
  the old brush filled with the neighbours' colour. The guard's L* 10/50/90 rule flags most stations: the sharp picture
  has a wider spread of values than a blurred one (L10 darker, L90 lighter) by its nature; the plan's W2.2 acceptance
  names the mean colour only.
- Paper border strip: 0.00-0.03/255 at every station (at most 2): MET.
- Abstraction reads per far pixel 13 -> 4: MET.
- E_150_45 at night t2 at least 0.9: NOT MET, 0.70 (baseline 0.09); the abstraction output's is 0.92: the rest is the
  night key itself (its toe and pigment load lay the darks together by design, PAINTER 16), not the brush.
- The guard's detail rule (raw b2 at least 0.95 x baseline) flags E_400_45, E_1000_45, E_1000_90 (b2 -6 to -15 %): that
  is W2.1's prefilter at the 6-16 px band (the rows of dashes' band), not W2.2.
- Frames OPENED: every station before | after (`w22-before-after-q2-1280-1..5.jpg`), 1:1 crops (`w22-before-after-
  crops-1.jpg`, `-2.jpg` opened; `-3..5` made the same way), the pooling scale (`w22-pooling-scale.jpg`). From 150 m
  every crown, trunk, the path and the clearings are there; Mars' strata and spires crisp from 1 km; the paper, the
  washes, the border and the palette as before. Left for the lead: at E_1000_90 (and faintly E_1000_45) the leaf
  shadow's fine diagonal hatch shows on the shaded wood (W2.1's factor 1.4: the design's 3.25 m lattice at the pixel's
  Nyquist); reading the leaf shadow one mip level coarser removes it but takes the 2x alias index from 0.32 to 0.65 (the
  2x reference keeps the hatch). The trees' stair-stepped edges at 1:1 are geometry: W2.5's MSAA.
- Checks on a clean export of `0902c56` with post.js and index.js: world 30, unit 216, physics 325, coast PASS at both
  stands, ghostfield 6 of 6 all zeros; `tests/all.mjs --only static,painted-play,painted-m3` in that tree: ALL 3 PASSED
  (static rules hold, painted-play 39 checks, painted-m3 33 checks); every station page: no console error, fallback
  empty (the harness's problems list empty, every system real).

### W2.2 design experiments (PILOT's harness on the W2.1 tree, `st-w21b`, post passes patched on the held scene)
Half-size statistics for the near brush (`w22/post-halfstats.js`), edge-only wobble, measured against each station's own
raw scene (final land t1/t2; halo read on the abstraction output):
- w1 (near brush 1.4 px, wobble 0.3 inside, full on edges): E_foot 0.55/0.91, E_50_45 0.77/1.04, E_150_45 0.93/1.09,
  E_400_90 1.14/1.18, E_1000_45 1.23/1.09 (halo 0.72 %), E_1000_90 1.20/1.25, M_foot 0.73/1.04, M_150_45 1.11/1.13,
  S_150_45 1.05/1.07, E_150_45_night 0.56/0.64. The radius hardly matters (1.0, 1.4, 2.0 alike: the half-size prep is a
  4 px box at its finest); no near brush at all: E_foot 0.83/0.99; near keep 0.5: E_foot 0.62/0.93; wobble 0.3
  everywhere: E_foot 0.70/0.95, E_150_45 1.15/1.15. Frames opened (`sheets/w22exp-E150.jpg`): from 150 m every crown,
  trunk, the path and the clearing are there, the paper, the washes and the border as before.
- So: E_foot misses t1 0.6 with half-size statistics (hence the full-size prep in the draft, `w22/post.js`), the edge
  test fires on much of the foot frame (t1 0.55 against 0.70 with the 0.3 px wobble everywhere), E_1000_45's halo
  (0.72 % with no brush at all) is the wet-in-wet bleed of the far air, and the night station's t2 0.64 is the night key
  itself (no brush: 0.65; the abstraction output 0.91): the night's toe and pigment load lay the darks together by
  design (the M4 night key), which the plan's 0.9 would undo.
- Running: `st-w22a`, the draft (full-size statistics) at all 25 stations with variants e2..e7 (edge test thresholds,
  silhouettes and border only, near keep 0.5, half-size statistics, wobble 0.3 everywhere).

### W2.1 what was done (chunks.js, materials.js)
- `pcFp` (the pixel's footprint on the land, metres: the longer of the two screen derivatives of the body position, the
  axis the hardware's mip level follows), set at the top of TERRAIN_FRAG, PROP_FRAG and NEAR_FRAG before any discard;
  materials that do not set it (orbit.js, the kits, PHYSICS' lab) keep every mark exactly as before.
- `pcSub(scale, k)`: the variance of a uNoise3D channel that lies inside the pixel = k.x s^2/(s^2 + k.y), s = texels per
  pixel. Fitted to the 64^3 noise's own mip chain (`node/mipstats.mjs`): R and G (0.0191, 100), B (0.0163, 25), A
  (0.0550, 56). `pcStepF(e0, e1, v, sub)`: the threshold's half width h -> sqrt(h^2 + 1.4 sub): the same mean share,
  softer as the pattern goes under the pixel. `pcLineF`: the cracks (a distance field's thin line), widened by its
  change across the pixel and keeping its cover, laid as its mean cover past its cells (`node/crackstats.mjs`: grad 17
  a tile, cover 1.8 x the mean width). `pcLevelF`: the light's steps no narrower than fwidth of the light value.
- Terrain: the leaf shadow, the dabs, flicks, dry brush, the two hue drifts, the cracks and their masks; the light: where
  the leaf shadow is finer than the pixel (`fk` from pcDappleSub) the shade and the sunlit wash are toned each on its own
  and mixed by the sunny share (the light read at the mixed value was one middle step, so the far floor's colour moved);
  the fleck's heart as 0.55 patch + 0.45 min(heart, patch) (equal where drawn, the right share where not). Props: the
  leaf shadow, the rocks' dry brush. Near strokes: the leaf shadow.
- The factor 1.4 (was 3.5 as first written): measured at E_1000_90 on one held page against the design supersampled 16
  times (W2.1 off, 4x, box-filtered down; `bin/truth.py`): error 0.63 as drawn, 0.54 at 6, 0.48 at 3.5, 0.42 at 1.5;
  the plan's 2x alias index A 0.358 at 3.5, 0.322 at 1.5, 0.3185 at 1.2; raw lapvar 199 at 3.5, 324 at 1.5, 366 at
  1.2 (the plan's bound 350; the supersampled design's own lapvar is 675). A and lapvar pull opposite ways there; 1.4
  sits between. Tried and not kept: the noise read one mip level coarser (lod +1, the pixel's Nyquist emptied): A 0.65
  (too soft against the 2x reference); n1/n2 alone one level coarser: A 0.365 (worse); an explicit mip level for the
  leaf shadow (to rule out SwiftShader's 3D level): no change.

### W2.1 numbers (q2 1280x720; PILOT's harness for A; the baseline `tests/baselines/stations-784183b.json`)
- At factor 3.5 (PILOT's harness, run `st-w21`): raw A E_400_90 0.402 -> 0.31, E_1000_45 0.630 -> 0.40, E_1000_90
  0.533 -> 0.36; raw lapvar E_1000_45 372.6 -> 59.7, E_1000_90 1082 -> 199; draw calls and triangles unchanged at every
  station; final t, halo unchanged (today's brush). At 1.5 (my held page): A E_1000_45 0.378, E_1000_90 0.322, E_400_90
  0.320 (ground alone 0.246: the rest is the trees' silhouettes, W2.5's MSAA); lapvar 97, 324. The final run at 1.4 is
  `st-w21b`: raw A E_400_90 0.321, E_1000_45 0.3782, E_1000_90 0.3200 (the 0.6 x baseline lines are 0.241, 0.3780,
  0.3198); raw land lapvar E_1000_45 100.7, E_1000_90 336.8 (bounds 150, 350); raw b3 28.2 / 34.2 / 24.5; calls and
  triangles equal to the baseline's at every station.
- Raw b3 within 10 % (E_1000_90 25.0 -> 24.4, E_1000_45 33.6 -> 34.0), raw land dE76 1.18 / 1.58 (at most 2); E_foot
  b1/b2 -0.6 / +0.1 %, E_50_45 -1.9 / -0.8 % (within 5 %) (audit harness, my base run vs W2.1 at 3.5).
- **Not met: A at most 0.6 x baseline.** E_1000_45 0.378 (target 0.378) and E_1000_90 0.32 (0.320) sit on the line at
  1.4-1.5; E_400_90 0.32 against 0.241: its ground alone is 0.246, the trees' edges are geometry (W2.5). See above for
  why A and the lapvar bound cannot both be cleared with margin by this filter.
- Crops opened: `docs/shots/painter/r1/w21-raw-crops-before-after.jpg` (E_1000_45: the rows of dashes gone; E_1000_90 a
  fine stipple left in the shaded wood; E_400_90 softer edges), `w21-k3.5-harness-crops.jpg`,
  `w21-E_1000_90-k-variants.jpg`.
- Checks on a clean export of `2df378d` with these files: world 30, unit 216, physics 325, coast PASS at both stands,
  ghostfield 6 of 6 all zeros; the pages of the session: no console error (harness problems list empty).

## Hand-over of the LAST FIXES' RE-FIX pass (twenty-second PAINTER agent)

The verifier of the last fixes accepted item 2 and found item 1 partly fixed (the eye inside a spire: fixed and confirmed;
a hard-edged slab beside a slim Neptune spire seen from OUTSIDE it, the descent's last frame `q0_dsc4`, still there, the
same on base and head), one MINOR regression of item 1's hollow (with the eye at the skin of a stout spire the spire breaks
into a ragged mass and dark chips; the fade starts about 2 m outside the skin) and a pre-existing violet slab on Saturn
(`sfptp`). Its files: `/home/user/.pc-scratch/verify/last-painter/`. The owner's word relayed with this pass: for this
play test use what the game has now and go on. Began 00:15 UTC, 2026-11-14, on head `a539086`.
Scratch: `/home/user/.pc-scratch/painter/last/re/` (`bin/` the verifier's `run.mjs`, `lib.mjs`, `sheet.py`, copied
unchanged; trees `H` the head, `F`, `F2` the head with the two tries; frames in `out/`; `sout.mjs` the outline measure).

**State at the end of the pass: NO CODE CHANGED; the head stands (`0112e5e` and `5fd389b` as verified).** Both tries
looked no better or worse in the verifier's own views and were reverted; the open slab has no small safe fix. Evidence
`docs/shots/painter/last/04-refix-tried-not-kept.jpg` (opened) and `04-outline-measure.mjs`. World tests on a clean export
of `a539086`: 30 pass. Every page of the pass (H, F, F2 at quality 0, half scale, 960x540): no console error, no game
error, fallback empty.

- **THE SLAB BESIDE A SPIRE SEEN FROM OUTSIDE (`q0_dsc4`): NOT FIXED, pre-existing.** Reproduced with the verifier's
  descent on a fresh page of the head (ship 16 m up 4.5 m from a slim ice spire, C held to the ground): `dsc2` to `dsc4`
  show the spire as a cobalt slab with ruler-straight vertical edges and a V at its foot. What it is: at quality 0 there
  are no near forms (`flora.js _retier`: "the low tier draws no full trees"), so a spire a few metres from the lens is
  its MIDDLE form, an icosahedron of detail 1 stretched 4.5 times taller than wide: tall sliver facets 5 to 8 m long, and
  its egg-shaped foot narrows to a point at the ground (the V). The verifier's reading that the player's `177` (top right,
  a V-bottomed polygon) is this kind fits what I see; the player's place was not logged. Three fixes looked at, none
  small and safe now:
  (a) a ragged outline cut in the shader, found from the spire's own axis (the sine of the angle between the line of
  sight and the way out from the axis is 1 on the outline of a round form). Written and measured before any frame, on the
  kit's own middle forms (eight seeds per kind, eyes 1.6 to 4.5 girths out; `04-outline-measure.mjs`, checked first on a
  smooth cylinder: 100 % of its side outline over 0.94): on the slim spires only 49 % of the side outline is over 0.9
  and 14 % under 0.5 (stout 67 % / 3 %): the wind-carved lumps (noise 0.30), the lean and the off-centre body turn the
  real outline away from the axis, so a cut that always takes the outline would eat half the spire. Not kept, no frame.
  (b) a finer middle form: the facets are slivers, so detail 2 still leaves 4 m straight edges and detail 3 (2 m) costs
  about 1300 triangles a spire at the slowest tier, on every world with spires. (c) the near form at quality 0 within
  some metres: the near and middle forms are different spires (other seeds, height and lean), so it would change shape
  in front of the player. For a successor, with frames at every tier: a middle form cut as rings and sides from the near
  form's own seed (the same spire, coarser, with a broad foot), then (c) is safe; or PILOT's landing and foot cameras kept
  a few metres clear of a spire.
- **THE HOLLOW'S SIDE EFFECT AT THE SKIN (MINOR regression): two tries, neither kept; the head's hollow stands.** The cause
  is item 1's one number per spire: the real skin wanders about 30 % round the girth the shader assumes, so the reach must
  start outside it. From the verifier's views the window is narrow: Saturn `sfp2` (stout spire, eye at 1.19 of the assumed
  girth) had dark ruled strips on base that the hollow removed, Mars `mfp2` (stout, 1.27) was a plain wash on base and
  is broken up on the head; a tighter reach cannot tell the two apart, and the fixer's narrower reach left a slab at the
  skin (V3). Tried instead (fragment shader only, spire materials only): an eye only near a spire, not inside it, parts
  only what is near the eye, the whole spire still going once the eye is inside (`hv = vHollow * mix(1 - smoothstep(a,
  b, vd), 1, smoothstep(0.86, 0.98, vHollow))`). F (a, b = 2.5, 8 m): 28 of the 29 views within 0.05 to 0.7 of 255 of the
  head on average (the 29th, `sfptp`, differs by a lit patch on the ground, the sky's light, not a spire); `mfp2` keeps
  its broken mass and blots, `sfp2` its chip. F2 (1.5,
  4.5 m): `mfp2` and `sfp2` the same, and `V3` gains a dark streak and chips at the lower left: worse. Both reverted.
  Kept as it is because removing the hollow brings back what the verifier confirmed it fixed (V1, V3, `fpw2`, `fpw3` at
  quality 0; the half-frame of ragged cobalt from inside a spire at the top tier), which is worse than spatter at the
  skin; the verifier called it MINOR and, at the top tier, arguably better.
- **SATURN `sfptp` (third person 3.2 m from a spire, a flat violet slab with a straight edge): not touched,
  pre-existing.** At quality 0 it is the same middle form as above; at the top tier the near form at 3.2 m. Same
  successor's work.

## Hand-over of the LAST FIXES (twenty-first PAINTER agent; kept current after every item)

The last fix round before ship (workflow m4-last-fixes), from the second blind player's play (on `45629a7`, README only,
960x540, quality 0 at render scale 0.5; its log and frames `/home/user/.pc-scratch/verify/player2/`). The list, in order,
each only if small and safe: (1) Neptune's hard-edged dark-blue polygons at the frame corners; (2) Saturn's dark spires that
seem to hang above the horizon (`163_sat_look.jpg`); (3) the hard-edged faceted slab in first person at Mars' canyon walls;
(4) if time: Uranus' plain, Venus' cream haze at 439 m. Began 22:20 UTC, 2026-11-13, on head `e56a93f`.
Scratch: `/home/user/.pc-scratch/painter/last/` (`live3.mjs`, `lib.mjs`, `send.sh`, `mk.sh`, `checks.sh`, `sheet.py` copied
from the pre-ship round's harness; command files in `cmds/`; `views.sh` the Neptune spire views, `sat.sh` the far-form views;
trees `F` the head, `G` the head with my working files, `C1`/`C2` the check trees, all deleted after use; live logs and
frames kept in `L1`..`L9`, `M1` (Mars); `L1` was a
long session whose state drifted, its frames are not used as evidence: every before/after pair is two fresh pages run
through the same command sequence). Evidence: `docs/shots/painter/last/` (every picture named here was opened by me).

**State at the end of the round:** item 1 DONE (`0112e5e`, on `3066381`); item 2 DONE (`5fd389b`); item 3 NOT fixed
(investigated, not reproduced as the player saw it, the cause most likely outside PAINTER's paths: below); item 4 NOT done
(by choice: below). Nothing of mine is half-done in the working tree; the scratch trees were deleted after use (disk).
For another role: PILOT, the foot camera's boom and the first-person eye against walls and inside tall props (items 1 and
3 below). What a successor could take next: the eye inside the rendered terrain on a canyon wall at quality 0 (item 3's
hypothesis, to prove or drop), Uranus' flats, Venus' climb.

- **ITEM 1, NEPTUNE'S HARD-EDGED DARK-BLUE POLYGONS AT THE FRAME CORNERS: DONE.** What they were (found in the live page,
  quality 0 at half scale, 960x540, the Wind-Carved Ice Spires): the EYE INSIDE AN ICE SPIRE. Neptune's ice spires are 17
  to 27 m tall (kit `spire`, slim, scale 2.1); on foot PILOT's camera boom passes into one (the crown rule that keeps the
  lens out of crowns works only in the air, and a spire has no crown, `src/player/camera.js` CROWN_KITS), and so does the
  landing camera; a probe of the frame with the triangle put the camera 0.91 m from the spire's axis at 1.26 m up, well
  inside its 2 to 3 m girth. From inside, with back faces culled, the eye sees only the few faces turned toward it: a
  ruled triangle at a corner (the player's `174_nep_low.jpg`), a slab with a straight edge (`179_nep_turn2.jpg`); at the
  top tier, with the finely cut near form, a huge ragged cobalt shape over half the frame. Hiding the tall spires took
  the triangle away. Not the far forms (they start about 45 m out at quality 0) and not a missing watercolour pass.
  Fix (`render/materials.js` PROP_VERT/PROP_FRAG, define `PC_HOLLOW`, uniform `uHollow`; `world/flora.js` gives it only to
  spire materials: slim [girth 1.3, height 10.5, lean 0.3], stout [2.0, 12, 0], in the kit's own units): the vertex shader
  finds the eye in the spire's own frame (the instance matrix's columns carry its girth and height), measures it against
  the spire's girth at that height (tapering, the slim one leaning as florakit.js leans it) and gives every vertex of that
  spire one number, 0 clear of it, 1 inside; the fragment shader parts the spire into a few broad ragged washes (noise at
  3.2 m and 0.8 m, anchored to the body) and leaves nothing once the eye is inside its skin. Every other material's shader
  is unchanged (no define). Tried and not kept: a narrower reach (`gr*0.95 .. gr*1.3+0.15`: with the eye at a spire's skin a
  large slab with a ragged edge was left), noise at 1.4 m (a stipple of chips at the top tier).
  Proof: before/after, the same five places on two fresh pages each (quality 0 at half scale and quality 2 at full),
  `docs/shots/painter/last/01-neptune-spires-eye-inside-before-after.jpg` (opened): V1 (the camera inside a spire) the
  triangle at the top left gone, and at the top tier the half-frame of cobalt gone; V3 (the camera at a spire's skin) the
  ruled slab over the left third gone; V2 (first person 6 m from a spire), V4 (the ship hovering 7 m up beside one), V5
  (an open view) unchanged. Saturn, Mars and Jupiter's spawns at quality 2 with the change: drawn, no console error.
  New test `src/world/hollow.test.mjs` (3 cases: the shader's formula read as text and mirrored; only spire materials on
  every world carry it, nine spire species; the numbers fit the kit's own geometry over fifteen seeds, both forms and both
  kinds: an eye on a spire's centre line parts it (5th percentile over 0.9), halfway to its skin as good as gone (median
  over 0.99, 5th percentile over 0.6), a step clear of it whole (95th percentile under 0.2)): FAILS on the head (2 of 3),
  passes now. World tests 25 -> 28.
  Checks on a clean export of `3066381` with these files (`C1`): world 28, unit 208, physics 325, `coast.mjs` PASS at both
  stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as before), `wallrun.mjs` Earth sea_coast 0.2 m at most on
  ground over 50 degrees; the game at quality 0 and 2 (five fresh pages): no console error, no game error, fallback empty.
  Not verified: the player's own place (its position was not logged; reproduced at the ice spires' stand instead); the
  descent (`174`'s situation) only as a ship hovering 7 m up beside a spire, with the camera outside it.
  Left as it is and for PILOT, not needed for the fix: the boom still passes into spires (and into the buttress and fallen
  blocks at a spire's foot, which the hollow does not reach: they stay solid); an eye inside one of those sees the same
  kind of faces, but they are small (under 1.6 m).
- **ITEM 2, SATURN'S DARK SPIRES THAT SEEM TO HANG ABOVE THE HORIZON: DONE.** What they were: the FAR FORMS of the kinds
  with no trunk (spires, crystals, frozen waves, kelp). Every species shares one far form (`florakit.js farTreeGeometry`,
  a crown blob over a stick of a trunk); for a kind with no trunk the prop shader folded the trunk away and set the blob
  down on its lowest point (`(lp.y - 0.30) * 1.45`), so each stood on a sliver of a foot with its lowest point clear of
  the ground (0.06 of its height: 0.7 m on a 12 m spire) and, without a taper, widest halfway up. At quality 0 trees hand
  over to that form at about 50 m (RANGE_SCALE 0.28), and far off, where the foot was lost in the haze and the soft
  enlargement, the masses hung over the land line with sky under them (the player's `163_sat_look.jpg`; the same on
  Neptune: a double blob over the ridge at the ice spires' stand, heading 90). Fix (`render/materials.js` PROP_VERT,
  PC_FAR, three lines): for a kind with no trunk and no fall (`foot`), the blob's lower half is pressed down to three
  tenths of its depth and the whole form set on the ground: the widest girth about a quarter of the way up, the foot as
  broad as the widest girth for a spire, the top where it was (0.92 of the old height, the lumps' sinking). A tree with a
  trunk and a hanging kind (vines) are drawn exactly as before.
  Proof: the same seven places (Saturn's Ring-Shadow Twilight at headings 0, 90, 180; Neptune's ice spires 0, 90;
  Uranus' Frozen-Wave Forest; Mercury's Twilight Crystal Gardens) on two fresh pages each, head + item 1 / + item 2, at
  quality 0 half scale and quality 2: `docs/shots/painter/last/02-far-forms-broad-foot-before-after.jpg` (opened; crops of
  the horizon band): on Saturn the dark blobs that floated over the ridge now stand on it, the far spires are cones on
  the land, not spindles; on Neptune the double blob over the ridge is one form standing on it; at the top tier the far
  spires keep their look with broader feet. Uranus' and Mercury's stands show few far forms: no visible change there.
  New test `src/world/farfoot.test.mjs` (2 cases: the shader's lines read as text; the mirror run on the real far form for
  four tapers: the foot on the ground, as tall as before, widest low down, the girth near the ground at least 0.74 of the
  widest (0.43 to 0.67 before); trees and vines vertex for vertex as before; the old form's lowest point 0.06 over the
  ground): FAILS on `0112e5e` (the shader's lines), passes now. World tests 28 -> 30.
  Checks on a clean export of `0112e5e` with these files (`C2`): world 30, unit 208, physics 325, `coast.mjs` PASS at both
  stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as before), `wallrun.mjs` 0.2 m at most on ground over 50
  degrees; the game at quality 0 and 2 (two fresh pages, seven places each): no console error, no game error, fallback
  empty.
  Not verified: the player's own place on Saturn (not logged; the Ring-Shadow stand is the lilac plain with violet spires
  the log describes); the hand-over between a near spire and its far form while walking (the far form is now nearer the
  near one's shape, by the code; not filmed).
- **ITEM 3, THE HARD-EDGED FACETED SLAB IN FIRST PERSON AT MARS' CANYON WALLS: NOT FIXED.** The player's frames
  (`094_mars_fp.jpg` to `096_mars_fp3.jpg`, first person, pressed against a canyon wall 400 m from the ship; `103`/`105` are
  third person and show the canyon well) show a broad ochre band with ruled edges across pale paper, the sun in the pale
  above it, faint grey ruled lines in the pale below it. I went to Mars' Rust Canyons at quality 0, half scale (the stand,
  then a wall found by sampling the slope round it, 234 m south), stood 1 to 3 m from the wall in first person and walked
  into it (5 s of W; W with the jetpack 2.5 s): the wall at the lens is one flat rust wash with pale dry-brush flecks;
  looking 45 degrees up, the wall's crest is a nearly straight diagonal against the sky; never the player's band
  (`docs/shots/painter/last/03-mars-wall-first-person-not-fixed.jpg`, opened). My reading, NOT proven: the player's eye
  was inside the drawn wall (the pale below the band is the sky seen through the culled inside of the ground, the band a
  face of the far side turned toward the eye). At quality 0 a terrain node splits only when the eye is nearer than 0.68 of
  its size (`terrain.js SPLIT_BY_QUALITY`), so the drawn wall near the eye can be a level coarser than the surface the
  explorer collides with and the camera keeps its clearance from (`sampleSurface`); on a stepped canyon riser the two can
  differ by a metre. A fix would be either PILOT's (the first-person eye and the boom kept clear of the drawn ground, e.g.
  a larger clearance against steep faces) or a change to the terrain's near detail at quality 0 (cost on every world at
  the tier that is already at 1 to 3 frames a second): neither is small and safe in this round. Left as it is.
- **ITEM 4, URANUS' PLAIN AND VENUS' CREAM HAZE AT 439 m: NOT DONE, by choice.** Both are looks verified in earlier rounds
  (Uranus' Pearl Fog Flats: the pre-ship round's item 3, value spread 7.2 -> 9.9; Venus' climb: the pre-ship round left
  4b undone because it moves the edge of the air verified twice in M4); a tuning that helps one frame without a round of
  frames at both tiers and a verifier is the kind of change this round was told to leave. Seen in the player's frames
  (`187` to `191`): Uranus' landing is a pale mint plain with small scattered marks and an empty horizon, calm but dull;
  it is not broken.

## Hand-over of the M4 PRE-SHIP RE-FIX pass (twentieth PAINTER agent)

The verifier of the pre-ship round accepted items 1 to 3 (NOT ACCEPTED: none) and found two minor regressions with one
cause, and a note. This pass fixes exactly that and nothing else. Began 18:48 UTC, 2026-11-13, on head `22120b9`.
Scratch: `/home/user/.pc-scratch/painter/preship/refix/` (trees `F` the head with PAINTER's working tree, `H` the head,
`B` the head with PAINTER's paths at `25074de`, before item 3; `frames.mjs`, `rows.py`, `pair.py` are copies of the
verifier's instruments, `sheet3.py` the three-column sheet; frames in `q2/`, `q0/`). The verifier's own files:
`/home/user/.pc-scratch/verify/preship-painter/`.

**State at the end of the pass:** the one fix DONE and committed as `d9f0ea4` (on `22120b9`; its code, test and frame
match the checked tree `F` file for file). Nothing of mine half-done in the working tree; the scratch trees were
deleted after use (disk). Item 4 (the climb to space; the Uranus sketch's change for PILOT)
stands as the round left it, below.

- **RE-FIX, THE NIGHT WASH OVER THE NEAR LAND ON EVERY WORLD (the verifier's two minor regressions): DONE.** Item 3(c)
  laid the graded darker wash over the near land at night (`render/post.js`) on every world; it was judged on Mars, and
  on Earth it sank the one lighter mass of each nocturne toward the dark: the spawn's moonlit meadow at the top tier
  (L* 10-90 19.9 -> 16.9 in the verifier's frames) and the sea coast's pale beach at quality 0 (12.6 -> 11.4). Its
  strength is now a world's own: a look's `nightNear` (Mars 0.30, the value item 3 was judged with; every other look
  says nothing and has none), carried as `SHEET.nightNear` (set beside `SHEET.night` in `world/index.js`, 0 in deep
  space) to a new sheet uniform `uNightNear` (`render/index.js`, `render/post.js`, `render/shared.js`). With 0 the
  sheet lays exactly what it laid before the wash existed. Mars' night sky band (`nightHorizon`) and every other part
  of item 3 are untouched. The verifier's NOTE (the wash gated only on the night key, no check for air) is moot now:
  only Mars, which has air, asks for it.
  Measured with the verifier's own `frames.mjs` (the real game, clock held at 300 s, 23:30, 960x540, HUD hidden) on
  `B` (before item 3) / `H` (the head) / `F` (this), L* 10-90 spread and the lower three bands' medians: quality 2
  scale 1, Earth spawn 19.7 (38.4/40.2/39.8) / 16.8 (35.1/35.2/34.5) / 19.7 (38.4/40.2/39.8), and `F` against `B` a mean
  difference of 0.24 of 255 (0.3 % of pixels over 8: the settle's own steps); quality 0 scale 0.5, Earth spawn 20.1 /
  17.8 / 20.1, the sea coast 12.5 (49.0/49.0/48.6) / 11.4 (46.3/44.7/44.2) / 12.5 (49.0/49.0/48.6), `F` against `B` 0.25
  and 0.22 of 255. Mars kept: quality 2 spawn 36.4 (head) / 36.6 (this), quality 0 spawn 32.7 / 32.7 (19.2 before item
  3), polar frost 23.6 / 23.7 (15.1 before); `F` against `H` on Mars 0.04 to 0.5 of 255. Frames (opened, every one):
  `preship/06-night-wash-mars-only.jpg` (three columns: before item 3, head, this; six rows: Earth spawn at q2, Mars at
  q2, Earth spawn, sea coast, Mars, Mars' frost at q0). Seen: on Earth the moonlit meadow and the pale beach are again
  the lighter masses under the dark wood and the sea; Mars is three washes as item 3 left it.
  A slip, caught and logged: my first try had a backtick in the new comment inside the sheet's shader (a JS template
  string), which ended the string; the game loaded with `fallback: ["render: Unexpected identifier 'nightNear'"]`. The
  frames.mjs run said so; fixed before any frame was kept. Hence the new test also checks that the four files parse.
  New test `src/world/nightwash.test.mjs` (one case: only Mars asks for the wash, Earth does not, the four files parse,
  the wash's strength is `uNightNear` and the look's number reaches it, deep space lays none): FAILS on the head
  `22120b9`, passes now. World tests 24 -> 25.
  Checks on a clean export of `22120b9` with these files (`F`): world 25, unit 198, physics 325, `coast.mjs` PASS at
  both stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as before), `wallrun.mjs` Earth sea_coast 0.2 m
  at most on ground over 50 degrees; the game at quality 2 and at quality 0 (`frames.mjs` on `F`): no console error, no
  game error, fallback empty. (I copied the new test file into `F` while a browser served it; the page never loads a
  test file.) Not verified: the other worlds' nights with the wash were never measured by anyone (the round judged Mars
  and Earth); they are now back to the state before item 3, which is what had been verified.

## Hand-over of the M4 PRE-SHIP round (nineteenth PAINTER agent; kept current after every item)

The last fix round before ship (the coordinator's ruling of 15:40 UTC, 2026-11-13: workflow m4-preship). The list, in
order: (1) the column of leaf dabs in the alpine meadow's sky; (2) stair-stepped figure and ship at tier 0 and half
scale (the blind player's UGLY 8); (3) flat frames: Uranus' Pearl Fog Flats, Mars at night, Venus' haze (UGLY 9);
(4) if time: the climb to space (MINOR 10), the Uranus view sketch's dark wash (MINOR 12: PILOT's numbers).
Began 15:38 UTC on head `e39a197`. Scratch and harness: `/home/user/.pc-scratch/painter/preship/` (`mk.sh <dir>`: a
clean export of the head with PAINTER's working-tree paths over it; `live3.mjs <tree> <out> <quality> <WxH>` with
`send.sh <out> <name> < cmd.js` and the command files in `cmds/`; `checks.sh <tree> <out>`: world, unit, physics,
coast.mjs, ghostfield.mjs, wallrun.mjs one after another; `sheet.py` for labelled sheets; `bands.py` for the L* of
six horizontal bands; `sk/` the sketch test; the trees were deleted after use (disk)). Evidence:
`docs/shots/painter/preship/` (every picture named here was opened by me).

**State at the end of the round:** items 1, 2 and 3 DONE and committed (`8c7d603`, `25074de`, `18c1e33`; the first on
`1294633`); item 4a written for PILOT (the sketch's span floor, their file); item 4b (the climb to space) NOT done, with
the reason below. Nothing of mine is half-done in the working tree. For another role: PILOT, the one-line change to
`src/core/sketches.js` (item 4a). What a successor could take next: Venus' pale mesas' own view (item 3: not improved),
the climb to space (4b), Venus at quality 2 with the final bank numbers (not seen).

- **ITEM 1, THE COLUMN OF LEAF DABS IN THE SKY: DONE.** Cause (found by hiding each kind of object from a frame hook
  in the live page at quality 2: the land, the flora, PHYSICS' kits each left it standing; the near ground's three
  rings took it away, the fine ring the cascade at the upper left, the mid and far rings the column): the strokes
  were the FOREST's. `world/nearground.js` laid each frame's update ranges down afresh (`clearUpdateRanges` then
  `addUpdateRange` in every `update`), but three takes an attribute's ranges only in a frame that draws the mesh, so
  a frame built and not drawn lost what it had changed. After a leap (forest -> meadow) the ring clears and asks for a
  whole upload, then lays the new sward a few clumps a frame; when the frames in between are not drawn (every
  instrument's held clock stepped with the painting put aside: the PHYSICS verifier's sessions, my live harness, the
  play-test drivers), only the last frame's range reached the GPU, which kept the forest's strokes written against
  the old origin on the old ground's plane: tilted sheets of them stood up into the sky. With the land hidden the
  sheets show whole (frame below). Fix: what has changed since the GPU last took the arrays is kept (`all`, `lo`,
  `hi`) and sent again with whatever changes next, until three's `onUpload` says the GPU has it (`Ring.sent`,
  `Ring.taken()`). In the game's own loop every `world.update` is followed by a drawn frame, so whether a player could
  ever see it I cannot say (I found no path in play that builds a frame without drawing it); every instrument could.
  New test `src/world/nearground.test.mjs` (a stand-in for three's WebGLAttributes with its rules; forest -> alpine
  meadow, frames drawn every one, one in seven, none, at quality 2 and 0; every stroke the GPU would draw must stand on
  the meadow): on the head it FAILS at both qualities (quality 2, one frame in seven drawn: fine 305, mid 2401, far
  2909 strokes off the ground or out of their ring, worst 89 m; quality 0: fine 1259, worst 14 m); passes now. World
  tests 22 -> 24. Proof in the game: `preship/01-leaf-column-before-after.jpg` (opened): top, quality 2 at 960x540 on
  the head (the column and the cascade), the same page with the land hidden (the forest's sheets on a tilted plane),
  the same page after forcing a whole upload (gone, and the meadow's own tufts and flowers appear: they had been
  missing); bottom, the PHYSICS verifier's own scripts (`sessionD.mjs` quality 2, `sessionC.mjs` quality 0, 960x540) on
  the fix: no leaf in the sky (the sessions' logs: no console error, no game error, fallback empty), and sessionC on the
  head at quality 0 with the dabs at the upper left. (The verifier's head was `e380647`, before PILOT's +1530 s on the
  weather clock: the fix's frames are in a lighter snow at the same clock; the column never depended on the weather.)
  Checks on a clean export of `1294633` with these two files (`t1`): world 24, unit 184, physics 325, `coast.mjs` PASS
  at both stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as before), `wallrun.mjs` Earth sea_coast
  0.2 / 0.2 / 0.2 m on ground over 50 degrees (as before); the game at quality 2 and 0 (the two sessions): no console
  error, fallback empty.
- **ITEM 2, STAIR-STEPPED SILHOUETTES AT TIER 0 AND HALF SCALE: DONE.** At quality 0 and render scale 0.5 the scene is
  drawn at 298x167 for a 960x540 sheet (0.62 x 0.5); the sheet read it with a plain bilinear lookup, which enlarged
  every stair of an aliased edge into a block three pixels a side (and the edge pooling, which reads the same
  neighbours, put a dark pixel on each corner). `render/post.js SHEET_FRAG`: where the sheet is drawn over 1.15 times
  the scene's size (`up`, eased in to 1.9), the picture is read through a smooth cubic B-spline (four bilinear taps,
  `pcCubic`) at a place the paper's tooth shakes by up to 0.6 of a scene pixel (`shake`, two lookups of the paper's
  grain; the pencil follows it). A stair becomes a soft edge with a little tremor in it. At full scale (`up` 1: the top
  tier, quality 1 at scale 1 is 1.25, nearly nothing) the old lookup is used unchanged. Tried and not kept: a blend
  of 0.7 cubic and 0.3 bilinear (the stairs still showed on the coat's edge). Seen, same page and instant with only the
  lookup switched (`preship/02-soft-enlargement-q0-half-scale.jpg`, opened: the Earth spawn, the figure, Mars at 23:30
  with the ship, the ship in flight, crops enlarged 2x): the blocks on the figure, the hull and the canopy are gone;
  the picture as a whole is a little softer. Cost at quality 0, scale 0.5, 960x540 (eight drawn frames, three runs
  each, nothing else running): 420 ms a frame before, 425 after, inside the runs' own spread (409 to 436).
  Checks on a clean export of `b0710fe` with this file (`t3`): world 24, unit 192, physics 325, `coast.mjs` PASS at both
  stands, `ghostfield.mjs` all zeros, `wallrun.mjs` 0.2 / 0.2 / 0.2 m; the game at quality 0 (the frames above, on
  `1294633` with the same file): no console error, fallback empty. The top tier: by the code the old lookup (`soft`
  0); one frame at quality 2 is taken in the session of item 3 (named below when taken).
  Top tier, taken: `preship/04-top-tier-q2.jpg` top left (opened): the Earth spawn at quality 2 on the final code, as
  crisp as before (no console error, fallback empty).
- **ITEM 3, FLAT FRAMES (Uranus' Pearl Fog Flats, Mars at night, Venus' haze): DONE, Venus in part.** Three changes,
  each seen before and after at the play-test's settings (quality 0, scale 0.5, 960x540) and at quality 2:
  (a) FOG IN BANKS (`render/chunks.js FOG_BANK pcFogBank`, used by the terrain's fragment and the props' and the near
  strokes' vertex fog in `render/materials.js`; `uFogBank` a body uniform in `render/shared.js`, set in
  `world/index.js` from the biomes under the eye: look `bank`/`bankSize`, a biome's own `bank` over the look's). Where
  a world's fog lies thick it lies in drifts anchored to the land, layered (three times faster with height than along
  the ground), and the distance the fog is reckoned at is scaled by them: a thin drift shows the land a step darker, a
  thick one takes it a little sooner; the far end still goes to the air. Worlds that say nothing are unchanged
  (`bank` 0: every look but Uranus and Venus). Uranus `pearl_fog` bank 1.0 at 150 m; Venus bank 0.6 at 700 m, its
  `pale_mesas` 0 (the mesas stand above the fog; with banks the far mesas went to leopard spots). Tried and taken out:
  blots alike in three dimensions (dark spots over Venus' mesa faces), thick drifts up to 1.4 times the distance (the
  near flats on Uranus went paler), Venus at 0.9 / 260 m (spots on the far mesas).
  (b) PATCHES: Uranus' Pearl Fog Flats get pools of pearl-lilac shadow (a third `t.patch`, the white patch smaller,
  the mint deeper) and the splinters' shaded side a step darker (0.60, 0.62, 0.80; 0.70, 0.70, 0.86 before); Venus'
  pale mesas get broad patches of shadowed raw sienna and rose (`t.patch`; on their own view they hardly show).
  (c) NIGHT: Mars keeps a lighter band low in its night sky (`looks/common.js mkSky` takes `nightHorizon`; Mars 0.90,
  0.86, 0.88, it was 0.71, 0.69, 0.71), and on every world with air the sheet lays a graded darker wash over the near
  land at night (`render/post.js`: land within about 20 m, easing out by 160 m, over the lower part of the sheet; the
  figure, the ship and the lights keep theirs). Tried and taken out: the ground and water alone (the sward's strokes
  stood on it as pale cut-outs). (RE-FIX, above: the near-land wash is now Mars' own, a look's `nightNear`; on every
  world it made Earth's nocturnes flatter.)
  Measured (`bands.py`: L* medians of six bands top to bottom; the 10-90 spread), quality 0: Uranus' view 7.2 -> 9.9
  (lower bands 89.5 / 87.2 / 85.6 -> 87.9 / 85.1 / 84.9), turned 120 degrees 7.4 -> 10.3; Venus 225 m up 22.2 -> 24.6;
  Venus' pale mesas 13.4 -> 13.4 (not improved: no banks there by choice, the patches do not show from the stand); Mars
  at 23:30 19.2 -> 33.0 (sky band 51.7 -> 59.2, near ground 35.4 -> 30.2); Mars' polar frost 15.3 -> 23.7; Earth at
  23:30 19.6 -> 20.0 (near ground 40.8 -> 35.6, the crowns as before). Quality 2: Uranus 7.9 -> 11.9 / 10.6, Mars 24.0
  -> 36.6, frost 15.9 -> 24.3. Frames (opened): `preship/03-flat-frames-q0-before-after.jpg` (head `25074de` against
  this, seven views) and `preship/04-top-tier-q2.jpg` (the same page with the live parts switched off and on; Uranus'
  patch colours are in both). Judged: Uranus keeps its pale calm with a soft darker band and splinters in depth; Mars
  by night is three washes and the groves stand against the band; Venus from the air has broken slopes and banded
  mesas; Earth's night is a little darker at the feet (FIX 1's frame was not shot again at the top tier with its own
  clock). Not measured: the frame time with the banks (two texture lookups a fragment on the terrain of Uranus and
  Venus only). Not seen: Venus at quality 2 with the final numbers (seen at 0.9 / 260 m, then the final at quality 0).
  Checks on a clean export of `5ba725f` with these files (`t7`): world 24, unit 198, physics 325, `coast.mjs` PASS at
  both stands, `ghostfield.mjs` all zeros (0.26 / 0.52 as before), `wallrun.mjs` 0.2 / 0.2 / 0.2 m; the game at quality
  0 on `t7` (loaded, Uranus' view drawn): no console error, no game error, fallback empty. (A slip, logged: I copied the
  final `venus.js` into the tree a running browser served, `t6`; the page had loaded its modules long before and its
  live values were set by hand to the same numbers; every check above is on `t7`, made after that browser closed.)
- **ITEM 4a, THE URANUS VIEW SKETCH'S DARK WASH (MINOR 12): the cause found, the change written for PILOT (their file).**
  `src/core/sketches.js sketchHand` spreads the frame's own range of tones over every ink ("a dusk and a noon both
  read"), with a floor of 0.15 on the span. A fog frame with the figure hidden (the game hides it for a sketch) spans
  only about 0.80 to 0.95 of luminance, so the palest fog went to paper and the slightly less pale fog to the middle and
  dark inks: a grey-brown wash with dark blots. Run in Node on 256x144 crops of my frames with the figure painted out
  (`preship/05-uranus-sketch-for-pilot.jpg`, opened): today a dark mottled wash; with the change a pale fog sketch.
  The Earth spawn, Mars at night and Venus from the air come out byte for byte the same (mean difference 0.0); the two
  Uranus frames 14.1 and 4.1 of 255 lighter on average. **For PILOT, the exact change** (line 83 of `sketches.js`):
  `const span = Math.max(0.15, hi - lo), F = 192 / w;` becomes
  `const span = Math.max(0.45, hi - lo), F = 192 / w; lo = Math.min(lo, hi - span);` (and `lo` must then be declared
  with `let`, which it is, line 78). A frame's tones are then stretched only when they span less than 0.45 from its lightest
  down, so a pale frame stays a pale sketch and a dark one is still read. (If a named number is wanted:
  `SKETCH_HAND.minSpan: 0.45`.) The captions (both Uranus sketches "Pearl Fog Flats") and Venus' landscape sketch with
  the ship in it are PILOT's too; not looked into.
- **ITEM 4b, THE CLIMB TO SPACE (MINOR 10): NOT DONE, by choice.** The sky's change between 300 m and 1.3 km is the edge
  of the air that `e784574` laid and `91fd6bf` re-fixed, each verified at stations 500 to 760 m (the verifier's dots,
  the far world's veil). Spreading it over a longer climb moves those verified frames and `space01` (the sky's stars,
  the far worlds' veil, PILOT's `inSpace01` mood), and the atmosphere's height is PILOT's (`bodies.js`); to judge it the
  climb has to be filmed frame by frame at both tiers, which this round had no time left for after items 1 to 3. A
  successor who takes it: `world/sky.js spEdge` and `world/index.js` `space01` (the 0.55 / 1.15 of `atmosphereHeight`).

An independent verifier checked the fix round below and did not accept one item (the figure) and found three
regressions. This pass fixes exactly those. Began 09:30 UTC, 2026-11-13, on head `a686a98`. Scratch and harness:
`/home/user/.pc-scratch/painter/m4/refix/` (trees `t1`, `t2`: a clean export of the head with PAINTER's working tree
over it, by `../fix/mk.sh`; `h0` the head as it was, `b0` the head with `21aa969`'s `models.js`; `node/gait.mjs`,
`node/swim.mjs` (the verifier's instruments, run with `node --import node/reg.mjs`), `node/gaitcmp.py <a.json> <b.json>`;
the live browser is the seventeenth's `../fix/live3.mjs` with `send.sh`; `helpers3.js` is the verifier's `__tree`).
The verifier's own files: `/home/user/.pc-scratch/verify/painter/` (`out/`, `node/`, `h/`). Evidence kept:
`docs/shots/painter/m4fix/14-..` onward (every picture named here was opened by me).

- **RE-FIX 1, THE WALK AND THE RUN (the verifier's regression 1; PHYSICS 1, 2, 5 not accepted for it): DONE.**
  `art/models.js leg()`: the local swing weight was named `sw` and hid the swim weight `sw = w.swim` of the enclosing
  function, so the three lines `7d27bf4` added inside `leg()` (the swim blend and the kick's splay) ran on the swing
  weight: on land every swinging leg was pulled to the tread-water pose, afloat the kick hung on the stride PHYSICS
  happened to hold. The local is now `swing`; the three lines read the swim weight. Nothing else in the file changed.
  Measured with the verifier's `gait.mjs` (the real Sim, PHYSICS' explorer on the stub ground, ankles read from the
  matrix palette), `21aa969`'s `models.js` in today's tree against the head and against the re-fix, the same strides:
  the ankle's greatest distance from its place before, head: 0.66 m at the 4.0 m/s pace, 0.71 m at the 7.2 m/s run,
  0.36 m strolling, 0.03 m standing; re-fix: 0.002 m, 0.003 m, 0.001 m, 0.000 m (knees within 0.001 m; I take what is left
  to be the lean into the wind, which `21aa969`'s model had not: not traced). Against the verifier's own `gait-before.json` (tree `21aa969`): 0.002,
  0.004, 0.021 (stroll: PHYSICS' gait itself moved a little since), 0.000 m. Afloat (`swim.mjs`): on the head neither
  knee moved at a held stride of 0 or 0.5 and one leg only at 0.25 or 0.75; now both knees bend 0.22 to 1.27 rad at a
  swim and 0.24 to 0.56 rad treading, at every stride. New test, in PAINTER's paths (the unit tests are PILOT's and
  did not catch it): `src/world/figure.test.mjs`, two cases, "on land the boot is where the foot is, through the whole
  swing" (within 0.06 m ahead of the hips at 1.6, 4.2 and 7.2 m/s, never under the foot) and "afloat both legs kick
  with the stroke, whatever stride is held": both FAIL on the head `a686a98`, the first passes and the second fails on
  `21aa969`'s model (it had no swimmer), both pass now. World tests 20 -> 22.
  Seen in the game (quality 1, 640x360, the verifier's own command: D held at the Earth spawn, sixteen frames a
  thirtieth of a second apart, and the same with Shift for the run): `m4fix/14-refix-walk-run.jpg` (opened: top, the
  verifier's strip on `21aa969`; second, its strip on the head: legs bunched, the swing boot dragging; third, the
  re-fix: the knee lifts and the stride opens as on `21aa969`; bottom, the run on the re-fix: the heel folds up in
  flight and the long stride reaches; last, Mars at quality 0, the verifier's command: the knee lifts and the stride
  opens there too). The swim and the tread at Earth's coast seen again (scratch `out/swim-refix.jpg`: as accepted; the
  legs are under water, so the kick of both legs is in the numbers and not in a picture).
- **RE-FIX 2, TRUNKS NEAR THE EYE (the verifier's regression 2): DONE.** `render/materials.js PROP_FRAG`: the crown's
  dissolve (over 1.7 m above a plant's foot, within 3.6 m of the eye) is for the crown's own washes (part 1) and its
  thin branches (bark laid with a twig's shade, `vData.z > 0.5`: `florakit.js` gives a trunk 0 and a branch 0.7 or
  0.8) and for nothing else. A trunk, a blade (a tall reed, a kelp ribbon), an accent and a stone (an ice needle, a
  fungal tower, a spire: part 4) part only right at the lens, within 1.6 m, by the older rule, as on `21aa969`.
  Seen (`m4fix/15-refix-trunk-crown.jpg`, opened: top two, the verifier's sheets at quality 0 on `21aa969` and on the
  head, where the birch 1.8 m off is floating white blocks; third, the re-fix at quality 0, the verifier's own five
  stands: the trunk whole at 1.8 m as at 2.5 and 3.2 m; fourth, quality 1: first person 1.2, 1.8 and 2.5 m from the
  same birch looking up 20 degrees, and 1.8 m looking up 55 degrees: one whole stroke up into the crown; bottom, a
  jet up through the crown at quality 1: the crown still breaks into separate dabs with the picture between them and
  its branches into dashes, as accepted). Not seen: another world's tall props (an ice needle, a fungal tower, kelp)
  at the lens: by the rule they are as on `21aa969`.
- **Checks for RE-FIX 1 and 2** on a clean export of `a686a98` with these files (`t1`): world 22 (20 and the two new),
  unit 181, physics 324, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as
  before); the game at quality 1 and at quality 0 through every scene above: no console error, fallback empty.
- **RE-FIX 3 (minor), THE FAR WORLD BELOW THE EDGE OF THE AIR (the verifier's regression 3): DONE.** Cause: the far
  world's veil (`world/index.js`, "far bodies: plain daylight") thinned with the altitude alone, `(1 - space01)`, and
  went into the blue of the ground's sky, while `e784574` made the sky itself paper-pale below the edge: at 600 m a
  far world stood at half its own wash on near paper, a dark grey dot. Now the veil follows the sky's own two washes
  (`sky.js spEdge`, the same numbers, taken a tenth higher because the edge wanders): a far world whose ground is
  still the thin pale sky keeps the day's veil (0.72), and into that sky's own pale wash (`uHaze` run toward paper as
  the sky is); as the sky pales a little more veil (to 0.84 at most), so the mark is never stronger than it is from
  the ground; it clears as the indigo comes down over it, and eases out as the air ends (no step at `space01` 1). On
  the ground, at night and in space the numbers are the ones before (read in the page: the ground at 10:30, veil 0.72,
  haze 0.755 0.848 0.945; 650 m at midnight, veil 0; 700 m by day: Mercury, Venus and Saturn on the indigo veil 0, the
  Moon and Jupiter below the edge 0.83).
  Measured at quality 1, 640x360, the darkest of the dab against the sky round it, in 255ths: the head at 600 m 71
  darker; now 25 at 600 m, 26 at 500 m, 26 from 60 m (the ground's look, which is unchanged); the second dot at
  650 m (left of the ship) 17 darker on the head, not to be found now (7, the paper's own grain).
  `m4fix/16-refix-far-world-below-the-edge.jpg` (opened: top, the head's 600, 650, 700 and 760 m with the dark dot at
  600 m; middle, the re-fix at 500 to 760 m and 650 m at midnight: a faint mark at 500 and 600 m, nothing dark on the
  pale sky at 650 m, pale and gold worlds on the indigo from 650 m up; bottom, the dot four times enlarged, head
  against re-fix against the ground). The choice, logged: a far world by day stays the faint grey mark it has always
  been from the ground (not a lifted pale disc): changing the ground's look is outside this pass.
- **Checks on the final tree** (a clean export of `5de71a7` with `world/index.js`, `t4`): world 22, unit 181, physics
  324, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros; the game at quality 1 through the edge of the air,
  a jet and its arc (arms in rising, a little out falling: as accepted), a walk: no console error, fallback empty.
- **THE TOP TIER, once, on the final tree: DONE** (quality 2, 960x540; no console error, fallback empty):
  `m4fix/17-refix-top-tier-final-tree.jpg` (opened: top, the verifier's strip of the head's side walk, legs bunched;
  second, the same command on the re-fix: the knee lifts and the stride opens; third, first person 1.8 m from the
  birch looking up 20 degrees: one whole trunk; a jet up through the crown: dabs with the picture between them; the
  edge of the air at 600, 650, 700 m: a faint mark near the sun at 600 m (22 of 255 darker than its sky), the
  verifier's dot at 650 m 24 darker on the head and 13 now, pale worlds on the indigo; fourth, those marks enlarged).
- **One part of the verifier's regression 2 I judge not to be the crown's dissolve, shown by a frame.** "At the top
  tier the trunk in L2/crown-00.jpg ends in mid-air": in the jet's first frame the camera sits toward the trunk and
  the trunk stands between the lens and the figure; what cuts it is the figure's FOCUS WINDOW (`PROP_FRAG`: "strokes
  that stand between the lens and the explorer's figure part round the line of sight to it"), a rule older than
  `7d27bf4`. Proof (bottom row of `m4fix/17-..`): the same instant on the head (the verifier's frame), on the re-fix
  (the trunk ends at the same place), and on the re-fix with the focus window switched off in the live page only
  (`__hp.patch`): the trunk is whole from the top of the frame to the ground and stands across the figure. The same
  parted trunk is in the verifier's own frames of `21aa969` (`B1/crown-00.jpg`, `B1/crown-01.jpg`: the trunk cut in
  the middle with its foot standing below). Left as it is: the window is what keeps the figure in sight.
- **Commits of the pass**: `5de71a7` (RE-FIX 1 and 2), `91fd6bf` (RE-FIX 3), and this hand-over with the top tier's
  evidence. The working tree's code is the checked tree's (`t4`) to the byte.
- **Not verified, said plainly**: another world's tall props at the lens (ice needles, fungal towers, kelp: by the
  rule they are as on `21aa969`); the far world's veil on a world other than the Earth and in motion (stations at 60
  to 760 m, not a film of the climb); the kick of both legs afloat in a picture (the legs are under water: numbers
  and the new test only); the wind frames in Neptune's squall were not taken again (the lean, the cloth and the arms
  are code this pass did not touch; a jet and its arc were seen again at quality 1: arms in rising, as accepted).
- **What is next, if a successor reads this**: nothing of this pass is open. The list "Still to do" in the block
  below stands as the seventeenth left it.

## Hand-over of the M4 fix round (sixteenth and seventeenth PAINTER agents; READ THIS FIRST)

The sixteenth agent began the round at 04:09 UTC and was cut off by a container restart at 05:08; the seventeenth took
over at 05:11 (2026-11-13). Each item is committed as soon as it is finished; this block is brought up to date after
each. Evidence: `docs/shots/painter/m4fix/` (every picture named here was opened by the agent that names it).
Scratch and harness: `/home/user/.pc-scratch/painter/m4/fix/` (`mk.sh <dir>`: a clean export of the head with PAINTER's
working-tree paths over it; `live2.mjs <tree> <out> <quality> <WxH>`: one browser kept open on the real game, commands
sent as files with `send.sh <out> <name> < body.js` (directives `//! place`, `//! run s dt`, `//! canvas name`,
`//! problems`, `//! quit`); `helpers.js` (`__go(body, { biome, T, hour, ship, altitude, pitchDeg })`); `tone.py`
(L* percentiles of a frame inside the border); `sheet.py` (a labelled contact sheet); `s17/checks.sh <tree> <out>`:
the project's five checks one after another).
`live3.mjs` is `live2.mjs` with `//! keydown Code`, `//! keyup Code`, `//! drag dx dy`, `//! film name frames every dt`
and `//! probe`; `helpers2.js` adds `__coast(body, biome, T, back, hour)` (stand on the beach facing the sea) and
`__orbit(body, k, hour, pitch, dir)`; `s17/figcheck.mjs <tree>` (the explorer's `animate` over 4536 states in Node:
`node --import /home/user/.pc-scratch/painter/m14/tools/reg.mjs s17/figcheck.mjs <tree>`).
**Commits of the round**: `b579366` (FIX 1, the sixteenth), then the seventeenth's on `21aa969`: `608b687` (FIX 2),
`70aec16` (FIX 3 and 4), `7d27bf4` (PHYSICS' five and FIX 5), `e784574` (the edge of the air), `a8437ca` (the
arrival veil). Checks on a clean export of the last one's tree: world 20, unit 181, physics 314, `coast.mjs` PASS at
both stands, `ghostfield.mjs` all zeros; the game loads at quality 0, 1 and 2 with no console error, fallback empty.

- **FIX 1, night in its own key: DONE** (sixteenth, commit `b579366`; its message has every number). The moon is the
  light at night (`uMoon`, `chunks.js pcLevel`), the sheet's night key no longer runs the middle values together, the
  night sky is two steps lighter than the wood, the cabin glass is the one warm accent. Seen again by the seventeenth
  at the top tier on the final tree of FIX 2 (`m4fix/02-mist-pair.jpg`, bottom right: fair midnight, median L* 38.7,
  10-90 spread 20.2; the meadow lighter than the wood, the sky lighter than both, white birches, the lit cabin).
- **FIX 2, the storm and mist key, visible rain: DONE** (sixteenth's work in the coordinator's snapshot `3def4e7`,
  finished by the seventeenth). What changed: (a) rain is a stroke LIFTED out of the darks and drawn down darker on
  a light sky: `kitmat.js` rain reads the scene's colour behind it (`G.uSceneCol`, set in `post.js`) and lays a pale
  mark over a dark passage, a darker one over a light sky, fainter over a middle value; `world/index.js` draws it as
  long thin strokes (2.4 to 2.8 px wide at any distance, up to 2.4 m long, half of PHYSICS' drops; it was 6.5 cm wide,
  never under 5 px, a sixth drawn: some thirty stubby rectangles); (b) the storm's key on the sheet at 0.55 of its
  weight (`post.js`: `d += uWxSheet.x * 0.55 * ...`), the lit side of a form under a storm keeps its local wash
  (`chunks.js pcLevel`: 0.25 + 0.36 x), the sky's storm masses a little thinner with shallower bellies (`world/sky.js`
  `mass`), so the closed sky is no longer the darkest thing in the picture; (c) the border's pooled lip is not laid
  again on a dark wash (`post.js`: `lip ... * mix(1.0, 0.25, dark)`): the paper border is clean in a storm; (d) under
  the moon a mist takes more of the far washes (`world/index.js`: `fogW * (0.7 + 0.3 * (1 - dayness))`); (e) regions:
  7 is what flies in the air, 8 a light of its own (`chunks.js`, `post.js`, `materials.js FIG_FRAG`).
  Measured at the top tier, 960x540, the spawn at 240 s of a new game (PILOT's frame against mine, `tone.py`):
  median L* 26.7 -> 41.3, the darkest hundredth 8.2 -> 24.8, under L* 12: 2.3 % -> 0.1 %, 10-90 spread 12.9 -> 21.6;
  the mist at 600 s: median 28.8 -> 40.0, spread 13.2 -> 22.6. Frames opened: `m4fix/02-storm-pair.jpg` (rain strokes
  pale over the wood and dark against the pale sky, a clean border, the far wood lost in a pale veil, the sky's dark
  undersides lighter than the wood), `m4fix/02-mist-pair.jpg`, `m4fix/02-neptune-squall-after.jpg` (Neptune's storm
  coast in its squall, T 240, 88 m/s: still a wet indigo sky over a pale veil; under L* 12: 0.3 %). Tried and not
  kept: the sheet's key at 0.45 with the thinner masses the sixteenth had live (Neptune's squall went to a pale grey
  day: the midpoint is what is in the files). Not verified: quality 0 (the rain's draw is the same code at every tier).

- **FIX 3, round worlds from orbit, Neptune's belts, Pluto's heart: DONE** (seventeenth). (a) `chunks.js pcRound`,
  `uRound` (a body uniform, `shared.js`, `materials.js baseUniforms`; set per body in `world/index.js`): from a third of
  a radius up the relief is DRAWN in toward the datum sphere (the sea's level where there is one), to a quarter of
  itself from 0.8 radii; only the drawn position moves (terrain, water, and every prop by its foot: `TERRAIN_VERT`,
  `WATER_VERT`, `PROP_VERT`), the body coordinates the washes are laid by stay, so nothing swims as the ship climbs; on
  the ground the uniform is 0 and nothing changes. A far world (Earth in the Moon's sky) gets the same. Tried at a
  third (0.66): Earth's alpine range was still a bump on the limb. (b) Neptune: the belts turn about the look's own
  axis (`deck.axis`, tilted 45 degrees; `orbit.js uAxis`): the first landing is at 72 degrees north and belts about the
  body's pole were rings concentric with the limb from above it; six belts, less push at their edges, the dark belt a
  step lighter, streaks 0.4 -> 0.15, and no sunlit wash on the deck (`deck.matte`). (c) Pluto: `heart: { over:
  'heart_glacier', size: 0.40 }`: one pale cream wash in the shape of a heart laid over the far ground at the heart
  glacier's first site, with a thin tholin line at its edge, only from orbit (`uHeart`, `TERRAIN_FRAG`; it fades out
  with the relief below 0.8 radii). Frames opened (quality 1, 640x360, one radius up over each spawn, looking down):
  `m4fix/03-orbits-after.jpg` (all ten: every limb one curve with a hand's wobble; Neptune a banded blue world; Mars,
  the Moon, Mercury, Venus, Jupiter, Saturn, Uranus as they were but round), `m4fix/03-orbits-before-pilot12.jpg`
  (PILOT's six frames), `m4fix/03-orbit-more-after.jpg` (Pluto from over its heart; Earth from 2 km and 1.5 km up: a
  globe with a clean limb; Earth as a round ball in the Moon's sky). Pluto's heart is 56 degrees from its spawn: from
  straight over the spawn it lies at the limb. Not verified: the top tier; the climb filmed frame by frame (the relief
  eases in between 0.35 and 0.8 radii of altitude: I looked at 600 m, 1.5 km and 2 km only).
- **FIX 4, Jupiter's arrival palette: DONE in part** (seventeenth). `looks/jupiter.js`: the sky-islands' sward is
  ochre-olive (patches 0.52, 0.68, 0.34 -> 0.80, 0.72, 0.40 and 0.36, 0.54, 0.34 -> 0.60, 0.56, 0.34; `oliveGreen` for
  `sapGreen`), its grass and bushes cream to rust (`under`), its trees a fifth tall kind, the broadleaf in cream, ochre
  and rust (the green broadleaf stays in the Hanging Gardens; same `obs`, so PHYSICS' obstacles are unchanged).
  `m4fix/04-jupiter-pair.jpg` (opened: a gold meadow with rust crowns under the orange belts). NOT done: the island's
  edge and the cloud sea in the first view (I looked at headings 150, 240 and 330 from the spawn: the bench is ringed
  by its own land; it needs another spawn, which moves PILOT's and PHYSICS' instruments: not in a final round), the
  far islands' level tops.

- **PHYSICS 1, 2, 5, THE FIGURE: DONE** (seventeenth; `art/models.js createExplorer animate`; it reads PILOT's fields,
  "For PAINTER (M4)" at the top of `docs/notes/pilot.md`; all in the figure's own axes). (1) The wind: the torso tips
  about the hips by PHYSICS' own `leanFwd` / `leanRight` (0.92 of it) and the legs stay under it; in the gale's crouch
  (`hunker01`) the head goes down and the arms come in and forward (they were held out by the hips' fold); the coat's
  skirt is blown downwind by `windLoad01` and flaps with `gust01`; the scarf's tail streams along the air past the body
  (`windFwd`, `windRight`, `windUp`), flat out when the load is whole, with a droop kept so that from behind it lies
  across the shoulder and not across the hat, and round the shoulder when the air comes from behind. (2) The swimmer:
  `swims: true` is returned, so `game.js` hands the model the 'swim' mode; the body lies forward (0.30 rad treading,
  1.2 rad at a swim), the shoulders at the waterline (`submerged01`), the back awash at a swim; the arms reach ahead
  together, sweep out and back and come forward under the chest once a `stroke`; a frog kick at a swim, a slow scissor
  and sculling arms treading water. (5) The air: with PHYSICS' `arc`, rising the arms are in and the legs trail;
  coasting down the arms are a little out and the knees give; the skydiver's spread only after a second of FALLING
  (counted in the model: `airTime` runs from the moment the feet left the ground) or faster than 8 m/s down; in the
  last metre and a half the arms come forward and the legs are ready. Without those fields the old poses stand.
  Seen at quality 1, 640x360 (strips in scratch `s17/L6`, `s17/L7`; kept: `m4fix/05-figure.jpg`): a jet and its arc
  frame by frame (arms in while rising, a little out at the top, spread from one second of falling, forward before the
  ground, no spread after landing), the swim and the tread at Earth's coast, Earth's thunderstorm (the scarf blown to
  the side, the coat displaced; PHYSICS' lean there is 0.03 rad), Neptune's squall (crouched, head down, the scarf
  streaming, lean by PHYSICS' number of the instant). Node: `s17/figcheck.mjs`: 4536 states of every mode, arc, lean,
  load and wind: no NaN in any bone. Not done: PILOT's item 13 (the idle "peg doll": one hand at the strap needs an
  elbow the one-bone arm has not).
- **PHYSICS 3 / PILOT 9, A CROWN AT THE LENS: DONE** (`materials.js PROP_FRAG`): what stands more than 1.7 m over a
  plant's foot (`vAbove`: crowns and their branches, not the grass, ferns or bushes) and within 3.6 m of the eye breaks
  into separate dabs with the picture between them, fewer the nearer. Seen at quality 1: a walk under the wood's
  edge and a jet up through a crown (`m4fix/06-crown-at-the-lens.jpg`): the near crown is a cluster of broken dabs,
  not one slab. The dabs are hard-edged dark touches (a pine's shadow green): a softer edge needs a blend the opaque
  pass has not.
- **PHYSICS 4, THE STORM SEA'S WHITE WATER: DONE for the squall, in part for Earth's coast** (`materials.js
  WATER_FRAG`). Beyond a white share of 0.15 (`sea.w`; PHYSICS P26 lifted the cap) the crests' foam is blown into
  streaks along the wind (a pattern drawn out twelve to one, sized to the distance), and from a half up the streaks
  close and the whole sea rises toward the paper with the waves' own values in it (troughs greyer, crest fronts
  paper, torn): Neptune's squall, 100 % white by PHYSICS, is a pale driven sea with darker bands, no longer the dark
  indigo band, and not a flat white sheet (`m4fix/07-storm-seas.jpg`). To a gale: the surf zone PHYSICS gives is laid
  as torn foam where the waves are finer than the brush; the swash runs further up the beach and its lace is closer
  from Hs 0.3 m; a few more white horses (`horseTh`). Earth's coast in its 13 m/s storm (5 % white), top tier: a
  broken white swash line along the beach and pale streaks on the sea (`m4fix/07-storm-seas.jpg`, opened); still no
  crisp white horses: the brush (the abstraction pass keeps nothing under three pixels) softens them to pale streaks.
  An instrument's trap met again here: after a debug teleport from the wood to the beach the wood's tufts and leaves
  hang in the air (the fifteenth's own-side 11); teleport by way of another body first. Not done: spume in the air off the crests.
- **FIX 5, Uranus' and Pluto's first views: DONE in part** (`world/nearground.js needly`: splinters in drifts, larger
  companies with bare ground between; `looks/uranus.js`: the blue ice under the frost a deep teal in broad passages
  (0.18, 0.46, 0.58 over 90 m at 0.72; 0.30, 0.60, 0.68 over 47 m at 0.5 before), the needles' shadow side deep teal,
  fewer standing shards; `looks/pluto.js`: a fourth ground wash on the Lilac Mountains, broad passages of deep violet,
  the penitents' shadow side deeper). Uranus' arrival, quality 1: 10-90 spread of L* 15.0 -> 25.7, median 85 -> 78:
  a pale mint sky over a deep teal ice field with dark seams; at the top tier, PILOT's frame against mine: spread
  14.9 -> 25.2, median 85.5 -> 78.4 (`m4fix/08-uranus-pluto-arrivals.jpg`, opened). Pluto's arrival: a deeper violet
  ground under pale rose mountains, the splinters in one drift with bare ground round it; its spread did not grow
  (top tier 20.4 -> 18.8, median 70.8 -> 62.7): the ground went darker as one mass. NOT done: Pluto's long shadows (a violet glaze
  stretched from every splinter and stone needs shadow marks that turn with the sun in `NEAR_VERT`: not a final-round
  change), a low sun.

- **PILOT's item 10 (lower-ranked), the grey-violet mud below the edge of the air: DONE** (`world/sky.js`): the day's
  sky and space are no longer mixed half and half over the whole sky. As the air thins the day's sky runs out toward
  bare paper, and space is a second wash that comes down from the zenith with a wet, wandering edge and a pale bloom
  where it stops; a star lies only where its ground is already indigo (`starOK` follows the wash). On the ground, in
  space and at night on the ground nothing changes (checked by reading and in frames: the spawn at ten, first person
  looking up at midnight, the Moon). `m4fix/11-edge-of-the-air.jpg` (opened; quality 1): before, Earth at 600 m and
  PILOT's frame at 703 m (one flat grey-violet with stars on it); after, 600, 650, 700, 760 m, 650 m at midnight, and
  the same edge on Mars, Jupiter, Venus and Neptune. Not verified: the top tier; the climb in motion (the edge comes
  down with altitude; I looked at stations, not at a film).
- **Own-side 1 of the fifteenth's list, the arrival veil trips on a fast ship: DONE** (`world/arrival.js`, new and
  pure; `world/index.js`): a leap of the eye is an arrival only where the frame before does not explain it (flight is
  one leap after another of about the same length). Before, any frame of more than 60 m held the picture as bare
  paper, and for as long as the ship was fast: at four frames a second from 265 m/s (measured: the ship 2300 m over
  the spawn, Shift+W, 40 steps of 0.25 s: `SHEET.laid` 0 from 265 m/s to the end of the run; after: 1 throughout; a
  debug teleport still holds the picture: `m4fix/12-arrival-veil.txt`; the frame after the run opened: a painting).
  New test, failing on the commit before (the module is not there): `src/world/arrival.test.mjs`, "M4 arrival: a leap
  is an arrival only where the frame before does not explain it" (world tests 19 -> 20).
- **The final tree (`a8437ca`'s files) seen at the top tier and at quality 0** (no console error, fallback empty):
  `m4fix/13-top-tier-final-tree.jpg` (opened: the edge of the air at 700 m and 620 m, the figure rising after a jet
  with its arms in, coasting down, swimming, treading water); at quality 0 the edge of the air at 700 m and the spawn
  at ten (opened, not kept).
- **Seen on the committed tree at the top tier and at quality 0** (no console error, fallback empty in either):
  `m4fix/09-top-tier-committed-tree.jpg` (Earth, Neptune, Pluto, Mars from orbit; the storm and ten in the morning at
  the spawn), `m4fix/10-quality-0-committed-tree.jpg` (the storm with its rain strokes, a fair midnight, Neptune's
  squall, Earth from orbit, Uranus' arrival, the swimmer).

**Still to do, in this order, if a successor reads this**: (1) what is "in part" above: Jupiter's island edge in the
first view (another spawn), Pluto's long shadows, crisp white horses on Earth's storm coast; (2) PILOT's lower-ranked
items not touched in this round: the canopy's paper (6), Venus' floor and lava (7), the cockpit (8), sticker flowers
and dashed strokes (11), Mars' near shrubs (12), the peg-doll idle (13), the boot cloud (14: the dust veil is lifted
42 % toward paper in `kitmat.js` whatever raised it; a kicked puff could take `lift` by its stream number); (3) the
fifteenth agent's own-side list below, untouched but for its items 3 (night), 4 (the figure) and 9 (rain); its item
11 (the last place's litter in the air after a debug teleport) met again: every evidence frame taken by a teleport
inside one body can show it.

**Rules that bit the seventeenth**: (1) a backtick in a GLSL comment inside a JS template string ends the string
(`node --check` every painter file before an export); (2) `send.sh` needs `<out>/live.log` to exist (a symlink to the
session's log); (3) the top tier takes five to seven minutes to load here with the other roles at work, quality 1 two,
quality 0 under one: iterate at quality 1 and take the top tier once per commit; (4) look data cannot be patched in a
live page, shader strings can (`__hp.patch` in `live2.mjs` / `live3.mjs`); (5) commit one finished item while another
is half written: copy the tested export's painter paths over the working tree, commit, copy the work back (`s17/wip*`).

## Coordinator's relay for the M4 fixer (2026-11-13; read with the hand-over below)

PHYSICS 24 finished block P26 (commits `ee39533`, `a70d668`; hand-over at the top of `docs/notes/physics.md`). For PAINTER:

- **White water: the cap is lifted, and the picture does not show it yet.** At Neptune's `storm_seas` the field now
  hands you a white share of 100 % (Hs 4 m, foamAt -3.0 m); in the game the sea is the same dark indigo as under the
  cap (sea pixels brighter than 100 of 255: 0.98 % -> 1.36 %, the band's median 70 -> 71; the coordinator opened
  `docs/shots/physics/motion-game-gale-neptune-p26.jpg` and agrees). `docs/notes/physics.md`, "For PAINTER / P26",
  names where the share enters `src/render/materials.js` (`foam`, `capFar`/`capTh`, `galeW`/`horseTh`, `capTh2`,
  `farWhite`). The ruling stands: broken foam, streaks and spray, never a flat white sheet; judge it in a frame you open.
  Earth's coast is unchanged to a gale (about 5 % white).
- **The figure's state** is documented in one place: `docs/notes/physics.md`, "For PILOT and PAINTER: the figure's
  state, M4" (`leanV`, `relWind`, `relWindSpeed`, `swim`, `stroke`, `strokeRate`, `swimSpeed`, `vUp`, `airTime`,
  `arc`, `hunker01`, `crouch01`, `clamber01`, `wall`). PILOT's fixer passes it to the drawn figure and writes the
  field names you read under "For PAINTER (M4)" in `docs/notes/pilot.md`.
- **Wading** now throws about five times the spray at a run (48.9 drops in the air at 3 m/s for 8.9), in the same
  `spray` buffer. It has not been filmed: look at it once.

## Hand-over of the M4 critique (fifteenth PAINTER agent; read this first)

- **Done**: `docs/lead/CRITIQUE-PAINTER.md`: "PAINTER on PILOT" (17 items) and "PAINTER on PHYSICS" (10 items), worst
  first, the first five of each FIX FOR SHIP. The whole game played on a clean export of `16bb0d7` at the top tier,
  960 x 540, real keys and mouse, the clock held and stepped: the journey from the loading sheet to walking on Mars with
  no teleport, then weather, night, a view, the sea, a woodland landing by the debug teleport. Evidence (71 pictures, all
  opened; `numbers.txt`; the three logs; the scripts): `docs/shots/painter/critique/`. No console error, warning, game
  error or fall-back in any sitting. No code changed.
- **PILOT's top five**: (1) stepping out frames the ship's wing with the explorer behind it, on every landing; (2) the
  sketches are screenshots and the book a ledger of empty boxes; (3) slips lie on the ship (the target's label through
  the whole pulse), on each other and on the figure; (4) a view is an unmarked 14 m trigger whose composed picture is
  never shown; (5) eleven minutes of Earth's twenty-five are the night key, reached in forty seconds.
  **PHYSICS' top five**: (1) on a fair day nothing moves, and in the thunderstorm the grass still does not; (2) snow as
  unrelated dabs and ruled lines at the lens; (3) the heaviest rain invisible against land; (4) the water takes no mark
  from a wader or a swimmer, and the storm sea reads calm; (5) the gale's wind is noise (77 to 12 m/s in half a second).
- **Own side, found while playing (for PAINTER's fix round, with PILOT's and PHYSICS' items on PAINTER)**:
  1. **The arrival veil trips on a fast ship.** `src/world/index.js`: a leap of the eye of more than 60 m in a frame,
     within 2500 m of the ground, holds the picture as bare paper until the land is laid. PILOT's sim allows 0.25 s a
     frame; the pulse lets go at 820 to 995 m/s 3 to 4 km up. Under 15 frames a second an arrival blanks to paper for
     real (it did at my 0.25 s steps: the journey's frames a21, a22, a27-arrival-01/02, a28-approach-00, not copied).
     Compare the leap with what the ship's speed explains (PILOT's `mood.speed01` or the eye's own velocity) or raise
     the threshold with speed.
  2. **The near grass does not visibly follow the wind**, calm or storm (critique, PHYSICS 1): check `flex` and
     `pcPhysDisplace` in `materials.js NEAR_VERT` against PHYSICS' bend at blade height before asking PHYSICS for more.
  3. **Night**: one flat blue; the ship and the wood one value; the engines do not glow (also PILOT's item 1 on PAINTER).
  4. **The step-out sketch and the figure**: the figure is a smooth-shaded doll close to; no lean, no flying scarf, the
     arms held out in a gale, the fall pose on the way up (PHYSICS' and PILOT's items too). I asked PILOT for `lean`,
     the wind at the figure and the body's acceleration (critique, PILOT 11).
  5. **The ship's shadow on pale ground is a saturated violet blot** (Mars' frost: `pilot-24`, `pilot-27`).
  6. **Far forest dabs above a mist band read as dashes hanging in the sky** (`pilot-29`, landing1, landed).
  7. **Earth's first view is 2418 m from the spawn** (the nearest of any kind 2.3 km); views are named after their
     biome with a numeral ("Crater Fields II"); no easel or cairn stands at a view. Mine: `src/art/easels.js`.
  8. **Water** is a marbled wash without horizontal strokes or glints from the swimmer's eye (`physics-15`); a wader's
     wake, which PHYSICS keeps, does not show: check `pcPhysWake` in my water before asking PHYSICS for more.
  9. **Rain strokes** show only against dark sky (`physics-06`, `physics-07`): darker strokes over light ground.
  10. **Crystal reeds' edges are stair-stepped** on thin diagonals (`physics-22`); **flowers** are still flat white
      ellipses near the lens (`pilot-44`).
  11. **After a teleport, leaves and tufts of the last place hang in the air** (`physics-23`, `physics-24`): owner not
      established; look at `nearground.js update` (the 300 to 900 m branch that keeps marks) before PHYSICS does.
- **Offers made to PILOT in the critique** (do them if PILOT takes them up): a sketch treatment for the kept frame
  (item 2), two or three pigments and a band or ring per world for the map (item 13), a pose for boarding (item 8), a
  lighter hoop and a painted cowl (item 9), a painted easel at each view (item 4).
- **How to work here**: scratch `/home/user/.pc-scratch/painter/m4/crit/` (`scripts/plib.mjs`: the harness;
  `journey.mjs`, `stations.mjs`, `dusk.mjs`; `sheet.py`, `flick.py`; copies in `docs/shots/painter/critique/scripts/`).
- **Rules that bit me**: (1) **`__pc.step` returns when a frame's commands are issued, not when the GPU has drawn
  them**: a run of drawn frames queues minutes of work and the next screenshot waits for all of it (my first journey
  hung ten minutes on one). Read a pixel back after every drawn frame (`plib.mjs`, `C.sync`). (2) **A mouse drag made
  just before a teleport is applied after it**, on the new camera: step a frame first. (3) **The HUD's fades run in real
  time**: wait until the opacities stand still before a screenshot (`uiCalm`). (4) **Steps of 0.25 s in a fast ship trip
  the veil** (own side 1): keep a step under 60 m of travel. (5) **A sketch is kept only when the world has nothing
  left to build**: stand still and `settle()` before waiting for its slip.

## Hand-over closing PAINTER 14's block (written by the fifteenth PAINTER agent, the M4 critic)

PAINTER 14 was cut off by the account's limit before it committed anything itself. Its work is whole in the head, in
four coordinator snapshots: **c8b8309** (stones thinned round first landings, Mars' and Mercury's far washes, frozen
waves, the gold islands, easel room, the rille's bed), **45c5176** and **8809fff** (the forest's paper light in
`materials.js`, the wetland's reed beds in `nearground.js`, the Moon's rilles stand in `easels.js`, looks of Mars, the
Moon, Uranus, Venus, the stacks' treads in `surface.js`) and **76d8182** (its notes below, six sheets, Neptune's deck
streaks, the last of `materials.js` and `nearground.js`). I changed no code of its block.

- **What it changed**: every item is in "PAINTER 14" below (sections 1 to 5) with file, number and verdict. In one line
  each: the forest stand a little lighter (mist 0.95 -> 0.72, paper hearts in sun patches, birches keep a sunlit side);
  fewer stones within 22 m of every first landing (Pluto 37 -> 16, Mercury 10 -> 2); Mars from orbit a rust world with a
  dark marking and a cap; Mercury from orbit no longer a dark disc; Neptune's orbit streaks soft blots; Uranus' frozen
  waves curl; Saturn's walled vista opened (an easel's sixth number, metres of room); the wetland's reeds in beds; the
  Moon's rilles stand moved to the rille's edge with a Payne's grey bed; the stacks' ledge treads lighter.
- **Where the evidence is** (all seven opened by me at full size on 2026-11-13): `docs/shots/painter/p14-first10.jpg`,
  `p14-arrivals.jpg`, `p14-orbits.jpg`, `p14-item4.jpg`, `p14-moon-rilles.jpg`, `p14-wetland.jpg`, and `p14-forest.jpg`.
  The last one is named in section 1 but was never copied out of scratch: I saved PAINTER 14's own pair
  (`m14/pair-tf3.jpg`, head | after, made at 21:15) under that name, after opening the same stand from its final run
  (`m14/s6/F-tf-stand.jpg`): the two "after" frames agree. Its verdicts hold in what I see: the arrivals and orbits pass;
  the forest pair differs by very little (paler depths, lighter birch sides), as its own numbers say (median L* 54 -> 56).
- **Checked by me on a clean export of ca0b3db** (scratch `m4/crit/exp0`): `node --test src/world/*.test.mjs` 19 of 19;
  `node src/physics/coast.mjs` PASS at both stands (Earth sea_coast, Neptune storm_seas). Its final scratch tree (`m14/c5`,
  the tree its own final checks ran on) is byte-identical to the head in `src/render`, `src/world`, `src/art` and
  `src/data/looks` (`diff -rq`): nothing of its block is missing from the head. Not re-run by me for this hand-over: the
  unit and physics suites (the coordinator ran them on 76d8182: unit 152, physics 308), any browser frame of its block.
- **Still weak** (its own ranked list, "Still weak" at the end of "PAINTER 14", is right; the first lines):
  (1) temperate_forest is the lowest-key daylight frame (the canopy closes the sky); (2) Pluto's long_shadow_plain has
  no long shadows; (3) Saturn's and Jupiter's island tables are extruded blocks; (4) Uranus' arrival is one pale value
  range, Venus' arrival a dark brown plain, Mars' near shrubs break into specks, Earth's clouds from orbit are hard
  white blots; (5) Neptune's stacks move little under the storm key, the rille is a valley not a dark cut, the near
  autumn crowns one sienna mass each. Seen by me in its sheets and not in its list: the 650 m frame of `p14-first10`
  (one heavy grey-violet slab of sky over a pale world: the weakest frame of the climb), and the wetland's "kept" frame
  still has a scatter of even grey pebble dots on the bank.
- **Next**: the M4 critique (docs/lead/CRITIQUE-PAINTER.md, PAINTER on PILOT and on PHYSICS) and then the fix round on
  PAINTER's own FIX FOR SHIP items from the other two critiques (docs/lead/CRITIQUE-PHYSICS.md "PHYSICS on PAINTER",
  docs/lead/CRITIQUE.md).

## Handover (read this first if you are a fresh PAINTER)

Written by the fourteenth PAINTER agent (the finishing block before M4: the first ten minutes, every arrival and every
world from orbit, item 6, the ARTPASS weakest list, PAINTER 13's "Still weak"). PAINTER 13's handover is kept below it
("Handover of the headlands, the Moon and Neptune's storm coast"); its rules hold.

- **Where things stand**: see "PAINTER 14" below for every change, its frames (all opened) and the verdict. In short:
  the first ten minutes were filmed on Earth beat by beat (`p14-first10`) and pass as paintings; all ten arrivals and
  all ten worlds from orbit were shot on one clean tree (`p14-arrivals`, `p14-orbits`): Pluto's and Mercury's arrivals no
  longer stand in fields of stones, Mars from orbit is a rust world with a dark marking and a cap, Mercury no longer a
  dark disc in a bright rim; Uranus' frozen waves curl instead of standing as snow peaks; Saturn's walled vista is open;
  the Moon's rilles stand sees its rille; misty_wetland's reeds stand in beds. temperate_forest got paper on its birches'
  sunlit sides and paler depths, but is still the lowest-key daylight frame (see Still weak 1).
- **Next, in this order**: the M4 critique swap. Then, from "Still weak" below: (1) the forest's key (open the canopy);
  (2) Pluto's long shadows; (3) the islands' boxy tables (Saturn, Jupiter); (4) Neptune's stacks under a storm.
- **How to work here**: scratch `/home/user/.pc-scratch/painter/m14/`. `mkexp.sh <name>` (a clean export of the head with
  my changed painter files over it); `v14.mjs <export> <prefix> <steps.json>` (v13 plus `orbit: true` (the tour's orbit
  framing over the spawn, `rings: <outer>` for a ringed world) and `ship: true, altitude, pitchDeg` on a `dir` step);
  `s1.json` .. `s4.json` (the step lists I ran), `pair.py`, `pairs.sh` (s1 | s2 by name), `grid.py` (a labelled sheet),
  `lstat.py` (L* percentiles and paper share of a frame), Node tools in `tools/`: `farmap.mjs` (the far colour of the
  hemisphere under the orbit camera, no light), `reedmap.mjs` + `reedplot.py` (undergrowth plan round a place),
  `treesnear.mjs` (trees and stones round a place in a view's frame: fwd/right), `prof.mjs` (heights and wash along a
  view), `scan.mjs`, `rillestand.mjs` (places that see the rille's bed toward Earth), `canopy.mjs`, `reg.mjs` +
  `three-hook.mjs` (`node --import tools/reg.mjs` loads the three-based modules in Node: a quick check that a module
  still loads before a browser run).
- **Rules that bit me**: (1) **PILOT's `grandtour.mjs --beats 1` at the top tier is too slow here**: with two other
  browsers the game made a frame every 60 to 80 s right after the title (busy building), so three beats took 9 minutes
  and the walk to the ship would have taken an hour; I stopped it and filmed the rest with `v14.mjs` (hold + keys for the
  walk and the jetpack, ship teleports for the climb). (2) **The tour's teleports park the ship next to you**: a terrain
  change moves the berth, and the ship then stands in a frame it was not in (Mars' dunes, Saturn's vista): judge the land,
  not the ship. (3) **The near layer is what the eye reads in a near frame**: the misty wetland's "comb" was the near
  ring's grass flicks and reed stubble (nearground.js), not the flora reeds; changing floraplace alone changed nothing
  visible. (4) The coordinator's snapshots swept my working files into the head three times (c8b8309, 45c5176, 8809fff):
  name them in your commit.

## Handover of the headlands, the Moon and Neptune's storm coast (thirteenth PAINTER agent; kept)

Written by the thirteenth PAINTER agent (the headland regression, the Moon facing Earth, Neptune's storm coast, the
things never seen in a frame, item 5). The twelfth agent's handover is kept below it ("Handover of the coasts and the
art pass's causes"); its rules hold.

- **Where things stand**: see "PAINTER 13" below for every change with its frames (all opened) and verdicts. In short:
  narrow headlands have their height back without the barcode (the barcode was a vertical step at the waterline, not
  the profile); the Moon's arrival, stands and easels are on the near side facing Earth; Neptune's stacks are stepped
  towers with a broken top (their values move little under the storm key), the storm sky's ruled dashes (rain strokes) are gone, white horses read on
  the far sea; kicked dust on airless worlds is grains; the autumn crowns' shade is sienna not mud, Mercury's crystals
  are rose and lilac, Venus' crust gathers by the banks, the twilight key is cooler.
- **Next, in this order**: (1) **PILOT's Moon hour** (For PILOT 2): until `setSunHour` turns a tidally locked body's
  orbit with its spin, every teleport with an hour (the tour, the coordinator's visit, `?body=moon`) moves Earth off
  its place; my Moon frames set `spinPhase.moon = 0` by hand. When PILOT's fix is in, re-shoot the four stands with the
  tour's hour 10. (2) **Neptune's explorer in the gale** (For PHYSICS 6): blown 19 m and up the cliff in 15 s at the
  stand; a storm frame there must be taken within ~5 s of the hold. (3) Neptune's stack: stepped and broken now, but its
  values hardly move under the storm key (a pale crown, a dark wet foot are in the vertex washes): strata on its faces or
  a lighter tread on each ledge. (4) The rilles stand looks down into the rille toward Earth, but at stand distance the
  rille is a pale shallow dip: a darker bed wash (moon.js rilles patch) or a stand nearer the cut. (5) Venus' lava:
  some round crust spots remain in the open stream; plates drawn out along the flow need the flow's direction (none in
  the liquid's vertex data). (6) The autumn near crowns are warmer but still one flat mass each: a light under-wash in
  the paper holes (ARTPASS wish 10) or more value inside the crown. (7) Item 4 of block 7 (the brush, two walled vistas,
  Mercury from orbit, Mars' dune crests), then the ARTPASS weakest list (misty_wetland's reeds, temperate_forest's key).
- **How to work here**: scratch `/home/user/.pc-scratch/painter/m13/`. `mkexp.sh <name>` (a clean export of the head with
  my changed painter files over it); `v13.mjs <export> <prefix> <steps.json>` (v12 plus: `keys` held during a `hold`,
  `lead` steps run first, `evalHold` after the hold, the explorer's speed in the step line); `pair.py`; terrain:
  `sky.mjs` (the skyline from a point), `gully.mjs` (cliff faces: share over 60/70 degrees, gully index), `steps.mjs`
  (rises over 4 and 8 m within a metre: walls), `hdiff.mjs` (heights against the pre-PAINTER-12 cliff), `stackat.mjs`
  (a plan map of a Neptune stack), `colprobe.mjs` (the terrain wash along a ray); the Moon: `moonstand.mjs`,
  `rillenear.mjs`, `rille2.mjs` (rille stands that look down into a deep rille toward Earth), `moonhour.mjs` (the hour,
  Earth's place and phase at a place over the clock, spin phase 0), `moonfinal.mjs`.
- **Rules that bit me**: (1) **A session booted on the Moon (`?body=moon`) sets the Moon's hour** (Sim's first spawn,
  `FEEL.startHour`), which turns Earth away: set `window.__pc.sim.eph.spinPhase.moon = 0` in the first step (eval) and
  never pass an hour on the Moon. (2) **`world.setWeather` forces the painted sky only**: PHYSICS' rain does not follow it,
  so a "storm" preset gives no rain strokes and no rings; find a natural shower with `weatherAt` (the wetland pond rains
  2.1-2.5 mm/h at t = 1600-1620 s). (3) Neptune's stand in its squall throws the explorer about within seconds: shoot
  the gale with a short hold. (4) The coordinator's snapshots sweep working files into the head every few minutes:
  name them in your own commit.

## PAINTER 14: the first ten minutes, every arrival and every world from orbit, item 6, the weakest list (fourteenth PAINTER agent)

Every frame was taken on a clean export of the head with my files over it (SwiftShader, one browser of mine at a time,
960 x 540, the top tier, hour 10 unless said) and opened at full size; sheets in `docs/shots/painter/p14-*.jpg`. Every
run: 36 programs, none with a link log, no console error or warning, `info().fallback` empty.

### 1. The first ten minutes (`p14-first10`)
- Filmed as a new player meets them: PILOT's `grandtour.mjs --beats 1` (top tier) for the title, the card lifting and the
  first view (Rules 1: then stopped), `v14.mjs` for the rest: the arrival at the spawn in the game's own framing, the walk
  (W held 1.5 and 3 s), the jetpack (Space held 0.75 and 1.5 s), the ship over the spawn at 30, 250 and 650 m and in space
  at 1500 m, and the stream vista.
- Verdict, frame by frame: the title card over the painting, the first view (meadow, birches, the stream on the left, the
  ship among the trees), the walk into the wood, the jetpack among the crowns and pines, the canopy from 30 m, the land
  falling away at 250 m (forest dabs, a canyon's pink buttes on the skyline), the curve of the world at 650 m and Earth
  from space under deep indigo washes: each reads as a watercolour. The weakest: the 650 m frame, whose sky is one heavy
  granulated grey-violet slab, and the jetpack frame at 0.75 s, where the camera rises through a pale crown (the window
  round the figure keeps it in view). Nothing there failed outright, so nothing was changed for them.
- **temperate_forest's paper light** (the stand, first person): (a) `earth.js` mist 0.95 -> 0.72: the wood's depths and
  the sky over it paler (also the spawn's far wood on the left); (b) `materials.js` terrain: a patch of sun on a wood's
  floor (canopy over 0.55: only Earth's forests) is laid thinner and its heart, the same dapple read at a higher threshold,
  nearly to paper; (c) bark: a pale trunk keeps its sunlit side under the canopy's shade (the leaf shadow took it whole);
  (d) foliage: in a wood (canopy over 0.6 at the crown's foot) the sunlit outside of a crown may reach the lit step (it was
  capped a step below); (e) water: a sun glint within about 20 m is written as a crisp mark (region 6) the brush leaves as
  drawn (laid into the brush's average, the stream's paper glints came out grey). Measured on the stand (L*, the frame
  inside its border): head p1 30.2, median 54.3, p99 76.1, paper (L* >= 90) 0.00 %; after p1 33.9, median 56.2, p99 78.9,
  paper 0.01 %; the brightest birch pixels L* 89 (`p14-forest`). (d) measured nothing (p99 79.0: the crowns' washes never
  reach the cap under the canopy's dapple) and (e) drew the glints as one- and two-pixel white specks on the stream, not
  dashes (the glint pattern is finer than the brush at stand distance): both reverted. Kept: (a), (b), (c). The mixed-age
  birches are untouched (no tree data changed). The frame is still the lowest-key daylight frame (Still weak 1).
- First tries with no visible change, reverted or folded into the above: the flecks' hearts alone (too rare to show);
  lighter touches inside near crowns over the eye (the autumn wood's near crowns stayed one sienna mass: the shade under
  a glaze is one deep wash whatever the light; reverted).

### 2. Every arrival and every world from orbit (`p14-arrivals`, `p14-orbits`)
All ten spawns (third person, as a player arrives) and all ten from the tour's orbit framing, on one clean tree. All pass
as paintings in my judgement. Changes:
- **Stones round a first landing** (`floraplace.js`): besides none within 6 m (PAINTER 12), fewer out to 22 m (a stone
  between 6 and 22 m from a clearing is kept with a chance rising from 0 to 1): Pluto's spawn 37 stones within 20 m -> 16,
  Mercury's 10 -> 2, Mars' 11 -> 7, Uranus' 9 -> 8. Pluto's and Mercury's arrivals (the two review 6b failed on fields of
  lozenges) now stand on open ground: last row of `p14-arrivals`.
- **Mars from orbit** (`surface.js` `t.farC`, a biome's far wash: `[r, g, b, amount]` mixed into what it reads as from far
  away; `mars.js` dry_riverbeds a dark sepia-rust marking, dust_dunes orange ochre, rust_canyons burnt sienna; `limb` 0.64
  -> 0.32): a pale peach disc with cream swirls -> a rust world with a dark marking over the spawn's side and the white
  cap. It shows beyond 120 to 420 m, so on the ground only on far hills (Mars' horizon is about 110 m off).
- **Mercury from orbit** (item 6; `mercury.js` obsidian_fields `farC` a mid violet-grey): the dark disc in a bright rim
  (the obsidian under the camera) is a cratered grey-violet globe with its ochre basins; the obsidian stand's darkest
  ground no longer lies at its skyline for the same reason.
- **Neptune from orbit** (`neptune.js` deck streaks 0.9 -> 0.4): the high white streaks curved round the globe as bright
  arcs, reflections on a glass ball; now a few soft white blots on the blue.
- Seen, not changed: Earth's clouds from orbit are hard-edged white blots; Uranus' arrival is one pale value range;
  Venus' arrival stands on a dark brown plain (a thinner wash, `dil` 0.14 -> 0.22, made no visible difference: reverted);
  Mars' near shrubs break into specks at their edges; Neptune's arrival under its new season is a daylit blue meadow
  with violet kelp (it was a lilac twilight).

### 3. Item 6
- **The brush**: its radius is a fraction of the picture's height (`uBrush` near 0.0036, far 0.0085 of the internal height),
  so at the top tier (internal = output) the strokes keep their size on the sheet at any output size; nothing was changed,
  and no 1920 x 1080 frame was taken (the machine's cost). "A finer brush at full resolution" (block 4) was never written
  down further; if the critique asks for finer near detail at 1080p, lower `ub.x` there.
- **The two walled vistas**: Saturn's "Pale Gold Sky-Islands" (a trunk a metre from the lens over the left fifth, a crown
  into the top right): an easel may now ask for room round it, a sixth number in metres (`easels.js`, `surface.js`
  clearings; additive); gold_islands asks for 5 m: the two trees go, the framing tree 7 m ahead stays (`p14-item4`). The
  other wall (PILOT's review 4 "two vistas have a wall a metre in front of the easel") is not named anywhere I could find
  and the tour frames only each world's first vista; the same sixth number fixes any other in one line.
- **Mercury from orbit**: above (2).
- **Mars' dune crests**: a finer meander (a third of a dune's length) was tried: the crest bent a little and the parked
  ship moved into the frame; no clear gain, reverted. The crest in the dust_dunes stand reads as a dune crest with the
  pale drags of blown sand across it.

### 4. The ARTPASS weakest list
- **misty_wetland's reeds as an even comb** (`nearground.js`, `floraplace.js`, `earth.js`): the comb was the near ring's
  grass flicks and reed stubble (Rules 3). Reeds and sedge now stand in beds (a field 6 m across, `reedy`), the mud
  between them nearly bare and without the pebble that stood on it as a dot; the far flora reeds in beds too (533 -> 208
  within 40 m of the stand, in clumps); the beds' feet a deeper olive (the frame's dark). A first, narrower field left the
  bank bare and stony (`p14-wetland`, middle); kept (right): a reed bed with a ragged edge on the right, the open bank in
  front with its shore stones, the water beyond: no longer one comb, though the shore stones read as a cluster of dots.
- **uranus/frozen_waves reading as peaks** (`florakit.js` waveGeometry, `flora.js` FAR_DIMS): a wave's crest stays nearly
  level and drops only in its last eighth, and the far form (beyond about 190 m) is a long low ridge [11, 6, 0.12] instead
  of a cone [8, 7.5, 0.5]: the middle distance is a row of level crests with dark hollows under their lips, the big wave
  curls (`p14-item4`, row 1). The ship still fills the stand's foreground (its berth).
- **saturn/gold_islands' flat gold and boxy table** (`saturn.js`): the gold a little more dilute (0.42 -> 0.48) and broken
  near the eye by small raw-sienna touches, the tables' walls banded more strongly (strata 0.4 -> 0.75): the wall reads in
  bands; the gold is still one warm value field. The table's shape is the islands recipe (Still weak 3).
- **pluto/long_shadow_plain with no long shadows**: not changed. Nothing in the frame casts onto the ground but the
  explorer and the ship; a shadow needs either a ground glaze per tall instance laid away from the sun (a GLAZES mesh, a
  new program: not in a finishing block) or a strip in the spire kit's vertex stage, which cannot follow 60 m rolling
  ground. Still weak 2.
- **crystal_reeds and pearl_fog, one narrow value range each**: crystal_reeds has a davy's-grey violet gravel patch
  between the reeds (`saturn.js`), its one dark beside the crystals' indigo edges (`p14-item4`). pearl_fog: darker stones
  were tried as its dark; the boulders stayed mid-grey in the fog and the pebbles became a trail of dark dots: reverted;
  kept only fewer pebble dabs (`near.dab` 1, the cross-verifier's follow-up).

### 5. PAINTER 13's "Still weak"
- **The stack's values under the storm key** (`surface.js` `_stacks`, coast): the treads of the ledges are laid lighter
  (`_stT`, into the coast's `crown` wash): in the squall the stack shows a lighter band at its lower ledge and lighter
  shoulders (`p14-item4`, last row, at 0.34; kept at 0.5). Still a narrow range.
- **The rille as a pale dip**: two causes. The bed took the plain's palest wash (`surface.js` riverbed: a biome may give its
  bed its own wash, `t.bedC`; the Moon's rilles a Payne's grey [0.36, 0.37, 0.45]); and the stand's rille lay 60 m north,
  out of a frame looking east at Earth (scratch `scan.mjs`). The stand and easel moved 126 m to the rille's edge
  (`easels.js` STANDS/EASELS `moon.rilles` [0.202942, 0.190753, -0.960431], yaw 96, pitch -3 / -2): Earth 15 degrees up
  over the rille, its bed 20 to 40 m off, 12 degrees below the eye (`rillestand.mjs`; `p14-moon-rilles`). In the frame the rille is a valley
  between two banks with a darker floor; still not a dark cut (the lit step and the airless haze lift it).
- **The near autumn crown as one flat mass**: two tries, neither moved it (lighter touches inside the near shade; the
  crowns' cap raised in a wood, (d) above): both reverted. Still weak 5.
- **Earth's sparse white horses**: not changed (Earth's stand storm is Hs 0.5 m, 4.9 % white by PHYSICS; the frame at
  PAINTER 13's change showed a few dashes; with no new frame I made no change).

### Final checks (fourteenth PAINTER agent)
On a clean export of `8809fff` (the head, which holds the coordinator's snapshots of my files) with my remaining files
over it (scratch `c5`): `node --test src/world/*.test.mjs` 19/19, `node --test tests/*.test.mjs` 151/151, `node --test
src/physics/` 307/307; every module of the world, the renderer and the art loads alone in Node; `node src/physics/coast.mjs`
PASS at both stands (Earth sea_coast 80 m out: fetch 2145 m, mean depth 18.4 m, Hs 0.53 m, white 4.88 %; Neptune
storm_seas: fetch 2206 m, mean depth 33.2 m, Hs 3.69 m, white 12.2 %). Browser runs (s1 to s6, about 70 frames): 36
programs in every run, none with a link log, no console error or warning, `info().fallback` empty. FINAL_S6

### For PILOT (fourteenth PAINTER agent)
1. **The Moon's rilles stand and easel moved** (`src/art/easels.js`, the same place for both): [0.202942, 0.190753,
   -0.960431], STANDS yaw 96 pitch -3, EASELS yaw 96 pitch -2 (126 m from the old one, on the rille's edge, Earth 14.7
   degrees up at azimuth 93, slope about 10 degrees by my four-point check). `node --test src/world/*.test.mjs` passes
   (every easel and stand on dry, gentle ground of its biome); your `tests/contract.test.mjs` passed on the export
   (unit 150). Your tour, `boulderrun.mjs` (crater_fields, unchanged) and the weather set find it by `findBiome`.
2. **An easel may carry a sixth number: metres of room** (additive; `getVistasPure` and `findBiome` read the first five as
   before). Only Saturn's gold_islands has one (5): two trees near that vista are gone, so `sampleObstacles` there lists
   two trunks fewer.
3. **Fewer stones round every first landing** out to 22 m (`floraplace.js`, shared with `obstacles.js`, so collision
   matches the drawing): the arrivals' obstacle lists are shorter (Pluto's spawn 37 -> 16 within 20 m). Your
   `clearArrival` should move nothing new; it never had to move more than 5 m.
4. **The beats at the top tier**: on this machine `grandtour.mjs --beats 1 --query quality=2` makes a frame every 60 to 80 s
   just after the title, so the opening alone takes most of an hour; an option to hold the game and `step(0.25, n)` between
   beats (as `v14.mjs` does) would let a top-tier run reach space in reasonable time. Yours to decide.
5. Seen in the frames, yours: the tour's teleports park the ship beside the explorer, so a stand's frame often has the
   ship in its foreground (Uranus' frozen_waves, Saturn's gold_islands, Mars' dust_dunes): the player who flew there sees
   their own ship where they landed, so nothing to fix unless you want the tour to park it out of view.

### For PHYSICS (fourteenth PAINTER agent)
1. Colour only, nothing for you to change: the stacks' ledge treads are lighter (`surface.js`, no height moved; coast.mjs
   PASS at both stands); the Moon's rille beds are darker (`t.bedC`, no height moved).
2. The Moon's rilles stand moved (For PILOT 1); your `gamefilm.mjs` Moon subjects use crater_fields (unchanged).
3. Stones round first landings thinned out to 22 m (`floraplace.js`): fewer boulders in the arrival's obstacle list.

### Still weak, ranked by what a new player would notice first
1. **temperate_forest is still low-key** (the stand: median L* 56, p99 79 after this block; paper only on the birches'
   sunlit sides and the patches of sun): the canopy closes the sky at the top and the crowns are middle values. The next
   lever is the canopy itself: honour `tallD` for forest terrain (floraplace.js placeTrees, opt-in per biome) or a broadleaf
   scale under 1.25, then look at the spawn again (it is in the same biome).
2. **Pluto's long_shadow_plain has no long shadows** (see 4).
3. **Saturn's and Jupiter's island tables** are extruded blocks with level tops (the islands recipe); a ledge and a broken
   rim would change both arrivals' biomes, so it needs its own frames on both worlds and the spawn and easel tests.
4. **Uranus' arrival is one pale value range**; **Venus' arrival stands on a dark brown plain**; **Mars' near shrubs**
   break into specks at their edges; **Earth's clouds from orbit** are hard-edged white blots.
5. **Neptune's stacks under a storm** still move little in value; **the rille** is a valley, not yet a dark cut; **the
   autumn near crowns** one sienna mass each.
6. **pearl_fog** and **crystal_reeds** stay narrow in value (pearl fog is its idea); **Earth's white horses** sparse.

## PAINTER 13: the headland regression, the Moon facing Earth, Neptune's storm coast, item 4 and item 5 (thirteenth PAINTER agent)

Every frame was taken on a clean export of the head with my files over it (SwiftShader, one browser, 800 x 450, top
tier) and opened at full size; sheets are in `docs/shots/painter/p13-*.jpg`. Every run: 36 programs, none with a link
log, no console error or warning.

### 1. Narrow headlands: the height back, the barcode still gone (`surface.js` coast)
- **Cause of the regression**: PAINTER 12's profile rose in two steep lifts with a flat ledge between them over 4.6 m of
  the land's rise, and took up to 22 % off the cliff where the land was low (the lip at 0.78). Land that rose only 2 to
  4 m before its cliff sat on the ledge: round Earth's easel view the land was up to 25 m lower than before PAINTER 12
  (p90 21 m; scratch `hdiff.mjs`), the near hill toward 240 degrees 48 -> 23 m.
- **Cause of the barcode** (found here): the wobble of the cliff line (2.5 m of 60 m noise and 0.6 m of 17 m noise in
  `q`) was whole at the waterline, so wherever it was high there the land stepped up 10 to 20 m within a metre: a
  vertical wall the terrain's 3 to 6 m cells combed into stripes, and that stood as the ruler-straight edge PHYSICS'
  float strips showed. Steps over 8 m within 1 m round the easel view: 104 before PAINTER 12, 21 on the head, 0 now;
  round Neptune's stand 69, 63, 8 (the 8 are stack walls). PAINTER 12's wider, lower profile only hid it.
- **Now**: the face is one even ramp over 0.65 of 4.4 m of `q` with a ledge (the ramp eases over a band near mid-face,
  8 % steeper elsewhere), no lip taken off, the 17 m wobble halved, crags of 10 and 23 m on the face only, and the rise
  let in over the first 2 m of the land's own height (`gate`), so the cliff rises out of the shore and never off it;
  where the wobble is low the beach is kept (a first try that faded the wobble out at the shore instead put both coast
  stands on a slope: the Earth stand rose 1.9 -> 9.4 m; reverted before any commit). Old - new heights round the easel
  view: p90 5.7 m; the near hill 41 m; gully index on faces 0.71 (head 0.96, before PAINTER 12 1.57).
- **Frames**: `p13-cliff-height` (the easel view before PAINTER 12 | now, head | now, and the sea_coast stand head |
  now): the big near hill on the right is back, the stripes are gone; the stand is on its beach again. `p13-cliff-v1-
  stripes`: the first ramp with the waterline step still in it brought the stripes back, which is how the step was found.
  At the sea_coast stand the headland on the left is a sea stack, and is about 2 m lower with the stepped stacks (item 3);
  the little stack on the horizon there went under it.
- `node src/physics/coast.mjs`: PASS at both stands on every export (last: Earth 80 m out Hs 0.53 m, white 4.88 %;
  Neptune Hs 3.54 m, white 12.2 %).

### 2. The Moon faces Earth (the coordinator's ruling; `moon.js`, `easels.js`, `surface.js` getStandPure)
- Earth's direction in the Moon's frame is (-0.891, -0.014, -0.453) with spin phase 0 (scratch `moonstand.mjs`, from
  PILOT's Ephemeris). All four biomes reach the near side, so **the sites are unchanged** (no biome map moved).
- **The arrival** (`moon.js` `spawn`): the mare stand [-0.058016, 0.806398, -0.588521], yaw 118, pitch 3 (Earth 15 to
  17.5 degrees up at azimuth 116 to 118). **Stands** (`STANDS.moon`, yaw toward Earth, a pitch: `getStandPure` reads a
  fifth number, additive): mare (above), highlands [-0.665473, -0.392552, 0.634861] 277/3 (Earth 14.4-15.5 up),
  crater_fields [-0.549487, 0.786366, 0.2823] 240/4 (17.8-20.1), rilles [0.177279, 0.106301, -0.978403] 93/2 (13.8-14.1;
  high on a rille's bank looking down into it, scratch `rille2.mjs`; a first rim stand saw only a faint line).
  **Easels** (`EASELS.moon`, new): the same four places, a degree more pitch: the Moon's first four vistas look at Earth.
- **Frames** (`p13-moon-arrival`, `p13-moon-stands`): Earth stands in the upper third of every frame over the plain,
  the hills, the crater rim and the rille's plain; the arrival shows the explorer, the ship and Earth together. Booted on
  the Moon the first frames had Earth 4 degrees up at azimuth 98 (the boot's hour; see Rules 1 and For PILOT 2): the
  model with that boot's spin phase puts it exactly there, so Earth is drawn where the ephemeris says.
- Light: the clock is set, never the hour (mare and the arrival 500 s: hour 15.4 there, Earth 59 % lit; rilles 900;
  highlands 2500; crater_fields 2900: the sun behind the painter, Earth gibbous).

### 3. Neptune's storm coast
- **The big stack** (`surface.js` `_stacks`, coasts only; islands keep their tables): steps, each narrower with its own
  ragged rim: a low ledge at the foot, a lower and an upper drum a fifth of the radius apart, a crown off the middle with
  a knuckled top; faces for the shade from the steps; in values a dark wash at the wet foot (the lowest 9 m), drifts
  heavier and lighter on the drums, a pale dry crown. Tries: three steps spread over the radius made a rounded haystack
  (`p13-neptune-stack-v1`, upper right); steps 0.1 of the radius apart (2 m) were lost in the terrain's cells and the
  stack stood as one wall with a notched top again. Kept (`p13-neptune-stack`, with a zoom): the stack stands with a
  ledge across its lower drum, a narrower stepped crown and a broken top; under the storm key its values move little
  (a lighter band at the ledge, a darker foot): the value variation is slight. Stacks are about 20 % lower at their
  flanks (the headland left of Earth's sea_coast stand is a stack: about 2 m lower).
- **The ruled dashes** in the storm sky were the rain: the painter's draw table lays every stroke one way (`parallel`)
  and at most 1.2 m long, and in a 75 m/s gale every stroke lay level, one length and one weight. Now each stroke has
  its own length (0.38 to 1 of the quad), tapers to its tail and is broken where the brush skipped (`kitmat.js` rain;
  the world's rain entry has `vary: 0.35`, so each drop carries its own number). Frames: short dark flecks in the sky
  instead of rows of dashes (`p13-neptune-storm`: the cliff-top easel and the beach in the gale; `p13-neptune-stack`).
- **Storm darks** (`post.js`): under a storm's key the land's darkest washes are laid into a band above the floor (a
  toe like the night's): the basalt is dense indigo (the cliff by the float stand measured L 14 in PHYSICS' strip).
- **White horses**: from a beach (the eye 2 to 3 m up) the far sea's white dashes were one or two pixels deep and the
  brush (which keeps nothing under three) took them; now at least three pixels deep, broken along the crest into dashes
  a few metres long, and at full strength for the share that breaks (`materials.js` far sea). Frames: a band of broken
  white along the crests from the water (`p13-neptune-float`), a breaking crest and surf lace from the beach
  (`p13-neptune-stack`, lower left) and a few white dashes on Earth's storm sea (`p13-earth-storm-coast`). Physics' white share was right (15 %, Hs 5.2 m): nothing for PHYSICS.
- Seen while filming: in the squall the explorer at the stand is blown 19 m and climbs the cliff behind in 15 s (For
  PHYSICS 6).

### 4. Never seen in a frame, now filmed
- **Splash rings** (`p13-earth-rings`): natural rain (2.5 mm/h, t 1610) on the misty wetland's pond, looking down: no
  white line anywhere; the frame difference over 0.3 s shows small rings 5 to 10 px across, faint and soft. P21's line is
  in (no ring for a settling flake or a hailstone).
- **Spray near the lens** (`p13-neptune-float`): floating 25 m out in Neptune's gale: the spray off the crests is a
  scatter of soft pale wisps along the wave tops, a few faint soft dabs nearer; no big blot crosses the lens.
- **Kicked dust on the Moon** (`p13-moon-dust`, three rows: before, grains only, grains and sand): the dust kind is drawn with
  the veil shape (the painter's draw table makes dust a veil), so PAINTER 12's grains in the puff never showed and the
  boot raised soft grey blots and pale lines (row 1). Now each dust particle on an airless world is a fleck two or three
  pixels across at the middle of its quad,
  a little darker than its ground; the thin pale scratches left in row 2 were the sand kind's level skim, which on an
  airless world is now a fleck at the head of its stroke: row 3 is a fan of small dark grains behind the boots, no puff,
  no scratch.
- **Earth's storm at the coast after P20** (`p13-earth-storm-coast`, 15 s after arriving): swell bands and, with the
  white-horse change, a few thin white dashes on the sea (none before; the storm whitens about 5 % there); the surf is
  hidden by the bank from the stand. `p13-earth-storm-coast-v1` is the first after-P20 frame on the head.

### 5. Item 5
- **Autumn crowns** (`materials.js` foliage): no crown wash goes below one glaze (the floor wanders from wash to wash),
  and a crown's shade is its own colour laid heavier with half the cool glaze over it (the violet glaze over orange made
  mud). `p13-autumn`: the near crowns overhead are burnt sienna instead of flat sepia, the pines deep green instead of
  slate; each near crown is still one mass (Next 6).
- **Mercury's crystals**: crystals and the looks' shard splinters are drawn as gems (`uGem`, a uniform: no new program):
  the middle of a facet keeps a light core, no facet below one glaze, paper at the edge where the light passes; the
  crystal garden's splinters are the crystals' own rose and cream (`mercury.js`). A first floor made them too pale (lost
  in the ground); the kept one: dusty rose and lilac crystals with violet shade facets instead of one saturated
  ultramarine (`p13-crystal-lava`).
- **The twilight key** (ARTPASS wish 4, `index.js`): the day a twilight biome loses goes 0.40 to the dawn key, 0.36 to
  the dusk key and 0.24 to the night's (it was 0.78 dusk, 0.22 night). Saturn's ring_shadow at noon goes from
  grey-brown to mauve-grey (`p13-ringshadow`); Mercury's crystal garden is part of `p13-crystal-lava`. Small.
- **Venus' lava** (`materials.js` lava): the crust is cut by thin lines of fire, its wash varies as it cooled, it goes
  scarlet at its edge, and it gathers in rafts and along the banks while the deep stream runs open: the leopard print
  is gone from the middle of the river, a dark crust lies along the near bank; a few round spots remain (Next 5).

### Final checks (thirteenth PAINTER agent)
On a clean export of `2af3e51` with my files: world 19/19, unit 148/148, physics 305/305; `node src/physics/coast.mjs`
PASS at both stands (Earth sea_coast 80 m out: fetch 2145 m, mean depth 18.4 m, Hs 0.53 m, white 4.88 %; Neptune
storm_seas: fetch 2206 m, mean depth 33.2 m, Hs 3.69 m, white 12.2 %). Every browser run: 36 programs, none with a link
log, no console error or warning. Not done: item 6 (the brush, the two walled vistas, Mercury from orbit, Mars' dune
crests, the ARTPASS weakest list).

### For PILOT (thirteenth PAINTER agent)
1. **The Moon faces Earth (the coordinator's ruling)**: every Moon stand, its easels and its arrival are on the near
   side now, facing Earth. `src/data/looks/moon.js` `spawn` (the arrival: the mare stand, yaw 118, pitch 3);
   `src/art/easels.js` `STANDS.moon` (mare, highlands, crater_fields, rilles; the rilles stand moved from the far side to a high bank looking down into a
   rille toward Earth)
   and `EASELS.moon` (new: the same four places with a pitch, so the Moon's first four vistas look at Earth). A stand
   may carry a fifth number, a pitch in degrees (`getStandPure` returns it; additive): `findBiome` and your tour read it.
   The Moon's sites (its biome map) are NOT changed: all four biomes already reach the near side.
   Earth from each stand (topocentric, spinPhase 0, over a month): mare 15.2-17.5 degrees up at azimuth 116-118,
   highlands 14.4-15.5 at 277-280, crater_fields 17.8-20.1 at 240-241, rilles 13.8-14.1 at 90-93 (its disc is 15
   degrees across).
2. **teleport({ hour }) turns the Moon away from Earth.** `Ephemeris.setSunHour` (src/core/orbits.js) sets the hour by
   the body's spin phase alone. On the Moon (orbitPeriod === dayLength, a parent) that breaks the lock: after
   `teleport({ hour: 10 })` at the rilles stand Earth is wherever the hour put it (PAINTER 12 measured it moving from
   7 degrees up to 51 below over the clock). The game itself never sets the Moon's hour (a player who flies there
   finds spinPhase 0 and Earth where the ruling says), but your tour, `__pc.setHour`, the coordinator's ten-body
   visit, every test that teleports to the Moon with an hour, and a boot with `?body=moon` (Sim's first spawn sets
   `FEEL.startHour` 9.5 there) do. Seen: booted with `?body=moon`, the arrival at clock 505 had Earth 4 degrees up at
   azimuth 98, where the model with that boot's spin phase (-0.393) puts it, instead of 17 degrees up at 117. Proposed (yours to decide): for a tidally locked
   body turn the orbit with the spin, so Earth keeps its place in the Moon's sky while the sun moves:
   - `Ephemeris`: `this.orbitShift = {}` (0 per body); `position(id, t)` and `velocity(id, t)` use
     `a = b.orbitPhase + (this.orbitShift[id] || 0) + TAU * t / b.orbitPeriod`;
   - `setSunHour(id, t, dir, hours)`: when `b.parent && Math.abs(b.orbitPeriod - b.dayLength) < 1e-6`, the search
     variable moves both: `at(phi) { this.spinPhase[id] = phi; this.orbitShift[id] = shift0 + (phi - base); ... }`
     (and the same in the refining loop and the final assignment);
   - `save.js`: keep `orbitShift` beside `spinPhase`.
   Earth's direction in the Moon's frame then stays at (-0.891, 0, -0.453) (to the 0.03 rad tilt) at every hour.
   Until then my Moon frames are taken without an hour: the clock is set instead (mare and the arrival at t = 500,
   hour 15.4 there, Earth 59 % lit; rilles 900; highlands 2500; crater_fields 2900: morning or afternoon light with
   the sun behind the painter).
3. **Tests that depend on the Moon's places** (stands, easels, the arrival; the sites are unchanged):
   `tests/contract.test.mjs` (real spawn points dry and gentle; berths in the surf at every stand; the landing),
   `src/world/surface.test.mjs` (spawn flat and dry with room; every easel on dry ground of its biome and its first
   vista; every vista standable), `tests/boulderrun.mjs` (the Moon crater_fields stand: `findBiome('moon',
   'crater_fields')`), `tests/tour.mjs`, `tests/cost.mjs`, `tests/weather.mjs` (places by biome), and PHYSICS'
   `gamefilm.mjs` subjects `game-moon-boulder(-side)` (the densest boulder field within 320 m of the crater_fields
   stand). Run on a clean export with my files: see the hand-over for the counts.

### For PHYSICS (thirteenth PAINTER agent)
1. **P21 ring line: in** (`kitmat.js` `SHAPES.ring` begins with `if (vPcData.x > 1.5) discard;`).
2. **The Moon's places moved to the near side** (the coordinator's ruling): `findBiome('moon', b)` returns new places
   for all four biomes (crater_fields [-0.549487, 0.786366, 0.2823], mare [-0.058016, 0.806398, -0.588521],
   highlands [-0.665473, -0.392552, 0.634861], rilles [0.177279, 0.106301, -0.978403]) and the Moon's arrival is the
   mare stand. Your `gamefilm.mjs` subjects `game-moon-boulder(-side)` search the densest boulder field within 320 m
   of the crater_fields stand: they will run somewhere else now. The Moon's sites (its biome map) are unchanged.
3. **Kicked dust on airless worlds is drawn as grains now** (your P20 note): the dust kind is drawn with the veil
   shape (the painter's draw table gives dust `veil: 1`), so PAINTER 12's grains in the puff shape never showed (your
   `game-moon-boulder` strip: a soft white puff at the boot). Now on an airless world each dust particle is a fleck two
   or three pixels across at the middle of its quad (measured in pixels along each side of the quad, so the exposure's
   stretch does not draw it out), a little darker than its ground; the sand kind's level skim, which drew thin pale
   scratches from the Moon walker's boots, is a fleck at the head of its stroke there. Filmed (Shift+W on the mare).
4. **Rain strokes** (`kitmat.js` rain; the world's rain draw entry now has `vary: 0.35`, so `vPcData.x` is each
   drop's own number 0.65..1): each stroke its own length (0.38 to 1 of the quad), tapering to its tail, broken where
   the brush skipped. In Neptune's 75 m/s gale every stroke lay level (`parallel: 1`, `maxLen 1.2`), one length, one
   weight: the storm sky carried rows of ruled dashes. Nothing for you unless you want the lab to match.
5. **The coast cliff is continuous at the shore** (`surface.js` coast): the wobble of the cliff line (60 m and 17 m
   noise in `q`) was whole at the waterline, so wherever it was high there the land stepped up 10 to 20 m within a
   metre (steps over 8 m in a metre round Earth's easel view: 104 before PAINTER 12, 21 on the head, 0 now; round
   Neptune's stand 69, 63, 8 (the 8 are stack walls)). That step is the "ruler-straight vertical edge" and the combed
   stripes your strips showed. The rise is now let in over the first 2 m of the land's height above the shore; the
   waterlines did not move (nothing changes where the land is at or under 0.9 m), both stands are on their beaches
   (Earth 1.9 m, Neptune 1.3 m); coast.mjs PASS at both stands (numbers in the hand-over).
6. **The explorer in Neptune's squall** (seen, yours to judge): at the storm stand (`findBiome('neptune', 'storm_seas')`,
   hour 11, clock 222, weather as it comes), after the world settled and 15 s of held clock (t 245): ON_FOOT, grounded,
   19.1 m from the stand, 5.37 m/s, `phys.clamber01` 1.0 on rock, `physics.here.air.speed` 141.4 m/s: blown west from
   the beach and clambering up the cliff behind it (the frame looks down on the sea from high up). At t 237 and 247 in
   other runs the wind at the explorer was 14.3 m/s and it stood (2.3 m from the stand; the ground reported as `ice` on
   the beach). If 141 m/s at the explorer is the squall as meant, a walker cannot stand there; if not, the number is the
   thing to look at. My storm frames there are taken within 5 s of the hold.

## Handover of the coasts and the art pass's causes (twelfth PAINTER agent; kept)

Written by the twelfth PAINTER agent (the coasts, then the art pass's shared-code causes). The eleventh agent's
handover is kept below it ("Handover of the hardening review"); its rules hold.

- **Where things stand**: the coasts are done: PHYSICS' sea map is wired and compiled (`c08dddb`), both coast stands
  face open water toward their own storm and `node src/physics/coast.mjs` says PASS for both (`418ac5b`; still PASS on
  every later head with my files, last on `e866f6e`). Neptune's coast terrain was opened per the coordinator's ruling
  (`neptune.js` `t.open`). The art pass's shared-code causes: see "PAINTER 12" below for each, its frame and verdict
  (code in the coordinator's snapshots `db64b86`, `50414f0`, in `e866f6e` and the last commit; every change seen in a frame I opened unless said).
- **Next, in this order**: (1) **Give narrow headlands their height back.** The coast cliff profile (`surface.js`)
  keeps the combed stripes away, but where the land is narrow it never reaches the full cliff: a near hill on the
  right of Earth's easel view went from 52 to 29 m (`p12-cliff-barcode`), and the view lost its big hill. Try the
  transition over 3.6 m of the land's rise (4.6 now) and the lip at 0.9 of the cliff (0.78), then look at the easel
  view, the sea_coast stand and Neptune's stand again (and run coast.mjs: the profile moves the waterlines). (2) The autumn crowns' flat sepia and Mercury's blue crystals are not the
  double glaze (the pcTone change hardly moved them): the crowns are their leaf washes under the canopy shade, the
  crystals are the twilight biome's dusk glaze at one glaze (`index.js` blendKeys: 78 % of the lost day goes to the
  dusk key; ARTPASS wish 4 asks for a cool twilight key instead). (3) Venus' lava is a leopard print (dark crust
  blotches on flat orange, `materials.js` the lava lines): make the crust plates drift in broken strokes. (4) Earth's
  white horses: the shader now draws them by the local sea's white share, but my storm frames were taken 10 s after a
  teleport, before PHYSICS' P20 arrival fix; film Earth's coast 15 s after arriving (PHYSICS P20). (5) Kicked dust on
  the Moon as grains (`kitmat.js` puff under `uAirless`) is compiled but not seen in a frame: walk the Moon and look.
  (6) The Moon facing Earth is not a stand question (see "For PILOT" 5). (7) Item 4 of block 7: the brush, two walled
  vistas, Mercury from orbit, Mars' dune crests.
- **How to work here**: scratch `/home/user/.pc-scratch/painter/m12/` (the session scratchpad is shared with the
  coordinator: never export there; an export wiped another run). `mkexp.sh <name>` (a clean export of the head with my
  changed painter files over it), `v12.mjs <export> <prefix> <steps.json>` (the game through steps: a biome's stand as
  the tour takes it, a direction, a spawn; hour, clock, weather, a hold-and-step, `evalAfter`; prints console errors
  AND warnings and every program with a link log; W, H, Q in the environment), `pair.py` (before | after sheets),
  `bmap.mjs` + `bmap.py` (biome, water and height map round a place), `prof.mjs` (a height profile), `slopes.mjs`,
  `clim.mjs` (the local storm on a grid), `cands.mjs`, `brute.mjs`, `brute2.mjs` (beaches judged by PHYSICS'
  `coastReport` itself, ranked by the worst margin), `one.mjs` (coast.mjs's full report at any stand), `riv.mjs`
  (banks that see a river), `rille.mjs`, `moonearth.mjs` (Earth in the Moon's sky after the hour is set),
  `seacheck.mjs` (the local sea a shader would read).
- **The machine**: with PILOT's, PHYSICS' and the coordinator's browsers the load sat at 12 to 21 on 4 CPUs. A game was
  ready after 6 to 11 minutes; a 800 x 450 top-tier frame took 2 to 12 minutes (a teleport to another body rebuilds the
  world). Plan for eight to fifteen frames an hour on one body, fewer across bodies.
- **Rules that bit me**: (1) **Set the clock on every judging step** (`clock: 30`): a step that jumps the clock (a storm
  at 8850 s) moves every later frame into another season (Earth's year is 14400 s), and a before/after pair then
  compares two suns. (2) **The storm is local and a squall**: Earth's sea_coast has 6 m/s breezes from ENE in one bay
  and 35 m/s gales from WSW 2 km off; on Neptune the peak at one waterline is 55 m/s and 75 m/s 30 m away. coast.mjs
  judges a beach against its own squall: search with `coastReport` itself. (3) These worlds are 4 km across: from a
  beach the sea's horizon is 120 m off and islands a kilometre out are under it; a coast picture is made of what stands
  within a few hundred metres. (4) PILOT's `tests/contract.test.mjs` lands the ship at fixed places (Earth 62 N 10 E is
  an alpine flank): roughness there makes the parked ship slide. (5) The coordinator's WIP snapshots sweep your working
  files into the head every few minutes; write the commit that names them yourself.

## PAINTER 12: the coasts, and the art pass's shared-code causes (twelfth PAINTER agent)

Every check ran on clean exports of the head with only my files laid over it, SwiftShader through ANGLE, one
browser of mine at a time. Frames named here were opened at full size.

### 1a. PHYSICS' sea map, wired (`c08dddb`)
`src/render/shared.js`: `uPhysSeaMap` (a 17 x 51 float `DataTexture` made once over
`physics.fields.water.uniforms.uPhysSeaMap`, flagged for upload when `mapVersion` moves), `uPhysSeaGrid`,
`uPhysSeaGrid2` and P19's `uPhysSeaBand` in `PHYSW`, copied in `syncPhysWater` (the grids' `w` zeroed where there is
no physics or no map). `src/render/materials.js`: the water material defines `PC_PHYS_SEA_MAP`; the vertex stage
shoals by the local sea (`pcPhysSeaLocal`); the fragment stage reads the local sea and the local way of the waves
(`pcPhysSeaDir`) everywhere it read `uPhysWaterSea` / `uPhysWaterDir` (12 and 3 places), and `pcPhysWaterCrestAt`,
`pcPhysWaterSurfAt`. Compiled in the game: 36 programs, none with a link log, no console error or warning, at
Neptune's old stand at clocks 213 and 240 (a breaking crest and shore foam drawn) and in every later run.

### 1b-1d. Both coasts face open water toward the storm: `coast.mjs` PASS (`418ac5b`)
How the beaches were found: PHYSICS' own `coastReport` (exported by `coast.mjs`) run at every candidate beach with
the stand overridden (scratch `brute.mjs`, `brute2.mjs`: dry, gentle, its own biome, water within 25 m and 80 m
out), ranked by the worst of its margins. The storm is local (scratch `clim.mjs`): Earth's sea_coast has 6 m/s
breezes from ENE in one bay and 35 m/s gales from WSW 2 km away, so a beach must face its own storm.
- **Earth `sea_coast`**: the 2067 m candidate fails (its own storm is 6 m/s from ENE and WSW). The stand is a beach on
  the east shore of an island 2.4 km north, facing 120 (ESE), a headland to the left: `STANDS` [0.617395, 0.033112,
  -0.785956]. Storm 13.2 m/s from E at 8850 s; 80 m out: fetch 2193 m, mean depth 18.6 m, Hs 0.53 m (mark 0.51),
  white 4.9 % (mark 2.96); surf at the waterline Hs 0.48 m. Sites unchanged. (Frame: `earth2-B-h10`.)
- **Neptune `storm_seas`, per the ruling**: no beach reached 2 km in the coast terrain as it was. `surface.js`'s
  coast recipe takes `t.open: { a, b, r: [r0, r1], depth }`: a reach of open water along the great-circle segment
  a-b, its floor `depth` m down (a broad swell of the bed, +-22 %), eased back to the land between r0 and r1 from the
  line; where the land was deeper nothing changes. `neptune.js`: from 1 km east of the old stand to the eastern
  berm, 2.3 km, r 560/800 m, 34 m: it drowns the big island east of the old stand and the reefs round it. No site,
  seed, seaLevel or phys changed; the berm keeps the water inside storm_seas, the ice spires biome is untouched
  (scratch `nv6-map.png`). The stand: a beach under the south-west island's cliffs, 390 m south of the old one,
  facing 90 (E): `STANDS` [-0.49573, -0.041193, -0.867499]. Storm 75 m/s from E at 240 s; 80 m out: fetch 2226 m,
  mean depth 33.2 m, Hs 3.18 m (mark 3.14: thin), white 12.1 % (mark 9), surf at the waterline Hs 3.1 m. The old
  easel was under the new water: `EASELS` storm_seas is on the cliff top above the stand, 50 m up, looking into the
  storm (95, pitch -6).
- **Why Neptune's margin is thin** (measured, scratch `one.mjs`, `tryv.sh`): the squall coast.mjs finds peaks at
  240 s, so its 150 s settle starts at 90 s and the swell (90 s to come up) has not grown. The most exposed water
  about, at the target's own 2.5 km and 30 to 47 m deep, reaches 3.05 to 3.30 m against 4.21 (0.73 to 0.78 of it);
  deepening the reach to 48 or 60 m changes nothing (3.10, 3.13). Most beaches facing the storm miss the mark by 1
  to 5 %; with `--settle=240` (the run from t = 0) they pass with room (3.24 m where 150 s gives 2.96). Told to
  PHYSICS.

### 1e. White horses and surf
- Neptune's storm at the new stand (clock 236, PHYSICS' sky; `p12-coasts`, lower right): swell bands rolling in, a
  breaking crest drawn white across the middle distance, a lace of surf along the beach, spray. Seen.
- Earth's storm at the new stand (13 m/s, clock 8853): swell bands but no white horses and no surf line in view (the
  bank hides the waterline). PHYSICS' P20 found that the sea in the game was low for 10 to 15 s after arriving (fixed
  in `38a3266`); my frame was 10 s after a teleport, on the head before that fix. The shader now also draws white horses
  by the local share of white (`galeW` from `sea.w`, it waited for Hs over 0.5 m): Earth's storm whitens 5 to 6 % of the
  sea at Hs 0.3 to 0.4 m (`seacheck.mjs`). Not re-filmed after P20 (Neptune took the browser time).

### 1f. The cliff walls
- The coast recipe's cliff (`surface.js`): it was one step over 3.3 m of the land's rise (a wall 15 to 25 m across in
  plan, 50 to 75 degrees, a level lip). Now a profile over 4.6 m: a skirt of talus, the face in two lifts with a ledge
  across it where a 70 m noise says so, a rounded shoulder, and the top 0.78 of the cliff's height at the lip rising to
  all of it inland (a narrow headland's top falls toward its tip). Slopes over 70 degrees on Neptune's coast 5.9 % ->
  under 2 % (scratch `slopes.mjs`). The striped cliff behind Earth's old pool (the easel's view) with a first version
  (top 0.66): the stripes are gone, but so is the hill's height near the shore (`p12-cliff-barcode-v1`); the softer top
  (0.78) keeps the stripes away too, but narrow headlands are still lower, by up to 23 m (see Next (1); `p12-cliff-barcode`). At the sea_coast stand the headland is a little lower and rounder (`p12-earth-misty-forest-coast`).
- Stacks (`_stacks`, coasts and sky islands): a rounded crown and a skirt of fallen rock at the foot. In Neptune's
  storm the big stack read as a black slab with ruled sides; the terrain's storm wash no longer pushes a dark wash
  toward black (`materials.js`, scaled by the wash's own value). Seen: in Neptune's gale the big stack is a dark indigo-grey with a sloping foot, not a black slab with ruled sides (`p12-neptune-aurora-storm`, 15 s after arriving; the sea map read in the page: Hs 5.2 m, 15 % white, the map's grids and band set).

### 2. The art pass's shared-code causes
Before frames: the art pass's own frames at the same stands where the stand is unchanged (`/home/user/.pc-scratch/art`;
the scene differs a little where its frame came from an intermediate state), my own head frames for Earth's autumn
wood and the cliff view; after frames from my runs (clock 30, hour 10, 800 x 450, top tier).
- **Shadow glaze (wish 2)**, `chunks.js` `pcTone`: the deepest step is the cool glaze over the local colour with the
  pigment pooled heavier (`pcDensity(c * glaze, 1.55)`), not a second glaze (it turned warm shadows violet: sand at
  Mercury's dusk glaze went from hue 89 to -54 in Lab, `tone.py`). Jupiter's near crown reads olive, not slate
  (`p12-jupiter-glaze`); the autumn crowns and Mercury's crystals hardly change (`p12-autumn-glaze`,
  `p12-crystal-glaze`): kept, causes named in "Next".
- **Boulders (wish 1)**, `florakit.js` `rockGeometry`: cleaved by five planes (a top tilted 10 to 30 degrees, four
  leaning sides), facets lit by their own normals, 0.57 of the scale high (0.78), pigment pooled at the stone's edge
  (`materials.js` rock). `p12-desert-boulders(-crop)`: the pale soap lozenges are broken stones. `obstacles.js`: radius
  0.58, height 0.37 of the scale, so the collision is what is drawn.
- **Stands and views (wish 7)**: Venus `lava_rivers` stand on the west bank 10 m from the lava looking up the river
  (it stood 0.8 m deep in it, the tour re-stood 8 m off in third person): the river is the subject
  (`p12-venus-stand-mars-arrival`); the lava itself is a leopard print (see Next). Moon `rilles` stand on a rille's rim
  looking along it (scratch `rille.mjs`: rim 1.3 to 2.6 bed-widths from the stream line): the winding rille reads
  (`p12-moon-rilles`). The Moon facing Earth: see For PILOT 5.
- **Misty sky and aurora (wish 5)**, `index.js` and `sky.js`: a biome's mist pales its own sky (the zenith toward the
  haze by up to 0.8, the horizon toward paper, the cloud shadow toward the haze; misty_wetland 0.45 and honey_mist 0.30
  take it, the temperate wood a breath). First strength (0.5): too weak (`p12-misty-shallows`); At 0.8 the sky over the wetland is a pale whitish blue running down into the mist, the cumulus softer (`p12-earth-misty-forest-coast`): kept.
  Aurora: a biome may name it (`aurora: 1`, Neptune's tundra); curtains with a wavy pale viridian lower edge, rays
  fading into violet, folded along the horizon, anchored to the planet and drifting; by day a pale ghost, by night the
  palest thing low down. First version at 4 to 10 degrees up: lost in the near-paper low sky (`p12-neptune-aurora-v1-
  stand`); Raised (its lower edge 9 to 19 degrees up), viridian to violet, 0.62 of the way by day: pale green curtains with rays stand in the upper sky by day (`p12-neptune-aurora-storm`): kept. Not seen at night.
- **Airless haze (wish 6)**: `index.js` gives an airless world its look's visibility near the ground (it was 40 km),
  easing to space's clear air from 250 to 2500 m up; `moon.js` visibility [900, 9000] and a pale silver haze. In the
  rilles frame the far rims are softer, the effect is small (the horizon is 70 to 400 m off).
- **Night key (wish 3)**, `post.js`: at night the land's washes under half value are laid into a band above the night's
  deepest indigo (a toe, not a clamp); the sky keeps its own night. Mercury obsidian at 23 h: land median L 8.4 (one
  flat mass) -> 23.5, p5 21, p95 24.5, a step under the low sky's 30 (`p12-night-key`).
- **Arrival frames on Mercury and Mars**: no boulder or shard within 6 m of a first landing (`floraplace.js`), plus the
  new boulders: Mercury's crowd of saturated violet boulders round the explorer is gone, Mars' pale lozenge too
  (`p12-mercury-arrival`, `p12-venus-stand-mars-arrival`).
- **Halftone on near shallows (wish 9)**: the bed's small bumps rose through the water where the two meshes interpolate
  differently; the water is laid 6 cm higher in the last 0.4 m of depth (`materials.js` water vertex): the dots are
  gone (`p12-misty-shallows`). PHYSICS told (their floating twin).
- **Flower heads (wish 10)**: five lobes, cupped, tilted out of the clump (`florakit.js` flowerGeometry). At stand
  distance they are a few pixels: no visible change either way (`jupiter hanging_gardens`).
- **Blizzard crest (item 3)**: sparse rock teeth 0 to 3 m along small ridges on the alpine flanks above the meadows
  (`surface.js` alpine): the ruled diagonal is broken (`p12-blizzard-crest`, before is the tenth agent's frame).
- **PHYSICS P20's asks**: splash rings a faint soft glaze a step under paper (alpha 0.58 -> 0.22); spray thins toward
  the lens from 7 m; kicked dust on airless worlds a small crisp grain, not a puff (`G.uAirless`); compiled (no link log, no console message) but not seen in a frame: no rain on water and no walk on the Moon was filmed.

### For PILOT (twelfth PAINTER agent)
1. **Your review 6b item 1 (SHOULD FIX), done**: `src/world/obstacles.js` `cellsAround` now reads every cell the
   disc touches (a square grid of points at most 0.45 of a cell apart over the disc, and its rim as closely), and the
   query's radius cap is 90 m (was 60; you ask 80 round a landing site). Your `obsmiss.mjs` (wide query / union of
   4 m queries): Earth 80 m 554/536 (was 260/536), Mercury 80 m 132/126 (15/126), Neptune 80 m 209/202 (88/202),
   Pluto 30 m 93/85 (22/85), Mercury 30 m 37/36 (18/36); the wide query now finds as many or a few more (the union is
   sampled on a 5 m grid). Your contract tests pass with it.
2. **Item 2, done**: no boulder or shard is placed within 6 m of a first landing's clearing (`floraplace.js`
   `placeUnder`, the same cells the obstacles read). Your `arrival.mjs`: moved 0.0 m on all ten bodies (room 5.7 to
   10.9 m; Jupiter and Uranus clear).
3. **Item 3, Neptune's season: yes, flip it** (`axialTilt` 0.49). Arrivals in a lilac twilight at every hour are not
   the painting; `aurora_tundra` keeps its aurora in the sky code whatever the sun. Say when it is in and I re-check
   `kelp_forests` (the art pass tuned it under a 2-degree sun).
4. **The boulders are a new shape** (ARTPASS wish 1, `florakit.js` `rockGeometry`): cleaved, flatter stones, 0.57 of
   their scale high (were 0.78). `sampleObstacles` gives a boulder radius 0.58 and height 0.37 of its scale (were 0.62
   and 0.58), so what you bump into is what is painted; the walker meets lower stones.
5. **The Moon facing Earth (ARTPASS wish 7)**: not a stand question. The Moon turns once a month (3600 s), so after
   `teleport({hour: 10})` Earth's place in its sky depends on the clock: at the rilles stand, azimuth 96 and 7 degrees
   up at t = 0, under the horizon from about t = 300 to 2300 s, up in the west after (scratch `moonearth.mjs`). No yaw
   faces it at every clock. If the tour or the arrival should show Earth, it is the hour or the Moon's `orbitPhase`
   that would do it (yours).
6. **The ship at a coast stand**: at a beach 1 m from the water the ship was set down in the shallows (foam ring round
   its hull, Earth's first candidate beach); at the stand kept (`sea_coast`, facing 120) it is out of view. A ship
   standing in surf is worth a look in `spawnOn` (dry ground for the gear).
7. The sea map is wired (`c08dddb`): nothing for you, but a landing on water now meets the local sea.

### For PHYSICS (twelfth PAINTER agent)
1. **Your sea map is wired** (P18 and P19, `c08dddb`): `PC_PHYS_SEA_MAP` in the water material, the texture and the
   three grids/band copied in `syncPhysWater`, the local sea and the local way of the waves read everywhere the shader
   read `uPhysWaterSea` and `uPhysWaterDir`. Compiled on SwiftShader: 36 programs, no link log, no console message;
   frames show a breaking crest, shore foam and swell bands.
2. **coast.mjs: both PASS** (clean export of `418ac5b` and later). Neptune's margin is thin (Hs 3.18 m against the
   mark 3.14), and here is why: the squall that coast.mjs finds peaks at 240 s, so its 150 s settle starts at 90 s,
   and the swell (90 s to come up) has not grown: the most exposed water about, at the target's own 2.5 km and 30 to
   47 m deep, reaches 3.05 to 3.30 m against the target's 4.21 (0.73 to 0.78 of it). Most beaches facing the storm
   miss the mark by 1 to 5 %; with `--settle=240` (the run from t = 0) they pass with room (3.24 m at a beach that
   fails at 150). Your call whether the target should be what this storm can raise in the time it blows.
3. **Neptune's coast terrain changed** (the coordinator's ruling): `neptune.js` `storm_seas` `t.open`, a reach of
   open water 2.3 km long east of the old stand, floor 34 m down; the big island east of the old stand is under it.
   The stand moved 390 m south (STANDS `storm_seas`). Your lab or film subjects placed by `getStandPure('neptune',
   'storm_seas')` move with it; the old stand's lagoon is now open water to the east.
4. **The boulders are flatter** (0.57 of their scale high, were 0.78; `sampleObstacles` 0.37 of the scale over the
   ground, was 0.58): if your clamber reads PILOT's boulders, it meets lower faces.
5. **Your floating twin (P20 note)**: the water vertex stage now lays the sheet 6 cm higher in the last centimetres of
   the shallows: after the waves' mix, `p += up * 0.06 * (1 - smoothstep(0.05, 0.40, aDepth))` (aDepth the still
   depth): the bed's small bumps rose through the surface there as a halftone of dots (ARTPASS wish 9). Add the same
   term to `waterLevel` near shore, or the figure stands 6 cm into the sheet in ankle-deep water. Nothing else in the
   mix changed (1.28, the 0.07 beach and the carry are as they were).
6. **Splash rings** (your P20 proposal): `kitmat.js` ring: cover alpha 0.58 -> 0.22, its edge softer (0..0.34), the
   colour a step under paper (0.96); region kept (the rings are a glaze laid after the brush, so the region does not
   soften them). Seen in a frame: see the hand-over.
7. **White horses at Earth's coast**: the shader now breaks white horses wherever the local sea's white share says so
   (`galeW` takes `smoothstep(0.012, 0.07, sea.w)`, it took Hs over 0.5 m only): Earth's 13 m/s storm whitens 5 to 6 %
   of the sea at Hs 0.3 to 0.4 m. Your P20 arrival fix matters here: my storm frames were taken 10 s after a teleport.
8. **Your other P20 asks**: spray (`kitmat.js` spume) thins toward the lens from 7 m and is gone at 1.6 m; kicked dust
   on an airless world (`G.uAirless`, set by the world per body) is drawn as a small crisp grain of the ground's own
   dust, not a soft puff, so a fan of grains keeps its shape (compiled; not yet seen in a frame of a walk on the Moon);
   Neptune's near-black cliff: the terrain's storm wash no longer pushes an already dark wash toward black, and stacks
   have a rounded crown and a skirt; Earth's combed headland stripes: the coast cliff profile (talus, two lifts, a
   ledge, a rounded shoulder). See the hand-over for what was seen.

## Handover of the hardening review (eleventh PAINTER agent; kept)

Written by the eleventh PAINTER agent (the lead's hardening review, `docs/lead/HARDENING.md`, while the
owner's art pass ran). The tenth agent's handover is kept below it ("Handover of block 7"); its rules hold.

- **Where things stand**: the review's PAINTER items are done and checked on clean exports: A3 (the branch
  clock is bound and live), A2 (prewarm hooks; 0 programs built after the prewarm through night, day, storms
  with every kit, tier 0, space, arrivals on foot on four other worlds), A1 (log depth written per vertex without
  EXT_clip_control; no fragment shader writes `gl_FragDepth`; no hole or z-fighting at the ship's pad or the
  shore), gap 17 (well-defined smoothstep edges and atan), gap 12 (an 8-bit fallback for the float targets,
  `painter.floatFallback`). Also: the gallery's run and walk re-filmed after the heel change (they read), the
  explorer's face shaded under the brim. See "M3 hardening" below for each, with the evidence.
- **The art pass** (owner's order) still owns `src/data/looks.js` and `src/data/looks/` until the
  coordinator ends it: keep to shared code.
- **Next, in this order** (start only when the coordinator says the art pass is over): (0) **wire PHYSICS'
  sea map** (P18, up to `5f480bf`): its "For PAINTER, P18" section in `docs/notes/physics.md` gives the
  code (two uniforms and a texture in `shared.js`, the `PC_PHYS_SEA_MAP` define, the local sea in place of
  `uPhysWaterSea` in the water shader); its GLSL has never been compiled: compile it and open a frame. Until
  then the game draws P16's sea. (1) **the coast fix**, judged with `node src/physics/coast.mjs` until both
  stands say PASS (today both NOT YET; Neptune: Hs 0.71 m 80 m out on 0.8 km of fetch against a target of
  3.23 m and 15 % white): both coast biomes must face open water toward the storm wind. The stands are mine (`src/art/easels.js`
  STANDS), so a new stand is the simplest fix and moves no site; candidates and how they were found are in
  "The coasts" below (Earth `sea_coast`: one beach with 2067 m of PHYSICS-measured fetch at 16 m deep;
  Neptune `storm_seas`: the best reach 1.4 to 1.8 km, the biome ends at the ice spires: say so to the
  coordinator, or open the coast recipe's water toward the biome's edge). PHYSICS 16 is writing a Node tool
  that reports fetch, Hs and white-horse share at a stand: use it. Then re-film Neptune's gale and look for
  the torn white crests. (2) In the same pass, the coast recipe (`surface.js` 'coast'): the cliffs are
  near-vertical walls 1 to 2 m wide in plan with a level lip (a shaded height map, scratch
  `hmap.mjs`/`hmap.py`, shows it), so a headland's end is a ruled vertical edge: widen the face, give it a
  ledge and talus, and let a narrow headland's top fall toward its tip. (3) The blizzard's ruled crest:
  the slope at lat 62.41 lon 49.46 rises 30 % and is smooth from 10 to 60 m (`bliz.mjs`): crags or drifts of
  2 to 4 m on the alpine flanks (not the meadow floors where the stands are) would break the skyline; a
  shader half is ready in scratch `snowpatch.py` (drifts along the contours, rocks through fresh snow),
  untested. Both change Earth's alpine look: after the art pass. (4) The explorer's face: a shade laid under the brim now ("M3 hardening"); the head is still an egg. (5) Item 4 of block 7: the brush, two walled vistas, Mercury from orbit, Mars' dune crests,
  PILOT's UI look review (the vistas, Mercury and Mars touch look data: after the art pass).
- **How to work here**: scratch tools in `/home/user/.pc-scratch/painter/m11/` (may be gone): `mkexp.sh
  <name>` (a clean export of the head with my changed files over it), `probe.mjs <export> <out>
  [--nowarm] [--bodies a,b]` (counts `linkProgram` after ready through a set of events; `LAND=1` lands on
  other worlds), `dump.mjs` / `dumpf.mjs` (the review's shader dump; `--noclip` hides EXT_clip_control,
  `--nofloat` the float colour buffers; `ROOT=<export>`), `fdcheck.py <src dir>` (which shaders really
  write `gl_FragDepth`, through the `#if`s), `mksteps.mjs` (steps: space, the ship's pad from 7 m, the
  sea_coast shore and a wade, a colour space check), `gal.mjs <export> <prefix>` (the gallery figure:
  run and walk poses by PHYSICS' stride, then its face), `beach.mjs <export> <body> <biome> <wind sectors>`
  (beaches facing open water, PHYSICS' fetch measure), `fetch.mjs`, `hmap.mjs`, `bliz.mjs`. One browser at
  a time; the game is ready after 4 to 7 minutes here, a 640 x 360 frame takes 1 to 3 minutes.
- **Rules that bit me**: (1) three r187 keys a program on the geometry's attributes as well as the
  material (`HAS_NORMAL` when it has a `normal`): a stand-in geometry compiles a variant nobody draws.
  (2) A compile made with no render target bound keys programs to the canvas's colour space; the scene is
  drawn into targets. `renderer.outputColorSpace` is now linear, so both agree (pixels unchanged). (3) The
  review's "grep gl_FragDepth" check cannot tell an active write from one behind an `#if`: three expands
  includes as text. (4) The gallery puts the explorer 1.5 m to the right of the view: at `mdist` 3.2 and
  `fov` 34 it is half out of the frame (`mdist=6`, or `mside=0`).

## Handover of block 7 (tenth PAINTER agent; kept)

Written by the tenth PAINTER agent (M3 block 7, after the ninth was stopped by a usage limit).
The eighth agent's handover is kept below it ("Handover of block 6"); its rules still hold.

- **Where things stand**: block 7 (the picture in motion, the weather) is verified and
  finished: see "M3 block 7" below for every piece, the evidence and a blunt verdict each. In
  short: arrival, fill and walk pass (no pops, no tier flicker); Neptune's sea heaves and runs
  up; the pale forms in Neptune's storm sky were headlands in a near-white mist (fixed in shared
  code: storm mist is grey, the low sky takes it); the dust storm veils the explorer (near-air
  veil `G.uAirNear`); spray is a soft blot. Weak: no torn white crests on the near sea; the near
  headland's vertical end; the blizzard's ruled crest.
- **The explorer steps** by PHYSICS' gait (`models.js`, item 2): boots by `feet`, hips by
  `ride`, no clock of its own; PILOT's `figureArgs` passes the fields. Gallery `gait=` poses it.
- **Branches move** (item 3): PHYSICS' `pcPhysCrown` in the tree shader (`PC_PHYS_BRANCH`,
  materials.js), per-vertex `aBranchId` / `aLeaf01` from the kit builder (`florakit.js`:
  a trunk -1, every other tube or blob its own number, a birch's foliage masses take the number
  of the branch whose tip is within 2.2 m), `uPhysBranchClock` in `PHYS` (shared.js). See item
  3 below for what was seen.
- **The art pass** (owner's order, 2026-11-11): `src/data/looks.js` and `src/data/looks/` belong
  to the 'art' role until the coordinator ends the pass. Do not edit them; keep to shared code.
- **How to work here**: render only from a clean export of the head with only the files you
  changed laid over it. Scratch tools in `/home/user/.pc-scratch/painter/m10/` (may be gone):
  `mkexp.sh <name> [base]` (export plus your changed files), `strip.mjs <export> <prefix> <body>
  <biome|spawn> <t> <yaw|''> <frames> <dt> <k>` (the game at a stand, the clock driven, a frame
  every k steps), `arr.mjs` (an arrival filmed 2.8 s), `nep.mjs` (Neptune's stand at several
  yaws, with the haze numbers), `gait.mjs` (the figure posed by PHYSICS' stride in the gallery),
  `why.mjs <export>` (prints the console line if any module fell back to a stub), `sheet.py`,
  `js/prof.mjs` (the skyline from a stand: elevation, distance and height per azimuth). The
  lead's `tests/motion.mjs` and `tests/weather.mjs` with `--root --out --sheets` (always pass
  the last two or they write into the lead's evidence). The machine is shared and slow: the
  game is ready after 5 to 15 minutes, a frame of a strip 15 to 70 s.
- **Next, in this order** (the lead's hardening review, `docs/lead/HARDENING.md` "PAINTER (in
  order)", relayed by the coordinator): **A3** `uPhysBranchClock` is in `PHYS` at the head
  (`shared.js:135`, committed): confirmed in the file; the lens's own check (read it on
  `pc-prop-tall-broadleaf0` twice 10 s apart) was not run. **A2** prewarm hooks for PILOT's P3:
  `world.prewarm()` (await the kits import kept from `buildKits`, `makeDab` for every body,
  `st.flora._init()` for every body with flora, or compile its prop materials against a tiny
  InstancedMesh) and `painter.prewarm()` (draw `mAbs[4]`, `mAbs[8]`, `mSheet` and the prep and
  keep materials once into a 2x2 target); PILOT 8 writes the caller. **A1** log depth in the
  vertex shader when EXT_clip_control is missing (exact lines in HARDENING.md; `PC_FRAG_LOGDEPTH`
  only for water and near ground if they poke through; check the explorer at the shore and the
  ship on its pad). Optional: the reversed smoothstep edges (gap 17). **After the art pass**:
  both coast biomes must face open water (Neptune `storm_seas` faces a lagoon dry 120 to 170 m
  out with the storm wind from E/ENE; Earth `sea_coast` a pool under 50 m with the wind
  offshore): 2 km of fetch at about 20 m deep toward the storm wind; tell the coordinator if
  it needs the sites (look data) changed. Then the unfinished block 7 bits: torn white crests
  on the near sea, the near headland's vertical end, the blizzard's ruled crest, the gallery
  run re-filmed after the heel change, item 4 of the block (the brush, two walled vistas,
  Mercury from orbit, Mars' dune crests, the explorer's face, PILOT's UI look review).
- **Rules that bit me**: (1) the coordinator's WIP snapshots sweep your working files into the
  head within minutes; commit under your own message as soon as tests pass. (2) A head can be
  broken in the browser while every Node test passes (a module cycle: the game silently ran on
  PILOT's stubs); `why.mjs` or `__pc.info().using` tells. (3) Before you fix a "glitter", find
  which term draws it: I changed three water terms before a zoomed crop showed the specks were
  the spray kit. (4) The gallery `cam=vista` stands on the easel 9 m up: use `cam=trees` for
  the figure.

## Handover of block 6 (eighth PAINTER agent; kept)

Written by the eighth PAINTER agent at the end of M3 block 6 (the last art block before the
lead's review 6). My commits: `5edf80c` (the worlds' ideas, the motion fixes, orbit, the timed
test) and the one after it (flowers, splash rings, rain, veils, orbit frames, these notes).
Block 5 and the earlier records follow; "Rules that bit me" of the earlier agents still hold.

- **Where things stand**: Venus, Saturn and Jupiter now say which world they are in the first
  view (frames `docs/shots/painter/idea-<world>.jpg`, before | after, all opened at full size).
  The lead's motion faults 1 (pop-in), 2 (flower disc), 3 (splash rings), 4 (crowns hiding the
  figure) and 5 (crouch) are in code; **none of them has been seen in motion** (no filmstrip
  was run: one frame costs minutes here). The ten bodies were opened from orbit before and
  after (`orbit-before.jpg`, `orbit-after.jpg`). The brush (item 4) and the short list (item
  5) were not started. See "M3 block 6" for every verdict and what is weak.
- **Where the new things are** (all in my files):
  `src/data/looks.js`: `spawn: [x, y, z, yaw, pitch, clearing r, berth bearing]` (a first
  landing chosen by eye; degrees; the berth is the compass bearing, 16 m off, of the level
  spot where PILOT's `spawnOn` will find the flattest ground for the ship: it is one of
  PILOT's ten directions, 55.6 - 36 i degrees); `skyBelts: [belts, wander, strength]`,
  `seaDeck: [top m, strength, heads]`, `limb` (how far the limb thins into haze from space;
  default by the depth of the air); on a riverbed `t.flow`, `t.lqD`, `t.ember`, `t.emberR`.
  `src/world/surface.js`: `getSpawn` takes `look.spawn` while it is dry and nearly level
  (else the old search), pushes a levelled place (`pads`, applied in `sample`) and a
  clearing; riverbed: swelling bed, ember and char washes, negative `aux` = cracks of fire
  (drawn in `materials.js` where `vPar.w < 0`); island patches only on the tops.
  `src/world/sky.js`: three blocks before the clouds: the ring arc (plane y = 0 of the body,
  `uRingS`, `uRingC`, profile shared with `orbit.js` `RING_PROFILE`), the belts (`uBelt`),
  the far cloud sea and its cumulus heads (`uSeaC`). `src/world/index.js` sets them per
  body, hides the ring's geometry below space01 0.55, carries the limb strength in
  `uFog.w`, returns yaw and pitch from `getSpawn`. `src/world/orbit.js`: ring profile and
  the planet's shadow on the ring, `uLimbCos` (cloud not drawn past the limb).
  `src/world/flora.js`: the wash clock (`washNow`, real time in steps of 0.02 to 0.1 s),
  `aBorn` per instance (when it came into its mesh; negative: when it left), a second fill
  of the chunk when the wash has dried (`washUntil`), `busy` counts a wash in progress,
  `_focus` (the explorer's figure in view space: `G.figure` is set by `models.js`).
  `src/render/materials.js` (flora shader): `vWash` and the two interlocking discards,
  `uFocus` window; lava; the near flower's lobed edge. `src/render/kitmat.js`: the splash
  ring is a glaze; rain 0.64 to 0.78; veil gain 1.5 to 2.6.
- **How to work here**: render from a clean export, two renders at a time, kill only your own
  processes by PID. Scratch tools in `/home/user/.pc-scratch/painter/m8/` (may be gone):
  `mkexp.sh <name>` (export of HEAD plus my working files), `v.mjs <export> <prefix> <body>
  spawn | "x,y,z,yaw,pitch,hour" ...` (the game at the top tier in third person at the true
  spawn or at places; prints PROBLEMS if the console had any), `orb.sh <export> <prefix>
  body...` (each body from orbit through the gallery), `lib.mjs` with `sv.mjs` (lava banks),
  `si2.mjs` (island rims: what the easel sees over the rim), `near.mjs`, `lv.mjs`.
  A frame took 3 to 6 minutes; the game was ready after 90 to 310 s.
- **Rules that bit me**: (1) these planets are tiny (R 3.6 to 5 km): from the top of a
  100 m island the cloud sea's horizon lies 12 degrees below eye level and the island's own
  rim hides everything below 6: **the sea cannot be seen from a level landing**, whatever
  the spot. That is why the far sea and its heads are painted into the sky. (2) Saturn's
  rings stand 49 to 69 degrees up at latitude 12 and 14 to 40 at latitude 30: the arc is in
  a third-person frame only between about 28 and 42 degrees of latitude, facing the equator.
  (3) A `python` edit that slices a function by two anchors removes what lies between: I cut
  the tangent frame out of `getSpawn` that way; the tests caught it. (4) The coordinator's
  WIP snapshot commits sweep working files: commit under your own message as soon as the
  tests pass. (5) to (13): the earlier agents' rules below still hold.
- **Next**: (1) see the motion fixes in the lead's `tests/motion.mjs` (fill, walk, low
  flight, jetpack among trees) and correct them: the wash-in pattern may be too coarse or
  too fine, the window round the figure too wide. (2) The build order after a landing (far
  and tall first) and the ground arriving in pieces: not touched. (3) Item 3's frames:
  leaves, sand skim and blown snow blowing; Neptune's far sea; PHYSICS' pale rectangle in
  Neptune's sky (yaw 236 from the `storm_seas` stand, 34 to 42 s): not looked for. (4) The
  brush at full resolution. (5) The short list (two vistas in a thicket, Mars' dune crests,
  branch sway and drifts, the explorer's face, the UI look review).

## M3 hardening: A3, A2, A1, gaps 17 and 12 (eleventh PAINTER agent)

The lead's hardening review (`docs/lead/HARDENING.md`, "PAINTER (in order)") and the coordinator's
follow-ups. Every check ran on a clean export of the head with only my files laid over it (scratch
`/home/user/.pc-scratch/painter/m11/`), SwiftShader through ANGLE, one browser at a time. Commits:
`90025a3` (A2, A1, gap 17); gap 12 and the gallery came into the head in the coordinator's snapshot `0b76f2c`
(recorded in `46fcbf8` with the evidence); the face and these notes in its snapshots `d874259` and `5b083c1`.

### A3 the branch clock: confirmed
`probe.mjs` (the game at the Earth spawn, the loop running): `pc-prop-tall-broadleaf0` has
`uniforms.uPhysBranchClock` (and `PC_PHYS_BRANCH`); read twice 10 s apart (frames 85 and 86, game clock
12.12 and 12.37 s) it went from (1.972, 0.740, 3.944, 0.988) to (2.421, 1.377, 4.842, 2.254): bound and live.

### A2 the prewarm hooks (PILOT's P3)
- `world.prewarm()` (async, resolves true; `src/world/index.js`): awaits the kits' import (the promise is
  kept from `buildKits`), makes every far world's dab, and puts an invisible group `pc-warm` in the scene
  holding one tiny instanced mesh per flora wash of every world (`Flora.warmSet()`: kits and materials made
  by `_init`, no cell built; each wash on a kit geometry it is drawn on), the near ground's wash if no world
  has drawn it yet, and the PHYSICS kits not yet in any group. The group is never drawn and leaves the scene
  30 world updates later; the materials stay, and with them their programs. Memory: kits and materials only.
- `painter.prewarm(scene, camera)` (`src/render/index.js`, `post.warm()`): compiles the scene with the
  scene pass's own target bound (compileAsync where KHR_parallel_shader_compile exists, else the plain
  compile: three's compileAsync only warns there), then lays the 4- and 8-sector brush and the sheet once
  into a 2 x 2 target, whatever the tier, so the first drop to a lower tier builds nothing. Without
  arguments it only lays the brush passes. Resolves when the programs are ready.
- `renderer.outputColorSpace = LinearSRGBColorSpace` (createPainter): no painted shader converts a colour
  space, so the canvas now has the same program key as the painter's targets, and a compile made outside the
  scene pass builds the programs that are drawn. The canvas still shows sRGB (three keeps
  `drawingBufferColorSpace` 'srgb'): measured, the same pixels (canvas told sRGB or linear: mean 0.0007
  levels, max 2, against 0.0004 between two frames at one setting).
- Caught on the way: three r187 keys a program on whether the geometry has a `normal` (`HAS_NORMAL`); a
  position-only stand-in compiled a variant nobody draws and missed Neptune's kelp. The stand-ins are the
  real kit geometries now; terrain and water need none (every world's are in the scene from the start).
- **Proved** (`probe.mjs`, the review's probe extended: it counts `linkProgram` and lists each new program;
  480 x 270, the top tier, dynres off; ready after 254 s, every module real): after `await
  world.prewarm(); await painter.prewarm(scene, camera)` (17 programs built there, 19 to 36; 15 s on
  SwiftShader; no material in the scene left without a program), **0 links** through night (23 h), day, the
  Earth spawn's storm at clocks 165 (rain, leaves, splash rings) and 230 (rain 0.92, hail), a forced tier 0
  and back, the ship at 300 m (snow, dust, sand kits) and in space, Saturn's orbit, and **arrivals on foot on
  Neptune (kelp), Uranus (frozen waves), Venus (fungus towers) and Jupiter (vines)**, each settled. No
  console message, `fallback` and `__pc.errors` empty. (A first run, before the geometry fix: 1 link.)
  PILOT's caller (`src/main.js` `prewarm()`, b990e8b) makes exactly these two calls before `__pcReady`.
- **A landing on another world after ready** (the coordinator's check; `LAND=1 probe.mjs --nowarm` on a
  clean export of the head `5b083c1`, the game's own prewarm only: 36 programs at ready): **0 links** with
  the ship over Mars at 300 m and then down on foot on Mars, Mercury, the Moon, Pluto and Saturn, each
  settled; the branch clock read twice again (changed); no console message, `fallback` empty.

### A1 log depth without EXT_clip_control (Firefox)
`src/render/chunks.js` as HARDENING.md gives it: `logDepthBufFC` declared in VERT_PARS; in VERT_END
`gl_Position.z = (log2(max(1e-6, 1.0 + gl_Position.w)) * logDepthBufFC - 1.0) * gl_Position.w` for a
perspective projection (`isPerspectiveMatrix`, as three's old path had); in FRAG_PARS
`USE_LOGARITHMIC_DEPTH_BUFFER` is undefined after its declarations unless the material defines
`PC_FRAG_LOGDEPTH`, so `#include <logdepthbuf_fragment>` writes no `gl_FragDepth`. A material that opts in
also keeps three's own clip-space depth in its vertex stage. Where the extension exists none of this is
compiled. Why per vertex is enough on these worlds: the depth is exact at the vertices and linear across the
screen between them; for a triangle whose far corner is r times as far as its near one the error is about
log2((1 + r) / 2) - log2(r) / 2: the terrain's LOD keeps a cell under 1/40 of its distance (r < 1.025: under
a millimetre a metre); the ship's hull at its pad (1 to 2 m triangles at 5 to 10 m) about 1 %.
- **Without the extension** (the review's `dump.mjs --noclip`; clean export of 932cd9d + my files, 640 x 360,
  top tier; three: reversed 'false', logdepth 'true'): **37 programs, every one linked with empty logs**,
  through the spawn, space, the ship's pad, the sea_coast shore and a wade; no page error; `fallback` empty
  (the one console line was three's KHR_parallel_shader_compile warning from PILOT's earlier caller, gone
  on the head). Through the preprocessor (`fdcheck.py`, which follows the `#if`s in three's expanded
  sources): **no fragment shader writes `gl_FragDepth`** (the lens's run of the old code: 30 did); 28
  vertex shaders write the log depth. (A plain `grep gl_FragDepth`, as HARDENING suggests, still lists
  them: the include is expanded as text and stays behind its `#if`.)
- **Shots, all opened** (`docs/shots/painter/a1-logdepth-clip-vs-noclip.jpg`: left the head `90025a3` with
  the extension, right without; rows: the ship on its pad from 7 m, the explorer at the sea_coast pool's edge,
  wading 2 m in; `a1-logdepth-crops.jpg` the same enlarged): the same depth layering in both (a birch in front
  of the ship's tail, the legs into the meadow, the boots on the sand and in the water), no hole, no
  z-fighting at the boots, the waterline or the hull. The spawn and space match the lens's
  `logdepth/00-ready.jpg` and `01-space-earth.jpg`. No material needed `PC_FRAG_LOGDEPTH`. The early-Z gain
  itself cannot be measured on SwiftShader.

### Gap 17: well-defined edges
Four reversed `smoothstep` edges (kitmat.js rain, orbit.js limb, materials.js cloud-sea hollows, sky.js
heads) are written `1.0 - smoothstep(lo, hi, x)` (what drivers computed anyway), and three `atan(y, x)` that
could meet (0, 0) (the near ground's round touch, the great storm's spiral, the pulse streaks) take x = 1
there. Compiled in both depth paths above.

### Gap 12: an 8-bit fallback for the float targets (`painter.floatFallback`)
Where neither EXT_color_buffer_float nor EXT_color_buffer_half_float exists, `Post` makes the scene pass's
second target, the half-size prep target and last frame's copy 8-bit and sets `G.uAux8` (shared.js) to 1:
`pcWrite` then packs the second target into 0..1 (`pcAuxEnc` in FRAG_PARS: normal to 0..1, log depth over
32, the region over 8 with its hash kept clear of the next class), the backdrop and the sky pack theirs,
and every reader unpacks (`pcAuxDec`: the brush, the sheet's pencil and lightning, the water's mirror reading
last frame's depth, the kits' and the stars' glazes). `painter.floatFallback` is true there, so PILOT's
sentence on the bare sheet stays away. Where float targets exist `uAux8` is 0 and every value is as before.
- **Checked** (`dumpf.mjs --nofloat`, both extensions hidden; clean export of 9b5c941 + these files):
  `floatFallback` true, 36 programs linked with empty logs, no page error; the spawn, the storm at clock 230
  and the sea_coast shore paint as with float targets (`docs/shots/painter/gap12-float-vs-8bit.jpg`, left
  float, right 8-bit, opened): the same picture, a few more pencil lines in the near grass where the depth is
  8-bit. One console warning remains: three's own "EXT_color_buffer_float extension not supported", when a
  float data texture (the noise, PHYSICS' fields) is uploaded; sampling them needs no extension.

### The gallery (PHYSICS' ask) and the run re-filmed
- `gaitPose` takes the hips' rise and fall from PHYSICS' `strideBob(v, g, stride, T, o)` (d186b65: the
  body's own `st.phys.bob`), no longer a copy of its formula.
- `window.__pcModel` (the explorer's `face`, `dist` ahead and `side` to the right, read every frame; URL
  `mside=`, default 1.5 m): several views of the figure from one load (scratch `gal.mjs`).
- The run (4.2 m/s, six poses) and the walk (1.5 m/s, four) re-filmed after the tenth agent's heel change
  (`docs/shots/painter/gait-gallery-after-heel.jpg`, opened): the run reads as running, the trailing heel
  drawn up to about knee height (it knelt in the air at hip height before); the walk scissors, the heel
  lifts a little. No console error.

### The coasts (prepared, for when the art pass is over)
The stands are mine (`src/art/easels.js` STANDS), not look data: both coast fixes can be a new stand with no
site moved. Searched in Node on a clean export (scratch `beach.mjs`: dry level ground within 1.5 m of the
water, water 8 to 20 m toward the wind, then PHYSICS' fetch measure of P16, `water.js FetchGauge`: the mean
of five radials, +-12 deg, about the wind's sector, 16 m steps growing by a tenth, to 2500 m; the least of
the storm's sectors). PHYSICS' P18 has since replaced that gauge with a sea map and written
`src/physics/coast.mjs` (fetch, depth, Hs, white share and PASS/NOT YET at each coast stand): judge with it.
- Earth `sea_coast`, sectors E and ESE (PHYSICS: 145 of 148 storm samples from ESE, E or SE): dir
  (0.435960, -0.499126, -0.748874), fetch 2067 m, 16.0 m deep (1.26 km south of the old stand); the old
  stand faces a pool, 8 to 50 m.
- Neptune `storm_seas`, sectors E and ENE (137 of 150 from E or ENE): no beach of the biome reaches 2 km in
  both (it ends 2.2 to 2.5 km east of the old stand, at the ice spires); the best reach 1.4 to 1.8 km at 14
  to 20 m deep, e.g. dir (-0.221159, -0.326965, -0.918794), 1759 m, 14.6 m, headlands and stacks in view;
  dir (-0.250956, 0.053563, -0.966515), 1560 m, 16.6 m. The old stand: 133 m. Either accept about 1.5 km
  or also open the coast recipe's water toward the biome's edge (the coordinator's call).
- Seen on the way (the A1 shore shots): the hill behind Earth's sea_coast pool shows a cliff face combed
  into even vertical stripes; and Neptune's near headland is a table with a near-vertical wall 1 to 2 m wide
  in plan and a level lip all round (scratch `hmap.mjs`, `hmap.py`): both for the coast pass.

### The explorer's face (block 7 item 4)
From the front the face was a blank oval under the hat (a doll's). A first try drew two dark eye touches and
a nose blob: the sheet's pencil and pooling outlined the nose and the eyes read as buttons, a cartoon's face
(seen, discarded). Now the head is a little finer (14 x 11) so a band of colour lands where it is meant:
the brim's shade lies over the brow and the eyes, a cool darker wash across the upper face, and the cheeks
and the chin take the light, warm (`models.js`, CHEEK, BROW). Gallery, front and three quarters at 1.9 m and
front at 4 m, before | after (`docs/shots/painter/face-before-after.jpg`, opened): close up the face reads
as in the hat's shade, without drawn features; at 4 m the change is slight. Weak: the head is still an egg
(no jaw, ear or hair at the sides); the player sees the face only when turning the camera round.

### For PILOT (eleventh PAINTER agent)
1. Your `prewarm()` (b990e8b) is right with my hooks: `world.prewarm()`, then `painter.prewarm(scene,
   camera)`; your own target-bound compile is not needed while the hook exists. If you ever call
   `renderer.compileAsync` yourself, check `renderer.extensions.has('KHR_parallel_shader_compile')` first:
   without it three warns on the console and only waits on a 10 ms timer.
2. Your tier question: a tier change builds nothing new. The tiers change uniforms, counts and target sizes,
   not defines, except the brush's sector count, and `painter.prewarm` lays the 4- and 8-sector brush and the
   sheet once whatever the tier. Measured: a forced tier 0 and back after the prewarm, 0 links.
3. Gap 12 is in: `painter.floatFallback` is true where neither float colour buffer extension exists, and the
   game then paints on 8-bit targets (see above). Your sentence stays for any other cause.
4. A landing on another world after ready builds nothing: with your prewarm on the head, the ship over Mars
   at 300 m and arrivals on Mars, Mercury, the Moon, Pluto and Saturn, 0 links (A2 above).

### For PHYSICS (eleventh PAINTER agent)
1. The gallery takes `strideBob` now (your ask, d186b65).
2. Your sea map (P18, `PC_PHYS_SEA_MAP`) is not wired yet: it goes in with the coast fix after the art pass,
   judged with your `coast.mjs`.

## M3 block 7: the picture holding in motion, and the weather (ninth and tenth PAINTER agents)

The ninth agent was stopped by a usage limit mid-block; its record is the message of `b022507`
("Block 7, part 1") and its unfinished files in the coordinator's backup `6b900e6`. The tenth
agent verified it on clean exports and finished it. Everything below was rendered from a clean
export (`tools/export-head.sh`) at the top tier (quality 2), 960 x 540, and **opened** unless
it says otherwise.

(Relayed for item 3, PHYSICS `1a7ed8c`: add `uPhysBranchClock` to `PHYS`; per-vertex `aBranchId`
(one number per branch with its foliage, -1 on the trunk) and `aLeaf01`; in the tree shader
`id = aBranchId < 0 ? -1 : fract(aBranchId + treeHash)`, `pb = pcPhysBend(root, 1.0)`,
`rel += pcPhysCrown(rel, up, H, root, pb, id, aLeaf01)`, then `pcPhysDisplace`; branches reach
0.27 H; mid and far tiers may skip it; reference `physics-lab.html?painted=1&crown=0,0`. Strip:
Earth spawn storm, clock 160 to 170 s, gust front 149 s.)

### Item 1: verifying block 7 part 1 (tenth agent)

- **Walk** (`node tests/motion.mjs --only walk`, clean export of `20b6bb5`; sheet
  `docs/shots/painter/motion-walk-after.jpg`, opened): mean change 3.10 % (3.60 before, lead's
  `motion-walk.jpg`), 19 pop blocks in 12 of 47 pairs (13 in 9 before), **every one with
  triangles +0**: no tree changed tier, appeared or doubled in the 48 frames. What the
  instrument calls pops are the near birch trunk sliding past the eye (its bark marks do not
  follow the block match) and a step puff at the boot. Verdict: **passes**; the near strokes
  did not re-lay over the 6.65 m walked.
- **Fill** (arrival 600 m east, 30 frames, `motion-fill-after.jpg`, opened): frame 0 is bare
  paper, frame 29 (1 s) the picture half up out of the paper, pale, everything at once, sky a
  touch ahead of the ground; **0 pops** (498 pop blocks in 29 of 29 pairs before); mean change
  1.0 % a frame, spread evenly over the sheet (no tile, no stipple). The instrument's second is
  shorter than the arrival; the whole of it is filmed below.
- **The whole arrival** (scratch `arr.mjs`: 14 frames 0.2 s apart; `motion-arrival-after.jpg`,
  opened): bare paper for 1.0 s while the land is laid (`busy` 8435 to 4), then the picture
  comes up out of the paper as one between 1.0 and 2.2 s, the canopy and sky a little before the
  ground; from 2.2 to 2.8 s the four frames are the same picture (busy 0): nothing arrives late,
  nothing pops. It reads as a wash laid over the whole sheet, soft, never a stipple. Verdict:
  **works as designed**. Weak: a second of blank paper is long if anything in real play ever
  leaps (nothing does: the game's start is under the loading sheet).
- **Weather set** (`node tests/weather.mjs --only earth-arrives,earth-storm,earth-blizzard,
  mars-dust,neptune-gale`, clean export of `20b6bb5`; frames in scratch `m10/wx0/out`, all
  opened): *earth-arrives*: the gust front's leaves read, forty or so lens-shaped marks in two
  tones (ochre-red and dark) tumbling over the meadow and against the sky: **pass**.
  *earth-storm*: rain as pale slanted strokes, leaves, splash rings as soft pale smudges on the
  grass (no wire): **pass**; no spray there (it is an inland spawn) and the walker's track
  cannot show in a frame of a figure standing still. *earth-blizzard*: flakes soft white
  specks, a few blown streaks; the near slope's crest is one ruled diagonal against the sky
  (terrain silhouette, smooth under fresh snow): **weak, not fixed**. *mars-dust*: the far is
  lost in dust and the sand skims run low on the left, **but the explorer at 5 m stood crisp**,
  not veiled at all: the far washes' fog comes in six stacked bands and gives nothing inside
  20 m (3 % at 5 m in visibility 85 m): **fixed**, see below. *neptune-gale* (clock 154, mist):
  the headland is a grey mass in the mist, the stacks dark; the pale flat-topped forms stand at
  the right horizon; white horses are scattered white specks rather than torn crests.
- **Neptune's coast in motion** (scratch `strip.mjs`: the game at the `storm_seas` stand, clock
  150 to 156 s, 12 frames 0.5 s apart; scratch `m10/ns0`, sheet and a crop of the shore
  opened): the swell's dark hollows move through the bay and out past 100 m (the long train
  carried far: **the sea heaves**); the waterline's lace swells up the shingle and draws back
  over the 5.5 s, torn anew in every frame (**the run-up works, the foam is alive**). But
  **there were no white horses**: what read as white horses were PHYSICS' spray drops drawn as
  4 px flecks, clusters of glitter over the bay; on the waves themselves nothing breaks between
  30 and 150 m (the near crests are dropped there as finer than the brush, the far strokes have
  not begun, and the far dabs waited on a whitecap cover of 2 % or more).
- **The pale forms in Neptune's sky, found** (scratch `nep.mjs` at the stand, yaw 236, clock
  40: a thunderstorm, rain 0.92, fog 0.76, storm 1; skyline traced from the stand with the
  terrain sampler, scratch `js/prof.mjs`): they are **the coast's headlands**: the near one
  55 m off (a 43 m cliff with a vertical end, which gives the ruled vertical edge) and a far
  one at 228 m, 50 m high, standing 10 degrees up. The far one's lower part is lost in the mist,
  and the mist was painted **near-white** (`uHaze` 0.90, 0.91, 0.94: fog lerps the haze 55 % to
  white) while above 2 degrees `pcHazeAt` takes it into the storm's dark mass: so a pale band
  with a hard top stood under the dark cloud, cut off by the near cliff's straight edge. The
  sky's own low band was never given the mist at all (the haze went white, the horizon did not),
  so far land stood paler than the sky behind it.

**What the tenth agent changed for item 1** (all in my files):
- *Mist in a storm* (`src/world/index.js`): the mist the far land is lost into is white only
  under a light sky; under a closed storm sky it is the storm's own grey (`_fogC`: the paper
  white lerped toward the storm wash lightened 48 %, by storm x overcast), and **the low sky
  takes the same mist** (`tmpKey.horizon` lerps with the haze), so the far land runs into the
  sky behind it. At the PHYSICS view (yaw 236, clock 40) `uHaze` went from 0.90 to 0.76: the
  pale slab is now a grey-blue misty distance under the cloud (before | after crop in
  `docs/shots/painter/weather-after.jpg`, top row Mars, bottom row Neptune, opened); from yaw 195 the far headland is a soft
  grey mass in the rain with the storm drags above it (opened). What stays: the near headland's
  end is a vertical cliff, so its silhouette is still a straight edge 40 m tall (terrain shape,
  not touched: it would move the coast under PHYSICS and PILOT).
- *The near air in a dust storm* (`G.uAirNear` in `shared.js`, both fog functions in
  `chunks.js` and `materials.js`, set in `index.js` from the dust weight: 0.85 x dustW at 7 m):
  the fog's six stacked bands left everything inside 20 m clear, so the explorer stood crisp in
  a storm that had swallowed the far dunes. Now the figure at 5 m is about half veiled, the
  ground at the feet a third (scratch `m10/md0`, opened). Six consecutive frames at 1/30 s:
  mean change 0.9 to 1.2 levels a frame, all of it the sand streamers travelling; **no dust
  near the lens flickers** (amplified difference opened).
- *The sea in a gale* (water shader in `materials.js`): the torn pattern of the foam, the
  crests and the surf is sized to the distance beyond 20 m in octaves that give way to one
  another and drawn out three to one along the crest, and it changes as it goes (`tornW`); the
  sun's glints go under a closed sky (`1 - 0.9 uWx.x`); in a sea running high (Hs 0.5 to 2 m)
  white horses are laid beyond 10 m whether or not the waves under them are drawn.
- *Spray* (`kitmat.js` `spume`, `index.js` draw table): a soft pale blot broken where the
  brush lifted (was a 4 px fleck), told from the rain's long grey strokes. Seen at 0.34 m and
  9 px (scratch `m10/ns5`, zoomed and opened): soft white touches of 4 to 6 output pixels in
  clusters over the bay, no longer hard specks, but still small; then set to 0.5 m, 14 px and a
  fainter wash so that a cluster runs together into a wisp: **that last step is not seen**.
- *Far white horses* (the far-sea strokes): a white horse's band is at least two pixels deep
  (`fwidth(q)`); seen across the water it was a tenth of a pixel tall.

**Verdicts, item 1** (blunt):
- Arrival and fill: **pass**. The land comes up as one over 1.2 s after a second of paper;
  nothing pops, nothing arrives late; soft, never a stipple.
- Walk: **pass**. No tier change, hole or doubling in 48 frames (every flagged block +0
  triangles); near strokes stay put. Weak: a step on the meadow raises a pale round puff at
  the boot (PHYSICS' dust puff in my `puff` mark) that appears in one frame.
- Neptune's sea: **heaves and runs up: pass**; the swash lace is alive. **White horses: weak.**
  The near and middle water still shows no torn white crests (the near crests need PHYSICS'
  whitecap cover and the wave detail the brush keeps; the gale term I added is gated by Hs
  and was not seen to fire at the stand, whose bay is sheltered); what reads as white on the
  bay is the spray.
- The pale forms in Neptune's sky: **found and fixed** (shared code, `index.js`): storm mist
  is grey and the low sky takes it. The straight vertical end of the near headland stays (a
  terrain form).
- Weather marks: leaves, rain, rings **pass**; dust storm now veils the figure **(fixed)**, no
  flicker near the lens **(pass)**; spray softened **(partly seen)**; the walker's track not
  seen (no walk was filmed in the weather); blizzard's ruled crest **weak, not touched**.

### Item 2: the explorer steps (PHYSICS' gait)

`src/art/models.js` `animate`: when `feet` (PHYSICS' `[left, right] { fwd, up, side, down }`) is
passed, each leg is a two-bone chain (thigh 0.41 m, shin and boot 0.48 m) reaching for its
boot: `fwd - surge` ahead of the hips, the hips at `L1 + L2 + ride` (`ride` = hip plus the
stride's bob), the thigh angle taken against the back's lean; the swinging leg's heel is drawn up
by PHYSICS' clearance times 1.4 to 2.7 (to about the other knee at a run, 0.30 m at most), so a
run's flight reads in the knee; the torso rides at `ride` and moves by `surge`; the arms and
the torso's twist follow `stride` (no cycle on the figure's own clock). Standing (both boots
under the hips) the weight still settles on one leg. `crouch01` (the 0.12 s before a jump):
the back leans in and the arms go back. Without `feet` the old cycle runs as before. PILOT's
`figureArgs` (src/player/figure.js) passes exactly these.
- *Gallery* (`gait=<m/s>`, `stride=`, `grav=`; `window.__pcGait` for a tool): the figure posed
  by PHYSICS' own stride (gaitOf; the feet and the bob as stepGait lays them). Strip of six
  poses of a run at 4.2 m/s and six of a walk at 1.5 m/s, side on
  (`docs/shots/painter/gait-gallery-before-heel.jpg`, opened): **the walk reads** (legs
  scissor, the trailing heel lifts, knees soft); **the run read as running but knelt in the
  air** (the heel drawn up to hip height): heel lift reduced (0.42 m and x4.4 to 0.30 m and
  x2.7) and not re-filmed in the gallery.
- *In the game* (PILOT's wiring in the head; `node tests/motion.mjs --only walk` on a clean
  export of `194171b`, W held, 4.2 m/s, a run by its gait; the lower body cropped from twelve
  consecutive frames: `docs/shots/painter/gait-game-run.jpg`, opened): seen from behind, the
  boots alternate, a heel kicks up behind at each step, the legs cross under the coat about
  every ten frames (three steps a second at 30 frames a second), the arms swing against the
  legs: **the explorer steps, on the game's clock**. Whether a planted boot slides against the
  ground could not be judged from behind at this size. The walk's pops: 17 blocks (19 before),
  none from the figure. Not filmed: a walk under 2 m/s in the game, a jump's crouch, the Moon's
  bound.

### Item 3: branches that move (PHYSICS' crown)

Wired as PHYSICS asked (relayed with `1a7ed8c`): `uPhysBranchClock` in `PHYS`; the kit builder
lays `aBranchId` and `aLeaf01` on every vertex (`florakit.js`: a trunk, a tube with `swayH` >
1.5, is -1; any other tube or blob takes its own number from its hash; a birch's three branches
take 0.13 + 0.618 k and every foliage mass within 2.2 m of a branch's tip takes that branch's
number, the others are branches of their own hidden in the wash; a pine's six tiers each their
own); `flora.js` shares the two attributes with the instanced meshes; the tree shader
(`PC_PHYS_BRANCH`, broadleaf, conifer, fungus, kelp; near and mid tiers, not the far form)
takes `pb = pcPhysBend(root, stiff)` and adds `pcPhysCrown(rel, up, H, root, pb, id, aLeaf01)`
before `pcPhysDisplace`, `id = fract(aBranchId + 7.31 seed)` so no two trees move alike.
- *Seen* (scratch `strip.mjs` at the Earth spawn, clock 165 s, the storm, 10 frames 1/15 s
  apart; one crown against the sky zoomed over 0.6 s: `docs/shots/painter/crown-storm-after.jpg`,
  opened; an amplified difference over 0.27 s, opened): the holes of sky between the masses of
  foliage open, close and change shape from frame to frame, the masses shift against one
  another while the white trunks stand: **the crowns move in pieces, not as one**. No console
  error. Not seen side by side with the crown as it was (the lobes of `pcPhysBranch`), and not
  in the gust front (149 s) or in a breeze; the far form does not move (by PHYSICS' leave).

**Last check** (clean export of `59bfb1b`, which holds all of this code): the game at the top
tier stands at the Earth spawn on foot, every module real (`render`, `world`, `art`, `physics`),
`world.busy` 0, **no console error** (scratch `spawn.mjs`, frame opened).

### Needs (block 7, tenth agent)

- *PHYSICS*: (1) at Neptune's `storm_seas` stand in the gale (clock 150), what are Hs and the
  whitecap cover (`uPhysWaterSea.x`, `.w`) over the bay? My white horses wait on Hs 0.5 to 2 m
  and did not show there. (2) Should a step on a meadow raise a dust puff? It shows as a pale
  round puff at the boot that appears in one frame. (3) Export `bobAt` (or a pose helper
  `gaitPose(v, g, stride)`): the gallery copies its formula to pose the figure.
- *PILOT*: none.
- *For the art pass* (look data, not mine to change during the pass): none of my findings came
  from a body's look data; Neptune's `storm_seas` `t.cliff` (46 m) sets the height of the
  vertical cliff ends that make the ruled edges (the form itself is shared code in
  `surface.js`).

## M3 block 6: each world's idea in its first view, motion faults, orbit (eighth PAINTER agent)

INTEGRATION: see the last lines of this section for what was run on a clean export.
Every frame named here was rendered from a clean export of the head with my working files laid
over it, at the top tier, 960x540 unless said, in the game in third person. "Opened" means with
my own eyes; I say for each how.

### 1. The worlds' ideas (the coordinator's brief: Venus, Saturn, Jupiter)

| world | what the brief promises | frame (before, after) | what is in the first view now | blunt verdict |
|---|---|---|---|---|
| Venus | lava rivers through basalt, fungal tower forests in amber cloud | `idea-venus.jpg` (both halves opened at full size; the after is the stored render of the true spawn) | a grove of the old fungal towers left (pale ringed stalks, amber caps), a basalt spire, the lava river behind the ship running into the haze, towers ghosting in the sulphur haze right, dark basalt underfoot warmed toward the bank | It says Venus in one look, which it did not. Weak: the lava is a band, not a river filling the middle distance (the ship stands in front of part of it); the foreground is one brown mass with a bland pale boulder; the cracks of fire in the cooled levee cannot be told apart from the ember wash at this size |
| Saturn | ring arcs across the sky, pale gold islands, honey mist | `idea-saturn.jpg` (both opened at full size; the after is the stored render, sky colour of the commit; the last small change to the inner ring's glaze was not rendered again) | the rings as a great pale arc from the left horizon to the upper right, white cloud in front of it, gold meadow with teal crystal reeds, gold trees, the ship left, a far island and white cloud heads on the horizon | From the palest and emptiest to a place with its sign in the sky. Weak: the wash under the arc is a brownish band (the dusky inner ring over a violet sky: muddy); the arc is soft, its division a faint line; no sea of cloud below (it cannot be seen from a level landing, see the handover) |
| Jupiter | sky-islands in banded cream and orange cloud seas | `idea-jupiter.jpg` (both opened at full size; the after is the stored render) | the belts of the sky, cream and orange, running down to a vanishing point between islands that stand on three sides with strata cliffs; a bank of white cloud in the gap; the ship right; poppies | The sky alone now says Jupiter. Weak: the islands read as the walls of a valley, not as tables standing in cloud (the cliffs' feet meet the meadow's edge: no sea below them in view); the cliffs are olive grey (the biome's middle pigment is sap green); the belts are flat slabs with little inner life |

How: (a) a first landing chosen by eye is data (`looks.js` `spawn`), found with scratch searches
(`sv.mjs`: a dry level bank with lava running away along the view; `si2.mjs`: an island spot
whose easel sees other islands over its rim), then looked at. The ground within 14 m is drawn
to the spot's height and eased back by 23.8 m (`pads`), with a second level spot 16 m off where
PILOT's ship search looks, so the ship stands 28 to 32 degrees to the side of the view.
(b) Venus: the lava bed swells and narrows (`flow`), stands brim-full (`lqD` 1.5), is scarlet
by the banks and paper-yellow only where deep, keeps its fire through the haze (fog on lava
cut by 0.6); banks get an ember wash to 26 m and a charred levee; a fourth tall kit (full-grown
towers, scale 1.45, obstacle radius 1.0 m, height 20 m) lines the lava with the spires.
(c) Saturn: sky zenith [0.76, 0.70, 0.78] (was [0.90, 0.84, 0.60]); the arc is cut per view
ray in the sky's wash, under the clouds, with the ring's own profile (thin inner ring, broad
pale ring, division, outer ring with a hair-line gap) and the planet's shadow across its far
side; it hands over to the ring's geometry between space01 0.55 and 0.9. (d) Jupiter:
`skyBelts` [20, 0.016, 0.85]: the cloud shell's parallels seen from inside; `seaDeck`: beyond
the island's rim a deck of cloud at 106 m (Saturn 84 m) out to its own horizon with heads of
cumulus standing 1 to 6 degrees above it; from a bench below the deck the heads stand as a
bank between the islands.

**Spawns moved** (PILOT's landing and tour tests stand there): Venus from the first site's
plain to the lava bank at [0.441599, 0.870687, 0.216551] (same biome, lava 18 to 34 m off to
the north and east, towers and spires beyond the 15 m clearing); Saturn from latitude 12 to
latitude -31 on another gold island at [-0.847849, -0.520723, 0.099999]; Jupiter stays on the
first island, on a bench at [0.124426, 0.328288, 0.936347] (61 m above the cloud, 290 m from
the nearest other island). All three pass "every planet has a level, dry arrival place with
room for the ship". `world.getSpawn` now returns `yaw` and `pitch` for them (additive; PILOT's
`spawnOn` already reads them).

Numbers (the game at the spawn, 960x540, this machine): Venus 769 k triangles, 303 draw
calls; Saturn 781 k, 279; Jupiter 594 k, 302; Earth 1.44 M, 465. No console error in any.

### 2. The lead's motion faults (relayed during the block; none seen in motion)

1. **Things appear in one frame**: every tree carries the time it came into its mesh; for
   0.55 s its strokes are kept only where a noise fixed in the tree is below the wash's
   progress, so it fills in as broken strokes. A tree that changes tier stays in its old
   mesh for the same 0.55 s with the complementary rule, so the two interlock and the sum is
   one tree. A cell of undergrowth washes in as a whole when it is built. `world.busy` stays
   above 0 while a wash is being laid (a frame taken at busy 0 shows nothing half arrived).
   **Not done**: the build order (far and tall first after a landing), the ground arriving
   in pieces, the near ground's strokes growing in. **Not seen**: any of it moving; the Earth
   spawn's still (`h-earth-1.jpg` in scratch, opened at full size) shows whole trees.
2. Near flowers: the round touch has a lobed outline (three sines of the angle, seeded per
   touch) and dry flecks toward the edge. Not seen close to the lens.
3. Splash rings: a glaze of paper colour at up to 0.58, soft across the ring, broken by a
   noise fixed in the ring; no longer an opaque white region-6 mark. Not seen.
4. Crowns hiding the figure: **the fade** (not obstacles). Strokes of trees and undergrowth
   nearer than the figure part within 0.8 to 2.0 m of the line of sight to it (ragged, by a
   noise fixed in the plant). The figure is found by itself (`models.js` registers it), so
   PILOT changes nothing; it is off while the figure is hidden. Not seen.
5. The explorer reads `hip`: the knees fold by acos(1 - hip/0.86), the back leans in, the
   arms spread a little; eased at 22/s. **Not done**: knees bending before a jump (there is
   no signal before take-off; if PHYSICS sends `hip` then, it shows by itself). `clamber01`
   and `grounded` are not read. Not seen.

### 3. The worlds from orbit

`orbit-before.jpg` (all ten, 480x360 each on one sheet, opened on the sheet) and
`orbit-after.jpg` (Mercury, Earth, Saturn, Neptune, Mars after the changes, opened on the
sheet). Found: Mercury a grey ball with a pale rim (glass); Earth's scattered cloud stood out
past the limb as a ragged hard fringe; Saturn's broad ring was paper white; Neptune had a
bright rim. Changed: the limb thins into haze in proportion to the depth of the air (Mercury
0.26, Moon 0, Pluto 0.17, Neptune 0.3 by its look); scattered cloud thins toward the limb and
is not drawn beyond it; the ring is gold with its division and lies in the planet's shadow on
the far side. After: Earth has one outline, Neptune is a banded blue ball without the rim,
Saturn reads as Saturn. **Still weak**: Mercury is still grey and dull (its grounds average to
grey from afar; it wants ochre and obsidian in broad shapes); no body shows a dark side in
these views (the gallery's orbit camera has the sun behind it); the discs have a crisp edge.
The eight stale `<world>-orbit.jpg` frames are removed.

### 4. Weather leftovers and PHYSICS' findings

Changed without a frame: dust veil gain 1.5 to 2.6 (cap 0.86); rain stroke 0.64 to 0.78.
Seen: `wx-mars-dust.jpg` (the lead's `tests/weather.mjs --only mars-dust` on a clean export, 960x540,
opened at two thirds size beside another frame; it replaces the stale frame of that name): dust 0.87,
the veils are pale level drags across the dunes of the middle distance and the horizon is lost in
them, no blots; **the explorer is still not half veiled** (no veil stands between the lens and the
figure in that frame). I did not open the stored frame of the same moment before the change, so
"more than before" rests on the gain alone. A gallery frame of the thunderstorm at the stream
(scratch, 640x360, opened) compiled the rain and the ring glaze with no console error; the rain
in it is still faint and no ring could be told at that size.
Not done: leaves, sand skim and blown snow were not seen blowing; Neptune's far sea, the pale
rectangle in its sky, the sea's heave and the frozen foam rim were not looked at; the track
through grass round a walker (denser, shorter strokes at the feet) was not started.

### 5. Small and required

"sampleSurface stays cheap on every body" takes the best of ten batches of 1500 calls, reports
the number for every body as a test diagnostic on every run, and asserts the 50 us limit only
when `PC_TIMING=1`. Alone here: 8 to 26 us.

### Not started

The brush at full resolution (item 4); the short list (item 5).

INTEGRATION: ready. On a clean export of the head with these files: `node --test
src/world/*.test.mjs` 19 pass, `node --test tests/*.test.mjs` 116 pass; the game loads and
stands at the Earth spawn, on foot, with no console error (640x360, the top tier, opened), and at
the Venus, Saturn and Jupiter spawns likewise (960x540).

Needs from PILOT: (1) run the landing, tour and motion sets once on the three moved spawns
(Venus, Saturn, Jupiter); the ship's berth is 16 m off on one of `spawnOn`'s ten bearings: if
those constants change, the ship simply stands elsewhere on the level place. (2) If `settle`
or the title's readiness must not wait for a wash-in, say so: `world.busy` now stays above 0
for about 0.65 s of the wash clock after the last tree or cell arrived. (3) `G.figure` is the
explorer made by `createExplorer`: if a second explorer is ever made, the last one made is the
one foliage parts for.
Needs from PHYSICS: a `hip` dip before take-off if the knees are to bend before a jump.

## M3 block 5: the push on the other worlds, the weather ruling (seventh PAINTER agent)

All frames are the game at the top tier (quality 2), third person at the spawn, 960x540,
on a clean export with my working files laid over it. "Opened" means with my own eyes.

**0. A fault found on the way.** Since block 4 the cloud shell (`pc-cloudshell`, every banded
world seen from outside, and the far worlds' decks) did not compile: the body uniform
`uStorm` (a float) collided with the shell's own `uStorm` (a vec4, the Great Red Spot). The
console of the Mercury spawn showed it. Renamed the shell's to `uSpot`; the Mercury frame
after it has no console error. Not seen in a frame from orbit.

**1. The seven worlds.** What each spawn is, what was raised, the frame, the verdict.
Common to all: the ground is no longer one wash (patches of a second and third wash at a few
metres and at tens of metres); what lies on it lies in drifts (crust, stones, splinters) with
bare ground between; tall growth is of all ages; spires and boulders are finely cut.
- **Venus** (spawn: lava plain, not the fungal forest). Before: a grey-olive plain sown
  evenly with pebbles, six cones on the horizon. After: dark flows, sulphur and ember patches,
  boulders in drifts, spires from 2 m to 14 m. `push-venus.jpg` (both opened, before at full
  size, after on a sheet of four). Verdict: the better painting and calmer; still no lava in
  the first view (the spawn keeps 13 m from liquid and the river is far), and the small dark
  dashes are still a little evenly sown. The fungal forest has new looks (young fungi as
  flowers with caps, litter, mould crust, towers of all ages): NOT opened.
- **Mercury** (spawn: obsidian field). Before: the easel a metre behind a wall of grey
  blades, neither explorer nor ship in sight. After: a clearing, a field of blades of all
  sizes to the horizon, plates of glass and ash drifts. `push-mercury.jpg` (both opened).
  Verdict: from a wall to a place; still busy (many small pale splinters, blue-violet
  boulders that are too saturated).
- **Jupiter** (spawn: sky-island top). Before: an ochre plain with sparse green flicks.
  After: a green meadow with bare ochre patches, shrubs, boulders, trees of all ages.
  `push-jupiter.jpg` (before opened at full size; the stored after is the last round, NOT
  opened; I opened the first round's, which differs by the gathered stones and the tufts). Verdict:
  the largest gain of the seven, a landscape now; nothing in the first view says "island in a
  sea of cloud" (the edge is 200 m away), and the flower drifts did not show in the frame.
- **Saturn** (spawn: gold island top). Before: a pale gold blank with flicks. After: olive
  and honey patches, violet flowers, mint crystal shards, shrubs, trees of all ages.
  `push-saturn.jpg` (both opened, the after on a sheet of four). Verdict: better, still
  the palest and emptiest of the seven; the ring arcs are not in the first view's sky; the
  shrubs, a heap of earth in the first round, are a low olive mound now.
- **Uranus** (spawn: ice shelf). Before: already the best of the seven (mint ice, cracks,
  teardrop spires in haze). After: frost drifts and deep aqua patches, spires of all sizes in
  three bands. `push-uranus.jpg` (before opened on a sheet; the stored after is the last round, NOT opened;
  I opened the first round's).
  Verdict: richer and still calm; the terrace itself is not in view.
- **Neptune** (spawn: kelp forest). Before: the easel inside a kelp clump, flat violet straps
  across the whole sheet, the explorer hidden. After: a clearing; kelp in tussocks of all
  sizes at four depths, a moss floor with drifts of yellow stars. `push-neptune.jpg` (both
  opened). Verdict: a painting now; a frond is still a flat strap of one tone.
- **Pluto** (spawn: lilac mountains). Before: pale ground, blobby boulders, a far ridge under
  an indigo sky (a good composition, thin near ground). After: frost and rose patches, more
  stones, penitent spires in companies on the slopes. `push-pluto.jpg` (both opened on
  sheets). Verdict: richer, a boulder field under the ridge; the shards are fewer but still
  read violet-blue in their shadows, the right of the sheet is busy with stones, and the far
  penitents are a stipple on the hill.
Weaker biomes than the spawn, by the code and not by a frame: none was opened this block.

**2. Numbers** (information, not a limit; software rendering, load 13 to 17, 960x540).
Time to "click to begin", frames, `world.update` summed, triangles / draw calls, before -> after:
Venus 73 s / 43 / 2.5 s / 448 k / 230 -> 141 s / 41 / 3.4 s / 830 k / 242;
Mercury 97 s / 48 / 1.7 s / 678 k / 506 -> 178 s / 48 / 4.7 s / 985 k / 498;
Neptune 118 s / 49 / 2.3 s / 599 k / 268 -> 200 s / 41 / 4.0 s / 1.02 M / 291;
Pluto 133 s / 47 / 3.1 s / 668 k / 296 -> 246 s / 57 / 4.5 s / 1.63 M / 487;
Jupiter 180 s / 50 / 3.7 s / 728 k / 318 -> 283 s / 58 / 4.5 s / 1.01 M / 354;
Saturn 179 s / 46 / 4.7 s / 696 k / 320 -> 213 s / 48 / 3.8 s / 1.07 M / 376;
Uranus 115 s / 48 / 2.3 s / 515 k / 224 -> 137 s / 51 / 3.3 s / 779 k / 238.
Earth spawn on the clean export of the head, 960x540, with two other jobs of mine running:
404 s / 54 frames / 4.4 s / 1.44 M / 465 (block 4: 3.35 s of building, 1.36 M): the single
strokes to 23 m cost about a second of building.
The world is settled (`world.busy` 0) by the time the title is ready in every run. The frame
counts hardly move: the longer wall time is each software frame drawing more.
`node --test src/world/*.test.mjs`: 19 pass (the slice test among them) after every change
in the working tree. On the clean export of the head: 19 pass in two runs of four; twice
"sampleSurface stays cheap on every body" failed (57 us a call on Uranus against a limit of
50) while two renders ran beside it: it is a wall-clock test; measured alone a call costs 6 to
13 us on every body (Pluto 5.6 -> 10.0 with its patches, the others unchanged).
`node --test tests/*.test.mjs` on the same export: 115 pass. The game loads on it and stands
at the Earth spawn with no console error (`push-earth-spawn-b5.jpg`, opened at full size).

**3. The weather ruling** (coordinator, this block). In code: (1) the dust glaze reads
PHYSICS' veil fields: a streamer is one level drag, densest above its foot, thinning to its
top and ends, broken where the brush ran dry, lifted toward paper; a puff stays round and
soft; (2) leaves are a glaze (a lens), so a thin leaf is not brushed away; (3) blown sand is
paler and heavier; blown snow comes through the dust kit with the snow's ink and is lifted
the same way; (4) `D.snow` was already spread; (5) the far sea: the gate was not the fault,
the gale's murk swallowed the strokes; the fog on the sea is cut by up to 0.45 where the far
strokes are laid, the strokes begin nearer and are stronger. (6) noted: Mars' dark dashes are my ripple strokes.
SEEN in the game with the lead's `tests/weather.mjs` at the top tier on a clean export:
`mars-dust` with the first version of the veil (opened at full size, not stored): a hazy
dune with a few pale drags of sand and NO veil to be seen: a veil in the dust's own middle
tone is lost against the haze behind it. Since then the veil is lifted toward paper after the
air is laid over it (commit `3af362b`); `push-mars-dust.jpg` is that
version in the game (opened on a sheet of two): pale level drags at two or three depths over
the far dune and across the middle ground, soft, no blot, no console error; fainter than
PHYSICS' stand-in (`docs/shots/physics/painted-proposal.jpg`, top left, opened once) and the
explorer is not half veiled: the opacity gain (`vPcData.y * 1.5` in `SHAPES.veil`) can go up.
`neptune-gale` under PHYSICS' own sky (`push-neptune-gale.jpg`, opened on a sheet): the sea
is a deep ultramarine body to a horizon under slate murk, the stacks and the cliff pale
ghosts in it, foam on the shore, two white horses: a storm sea now and not a blank; the far
swell strokes are still faint and the white horses few. The blizzard: left as it is (the
coordinator saw it work). Leaves, blown snow: in code, the leaf glaze compiled (forced to
draw at the Earth spawn, no error), not seen blowing. `earth-arrives` (the far world as an
orange dot before the storm cloud): `push-earth-arrives.jpg` (the game, PHYSICS' own front,
opened on a sheet of two): a slate bank, slanted rain, the wood in the cloud's shadow, and
no dot in front of the cloud. Passes in this frame; where the far world stood at that moment
I did not check, so it is one frame's evidence.

**4. Earth.** The "V" pairs (a tuft's flicks now lean about one direction; only the first two
or a third of the dark ones are crisp) and the change of hand at 17 m (single strokes to
23 m, fan touches from 6 m): `push-earth-spawn-b5.jpg` (960x540, opened at full size): the
meadow runs to the wood without a seam I can find and the tufts read as tufts; a few dark
flicks still stand in pairs at the sheet's foot. Not compared side by side with block 4's
frame at the same size. The brush: not touched.

Frames removed because they no longer show the truth: `push-dust.jpg` (the gallery's forced
dust under the old glaze; see `push-mars-dust.jpg`) and `push-neptune-swell-forced.jpg` (the
swell with its gate forced; see `push-neptune-gale.jpg`). Block 4's text below still names them.

**Contract changes (additive)**: looks: `t.patch`, `near.crust / gm / flowerSize`,
`under.crust / stalk`, tall spec `vary`; Pluto has tall growth now, so `sampleObstacles`
returns spires there (true radius and height by scale: 1.4 m x 13 m at scale 1, most are a
third of that); more boulders on Venus, Mercury, Pluto and Uranus (the same rule: scale
0.7 and up are obstacles, 0.62 x 0.58 of the scale). A non-forest spawn with tall growth has
a clearing of 15 m. Fallen blocks at a spire's foot are inside its own outline and are not
separate obstacles. Nothing else added to `sampleObstacles`.

**Needs.** From PILOT: nothing new; the top-tier settle time-outs as before. From PHYSICS:
nothing new; the veil fields are read as handed over.

**Weak / not done**: one round only on each world and three of the seven last frames not
re-opened; no signature biome off the spawn opened; item 2's frames as listed; the Earth
changes unseen; the brush, the vistas in a thicket, Mercury and Neptune from orbit, Mars'
crests, branch sway and drifts, the explorer's face, the UI look review: not started.

## M3 block 4: the quality push (sixth PAINTER agent)

All frames below are at the top tier (quality 2). "Opened at full size" means with my own
eyes at the stored resolution. Stored frames are in `docs/shots/painter/push-*.jpg`.

**1. The Earth forest.**
- The ground. Was: one ring of flicks, 0.66 m cells to 11 m, at most 6400 strokes, 13 k
  triangles in the spawn frame, a flat wash beyond. Now three rings to 240 m, about 77 k marks
  in the spawn frame (228 k triangles, 3 draw calls): tufts, flowers in drifts (poppy, ox-eye,
  buttercup, harebell: a drift is of one kind), taller grass gone to seed where it is rough,
  fallen leaves and twigs under the trees, stones and moss by the brook, fern fronds and
  dashes of fallen leaves under the wood, broad soft touches far out. Frames:
  `push-spawn-before.jpg` / `push-spawn-after.jpg` (1280x720, the game, both opened at full
  size; the after frame is one commit before the last, which changed only the far sea, dune
  ripples and snow). Verdict: the after frame is the better painting, and it is a meadow now;
  the near flicks still pair into small "V"s here and there, and the fine ring ends in a
  visible change of handwriting at about 17 m.
- The trees. Full trees to 90 m (52), the middle tier to 190 m (128), far tiers to 420 and
  600 m (300, 470), undergrowth to 110 m (60), about twice the bushes in the wood. No
  saplings (they would be obstacles). Frames: `push-vista-before.jpg` / `push-vista-after.jpg`
  (the lead's `earth-temperate_forest-1`, 1280x720, both opened at full size; same caveat).
  Verdict: better: the far bank has a floor, the trunks stand in undergrowth, the distance
  has one more band; the pale band of mist at the trunks' feet is unchanged.
- The far distance: only the forest's air (visibility 185 m to 231 m) and the longer tiers.
  On a world of 4 km radius the ground hides a tree beyond about 480 m; I did not add painted
  bands beyond that.
- The near terrain: looked at the bank at three times size in the vista: no facets, the
  brook edge is a drawn sienna line. Left as it was (`SPLIT_BY_QUALITY` 1.25).
- The brush: not touched.
- Numbers (plain information; software rendering, a shared machine): the spawn 733 k
  triangles / 360 calls before, 1.36 M / 465 after; the vista 0.74 M / about 365 before,
  1.40 M / 489 after. Time to "click to begin", both builds run side by side at 480x270:
  87 s before, 153 s after, in the same 50 frames; `world.update` summed over the load 3.05 s
  before, 3.35 s after (10 % more building; the rest is each software frame taking longer to
  draw). At 1280x720 the load took 262 s before and 309 s after on different machine loads.
  The vista after a teleport: 78 s before, about 416 s after (46 frames against 37, each far
  slower under a load of 15): the lead's tools may time out waiting for it here.
  `world.update` worst frame as measured here (slices grow with slow frames, so not the 5 ms
  figure): standing 394 / 212 ms, running 165 / 104 ms before / after.
  `src/world/busy.test.mjs` (one arriving frame at 60 frames a second, priced in surface
  samples) passes: the heaviest frame fits 5.5 ms.

**2. The other bodies.** Moon: `push-moon.jpg` (before above, after below; the after frame
opened at full size, at the code before the last commit): stones of unequal size to the
horizon and boulders farther out, where there was bare dust; 289 k / 146 before, 429 k / 211
after. Verdict: richer; the small stones are still a little evenly sown. Mars:
`push-mars.jpg` (opened as that sheet only): dry tufts and fans across the ground and more
far growth, 423 k / 271 to 715 k / 350; better, busier. Venus, Mercury, the giants, Pluto:
not opened.

**3. PHYSICS' critique.** Storm: `push-storm.jpg` (gallery, forced storm sky, 960x540,
opened at full size): the wood stands in the cloud's shadow, no sunlit green, no cast
shadows; passes. Under PHYSICS' own gust front (storm rising before overcast) the same code
applies (`sunless = max(overcast, 1.5 storm)`), not seen. Blizzard: the snowfield is in the
cool glaze and the air a blue-grey veil where snow falls, so flakes have a ground; the frame
I opened had no flakes in it (the gallery's forced sky does not make PHYSICS snow), so this
is not verified; the green tufts left on snow are dead stalks now (not re-rendered). Dust:
puffs, ash and sand are glazes with soft edges; `push-dust.jpg` (gallery, forced dust sky,
opened at full size) shows a soft veil and no blot, but I cannot say PHYSICS' wall was in
that frame. Neptune: swell strokes and white horses on the far sea, spaced by pixel
footprint; seen only with the gate forced on (`push-neptune-swell-forced.jpg`, lower half);
at the time I could reach in the gallery the sea was too slight to open the gate.

**4. Far worlds.** The ball now thins away over the world itself between 8 and 12 px
(a fixed stipple the brush softens), and a world behind cloud is veiled as overcast or storm
rises from 0.06 to 0.6 and lost into the storm's own wash; only then is it left out. In
code; no frame.

**Contract changes (additive)**: reads `mood.pulse01` when PILOT gives it (the ship model's
mode is the fallback); body uniform `uStorm`; `MOTION.given`; looks `under.flowers`,
`under.litter`, biome `near: { flower, fern, litter }`. `world._near.mesh` is a group of
three meshes now. Nothing added to `sampleObstacles`.

**For PILOT's README: what each quality tier draws.**
- Tier 2 (best, where the game starts): full internal resolution; trees in full detail to
  90 m and as simpler trees to 600 m; undergrowth to 110 m; the sward in three rings (single
  strokes, flowers, fallen leaves to 17 m; fan-brush clumps and ferns to 66 m; broad soft
  touches to 240 m); the finest terrain; pencil underdrawing.
- Tier 1: 0.8 of the resolution; full trees to about 54 m, simpler trees to 360 m;
  undergrowth to 66 m; the sward's two nearer rings (to 12 m and 40 m); coarser terrain.
- Tier 0: 0.62 of the resolution; no full-detail trees, simpler ones to 170 m; half the
  undergrowth; one ring of strokes to 11 m at half density; a simpler brush (four sectors),
  no pencil line.

**Needs.** From PILOT: `mood.pulse01` is read as soon as it is passed in `setMood`; the
tour's settle time-out wants raising for the top tier in software rendering (the forest
vista needed about 46 frames of 5 to 9 s). From PHYSICS: a painted frame of the far sea in
its hurricane and of the dust wall with the new glazes (their lab renders my kit materials),
and of a blizzard with flakes over the shadowed snowfield.

**Weak**: everything under "not verified" above; the settle time in software rendering;
no saplings; the brush untouched; items 5 of the block not started.

## M3 block 3: the MUST items, day-night, space, pulse, flicks (fifth PAINTER agent)

INTEGRATION: ready (`626b086`; the game on a clean export loads and plays on foot, in orbit,
in deep space and in the pulse drive with no console error; 19 world tests and the project's 109 tests pass on a clean export of `895a178`).

### The two MUST items
- **Cost, at the lead's instrument** (`tests/cost.mjs`, clean export, the game, fair weather):
  vista `earth-temperate_forest-1` **537 k / 305 at quality 1** (was 614 k / 341; budget 600 k /
  350) and **240 k / 180 at quality 0** (was 315 k in my run, 304 to 306 k in the lead's; budget
  300 k). The thunderstorm at the Earth spawn: **524 k / 286** (the lead's 606 k / 315; the same
  storm with the sun put at 21 h: 523 k / 287).
  What it was: not trees. Every far world in the view frustum was submitted in full (14 k
  triangles of terrain and 6 draw calls each, plus water and a cloud shell: up to 25 k and
  13 calls a world), seen or not. At the vista four of them stood in the view (Mercury, Venus,
  Uranus, Pluto: 72 k triangles, 36 calls, for one dot of ten pixels and three of under one
  pixel); "the storm after dark" was Neptune behind the cloud. Now a far world that cannot be
  seen is not drawn (wholly under the horizon, behind a closed sky, or under 1.3 px of radius),
  one under about 9 px is a dab (a washed ball, 320 triangles, one call; hysteresis 8 to 10 px)
  and by day it is veiled by the sky it is seen through. Nothing was trimmed from the flora:
  `TRIM` and `MAXS` are as they were.
  `world.update` in the storm frame, software rendering under load: mean 1.2 to 1.7, ninetieth percentile 3.1 to 4.8, worst 7.6 to 8.9 (50 frames at 13 h and 50 at 21 h; the same script on `62d061a` gave 1.1 to 1.7, 4.3 to 6.1 and 8.7 to 9.2: no change from this block; the worst frame is over 5 ms here as it was, on a machine at a load of 15) ms.
- **Pepper**: (a) saturated middle washes (Neptune's sky) and everything under the night's
  glaze now settle soft instead of in pits (`pepper-neptune.jpg`, before | after: opened both
  at full size; the after's sky enlarged three times before, not after); (b) the border of a
  dark wash is ragged in broad pieces with a pooled rim and a few flecks of paper, no pale rim
  with dark dots in it (`night-storm.jpg`; `space-deep.jpg`). The lead closed the washes
  himself on `0de3fb4`; the border he saw there is the old one.

### What is in, the frame that shows it, my verdict
Frames in `docs/shots/painter/`, 960x540 each, quality 1. Pairs are before | after.
Opened at full size, each half as its own frame: `pepper-neptune`, `night-earth` (the after
one commit earlier, and the last render on a two-frame sheet at full width), `space-orbit`,
`flash`, `flicks-lawn`, `night-storm`; `space-deep`, `space-pulse`; `daynight-mars` and
`daynight-uranus` as stored (two frames stacked); `night-mars`, `night-uranus` on two-frame
sheets at full width; `wx-neptune-gale` and the lower half of `near-saturn`'s after on one
sheet. **Not opened in the stored render**: `daynight-earth` (the same two frames one commit
earlier were opened, with the old strokes in them), `wx-earth-blizzard` (opened one tweak
earlier: a few more stems came through), `wx-earth-storm` (the same view one commit earlier
was opened), the before half of `near-saturn` beyond its first render.

| what | frame | verdict |
| --- | --- | --- |
| night on Earth | `night-earth.jpg` (gallery, forest easel, 23 h) | yes. Before: the day multiplied by blue. After: a nocturne: tree masses run together into deep indigo-green, the sky is a middle indigo paling to a band over the wood with a pale lifted cloud, and the lights are reserved paper: birch trunks, the stream's reflections, the canopy glass, the coat, five stars. Weak: the foreground ground is one flat dark; edges are all crisp (a nocturne wants more lost edges); the coat is the brightest thing in the picture |
| dawn and dusk on Earth | `daynight-earth.jpg` (dawn over dusk) | yes: a rose-lilac dawn sky with long cool shade; a warm grey-gold dusk on toned paper. Dusk's sky wants more gold at the horizon |
| Mars | `daynight-mars.jpg` (dawn over dusk), `night-mars.jpg` | yes, the best of the set: a salmon dawn with mesas stepping back in mauve layers; the blue dusk; at night dark sepia terraces with pale strata under a deep sky with stars. Weak: the night sky is nearly one value |
| Uranus | `daynight-uranus.jpg` (dawn over dusk; rendered before the splinters were clustered), `night-uranus.jpg` | yes: mint sky to rose at dawn, teal to gold at dusk with the spire lit cream; at night the spire and the shelf are the reserved lights |
| space, in orbit | `space-orbit.jpg` | yes. Before: one soft wash, no stars. After: two layers of indigo with lost and found edges, a violet drift, spattered stars of unequal size |
| deep space, the game | `space-deep.jpg` | yes: layered washes, about seventy stars, the sun as bare paper with a halo, the ship's two warm lights |
| pulse drive, the game at 5.3 km/s | `space-pulse.jpg` | yes: pale drags lifted out of the wash run out from the point the ship flies toward, soft-edged, wandering a little, dry at their tails; stars fade under them. Not seen in motion. Weak: a little like combed hair where many lie side by side |
| lightning | `flash.jpg` (before: the game on `e56d65e`; after: gallery, storm at 21 h, flash forced) | yes: the open sky goes to bare paper, trees and trunks stand as silhouettes, no fringe of specks in the crowns. Weak: the crown edge against the paper is stepped in places (the sky mask is at the scene's resolution) |
| near strokes as flicks | `flicks-lawn.jpg` (the lead's vista in the game), `wx-earth-storm.jpg`, `near-saturn.jpg` | yes for the lawn: tufts of soft touches close to the ground's value, a few olive accents, uneven; no teeth. On Saturn the splinters stand in loose clusters of unequal size. Weak: at the boom's distance most flicks merge into the wash, so the lawn is quieter than a painter would leave it; not judged in first person or in motion |
| none on snow | `wx-earth-blizzard.jpg` (gallery, fresh snow forced) | yes: the snowfield is bare paper; two or three tall stems come through. PHYSICS' `sky.fresh` drives it in the game (not rendered in the game by me) |
| puddles, wet shade | `wx-earth-storm.jpg` (the game, the thunderstorm at 13 h) | partly: the shade under the trees is no longer a row of dark holes; puddles are faint pale soft shapes on the lawn, hard to find. At a stronger setting they covered a third of the lawn like snow patches: there is no hollow to put them in, only flat ground and a noise |
| Neptune's sea takes the storm | `wx-neptune-gale.jpg` (gallery, forced storm) | partly: sea and beach go dark indigo under the closed sky. No white horses (not done) |
| the storm after dark | `night-storm.jpg` (before: the game on `62d061a`; after: the game, sun put at 21 h) | see the file: yes as a picture: a low-key wet night, the storm sky the darkest wash with a pale band under it, trunks, the ship and the coat as the lights, the border a clean ragged edge. Dark for play: the explorer reads by the coat. One dark round blot in the air is a flying leaf (PHYSICS' kit in my ink): it wants to be a flick |

### How each part works
- **Night key** (sheet pass). Three things, by `SHEET.night` (1 at night on the ground, 0 by
  day and in space): the hue narrows toward indigo; every wash is given 0.68 to 0.94 more
  pigment by the density model, so darks and middles run together and bare paper stays bare;
  the last glaze over the sheet is light ([0.64, 0.70, 0.90], was [0.42, 0.48, 0.70]) and
  what is near paper is kept out of it (the reserve). The world lays the sky's keys lighter
  by the inverse of the density (`undens`), so the sky lands on the look's night values.
  The brush is a little broader and wetter at night and the pencil nearly gone.
- **Stars and streaks** are one glaze object (`pc-sky-glaze`, one triangle, drawn after the
  abstraction pass only at night, in space or under the drive). Stars: one dot at most per
  cell of two cube-map grids, radius 1.3 to 4.4 px, where the sky pass allows (no cloud, no
  overcast, above the horizon haze, out of the sun's glare). Streaks: in polar coordinates
  round the ship's heading (`userData.pcCaster === 'ship'`, else the camera's), sectors with a
  drag each, flowing outward in log radius; strength is `pulse01` (eased 0.45 s from the
  ship model's `mode: 'pulse'`) or, at a full cruise in space, 0.16 of it from `speed01`.
- **Flicks**. A cell has no tuft (one in five), one or two; blades start within 8 cm of the
  tuft's root, fan out, most short, the leader long; the shape is narrow at the root, full
  at a third, a point at the tip. Washes: two thirds of the way to the ground's own, a third
  of them paler, one in seven an accent (denser, left crisp). Under fresh snow all but the
  tallest are gone by half cover.
- **Lightning**: the lift to paper is by the share of open sky in five taps, so the gaps
  inside a crown stay with the crown; during a flash light things are reserved from the
  night's glaze.

### Not done, not verified, weak (blunt)
- **Not done from item 4**: white horses, the dust storm near the explorer, the two vistas in
  a thicket, Mercury and Neptune from orbit, Mars' dune crests, branch sway, drifts.
- **Not verified**: anything in motion (streak flow, star stability under a turn, flicks
  under the storm wind: the stills show no torn or stretched strokes, which is all I can
  say); quality 0 and 2 looks; the tour; other bodies' densest views (the far-world change
  can only lower them); a real GPU. `tests/weather.mjs` was run on `e56d65e` only (five
  frames; its "neptune-gale-forced" frame stayed on the meadow because of `--only`).
- **Storm wind on trees and strokes** (PHYSICS asked): in three storm stills nothing is torn,
  stretched or laid flat; I cannot say more without motion.
- **Rain**: with PHYSICS' own share I count about twenty strokes in the frame in the
  thunderstorm (it says 37 are in view): enough to read as rain, soft, paler than the wood.
- Puddles are weak (above). The walker's track and the ship's wash were not re-rendered with
  the flicks (`wx-grass-part.jpg`, `wx-grass-wash.jpg` removed as stale; trodden blades are
  now only a little paler and broader, so the track will read less).
- `models-*.jpg` and M2's biome frames predate this block (old strokes, old night).
- A far world between 8 and 10 px of radius swaps from dab to terrain in one frame (no
  cross-fade); a dab has no clouds, bands or rings' shadow; a far world behind a closed sky
  vanishes at overcast 0.6 without a fade.

### Contract changes in this block (all additive; nothing removed)
- `setMood.speed01` and `inSpace01` are now read (streaks at a full cruise in space).
- The ship's `animate({ mode: 'pulse' })` switches the streaks on (no new call for PILOT).
- `sky.fresh` (PHYSICS) is the fresh-snow cover when present; my own model is the fallback.
- `sampleObstacles`: a boulder's `height` is 0.58 of its scale (was 0.5): the top of the
  drawn boulder over the ground beside it. The largest boulder is about 1.2 m.
- Render: `SHEET.night`, `MOTION`; the sky writes where stars may lie into the aux target's
  x for region 0. World: `world._glaze` (a debug string). Gallery: `odist=`, `chase=1`
  (`cdist=`, `cdown=`, `cside=`), `speed01=`.
- I no longer close the sky under rain or snow myself (PHYSICS does), and the rain share
  is PHYSICS' own.

### For PHYSICS
- Snow: `sky.fresh` is used. Rain: your share is used as it is; about twenty strokes show in
  the thunderstorm. Storm wind: no damage seen in stills; nobody has watched it.
- Still open from my side: `pcPhysWaterCrestLine` (white horses), `pcPhysBranch`, drifts.

### For PILOT (and the lead)
- `tests/weather.mjs` still looks for the storm at 720 s; it is at 160 to 320 s now.
- A cleaner signal for the streaks would be `mood.pulse01` (0 to 1); today I read the ship
  model's mode. If you want no drags at a plain cruise, say so (one constant, 0.16).
- Boulders: all are under 1.3 m by their true height, so all are walked over; if some should
  block, tell me the size and I will grow a few.
- **UI second look (PILOT asked): not done.** No interface frame was opened in this block.

## M3 block 2: explorer and ship, near ground, glazes, dark washes (fourth PAINTER agent)

INTEGRATION: ready (`6bb6c91`; the game on a clean export loads, plays on foot, in the
cockpit and in the chase view with no console error; 19 world tests pass; the project's
105 tests pass on a clean export of `09a8338`. In the working tree one of PILOT's tests failed
while PHYSICS was mid-save: test from an export).

### What is in, the frame that shows it, my verdict
Frames in `docs/shots/painter/`, 960x540 unless said, quality 1, gallery from a clean export.
Rendered at `db22516`, except `models-forest`, `models-game`, `wx-earth-storm` and
`wx-grass-wash` at `6bb6c91` (which made the near blades slender and uneven in length and
raised the rain share: the others show slightly broader, more even blades and fewer strokes).
Opened at full size: `models-forest`, `models-game`, `wx-earth-storm`, `wx-grass-part`,
`wx-grass-wash`. Seen on a contact sheet at two thirds size only: `models-mars`, `-moon`,
`-uranus`, `-cockpit`, `wx-jupiter-storm`, `wx-neptune-gale`, `wx-mars-dust`,
`wx-earth-blizzard`. **Not opened in its final render**: `models-poses` (the same poses were
opened in an earlier render). `wx-earth-before` and `wx-earth-after` were removed (stale).

| what | frame | verdict |
| --- | --- | --- |
| explorer and ship in the Earth forest | `models-forest.jpg` | yes. A traveller in a canvas coat with a broad dark hat, a pack with a rolled sheet and two copper jet bottles, a red scarf down the back; a planked flying skiff with a canvas deck, a framed glass bubble, cloth wings on ribs, a red-tipped fin, two copper pots, three legs, a rope ladder. Both read as painted things, sit in the light of the place and lay a shade on the ground. Weak: the explorer is still a little of a doll from the front (a blank face under the hat, stiff sleeves); the canopy is a pale egg |
| the game, third person at the Earth spawn | `models-game.jpg` (the game on a clean export, 960x540) | yes: at the 6.4 m boom the figure is about 110 px tall and reads by hat, pack, scarf and coat; its shade is on the grass; the ship beside the birches is a boat with a red fin |
| on Mars, on the Moon, on Uranus | `models-mars.jpg`, `models-moon.jpg`, `models-uranus.jpg` | yes (contact sheet only): the pale coat and dark hat carry the figure on ochre, on pale grey and on teal ice; the red reads on all three. On the Moon the pebbles are dark commas on the regolith, on Uranus frost needles stand all over the ice (a little too many, all alike) |
| the cockpit from `userData.seat` | `models-cockpit.jpg` | yes: a wooden hoop frames the view near its edges, the cowl with three dials lies along the bottom, the canvas foredeck runs to the bow lantern. (The HUD covers the dials in the game.) |
| walk and jet poses | `models-poses.jpg` (two 640x360 frames side by side) | yes: the stride, the coat and the scarf streaming; the jet with the legs trailing, the flame under the bottles and the shade below on the ground. Run, fall were looked at once (scratch), sit and wade never |
| near ground: a walker's track | `wx-grass-part.jpg` (top: PHYSICS' push on; bottom: `push=0`; the lower two thirds of each frame) | partly. Top, a pale band about a metre wide runs from the left to the explorer's feet: the trodden tufts lie over and show their pale side, and stay down (PHYSICS' flatten). It is a track, not a sward parting: the grass is tufts 0.66 m apart. 1.0 % of the frame's pixels differ by more than 12 of 255 |
| near ground: the ship's wash | `wx-grass-wash.jpg` (top: 90 kN at 3 m; bottom: no wash) | yes for the motion: every blade in a wide disc lies over, away from the hull (8.2 % of the frame's pixels differ by more than 12). As a picture it is weak: seen from a low camera the nearest blades are flat triangles |
| rain as a glaze | `wx-earth-storm.jpg`, `wx-jupiter-storm.jpg` | yes on Jupiter (contact sheet): parallel transparent strokes, darker than the pale gap, lighter than the dark cloud. Partly on Earth (opened): the strokes are right but few (PHYSICS draws a quarter of them now; I ask for 1.6 times that) |
| dark washes without pepper | `models-moon.jpg` (space), `wx-earth-storm.jpg`, `wx-neptune-gale.jpg` | yes: the Moon's sky and the storm sky are soft, broadly mottled washes; enlarged three times there is no hard speck left. The dust sky on Mars keeps its fine grain (it is a light wash: that is where pits belong) |
| drift ripples, blizzard | `wx-mars-dust.jpg`, `wx-earth-blizzard.jpg` | (contact sheet) the near dune carries short dark commas along its crest; the blizzard is as it was, a few green tufts standing in the snow at the bottom edge |

How each part works, briefly:
- **Models**. Every form is a loft (rings of a superellipse along a path) whose surface is
  pushed about by a smooth noise, so no silhouette is ruler-true and nothing is a primitive.
  The washes are vertex colours from one palette of ten (canvas cream and its dirty hem,
  indigo-sepia, grey-blue, copper, sepia, flesh, glass, ochre planks, and ONE accent, a red
  that the scarf, the hat band, the fin and the wing tips share). `makeFigureMaterial` lays
  the wash with drifting pigment, pooling just inside the silhouette, a few long soft strokes
  down the form (folds, weather runs), light in soft steps and a little dry brush on the lit
  side; flames and the bow lantern are bare paper running into warm colour (`glow`). Each
  figure is one mesh and ONE draw call (the placeholders were 8 and 17): parts are moved by
  `uPart[]`. Explorer: 11 parts, about 3 k triangles; ship: 6 parts, about 7.5 k.
- **Animation** (C10 unchanged). Explorer: the modes are blended (weights eased at 9 /s), so
  walk runs into jet into fall. The stride phase advances by the ground covered (one step is
  0.45 m + 0.22 s of travel, the leg swing is the arc that step needs), the hips bob twice a
  stride, the coat streams back, the scarf lifts with speed and flies up in a fall, the head
  follows `lookPitch`, at rest the weight is on one leg. Jet flames scale with `jet01` and
  boil at 8 frames a second. Additive state fields: `phase` (radians, sets the stride),
  `snap` (no easing), both for stills. Ship: the legs fold (`gear01`: nose leg back under the
  belly, the outriggers up to the wings), the canopy hinges at the back (`canopy01`), the
  flames lengthen with `throttle01` and are long and thin in `pulse`, a slow bob in `hover`.
- **Shade**. `pcCast` in the terrain and near-ground fragments: an oval glaze thrown away
  from the sun (as long as the figure is tall over the sun's height, a pool under a closed
  sky), ragged at the edge, fading as the explorer or the ship rises. The world finds the two
  in the scene by `userData.pcCaster`; PILOT wires nothing. Trees and props do not take it.
- **Near ground**. One instanced mesh, one draw call, at most 6400 strokes (19.2 k
  triangles), three triangles a stroke. The ground is divided into cells of the cube sphere
  (0.66 m); each cell owns a clump of up to eight strokes whose places, shapes and washes are
  a pure function of the cell (so they are anchored). Clumps are laid nearest first inside a
  time slice (a quarter of the build budget; one surface sample and two heights a clump),
  come and go at 11 m where a stroke's length is already nothing, and grow in over 0.7 s
  when laid inside the range. Kinds by biome (`styleOf`: from `small`, `terrain`, `under`,
  or a biome's own `near: { blade, reed, needle, dab, ripple }` in looks.js): grass blades
  (fanned tufts in the biome's leaf washes run into the ground's), reed stubble, frost
  needles and splinters, pebbles, drift ripples. Each stroke faces the picture plane about
  its own axis, is lit like the ground under it (dapple and the cast shade included), is
  never thinner than 2.3 pixels of the scene pass, thins with distance (full to 7 m, none at
  11 m), is slender close to the eye, and half of them are region 6 (crisp accents).
  PHYSICS: each blade bends with `pcPhysBend` at its own root, and where the field says
  flattened it lies over the way it already leaned, broader and paler. `world.busy` counts
  clumps still to lay. Fresh snow buries most of a blade.
- **Glaze pass**. Objects in `GLAZES` sit out the scene pass and are drawn after the
  abstraction pass straight onto the brushed picture with ordinary blending; they test their
  depth by hand against the scene's second target. Rain is the first: a transparent stroke
  of a middle value. Cost: one more draw call per glaze object, no new target.
- **Dark washes**. In the sheet pass the granulation has two regimes: in light and middle
  washes pigment sits in the pits of the paper (the fine speckle, as before); in a dark wash
  (and in any wash under a storm key) the pits are full and only the broad soft settling of
  the pigment shows (the same paper sampled out of focus, at 40 % of the strength). The
  floor of the darkest value and the paper relief follow the same rule. The border's dry
  edge skips in larger pieces.
- **Eased sky**. The world eases PHYSICS' sky numbers with a time constant of 0.9 s (90 % in
  two seconds) before painting from them; a forced sky, the first frame and a change of body
  are taken as they are; `flash` is never eased.

### Numbers
- **Cost** (quality 1, with the explorer, the ship and the near ground in; budget 600 k / 350):
  Gallery (whole frame, `models=1`): Earth spawn 516 k triangles / 280 draw calls (quality 0:
  265 k / 189; quality 2: 700 k / 351); temperate forest easel, the densest view known:
  546 k / 299 (quality 0: 255 k / 181; quality 2: 740 k / 365 draw calls). The game on a clean
  export, its own read-out: third person at the Earth spawn 527 k / 285 (579 k / 300 two
  commits earlier, before the tree trim and with every stroke slot submitted); the cockpit
  9 m up 350 k / 202.
  Before this block: Earth spawn 539 k / 296 (gallery, no models), forest easel 580 k / 317.
  What changed the count: the models are 2 draw calls instead of 25; the near layer is 1 draw
  call and at most 19.2 k triangles (only live strokes are submitted); the old near grass
  patches are gone (about 12 k triangles and one draw call a near chunk); **full trees and
  middle-tier trees hand over 18 % and 12 % sooner at quality 1** (`TRIM` in
  `src/world/flora.js`: 43 m to 35 m, 105 m to 92 m), which pays for the rest. The lead's
  vista `earth-temperate_forest-1` (645 k / 352 before, in the game) **was not re-measured
  by me in the game**: by the same deltas it should be under the budget; the lead must check.
  Other bodies were not re-measured (the trim applies to all, the near layer adds at most
  19.2 k and one call to each). **Not measured on a real GPU.**
- **Near ground build**: one clump costs a surface sample and two heights (about 0.1 ms here
  under load); a first fill is about 900 clumps and is spread over frames by the slice.
- **Crawl**: the Earth spawn seen from 1.6 m up and pitched 20 degrees down (the foreground
  fills the frame), camera turned 0.15 degrees (about 1.6 px): mean difference 3.85 of 255,
  7.6 % of pixels change by more than 12, 1.6 % by more than 30. The same pair with `near=0`:
  3.18, 6.0 %, 1.4 %. The strokes add about a quarter to what this view already does under a
  turn: crisp marks that travel with the ground they are anchored to. Two renders of one
  frame are identical. That is not a measure of shimmer in motion, and nobody has watched it.
  **Not measured**: the strokes in motion under wind (PHYSICS' field moving them), rain in
  motion through the glaze pass, the walk cycle's foot slip, anything by eye in motion.

### Not done, not verified, weak (blunt)
- **The sward is still tufts**: one clump every 0.66 m. A walker leaves a pale track, not a
  parted sward; seen from the game's boom the strokes are small dark flicks, rather even in
  size. Each blade is a flat two-segment triangle: close to a low camera they are cut paper
  (I made them slender within 7 m; not re-judged in first person in the game).
- **Explorer**: no face, no hands to speak of; sleeves are one stiff piece (no elbow);
  `sit` and `wade` poses never rendered; foot slip not measured; the hat brim hides the head
  from the game camera (intended) but from the front the head is a brown ball.
- **Ship**: the canopy glass is an opaque pale wash (an egg from some sides); no pilot is seen
  inside; the pulse state (long flames) was never rendered; the hover bob and the gear
  folding were seen only in the game's chase frame.
- **Cast shade** falls on terrain and near strokes only: not on props, water or the ship's own
  deck. Under a low sun it is capped at 2.2 heights.
- **Rain on Earth is thin**: a handful of strokes in a frame. Snow, dust, hail, leaves are
  still opaque marks in the scene pass (only rain is a glaze). Lightning still unseen.
- **Not done from item 4**: PHYSICS' branch sway and drifts; the instanced kit variant;
  half-float flora fields; the debug flag PHYSICS asked for.
- **The ragged border** still pools dark and a little dotted under a storm key.
- **M2's 42 biome frames in `docs/shots/painter/` predate this block** (no near ground, the old
  granulation): they are true to the landforms, not to today's foregrounds and darks.
- The tour was not run. Venus, Saturn, Mercury, Neptune, Pluto were not looked at with the
  near layer (their kinds follow from `small` automatically: mostly pebbles and needles).
- Quality 0 and 2 with the near layer: counted (cost line), never looked at.

### Contract changes in this block (all additive; nothing removed)
- `createExplorer()`, `createShip()`: C10 kept (sizes, origins, facing -Z, `userData.seat`
  (0, 1.75, -1.3), `userData.hatch` (-2.3, 0, -0.6), the state shapes). New: the ship's pads
  stand where PHYSICS' legs are ((0, 0, -3.2), (+-2.2, 0, 1.8)); `object3D.userData.pcCaster`
  ('explorer' | 'ship': the world lays their shade; any object added to the scene with that
  tag is treated the same); explorer `animate` also reads `phase`, `snap`; ship `snap`.
  Each `object3D` is a Group holding ONE mesh (`makeFigureMaterial`); do not swap its material.
- `world.setBuildBudget(ms, { fixed: true })`: pins the slice (the lead asked): no larger share
  of slow frames. `world.busy` now includes near-ground clumps still to lay.
- `world.update` eases the sky numbers itself; PILOT changes nothing.
- Render: `GLAZES` (shared.js) and `makeFigureMaterial`, `makeNearMaterial` (materials.js);
  `FRAG_PARS` declares `uCast[4]`, `uCastK` and gains `pcCast`; `makePaintUniforms` supplies
  them (kits built on the old factory still work: the uniforms default to no shade).
- Gallery: `pose=`, `speed=`, `phase=`, `jet=`, `lift=`, `mface=`, `epitch=`, `smode=`, `gear=`,
  `canopy=`, `throttle=`, `sface=`, `cockpit=1`, `near=0` (see "Gallery URL parameters").

### For PHYSICS
- **Rain** is a glaze now and your `share: 0.25`, `parallel`, `maxLen`, `near: 6` are in use:
  parallel strokes read as rain at last (`wx-jupiter-storm.jpg`). On Earth a quarter is too
  few through the trees (`wx-earth-storm.jpg`): I multiply your share by 1.6. If you can, make
  the share follow the rain rate so a downpour has three times the strokes of a shower.
- **Grass**: I use `pcPhysBend(root, 0.0)` per blade and your `flatten` (z) to lay a blade
  over along its own lean and keep it down: the plastic part (60 s) is what makes the
  walker's track visible, since the push load itself is gone a second after the feet. A
  track 1 m wide is about one clump of mine: a wider flatten radius for the explorer (0.8 m)
  would read better. The downwash disc is strong and right.
- **Sky numbers** are eased by me (0.9 s time constant): no need to slow yours for my sake.
- Pads: the ship's drawn pads are at your `legs`; tell me if they move.

### For PILOT (and the lead)
- **Cost** (MUST FIX of review 4): numbers above; please re-measure `earth-temperate_forest-1`
  and the densest view of each body in the game. If a body is still over, the knob is `TRIM`
  in `src/world/flora.js` (quality 1 only) or `MAXS` in `src/world/nearground.js`.
- **Dark specks** (MUST in M3): fixed in the sheet pass for every dark wash; please look at a
  fresh `m2-pulse` frame.
- `setBuildBudget(ms, { fixed: true })` is there. `world.busy` reaches 0 with the near layer
  (the gallery's ready flag waits on it); the tour was not re-run by me.
- The boom: the figure now reads at the default 6.4 m ("longer while the explorer is a
  placeholder" in `camera.js`): try 5 m, your call.
- The cockpit: the hoop and the cowl sit where the HUD's lower panels are; if the dials
  should be seen, the panels want to move outward 80 px or so.
- The ship has no pilot inside and the explorer's `sit` pose is unused: if you ever show the
  explorer in the cockpit from outside, tell me and I will seat a figure under the glass.
- **UI theme, look review** (from `ui-title`, `ui-map`, `ui-painted-book`, `ui-foot`, seen on a
  half-size contact sheet). It belongs to the picture: torn paper in the sheet's own white,
  a hand-lettered face, "click to begin" as a brush stroke, the sketch pinned like a small
  painting. Change, in this order: (1) the key caps are the one digital thing on the title
  card (even blue-grey rounded rectangles with a hard outline): make each a loose wash dab
  with a broken pencil ring, none quite alike; (2) the map lies on a flat navy field with
  pixel-dot stars: either the sheet's own indigo wash with spattered stars, or no dark field
  at all (an ink chart on bare paper); (3) the orbits are perfect ellipses of one line
  weight: let the line break and swell like dry brush; (4) the sketchbook's empty slots are
  grey dashed boxes and the selected planet is a hard navy pill: faint pencil rectangles,
  and a brush stroke for the selection; (5) the hint line sits on a clean rectangle: tear it
  like the others; (6) every panel shares one tear profile: vary it per panel.

## M3 block 1: weather in the picture (third PAINTER agent)

INTEGRATION: ready (`9d9caf1`; render, world and art usable on all ten bodies; the game on a
clean export of that commit loads and plays into the storm with no console error).

### What is in, the frame that shows it, my verdict
Frames in `docs/shots/painter/`, 960x540, quality 1, gallery. "physics" = PHYSICS' own
weather at that place and time (`physics=1&wtime=..&pre=6`); "forced" = sky numbers set by
hand (`wx=`). I opened every frame named here at full size unless I say otherwise.

| what | frame | how made | verdict |
| --- | --- | --- | --- |
| Earth spawn before the storm | `wx-earth-before.jpg` | physics, t 540 | fair day, sun and cast shade, a few dark grass strokes in the foreground (opened on a contact sheet at two thirds size) |
| Earth spawn in the thunderstorm | `wx-earth-storm.jpg` | physics, t 720 | passes: indigo sky with a torn pale gap, far trees lost in a pale band, no cast shadows, darker richer ground with two small puddles, slanted rain strokes. The committed frame has the longer, thinner strokes and was opened at 640x360 only; the one before it at full size |
| after the storm | `wx-earth-after.jpg` | physics, t 870 | sun back, ground a little richer (wet 0.4); quiet, as it should be (contact sheet) |
| blizzard on a snowy biome | `wx-earth-blizzard.jpg` | physics, alpine meadow easel, t 400, `fresh=1` | passes: closed grey sky, the massif going into the white, fresh snow as bare paper with rocks capped, pines as dark dabs, paper flecks in the air. Weak: the foreground is empty paper; the grass tufts left standing are too green |
| dust storm on Mars | `wx-mars-dust.jpg` | physics, dust dunes easel, t 840 | passes as a picture of dust: the whole sheet in the dunes' own ochre, far dunes dissolved, dust masses in the sky, a glow at the horizon. Weak: the near billows (kits) are soft blotches, more sponge than drift |
| storm on a giant | `wx-jupiter-storm.jpg` | physics, storm wall easel, t 120 | passes: a sepia storm sky (not grey), the wall ghostly, wet red plain, rain. The strokes are many and all alike |
| Neptune's sea in a gale | `wx-neptune-gale.jpg` | PHYSICS' waves (wind 34 m/s, Hs 1.0 m, 10.6 m waves) under a forced storm sky | partly: heavy indigo sky with veils, the sea in broken dark strokes, a pale foam patch, swash at the shore. Few white horses: at this distance the 10 m waves are smaller than the brush and are dropped; the far sea carries only anchored dabs. Under PHYSICS' own sky there (fair, "windy") it is a choppy blue sea |
| grass parting round the explorer | `wx-grass-part.jpg` (left push off, right on) | physics, alpine meadow, explorer walked in | partly: the clump at the explorer's feet leans away (0.93 % of the frame's pixels change by more than 12 of 255); nothing reads as a sward parting |
| grass under the ship's wash | `wx-grass-wash.jpg` (left no wash, right 90 kN at 3 m) | physics | yes: the near clumps lie over, away from the hull (2.3 % of the pixels of the grass band change by more than 12) |
| the game itself | not committed (scratch `game-storm.jpg`, opened) | clean export of `02486d3`, `index.html`, clock set to t 700, third person | storm sky, wet ground, rain, kits 5 draw calls and 3.3 k triangles, state ON_FOOT, no console error. In that view from above the rain strokes read as short pale petals; made longer and thinner since (`9d9caf1`), **not re-checked in the game** |

How each part works, briefly:
- **Sky**: under an overcast the zenith and horizon keys become one heavy wash of that
  world's storm pigment (its cloud shadow laid dense and glazed with indigo: Payne's grey on
  the cool worlds, sepia on the warm ones, because orange mixed with indigo is mud), dense
  overhead, paler toward the horizon. Clouds stop being bare paper and become masses of the
  same wash with dark bellies and pale torn edges. Rain or snow in the air drags soft slanted
  veils through the low sky (anchored to the planet). Where rain or snow falls the sky is
  closed whatever `cloud` says. Dust tints zenith, horizon, haze and light with the mid ground
  wash of the biomes under the camera and raises dust masses.
- **Haze**: the fog distance is multiplied by `haze / 0.8` (PHYSICS' fair weather is 0.7 to
  0.95: I treat 0.8 and up as my clear day); the haze colour goes to the pale band under the
  cloud, to grey water (`fog`) or to the ground's dust.
- **Light**: overcast flattens the light to two soft steps (local colour and one glaze),
  switches off cast dapple, cools the light; a storm deepens the glaze.
- **Sheet**: a storm adds pigment to every wash (the density model: paper stays the brightest
  value); granulation is damped under that key; `flash` lifts the sky and the lights to bare
  paper and leaves the darks as silhouettes (same frame).
- **Ground and flora**: `wet` darkens and enriches (`pcWetWash`), softens edges, and leaves a
  few small pale puddles on level ground near the eye; snow lies as bare paper on up-facing
  forms with a ragged edge, thinner under trees, on crown tops and rocks; four fifths of
  the grass and flowers are buried.
- **Liquid**: the mesh is lifted by PHYSICS' wave trains and wakes within about 2 to 6
  wavelengths of the eye (where the mesh is fine enough), dying at the waterline. In the
  fragment: PHYSICS' height and slope give the normal; crest lines (high water where the
  slope along the waves' way turns over) are torn bare-paper dashes; whitecaps torn dabs on
  the crest fronts; surf on breaking crests in the shallows and a swash line at the shore;
  detail smaller than a pixel is dropped (so far water cannot shimmer) and replaced by the
  same share of white as anchored dabs; a running sea mirrors less and is laid in broken
  strokes of unequal weight.
- **Kits** (`src/render/kitmat.js`): rain a broad wet stroke in the sky's own wash, nothing
  nearer than 3.2 m; snow a ragged paper fleck; dust a soft patch close to the haze's value;
  prints the ground's wash laid darker; rings broken circles on region 6. Sixteen inks a
  biome by PHYSICS' material names, blended by biome weight under the camera.
- **Grass**: each near grass tuft (the seed-below-0.55 half, within 15 m) is now a patch of
  12 broad blades about 1.6 m across; each blade carries its root in `aMass.xz` and is bent
  about it by `pcPhysBend` at that root.

### Numbers
- **Cost with weather on** (gallery, whole frame, `renderer.info` over one frame):
  Earth spawn in the thunderstorm (`cam=trees`) quality 1: 551 k triangles, 301 draw calls
  (the same view before this block: 539 k, 296); quality 0: 246 k, 179 (before: 241 k, 174).
  The densest view known (temperate forest easel, quality 1): 580 k, 317 (was 571 k, 315).
  Kits in the storm: 5 draw calls, 3.3 to 3.4 k triangles, 0.2 to 0.3 ms a frame for
  `kits.update` in the browser (one reading of 8.9 ms with four browsers running at once).
  Budgets 600 k / 350 at quality 1 and 300 k at quality 0: inside. Quality 2 not re-measured.
  The sky, haze, light and sheet changes add no draw call and no pass; the water fragment
  adds PHYSICS' four wave trains (16 sin or cos) and three noise lookups; the water vertex
  the same plus the 16-step wake loop. **Not measured on a real GPU.**
- **Crawl** (frame pairs at 960x540, mean difference on 0 to 255 and share of pixels changing
  by more than 12): storm sky, veils and wet ground one frame (1/30 s) apart, kits off: 0.32
  and 0.04 %. The gale sea one frame apart: 1.81 and 2.3 % inside the sea band (0.02 % by
  more than 30): it moves, nothing pops. The sea with the camera turned 0.15 degrees: 1.39 and
  0.87 %. The snow-covered meadow under the same turn: 1.25 and 1.32 %, less than the same
  meadow in fair weather (1.59 and 1.79 %): the snow edge adds no crawl. Two renders of the
  same frame with physics on are identical outside what was pushed (0.02). **Not measured**:
  crawl of rain, flakes, dust and rings in motion (PHYSICS measured its marks; I did not
  measure them through my post pass), and nothing was judged in motion by eye.

### Not done, not verified, weak (blunt)
- **Lightning** is implemented (`flash`) and has never been seen: no frame caught a flash.
- **Rain in the game's view** was re-shaped after the only game frame I took; not re-checked.
  Rain strokes are opaque (the scene pass cannot glaze): they are pale sticks against dark
  trees. The glaze target promised to PHYSICS (its gap 3) is still not built.
- **Grass is not a sward**: tufts stand 1.5 to 3 m apart, so there are a few clumps of broad
  strokes near the eye. The patch stands on the planet's up, not on the slope (blades hover
  or sink on steep ground). On the alpine meadow the blades are pale. A meadow of grass
  needs its own dense near layer (a camera-centred grid of strokes, about 3 a square metre
  within 12 m: about 20 k triangles, one draw call).
- **Snow**: I draw only fresh snow (see contract changes). The edge is ragged, the cover has
  no drifts (PHYSICS' section F, `physics.fields.drift`, is not read).
- **Not wired from PHYSICS' P6**: branches (`pcPhysBranch`, one line and two uniforms),
  drifts, the instanced kit variant (`expand: 'gpu'`), half-float linear flora fields, and the
  debug flag that writes the displaced position (asked for; not built).
- **Puddles** are two or three pale shapes; they do not mirror anything.
- The tour was not run in this block; landings and the trip were not re-run (terrain did not
  change; spawns and stands did not move).
- Venus, Saturn, Uranus, Mercury, the Moon and Pluto were not looked at under weather.
- The ragged border goes dark and dotted under the storm key.

### Contract changes in this block (all additive)
- `world.setPhysics(physics, opts?)` now also builds PHYSICS' draw kits (dynamic import of
  `src/physics/three/index.js`) and draws them under the active body's root; `{ kits: false }`
  turns that off. **PILOT: do not create kits yourself.** `world.kits` is the kit object
  (`stats.drawCalls`, `stats.triangles`) or null.
- `world.setWeather(sky | null)`: force the eleven sky numbers (gallery, tests).
  `world.freshSnow`, `world.setFreshSnow(x)`.
- `painter.setMood({ sky })` is read: `flash` in the same frame; the rest only if PHYSICS was
  not handed to the world. With `world.setPhysics` the world reads `physics.here.sky` itself.
- **Snow, my reading of the contract (look is my call)**: PHYSICS' `snow` is 1.0 on the
  alpine meadow in fair weather, 0.74 on Mars' polar frost, 0.96 on Neptune's tundra, 0.54 on
  Uranus' shelves: the standing cover of a cold place. Drawn as given, the alpine meadow the
  brief names would be white for ever. The standing cover is already in each biome's painting;
  the picture adds **fresh** snow only: it gathers while `snowfall` is above 0.02 (full after
  about 25 s of a blizzard), is gone five minutes after, and never exceeds `snow`.
- Regions: 6 = small crisp marks (the abstraction pass keeps 92 % of the drawing), 7 = in the
  air (no graphite line). `FRAG_PARS` declares `uniform vec4 uWx` and gains `pcWetWash`,
  `pcSnowCover`; `makePaintUniforms` supplies `uWx`. Kits built on the old factory still work.
- `src/render/index.js` consumers: nothing removed. New file `src/render/kitmat.js`
  (`makeKitMaterial(kind, info, { shapeGlsl })`, `biomeInks`, `KIT_INK`, `KIT_PALETTE`).
- Gallery: `wx=`, `sky=`, `physics=1&wtime=&pre=`, `fresh=1`, `kits=0`, `models=1&walk=&mdist=
  &sdist=&hover=&wash=`, `push=0` (see "Gallery URL parameters").

### For PHYSICS: what looks wrong in the physics as painted (frame by frame)
- `wx-earth-storm.jpg`, `wx-jupiter-storm.jpg` (rain): near drops are drawn in perspective,
  so strokes left and right of the view axis lean opposite ways and cross; a painter lays rain
  in parallel strokes. Ask: one screen direction for all strokes of a frame (the mean), or
  nothing nearer than 4 m (I discard nearer than 3.2 m myself). On Jupiter drops fall so fast
  that at any exposure worth a stroke they are several metres long: an upper bound on stroke
  length in metres would help (I use 120 ms on every world). With the 4 px floor about 40
  strokes are in the frame: a third of that would be "a few".
- `wx-earth-blizzard.jpg` (snow): the first try (size 0.1 m, ceiling 10 px) gave round discs
  the size of popcorn; I use 0.07 m, floor 3.5 px, ceiling 6.5 px and a ragged cut. Flakes
  are fine in number. **At the easel the blizzard has `cloud` 0.46 and `overcast` 0.43 with
  `snowfall` 0.81**: a blizzard under a half-blue sky; I close the sky wherever rain or snow
  falls, but the numbers should agree.
- `wx-mars-dust.jpg` (dust): the billows come as about twenty separate round patches of 40 to
  80 px; drawn in the ground's ink they are blotches. Fewer and larger (two or three low
  walls of dust, wider than high, hugging the ground) would be a drift.
- Rings: on region 6 they survive and are few (two or three in a storm frame at 960x540);
  more would not hurt. Not checked on water.
- `wx-neptune-gale.jpg` (sea): `crest01` covers the whole top of a wave, which paints as a
  white sheet from near by; I use the crest line instead (height high and the slope along the
  wave direction near zero). `foam01` patches are several metres across; I tear them with
  noise. The waves are 10 m long and 1 m high in a 34 m/s wind (fetch-limited): from the shore
  they are smaller than the brush beyond 60 m, so the storm sea is mostly my far strokes. A
  longer, higher swell train on the open side of `storm_seas` would be seen.
- `snow`: see the contract note; a number for fresh cover alone would let me drop my own.
- Grass (`wx-grass-part.jpg`): the push round a walking explorer is one clump wide; the
  flattening under the wash is strong and reads. Bend in a breeze is not judged.
- The standing `wet` 0.55 on Neptune's tundra darkens that biome permanently: fine by me.

### For PILOT
- `world.setPhysics(physics)` now draws the weather kits: nothing to wire. Pass `eye` to
  `physics.update` as PHYSICS asks. `setMood.sky` stays useful for `flash`.
- The read-out will show 5 more draw calls and about 3.4 k more triangles in a storm.
- Lightning: I would like to see one. A debug way to force `flash` for a frame would do.

## M2 status (second PAINTER agent; kept as written)

INTEGRATION: ready (latest `[painter]` commit; render, world and art usable on all ten bodies).

**M2, third pass: every biome of the eight planets now shows the feature the brief names, as
terrain in the surface function**; the per-biome table is below, with the frames I opened.
M1 stays closed. Moon and Pluto are untouched placeholders (they use the same recipes).

What changed in this pass (all in my files):

- **Landforms** (`src/world/surface.js`): new or rebuilt recipes: `canyon` (a plateau cut by a
  wandering network of gorges: dry floor, walls in steps with benches, buttes on the plateau),
  `mesa` (tables with cliffs all round and a talus skirt, two tiers), `terraced` (level treads
  ending in cliffs; with `pools` a rimmed pool on every tread, each at its own level), `wall`
  (one great escarpment in two lifts with folded buttresses), `spires` (wind-scoured ridges
  that the slim spire kit stands along), `dunes` (transverse dunes: long back, short slip
  face, smaller dunes on the backs, baked lee shade), `alpine` (flat meadow floors, sharp
  ridges whose crest height rises and falls, snow line), `coast` (cliffs at the shore, stacks
  in the shallows), `islands` (tables in a sea of water or cloud, islets, the rock fading into
  the cloud at its foot so the islands seem to float), craters on a cell grid laid over the
  cube-sphere faces (whole bowls of many sizes, flat floor, steep inner wall, rim, apron;
  frost in the bowls), ponds on flats. Cliff lips are rounded a little so the mesh shows no
  knife edge. Strata are painted in the shader from the height (`aColor.a`), strongest on
  steep faces. Fog lying in low ground (`t.fog`), lasting half-light (`twilight`) and a chosen
  hour (`hour`) are per biome.
- **Nothing stretched**: the terrain's brush marks no longer come from the triplanar stroke
  atlas (its streak channel smeared into long radial streaks). Marks are thresholds of the 3D
  noise, anchored to the planet, in two octaves cross-faded by distance so that a mark keeps
  about the same size on the sheet: soft dabs, a few crisp flecks (fewer on smooth sand and
  ice), dry-brush sparkle. Rocks likewise. Cracks: the cell pattern is now uneven (a quarter of
  the cells left out, coordinates bent), looked up through a warp, with lines that swell, thin
  and break off, at two sizes. Graphite outlines are fainter and more broken.
- **Kits**: hanging vines (a mound on the cliff lip and a curtain of strands falling down the
  face, placed on lips and turned to face out over the drop; not an obstacle), frozen waves as
  a swept profile (back, crest, curling lip, hollow), slim leaning ice spires, crystals that
  bow, tall things in groups with empty stretches (outside the woods), bushes and grass in each
  biome's own washes (`biome.under`).
- **From orbit**: banded worlds close into a full cloud deck seen from outside: belts along
  the latitude with weather-pushed edges, white streaks, and Jupiter's Great Red Spot standing
  over the first `storm_wall` site. Decks ride above the highest ground.
- **The easel** (`src/art/vantage.js`, `src/art/easels.js`): `cam=vista` no longer guesses. It
  scans the ground from candidate spots, keeps what is not hidden, and scores each view for
  what that kind of place should show (skyline, overlapping ridges, water with land beyond it,
  a wall, a hollow with its far side, a crest running into the picture, ring arcs in the sky,
  nothing standing in front of the lens). The spot chosen for each biome is kept in
  `easels.js`, so the evidence frames are reproducible.
- **Cost and readiness**: terrain and flora take turns at a frame's building slice; a flora
  step starts only if it is likely to fit; undergrowth placement rejects most candidates
  before sampling; steep ground is refined from further away (no rows of teeth on cliff
  lines), less so at quality 0; the low tier draws no full trees and 55 % of the undergrowth.
  `world.busy` draining after a change of body is now tested.

### Per biome: is the named feature in the frame?

Frames: `docs/shots/painter/<body>-<biome>.jpg` and `<body>-orbit.jpg`, 960x540, quality 1,
`gallery.html?ui=0&t=0&quality=1&body=..&biome=..&cam=vista` (orbit: `cam=orbit`; Jupiter's with
`&biome=storm_wall`). Each was rendered twice from the kept easels (the committed frame and a
second render compared with it by image difference: all 40 reproduce). **I opened every one of
the 40 at full size.** Verdicts are mine, as a painting teacher would give them.

| frame | what the brief names | in the frame? |
| --- | --- | --- |
| mercury-orbit | the planet by its washes | yes: grey disc, a dark glass region, ochre edge, pale crater dots |
| mercury-ochre_basins | cracked ochre basins | yes: wandering cracks in the near slab, a basin with low crater mounds |
| mercury-obsidian_fields | obsidian glass fields | yes: dark bowed blades on cracked grey ground |
| mercury-crystal_gardens | twilight-band crystal gardens | yes: violet crystals in a lasting dusk; crowded, one crystal too near the lens |
| mercury-shadow_craters | frozen shadow craters | yes: from the rim into a bowl, frost floor, far wall in blue shadow |
| venus-orbit | sulphur-gold haze | yes: gold disc with wandering orange belts |
| venus-fungal_towers | fungal towers in amber cloud | yes (busy, as the lead said; not repainted) |
| venus-lava_rivers | lava rivers through basalt | yes |
| venus-acid_terraces | acid-lake terraces | yes: a green lake among stepped yellow ground; the steps are soft |
| venus-pale_mesas | pale mesas above the fog | yes: a mesa's shadowed cliff, ghost mesas standing in sulphur fog |
| earth-orbit | the planet | yes |
| earth-autumn_woodland | autumn woodland | yes: birches, gold crowns, the brook mirroring them |
| earth-alpine_meadow | alpine meadow and snow peaks | yes: flowered meadow, pines, a snow massif |
| earth-sea_coast | sea cliffs and coast | yes: a cliff headland with trees on top, beach, sea |
| earth-desert_canyon | desert canyon | yes: banded walls both sides, a butte beyond |
| earth-misty_wetland | misty wetland | yes: pool, reeds, trees lost in mist; emptier than it should be |
| mars-orbit | the planet | yes: rust globe, pale cap, canyon traces |
| mars-rust_canyons | rust canyons | yes: stepped strata walls, a spire, boulders; the far wall goes grey in the haze |
| mars-dust_dunes | dust-storm dunes | yes: a crest running into the picture, lit backs and violet troughs, more dunes behind (painted at 16.2 h; at noon the forms are flatter) |
| mars-polar_frost | polar frost fields | yes, quietly: frost polygons drawn by hand, a low scarp, ice shards |
| mars-dry_riverbeds | dry riverbeds, red-leaf groves | yes for the groves; the bed is only a pale band |
| jupiter-orbit | banded cream and orange, the Red Spot | yes |
| jupiter-sky_islands | sky-islands in cloud seas | yes: a table island with trees, pillars and islands across the cloud sea |
| jupiter-storm_wall | storm-wall cliffs | yes: the wall above a red plain with spires, in storm light (the storm itself is weather, M3) |
| jupiter-hanging_gardens | hanging gardens | yes: curtains of vine falling down a cliff above a garden |
| jupiter-lightning_plains | lightning plains | partly: cracked plain, pits, glass shards, brooding light; no lightning yet |
| saturn-orbit | rings and gold belts | yes |
| saturn-gold_islands | gold sky-islands, ring arcs | yes: islands and islets in the cloud sea, the ring arc in the sky |
| saturn-crystal_reeds | crystal reed fields | yes |
| saturn-ring_shadow | ring-shadow twilight | yes: dim violet spires, the ring a pale streak |
| saturn-honey_mist | honey mist valleys | yes |
| uranus-orbit | mint and aqua | yes |
| uranus-ice_shelves | mint ice shelves | partly: cracked ice and one shelf cliff; the cliff is a rounded scarp, not a sharp table edge |
| uranus-frozen_waves | frozen-wave forests | partly: the waves still read as snow-capped mounds; one shows its curl |
| uranus-pearl_fog | pearl fog flats | yes: the ground and the shards go into the fog |
| uranus-teal_sinkholes | glowing teal sinkholes | yes: the pool inside its pit walls |
| neptune-orbit | ultramarine, storm streaks | yes |
| neptune-storm_seas | storm seas with basalt stacks | yes for sea and stacks; the sea is calm (weather, M3) |
| neptune-kelp_forests | blue-violet kelp forests | yes |
| neptune-ice_spires | wind-carved ice spires | yes: leaning needles in a row |
| neptune-aurora_tundra | aurora tundra | partly: tundra with ponds; no aurora (sky work, M3) |

Earth's home forest: `earth-forest-*.jpg` (the M1 set) regenerated with the new ground marks. Opened at full size: `earth-forest-trees-noon.jpg` (still passes: leaning birches, crowns as washes, the brook, a softer meadow). **Not opened after regeneration**: stream-noon, canopy, jet, dusk, dawn, night, high, models-in-forest, stability-a and -b.

By my count: 28 biomes yes, 5 partly (`lightning_plains`, `ice_shelves`, `frozen_waves`,
`aurora_tundra`, and the channel of `dry_riverbeds`), none missing; eight orbit views
recognisable.

### In the integrated game (PILOT's tour, on a clean export)

`node tests/tour.mjs --bodies <body> --root <export>` at 960x540, quality 1, third person. The
tour stands where `world.findBiome` says (now the biome's **stand**: level ground that shows
the biome whichever way one faces) and at every vista.
Run by me for all eight planets on exports of `0d8ce45` to `6d0a92e` (the stands and easels
did not change between them except Uranus' sinkhole stand, re-run on `ddb5758`). I opened the
biome frames of every planet (my own contact sheets of the tour's frames) and two vista frames
each of Jupiter and Saturn; **I did not open the other vista frames**.

- Every frame settled (5 to 62 s; before this pass they never did) and no run reported a
  console error. Jupiter's and Uranus' first runs ended "TOUR FAILED" only because the browser
  refused the final contact-sheet screenshot under load; their frames were captured.
- The game's own counters at the stands, quality 1 (budget 600 k, 350): Earth 302 to 573 k and
  181 to 336 calls (autumn woodland the heaviest), Venus 316 to 512 k, Jupiter 321 to 532 k,
  Saturn 294 to 402 k, Neptune 224 to 375 k, Mars 178 to 361 k, Mercury 196 to 358 k (309
  calls in the crystal gardens), Uranus 252 to 375 k. All inside.
- What the game frames show: Earth: forest by the brook, autumn birches (with long dark cast
  shadows across the ground: hard-edged, to soften), meadow under snow peaks, a sea inlet under
  cliffs, banded canyon walls and a butte, a misty pool. Mars: canyon floor between strata
  walls; dune swells (soft at 10 h); frost polygons (the ice shards read too violet in the
  game's light); red groves over a pale bed. Jupiter: island top with the cloud sea and other
  islands behind; the storm wall above the red plain; a vine-hung cliff over the garden;
  cracked plain with shards. Saturn: an island top facing another island's cliff, the ring in
  the sky; reeds; twilight spires; misty valley. Mercury: cracks; glass blades; crystals in
  dusk; a crater's far wall and rim. Venus: towers; lava; the acid lake; pale mesas in fog.
  Uranus: spires before a shelf; frozen swell (weak); fog; the glowing pool inside its pit (after the stand was moved down to it). Neptune: cliff, sea and a
  stack; kelp; leaning spires behind a ridge; tundra and a pond.
- Second-site vistas stood on cliffs in two Jupiter cases (44 and 68 degrees); they are now
  moved to standable ground (tested for every vista on all ten bodies).

### Frame cost

Gallery, 480x270, at each biome's easel, whole painted frame (`renderer.info` over one frame),
after settling. Budget: 600 k triangles and 350 draw calls at quality 1, 300 k at quality 0,
1.2 M at quality 2. Densest view of each planet:

| planet | quality 1 triangles | quality 1 draw calls | quality 0 | quality 2 |
| --- | --- | --- | --- | --- |
| mercury | 370 k (crystal_gardens) | 316 (crystal_gardens) | 195 k (crystal_gardens) | 415 k (crystal_gardens) |
| venus | 459 k (fungal_towers) | 233 (fungal_towers) | 274 k (fungal_towers) | 519 k (fungal_towers) |
| earth | 571 k (temperate_forest) | 315 (temperate_forest) | 394 k (misty_wetland) | 728 k (temperate_forest) |
| mars | 329 k (dry_riverbeds) | 219 (dry_riverbeds) | 210 k (dry_riverbeds) | 406 k (dry_riverbeds) |
| jupiter | 455 k (hanging_gardens) | 226 (sky_islands) | 296 k (hanging_gardens) | 513 k (hanging_gardens) |
| saturn | 381 k (gold_islands) | 229 (gold_islands) | 222 k (crystal_reeds) | 451 k (gold_islands) |
| uranus | 324 k (teal_sinkholes) | 183 (teal_sinkholes) | 165 k (pearl_fog) | 360 k (teal_sinkholes) |
| neptune | 404 k (aurora_tundra) | 269 (aurora_tundra) | 267 k (aurora_tundra) | 442 k (aurora_tundra) |

Every planet is inside the budget at quality 1 (worst: Earth's home forest, 571 k and 315
calls) and at quality 2 (worst 728 k). At quality 0 the first probe found two Earth views
over (wetland 394 k, alpine 312 k); the low tier was then trimmed (no full trees, half the
undergrowth, little extra refinement on cliffs, a coarser split) and re-measured: alpine
168 k, home forest 242 k, Jupiter's gardens 209 k, wetland 299 k (at the edge of the budget). The other planets' low
tier figures in the table are from before the trim (so they are upper bounds).
`sampleSurface`: 10 to 34 microseconds a call on the ten bodies in Node under load (budget 50;
tested). `world.update` while arriving: see the answer to the lead below.
### Not done, not verified, weakest (blunt)

- **Not verified on a real GPU**: frame rate, and `world.update` worst frames in wall-clock
  time (only counted work, in Node).
- **In the game the picture depends on PILOT's camera.** The stands help (each shows its
  biome in most directions) but the explorer looks toward the parked ship. Tour sheets I did
  not open are named above.
- Two easels stand on steep ground (`mercury/shadow_craters` on a crater rim at 34 degrees,
  `uranus/teal_sinkholes` at 26 degrees): fine for the gallery, awkward as vistas on foot.
- **Weakest biome of each planet, for the M3 repaint**: Mercury `ochre_basins` (the basin
  itself is hardly a hollow); Venus `acid_terraces` (soft steps) and `fungal_towers` (busy);
  Earth `misty_wetland` (empty) and the dark shadow patches in `autumn_woodland`; Mars
  `polar_frost` (quiet) and the bed of `dry_riverbeds`; Jupiter `lightning_plains`; Saturn
  `ring_shadow` (little relief); Uranus `frozen_waves` (mounds, not waves) and `ice_shelves`
  (rounded scarp); Neptune `aurora_tundra` (no aurora) and the calm `storm_seas`.
- Foregrounds are bare on most worlds; explorer and ship are still toys and are in every
  game frame; no weather, no night or dusk pass on the new worlds (frames are at noon, the
  dunes at 16.2 h); Moon and Pluto untouched.
- `jupiter-lightning_plains.jpg` was rendered just before crater rims were given rounded
  crests (its pits changed by centimetres); not re-rendered.
- The lead's review-3 SHOULD FIX 4 (Venus' towers) is not addressed.
- `world.update` deliberately takes up to 30 % of the frame when the smoothed frame time is
  above 80 ms (software rendering): PILOT's read-out will show "world worst" of 100 to 300 ms
  in headless runs. At real frame rates the slice is 4 ms. Say if you would rather have a
  switch.

## Contract changes in this pass (all additive)

- `world.findBiome(bodyId, biomeId)` -> `{ unitDir, yaw, pitch }`: now the **easel** of that
  biome (the dry, standable spot its picture was painted from) and the way the painter faced
  (`yaw` from local north toward east, `pitch`, radians; north = `up x (Y x up)`). Falls back
  to the biome's first site (yaw 0) on the Moon and Pluto.
- `world.getVistas(bodyId)`: the first vista of each biome (`<body>-<biome>-1`, same ids as
  before) is now that easel and carries `yaw` and `pitch`; second sites follow as before.
- `world.sampleObstacles(bodyId, unitDir, radius, soft)`: `soft === true` also lists bushes
  (`kind: 'bush'`); default unchanged. Hanging vines are never listed.
- `src/render/index.js` also exports `makePaintUniforms(bodyUniforms?, own?)` and the three
  scene chunks `VERT_PARS`, `VERT_END`, `FRAG_PARS` (for PHYSICS' kits).
- `looks.js` biome fields: `under` (own undergrowth washes), `twilight`, `hour`, `want`,
  `hang`, `t.fog`, `t.strata` and the recipe parameters; body fields `deck` (cloud deck from
  outside: height, belts, wobble, colours, streaks, storm) and `fine` (one more terrain level).
- Spawns moved on every body except Earth (the search now wants level, dry ground out to
  13 m); Jupiter has hand-placed sites now and its spawn stands on a sky-island. Every
  landform changed: PILOT's landings and the trip need re-running.
- Gallery: `cam=vista` uses the kept easel; without `time=` the biome's `hour` applies (only
  Mars' dunes name one: 16.2 h); `cam=orbit` over a banded world stands over the low latitudes;
  `cam=orbit&biome=storm_wall` centres Jupiter's Great Red Spot.

## Answers to the lead (review 3) and to PILOT's numbered needs

- **MUST FIX 1, Neptune's spawn 727 k**: fixed. Gallery, standing at the spawn: 318 k triangles and 174 draw calls at quality 1, 165 k at quality 0 (the lead measured 727 k in the game before; PILOT's tour now reads the game's own counters at each stand, below).
  Every view measured is in the table above; the densest is Earth's home forest.
- **SHOULD FIX 2, `world.busy` never drains after a change of body**: fixed and tested
  (`src/world/busy.test.mjs`: Earth, Mars, Neptune, Mercury, Earth again, then deep space; and a
  body left with work queued). A body that stops being the active one drops its queues on the
  next update.
- **SHOULD FIX 3, `world.update` 8.5 to 9.4 ms while building**: the cause was a full terrain
  slice plus a flora step in the same frame. They now take turns and a flora step starts only
  if it fits. Counted in work (surface samples, in Node, where machine load does not hide it)
  the heaviest frame of an arrival is about 4.2 ms at the 5 ms budget; wall-clock spikes above
  that remain on this shared machine (scavenges and pre-emption), so a real GPU run is still
  owed. The test asserts the counted figure.
- SHOULD FIX 4 (Venus' fungal towers too busy): not repainted in this pass.
- SHOULD FIX 5 (Neptune's storm sea is calm): the sea now has stacks standing in it; the storm
  is weather (M3).
- PILOT 4 (ceiling): tested for all ten bodies. PILOT 5 (liquid edges): unchanged mechanism
  (a berm closes each liquid at the edge of its group); pools on terraces switch level on a
  dry rim, never on a wall. PILOT 6 (spawns): tested dry, under 0.12 rad at the spot and under
  0.30 rad out to 12 m on the eight planets, Moon and Pluto. PILOT 7 (vistas): the first vista
  of each biome is a spot I stood on; markers are not painted yet (M3). PILOT 8 to 11: M3,
  nothing delivered yet.

## For PHYSICS (complete on its own)

Your six gaps:
1. *No public constructor for the uniforms `FRAG_PARS` needs*: `makePaintUniforms(bodyUniforms?,
   own?)` from `src/render/index.js` (commit `ebd9b4d`). Pass `world.bodyUniforms(bodyId)` to be
   lit and hazed like that body.
2. *Chunks not re-exported*: `VERT_PARS`, `VERT_END`, `FRAG_PARS` are exported from
   `src/render/index.js`.
3. *An opaque pass cannot glaze*: agreed, and it is mine to solve. Plan for M3: kits write the
   **change of pigment density** they cause rather than ink of their own. Ground marks go
   through the terrain itself (I take your ground-mark field as a texture around the focus and
   darken, lighten or wet my own wash in the terrain shader, so a print in litter is litter
   pressed down, not a brown blot). Airborne kinds (dust, spray) get one small blended target
   that the abstraction pass multiplies in. Your ground-material tag on every particle is what
   I need for the first; keep it.
4. *The 3 px floor of the post pass*: by design (art bible 4: detail becomes brush-sized
   shapes). Rain will be drawn as a few broad slanted strokes and a veil on the far bands,
   snow as soft dabs of bare paper, both at sizes that survive; your size floor is right.
5. *Waves*: yes. My liquid material will take your chunk (displacement, slope, crest, foam
   measure, wakes) as an include; it already has per-vertex liquid look (colour, mirror, glow,
   cloud) and reflects the previous frame.
6. *Nothing reads the weather*: first M3 block, in the coordinator's order: sky, haze and
   sheet from `setMood.sky` (`cloud`, `overcast`, `haze`, `fog`, `dust`, `flash`), then ground
   washes (`wet`, `snow`), then waves, then the kits.

Your earlier needs: (2) ground words: keep yours. (3) Cloud seas carrying the explorer as a
froth: fine with me. (4) Ground under a cloud sea lies 40 m below it and under lava about 3 m;
both liquids are opaque, so it is never seen from above; it would be seen by anything that
sank. New liquids in this pass: ponds on Neptune's tundra (`aurora_tundra`, shallow water) and a
pool on every tread of Venus' acid terraces, each at its own level. New ground you may want
words for: `polar_frost` is terraced ice scarps now; `ice_spires` low wind-scoured ridges;
`storm_wall` a great cliff with a talus skirt; biome ids are unchanged.

The material contract for a kit is unchanged: one opaque pass into two targets, holes by
`discard`; output 0 `vec4(wash, wetness)` (wash = transmittance over paper, 1 = bare paper),
output 1 `vec4(viewNormal.xy, log2(1 + viewDepth), regionId)` (0 sky, 1 ground, 2 liquid,
3 solid prop, 4 foliage, 5 characters); call `pcWrite(col, wet, nV, -viewPos.z, id)`; set
`material.userData.pcPainted = true`.

## How to use my modules

```js
import { createPainter, RENDERER_OPTIONS, makeWashMaterial, makePaintUniforms } from './src/render/index.js';
import { createWorld } from './src/world/index.js';
import { createExplorer, createShip } from './src/art/models.js';
```
- `world.busy`: pending build jobs (terrain + flora), 0 when nothing is left to build for the
  current camera. `world.setBuildBudget(ms)`: the building slice inside `update` (default 5).
- `world.getLighting()` -> `{ bodyId, sunElevation, hours, dayness, altitude, space01 }`.
- `world.sampleSurface` adds `liquidRadius`, `canopyHeight`, `canopy01`.
- `world.sampleObstacles(bodyId, unitDir, radius)` -> `[{ unitDir, radius, height, kind }]`,
  within `radius` metres (max 60), unsorted.
- Quality tiers scale flora ranges (0.42 / 0.82 / 1.0) and the terrain split factor; tier 0
  also draws no full trees and 55 % of the undergrowth.

## Gallery URL parameters (C13)

`gallery.html?body=earth&biome=temperate_forest&quality=1&cam=vista&ui=0&t=0`
- `cam`: `vista` (the kept easel of the biome), `stream`, `trees`, `canopy`, `jet` (30 m up),
  `high` (420 m), `orbit`; `time=` hours (default 12, or the biome's `hour`)
- `t=0` freezes wind and drift (deterministic frames); `ui=0` hides the panel
- `view=1..5`: scene colour, wetness, normal + depth, regions, abstraction
- `dx, dy, dz` (metres), `yaw`, `pitch` (degrees) nudge the camera; `scale`, `fov`, `models=1`,
  `physics=1`, `look=pooling:1,granulation:1,wobble:2.6,graphite:0.4,border:1,abstraction:1,bleed:0.8`
- weather: `wx=fair|overcast|rain|storm|after|blizzard|snow|dust|fog` or `sky=cloud:0.9,..`
  force the sky numbers; `physics=1&wtime=<s>&pre=<s>` runs PHYSICS at that time on its clock
  after a pre-roll (the Earth spawn's thunderstorm is 640 to 800 s; `skye.mjs` finds others);
  `fresh=1` fresh snow already lying; `kits=0` no rain, snow, dust or marks; `models=1` with
  `walk=<m/s>` (the explorer walks in during the pre-roll), `mdist=`, `sdist=`, `hover=<m>`,
  `wash=<newtons>` (the ship's downwash), `push=0` (nothing pushes the grass)
- models (`models=1`): explorer `pose=idle|walk|jet|fall|wade|sit`, `speed=`, `phase=` (radians
  of the stride), `jet=`, `lift=<m>`, `mface=<deg>` (turned to the right of the view; 0 shows
  its back), `epitch=`; ship `smode=landed|hover|fly|pulse`, `gear=`, `canopy=`, `throttle=`,
  `sface=<deg>`; `cockpit=1` the view from the ship's seat (fov 62, near 0.12 m);
  `near=0` hides the near ground strokes
- space: `cam=orbit&odist=<radii>` (how far out, default 2.6), `chase=1` (the ship ahead of
  the camera, flying where it looks; `cdist=`, `cdown=`, `cside=`), `smode=pulse` (streaks),
  `speed01=<0..1>` (the mood's speed); lightning: `wx=storm&sky=flash:1`
- `window.__pcReady` once terrain and flora have settled and three frames are painted (and,
  with `physics=1`, once PHYSICS and its kits are loaded);
  `window.__pcVantage` the easel in use.

## Decisions

- **Colour model**: every scene colour is the transmittance of a wash over paper; layering
  multiplies; the sheet pass multiplies by the paper colour.
- **Pipeline**: scene MRT -> half-res prep -> abstraction (mip Kuwahara, wet-in-wet bleed) ->
  sheet (wobble, pooling, granulation, graphite, ragged border, paper). Only the paper is
  anchored to the screen.
- **Marks are 3D** (this pass): anything laid on the ground or on rock comes from noise
  anchored to the planet in three dimensions; the 2D stroke atlas is kept for bark (along the
  trunk) and for the crack network (looked up through a warp).
- **Form may be baked**: slip faces, cliff faces, cut banks and the undersides of cliff lips
  carry a second, cooler wash in the vertex colour, so landforms read at noon as well as in
  raking light. Strata are computed in the shader from the height.
- **Terrain**: cube-sphere quadtree, 32 x 32 patches, geomorph, skirts, resumable generation;
  patches holding much relief for their size split from further away.
- **Biomes**: hand-placed sites (Earth, Mars, Saturn, Jupiter) or a jittered Fibonacci sphere,
  warped Voronoi, about 280 m blends; liquid keeps its true level inside its group.
- **The easel is data**: found by search, looked at, kept (`src/art/easels.js`); the same
  spots are the game's vistas.
- **Time of day**: light keys blend by the sun's elevation at the camera; a biome's `twilight`
  moves the day key toward dusk and night (ring shadow, storm wall, shadowed craters).

## Ideas and critique

- (self, blunt) The gallery frames are chosen views. In the game the explorer faces wherever
  the ship was parked, so a biome's picture depends on PILOT's camera; see "Needs".
- (self) Foregrounds are still the weak half of most frames: one broad wash with a few marks.
  The next thing to paint is near ground: stones, tufts, cast shadows of the tall kits.
- (self) Tall rock kits (spires, crystals, waves) are single smooth forms with one wash each;
  up close their tone steps are soft but they have no crevices. Frozen waves still read as
  mounds from behind.
- (self) Distant cliffs lose their local colour to the cool haze on the warm-skied planets
  (Jupiter's islands and storm wall go grey-green); the haze should lean toward each sky.
- (to PILOT) The third-person camera looks at the ship from wherever the explorer lands. A
  landscape wants the explorer small in the lower third and the land ahead: if the camera sat
  a little higher and looked past the explorer toward the open side, every arrival would be a
  better picture.
- (to PHYSICS) Grass at 47 degrees in a breeze is too much for a painting: a field that
  leans that far reads as flattened. I will scale the bend I draw (not your model) in M3.

## Tests

`node --test src/world/*.test.mjs`: 19 tests: the 12 of M1 (noise, cube-sphere, biome coverage,
`sampleSurface` purity, Earth spawn, liquid, vistas, patch edges, mesh and sample agreement,
ceiling, flora determinism, obstacles), and new: every planet's arrival place is level and
dry with room for the ship; `sampleSurface` under 0.05 ms a call on every body; every kept
easel stands on dry ground of its own biome and is that biome's first vista; every vista is a place a walker can stand; `world.busy`
reaches 0 at the spawn, after every change of body and in deep space; jobs of a body just left
are dropped at once; the heaviest frame of an arrival fits the building slice.

## Earlier answers (first PAINTER agent, M1; kept for the record)

- Lead review 1, MUST FIX 1 to 3 (frame cost, stippled foliage, ruler-straight lines): fixed in
  `b2bfcae`, closed by lead review 2. Every tree is submitted once in the tier its distance
  puts it in (near about 650 triangles, mid about 180, far 26); crowns are a few overlapping
  washes; trunks lean and bend; the brook's bank wanders; trees stand in clumps.
- PHYSICS wiring of the flora field: done in `1e1801e` (`world.setPhysics`; undergrowth uses
  the full bend, bushes and near trees the lite one). `FLORA_PHYS` (plant height and stiffness
  per kit) is exported from `src/world/florakit.js`.
- PILOT: `hatch` is on the ground 2.3 m left of the ship's centre line, `seat` at
  (0, 1.75, -1.3); `sampleObstacles` shares the placement cells with the painted flora.

---

## Hand-over: THE SIX TREES AND THE TURN OF THE YEAR (2026-11-19)

The owner was shown ten tree shapes drawn flat (`tools/treevariants.mjs`; the sheet is
`docs/shots/trees/ten_looks.png` on `r2`) and answered: "Yes do 12374 and the widow 6 but refine them a little
better and make sure the leaves change colors from summer to autumn for the forest". Six trees, refined, built,
planted; and the wood turns.

### `src/world/kits/grove.js` — one grammar, six rows of numbers

`roundmaple`, `poplar`, `oak`, `birch`, `willow`, `sapling`. A seventh tree costs a row of numbers, not a file, and
a fault mended once is mended in all six. **Read the file's own header before changing any of it**: it lists the
five rules the grammar exists to keep and what each one looked like when it was broken.

The one worth repeating here, because it was the whole of the owner's complaint: **a limb ends where it divides.**
Drawing a limb to its full length and then hanging its children partway along leaves the last third of every limb
sticking out past the fork with nothing on it. That is the bare grey spider leg. Nothing else about thinness,
colour or count mattered next to it.

### Three faults, and how each was found — the part worth carrying forward

- **The leaf floor, not `leafN`, decided a tree's cost.** A cluster has a floor of a few leaves or it is not a
  cluster, and the willow grows four places to hang them down every hanging twig. On that tree the floor bound, so
  cutting `leafN` by a fifth changed the triangle count *not at all*: 22016 before and after. **Found by measuring.**
  A knob that does nothing looks exactly like a knob that is set right.
- **Every number written by hand for the camera's crown table was wrong**, the oak's widest radius by a quarter of
  its height. Those numbers keep the lens out of a crown, so wrong ones are the 18 Nov fault again with numbers in
  it instead of nothing. **Found by measuring.** A number you wrote is not a measurement.
- **The family accent (`fam`, the maple's reds) was not seasonal**, so the first summer still showed red crowns in
  a green wood; and the forest floor's two dresses sit in the base look data, so the live watercolour game would
  have begun turning its seasons. **Found by looking**, both of them, in the first still ever drawn of it.

Measuring and looking find different kinds of fault and neither one substitutes for the other. The thinning that
fixed the first fault stripped the willow's curtains to bare wires — which only a picture could say.

### `src/data/season.js` — the year

`SEASON.t` runs 0 (high summer) to 1 (deep autumn) and back, over 720 seconds of play by default. A leaf's colour
was **already** a uniform (`uLeafA`, `uLeafB`, `uLeafC`, and the far trees' arrays), so the whole feature is three
vectors written per material when the season moves: no define, no recompile, no second set of meshes, nothing per
pixel and nothing per leaf. `?season=0.6` stands the year still; `?year=240` changes how long a turn takes;
`?year=0` stops it.

A plant turns only if its look data gives it **both** dresses, `leafSum` and `leafAut`. The spruce and the pines
are given one, because a conifer does not turn. Every world but Earth's forest has one dress and costs nothing.

All of it is behind `LOOK.oil`.

### What has NOT been seen

The six have been seen flat-filled in Node, and the wood has been seen in the gallery at both ends of the year.
Nothing has been seen **in motion**, nothing on a real graphics card, and no device has timed them. The willow is
the one to watch: it is the costliest of the six and it is the one whose look suffered most when its leaves were
thinned.
