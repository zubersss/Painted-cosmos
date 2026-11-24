# THE TREES TO 30 A SECOND: design (group A)

Written by a design agent of the coordinator's workflow on 24 Nov (look-proto = main at v37), from the owner's v37 speed test and counts in Node. Kept verbatim; the coordinator's split into lanes is at the end.

## Findings

I edited no working copy. All my scratch work is in /home/user/.pc-scratch/design/trees/: a clean export in src/, and my own copy of tools/overdraw.mjs at /home/user/.pc-scratch/design/trees/od.mjs. The copy adds: the tier (q=), the hand-over handle (tk=), the camera, hiding a tier, a wood/leaves split, 2x2 quad lanes, triangle-size bins, triangles and vertices for every instance, and trees counted by distance. The raw outputs are the od_*.txt files there.

WHAT THE CODE DOES ON THE PHONE (src/world/flora.js update)
- SCREEN.outH = 372, so grow = max(0.5, 0.34) = 0.5. treeScale = max(0.6, 0.6) x 0.5 = 0.30.
- So the full tree reaches 27 m (T0 90 x 0.3), the middle tree 57 m (T1 190 x 0.3), each +-15% by JIT.
- farScale = max(0.5, 0.75) x air 0.625 = 0.469, so far trees reach 281 m on foot. From the air farScale goes to 1.31-1.5: 551-630 m, with jitter to about 900 m.
- The bench rows 'no near trees', 'hand over at half' and 'at a third' therefore act on everything within 57 m.

