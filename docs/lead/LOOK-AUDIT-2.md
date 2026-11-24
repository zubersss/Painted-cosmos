# LOOK AUDIT 2: fresh eyes on the default oil look of v39.2 (group F, the look director)

Written 24 Nov 2026 at the coordinator's request: "a fresh-eyes audit of the default oil look as it will be in
v39.2 ... on foot, 150 m, 400 m, 1 km; summer and autumn; noon and golden hour. Name the three things that most
stop it looking like the owner's reference, with stills, and propose which lane fixes each. The owner has said to
make it look different, so be bold about what is wrong."

The first audit (`LOOK-AUDIT.md`, v37) was about light and colour. Most of what it found is now built (night key,
one foliage shade, one light, the air from the air, the golden-hour sky, the summer canopy). This one looks at the
picture as a whole, as the owner will see it, against the owner's references (`docs/references/README.md` on r2:
the clip of 15 Nov, the autumn woods of 16 Nov from the ground and from the air, the twenty colour oils of 18 Nov).

**What was drawn.** A scratch merge that matches v39.2's picture: look-proto 402a7c8 (v39.1) + farview 0e6dd1e (the
canopy in the ground and FV3, FV4 rock compiled out) + design-water 2d40220 (with its notes commit 7f3ad70) +
look-director dee5b77 (to 64f1742, each summer tree its own green). It leaves out trees-far ?shwhole (the same
picture to the byte) and trees-near ?bench=foot (a speed test only). Never pushed. The painter's gallery at
**1024 x 480** with the phone's settings (`look=oil&lite=1&quality=1&t=0`), autumn with `season=1`, summer with
the default (high summer). Hours 12 (sun 58 degrees) and 16.8 (15 degrees, golden hour). Views: on foot by the
stream (`cam=stream`), the green wood's painter's vantage (`temperate_forest`, `cam=vista`), and from the air
(`cam=high`: 150 m with `dy=-270`, 420 m with `dy=0`, about 1 km with `dy=600`). Every still was opened and looked
at; every number was measured on the PNGs (HSV value V and saturation S; families as in the 18 Nov colour table;
"pattern length" = the shift in pixels at which the picture stops looking like itself, i.e. where its
autocorrelation falls to one half, for colour (red minus green) and for lightness).

**What software drawing cannot tell:** how any of it moves, and what anything costs on the phone. Costs below are
derived, not measured.

---

## The short version

**What is now right, and must not be lost.** The colour of things seen up close is where the references put it:
on foot the autumn canopy measures V 0.64, S 0.76 (references: V 0.62-0.72, S 0.78); the golden-hour water V 0.56,
S 0.26 (references: 0.56, 0.28). Long cast shadows across the green wood's floor at 16.8. Dark trunks. Flat clouds.
The colour is no longer the problem. **The marks are.** In the references every mark takes its colour, its size
and its direction from the THING it paints: a crown is one patch in one colour family, a rock face is two or
three planes of light and shade, water is a few long dashes and a mirror of the sky. In the game the marks take
those from the PIXEL: the same 2-4 pixel stroke everywhere, each picking its own colour. So from the air the whole
picture is one even texture with no things in it.

The three things that most stop it looking like the references, worst first:

| # | what is wrong | where | measured | lane |
| --- | --- | --- | --- | --- |
| 1 | **From the air the wood is confetti, not trees.** No crown reads as a tree: the colour changes every 2-3 pixels, stroke by stroke, where the references change it crown by crown; at noon the autumn roof is also far too light | every view from 150 m up, both seasons | pattern length 2-3 px at 150 m (a crown there is about 15-30 px); autumn roof at noon V 0.90 (references 0.68), at 16.8 V 0.74 | C (the canopy in the ground) with A1 (impostors): A/B below |
| 2 | **The water is grain.** On foot the river is a field of hair-thin bright scratches, finer than anything else in the picture | every stream on foot | 70 per cent of the river's pixels sit on a light-dark edge (grass 33-39, near crowns 16-20); the dashes are 1-2 px tall | E (water paint) |
| 3 | **Mountains are rainbow polygons.** Each mountain is a heap of tall pastel shapes, rose, lime, lemon, lilac, with no lit face and no shaded face | every view with a mountain, from the air | top-left mountain at 150 m: 0.2 per cent of its pixels under V 0.3 (no shade side at all); hue changes shape to shape | C (FV4 rock faces, finished and made the default) |

Then, shorter (section 4): near leaves are big flat shards; the light has no design (no rest, no glowing distance);
the storm leaves the land lit like a fair noon.

---

## 1. From the air the wood is confetti, not trees

**Stills:** `audit2/aut_150_12.jpg`, `aut_150_16.8.jpg`, `sum_150_12.jpg`, `sum_150_16.8.jpg`, `aut_420_12.jpg`,
`aut_420_16.8.jpg`, `sum_420_12.jpg`, `sum_420_16.8.jpg`, `aut_1km_12.jpg`, `sum_1km_12.jpg`, `sum_1km_16.8.jpg`;
crops `audit2/crop_aut150.jpg`, `crop_sum150.jpg` (x3), `crop_wood1km.jpg` (x2).

