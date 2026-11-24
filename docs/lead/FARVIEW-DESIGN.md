# THE VIEW FROM THE AIR TO A MILE: design (group C)

Written by a design agent of the coordinator's workflow on 24 Nov (look-proto = main at v37), from the owner's v37 speed test and counts in Node. Kept verbatim; the coordinator's split into lanes is at the end.

## Findings

WHAT WAS LOOKED AT. Clean export of look-proto HEAD 9c738ba (v37) in /home/user/.pc-scratch/design/far/tree, the painter's gallery, Earth, 15:40, summer (SEASON.t 0, the game's own start). Fourteen stills taken and opened. Phone size is 936x372, tier 1, lighter paint, no edge filter. Desktop is 1280x720, tier 2, full paint. Work was counted with a copy of tools/overdraw.mjs pointed at the export, at the phone's picture and tier 1, with extra views at 150, 400 and 1000 m (/home/user/.pc-scratch/design/far/tools/od.mjs, output od_phone.txt).

THE AIR AND THE SKY: AT A KILOMETRE UP THE GAME DRAWS SPACE. Seen in aw_1000_45_phone.png: black sky with stars at 15:40 and a small ball of land.
- world/index.js measures air01 and space01 from the land under the eye (MTN_AIR). Both are smoothstep(alt, 0.55*800, 1.15*800), so they run from 440 m to 920 m over the land.
- Above 920 m: uFog.z goes to 0.1 and 40 km is added to the visibility. Derived: about 0.016 of haze even at the horizon. The sky's uAtmo.x is 1, the grade goes white, and the land has no aerial perspective.
- The cloud shell (orbit.js, a sphere 236 m above sea level, so BELOW the eye) fades in from 480 m above sea level. Seen as flat paper-white cut-outs over the wood in aw_1000_down_phone.png. Counted at 254k to 348k fragments at 1 km.
- At 150 to 400 m the haze is (derived from pcFogAmount: visibility 2,572 to 2,600 m, dist*2.4, ten bands): 0.39 at 500 m, 0.60 at 1 km, 0.79 at a mile.
- The sky by day at this hour is one flat cream band in every still.

TREES.
Where each tier stops (flora.js update, counted in Node):
- PHONE: treeScale is 0.30, so full trees reach 27 m and middle trees 57 m. farScale is 0.469 on foot (far trees to 281 m), 1.313 at 150 m (788 m) and 1.5 from 220 m up (900 m). Each tree varies ±15% and fades from 0.88 of its range (uLod.w).
- DESKTOP (1080 lines): farScale 2.0 in the air, so 1,200 m.
- These ranges are 3D distance. So 1 km up on the phone NO tree is drawn at all: seen in aw_1000_45_phone.png, and counted as 0 far-tree fragments at 1000 m. On the desktop only a disc about 660 m across stands under the eye.
What the trees look like from the air:
- The far card tree is built for side views. From 150 to 400 m its crowns are 3 to 5 px dark specks. The floor shows between them over about half the wood, even though the placer's density works out to about 0.023 trees per square metre with crowns about 12 m across (from TREE_LEVEL 7, a 9x9 grid, 2 candidates per cell, keep 0.62*(0.14+0.86*clump)): a closed canopy on paper.
- Seen in aw_150_45, aw_400_45 and aw_400_down: dark green crowns with lime flecks and black conifer spikes on a loud yellow and orange leaf-dab floor. Pepper on mustard.
Past the far trees:
- The ground's far colour takes over (TERRAIN_FRAG: c = mix(vCol2, vCol, gMid), gMid fading over 120 to 420 m). vCol2 is surface.js _forest r2/g2/b2: canopyA/canopyB from the autumn oil.pal (0.98,0.86,0.30 / 0.94,0.62,0.24), painted in the leaf dabs.
- Seen in aw_400_45 at the top of the frame and in aw_1000_down: a collage of gold, orange and red leaf shapes, about 10 to 20 px from the air because pcStrokeOct4 grows strokes 1.7x when visibility exceeds 1,500 m. No crowns, no gaps, no shadows, no groves.
- The ground does NOT follow the year. Only plant uniforms do (flora.js setSeason). So in summer, green trees stand on an autumn floor and an autumn far forest (seen).
- The terrain mesh cannot carry crowns in its vertex colours. On the phone splitK is 0.784, so a cell is d/25 to d/12.5: 40 to 80 m at 1 km. Canopy structure has to be made per pixel.
Cost from the air (counted at 400 m, 45°):
- 46,857 far trees, 6.47M triangles in 98 meshes, against 0.88M on foot. 488,618 fragments rasterised, 201,859 left after an early depth test.
- The table's "far trees as lumps -17.0 ms" removed about 713k triangles on foot. If that is triangle cost, it is about 24 ns a triangle, which would put the far tier alone near 155 ms at 400 m. If it is fill cost, it is far less. NOT SETTLED.