COUNTED AT A BENCH-LIKE VIEW
Setup: autumn-wood spawn, 936x372, 58 degree vertical field (the game's fovFoot), eye 2.7 m up (pivot 2.05 m + 5.2 m boom at -0.12 rad), pitch -7 degrees, tier 1. Scene pass 1.50M triangles:
- far trees: 816k (5,911 trees x 138, from florakit.js farCardGeometry: trunk, facetCore, 46 shingles, 10 cards)
- full trees: 118k (32 trees)
- middle trees: 55.7k (151 trees)
- ground 350k, water 83k, near-ground strokes 38k
- My estimate of the shadow pass (near and middle casters all round, leaves thinned) is about 0.3M. That makes about 1.8M against the bench header's 2,077k, so my view is a little lighter than the phone's.
- Trees in view by distance: 0 within 10 m, 8 at 10-18, 27 at 18-27, 76 at 27-45, 106 at 45-60, 503 at 60-100, 2,353 at 100-200, 3,021 at 200-400 m.

KIT SIZES (my tools/kitcount.mjs, three seeds each, oil spec)
- Full tree, lod 0: roundmaple 7,301 triangles, oak 8,750, birch 9,298, poplar 8,676, willow 12,085, sapling 2,823, spruce 2,876.
- Wood is 1,000-5,700 of those. Depth-4 limbs plus twig hairs (3-sided tubes) are 460-4,350.
- Leaves are 900-1,500 six-cornered cards of 4 triangles (kitbuild.js leafCards round).
- Middle tree (lod 1): 160-650 triangles.
- In view, after the leaf thinning by distance (sortLeafCards, uLeafLod), a full tree averaged 3,689 triangles, 61% of them wood.

FRAGMENTS (rasterised at 936x372; per screen pixel in brackets)
- Far trees: 576k (1.65). They cover 62.7k px with a self-lap of 9.2; only 24.6k are on top at the end.
- Full trees: 209k (0.60), of which wood 83k and leaves 126k.
- Middle trees: 157k (0.45), of which wood 52k and leaves 105k.
- Whole scene: 7.1 fragments a pixel.
- With an early depth test in three's draw order (simulated; it assumes depth is written as each draw goes, which a discard shader does late): far 34k shaded, full 99k, middle 46k; scene 1.78 a pixel.
- Tiny triangles: of the far leaf triangles that reach the screen, 48.5k are under 1 px, 31.9k 1-4 px, 13.5k 4-8 px. Of the near wood triangles, 54% are under 1 px (the twigs). 2x2 lanes come to 1.8-2.0 times the fragments on foot and 3.0 times from the air.
- From the air at 150 m (30 degrees down): 42,663 far trees, 5.89M triangles, 12.5M vertices.
- At 600 m: 30,104 trees, 4.15M triangles, and no trees at all past about 900 m.

THE WORK IN EACH PLANT FRAGMENT (PROP_FRAG, read from the code, not profiled)
- A leaf (part 5) after the 'flat' point: the per-tree colour run (famO, about 40 ops), the lens, figure-window and wash discard tests, pcLamp (returns at once by day), pcAtmosV (about 60 ops with a pow), pcWrite to two targets.
  - The discard tests use texture() with implicit derivatives on the 3D noise. Normally they read nothing; if the compiler hoists those reads out of their branches, a leaf makes 4-6 reads of the 3D noise.
  - About 150-250 ops in all.
- Bark (part 0) in the oil branch:
  - pcStrokeOct4 and pcStrokeOct, 10 screen derivatives, a pcSunAt.
  - Then TWO layers, each with: pcThinLayer (one 3D-noise read plus a hash walk), pcSunAt, 2-4 pcTone (about 100 ops each), pcLevel, 2 pcLamp.
  - About 2,000+ ops and 5-7 texture reads.
- A leaf vertex (PROP_VERT): pcSunAtV (one shadow-map read), pcTone, pcLevel, pcDabTintV, SKYUP; about 300 ops.
- Near and middle trees (PC_PHYS_BRANCH) add per vertex: pcPhysBend (8 texelFetch) and pcPhysCrown (8 texelFetch, 24 sines, 4 pows, 3 atans).
- Far trees run no physics in the vertex shader.

THE COSTS DERIVED FROM THE v37 TABLE
- Far: the lumps row is -17.0 ms for 816k -> 154k far triangles (counted; shaded far fragments 34k -> 32k, about equal). So one far triangle is 0.026 ms per 1000 (12.8 ns a vertex), and the far trees cost about 21 ms (816k x 0.026 = 21.0, plus about 0.9 of paint: 'far trees one flat colour' in the 19 Nov table; the v37 row is unsettled).
- Near: rows 'no near trees' -51.8, 'half' -28.7 and 'third' -38.1 against the counts at tk = 1, 0.5 and 0.33 (near triangles 174k / 21k / 2.8k; near fragments shaded with the early test 145k / 93k / 58k; far shaded 34k / 82k / 105k).
  - Least squares with the trees' shadow share (1.2) taken out gives 0.11 ms per 1000 near triangles (about 19 ms) and 0.22 ms per 1000 shaded near fragments (about 31 ms).
  - A far shaded fragment comes out at about 0.02.
  - Residuals are under 0.3 ms.
  - This agrees with 'plants one flat colour' -34.0, which is about 32 of near paint plus about 1 far plus under 0.6 undergrowth.
- Non-tree: 89 - 72.3 = at most 16.7 ms (the 'no trees' row is held at the screen's 60 cap); I estimate about 16.
- The anomaly: the ground's heavy dab shader on near pixels costs at most 0.05 ms per 1000 shaded pixels, its 394k triangles included ('no ground' -4.8 over about 90k shaded ground pixels). The same leaf code costs about 9 times more per fragment inside a near tree than inside a far one.
  - The reading most consistent with the table: near-tree shader waves mostly run the 2,000-op bark path. Thin branch slivers interleave with the leaves, so one bark quad makes the whole wave pay for it, and it happens inside one very large program (registers, branching).
  - The vertex shader's per-vertex crown physics carries the per-triangle half (about 85 ns a near vertex against 12.8 for a far one).
  - Not settled: package T0 is the row set that settles it.

LOOK TODAY (stills opened)
- At 5-15 m the trees are crisp flat leaf pieces, approved.
- At 27-57 m the middle tree is about 100 big kites on a stem: umbrella crowns.
- From 57 m the far tree is a smooth dark-olive rounded lump (the dark facetCore under dull shingles), and the spruce a dark faceted cone.
- From 150 m the wood is dark masses with sparse light-green flecks.
- From 600 m it is dark specks over the ground's orange dabs, and bare land past about 900 m.

## Packages

### T0: The instrument first: six speed-test rows that split the near trees' 52 ms

**Change:** Add rows to the bench that use machinery already in the game:
(a) 'near trees: leaves only' draws each tall mesh from geometry.userData.leaf.base onward (florakit.js sortLeafCards already puts all wood first). The handle is in flora.js _instanced onBeforeRender via a benchNear value.
(b) 'near trees: wood only' draws (0, leaf.base).
(c) 'near bark one flat colour': uOilL.y = 7. One line at the top of PROP_FRAG's oil branch returns part < 0.5 flat.
(d) 'near trees: no wind in the vertex shader': uPhysOn = 0 on the tall-* materials.
(e) 'near trees one-sided': side = FrontSide on the tall-* materials; it recompiles, and calm() already waits.
(f) 'near trees drawn after the ground': renderOrder 6 on the tall meshes.
Also a held-camera AIR pair: 'held 150 m up, 30 degrees down: as set'. It moves the bench's pin (ex.p and footCam.pitch) 150 m up for those rows, so the phone measures the air, where the far trees are 5.89M triangles.

**Files:** src/core/bench.js, src/render/index.js, src/render/materials.js, src/world/flora.js

**Phone cost:** 0 ms (rows only).
They settle what the fit cannot. The fit gives about 19 ms of near triangles (0.11 ms per 1000) and about 31 ms of near fragments (0.22 ms per 1000 shaded), and the table cannot say which of wood / leaves / vertex physics / double-siding / draw order carries them.
What each row would show, if the reading in findings is right:
- (a) leaves only saves most of the 51.8, about 40 ms. The wood is 61% of near triangles and its bark path is in most waves.
- (b) wood only saves about 10-15.
- (c) bark flat saves about 25-30.
- (d) no wind saves several ms of the 19 ms triangle half.
Whatever they show, T2's split programs and T5 are sized from them before T2 is built.

**Look:** None: the speed test only.

**Risk:** Nil for the game. It needs one bench=1 run by the owner (a few minutes) before T2 is committed to.

**Switch:** bench=1 only.

### T1: Far trees as painted impostors from the same kits (45 m to the far range)

**Change:** NEW src/render/impostor.js bakes, once per world and only for its CAN_CARD species, two seed variants of each kit's lod-0 tree:
- 8x8 hemi-octahedral view directions (horizon to straight down; looking up from below is clamped to the lowest row), each 64x64, into an RGBA8 DataArrayTexture.
- R: the leaf's own number aData.w (0 = wood plus a bark code).
- G,B: the leaf's MASS normal aMass, octahedral-encoded. It is constant over a leaf, so a leaf is lit whole.
- A: the depth of the leaf CENTRE aCard along the view (0 = empty), so a leaf is shadowed whole.
- A categorical mip chain (each 2x2 block keeps its front-most leaf, never an average), sampled NEAREST_MIPMAP_NEAREST: no blur.

materials.js gains makeImpostorMaterial (IMP_VERT / IMP_FRAG, reusing PAINT, pcTone, pcLevel, pcSunAt, pcAtmosV and the oil light):
- VS: picks the nearest view from the eye direction in the tree's own frame (yaw and lean from the instance matrix), turns the quad to that view (so the leaf pattern stays tied to the world between switches), and picks the mip from the tree's pixel height. It hands over per tree the leaf washes with the fam run and the hue, as PROP_VERT does per leaf now, plus the crown's light terms.
- FS: one fetch, discard if empty, leaf colour from the tree's washes by the leaf number, level from normal.sun, shadow:
  - inside the shadow square: pcSunAt at the reconstructed leaf centre;
  - outside: the existing FAR coherent-crown rule (lit side and shaded side).
  Then pcTone, pcAtmosV, pcWrite: about 150 ops and one fetch.

florakit.js: impostorQuadGeometry. flora.js: far groups of CAN_CARD species use the quad plus the impostor material (one material for all species, layer = species*2 + variant, so the same 18 draws as today); setFarImpostor(on) for the bench swap; the lump and cards stay behind switches.
Later, optional: a far cell keeps all its trees and the VS cuts below the middle range, so the far cells need no CPU retier (the script is 12.9 ms).

**Files:** src/render/impostor.js, src/render/materials.js, src/world/florakit.js, src/world/flora.js, src/core/bench.js

**Phone cost:** On the ground at the bench view: about -19 ms (89 -> about 70 alone).
Geometry: the lumps row, -17.0 ms for 662k fewer far triangles, gives 0.026 ms per 1000. Today 816k (counted) = 21.0 ms; impostors 5,911 x 2 = 11.8k = 0.3 ms (doubled for the view math, 0.6).
Paint: today's far paint is about 0.9 ms (19 Nov 'far trees one flat colour'). The impostor shades a fragment per pixel in place of a vertex colour. A quad's shaded fragments are counted near today's (the two-crossed-card stand-in, ?fartree=blob, gives 37k shaded against 34k), so 37-50k x 0.025-0.06 ms per 1000 = 1-3 ms.
Net -18 to -20 ms.

From the air at 150 m: 5.89M far triangles = about 151 ms today (about 6 a second). Impostors 85k = 2.2 ms, plus paint on about 200k shaded (counted 213k today, 194k with the stand-in) = 5-12 ms. So the air goes from about 6 a second to under 33 ms.

Confirm with a new row 'far trees as impostors' (swapped in the run, as 'far trees as lumps' is today) against 'as set', and with the T0 air pair plus 'held 150 m up: impostors'.

**Look:** Today, from 57 m, far crowns are smooth dark lumps with a few flecks (t4_mid_zoom20.png, t2_air150.png). An impostor carries the real kit's leaves, each in its tree's own colour run and lit whole, with a lit side and a shaded side. From the air it reads as a canopy of lit leaves, not dark specks (t3_air600.png).
Judged by A/B stills (?fartree=impostor against ?fartree=cards) at the bench station: the middle view (80-150 m across the river, as t1 and t4), 150 m and 600 m up, all at 936x372, lite paint, no MSAA, opened. Then the owner's phone in motion for the view switches and the 45 m hand-over.

**Risk:** - View POPPING: nearest view and no blend (a blend would be blur); views about 13 degrees apart, so a tree at 45 m switches about every 10 m walked sideways. The pattern keeps leaf identity (the same leaf number keeps the same colour), so a switch is a small shift, but only the owner's phone in motion can judge it. 12x12 views at 64x64 cost the same memory as 8x8 at 96x96 if it shows.
- Memory: about 1 MB a variant at 64x64; Earth's 13 kinds x 2 = 26 MB.
- Bake time: 1,664 small renders; a few hundred ms on the phone, spread over the load; minutes in software here.
- A tree on a steep slope seen from below.
- Must hand over cleanly to the T3 middle tree, washed in as today.
- The previous one-card far tree failed because its outline was the card's. Here the outline is the baked leaves', which must be checked in the first still.
- Beyond about 900 m from the air, impostors cost too many vertices (about 13 ns each). There the far-view lane should paint the canopy into the ground in the impostors' palette.

**Switch:** ?fartree=impostor (made the default after the row confirms it); ?fartree=cards is today's, ?fartree=lump the old one.

### T2: The near tree (up to 18 m) of leaf clusters carried as dab sprays, wood without hairs, two short programs

**Change:** kitbuild.js gains clusterCard: one quad, or two crossed quads, carrying its centre (aCard), its outward mass normal, its size and a spray number. Leaf part 7 marks a card.

kits/grove.js grow at lod 0:
- Merges the about 300-490 leaf stations (each about 3 leaves) into about 80-150 cluster cards, each a spray of about 10-18 leaves, 1.2-1.5 m across, turned out of the crown with a spread of angles so a crown has cards at every angle from any view.
- Stops building depth-4 limbs and the twig hairs as tubes; they are 460-4,350 triangles a tree, half of them under a pixel at the bench.
- Trunk and bough sides 6/5/4 -> 5/4/3.
- Wood about 600-900 triangles plus cards about 200-300, so about 1,000 a tree against 7,000-12,000 at full detail (3,689 average in view).
kits/spruce.js: needle boughs become cards.

dabtex.js gains a leaf-spray tile: the same baked-dab machinery as the ground (par/id textures, makeDabData) with the leaf aspect, dabs only inside a ragged round mask.

materials.js splits the plant program for trees in two:
- LEAF_FRAG: pcDabLayer on the card's own chart gives the top leaf, its number and its EXACT centre. Discard where no leaf, so the sky shows between leaves and the outline is ragged leaf by leaf. The leaf is lit whole (normal.sun with a per-leaf tilt from its number; shadow = one pcSunAt at its centre); the paint picks among the card's palette at three light levels, worked out per card in PROP_VERT (so the paint stays in the vertex shader). The lens window and the figure window drop whole leaves by number; no implicit-derivative texture in any branch.
- WOOD_FRAG: one layer of thin streaks, one pcSunAt, one pcTone (about 400 ops instead of about 2,000).
flora.js: each species makes a leaf material and a wood material; the near mesh draws two index groups (wood, cards) sharing the instance buffers. The crown physics stays on the 8-or-so near trees (cards move whole about aCard).
shadow.js: cards cast through the spray's coverage, so shadows stay leaf-shaped.

**Files:** src/world/kitbuild.js, src/world/kits/grove.js, src/world/kits/spruce.js, src/world/florakit.js, src/render/dabtex.js, src/render/materials.js, src/world/flora.js, src/render/shadow.js

**Phone cost:** T2, T3 and T4 together take the near program from 51.8 ms (row 'no near trees') to about 6-9 ms: about -43 to -46 ms.
Geometry: 8 trees at 10-18 m x about 1,000 triangles + 103 trees at 18-45 m x about 150 (T3) = 23.5k triangles, against 174k today; at the fitted 0.11 ms per 1000 that is 2.6 ms, less with lite physics on T3.
Fragments: counted with today's crowns at a 21/45 m hand-over (tk = 0.79): 265k rasterised, 123k shaded with the early test, 72k on top. +15% for the cards' gaps gives about 140k shaded. At the rate a dab program pays on near pixels on this phone (the ground: at most 0.05 ms per 1000 shaded; the far leaf path about 0.025) that is 3.5-7 ms.
This assumes the two short programs escape today's near cost. If they inherit it (0.22 ms per 1000), the same 140k is about 31 ms; then T5 and the T0-identified fix are needed.
Confirm with a new row 'near trees as clusters' (swap the species' geometry and materials) against 'as set', run after T0.

**Look:** At 10 m: leaves stay crisp flat strokes (the dab edges are exact at any magnification, as the ground's are), each its own tone, lit and shadowed whole, sky between them. A tree carries more leaves on screen than now for less cost, and leaf shapes match the floor's leaf dabs.
Lost: leaves no longer tremble one by one (a card moves whole); depth-4 twig hairs go (they are mostly under a pixel at the phone's size).
Judged by A/B stills (?trees=clusters against ?trees=cards) at the 10 m station (t0_trees_preset.png framing) and a 4-6 m close-up, opened; then the owner in motion.

**Risk:** - The largest unknown: whether the new short programs cost what the ground's dabs cost per fragment, or what today's near trees cost. T0 must run first.
- Cards seen edge-on thin a crown. A spread of angles and two crossed cards on the biggest clusters cover it.
- The leaf trembling is lost.
- More draw calls (wood + leaves; about +30): about +0.6 ms of the phone's CPU, which is not the limit (script 12.9 ms against a GPU frame over 20 ms).
- Every grove kit and spruce must be redone and grove.test.mjs kept true.
- The fire's per-leaf burning and the wind knife's per-branch felling must keep working: a card carries its branch id.

**Switch:** ?trees=clusters, default once the row confirms it; ?trees=cards keeps today's trees for A and B.

### T3: The middle tree (18-45 m) of leaf clusters

**Change:** kits/grove.js grow at lod 1:
- Trunk plus 3-6 first boughs in 3-sided tubes (as now, about 60-110 triangles).
- About 20-30 cluster cards (about 40-60 triangles) in place of about 100 big kite cards (240-400 triangles).
- About 150 triangles a tree.
It uses the same LEAF_FRAG / WOOD_FRAG as T2 with coarser sprays (fewer, larger leaves per card, still about 3+ px wide at 45 m).
flora.js gives the middle tier a material variant with pcPhysBendLite and no pcPhysCrown (today both tiers share one material and the middle tree pays the full crown physics per vertex).

**Files:** src/world/kits/grove.js, src/world/kits/spruce.js, src/world/flora.js, src/render/materials.js

**Phone cost:** Counted inside T2's figure.
Alone: 103 trees x about 150 = 15.5k triangles against today's 55.7k middle tier (151 trees to 57 m), about -4.4 ms of geometry at 0.11 ms per 1000.
Fragments: middle-tier shaded 43-46k counted; at the dab rate that is about 1-2 ms against about 10 ms today at 0.22 ms per 1000.
Confirmed by T2's row 'near trees as clusters'.

**Look:** Today's middle tree is an umbrella of about 100 big kites (t1_river_mid.png, t4_mid_zoom20.png). Clusters give a crown of many small leaf strokes with light and shade, nearer to the reference and to the near tree, so the 18 m hand-over shows less.
Judged at the 80 m station across the river (the middle trees at 20-45 m in the same frame), A/B, opened.

**Risk:** - The hand-over at 18 m (near) and 45 m (impostor) must wash in as tiers do now.
- Too few cards and a crown reads as patches: the card count is a number to tune by eye in stills.

**Switch:** Part of ?trees=clusters.

### T4: Hand-over distances: near 27 -> 18 m, middle 57 -> 45 m, impostor beyond

**Change:** flora.js, oil look only: T0 90 -> 60 and T1 190 -> 150 (still scaled by the picture as now, so 18 m and 45 m at the phone's 372 lines).
shadow.js MID_TIER follows.
The leaf thinning by distance (uLeafLod) no longer applies to cluster trees.

**Files:** src/world/flora.js, src/render/shadow.js

**Phone cost:** Measured direction: the phone's own rows 'hand over at half' (-28.7) and 'at a third' (-38.1) show that moving the hand-over in pays, even when today's far tree takes over.
With today's trees the fit gives about 68 ms at 18/38 m (near triangles 57.8k x 0.11 + near shaded 109k x 0.22 = 29.9 ms, against 51.8).
With T1-T3 its value is inside T2's figure.
Confirm with the existing 'near trees hand over at ...' rows set to the new ranges.

**Look:** At the phone's size a tree at 45 m is about 75 px tall; T1's 64x64 views are about 1.2 px per texel there. The stills at the 80 m station must show no change in hand at 45 m.

**Risk:** The impostor at 45 m is its closest use. If the owner sees the switch, move it to 60 m (+ about 60 middle trees, about +1-1.5 ms).

**Switch:** ?treenear= and ?treemid= (metres at the phone's scale); the defaults are 18 and 45.

### T5: Insurance: the tree clusters laid with a depth pass first

**Change:** render/index.js: before the scene pass, draw the cluster trees' layer with a coverage-only material: pcDabLayer coverage, discard, depth write, no colour; about 20 ops and 2 fetches.
The cluster colour materials then use depthFunc EQUAL, no depth write and NO discard, so every visible pixel of a tree is painted once and the hardware's early depth test works.
materials.js: makeTreeDepthMaterial and the depthFunc flag.
flora.js puts the cluster meshes on their own layer.
Alpha-to-coverage is NOT used: the phone draws with no samples ('edges none'), and with one sample it does nothing.

**Files:** src/render/index.js, src/render/materials.js, src/world/flora.js

**Phone cost:** Shaded tree fragments go from about 140k (with the early test; 300k+ rasterised) to the counted about 72k visible.
- If T2's programs run at the dab rate: +2.6 ms (the geometry drawn twice) + about 1.5 ms (coverage fragments, about 300k at about 0.005) - about 2-4 ms of shading saved: about 0 to -2 ms net. Then leave it off.
- If they inherit today's near cost: 140k -> 72k x 0.22 = -15 ms, +4 ms = about -11 ms.
Confirm with a new row 'tree clusters with a depth pass first' against 'as set'.

**Look:** None: the picture is the same pixel for pixel. The VS position code must be bit-identical between the two passes (invariant gl_Position).

**Risk:** - Draw calls x2 for the cluster meshes (+about 30): CPU about +0.6 ms.
- Bit-exact positions are needed (wind physics in both passes) or the EQUAL test speckles.
- Built only if T0 or T2's row say the cluster fragments are still dear.

**Switch:** ?treeprepass=1.

### T6: Shadows kept, cheaper; impostors cast from the air (optional)

**Change:** shadow.js draws T2/T3 cluster trees with the spray's coverage test (leaf-shaped shadows) and their wood.
Optional, from the air only: far impostors drawn into the shadow map from the SUN's own baked view (a correct silhouette for 2 triangles a tree), inside the square (up to 360 m half-width). It gives crowns long cast shadows from the air, where today nothing casts (far trees are out of the pass, and there are no near trees up there).

**Files:** src/render/shadow.js, src/world/flora.js, src/render/impostor.js

**Phone cost:** Row 'trees cast no shadow' says the trees' shadows are 1.2 ms today, for about 290k casting triangles all round (estimated: about 70 full + about 430 middle trees in the square).
After: about 25 near x about 1,000 + about 300 middle x about 150 = about 70k, so about 0.3-0.5 ms: about -0.8 ms.
Optional air shadows: 10-20k trees x 2 triangles plus coverage fragments, about +1-2 ms, only from the air.
Confirm with the existing 'trees cast no shadow' and 'no shadows at all' rows.

**Look:** The floor's dappled shade under near trees is kept, cut by whole leaves as now.
From the air, crowns would throw long shadows across the floor, as in the owner's aerial references; the A/B still at 150 m with the sun low (time=17) decides.

**Risk:** - The shadow square's texels from the air are about 0.35 m. An impostor shadow there is a crown-sized shape, not leafy: fine for the air.
- The far-view lane must agree, since it owns the view from the air.

**Switch:** Cluster shadows ride ?trees=clusters; ?impshadow=1 for the air option.

## Not settled

THE TOTAL
At the bench view, central estimate: about 16 non-tree + 0.4 shadows + 2-3.3 impostors (T1, from 45 m) + 6-9 near and middle (T2-T4) = about 24-29 ms (about 34-41 a second). That leaves 4-9 ms under 33 ms. The denser grass and flowers of the flora lane will spend some of it; trees are then about 9-12 ms of the frame.

WHAT I COULD NOT SETTLE
1. Why a near-tree fragment costs about 0.22 ms per 1000 shaded where the same leaf code in a far tree costs about 0.02, and the ground's heavy dab shader at most 0.05. Wave divergence into the 2,000-op bark path inside one very large program is the reading most consistent with the table, but the table cannot say it. If T2's new short programs inherit that cost, T2-T4 give about 31 ms of fragments, not 3.5-7. The frame is then about 42 ms even with T5, and the cause found by T0 must be fixed. T0's six rows must run on the phone before T2 is committed to.
2. Whether the Adreno rejects hidden fragments before shading for these discard shaders. My 'shaded' counts simulate an early test in three's draw order with depth written as each draw goes; a discard shader writes depth late. The rasterised counts are given beside them, and the fit used the shaded ones.
3. The non-tree remainder. 'No trees' reads 16.7 ms, the screen's 60 cap, so the true non-tree cost is at most 16.7 and may be lower; I used about 16.
4. My camera is an approximation of the bench's. The bench's third-person camera sits 5.2 m behind the explorer; I stood the eye at the spawn, 2.7 m up, -7 degrees, 58 degrees. My scene count is 1.50M triangles (plus about 0.3M estimated for the shadow pass) against the header's 2,077k, so the phone's view is somewhat heavier than mine.
5. How the impostors' view switching and the 18 m and 45 m hand-overs look in motion. That is only for the owner's phone.
6. Nothing of T1-T6 is built or seen; the stills are of today's trees only.
7. All op counts per fragment and per vertex are read from the code, not profiled.

STILLS
Taken in my own lab on a clean export: 936x372, look=oil, lite=1, quality=1, fov=58 (zoom 20), MSAA off as on the phone, the autumn wood at 15.4 h (in its summer dress). Each one opened.
- /home/user/.pc-scratch/design/trees/stills/t0_trees_preset.png: near, trees at 5-15 m: crisp flat leaf pieces.
- /home/user/.pc-scratch/design/trees/stills/t1_river_mid.png: middle and far trees at 40-150 m across the river.
- /home/user/.pc-scratch/design/trees/stills/t4_mid_zoom20.png: the same bank through a 20 degree field. Middle trees are umbrellas of big kites; far trees smooth dark-olive lumps; spruce dark faceted cones.
- /home/user/.pc-scratch/design/trees/stills/t2_air150.png: 150 m up, 30 degrees down. Dark crown masses with sparse light flecks.
- /home/user/.pc-scratch/design/trees/stills/t3_air600.png: 600 m up, 35 degrees down. Trees as dark specks; no trees past about 900 m.
My lab browser is closed. Counting tools: /home/user/.pc-scratch/design/trees/od.mjs and /home/user/.pc-scratch/design/trees/tools/kitcount.mjs, with outputs in the od_*.txt files beside them.


## Stills
/home/user/.pc-scratch/design/trees/stills/t0_trees_preset.png (near, 5-15 m); /home/user/.pc-scratch/design/trees/stills/t1_river_mid.png (middle and far, 40-150 m); /home/user/.pc-scratch/design/trees/stills/t4_mid_zoom20.png (same bank, 20 degree field); /home/user/.pc-scratch/design/trees/stills/t2_air150.png (150 m up, 30 degrees down); /home/user/.pc-scratch/design/trees/stills/t3_air600.png (600 m up, 35 degrees down). All are 936x372, oil look, lighter paint, tier 1, no MSAA, opened.


## The skeptic's check of the tree design (independent agent)

**Reaches 33 ms with margin:** False

**Total:** My estimate at the bench view is about 29 ms for the tree design alone and about 33 ms once the flora lane's stated +3-4 ms is added. That is on the 33 ms line, not under it with room to spare, and it holds only if the new near programs are as cheap per fragment as their op counts suggest. The designer's claim was 24-29 ms with 4-9 ms to spare.

THE SUM, as non-tree + far trees after T1 + near and middle after T2-T4 + tree shadows:
- Central: 15.5 + 2.5 + 11 + 0.4 = 29.4 ms.
- Range if per-fragment costs follow each program's work: 14.4 + 1.1 + 7 + 0.4 = 22.9 ms, up to 16.7 + 4.9 + 20 + 0.4 = 42.0 ms.
- If the new near programs keep today's per-fragment cost: 46-63 ms. T5 would then win back about 10-25 ms, but only on a late depth test, and only if the colour pass drops alpha-to-coverage and discard.

WHERE THE INPUTS COME FROM:
- Non-tree is 16.7 ms or less, because the 'no trees' row sits on the screen's 60-a-second cap.
- The budget closes on the measured rows: 16.7 + 19.6 (far trees, from 'no near trees' 36.3 minus 16.7) + 51.8 = 88.1.
- I found no double count. T1 removes far triangles, and only the far trees' ~0.9 ms of the plants' 34 ms of fragment paint. T2 removes the near trees' share. T3 and T4 are inside T2, and T5 is an alternative, not an addition.

WHERE THE DESIGNER IS OPTIMISTIC:
- T2's per-fragment rate. Leaves will do their shadow and light per fragment instead of per vertex, and every rasterised fragment may be painted.
- The flora lane's own +3-4 ms is not in the 24-29.
- The air: only the trees are derived there.

HOW I WORKED:
- No software timings were used.
- I reproduced the designer's counts exactly at 936x372 on my own export with a copy of their counter (/home/user/.pc-scratch/design/check/od.mjs), and counted 2x2 lanes at 1404x558 (od_15x.txt).
- The fits are in /home/user/.pc-scratch/design/check/fit.mjs.
- I opened no browser and took no stills.
- Op counts are read from the code, not profiled.
- Whether the Adreno paints hidden fragments of discard and alpha-to-coverage programs comes from general knowledge of the hardware, not from any measurement. The table points both ways: the flat row argues against a pure early test, and the 1.5x row argues against a pure late one.

- **T0** holds: claimed 0 ms (rows only); re-derived 0 ms. Two more rows are needed beside its six (see missing).. Adding rows changes nothing in the game, so the 0 ms is right. These rows are the most needed piece of the design, because the table cannot split the near trees' 51.8 ms. Rows (c) 'near bark one flat colour', (a) leaves only and (b) wood only will show whether the bark carries the cost. Both of my fits (below) say about 85-95% of the near-tree fragment cost is wood, if near leaves cost what far leaves do (they run the same leaf code, PROP_FRAG part > 4.5). Row (e) 'one-sided' also helps tell the two depth readings apart: the tall materials are DoubleSide, so the back faces of every wood tube are rasterised, and on a late depth test those back faces are painted too. The air pair is needed: no row has ever measured the frame from the air.
- **T1** holds: claimed about -19 ms at the bench view (-18 to -20); from the air, about 151 ms of far triangles down to about 7-14 ms; re-derived -15 to -20 ms, central about -17.5. From the air, only the trees' share is derived (about 3-7 ms of impostor vertices and paint). The rest of the air frame has never been measured.. This is the best-anchored package. The measured row 'far trees as lumps' gave -17.0 ms for 815,718 -> 153,686 far triangles. I reproduced the designer's counts exactly on my own clean export (/home/user/.pc-scratch/design/check/od_1x.txt). Both my fits give 20.9-21.6 ms of far-tree triangle work today. Derivation: -17.0 (measured) + taking away the lumps' remaining ~142k triangles at 0.018-0.026 ms per 1000 (-2.6 to -3.7) + impostor vertices (+0.3 to +0.6) + impostor paint over today's far paint (+0.5 to +4) = -15.0 to -19.9. The paint is wider than the designer's 1-3 ms for two reasons. (1) Every plant material in the oil look sets alphaToCoverage = true (materials.js line 2493), and three enables the GL state on every draw (three.module.js line 10238). Together with discard, this may make the Adreno paint hidden fragments as well. The designer's own blob stand-in rasterises 464,892 far fragments; only 37,079 survive an early depth test. (2) The impostor fragment does a shadow read and the tone per fragment, which today's far leaves do per vertex. Today's far-leaf rate times 1.5-3 still gives only 0.5-4 ms on any reading that fits the table. Confirm with the planned row 'far trees as impostors'. Before building, run a row 'far trees as two crossed cards': ?fartree=blob already exists (farBlobGeometry), with 83k triangles and 465k rasterised fragments, and it prices the quad-fragment load on the phone.
- **T2** DOES NOT HOLD as claimed: claimed T2+T3+T4 together: near and middle from 51.8 to 6-9 ms (-43 to -46); re-derived Near and middle after the change: 7-20 ms (central about 11), a saving of -31 to -44 (central about -40), IF the per-fragment cost follows each program's work. If the new programs keep today's near-tree cost per fragment: 29-41 ms after, saving only -10 to -22.. (1) The designer's split of the near trees (19 ms of triangles + 31 of fragments, 'residuals under 0.3') is not identified by the table. With the lumps, no-near, half and third rows there are 4 equations for 4 unknowns, so any model fits exactly (/home/user/.pc-scratch/design/check/fit.mjs). Two models fit equally well: early-test counts give 21.6 ms of triangles + 30.8 of fragments; rasterised counts give 7.5 + 43.3. Other rows narrow it. 'Plants one flat colour' (-34.0) returns before every discard, so plant fragment work is about 34 ms or more. The '1.5x sharp' row (+39.4, no tree level-of-detail change at 558 lines) bounds it at about 41.5 ms or less: I counted 2x2 lanes growing x1.94-1.97 for 2.25x the pixels (/home/user/.pc-scratch/design/check/od_15x.txt). So near fragments are about 33-41 ms and near triangles about 7-23 ms. (2) At TODAY's per-fragment rate T2 saves almost no fragment work: 140k shaded against 145k, or 305k rasterised against 365k. The whole fragment saving rests on the new programs being 5-10 times cheaper per fragment, which is unmeasured. (3) The 3.5-7 ms prices LEAF_FRAG at today's far-leaf/ground rate and counts only early-test survivors (140k). But LEAF_FRAG moves the leaf's shadow read and light pick from the vertex shader into the fragment shader, so the ground rate (at most 0.054 per 1000) is the fair stand-in. On a late depth test (discard + alpha-to-coverage) all ~305k rasterised fragments are painted. Derivation: triangles 23.5k x 0.043-0.124 = 1.0-2.9 ms; wood 31-39 ms today x 0.63-0.71 (hairs and depth-4 limbs gone) x 0.2 (2,000 -> 400 ops) = 3.9-5.5; leaves 95k-220k x at most 0.054 = 2-11.9. Total 7-20. Confirm with T0 rows (c)/(a)/(b) first, then 'near trees as clusters'. I found no double count of the plants' 34 ms: T1 takes only the far trees' share (about 0.9) and T2 the near trees' share.
- **T3** DOES NOT HOLD as claimed: claimed inside T2; alone about -4.4 ms of geometry, and middle-tree fragments from about 10 ms to 1-2 ms; re-derived Geometry -1.7 to -5.0 ms (40.2k fewer triangles at 0.043-0.124 per 1000, a rate the table does not pin down). The fragment part follows T2: about -8 ms if the new programs are cheap per fragment, about 0 if they are not.. The arithmetic is right, but it uses the early-test reading's triangle rate (0.11), which is one end of an unidentified range. The '10 ms today -> 1-2' fragment figure rests on the same unmeasured per-fragment rate as T2. Taking pcPhysCrown off the middle tier is sound and lowers its per-vertex work, but no row prices it alone; T0 row (d) 'no wind in the vertex shader' would. Confirmed only by T2's 'near trees as clusters' row.
- **T4** holds: claimed inside T2. With today's trees, about -20 ms (to about 68 ms) at an 18/38 m hand-over; re-derived With today's trees: -21 ms (early-test fit) or -22 ms (rasterised fit) at 18/38 m (tk 0.667); about -18 at 18/45 m. This is interpolated between measured rows (tk 1: 0; tk 0.5: -28.7; tk 0.33: -38.1). With T1-T3 it is not separable.. This is anchored to the phone's own measured rows, and both depth readings agree on it. Counts at tk 0.667: near triangles 57.7k, early-test 109k, rasterised 215k; far +14k triangles. Its value is real but not additive to T2. It moves about 70 trees into the impostor tier, which is in T1's +15% paint. The look of impostors from 45 m, and of the 18 m hand-over, has not been judged. Confirm with the existing 'near trees hand over at ...' rows set to 0.667 and 0.79.
- **T5** DOES NOT HOLD as claimed: claimed 0 to -2 ms if T2's programs are cheap; about -11 ms if they keep today's near cost; re-derived On a late depth test: -8 to -11 ms if the new programs are ground-like (305k -> 72k painted at up to 0.054 per 1000, minus 1.2-2.9 for drawing the geometry twice and about 0.6-1.5 for the coverage pass); about -24 ms if they keep today's rate (233k fewer at 0.119 per 1000, minus 2-4). On an early depth test the designer's figures stand.. The value is understated in the case that matters most. If the Adreno paints every rasterised fragment of a discard program, the early-test counts the design uses are a 2.2x undercount for the near trees, and T5 is the only package that brings the painted count down to the about 72k visible. The design says alpha-to-coverage is 'not used', but today's code turns it on for every plant material in the oil look (materials.js line 2493; three enables the GL state whatever the target's samples). The colour pass must turn it off and keep discard out, or the early depth test may never engage. Confirm with 'tree clusters with a depth pass first'. A cheap row 'plants without alpha-to-coverage' can run today: it is a state change only, and at one sample the GLES spec skips alpha-to-coverage, so the picture should not change.
- **T6** holds: claimed about -0.8 ms (tree shadows from 1.2 to about 0.4); air option +1 to +2 ms, from the air only; re-derived -0.6 to -0.9 ms, bounded by the measured 'trees cast no shadow' row (-1.2). The air option is not derivable from the table.. The measured row caps the saving at 1.2 ms, so the claim cannot be far off. Far trees do not cast in the oil look today (flora.js line 251), which agrees with 'nothing casts from the air'. It is not counted twice: the total uses 0.4 for tree shadows on top of the 'no trees' row, which already drew no tree shadows. Confirm with 'trees cast no shadow' and 'no shadows at all'.

**Missing:** 1. ROWS THAT SETTLE THE DEPTH QUESTION BEFORE T2 IS COMMITTED, beside T0's six:
- 'plants without alpha-to-coverage': alphaToCoverage = false on the pc-prop-* materials. It is a state change only, and at one sample the picture should not change. Today every plant material turns it on (materials.js line 2493).
- 'far trees as two crossed cards': ?fartree=blob, which already exists. It has 83k triangles and 465k rasterised fragments against 37k early-test survivors, so it prices T1's quad-fragment load and shows whether hidden fragments are painted.
- T0 row (e), one-sided, is the second test: the tall trees are DoubleSide, so the back faces of every wood tube are rasterised.

2. T5 SHOULD BE BUILT WITH T2 (behind ?treeprepass), not held as insurance. On a late depth test it is the only package that brings ~305k painted tree fragments down to the ~72k visible. Its colour pass must turn alphaToCoverage off and contain no discard.

3. T2 MOVES LEAF WORK INTO THE FRAGMENT SHADER. LEAF_FRAG, and T1's impostor, do per fragment the shadow read and light pick that today's leaves do per vertex. That is why today's leaf fragments are cheap: near leaves are about 5-15% of the near trees' fragment cost and the wood is the rest. Keep per-card light work in the vertex shader where the look allows, and price LEAF_FRAG at the ground's rate (at most 0.054 per 1000 shaded), not the far leaf's.

4. ONE FRAME BUDGET ACROSS THE LANES. The flora lane states about +3-4 ms (carpet blades +1.3 before the cull's saving, flowers +1, plants each place lacks +1.8, the air tint +0.2). The far-view, water and weather lanes and the look director's one light with the figure's shadow are priced nowhere. On my central figure the trees leave about 3.5 ms under 33 ms, and the flora lane alone uses it.

5. THE AIR. Only the trees are derived from the air. The ground, water and sky from 150 m have never been measured on the phone, so 'under 33 ms from the air' is not shown. T0's air pair and a held air view for the far-view lane are needed.

6. A FALLBACK ANCHORED TO MEASURED ROWS, if T2 underdelivers. T1 on top of the measured 'near trees at a third' row (50.0 ms) gives about 50.0 - 22.5 + 2 to 9 = 30-37 ms with today's near trees, but at a clear look cost (middle trees from 9 m, impostors from 19 m). T1 plus 'half' (59.4 ms) gives about 38-43 ms. There is no route to 33 ms that rests only on measured rows without a look cost or an unmeasured per-fragment rate.

7. THE BENCH VIEW. The designer's camera approximates the bench's: 1.50M triangles plus about 0.3M of shadow against the header's 2,077k, and 350 scene draws against the phone's 226 calls in all. The rates are fitted at one view and applied to the phone's.

8. SMALL CORRECTIONS:
- The categorical mip chain adds a third to the impostor memory: about 35 MB, not 26.
- 'Residuals under 0.3 ms' is not evidence: with four rows and four unknowns any model fits exactly.