**What is seen.** At 150 m the autumn wood is a carpet of yellow, orange and red flecks, every fleck its own colour,
with dark conifers dotted through it; the summer wood is the same carpet in green and lemon. You cannot point at a
tree. There are no glades, no shadow lying beside a crown, no crown lit on one side and cool on the other; the river
shows only as a few pale slivers.

**What the references show** (the owner's twenty autumn woods, "from a few hundred metres"): "each tree is one crown:
a round head of small leaf dabs in ONE colour family (this tree yellow, the next orange, the next red, a green one
here and there), lit on the sun's side and shaded cool on the other, on a dark stem seen from above, with its shadow
lying on the grass beside it. Between the stands: glades of yellow-green grass". Thomson: "each tree one crisp patch".

**Measured.** Pattern length at 150 m: colour 2-3 px, lightness 2 px, in both seasons and both hours. A crown 8 m
across at 250 m from the eye is about 15-30 px on this screen, so a wood made of crowns would measure 8-15 px. Autumn
roof at noon: warm families 69 per cent of the wood, V 0.90 S 0.78 (references V 0.68); at 16.8: V 0.74 S 0.86.
Summer roof at noon: V 0.65 S 0.62 (fine). At 420 m the same: pattern length 3 px (colour) and 2 px (lightness);
autumn roof at noon V 0.89 S 0.66, at 16.8 V 0.74; summer V 0.64 S 0.48; and almost no darks in the wood (under V
0.3: 4.9 per cent autumn, 6.4 summer), where the references' dark conifers and shaded meadow are about a sixth of
the paint. At 16.8 a 15-degree sun throws no shadow across the wood and the hill has no shaded flank. At about 1 km the
wood below is a pale carpet with NO darks at all: under V 0.3, 0.0 per cent (autumn and summer at noon, the
wood in front of the mountains), summer V 0.78 S 0.41 (pale mint), autumn V 0.85 S 0.52; the references from
5,000 to 25,000 m still show "DARK GREEN CONIFERS between and among them (a third to a half of the trees)".

**Why it matters most.** The owner's own words (24 Nov): "things should look good far before I get there like when
im flying high in the sky up to a mile I want trees from a distance to look good." This is that view, and it is the
view in which the game least looks like the pictures the owner sent.

**Which lane.** Part of it is MINE: at 1 km the air from the air (L5) lifts the last darks out of the wood. Haze
is a flat step of pale colour; it must not erase the value steps under it (R1.5). I will take the wood's darks at
1 km back to at least about 8 per cent of the land's pixels without greying the near view. The rest PENDING the A/B (`?canopy=0`, same view): whether the flecks are the canopy painted into the ground
(C, farground.js: each ground dab asks which crown its centre lies on) or the impostor trees standing on it (A1), or
both. What the fix must do, either way: **one crown, one colour family, chosen per tree, never per stroke** (R1.3c),
the crown's lit and shaded side in two or three whole strokes, its shadow on the floor beside it (R1.3d), and the
autumn roof's lit value brought to about 0.70 at noon. Cost: choosing a colour per crown instead of per stroke costs
nothing on the phone; the crown's cast shadow is one more read of the crown grid per ground dab (derived: under
0.3 ms).

---

## 2. The water is grain

**Stills:** `audit2/aut_foot_12.jpg`, `aut_foot_16.8.jpg`, `sum_foot_12.jpg`, `coast_16.8.jpg` (the sea from the
shore); crop x3 `audit2/crop_water_foot.jpg`.

**What is seen.** On foot the river is the busiest thing in the picture: a sheet of hair-thin streaks, pale blue,
white and navy, packed tight like brushed metal or a bad video signal. In the crop the dashes are 1-2 pixels tall;
some rows are dotted. Nothing of the banks or the trees is in it (but see the note below). It is also the coldest,
lightest thing at noon: V 0.69 S 0.35 (references: water V 0.56, S 0.28); at 16.8 it is on the reference.

**What the references show.** The clip: water carries its own strokes, crisp, each one flat colour, "6 to 15 px long"
in a 576 px frame. Thomson: "a strip of deep blue water". The autumn woods: "lakes that mirror the sky (pale blue with
cloud shapes in them)", "a brook with stones and reflections". Sea of Thieves: "the sun's path on the water as broken
dashes of gold". Nowhere a texture of scratches.