ROCKS.
- Boulder props live in the undergrowth cells (floraplace.js U_ROCK) to UNDER_FAR*0.6, about 66 m at tier 1. The cells are wanted within about 100 m of the eye in 3D. The near-ground rings stop above 45, 90, 200 and 220 m of height. So from the air there are no boulders at all.
- Cliffs and peaks are only the ground shader. Seen in alp_400_30_phone and alp_400_30_desk: faceted, a lilac, violet, green and cream mosaic, no lit and shaded planes, snow only as pale tips.
- Why:
  - the alpine 'patch' fields (green at 48 m wavelength, pale at 20 m: earth.js oil.over.t.patch) mottle the steep faces too;
  - every dab takes its own random density and hue (pcGroundPaint), and its light from its own centre's normal;
  - strata (t.strata 0.55) are not painted in the oil look (the oil TERRAIN_FRAG has no strata branch);
  - the coarse mesh on the phone shows as facets;
  - snow is laid by height and noise only (surface.js _generic: snowline 560), not by slope.
- Sea stacks at the coast read as faceted ochre lumps, and the water meets their cliffs with no line (coast_400_45b_phone).

WATER.
- A water mesh exists only on patches at level 5 or finer, or more than 8% wet (patchgen.js). Rivers from the air are drawn into the far colour in blue (0.42, 0.62, 0.86), as wide as the sample spacing (S.foot). Seen readable at 400 m and 1 km.
- The strokes are pcThinLayer at a size held in pixels (pcStrokeOct), so they never turn to confetti. But still water lays every dash along the ground chart's own axis: the wetland's ponds read as sheets of corrugated metal (wet_150_45_phone). The wood's river pool is a concentric whirlpool target in every wood still. The sea is uniform rows of dashes with faint straight seams (coast_400_45_phone).
- No shore line or wet margin is drawn at any distance.
- The sun's path is a pow-56 lobe plus per-dash sun marks: a narrow glint, not a widening glitter path. No glint was seen in any still; the sun was not ahead in any of the views.
- The bench view has NO water in it (counted: 0 water fragments on foot). So the table's "no water -0.6 ms" is draw calls only, and the water's cost per pixel on the phone is unmeasured.

GRASS.
- Tufts reach 15 m and the undergrowth cells about 36 m at tier 1. The near-ground rings reach 12 m (fine), 40 m (mid), no far ring at tier 1, and 190 m (vista), and all of them stop above 220 m of height.
- From the air the meadow is only the ground's leaf dabs on the vertex colour (grassLight is a lemon 0.84,0.87,0.32). Seen as yellow-green confetti in the glades, camouflage on the alpine faces, and at 1 km a carpet of giant leaves.
- On the phone the dab is 3.1 px (dabPx), so gVar keeps only about 0.22 of the floor's variety past 420 m.

THE GROUND'S COST, AND WHY THE TABLE CANNOT PRICE AN AIR VIEW. Row "no ground drawn" is -4.8 ms on foot. Counted on foot at 936x372: 312,155 ground fragments rasterised, 90,373 left after early depth in three's order, 356,352 triangles.
- So the ground costs at most 4.8 ms / 90,373 = 53 ns a shaded pixel, if all of it is pixel work.
- From the air at 400 m, 45°: 319,772 shaded ground pixels (3.5x) and 178,176 triangles (half).
- So the whole ground in an air view costs between about 2.4 ms (if the 4.8 ms were triangle work) and about 17 ms (if it were pixel work).
- RULE USED BELOW: a change adding x% to the ground's per-pixel work costs at most x% of 4.8 ms on foot and at most x% of 17 ms in the air.

TWO PROTOTYPES, scratch export only (diff at /home/user/.pc-scratch/design/far/proto.diff, nothing committed):
(1) ?airtop=1 raises the air, space and cloud-deck ramps 4x and lets visibility keep growing above 160 m. SEEN at 1 km (proto2_aw_1000_45_phone): the sky stays a sky, no stars, no cloud cut-outs, haze toward the horizon, the peaks readable.
(2) A canopy layer in TERRAIN_FRAG: a jittered 8 m grid of crown discs, each with a lit cap toward the sun and a shadow slid away from it, gaps in deep shade, fading to its mean colour under about 5 px.
- First try in the floor's autumn colour (proto_aw_400_45): rusty, mauve gaps, striped. Rejected.
- Second try in the season's greens with a grove noise (proto2_aw_400_45, proto2_aw_1000_45): SEEN that the wood reads as one continuous forest from 400 m and from 1 km. The 3D trees sink into it, the end of the far trees on the hill no longer shows, and the glades become crisp yellow clearings.
- Still wrong: flat olive felt far off, blocky dark blots where crowns are 3 to 5 px, diagonal shadow streaks near.

