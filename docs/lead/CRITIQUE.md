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
(fifteen frames, every one settled, no console error; `tour/`; the tour holds fair weather, so every
arrival and vista is judged in it); from the title card at quality 0 with the keys and the mouse:
the card, the first view, the help card, a walk, a run, the jetpack to 20 m, the fall, the walk to
the ship, boarding, lift-off, low flight at 46 m/s, the cockpit, the climb to space (`look-q0/`,
nineteen frames; my read-out panel is on them, top left, and is not the game's); at quality 0 by the
debug door to each place and clock: the first storm at the spawn and the walk east through it and in
fair weather, the walk into Earth's sea, swimming, letting go, the jetpack out of the water, the run
at the sea cliff, the ship hovering hands off at Neptune's storm coast for twelve seconds, midnight
on Earth, Mars and the Moon (`play/`, 21 frames and the traces in `play.json`); at the top tier, the
keys for the walk and the jetpack and the debug door for the rest: the walk, the jetpack at 10 and
20 m, midnight and dusk at the spawn, the storm at 240 s, the wood at 600 s and at 900 s of a new
game, the sky at 300 m and at 760 m, the world from 1.3 km, the wood from 350 m, Earth's coast and
sea, Neptune's storm coast at 150 s, the ship over the wood at rest and at 46 m/s, the cockpit
(`look-top/`, eighteen frames); last at quality 0, low flight on Earth and Mars (throttle, turn,
brake, landing; `play-lowfly/`) and the cliff run again on PHYSICS' fix (`play-cliff-fixed/`). Every
run: no console error, `fallback` empty. Every frame named in this file was opened. Feel and physics
in Node on the same tree with the game's own weather seed. Scratch:
`/home/user/.pc-scratch/pilot/m4/`; the frames and sheets cited are copied to
`docs/lead/evidence/pilot12/`, with the Node instruments and their output (each takes the tree's
root as its first argument).

## PILOT on PAINTER

What holds, first, because it is most of what a player looks at. The paper: every frame of this
play, on ten worlds, in space, by day, by night and in the storm, sits inside a ragged unpainted
border on a warm sheet, granulation lies in every sky, and in the 69 frames measured the painting is
nowhere whiter than the paper (the only lighter pixels are PILOT's HUD tags) and at most 2.9 % of a
frame is under L* 12 (`pilot12/tone.py`, `tones.txt`): rule 1's "never pure white, nothing pure
black" is kept, with the one near miss of item 2's storm sky. All ten arrivals now pass as paintings
at a glance (review 6 failed two; PAINTER 14 thinned the stones on Pluto and Mercury). The strongest
frames of the game: Saturn from orbit and its gold meadow under the ring arcs, Neptune's kelp
arrival, Venus' fungal forest, Mercury's ochre basins, Mars' canyon, Jupiter's sky, the home wood
from the jetpack and from the ship, Earth's sea from the water, Neptune's storm coast in its own
weather, and space itself (indigo and violet washes, spattered stars, a planet's torn-paper tag). By
day and in fair weather the game is very nearly what the brief asks for, at both tiers; at quality 0
the picture is softer and passes more easily still. What fails is what happens when the light goes.

1. **FIX FOR SHIP. Night is the daylight picture under a dark blue veil.** At midnight at the Earth
   spawn in fair weather the meadow, the wood, the ship and the figure are one dark indigo-blue: at
   the top tier 80 % of the frame lies within 7 steps of L* (25 to 32; the same view at ten in the
   morning uses 26, at dusk 24), at quality 0 within 9; the sky is as dark as the land, nothing is
   lit and nothing is reserved; Mars at midnight is the same sheet with stars on it (11 steps); the
   crowns carry a peppering of dark specks along their edges that daylight does not show. It is no
   longer black (review 6's finding) and it is not a nocturne either: it reads as the day frame
   multiplied by a colour, which is the brief's "a 3D game with a filter on top". It outranks every
   other item because of when it comes: the day is 25 minutes and a new game begins at 9:30 (PILOT's
   numbers), so at the spawn the sun sets seven and a half minutes in and rises at twenty-four
   (`pilot12/hours.txt`): more than half of a first half hour is this picture, and the night a new
   player actually meets has PHYSICS' mist in it, the same sheet with the far wood fogged
   (`look-top/08-fifteen-minutes-in-night.jpg`, the spawn at 900 s of a new game). Dusk passes (a
   gold-olive wood under a rose-grey sky), and so does the Moon's night (Earth lights the sky; the
   figure and the ship stay readable). Evidence: `look-top/04-night-earth-spawn.jpg`,
   `play/19-night-earth-q0.jpg`, `play/20-night-mars-q0.jpg`; for the pair
   `look-top/05-dusk-earth-spawn.jpg`, `play/21-night-moon-q0.jpg`. Why it fails: art bible 9 ("a
   day-night cycle shifts the whole palette ... indigo night") and 2 (three or four value steps): a
   painter's night keeps its values. Suggestion: build night from its own key instead of darkening
   day: the sky two steps lighter than the wood (a wet indigo wash thinning toward the horizon), the
   far wood one flat dark, the near ground a step lighter with the stream the lightest thing on the
   land, paper for stars, birch trunks and the dome, one warm accent at the ship or the figure; and
   take the specks off the crowns.
2. **FIX FOR SHIP. The thunderstorm at the spawn is as dark as midnight, and no rain is to be seen
   in it.** At 240 s of a new game (three in the afternoon by the sun, 23 mm/h) the top-tier frame's
   median L* is 27, which is midnight's (27), and 80 % of it lies within 13 steps: the sky is the
   darkest thing in the picture (its darkest hundredth is at L* 8, the one place in this play where
   the painting comes near black; `details-storm-top-left.jpg`, twice the size), the crowns stand
   against it as paler cut-outs, meadow and wood are one grey-blue, the ragged border is dirtied to
   the same grey, and there is not one rain stroke in the frame. At quality 0 it is a little lighter
   (median 34) and greener, with three or four thin strokes and puddles as pale smears. Ten minutes
   into a new game, with the storm over and PHYSICS' mist in the wood after sunset, the picture is
   the same sheet again (median 29, 13 steps). Evidence: `look-top/06-storm-earth-spawn.jpg`,
   `look-top/07-ten-minutes-in-mist.jpg`, `play/01-storm-spawn.jpg`. Why it fails: art bible 1
   ("distance, fog, and the frame edges fade to bare paper, not grey"; "nothing is pure black") and
   9 (weather as life): a rain study in watercolour is a light picture (a wet pale sky, a far wood
   lost in the veil, rain as strokes lifted out of the darks), not the day turned down to night.
   Neptune's squall shows PAINTER can do it: a wet-in-wet indigo sky over a pale rain veil
   (`play/15-squall-hover-6s.jpg`, quality 0; its rain marks there are small flat rectangles, the
   one digital thing in it). Suggestion: hold a storm's key above dusk's; a sky of wet washes with
   dark undersides that is still lighter than the wood, the far wood fading toward paper inside the
   veil, rain as broken pale diagonals over the darks at every tier, and a border of clean paper in
   every weather; mist as paper coming forward, not as a grey-blue laid over everything.
3. **FIX FOR SHIP. Three worlds are not round from orbit, and one is a glass marble.** Earth from a
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
   `details-1.jpg` (third row), `look-top/11-just-in-space-looking-down.jpg` (from 1.3 km the snow
   ranges stand on the horizon as two white lumps); PAINTER's own
   `docs/shots/painter/p14-orbits.jpg` shows the same. Why it fails: a world's limb is the one true
   curve in the picture; a hand wobbles it by a hair, it does not model 300 m of relief on a 4 km
   ball in silhouette (art bible 4: "silhouettes wobble slightly"; 10: "soft organic forms, no
   visible facets"; 2: no sheen). Suggestion: above about half a radius scale the far terrain's
   relief toward a third, so that the limb closes on the mean sphere, and keep the wobble for the
   hand; lay Neptune's belts along latitude with broken wet edges and no arc lighter than the wash
   beside it; give Pluto's heart one pale wash that reads from here.
4. **FIX FOR SHIP. Jupiter's arrival is an English meadow under a tea-stained sky.** The belts
   across the sky are the best sky in the game, and under them stands a sap-green meadow with round
   green bushes and green leafy trees: Earth. Nothing in the first view says an island in a cloud
   sea (no edge, no cloud floor, no far island); the Cream Sky-Islands vista does say it, with its
   far islands as grey boxes with level tops and upright sides. Evidence:
   `tour/ca0b3db-jupiter-biome-spawn.jpg`, `tour/ca0b3db-jupiter-vista-jupiter-sky_islands-1.jpg`,
   `details-1.jpg` (bottom right). Why it fails: art bible 6 (a limited palette per biome: sap green
   against cadmium orange is neither harmony nor Jupiter) and the brief's "floating sky-islands in
   banded cream and orange cloud seas". Suggestion: turn the arrival's flora toward the sky's
   family, as Saturn's gold meadow does so well (ochre-olive grass, cream and rust crowns), and
   stand the arrival where the island's edge and the cloud sea are in the first view; round the far
   islands' tops and break their walls into two or three leaning planes.
5. **FIX FOR SHIP. Uranus' and Pluto's first views are one pale value with confetti on it.** Uranus'
   arrival holds 80 % of its pixels within 15 steps of L* (76 to 91; Mercury's arrival uses 60): a
   mint sky over a mint plain, nothing darker than the figure and the ship, and an even scatter of
   white splinters over the whole ground. Pluto's arrival and its Lilac Mountains vista are the same
   picture in lilac (20 and 21 steps): the ground is two thirds of the frame, the mountains a strip
   along the top of the vista, the splinters white teardrops of one size at one spacing, no long
   shadow anywhere on the world that is named for them. Evidence:
   `tour/ca0b3db-uranus-biome-spawn.jpg`, `tour/ca0b3db-pluto-biome-spawn.jpg`,
   `tour/ca0b3db-pluto-vista-pluto-lilac_mountains-1.jpg`. Why it fails: art bible 2 asks for three
   or four value steps and 4 for "a few crisp accents" near, not hundreds; a pale study still needs
   one dark. Suggestion: one dark mass in each arrival (Uranus: a deep teal crevasse, or the shelf
   wall's shadow side that its ice-shelves vista already has; Pluto: a low sun and a violet glaze
   stretched from every splinter and stone), and the splinters in drifts with bare ground between.
6. **Under the canopy the reference painting has no paper in it.** Inside the border the Earth
   spawn's brightest hundredth is L* 83.5 and its median 63.5, in a 26-step range; the walk under
   the birches has a median of 53; the stream vista reaches 87; the paper is 94.4. Sky holes, sunlit
   grass, white flowers and birch bark are all tinted mid values, and the dappled light the brief
   names is a slightly yellower green (at quality 0 the dapples are hard-edged yellow patches, a
   camouflage pattern). As soon as the sky is in the frame the paper is there (the jetpack and
   flight frames reach 93). PAINTER 14 lifted the wood a little (median 54 to 56 at the stand) and
   PAINTER 15's hand-over lists it first among what is still weak. Evidence:
   `tour/8809fff-earth-biome-spawn.jpg`, `tour/8809fff-earth-vista-earth-temperate_forest-1.jpg`,
   `look-top/01-walking.jpg`, `look-q0/09-at-the-ship.jpg`, `tones.txt`. Why it fails: art bible 1,
   the first sentence of the first rule: "paper is the light; the brightest values are bare paper".
   Suggestion: reserve paper in the wood: the sky between crowns, the sunlit side of every birch,
   the white flowers, a few soft-edged sun patches on the meadow, the stream's glints (PAINTER 14
   had the glints as crisp marks in `8809fff` and took them out again); then the darks need not be
   lighter for the frame to read lighter.
7. **Venus' arrival: the lower half is a flat brown floor and the lava a flat orange band.** The
   sky, the fungal towers on the skyline and the basalt spire say Venus at once; under them the
   plain is one brown wash with pebble flecks down to the bottom edge, and the lava river beyond the
   ship is an even orange stripe with no light in it, no stroke, no crust (seen on `8809fff` with
   PAINTER 14's thinner wash; the head went back to the thicker one, `dil` 0.14, so the head's floor
   is darker, not better). Evidence: `tour/8809fff-venus-biome-spawn.jpg`. Why it fails: art bible 3
   (turbulence: no area is flat colour) and 9 (liquid as horizontal strokes with bare-paper glints:
   lava is the one light source on this world). Suggestion: the lava's core as paper inside a
   cadmium halo, dark crust rafts as strokes across it; break the plain with the sulphur crust and
   the ropes of cooled flow the biome already has in its data, largest near the eye.
8. **The cockpit is a hoop and a hump.** V in the ship shows one thick wooden arch across the whole
   frame, a perfect ellipse with a turned-wood gradient; a brown mound for a panel with three pale
   discs cut off by the bottom edge; the nose as a plain sand-coloured field with an orange knob. At
   the top tier its washes are painted and its edges clean; at quality 0 the arch's edge is a
   staircase of pixels. Evidence: `look-top/18-cockpit.jpg`, `look-q0/15-cockpit.jpg`. Why it fails:
   art bible 8 ("everything is painted: explorer, ship ...") and 4 (never ruler-straight, and a
   ruled ellipse is the same thing): this is the frame a player may fly whole worlds in, and it is
   the least drawn thing in the game. Suggestion: a canopy frame of two or three thin ink-and-wash
   ribs with a wobble, a panel with a hand-drawn edge and the gauges inside the frame as small
   washes, the hull's dry-brush grain on the nose; or no frame at all and the painting in the whole
   window.
9. **A crown at the lens is a flat green slab.** When foliage is within a few metres of the camera
   (the jetpack's first second under the birches, the chase camera as the ship sets down in the
   wood, kicked leaves in the downwash) it is drawn as one saturated green shape with a smooth
   outline and a few paler lobes, a fifth to a third of the frame, with no stroke, no edge pooling
   and no paper in it. It is brief: 1.7 s into a jetpack burn the figure is 10 m up and the same
   crowns, a few metres off, are among the best things in the game (`look-top/02-jetpack.jpg`,
   `03-jetpack-high.jpg`). Evidence: `docs/lead/evidence/motion-landing-pilot11.jpg` (top tier: the
   first frame's upper left, and the leaf blobs of frames 48 to 53);
   `docs/shots/painter/p14-first10.jpg` ("jetpack 0.75 s", top tier). PHYSICS found it too (its item
   3 on PAINTER, a FIX FOR SHIP there). Why it fails: art bible 10 ("foliage as layered stroke
   clusters ... detail arrives as strokes fading in") and 3: a mass that close should break into
   strokes with paper between, or go soft. Suggestion: near the lens fade a crown's cards out over a
   metre or two, as the fill fades in, or swap them for a few large broken strokes; cap the size of
   a kicked leaf on screen.
10. **Below the edge of the air the sky turns to grey-violet mud.** Climbing out of Earth, somewhere
   between 550 and 750 m (space begins at 800), the blue sky and the indigo of space are mixed half
   and half into one flat grey-violet with the stars already on it as white specks, over a pale
   washed-out world; coming down it is the same band the other way, and a landing sinks through it
   for some seconds. At 300 m the sky is one of the best in the game (soft cloud washes on blue) and
   at 760 m it is already a slate-violet wash with stars that passes; the mud is the band between.
   Evidence: `look-q0/16-climb-120m.jpg` (the read-out says 703 m up; quality 0, and the frame is
   mine to blame for its name: the ship flew on while the world settled);
   `docs/shots/painter/p14-first10.jpg` ("the ship at 650 m", top tier), which PAINTER 15's
   hand-over calls the weakest frame of the climb; for the pair `look-top/09-climb-300m.jpg`,
   `10-edge-of-the-air.jpg`. Not taken by me at the top tier inside the band. Why it fails: art
   bible 1 (fades go to paper, not grey) and 8 (space as deep indigo washes): two good washes mixed
   in the middle make mud. Suggestion: take the day sky up into bare paper (thinner and paler with
   height, as high air is), and let space arrive from the zenith down as a wet-edged indigo wash
   with a bloom where the two meet; no star before its ground is indigo.
11. **Sticker flowers and stitched lines in the reference painting.** At the stream vista the red
   flowers are flat scarlet stars with cut edges, two on the left bank and three at the bottom
   right, and beside them a dark grass blade and the far bank's edge are drawn as rows of evenly
   spaced black dashes, as are the twigs in the crowns over the walk (`look-top/01-walking.jpg`, top
   left); at the spawn the same reds are flat dabs in an even sprinkle with the white ones.
   Neptune's meadow has the same sprinkle in yellow. Evidence:
   `tour/8809fff-earth-vista-earth-temperate_forest-1.jpg`, `details-1.jpg` (top row),
   `tour/ca0b3db-neptune-biome-spawn.jpg`. Why it fails: art bible 3 (pigment pools inside each
   wash; wet-in-wet in soft areas) and 4; a dash pattern is a machine's mark. Suggestion: a flower
   as two or three wet touches with a darker centre and one soft side, in clumps; find what dashes
   the thin dark strokes (it looks like a coverage threshold along a thin quad) and let a thin
   stroke fade instead.
12. **Mars' near shrubs are wine stains, and a crown lies across the figure.** Round the figure at
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
13. **The figure stands like a peg doll.** Close to (Uranus' and Pluto's vistas, where the boom is
   short) the explorer is a hat on a trapezoid coat on two parallel pegs, arms straight down, with a
   hard dark disc for a shadow under the boots on grass (Jupiter) and a saturated blue blob on ice
   and glass (Uranus, Mercury). Its washes are good (the coat's dry brush, the red roll, the pack)
   and it never looks like plastic; it looks like a toy set down in a painting. In motion it is
   better than at rest: the walk and the run read as strides, the jet pose with the arms out is
   right. PHYSICS' critique has the rest, and I saw each of them: no lean in Neptune's wind
   (`look-top/15-neptune-gale.jpg`), no swimmer (afloat it is the standing figure cut off at the
   chest: `look-top/14-swimming.jpg`), the fall pose with the arms straight out while still rising
   (`look-q0/08-falling.jpg`). Evidence: `figure-standing.jpg` (three stands at three times the
   size), `tour/ca0b3db-uranus-vista-uranus-ice_shelves-1.jpg`,
   `tour/ca0b3db-pluto-vista-pluto-lilac_mountains-1.jpg`. Why it fails: art bible 8 (the explorer
   is painted too) and 4 (the painter's hand: a figure in a landscape is a gesture). Suggestion: an
   idle pose with the weight on one leg and one hand at the strap; the contact shadow as a soft
   violet glaze stretched away from the sun, never a disc.
14. **A white cloud at the boots on the forest floor.** Stopping at the ship under the birches
   (quality 0) leaves a pale bloom on the ground as wide as the ship's wing, which stays for the
   whole boarding; on the litter it reads as smoke, not dust. Evidence:
   `look-q0/09-at-the-ship.jpg`, `look-q0/10-climbing-in.jpg` (bottom centre). PHYSICS decides where
   dust rises (P25 took it off the open sward); the mark is PAINTER's. Why it fails: art bible 9
   (life as a few brush marks) and 6 (harmony: a white bloom on a dark olive floor). Suggestion: a
   puff the colour of its ground, a third the size, gone in a second.

**In the order a new player meets it** (frames under `docs/lead/evidence/pilot12/`; "top" is quality
2, "q0" quality 0, both 960x540; every frame named here was opened):

- **The title card over the forest** (q0 `look-q0/01-title.jpg`, `03-help-card.jpg`): PILOT's own
  card on PAINTER's paper. It passes as a sheet and it hides the painting: the card covers the
  middle 58 % of the frame with twenty key caps, and the wood shows in a strip each side (own side,
  below).
- **The first view** (top `tour/8809fff-earth-biome-spawn.jpg`; q0 `look-q0/02-first-view.jpg`):
  passes at both tiers; still the reference painting. Item 6.
- **Walking and running** (top `look-top/01-walking.jpg`; q0 `look-q0/04-walking.jpg`,
  `05-running.jpg`): pass; the top-tier walk under the birches is a rich, dense wood (items 6 and 11
  for its key and its dashed twigs); at quality 0 the dapples are hard-edged yellow patches.
- **The jetpack** (top `look-top/02-jetpack.jpg`, `03-jetpack-high.jpg`; q0
  `look-q0/06-jetpack.jpg`, `07-jetpack-high.jpg`, `08-falling.jpg`): over the crowns, at both
  tiers, among the best views in the game; item 9 for the first second under them; the fall pose is
  worn while still rising (PHYSICS' item 5 on PAINTER).
- **Boarding and lift-off** (q0 `look-q0/09-at-the-ship.jpg`, `10-climbing-in.jpg`,
  `11-in-the-ship.jpg`, `12-lifting-off.jpg`, `13-airborne.jpg`): pass; item 14 (the pale cloud
  where the figure stopped). Not taken at the top tier.
- **Low flight and the cockpit** (top `look-top/16-hover-over-the-wood.jpg`, `17-low-flight.jpg`,
  `18-cockpit.jpg`; q0 `look-q0/14-low-flight.jpg`, `15-cockpit.jpg`): the wood from the chase view
  passes at 0 and at 46 m/s (at quality 0 the far trees are still arriving at that speed); the
  cockpit is item 8.
- **The climb and space** (top `look-top/09-climb-300m.jpg`, `10-edge-of-the-air.jpg`,
  `11-just-in-space-looking-down.jpg`, `12-descent-350m.jpg`; q0 `look-q0/16-climb-120m.jpg`,
  `19-edge-of-the-air.jpg`): the sky at 300 m, the wood from 350 m with the nose down and space
  itself pass (art bible 8 met); item 10 for the band below space; item 3 for the world's outline.
- **Earth**: the stream vista `tour/8809fff-earth-vista-earth-temperate_forest-1.jpg` passes (items
  6 and 11); from orbit `tour/8809fff-earth-orbit.jpg`, item 3.
- **Mercury** (`tour/8809fff-mercury-biome-spawn.jpg`, `-vista-mercury-ochre_basins-1.jpg`,
  `-orbit.jpg`): the arrival passes now (a dark glass plain with sepia cracks, pale shards on the
  skyline, the sun as bare paper); the vista is among the best frames; from orbit a pale cratered
  disc with a dark smudge across its middle, passing.
- **Venus** (`tour/8809fff-venus-biome-spawn.jpg`, `-vista-venus-fungal_towers-1.jpg`,
  `-orbit.jpg`): the arrival's upper half passes, item 7 for the lower; the vista is the best ground
  frame of the game; from orbit passes.
- **The Moon** (`tour/8809fff-moon-biome-spawn.jpg`, `-vista-moon-mare-1.jpg`, `-orbit.jpg`): passes
  as a quiet study with Earth in its sky (item 3 for Earth's shape); the ship stands behind the
  figure's head in both frames; the near boulders pass.
- **Mars** (`tour/8809fff-mars-biome-spawn.jpg`, `-vista-mars-rust_canyons-1.jpg`, `-orbit.jpg`):
  the arrival passes but for item 12; the canyon vista is a good painting; from orbit it is Mars at
  last (rust, a dark marking, a cap), with a faceted limb.
- **Jupiter** (`tour/ca0b3db-jupiter-biome-spawn.jpg`, `-vista-jupiter-sky_islands-1.jpg`,
  `-orbit.jpg`): item 4; the vista passes (the figure is out of its frame: PILOT's camera, own
  side); from orbit passes.
- **Saturn** (`tour/ca0b3db-saturn-biome-spawn.jpg`, `-vista-saturn-gold_islands-1.jpg`,
  `-orbit.jpg`): all three pass; the arrival and the orbit are among the best; item 12 for the smear
  across the figure.
- **Uranus** (`tour/ca0b3db-uranus-biome-spawn.jpg`, `-vista-uranus-ice_shelves-1.jpg`,
  `-orbit.jpg`): item 5 for the arrival; the ice-shelves vista passes (a graphite-edged shelf wall,
  leaning needles); from orbit passes; the ship's dome reads as a wire cage against this sky.
- **Neptune** (`tour/ca0b3db-neptune-biome-spawn.jpg`, `-vista-neptune-storm_seas-1.jpg`,
  `-orbit.jpg`; `look-top/15-neptune-gale.jpg`): the kelp arrival is one of the best; the storm
  coast in the game's own weather is the brief's picture exactly (a wet storm sky, a haystack rock
  among spires, a dark ultramarine sea, a basalt beach), with a level sea and an upright figure in
  23 m/s of wind (PHYSICS' items 4 and 1 on PAINTER). The tour's vista frame of the same coast, 57 m
  away and facing the same way, is a pale flat calm with the stacks faded out: that is the tour's
  held fair weather, which this coast never has in the game, and I do not count it. Item 3 from
  orbit.
- **Pluto** (`tour/ca0b3db-pluto-biome-spawn.jpg`, `-vista-pluto-lilac_mountains-1.jpg`,
  `-orbit.jpg`): item 5 for the arrival and the vista; item 3 from orbit.
- **Night** (top `look-top/04-night-earth-spawn.jpg`, `08-fifteen-minutes-in-night.jpg`; q0
  `play/19-night-earth-q0.jpg`, `20-night-mars-q0.jpg`, `21-night-moon-q0.jpg`): item 1. Dusk
  (`look-top/05-dusk-earth-spawn.jpg`) passes.
- **A storm** (top `look-top/06-storm-earth-spawn.jpg`, `07-ten-minutes-in-mist.jpg`,
  `15-neptune-gale.jpg`; q0 `play/01-storm-spawn.jpg`, `play/15-squall-hover-6s.jpg`): item 2 on
  Earth; Neptune's storm passes.
- **The sea** (top `look-top/14-swimming.jpg`; q0 `play/06-wading-in.jpg`, `07-swimming.jpg`,
  `09-jet-out-of-the-water.jpg`): Earth's sea from the water passes at both tiers and is one of the
  best things in the game (soft level strokes, the figure's reflection, a paper cloud). The two
  frames from the coast stand (`look-top/13-coast-stand.jpg`, `play/05-coast-facing-the-sea.jpg`)
  are sand seen from above: my instrument put the easel's pitch on the third-person camera; not
  judged.
- **The figure** (`figure-standing.jpg`; in every frame): item 13.

## PILOT on PHYSICS

What holds, first, because it is most of the game: on Earth the walk and the run are crisp and even
(4.2 and 7.4 m/s, 90 % of pace in 0.4 and 0.8 s, a stop in 0.5 and 0.8 s); every world has its own
weight under the feet and the jetpack (a hop 1.2 m on Earth, 0.9 on Jupiter, 2.8 on Mars, 6.4 on the
Moon, 10.4 on Pluto); the ship's legs take every landing softly (0.76 to 0.79 m/s at touchdown on
five worlds, 4.3 s from a 25 m hover); the knife-edge ruling is in and nobody is thrown up off a
rim. Measured in `feel.txt`, `shipfeel.txt`, `jet.mjs` (evidence folder above). From the twelfth
agent's play: every world's air shows in the flight (the same half throttle is 17 m/s on Venus, 23
on Earth, 25 on Neptune, 40 on Mars; `pilot12/shipair.txt`); a ship set down in Neptune's squall
stays where it stands (0.3 m in 20 s); a walker in Neptune's 81 m/s squall keeps its feet and makes
1.6 to 3.1 m/s (`pilot12/stormwalk.txt`); a swimmer rides Earth's chop without ever going under
(`pilot12/afloat.txt`); and in the game at quality 0 the ship handles as Node says
(`pilot12/play-lowfly/play.json`: from a hover to 43 m/s in 3.2 s on Earth and to 55 m/s on Mars, X
stops it from 49 m/s in 4.1 s and from 107 m/s in 4.0 s, E from 89 m up sinks at a steady 13 m/s and
eases through the last 6 m).

Items 1, 3 and 7 are the eleventh agent's (kept as written, renumbered); 2, 4, 5, 6 and 8 are the
twelfth's, from the storm, the sea, low flight and the ship's handling, measured on `ca0b3db`.
PHYSICS finished its block P26 while this was written (`ee39533`, `a70d668`): item 1 has its status
below; items 2, 4 and 6 were run again on a clean export of the head `b25457f` and are unchanged to
the digit (`pilot12/after-p26.txt`).

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
   game on `ca0b3db` (quality 0, Shift+W from the coast stand on heading 0): 46.2 m up in 9 s on 74
   to 78 degrees, `grounded` true, mode `walk` (`pilot12/play/11-cliff-run-9s.jpg`; `play.json`,
   trace `cliff-run`). **Status at the end of this block: closed on Earth, a scramble left on
   Neptune.** PHYSICS' fix is `ee39533` (P26 item 1: a wall is no step and gives no hold). Re-run on
   a clean export of the head `b25457f` (PHYSICS at the end of P26, `a70d668`;
   `pilot12/wallrun-head.txt`; the same on `ee39533` alone, `wallrun-ee39533.txt`): Earth's sea
   cliff 0.2 m on each of the three headings (49.9, 49.0, 49.7 before), the canyon 1.1 and 0.2 m
   (30.7, 24.4), the other stands as before. In the game at quality 0 on a clean export of `cf7711c`
   (PHYSICS `ee39533`) the same run at the sea cliff gains 0.7 m in 9 s and the figure stands at the
   foot on 53 degrees (`pilot12/play-cliff-fixed/01-cliff-run-9s.jpg`, `play.json`). Left: from
   Neptune's `storm_seas` stand three headings still gain 4.3, 2.2 and 5.9 m on 53 to 58 degrees at
   up to 4.7 m/s (35.0 m before): inside the new law (rock holds to 53 degrees on Earth and steeper
   on lighter worlds) and it reads as a scramble, not a wall-run, but 4.7 m/s up 56 degrees is still
   a sprint; worth one look in the fix round.
2. **FIX FOR SHIP. Rain stops a walk dead on a forest bank, for nine of a new game's first ten
   minutes.** PHYSICS' first thunderstorm reaches the spawn 140 s into every new game (the default
   seed: drizzle at 140 s, 23 mm/h at 230 s, the last drops at 320 s; `pilot12/onset.txt`). From
   then on, W held eastward from the first view (headings 67 and 90, the bank under the wood 20 m
   from the spawn) carries the figure onto 23 to 26 degrees of leaf litter and there it stops: 0.07
   to 0.2 m/s, mode `idle`, for 3.8 to 6 s at a time with the key down; the same bank is walked dry
   at 3 to 4 m/s (`pilot12/wetbank.txt`, the pair, every half second; `wetstall.txt`, sixteen
   headings at five clocks). The litter's friction falls from 0.60 to 0.36 when wet (the tangent of
   20 degrees) and the ground stays wet long after the rain (0.86 at 440 s): two of sixteen headings
   still stall at 420 s and at 700 s, none at 1200 s; and 16 % of the dry ground within 60 m of the
   first view is steeper than 20 degrees (`slopes.txt`). Shift+W gets over it (5.6 m/s in the
   slowest second) and so does the jetpack, but a new player walking has no way to know that. In the
   game (quality 0, the W key, the clock at 238 s; `pilot12/play/play.json`, traces
   `storm-walk-east` and `fair-walk-east`): 21.6 m from the spawn the figure stands at 0.04 to 0.11
   m/s on 25 degrees for 2.5 s, mode `idle`, then walks on up 31 to 33 degrees of the same wet
   litter at 4.2 to 4.4 m/s, faster than it climbs that slope dry (3.1 m/s): 36 m in 12 s against 46
   m dry. So the standstill is not the friction law alone: something holds, and lets go. Why it
   fails: "the player should never fight the controls", and here a key is held and nothing happens,
   on ground that looks like the rest of the forest floor, with no slip, no slide back and no sound
   to say why; and a walker on wet leaves at 25 degrees does not stand still either: he goes up on
   short steps, or slides. Suggestion: between the wet friction angle and the dry limit keep a slow
   climb on short steps (1.5 to 2 m/s; the suit's assist is there for this) or let the feet slip
   back visibly; never a standstill with the key down on ground under 30 degrees. Test: Earth's
   spawn at clocks 240 and 420, W on sixteen headings for 14 s: no second under 1 m/s on ground
   under 30 degrees.
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
   touch it.** Hovering hands off at 30 m over the `storm_seas` stand (57 m from the view the
   sketchbook marks) at clocks 205 and 236 of the game's own weather: the wind at the hull runs from
   36 to 262 m/s within seconds, and where it meets the 50 m sea cliff its upward part is 104 to 164
   m/s. In 30 s the ship is carried 107 to 186 m; its height swings between 7 and 78 m (33 m in one
   second); it is flung up the cliff at 57 to 61 m/s; the hull takes 5 to 12 g for two seconds on
   end, and 25 to 44 g in single frames near the ground (there PILOT's cushion acts too: PHYSICS'
   own item 3 on PILOT); the drawn hull rocks 25 to 31 degrees all the while
   (`pilot12/hovertrace.txt`, every half second; `shipair.txt`). The same hover in Earth's
   thunderstorm, 15 to 36 m/s at the hull and gusting, moves 0.0 m and rocks 0.3 degrees. So the
   ship feels nothing, or it is in a tumble dryer; there is no storm in between. In the game
   (quality 0; `pilot12/play/15-squall-hover-6s.jpg` and the traces `squall-0` to `squall-5` in
   `play.json`): with 40 to 147 m/s at the hull the hover is pushed from 30 m down to 3.4 m, sits on
   the cushion at 6 m for six seconds (the hull rolled about 25 degrees in the frame), and is then
   thrown up to 27 m at 12 m/s. Why it fails: the brief's ship is "forgiving arcade flight" in a
   game with no fail state, the camera is fixed to that hull, and a vertical wind of 160 m/s at a 50
   m cliff is not weather on any world (P23 gave the walker a cap for exactly this cliff; the ship
   got none). Suggestion: cap what the hull is handed (gusts at about 1.5 times the mean wind, the
   terrain's upward part at a third of the horizontal), let the flight computer hold station inside
   a stated wind and show a storm as drift of a few metres and 5 to 10 degrees of rock, and give
   Earth's 30 m/s storm 2 to 4 degrees of it. Test: hands off for 30 s over the stand at clocks 205
   and 236: within 15 m, within 10 m of height, under 1.5 g.
5. **FIX FOR SHIP. The first storm comes two minutes into every new game, and the wood is wet and
   misty for the quarter of an hour after.** At the spawn, by the game's own clock (`onset.txt`,
   `wxflicker.txt`, `pilot12/wxscan.mjs`): a breeze for 130 s, overcast from 0.02 to 0.63 in the 40
   s after, thunderstorm from 160 to 300 s, then mist from 390 s to 1440 s (and again from 2100 s),
   the ground wet through the first of it. The brief's reference painting is "dappled light and a
   stream", and a new player stands in it for two minutes; then come the storm (to minute five), a
   wet hour of afternoon, and from minute six and a half to minute twenty-four the mist, most of it
   after dark (PILOT's day, own side below). That is also the time item 2's bank is a wall, and the
   time most players spend learning to walk and finding the ship. What it looks like is PAINTER's
   item 2 above: ten and fifteen minutes in, at the top tier, the first view is a dark blue fog
   (`pilot12/look-top/07-ten-minutes-in-mist.jpg`, `08-fifteen-minutes-in-night.jpg`). Suggestion:
   PHYSICS' call on the weather, PILOT's on the first ten minutes: hold the first front off the
   spawn until about ten minutes of play (a seed offset, not a new law), let it come over a minute
   or two rather than 40 s, and let the sward dry in three or four minutes once the sun is back.
6. **Swimming is a glide at one speed, in a sea that carries nothing.** Off Earth's coast
   (`pilot12/swim.txt`, `afloat.txt`, Node; in the game at quality 0,
   `pilot12/play/06-wading-in.jpg`, `07-swimming.jpg`, `09-jet-out-of-the-water.jpg` and the traces
   in `play.json`: 2.05 to 2.08 m/s afloat, 0.02 m/s 1.2 s after the key is let go): W gives 2.0 to
   2.1 m/s afloat and Shift+W gives the same (1.95); letting go stops the body within half a metre;
   the feet ride 0.6 m of chop under a sea that is never more than 0.5 m high in the first 100
   minutes of the game's weather (`seascan.mjs`: significant height 0.14 to 0.46 m, period 1.6 s).
   In Neptune's storm sea (3 to 3.5 m high, 41 to 70 m/s of wind, whitecaps 85 to 100 %) a swimmer
   who lets go rises and falls 3.4 m at up to 0.9 g and is moved half a metre in 12 s: neither the
   wind nor the breaking sea carries a floating body anywhere; swimming there at 2.7 m/s the head is
   under the crest for 5 to 27 % of the time. An upright body in a coat making 2 m/s through water
   with no stroke is a sprint swimmer's pace, and nothing in the pace says how. PHYSICS has already
   sent the pose to PILOT and PAINTER (its item 5 on PILOT, its item 2 on PAINTER), and since
   `a70d668` it reports a stroke for the model to follow (`swim`, `stroke`, `strokeRate`: output
   only, the pace is still one number); the body's part: give the pace a stroke (a surge and a
   glide, 1.6 to 2.4 m/s over a stroke of 1.5 to 2 m, so the swimmer PAINTER draws has a beat to
   follow), let Shift be a faster stroke, let a body afloat drift a little downwind and toward the
   shore in surf (0.2 to 0.5 m/s in a gale), and let it heave with the surface so that the head
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

## Not verified, and why

- **The picture in motion.** No film was taken in this block: every judgement of the look here is of
  a still. The rain, the mist, the night's specks and the sea were not watched moving; the eleventh
  agent's landing film and review 6's motion set are the last word on motion.
- **Frame rate.** Software rendering: a top-tier frame took 3 to 10 s here, a quality-0 frame 0.3 to
  5 s. Nothing in this file says anything about speed on a real machine.
- **The weather a player actually arrives in.** The tour holds fair weather with no weather marks,
  so nine of the ten arrivals and all ten vistas were judged in it (on Neptune's storm coast that
  shows a picture the game never has, and I have not counted it). The game's own weather was played
  at Earth's spawn and coast and at Neptune's storm coast only.
- **At the top tier**: only the spawn and the first vista of each body (the other 62 vistas and the
  biome easels: review 6's tier-1 tour, a day older, was not repeated); nothing inside the 550 to
  750 m band of item 10 (quality 0 and PAINTER's own frame only); not the title card, boarding or
  lift-off (quality 0 only); night on Earth only (Mars and the Moon at quality 0); no dawn; no
  lightning; no blizzard, no dust storm.
- **PHYSICS' section**: every number is from Node (30 or 60 Hz) or from the game at quality 0 on a
  loaded machine, where a frame may carry up to 0.25 s of game time. The squall trace in Node varies
  in its last digits from run to run (24.8 or 26.0 g for the same clock); the game's squall trace
  began 15 s later on the clock than Node's. Swimming in Neptune's sea was measured in Node only.
  Item 3 (rims) stands on the eleventh agent's runs and was not re-run on the head. Items 2, 4 and 6
  were re-run in Node on the head after PHYSICS' P26 (`pilot12/after-p26.txt`): unchanged; not
  replayed in the game on that head, where only the cliff run was.
- **Sound, a real mouse, a pad, pointer lock, 1080p**: not tried.

## PILOT's own side, seen on the way

Not part of either ranking; for PILOT's fix round, beside what PHYSICS' and PAINTER's critiques ask.

1. **A new game's day is over in seven and a half minutes.** The day is 25 minutes and a new game
   begins at 9:30 (`src/data/bodies.js`, the start hour): at the spawn the sun sets 450 s in, it is
   midnight at 950 s and the sun rises at 1440 s (`pilot12/hours.txt`). With PHYSICS' first storm at
   140 s and its mist after, a new player sees the reference painting in sun for two minutes of the
   first twenty-four. This is the lead's to settle with PHYSICS' item 5 and PAINTER's items 1 and 2:
   a first day that begins earlier or runs longer, a first storm that waits.
2. **The title card hides the painting.** It covers the middle 58 % of the first frame with a table
   of twenty key caps (`pilot12/look-q0/01-title.jpg`); "a watercolour to walk into" is written over
   a manual. The title, the one line and "click to begin" would do; H has the rest.
3. **The boom collapses at two vistas of 72, and is short at a third** (`pilot12/vistaframe.txt`,
   Node): Jupiter's Cream Sky-Islands (0.2 m: the figure is behind the lens, as the tour's frame
   shows), Uranus' Frozen-Wave Forest II (0.3 m: review 6's wave at the lens), Pluto's Lilac
   Mountains (3.1 m: the figure fills the bottom of the frame).
4. **The eleventh agent's Node instruments seed PHYSICS with 1**
   (`docs/lead/evidence/pilot11/*.mjs`), which is another weather than the game's: at 240 s the game
   has 23 mm/h at the spawn and those instruments have a breeze. Their feel numbers stand (dry
   ground either way); no storm was ever measured by them. `pilot12/`'s instruments create PHYSICS
   without a seed. Both sets leave PHYSICS' time budget on, so a run does not repeat to the last
   digit (PHYSICS' ask, relayed at the top of `docs/notes/pilot.md`: `timeBudget: false`).
5. **`tests/browser.mjs` gives the game five minutes to load.** At the top tier on this machine,
   with two other roles rendering, the load took nine and a half: a top-tier run through `startRun`
   dies with nothing taken (`tests/tour.mjs` allows thirty). Cost one slot of this block.
6. **The cushion's one-frame snaps** (PHYSICS' item 3 on PILOT) show again in the squall trace: 25
   to 44 g in single frames when the hull is pressed under 10 m (`pilot12/hovertrace.txt`).
7. **The read-out says "0 m up" while the ship lifts** (`pilot12/look-q0/12-lifting-off.jpg`; the
   eleventh agent's note: it measures to the crowns).
8. **The HUD's tags are whiter than the paper.** Their sheet is #FFFBEF; the painting's paper is
   #F4EFE4 and art bible 1 makes that the brightest value (`pilot12/tones.txt`: every frame with
   pixels over L* 96 is a frame with a tag in it). The tags should be cut from the same sheet.
9. **Tags overlap at speed on Mars**: the "a place to land" marker lies over the start of the
   thin-air notice (`pilot12/play-lowfly/07-low-flight-mars.jpg`; PHYSICS' item 11 on PILOT has its
   like at 640 x 360).
