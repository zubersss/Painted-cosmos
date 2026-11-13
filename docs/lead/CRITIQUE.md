# CRITIQUE: M4's critique swap (PILOT's file)

The brief's M4: "Each session plays the whole game and writes a blunt critique of the other's
domain." This file holds PILOT's two sections only (the coordinator's rule: PHYSICS writes
`docs/lead/CRITIQUE-PHYSICS.md`, PAINTER `docs/lead/CRITIQUE-PAINTER.md`).

Begun by the eleventh PILOT agent, 2026-11-12 (cut off after three items on PHYSICS); finished by
the twelfth, 2026-11-13. Items run worst first; the top five of each domain are marked **FIX FOR
SHIP** (the owner of the domain decides; the ranking guides the fix round). Each item: what a player
sees or feels, where, the evidence I opened or ran, why it fails, a suggestion.

**What was played, and on what.** The eleventh agent: a clean export of the head `8809fff` (PAINTER
14's work in progress as the coordinator's snapshot, PHYSICS P24 `c4d2242`), with its landing-camera
work over it (it changes nothing either section judges); the top-tier tour of Earth, Mercury, Venus,
the Moon and Mars (spawn, first vista, orbit: fifteen frames, every one settled, no console error;
`/home/user/.pc-scratch/pilot/run11/tour-top/`), feel in Node (`docs/lead/evidence/pilot11/`). The
twelfth: a clean export of the head `ca0b3db` (PAINTER `76d8182`, PILOT `904b6fe`, PHYSICS
`2f924cd`; PAINTER's files differ from `8809fff` in four places: Neptune's cloud streaks, Venus'
lava plain, the stream's glint, a wetland pebble), one browser at a time, other roles rendering
beside it. Played, in this order: the top-tier tour of Jupiter, Saturn, Uranus, Neptune and Pluto
(fifteen frames, every one settled, no console error; `tour/`); from the title card at quality 0
with the keys and the mouse: the card, the first view, the help card, a walk, a run, the jetpack to
20 m, the fall, the walk to the ship, boarding, lift-off, low flight at 46 m/s, the cockpit, the
climb to space (`look-q0/`, nineteen frames; my read-out panel is on them, top left, and is not the
game's); at quality 0 by the debug door to each place and clock: the first storm at the spawn and
the walk east through it and in fair weather, the walk into Earth's sea, swimming, letting go, the
jetpack out of the water, the run at the sea cliff, the ship hovering hands off at Neptune's storm
coast for twelve seconds, midnight on Earth, Mars and the Moon (`play/`, 21 frames and the traces in
`play.json`; no console error, `fallback` empty). (The top-tier frames of the walk, the jetpack,
night, dusk, the storm, the wood ten and fifteen minutes into a new game, the climb, the sea,
Neptune's gale and low flight are being taken as this version is committed: items 1 to 4 say where
their judgement rests on quality 0.) Feel and physics in Node on the same tree with the game's own
weather seed. Scratch: `/home/user/.pc-scratch/pilot/m4/`; the frames and sheets cited are copied to
`docs/lead/evidence/pilot12/`, with the Node instruments and their output (each takes the tree's
root as its first argument).

## PILOT on PAINTER

What holds, first, because it is most of what a player looks at. The paper: every frame of this
play, on ten worlds, in space, by day, by night and in the storm, sits inside a ragged unpainted
border on a warm sheet, granulation lies in every sky, and in the 40 frames measured nothing is
whiter than the paper and at most 2.1 % of a frame is under L* 12 (`pilot12/tone.py`, `tones.txt`):
rule 1's "never pure white, nothing pure black" is kept everywhere. All ten arrivals now pass as
paintings at a glance (review 6 failed two; PAINTER 14 thinned the stones on Pluto and Mercury). The
strongest frames of the game: Saturn from orbit and its gold meadow under the ring arcs, Neptune's
kelp arrival, Venus' fungal forest, Mercury's ochre basins, Mars' canyon, Jupiter's sky, the jetpack
over the home wood, Earth's sea from the water, Neptune's squall sky, and space itself (indigo and
violet washes, spattered stars, a planet's torn-paper tag). At quality 0 the daylight picture is
softer and passes more easily than at the top tier.

1. **FIX FOR SHIP. Night is the daylight picture under a dark blue veil.** At midnight at the Earth
   spawn in fair weather the meadow, the wood, the ship and the figure are one dark indigo-blue: at
   quality 0, 80 % of the frame lies within 9 steps of L* (25 to 34; the same wood by day, at the
   same tier, uses 35), the sky is as dark as the land, nothing is lit and nothing is reserved; Mars
   at midnight is the same sheet (11 steps) with stars on it; the crowns carry a dotted dark outline
   that daylight does not show. It is no longer black (review 6's finding) and it is not a nocturne
   either: it reads as the day frame multiplied by a colour, which is the brief's "a 3D game with a
   filter on top". It outranks every other item because of when it comes: the day is 25 minutes and
   a new game begins at 9:30 (PILOT's numbers), so at the spawn the sun sets seven and a half
   minutes in and rises at twenty-four (`pilot12/hours.mjs`): more than half of a first half hour is
   this picture. The Moon's night passes (Earth lights the sky, the figure and the ship stay
   readable). Evidence: `play/19-night-earth-q0.jpg`, `play/20-night-mars-q0.jpg`,
   `play/21-night-moon-q0.jpg`. Why it fails: art bible 9 ("a day-night cycle shifts the whole
   palette ... indigo night") and 2 (three or four value steps): a painter's night keeps its values.
   Suggestion: build night from its own key instead of darkening day: the sky two steps lighter than
   the wood (a wet indigo wash thinning toward the horizon), the far wood one flat dark, the near
   ground a step lighter with the stream the lightest thing on the land, paper for stars, birch
   trunks and the dome, one warm accent at the ship or the figure; and drop the dotted outlines.
2. **FIX FOR SHIP. The thunderstorm at the spawn is a dark murk in which the rain hardly shows.** At
   238 s of a new game (three in the afternoon by the sun, 23 mm/h; quality 0) the frame's median L*
   is 34 and 80 % of it lies within 16 steps: meadow, wood and sky are one dark grey-green, the
   ragged border is dirtied to the same grey, the puddles are pale smears and the rain is three or
   four thin strokes. Evidence: `play/01-storm-spawn.jpg`. Why it fails: art bible 1 ("distance,
   fog, and the frame edges fade to bare paper, not grey"); a rain study in watercolour is a light
   picture (a wet pale sky, a far wood lost in the veil, rain as strokes lifted out of the darks),
   not the day turned down. Neptune's squall shows PAINTER can do it: a wet-in-wet indigo sky over a
   pale rain veil (`play/15-squall-hover-6s.jpg`; its rain marks at quality 0 are small flat
   rectangles, which is the one digital thing in it). Suggestion: hold the storm's key a step above
   dusk; lighten the sky to wet washes with dark undersides, fade the far wood toward paper inside
   the veil, draw the rain as broken pale diagonals over the darks and the border as clean paper in
   every weather.
3. **FIX FOR SHIP. The edge of the air is a grey-violet slab with white dots on it.** Climbing out
   of Earth, between about 500 m and the 800 m where space begins, the blue sky and the indigo of
   space are mixed half and half into one flat grey-violet, with the stars already on it as white
   specks and a pale washed-out world below; coming down it is the same band the other way. Every
   lift-off and every landing on a world with air crosses it. Evidence: `look-q0/16-climb-120m.jpg`
   (the read-out says 703 m up; quality 0); PAINTER's own `docs/shots/painter/p14-first10.jpg` ("the
   ship at 650 m", top tier) shows the same slab, and PAINTER 15's hand-over calls it the weakest
   frame of the climb. Why it fails: art bible 1 (fades go to paper, not grey) and 8 ("space is not
   black: deep indigo ... washes"): two good washes mixed in the middle make mud, which is what a
   painter avoids by letting one wash stop and the other begin. Suggestion: take the day sky up into
   bare paper (thinner and paler with height, as high air is), and let space arrive from the zenith
   down as a wet-edged indigo wash with a bloom where the two meet; no star before its ground is
   indigo.
4. **FIX FOR SHIP. A crown at the lens is a flat green slab.** Whenever foliage is within a few
   metres of the camera (the jetpack's first second under the birches, the chase camera as the ship
   sets down in the wood, kicked leaves in the downwash) it is drawn as one saturated green shape
   with a smooth outline and a few paler lobes, a fifth to a third of the frame, with no stroke, no
   edge pooling, no paper in it. Evidence: `docs/lead/evidence/motion-landing-pilot11.jpg` (top
   tier: the first frame's upper left, and the leaf blobs of frames 48 to 53);
   `docs/shots/painter/p14-first10.jpg` ("jetpack 0.75 s", top tier). PHYSICS found it too (its item
   3 on PAINTER). Why it fails: art bible 10 ("foliage as layered stroke clusters, not leaves ...
   detail arrives as strokes fading in") and 3 (edge darkening, dry brush): a mass that close should
   break into strokes with paper between, or go soft. Suggestion: near the lens fade a crown's cards
   out by distance (a metre or two of soft fall-off, as the fill fades in), or swap them for a few
   large broken strokes; cap the size of a kicked leaf on screen.
5. **FIX FOR SHIP. Three worlds are not round from orbit, and one is a glass marble.** Earth from a
   radius up is a lumpy potato: the alpine range stands off the lower left limb as a white meringue
   with violet shading, the outline bulges and dents all the way round, and the same lumpy ball
   hangs in the Moon's sky (the brief's one image for the Moon). Pluto is a ridged potato with a
   shoulder on its left and no heart. Neptune's cloud belts curve round the disc as pale arcs
   concentric with the limb and read as reflections on a glass ball; PAINTER 14 halved their
   strength and they still do. Mars and the Moon show flat facets along the limb. Mercury, Venus,
   Jupiter, Uranus and above all Saturn (a banded gold globe inside its ring) pass. Where: every
   pulse-drive arrival ends on this view and every lift-off passes through it. Evidence:
   `tour/8809fff-earth-orbit.jpg`, `tour/8809fff-moon-biome-spawn.jpg`,
   `tour/ca0b3db-pluto-orbit.jpg`, `tour/ca0b3db-neptune-orbit.jpg`, `tour/8809fff-mars-orbit.jpg`,
   `details-1.jpg` (third row); PAINTER's own `docs/shots/painter/p14-orbits.jpg` shows the same.
   Why it fails: a world's limb is the one true curve in the picture; a hand wobbles it by a hair,
   it does not model 300 m of relief on a 4 km ball in silhouette (art bible 4: "silhouettes wobble
   slightly"; 10: "soft organic forms, no visible facets"; 2: no sheen). Suggestion: above about
   half a radius scale the far terrain's relief toward a third, so that the limb closes on the mean
   sphere, and keep the wobble for the hand; lay Neptune's belts along latitude with broken wet
   edges and no arc lighter than the wash beside it; give Pluto's heart one pale wash that reads
   from here.
6. **The reference painting has no paper in it.** Inside the border the Earth spawn's brightest
   hundredth is L* 83.5 and its median 63.5, in a 26-step range; the paper is 94.4. The stream vista
   reaches 87. Sky holes, sunlit grass, white flowers and birch bark are all tinted mid values, and
   the dappled light the brief names is a slightly yellower green (at quality 0 the dapples are
   hard-edged yellow patches, a camouflage pattern: `look-q0/09-at-the-ship.jpg`). PAINTER 14 lifted
   it a little (median 54 to 56 at the stand) and PAINTER 15's hand-over lists it first among what
   is still weak. Evidence: `tour/8809fff-earth-biome-spawn.jpg`,
   `tour/8809fff-earth-vista-earth-temperate_forest-1.jpg`, `tones.txt`. Why it fails: art bible 1,
   the first sentence of the first rule: "paper is the light; the brightest values are bare paper".
   Suggestion: reserve paper: the sky between crowns, the sunlit side of every birch, the white
   flowers, a few sun patches on the meadow with soft edges, the stream's glints (PAINTER 14 had the
   glints as crisp marks in `8809fff` and took them out again); then the darks need not be lighter
   to make the frame read lighter.
7. **Uranus' and Pluto's first views are one pale value with confetti on it.** Uranus' arrival holds
   80 % of its pixels within 15 steps of L* (76 to 91; Mercury's arrival uses 60): a mint sky over a
   mint plain, nothing darker than the figure and the ship, and an even scatter of white splinters
   over the whole ground. Pluto's arrival and its Lilac Mountains vista are the same picture in
   lilac (20 and 21 steps): the ground is two thirds of the frame, the mountains a strip along the
   top of the vista, the splinters white teardrops of one size at one spacing, no long shadow
   anywhere on the world that is named for them. Evidence: `tour/ca0b3db-uranus-biome-spawn.jpg`,
   `tour/ca0b3db-pluto-biome-spawn.jpg`, `tour/ca0b3db-pluto-vista-pluto-lilac_mountains-1.jpg`. Why
   it fails: art bible 2 asks for three or four value steps and 4 for "a few crisp accents" near,
   not hundreds; a pale study still needs one dark. Suggestion: one dark mass in each arrival
   (Uranus: a deep teal crevasse, or the shelf wall's shadow side that its ice-shelves vista already
   has; Pluto: a low sun and a violet glaze stretched from every splinter and stone), and the
   splinters in drifts with bare ground between.
8. **The cockpit is a hoop and a hump.** V in the ship shows one thick brown arch across the whole
   frame, a brown mound for a panel with three pale discs cut by the bottom edge, and the nose as a
   plain sand-coloured field; at quality 0 the arch's edge is a staircase of pixels. Evidence:
   `look-q0/15-cockpit.jpg`. Why it fails: art bible 8 ("everything is painted: explorer, ship ...")
   and 4: this is the frame a player flies whole worlds in, and it is the least painted thing in the
   game. Suggestion: a canopy frame of two or three thin ink-and-wash ribs with a wobble, a panel
   with a hand-drawn edge and the gauges as small washes inside it, the nose with the hull's
   dry-brush grain; or leave the frame out altogether and let the painting fill the window.
9. **Venus' arrival: the lower half is a flat brown floor and the lava a flat orange band.** The
   sky, the fungal towers on the skyline and the basalt spire say Venus at once; under them the
   plain is one brown wash with pebble flecks down to the bottom edge, and the lava river beyond the
   ship is an even orange stripe with no light in it, no stroke, no crust (seen on `8809fff` with
   PAINTER 14's thinner wash; the head went back to the thicker one, `dil` 0.14, so the head's floor
   is darker, not better). Evidence: `tour/8809fff-venus-biome-spawn.jpg`. Why it fails: art bible 3
   (turbulence: no area is flat colour) and 9 (liquid as horizontal strokes with bare-paper glints:
   lava is the one light source on this world). Suggestion: the lava's core as paper inside a
   cadmium halo, dark crust rafts as strokes across it; break the plain with the sulphur crust and
   the ropes of cooled flow the biome already has in its data, largest near the eye.
10. **Jupiter's arrival is an English meadow under a tea-stained sky.** The belts across the sky are
   the best sky in the game, and under them stands a sap-green meadow with round green bushes and
   green leafy trees: Earth. Nothing in the first view says an island in a cloud sea (no edge, no
   cloud floor, no far island); the Cream Sky-Islands vista does say it, with its far islands as
   grey boxes with level tops and upright sides. Evidence: `tour/ca0b3db-jupiter-biome-spawn.jpg`,
   `tour/ca0b3db-jupiter-vista-jupiter-sky_islands-1.jpg`, `details-1.jpg` (bottom right). Why it
   fails: art bible 6 (a limited palette per biome: sap green against cadmium orange is neither
   harmony nor Jupiter) and the brief's "floating sky-islands in banded cream and orange cloud
   seas". Suggestion: turn the arrival's flora toward the sky's family, as Saturn's gold meadow does
   so well (ochre-olive grass, cream and rust crowns), and stand the arrival where the island's edge
   and the cloud sea are in the first view; round the far islands' tops and break their walls into
   two or three leaning planes.
11. **"Ultramarine Storm Seas" is a pale flat calm.** The first vista on Neptune in the tour's held
   fair weather: a grey pebble beach, then a pale blue-grey band without a stroke, a wave or a white
   mark in it, then a low pale headland; no stack in the view, nothing ultramarine, nothing of a
   storm. Evidence: `tour/ca0b3db-neptune-vista-neptune-storm_seas-1.jpg`. Why it fails: art bible 9
   (water as horizontal reflected strokes with bare-paper glints) and the brief's "ultramarine storm
   seas with basalt stacks". Suggestion: turn the vista to face the stacks; draw the sea in its own
   pigment at full strength from the shore out with the strokes Earth's sea has, whatever the
   weather.
12. **Sticker flowers and stitched lines in the reference painting.** At the stream vista the red
   flowers are flat scarlet stars with cut edges, two on the left bank and three at the bottom
   right, and beside them a dark grass blade and the far bank's edge are drawn as rows of evenly
   spaced black dashes; at the spawn the same reds are flat dabs in an even sprinkle with the white
   ones. Neptune's meadow has the same sprinkle in yellow. Evidence:
   `tour/8809fff-earth-vista-earth-temperate_forest-1.jpg`, `details-1.jpg` (top row),
   `tour/ca0b3db-neptune-biome-spawn.jpg`. Why it fails: art bible 3 (pigment pools inside each
   wash; wet-in-wet in soft areas) and 4; a dash pattern is a machine's mark. Suggestion: a flower
   as two or three wet touches with a darker centre and one soft side, in clumps; find what dashes
   the thin dark strokes (it looks like a coverage threshold along a thin quad) and let a thin
   stroke fade instead.
13. **Mars' near shrubs are wine stains, and a crown lies across the figure.** Round the figure at
   Mars' arrival the red-leaf bushes are flat maroon blots without a stem, a light side or a shadow,
   their edges breaking into specks; one stands between the lens and the figure's legs. Far off, the
   same trees with a trunk read well. Saturn's nearest crown is cleaner (flat ochre patches with
   torn edges), but in the Pale Gold Sky-Islands vista a yellow smear of it lies across the figure's
   hips. Evidence: `tour/8809fff-mars-biome-spawn.jpg`,
   `tour/ca0b3db-saturn-vista-saturn-gold_islands-1.jpg`, `details-1.jpg` (second row). Why it
   fails: art bible 2 (value steps inside a shape) and 10 (layered stroke clusters). Suggestion: a
   near shrub gets a second, darker layer low on its shadow side and a few twig strokes; nothing of
   a crown between the lens and the figure inside the boom's length (fade it, as PILOT's camera
   already keeps trunks out).
14. **The figure stands like a peg doll.** Close to (Uranus' and Pluto's vistas, where the boom is
   short) the explorer is a hat on a trapezoid coat on two parallel pegs, arms straight down, with a
   hard dark disc for a shadow under the boots on grass (Jupiter) and a saturated blue blob on ice
   and glass (Uranus, Mercury). Its washes are good (the coat's dry brush, the red roll, the pack)
   and it never looks like plastic; it looks like a toy set down in a painting. PHYSICS' critique
   has the rest, and I saw each of them: no lean in a wind, no swimmer (afloat it is the standing
   figure cut off at the shoulders: `play/07-swimming.jpg`), the falling pose on the way up.
   Evidence: `figure-standing.jpg` (three stands at three times the size),
   `tour/ca0b3db-uranus-vista-uranus-ice_shelves-1.jpg`,
   `tour/ca0b3db-pluto-vista-pluto-lilac_mountains-1.jpg`. Why it fails: art bible 8 (the explorer
   is painted too) and 4 (the painter's hand: a figure in a landscape is a gesture). Suggestion: an
   idle pose with the weight on one leg and one hand at the strap; the contact shadow as a soft
   violet glaze stretched away from the sun, never a disc.
15. **A white cloud at the boots on the forest floor.** Stopping at the ship under the birches
   (quality 0) leaves a pale bloom on the ground as wide as the ship's wing, which stays for the
   whole boarding; on the litter it reads as smoke, not dust. Evidence:
   `look-q0/09-at-the-ship.jpg`, `look-q0/10-climbing-in.jpg` (bottom centre). PHYSICS decides where
   dust rises (P25 took it off the open sward); the mark is PAINTER's. Why it fails: art bible 9
   (life as a few brush marks) and 6 (harmony: a white bloom on a dark olive floor). Suggestion: a
   puff the colour of its ground, a third the size, gone in a second.

**In the order a new player meets it** (frames under `docs/lead/evidence/pilot12/`; "top" is quality
2, "q0" quality 0, both 960x540; every frame named here was opened):

(The table of every beat with its frames is written with the top-tier set; until then the frames are
named in the items above and in "What was played".)

## PILOT on PHYSICS

What holds, first, because it is most of the game: on Earth the walk and the run are crisp and even
(4.2 and 7.4 m/s, 90 % of pace in 0.4 and 0.8 s, a stop in 0.5 and 0.8 s); every world has its own
weight under the feet and the jetpack (a hop 1.2 m on Earth, 0.9 on Jupiter, 2.8 on Mars, 6.4 on the
Moon, 10.4 on Pluto); the ship's legs take every landing softly (0.76 to 0.79 m/s at touchdown on
five worlds, 4.3 s from a 25 m hover); the knife-edge ruling is in and nobody is thrown up off a
rim. Measured in `feel.txt`, `shipfeel.txt`, `jet.mjs` (evidence folder above). From the twelfth
agent's play: every world's air shows in the flight (the same half throttle is 17 m/s on Venus, 23
on Earth, 25 on Neptune, 40 on Mars; `pilot12/shipair.txt`); a parked ship stays parked in a 100 m/s
wind (0.3 m in 20 s); a walker in Neptune's 81 m/s squall keeps its feet and makes 1.6 to 3.1 m/s
(`pilot12/stormwalk.txt`); a swimmer rides Earth's chop without ever going under
(`pilot12/afloat.txt`).

Items 1, 3 and 7 are the eleventh agent's (kept as written, renumbered); 2, 4, 5, 6 and 8 are the
twelfth's, from the storm, the sea, low flight and the ship's handling.

1. **FIX FOR SHIP. The explorer runs up cliffs.** Hold Shift+W into a sea cliff or a canyon wall on
   Earth and the figure goes straight up the face, feet on it the whole way, at 5.6 to 6.0 m/s
   vertical: from Earth's `sea_coast` stand 49 to 50 m up 70 to 79 degree faces in three of eight
   headings (0, 270, 315); from `desert_canyon` 24 to 31 m up 72 to 81 degree walls (headings 225,
   270). On Earth's gravity that is 5.7 kW from a 100 kg walker, and in third person it is a figure
   jogging up a cliff like a fly on a window: the one thing on foot that looks broken rather than
   unpolished. Evidence: `docs/lead/evidence/pilot11/wallrun.mjs` and `wallrun.txt` (Node, the real
   worlds, 12 s from a stand), `slowwhy.mjs <root> earth desert_canyon 225` (every half second:
   slope 67 to 74 degrees, the ground 9 to 10 m higher 3 m on, the body 28 m higher in 5 s, `gait`
   0). **It is a regression, bisected**: with PHYSICS as of `3cd06dc` (P21) and before, the same run
   at the sea cliff climbs 0.8 m/s and stops (0.3 m gained on ground over 50 degrees); with
   `e20f900` (P22 part 1, "the way, seen") and every commit since, 49.9 m. Suggestion: find what P22
   changed for a face that is too steep to hold by friction and higher than a clamber (the "a face
   ... low ... is a step: legs and hands" rule at `explorer.js` :999 looks only one look ahead;
   something in P22's way-reading lets the limbs' hold carry the body up a high face); such a face
   stops the walker at its foot (it may slide back), as P21 did. Add a test: a 70 degree face 10 m
   high on Earth and on Mars, Shift+W for 10 s at 30 and 60 Hz: less than a clamber gained. In the
   game (quality 0, Shift+W from the coast stand on heading 0): 46.2 m up in 9 s on 74 to 78
   degrees, `grounded` true, mode `walk` (`pilot12/play/11-cliff-run-9s.jpg`; `play.json`, trace
   `cliff-run`). On the head `ca0b3db` (PHYSICS `2f924cd`) the instrument gives the same numbers:
   49.9, 49.0 and 49.7 m at Earth's sea cliff.
2. **FIX FOR SHIP. Rain stops a walk dead on a forest bank, for nine of a new game's first ten
   minutes.** PHYSICS' first thunderstorm reaches the spawn 140 s into every new game (the default
   seed: drizzle at 140 s, 23 mm/h at 230 s, the last drops at 320 s; `pilot12/onset.txt`). From
   then on, W held eastward from the first view (headings 67 and 90, the bank under the wood 20 m
   from the spawn) carries the figure onto 23 to 26 degrees of leaf litter and there it stops: 0.07
   to 0.2 m/s, mode `idle`, for 3.8 to 6 s at a time with the key down; the same bank is walked dry
   at 3 to 4 m/s (`pilot12/wetbank.txt`, the pair, every half second; `wetstall.txt`, sixteen
   headings at five clocks). The litter's friction falls from 0.60 to 0.36 when wet (the tangent of
   20 degrees) and the ground stays wet long after the rain (0.86 at 440 s): two of sixteen headings
   still stall at 420 s and at 700 s, none at 1200 s. Shift+W gets over it (5.6 m/s in the slowest
   second) and so does the jetpack, but a new player walking has no way to know that. In the game
   (quality 0, the W key, the clock at 238 s; `pilot12/play/play.json`, traces `storm-walk-east` and
   `fair-walk-east`): 21.6 m from the spawn the figure stands at 0.04 to 0.11 m/s on 25 degrees for
   2.5 s, mode `idle`, then walks on up 31 to 33 degrees of the same wet litter at 4.2 to 4.4 m/s,
   faster than it climbs that slope dry (3.1 m/s): 36 m in 12 s against 46 m dry. So the standstill
   is not the friction law alone: something holds, and lets go. Why it fails: "the player should
   never fight the controls", and here a key is held and nothing happens, on ground that looks like
   the rest of the forest floor, with no slip, no slide back and no sound to say why; and a walker
   on wet leaves at 25 degrees does not stand still either: he goes up on short steps, or slides.
   Suggestion: between the wet friction angle and the dry limit keep a slow climb on short steps
   (1.5 to 2 m/s; the suit's assist is there for this) or let the feet slip back visibly; never a
   standstill with the key down on ground under 30 degrees. Test: Earth's spawn at clocks 240 and
   420, W on sixteen headings for 14 s: no second under 1 m/s on ground under 30 degrees.
3. **FIX FOR SHIP. The run is still checked hard at some rims and boulder rows** (PHYSICS P24's own
   open items: the descent hold off P22's small rim 3.84 to 1.27 m/s; a knife edge met at about 3.5
   m/s where the law allows 6.3; heading 315 up the 60 degree ridge 2.7 to 3.3 m/s). On the arrival
   ground a player actually runs, from a stand, eight headings, 12 s (`runfield.mjs`,
   `runfield.txt`): the Moon's new near-side `crater_fields` stand is good (7.1 m/s mean, slowest
   second 2.9 m/s), but Pluto's spawn drops to 1.27 m/s for a second (heading 135), Mercury's to
   1.58 (heading 0), Earth's desert canyon to 1.21 (the cliffs of item 1). A sudden check from 7 m/s
   to 1.3 reads as hitting an invisible wall, and the player cannot see why. Suggestion: P24's
   "Next" (0) and (1) together (let P21's hold on the way down go where the ground truly falls away;
   skip the point short of a knife edge's top), measured on these stands as well as on boulderrun's
   site.
4. **FIX FOR SHIP. Neptune's storm coast throws the ship about like a leaf; Earth's storm does not
   touch it.** Hovering hands off at 30 m over the `storm_seas` stand (the place the sketchbook
   sends the player to) at clocks 205 and 236 of the game's own weather: the wind at the hull runs
   from 36 to 262 m/s within seconds, and where it meets the 50 m sea cliff its upward part is 104
   to 164 m/s. In 30 s the ship is carried 107 to 186 m; its height swings between 7 and 78 m (33 m
   in one second); it is flung up the cliff at 57 to 61 m/s; the hull takes 5 to 12 g for two
   seconds on end, and 25 to 44 g in single frames near the ground (there PILOT's cushion acts too:
   PHYSICS' own item 3 on PILOT); the drawn hull rocks 25 to 31 degrees all the while
   (`pilot12/hovertrace.txt`, every half second; `shipair.txt`). The same hover in Earth's
   thunderstorm, 15 to 36 m/s at the hull and gusting, moves 0.0 m and rocks 0.3 degrees. So the
   ship feels nothing, or it is in a tumble dryer; there is no storm in between. In the game
   (quality 0; `pilot12/play/12-squall-hover-start.jpg` to `18-squall-hover-12s.jpg`, `play.json`):
   with 40 to 147 m/s at the hull the hover is pushed from 30 m down to 3.4 m, sits on the cushion
   at 6 m for six seconds with the hull rolled about 25 degrees, and is then thrown up to 27 m at 12
   m/s. Why it fails: the brief's ship is "forgiving arcade flight" in a game with no fail state,
   the camera is fixed to that hull, and a vertical wind of 160 m/s at a 50 m cliff is not weather
   on any world (P23 gave the walker a cap for exactly this cliff; the ship got none). Suggestion:
   cap what the hull is handed (gusts at about 1.5 times the mean wind, the terrain's upward part at
   a third of the horizontal), let the flight computer hold station inside a stated wind and show a
   storm as drift of a few metres and 5 to 10 degrees of rock, and give Earth's 30 m/s storm 2 to 4
   degrees of it. Test: hands off for 30 s over the stand at clocks 205 and 236: within 15 m, within
   10 m of height, under 1.5 g.
5. **FIX FOR SHIP. The first storm comes two minutes into every new game, and the wood is wet and
   misty for the quarter of an hour after.** At the spawn, by the game's own clock (`onset.txt`,
   `wxflicker.txt`, `pilot12/wxscan.mjs`): a breeze for 130 s, overcast from 0.02 to 0.63 in the 40
   s after, thunderstorm from 160 to 300 s, then mist from 390 s to 1440 s (and again from 2100 s),
   the ground wet through the first of it. The brief's reference painting is "dappled light and a
   stream", and a new player stands in it for two minutes; minutes three to fifteen are a storm and
   its fog, which is also the time item 2's bank is a wall and the time most players spend learning
   to walk and finding the ship. Suggestion: PHYSICS' call on the weather, PILOT's on the first ten
   minutes: hold the first front off the spawn until about ten minutes of play (a seed offset, not a
   new law), let it come over a minute or two rather than 40 s, and let the sward dry in three or
   four minutes once the sun is back.
6. **Swimming is a glide at one speed, in a sea that carries nothing.** Off Earth's coast
   (`pilot12/swim.txt`, `afloat.txt`, Node; in the game at quality 0,
   `pilot12/play/06-wading-in.jpg` to `09-jet-out-of-the-water.jpg` and the traces in `play.json`:
   2.05 to 2.08 m/s afloat, 0.02 m/s 1.2 s after the key is let go): W gives 2.0 to 2.1 m/s afloat
   and Shift+W gives the same (1.95); letting go stops the body within half a metre; the feet ride
   0.6 m of chop under a sea that is never more than 0.5 m high in the first 100 minutes of the
   game's weather (`seascan.mjs`: significant height 0.14 to 0.46 m, period 1.6 s). In Neptune's
   storm sea (3 to 3.5 m high, 41 to 70 m/s of wind, whitecaps 85 to 100 %) a swimmer who lets go
   rises and falls 3.4 m at up to 0.9 g and is moved half a metre in 12 s: neither the wind nor the
   breaking sea carries a floating body anywhere; swimming there at 2.7 m/s the head is under the
   crest for 5 to 27 % of the time. An upright body in a coat making 2 m/s through water with no
   stroke is a sprint swimmer's pace, and nothing in the pace says how. PHYSICS has already sent the
   pose to PILOT and PAINTER (its items 5 and 2); the body's part: give the pace a stroke (a surge
   and a glide, 1.6 to 2.4 m/s over a stroke of 1.5 to 2 m, so the swimmer PAINTER draws has a beat
   to follow), let Shift be a faster stroke, let a body afloat drift a little downwind and toward
   the shore in surf (0.2 to 0.5 m/s in a gale), and let it heave with the surface so that the head
   stays out.
7. **Physics nobody has watched move.** Grass parting round the feet, crowns in the gusts, rain and
   snow, the sea's swell, the ship's downwash: every claim is a number from Node or a strip of
   frames, and the one strip I filmed this block shows the downwash's kicked leaves as large flat
   dark-green blobs crossing a trunk a few metres from the lens, changing place by 30 to 50 px a
   frame (`docs/lead/evidence/motion-landing-pilot11.jpg`, frames 48 to 53; the drawing is
   PAINTER's, the flight PHYSICS'). Leaves kicked at the lens of a chase camera fill a tenth of the
   frame each. Suggestion: keep the downwash's kicked leaves and dust out of the 4 m in front of the
   camera (or below a size on screen), and film each of the motion kinds once at the top tier, as
   P23 did for the gale.
8. **The weather's names do not match its wind.** Standing ten minutes at Neptune's storm coast the
   weather changes its name twelve times (one every 50 s: thunderstorm, rain, drizzle, mist, ice
   fall, drizzle, rain, thunderstorm ...), and for 348 of those 600 s it is called `mist` while the
   wind there runs from 5 to 41 m/s (`wxflicker.txt`). Mist does not stand in a gale; whatever
   PAINTER and the sound hang on the name (a fog kit, a calm bed) is then wrong for the air it is
   in. Suggestion: above about 12 m/s call it spray or spindrift (or `windy` with its visibility),
   and hold a name for at least a minute.