INTERFACE OFFERED TO THE TREE LANE.
(a) The far trees' range must be at least hypot(height, 1.5 km); today it is 900 m on the phone and 1,200 m on the desktop.
(b) The ground paints the canopy under and beyond them, in the far trees' own colour uniforms (season included) and the same sun.
(c) Seen from steeply above (depression over about 25°), past about 600 m, the 3D far tier can be thinned to one tree in two or three, because the ground carries the canopy. The 3D trees then supply relief and the skylines where the view grazes.

## Packages

### FV1: The sky stays a sky to a mile and beyond (air top)

**Change:** src/world/index.js world.update: in the oil look on worlds with an atmosphere, a look-level dial oil.airTop (Earth 4; the prototype uses one multiplier) scales four things:
- the ramp of air01 and space01 (smoothstep(alt, 0.55*atmH*k, 1.15*atmH*k)), Earth from 440-920 m to 1,760-3,680 m over the land;
- the cloud deck's a01 (atmosphereHeight*0.6*k .. 1.6*k);
- the relief rounding uRound (start at 0.6 R instead of 0.35 R, so peaks do not shrink while climbing past 1.4 km);
- the visibility, which keeps growing above 160 m: +1.2 m for each metre up to +1,640 m, so 3,600 m at 1 km and 4,500 m at 1.8 km.
Also: src/data/looks/earth.js (the dial), and the prototype's lines in /home/user/.pc-scratch/design/far/proto.diff. bodies.js atmosphereHeight is NOT touched (physics contract).

**Files:** src/world/index.js, src/data/looks/earth.js

**Phone cost:** ON FOOT: 0.0 ms. Only uniform VALUES change, and with the eye under 160 m every number is identical (smoothstep(2, 1760, 3680) = 0, as smoothstep(2, 440, 920) = 0).
FROM 1 TO 2 KM: a SAVING. The cloud shell stops being drawn below about 1.9 km over sea level; it was counted at 254k-348k fragments at 1 km at the phone's picture. Its milliseconds are unmeasured.
Confirm: FV7's air table at 1 km, ?airtop=1 against ?airtop=0.

**Look:** Near: nothing changes under 160 m.
From 400 m to 2 km: blue or cream sky instead of a midday starfield; no paper-white cloud cut-outs over the wood; the land a mile off keeps about 35-40% of its own paint, with the horizon still going back into the air (derived haze 0.61 at the centre of a 45° view from 1 km, 0.86 at the horizon).
SEEN in prototype at 1 km, phone (proto_aw_1000_45_phone, proto2_aw_1000_45_phone, against aw_1000_45_phone).
Judge at: autumn wood 1 km at 45° and straight down; alpine 1.5 km toward the peaks; a climb sequence at 0.4 / 1 / 1.6 / 2.5 / 4 km to see the turn to space happen once and smoothly; phone and desktop.

**Risk:** Everything that reads lighting.space01 now turns at a higher altitude: ring visibility, aurora, night key, leaf fall, SHEET.grade. The ship's climb to orbit feels the space look arrive later.
Other air worlds must be checked one by one (Venus's 900 m air, Neptune's), which is why it is a per-look dial.
Whether a cloud layer below the eye is wanted in the air look is an art decision: today's clouds are flat white shapes.