**Measured.** How busy each part of the picture is (share of pixels on a step of lightness over 0.08 to the next
pixel; aut_foot_12): river 70 per cent, grass 38, far trees 36, near crown 17, sky 4. The river is twice as busy as
the grass and four times as busy as the trees. The sea from the shore at 16.8 (`coast_16.8`): 72 per cent, the
same grain; and it stays cold under the gold sky: the sea's mean colour (0.35, 0.49, 0.60), S 0.46, under a sky of
(0.85, 0.72, 0.50), with no path of the low sun on it (the first audit's F9, still open).

**Likely cause (not checked in the code; for E to confirm).** The dashes lie on the water's plane and are sized in
octaves by distance, but seen at a grazing angle a dash 3 px wide on the plane is 1 px tall on the screen: the
water's stroke size does not allow for foreshortening, so it breaks R4.5 ("a stroke smaller than about 1.3 px is
not drawn") along its short side.

**Note, said plainly.** In the game the water also mirrors the last frame's picture where it can; a gallery still
may show only the fallback, so the missing reflection is NOT a finding of this audit. The grain is, because it is
the water's own paint.

**Which lane.** W3 (water paint, `WATER_FRAG`; on water-paint 6fcd2ed W3 has already widened the low-angle
strokes up to five times and replaced the per-pixel thinning, which cut the river on foot from about 70 to 46 per
cent in its own stills: the right direction, not yet the target), with E-W2 for the sea's direction and F (me) for
the sky's gold reaching the water. What the fix must do: choose the dash's octave by its SHORT side on
the screen (never under about 3 px tall at 480 lines), so that at a grazing angle the river is a few long horizontal
dashes, not a hundred scratches; fewer light dashes (a sparse glitter toward the sun, not every row). Cost: fewer,
larger dashes cost the same or less.

---

## 3. Mountains are rainbow polygons

**Stills:** `audit2/aut_150_12.jpg`, `sum_150_12.jpg` (top left), `aut_420_12.jpg`, `sum_420_12.jpg`,
`aut_420_16.8.jpg`, `aut_1km_12.jpg`, `sum_1km_12.jpg`, `sum_1km_16.8.jpg` (at 1 km the mountains fill half the
picture), `coast_12.jpg` (the same on the coast's cliff from the shore: upright pastel leaves, lime, orange and
lilac, on the lit face); crops `audit2/crop_mountains150.jpg` (x2), `crop_mount420.jpg`, `crop_teal420.jpg` (x3).

**What is seen.** The mountains behind the wood are heaps of tall leaf-shaped patches in pastel rose, lime, lemon,
lilac and grey, laid every way, with flat triangles showing through. Neither face of the mountain is in shade; the
colour changes patch to patch for no reason the eye can find. The first audit's F12 (polygons) and F13 (smears) are
not gone; the smear has become big pastel leaves.

**What the references show.** "Rock outcrops, grey-violet"; Breath of the Wild: "cliffs in clear planes"; Rime:
"rock in two or three clear planes of light and shade"; the autumn woods: "a horizon of blue-violet hills, some with
snow". A mountain is a few big planes, lit and shaded, cool with distance.

**Measured.** Top-left mountain at 150 m, noon: under V 0.3, 0.2 per cent of its pixels (autumn) and 0.3 (summer);
V median 0.65-0.81; warm, green and blue families all present at once. At 420 m (crop x3, `crop_teal420.jpg`)
the face is overlapping leaf shapes as big as a tree, lilac, olive, yellow and grey-violet, like stained glass; the
conifers on its foot are frosted teal.

**Which lane.** C. Its FV4 rock faces (`?rockfield=1`, compiled out of v39.2) are the fix that exists: at the coast
cliff they turn the rainbow wall into a layered rock face with beds, seams and a lit lip (reviewed and accepted
today, fv4_cliff_falls_from_sea_68m_AB). What is still needed from C: (a) the 150 m, 400 m and 1 km sheets of the
inland mountains with `?rockfield=1` (promised today); (b) the face's light in TWO OR THREE PLANES (the slope's own
light, never per stroke), with the shaded faces at the cool shade level, so a mountain has a lit side and a dark
side; (c) one rock family per mountain (grey-violet, with the bed tones as small steps inside it), not a rainbow;
(d) then made the default. Cost: FV4's own (C's numbers).

---

## 4. Also seen, shorter

- **Near leaves are big flat shards** (A2). On foot the nearest crown is made of leaf cards the size of a hand at
  arm's length, with straight edges, every one a flat polygon: `crop_leafcards_foot.jpg`. The references' near leaves
  are small dabs with the sky between them; R3.6 (nothing reads as a polygon). Far trees on foot are fine.
- **The light has no design** (F, mine). At noon on foot everything is lit alike and everything is equally busy; the
  references are built as a dark frame of shade round a bright, warm, misty middle distance, with big quiet masses
  (sky, mist, shade) for the busy parts to read against. At 16.8 the far wood does not step back into a pale gold
  glow. The green wood at 16.8 (`green_vista_16.8.jpg`) is the closest the game comes: long shadows across the
  floor; but its back is not lit.
- **A broken white hairline arcs across the sky at 1 km** (F, mine or W1's: `crop_arc1km.jpg`, x2, in
  `aut_1km_12` and `sum_1km_12`, from the horizon up to the right). Most likely the far edge of the cloud deck at
  that height (the deck is hidden by the eye's dip only from 52 degrees; at 1 km the dip is 37). Not yet found in
  the code; mine to chase, since v39.2 draws the sky's own cloud.
- **A storm leaves the land lit like a fair noon** (F, mine; seen in D-W1's stills today, W1_WG_13_stormover_*).

## What I could not settle

- Which of C's canopy and A1's impostors makes the confetti: the `?canopy=0` A/B is in the queue.
- How any of this moves, and the reflections in the game (the gallery shows the water's fallback).
- The cost of the fixes on the phone (derived only).