**Switch:** ?airtop=0|1|k (the oil look only; the watercolour game keeps MTN_AIR's numbers). Becomes the default once the climb sequence is seen.

### FV2: The canopy painted into the ground: the forest under and beyond the far trees

**Change:** src/render/materials.js TERRAIN_FRAG (oil main): a canopy layer laid FIRST. Where it covers whole, the two leaf-dab layers and the bare wash under it are not worked out at all (the floor's own 'laid from the top down' rule).
Where it is on:
- the stand's density vPar.z (closed canopy) is over about 0.3;
- the eye looks DOWN on that point by more than a few degrees: -dot(normalize(vRel), up) over about 0.08;
- the point lies at least about 20 m below the eye (vertical drop); you see crowns from above only if you are above them, so walking in the wood or looking along it, it is off;
- the distance is past the near trees' hand-over plus a margin (a uniform from flora.js: T1*treeScale + 30 m).
What it paints:
- a jittered 8 m grid in the ground's own chart (pcGroundChart). Only the 4 nearest cells are tried, with an arithmetic hash and no texture.
- crowns 9-15 m across (matching FAR_DIMS times the placer's mean scale), about 85% cover under a closed stand;
- each crown a lit cap: a disc slid toward the sun, not a half-plane (the half-plane striped in prototype 1). The rest of the crown is its shade, and it lies in the shadow of its neighbour slid away from uSunDirL by crown height times cot(sun height);
- gaps in deep under-canopy shade: green-umber in summer, umber-violet in autumn, never mauve;
- colours from NEW uniforms that are the far trees' own: uCanA/B/C + uCanFam (the stand's broadleaf kind) and uCanCon (its conifer), written by flora.js setSeason beside uFarA/B/C. So the painted crowns and the 3D crowns are the same colour at every moment of the year;
- each crown its own place in the family run (yellow, orange, red in autumn; greens of several values in summer);
- groves from one uNoise3D read at about 90 m, plus a new per-vertex conifer share (patchgen.js/surface.js: a new 4-byte attribute aFar.x, and aFarP for the morph) taken from the placer's own birch/tallMix numbers;
- three tones from ONE pcTone pass on the stand colour, with per-crown multipliers;
- a prefilter on the crown's size in pixels: crown shadows go to their mean under about 6 px, crowns under about 4 px, so nothing is ever a speckle and far off the forest is its mean lit and shaded by the hill (the land's own normal).
Interface with the tree lane (flora.js, theirs to build): the far range is at least hypot(height, 1.5 km); from steeply above, past about 600 m, the 3D tier may be thinned to one in two or three.
Prototype: /home/user/.pc-scratch/design/far/proto.diff.

**Files:** src/render/materials.js, src/render/chunks.js, src/world/flora.js, src/world/terrain.js, src/world/patchgen.js, src/world/surface.js, src/render/shared.js

**Phone cost:** ON FOOT (the bench's view): the steepness and drop gates fail on nearly every pixel. What is left is about 8 ALU for the gate test, about 1% of the ground: at most 0.05 ms (1% of 4.8 ms).
FROM THE AIR OVER A WOOD: a SAVING.
- Under closed canopy one canopy evaluation (4 hashes, 4 disc and shadow tests, one pcTone pass, one noise read: about 150-270 ALU and 1 texture read) replaces 2 dab layers plus pcGroundAt, pcGroundPaint and the bare wash (about 700 ALU and 10-14 texture reads). So about a third of the cost; estimated from the GLSL's operation counts, NOT measured.
- If about 60% of an air view's ground pixels lie under closed canopy (the prototype stills look like that; not counted), the ground there gets about 40% cheaper: 40% of 2.4-17 ms = 1 to 7 ms saved.
- It also lets the tree lane thin the 3D far tier from above, worth far more if the far tier is triangle-bound: 6.47M triangles at 400 m counted, about 24 ns a triangle by the lumps row. Theirs to measure.
Confirm: FV7's air table rows 'as set', 'canopy painted off' (?canopy=0), 'ground one flat colour' (B({flat:1}), which bounds the ground's paint), and 'no ground drawn', at 400 m over the autumn wood.

**Look:** Near (under about 60-150 m, and every view from the ground): unchanged, because of the gates.
From 150 m to the horizon: a closed forest canopy of crowns with lit caps, shadows and dark gaps; groves of dark conifer among the broadleaves; glades as crisp bright clearings; the 3D far trees standing in it, not on a yellow floor; the end of the far trees no longer a line.
Past about 1.5 km on the phone (crowns about 3 px; 1 km is 4.3 px, derived from 2.8 mrad a pixel at 372 lines): the forest's lit and shaded masses by grove and hill.
The forest appears with the ground's patches, not when far cells finish building, so it is THERE before a fast flight arrives.
SEEN in prototype 2 at 400 m and 1 km on the phone (proto2_aw_400_45_phone, proto2_aw_1000_45_phone, and the crops against aw_400_45_phone_crop / cropfar).
Judge at: autumn wood 150 / 400 / 1000 m at 45° and 400 m straight down, at season 0 and 1; the green wood; the alpine conifers; the ground guards: the wood at the stream (cam=stream), on foot looking downhill through trunks, and a hilltop looking down into the wood; phone and desktop; and a flight video, because crowns at 3-5 px can shimmer in motion (the prefilter is meant for it, not yet seen).

**Risk:** Painted crowns flat on the ground under real crowns can read as stickers near the gate's edges (the drop and distance ramps hide this; to be seen).
A mismatch of statistics with the tree lane's new far impostors (crown size from above, colour mean, shadow share) would show as a band where the 3D trees fade at 0.88-1.0 of their range.
At 3-5 px crowns can alias in motion.
One new vertex attribute (8 bytes a vertex with its parent copy) and one varying.
The ground's dab-layer skip is a branch: at canopy edges both run (+40% on those pixels).

**Switch:** ?canopy=0|1 (default 1 once judged); ?canopyk=<m> the crown spacing; the oil look only.

### FV2-T: For the tree lane: the far trees reach what the eye needs from the air (interface, not this lane's build)

**Change:** src/world/flora.js update():
- farScale today tops out at 1.5 on the phone and 2.0 on the desktop, so 900 / 1,200 m in 3D, and 1 km up nothing is drawn. The range in 3D becomes at least hypot(SHADOW.alt, R_h), with R_h the tree designer's far reach (1.5-2 km), capped by the horizon distance sqrt(2 R h + h²).
- With FV2 under them: from views steeper than about 25° depression and beyond about 600 m, keep one far tree in two or three (the seed already ordered for thinning, see _retier's note). The ground carries the canopy, and the 3D trees give relief and the grazing skylines, where all are kept.
- The impostor's crown seen from above should cover about its FAR_DIMS width. Today's card tree shows 3-5 px specks from above: seen in aw_400_down_phone.

**Files:** src/world/flora.js, src/world/florakit.js

**Phone cost:** The tree lane's to derive. What this lane can give:
- the counts from the air: 46,857 far trees, 6.47M triangles, 98 calls at 400 m, 45°, phone tier 1 (counted);
- the on-foot reference: 6,370 trees, 0.879M triangles;
- the table's lumps row: -17.0 ms for about 713k fewer triangles, so at most about 24 ns a far-tree triangle if it is triangle-bound.
Thinning to a third from steep views would remove about 4.3M of the 6.47M triangles at 400 m.
Confirm: FV7's 'no far trees' and 'far trees one flat colour' rows in the air.

**Look:** Trees where today there are none: 1 km up on the phone. Silhouettes and relief on ridges and skylines. The thinned 3D trees invisible against FV2's canopy from above (to be seen: phone and desktop, 400 m and 1 km, straight down and 45°).

**Risk:** Range growth adds instances at a grazing view: the area grows with the square of the range. Thinning only works if FV2 ships first.

**Switch:** the tree lane's own; FV2's ?canopy=0 must turn the thinning off with it.

### FV3: The floor and the far colour follow the year

**Change:** src/render/materials.js TERRAIN_FRAG and src/world/flora.js setSeason:
- the fallen-leaf share under trees (fk, uGroundK.w) is scaled by the season: about a quarter of it in high summer, all of it in autumn;
- the litter's colour (the 'leaf' out of pcGroundAt, today the autumn canopy wash) mixes toward a summer litter of brown and olive by the same uniform;
- where FV2's canopy does not cover (glade edges, beyond the canopy's gates), the far colour vCol2 of a wood is mixed toward the stand's summer crown colour by (1 - SEASON.t).
One vec4 uniform on the terrain material (uSeasonG: the summer litter and canopy tint, a = 1 - t), written where the far trees' colours are written.

**Files:** src/render/materials.js, src/world/flora.js, src/world/terrain.js

**Phone cost:** Uniform values plus about 6 ALU a dab: about 1% of the ground. At most 0.05 ms on foot (1% of 4.8 ms) and 0.17 ms in the air (1% of 17 ms).
Confirm: the bench's existing 'as set' at season=0 and season=1 (?season=); no new row needed.

**Look:** Near: in summer the floor under trees is green and brown with a few leaves, not a gold carpet under green crowns. In autumn it is exactly today's.
Far: in summer a wood seen from 400 m is green under its green crowns, where today it is a gold floor with green specks (seen in aw_400_down_phone).
Judge at: the wood on foot (cam=stream) and at 400 m, at season 0, 0.5 and 1, phone.

**Risk:** The owner approved the autumn floor (the clip's carpet of leaves). Autumn must stay identical: test season=1 against today's still pixel for pixel. The meadow's lemon is not touched here (FV6).

**Switch:** ?groundseason=0|1

### FV4: Rock faces, strata and snow that read from afar

**Change:** The rock (TERRAIN_FRAG oil main, src/render/chunks.js pcDabLayer/pcDabHit):
- on steep ground (the dab centre's pcUp under about 0.75, about 41°) the dabs are laid along the contour: a new field angle, the contour tangent from the dab's own normal carried into the chart with pcGroundChartD, plus a small jitter from the baked turn P.z; elongated (asp about 2.6);
- they take two rock tones by height band: the band index from the dab centre's height over about 41 m with a hash, no noise read, so the lighter paint keeps its no-noise rule; this carries strata into the oil look;
- their light comes from the face in flatter planes (pcLevel with a smaller soft on steep rock), so a far face is lit planes and shaded planes, not a mosaic;
- the per-dab hue stray (pcGroundPaint's rnd tint) is halved on rock.
src/world/surface.js _generic: the biome's 'patch' colour fields (alpine green and pale) are faded out on slopes over about 30°, which ends the camouflage on cliffs.
Snow:
- the snow fraction is packed per vertex (FV2's aFar.z);
- the shader sheds it from faces steeper than about 50° and keeps it on ledges and in gullies, by the dab centre's slope;
- result: white ledges and dark rock ribs, the snow the lightest thing in the picture (the references' Sohlberg rule already in earth.js).

**Files:** src/render/materials.js, src/render/chunks.js, src/world/surface.js, src/world/patchgen.js

**Phone cost:** About +20 ALU a steep pixel and no new texture read (the angle replaces the baked turn's cos and sin; the band is a hash): about 3-4% of the ground's per-pixel work on steep pixels only.
- On foot in the wood (few steep pixels): at most 0.1 ms.
- An alpine air view (about half the ground steep): at most 4% of 17 ms, about 0.7 ms.
The contour strokes stay inside the same dab loop, with no second branch, so neighbouring pixels on the same 64-pixel wave do not run both.
Confirm: FV7's air table taken at the alpine meadow, ?rockfield=0 against 1.

**Look:** Near: rock dabs lie in courses along the face instead of every way; a boulder under 20 m keeps today's look.
Far: a mountain at 400 m-2 km reads as buttresses of lit warm rock and cool shaded rock in horizontal beds, snow on ledges, turf only on the gentle ground, instead of the lilac and green mosaic seen in alp_400_30_phone / _desk.
Judge at: alpine 400 m above the land at 30° toward the peaks, and 1 km; coast cliffs and sea stacks at 400 m facing the land (coast_400_45b_phone); the canyon at 300 m; phone and desktop; the alpine on foot (cam=vista) as the near guard.

**Risk:** Contour strokes on a facet edge of the coarse phone mesh may step at the facet; seen only after building.
The snow by slope changes the alpine's snow area: the lightest-thing rule must still hold.
The faceting of far silhouettes on the phone (splitK 0.784) is not fixed here: it is triangle count, unpriced.

**Switch:** ?rockfield=0|1

### FV5: Water from the air: still water laid along its shores, the shore line, the glitter path, the current far off

**Change:** Still water:
- src/world/patchgen.js packs, for still water, the shore tangent (from the depth grid it already holds: the gradient of wdep) into the water's spare aTurb.zw;
- WATER_FRAG turns the dash chart to it, exactly as it already turns the chart for a current; in a lake's open middle (depth well over the dash length) it eases to the wind's direction;
- ponds then read as water rings round their own banks, not corrugated sheets.
The pool's whirl: src/world/surface.js _riversOil gives a pool the reach's own smoothed direction at low speed, not a loop (the target in every wood still; cause still to be traced).
The shore line:
- in WATER_FRAG, within about 1.5 px of the edge (vDep against fwidth(vDep)), a thin light line on banks facing away from the eye and a dark one on near banks;
- on the land side the far colour's wet margin is widened by S.foot as the river line already is (surface.js).
The glitter: the sun's lobe exponent goes from 56 near toward about 14 far and on rough water, so a looked-at sea carries a widening path of broken light.
The current far off: on running water (the speed byte vTurb.x) the share of long pale dashes along the flow rises with distance (still sized in pixels), so the current is visible from 400 m.
The sea's faint straight seams (coast_400_45_phone) are NOT addressed: cause not traced.

**Files:** src/world/patchgen.js, src/world/surface.js, src/render/materials.js

**Phone cost:** About +25 ALU a water pixel and no texture read. The water's per-pixel cost on the phone is UNMEASURED: the bench view holds 0 water pixels (counted), and its -0.6 ms is draw calls.
Using the ground's bound (at most 53 ns a pixel) as a stand-in, with +5% of a water shader of about the ground's size:
- over the wood at 400 m (35,136-47,855 water fragments counted): at most 0.15 ms;
- over the coast (the sea about 70% of the picture in coast_400_45_phone, not counted): at most 0.8 ms.
Confirm: FV7's air table at the coast: 'no water drawn' and ?waterfar=0 against 1.

**Look:** Near: a pond's dashes follow its bank; a bright or dark hairline at every waterline; the river at your feet unchanged.
Far: lakes, the river and the sea read by their shores and by a path of light toward the sun; rapids and the current as pale streaks; no whirlpool target in a quiet pool.
Judge at: wetland 150 m at 45° (wet_150_45_phone is the before); autumn wood 400 m at 45° (the pool); coast 400 m facing the sea with the sun AHEAD (a new view; no still taken here had the sun ahead); phone and desktop.

**Risk:** The shore tangent read from a coarse patch's depth grid is noisy at a 1-cell inlet; dashes may swirl there. The light or dark choice of the shore line flips with the view, so it must be judged in motion.

**Switch:** ?waterfar=0|1 (sub-dials ?wshore=, ?wglint=)

### FV6: Meadows from the air: colour fields from the land, flower drifts, grass strokes with the wind, the wind's sheen

**Change:** (a) Colour fields from the land's form. src/world/patchgen.js already holds each patch's height grid; it computes a cheap concavity and aspect per vertex and folds them into the vertex wash on grassland: hollows deeper and cooler green, knolls and sun-facing slopes toward a golden dry grass, wet margins by water deeper still. Flat areas with clean edges, painted by the land, instead of per-dab confetti.
(b) Flower drifts:
- the flora designer's flower-density field (the one their placer uses) is evaluated per vertex into FV2's aFar.y;
- TERRAIN_FRAG lays that share of dabs in the biome's flower colours (a small uniform palette per biome);
- so drifts of purple, yellow and white show from the air exactly where the near flowers stand, and past a dab of about 3 px they tint the meadow's mean colour.
(c) Grass strokes:
- on open grass (canopy under 0.2, not rock) the dabs take FV4's field-angle path, turned to the wind (PHYSICS' wind at the eye) blended with the fall line on slopes;
- elongated (asp about 2), so a meadow is laid in directional brush strokes, not leaf shapes (the 1 km still's 'carpet of giant leaves').
(d) The wind's sheen: travelling bands, a sine of position along the wind minus the clock, broken by the grove noise FV2 already reads, that lift whole grass dabs one light step as they pass. The meadow is seen breathing from the air.
(e) On the phone the strokes' growth from the air (pcStrokeOct4's 1 + 0.7 * clamp) is held to about 1.3x, so strokes stay small; the desktop keeps 1.7x.

**Files:** src/world/patchgen.js, src/world/surface.js, src/render/materials.js, src/render/chunks.js, src/data/looks/earth.js

**Phone cost:** (a) 0 on the phone's GPU: vertex colour; a few operations per sample in the mesher, in the world's time slice.
(b) to (d): about +25 ALU an open-grass pixel and no new texture read (the noise is FV2's read, shared): about 4-5% of the ground's per-pixel work. At most 0.25 ms on foot (5% of 4.8 ms) and at most 0.85 ms in an open-meadow air view (5% of 17 ms).
(e) changes the stroke's size, not the number of operations: 0.
Confirm: the bench's on-foot table with ?meadow=0 against 1, and FV7's air table at the alpine meadow.

**Look:** Near: the near ground's strokes and tufts are the flora lane's; here the floor between them carries drifts of flower colour and directional grass strokes.
Far: from 150 m to a mile a meadow reads as fields: deeper hollows, golden knolls, drifts of flowers, strokes running with the wind, and moving bands of light when the wind blows. Not lemon confetti (aw_150_45 glades, alp_400_30 lower left).
Judge at: alpine meadow 150 m and 400 m at 45°; the autumn wood's glades at 400 m; the coast grassland; phone and desktop; a short flight for the sheen.

**Risk:** The flower field must be the flora lane's own function (a shared module), or the drifts and the real flowers will disagree. The sheen must not read as grain or flicker: whole dabs, one step, slow. The wind's field must be the same one the near grass bends to.

**Switch:** ?meadow=0|1 (sub-dials ?drifts=, ?sheen=, ?airstroke=)

### FV7: The speed test from the air (the instrument every air number here waits on)

**Change:** src/core/bench.js (PILOT's file): ?bench=air[,alt] lifts the explorer to 400 m (or alt) over the land, pitches the view 45° down and pins it there, as the on-foot test pins the walk.
Rows:
- as set;
- no ground drawn;
- ground one flat colour (B({flat: 1}): the mechanism is in TERRAIN_FRAG, uOilL.y 1, not in today's row list);
- no far trees; far trees one flat colour;
- canopy painted off (FV2); far tier thinned from above (FV2-T);
- no water drawn; waterfar off (FV5); meadow off (FV6); rockfield off (FV4); airtop off at 1 km (FV1);
- as set at 1 km.
The header names the place (wood, alpine or coast) and the height.

**Files:** src/core/bench.js, src/main.js

**Phone cost:** Adds nothing to play: it runs only under ?bench=air.
It is needed because the on-foot table cannot price an air view: on foot it saw 90,373 ground pixels, 0 water pixels and 0.88M far-tree triangles; at 400 m the same game draws 319,772 ground pixels, 35-48k water pixels and 6.47M far-tree triangles (counted). Every air-view millisecond in FV1-FV6 is a bound until this table comes back.

**Look:** None (an instrument).

**Risk:** The explorer must be held in the air without falling or drifting (the walk's pin restores the position each frame; flight must be pinned the same way). The far cells must have finished building before timing (the 'calm' rule already waits up to 40 s while nothing is drawn).

**Switch:** ?bench=air

## Not settled

NOTHING HERE IS MEASURED ON THE PHONE. Every milliseconds figure is derived from the v37 table, which was taken on foot, plus counts made in Node.
- The ground in an air view costs somewhere between about 2.4 and 17 ms. The table cannot say where, because 'no ground -4.8 ms' does not split triangle work from pixel work.
- The water's per-pixel cost is not measured at all: the bench view holds no water.
- The far trees from the air (6.47M triangles at 400 m, counted) may cost far more than the 89 ms bench frame, if the lumps row means about 24 ns a triangle. The air view's real frame rate on the phone is unknown, and may be well under 11 a second. Only FV7's air table can settle any of this.

THE CANOPY LAYER (FV2) IS SEEN ONLY AS A ROUGH PROTOTYPE:
- phone size, summer, 400 m and 1 km, two iterations;
- not at 150 m, not on the desktop, not in autumn, not in motion (shimmer of 3-5 px crowns while flying is the main unseen risk), and not from the ground (the gates are designed, not seen);
- its 'about a third of the dab layers' cost is from operation counts of the GLSL, not timed;
- what is left in it: flat olive felt far off, blocky dark blots in the 3-5 px band, diagonal shadow streaks near;
- the band where the tree lane's new impostors fade out (0.88 to 1.0 of their range) cannot be judged until those impostors exist.

DESIGNED BUT NOT PROTOTYPED: FV3 to FV6.
- They come from the code and from stills of today's state.
- The pool's whirlpool and the sea's straight seams were seen, but their causes were not traced in code.
- No still had the sun ahead, so today's glint was not seen at all.

FV1 RAISES THE SPACE RAMP. Its effects on other worlds and on the PILOT's space01 consumers (ring visibility, aurora, night key, leaf fall, grade, the climb to orbit) are not checked. Only Earth at 1 km was seen. Whether clouds below the eye belong in the air look is an art call for the owner.

THE COUNTS:
- The overdraw tool treats the cloud shell as opaque, so its 1 km ground counts understate what is shaded.
- The 60% canopy share of an air view's ground pixels is an estimate from the stills, not a count.

SEASONS: the seasonal mismatch was seen in summer stills only. The autumn variant was not shot.

THE MOUNTAINS: faceting of far silhouettes on the phone's coarse mesh is not addressed. It is triangle count, and unpriced.

AN EARLIER STILL: /home/user/.pc-scratch/design/far/stills/wood_150_45_phone.png was in the scratch folder from an earlier start of this same task. It shows the same view as aw_150_45_phone.png, but its exact settings are not known, so it is not used as evidence.


## Stills
Every still below was taken and opened in this run, at the phone's picture (936x372, tier 1, lighter paint) unless marked desk (1280x720, tier 2, full paint). All are Earth at 15:40 in summer, in /home/user/.pc-scratch/design/far/stills/.

Before (v37 as it is):
- aw_150_45_phone.png
- aw_400_45_phone.png
- aw_400_down_phone.png
- aw_1000_45_phone.png: space sky and stars at 1 km, no trees
- aw_1000_down_phone.png: leaf-litter collage, white cloud cut-outs
- alp_400_30_phone.png
- coast_400_45_phone.png: over the sea
- coast_400_45b_phone.png: facing the land
- wet_150_45_phone.png: corrugated ponds
- aw_400_45_desk.png
- alp_400_30_desk.png

Prototype (scratch only):
- proto_aw_400_45_phone.png: canopy v1, rejected
- proto_aw_1000_45_phone.png: airtop on, canopy v1
- proto2_aw_400_45_phone.png: canopy v2 in summer greens
- proto2_aw_1000_45_phone.png: canopy v2 and airtop

Crops (3x, nearest neighbour):
- aw_400_45_phone_crop.png
- proto_aw_400_45_phone_crop.png
- proto2_aw_400_45_phone_crop.png
- aw_400_45_phone_cropfar.png
- proto2_aw_400_45_phone_cropfar.png

Other files:
- Prototype diff: /home/user/.pc-scratch/design/far/proto.diff
- Counts: /home/user/.pc-scratch/design/far/tools/od_phone.txt
- Count tool: /home/user/.pc-scratch/design/far/tools/od.mjs

