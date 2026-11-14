# REVIEW: dated findings per role

Owner: PILOT as lead developer. Each finding has its evidence and the check it is measured
against (`R-...` ids are in `docs/lead/REFERENCES.md`; "AB n" is point n of the art bible).
MUST FIX blocks the milestone. Answer each MUST FIX in your own notes ("fixed in <commit>" or
"disagree, because ..."). I never edit your files; how to fix is your call.

Everything here was run by me, not taken from anyone's notes. Software GL only: frame rates
are relative, never a claim about a real GPU.


**2026-11-11, the owner's instruction: there is no triangle budget; the best possible quality.**
(`docs/COORDINATOR.md` section E.) Every finding below that rests on a count of triangles or
draw calls is **withdrawn by the owner's instruction**: the 600 k / 350 at quality 1, 300 k at
quality 0 and 1.2 M at quality 2 for the scene, and the 12 calls / 60 k for PHYSICS' kits, are
no longer limits, gates or reasons to trim. The M3 MUST FIX on the vista
`earth-temperate_forest-1` is withdrawn. The numbers stay in the reviews as a record of what
each view drew (history is not rewritten). What is still measured, because it is smoothness
and not a count: `world.update` and `physics.update` as worst frames. The frame-rate line of
the brief is carried by the quality tiers and dynamic resolution alone (the game starts at the
top tier and full resolution and steps down when the measured frame time asks), and the look
is judged at the top tier from now on.

---

## Review 6 (second half): every check, the tours, motion and weather on the art-pass head; milestone 3's verdict (2026-11-12, tenth PILOT agent)

Everything below was run by me, one browser at a time (two other roles rendered beside me: load 13 to
18), on clean trees, never on a "WIP snapshot". **The tree** for every browser run except the grand
tour: PAINTER and PHYSICS as of `5efc7f4` (the art-pass head: the art pass `5f12995`, PHYSICS P19
`1f07803`), PILOT `9c93e77` (built with `tests/cleantree.sh`). The grand tour ran on a clean export of
`5efc7f4` itself (before my two commits). Scratch: `/home/user/.pc-scratch/pilot/run10/`; sheets
copied to `docs/lead/evidence/` as named. Every sheet and frame judged below was opened. Software
rendering: seconds are this machine's, frame counts are the game's.

### 1. Every check (`node tests/all.mjs` in the clean tree): ALL 13 PASSED, 54 minutes

| step | result |
| --- | --- |
| unit (PILOT) | pass 142 (with `9c93e77`'s two new tests; 146 after `a0e3fb1`) |
| physics-unit | pass 291 (PHYSICS P19; the coordinator measured 296 on P20 `22df990`) |
| world-unit (PAINTER) | pass 19 |
| static rules | all hold |
| play-through on stubs / with PHYSICS / in the painted world | 38 / 38 / 38 checks |
| Earth, Mars, Saturn trip, stubs / painted world | 50 / 50 checks |
| milestone 3's checks, stubs / painted world | 31 / 31 checks |
| pointer lock | 9 checks |
| sound, measured | PASSED |

The stub guard's first browser run: every painted step printed "every module the run asked for is the
real one" (render, world, art, physics real; ui is a stub by design). **One failure of mine, fixed**:
before raising its limit the physics step timed out (PHYSICS' 291 tests had done 145 in the 5 minutes
`all.mjs` allowed at a load of 18; they take 235 to 458 s here): the unit steps now have 15, 20 and 10
minutes (`9c93e77`). No failure from another role.

Review 7's findings re-measured on the same tree in Node: **closed**. The ghost run
(`ghostfield.mjs`, six places, two gravities): 0 m/s radial while grounded, 0 m off the line, 0 wrong
materials, 0 steps in the air (worst step loss 0.55 / 0.52 m/s, the legs at their limit). The sea map
(`seamap-seams.mjs`): 0 steps over the limit, 0 on build frames; the warp moved 2.21 and 1.95 m after
the re-anchors against 2.36 m in a typical 5 s.

### 2. The grand tour (`node tests/grandtour.mjs`): PASSED, 8 of 8, one sitting

A new player's play on a clean export of `5efc7f4`, quality 0 at 400x225 (it proves the play, not the
picture), real key and mouse events only: the title card is up, a click starts the game, on foot in
Earth's temperate forest, W walks 12.8 m in 3 s, Space jetpacks 16.2 m up and back down, E boards,
lift-off, space above Earth; then M opens the map and a click sets each course, nose on the marker,
pulse, come down, land, step out, walk 12 m, for Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune
and Earth again. **Every landing on the first E, no bounce, one pulse a leg, no page reload, no console
error**; 1659 s of play, 39.4 minutes. Landed in: ochre basins, fungal towers, dry riverbeds, hanging
gardens, honey mist, pearl fog, ice spires, desert canyon. Evidence: `run10/grandtour-5efc7f4/`
(`grandtour.json`, a frame per world; the montage was opened). The two commits after it changed the
first hour of light and the arrival's footing at the spawn (Earth's spawn is not moved), not the play;
the painted play-through, trip and milestone 3 checks passed on `9c93e77`. One frame to note: the tour
came back to Earth at local midnight (desert canyon): a near-black indigo frame with the figure barely
visible (tier 0's night key: section 3, item 3).

### 3. The top-tier tour of all ten bodies (`node tests/tour.mjs --first 1`): every frame settled, no console error

Quality 2, 960x540, fair weather held, hour 10 by the world's clock (section 5), HUD hidden: the spawn
as the world's own arrival (third person), the first vista, the world from orbit. 30 frames, every one
settled (`world.busy` 0 for ten frames), every run printed render, world, art and physics real, no
console error, no flag on any sheet. Sheets: `docs/lead/evidence/tour-top-<body>.jpg` and `.json`
(all ten opened). **Settle times on arrival** (game frames until nothing is left to build, the ten
quiet frames included / seconds on this machine; at 60 frames a second every arrival is whole in under
a second, and PAINTER's block 7 holds it as bare paper meanwhile):

| body | spawn | first vista | orbit | the spawn's frame (information) |
| --- | --- | --- | --- | --- |
| Earth | 9 / 27 | Temperate Forest 41 / 461 | 9 / 58 | 1445 k triangles, 462 calls |
| Mercury | 54 / 202 | Cracked Ochre Basins 39 / 147 | 9 / 17 | 480 k, 428 |
| Venus | 50 / 227 | Fungal Tower Forest 35 / 138 | 9 / 23 | 579 k, 300 |
| Moon | 31 / 78 | Silver Mare 21 / 50 | 24 / 24 | 383 k, 208 |
| Mars | 43 / 158 | Rust Canyons 40 / 157 | 9 / 8 | 597 k, 331 |
| Jupiter | 49 / 144 | Cream Sky-Islands 47 / 150 | 9 / 17 | 594 k, 298 |
| Saturn | 52 / 220 | Pale Gold Sky-Islands 50 / 316 | 9 / 28 | 772 k, 276 |
| Uranus | 46 / 232 | Mint Ice Shelves 30 / 103 | 9 / 22 | 755 k, 227 |
| Neptune | 33 / 101 | Ultramarine Storm Seas 36 / 85 | 9 / 9 | 813 k, 284 |
| Pluto | 51 / 109 | Lilac Mountains 26 / 109 | 24 / 49 | 760 k, 489 |

Against review 6's partial tour (PAINTER `b022507`): arrivals settle in 9 to 54 frames as then (33 to
52); the Moon's spawn draws less (383 k, was 666 k: the art pass's fewer boulders).

Body by body, judged against the art bible and the freeze-frame test:

- **Earth** (spawn 9 frames / 27 s; Temperate Forest vista 41 / 461 s; orbit 9 / 58 s; 1445 k triangles, 462 calls at the spawn). Spawn: **passes**, still the reference painting: a meadow in a birch and pine wood, the stream at left, the ship under the trees; the art pass's mixed-age birches have broken the picket fence (trunks of many heights and spacings), and bare paper now shows in the sky above the crowns. Digital: the near grass blades are crisp single strokes everywhere at one weight; the figure is a smooth shaded doll. Vista (the stream study): passes as a watercolour; still digital: the far bank keeps a band of white birch verticals at about one height across the left half, and the **red flowers are flat orange-red ellipses with hard rims** (three on the left bank, two at bottom right): unchanged since review 6, ARTPASS wish 10. Orbit: a mottled globe, rose-ochre land, white cloud as hard-edged blots; the ship sits in the middle of the view (the tour's chase camera, not a fault of the world).
- **Mercury** (spawn 54 frames / 202 s; Cracked Ochre Basins 39 / 147 s; orbit 9 / 17 s). Spawn (now stepped 4 m off the boulder it stood on): the figure stands clear on the cracked obsidian plain, the ship beyond; the sky (a violet zenith paling to peach, granulated) and the slate glass ground with sepia cracks pass. **The boulders do not**: a dozen smooth, saturated cobalt-violet lozenges with pale speckles round the figure, evenly spread, hard rims: plastic pebbles, not rock (AB 3 dry brush, AB 6: saturated off the ground's hue). Better than review 6 (no white teeth, a dark glass plain), still the weakest arrival. Vista: **passes**, the best frame of the body (a sun-baked basin, sepia cracks, hills in two paler bands). Orbit: a pale blue-grey cratered globe with the terminator across it (a dark side at last); painted.
- **Mars** (spawn 43 frames / 158 s; Rust Canyons 40 / 157 s; orbit 9 / 8 s). Spawn (stepped 1 m): **passes**: a dry ochre plain with grass strokes, a row of red-leaf groves on the skyline, the ship beyond the figure, a granulated peach sky. The pale lozenge next to the figure is out of the view (the boulders left now sit at the left edge, toned rust). Still digital: the nearest crowns (top left) break into speckled dots at their edge (AB 3: dry brush leaves paper, not pixels), less than in review 6. Vista: **passes**, a good painting (banded canyon walls into a warm haze, a dark spire, a raking ochre slope). Orbit: unchanged and **still not Mars**: a pale peach disc with cream worm-like swirls, no rust, no dark markings, no polar cap.
- **The Moon** (spawn 31 frames / 78 s; Silver Mare 21 / 50 s; orbit 24 / 24 s). Spawn: **passes** as a quiet wash study: a silver-grey plain with dark basalt flecks, grey boulders a step below the ground (the art pass took the white soap away), a cool violet shadow from the figure, an indigo sky with salt blots and spattered stars. It still faces away from Earth, the brief's one image for the Moon, and the horizon is a crisp line of boulders (no haze on airless worlds: ARTPASS wishes 6, 7). Vista: the same view from a few metres; the near boulders are smooth grey slabs with hard rims. Orbit: a pale cratered disc on indigo, fully lit.
- **Venus** (spawn 50 frames / 227 s; Fungal Tower Forest 35 / 138 s; orbit 9 / 23 s). Spawn: says Venus at once (an amber haze, fungal towers on the skyline, a basalt spire, the lava river beyond the ship, a sky of bare paper with sepia blots) and **passes** on the whole, but its lower half is still the weak part: a flat dark-brown ground with little in it, and the lava a flat orange band with no light or stroke in it (AB 3 turbulence, AB 9 water as reflected strokes). The stones are fewer and mid mauve-grey now. Vista: **passes**, still among the best frames of the game (striped trunks and caps in rows into the amber haze); the caps' edges break into specks at top left. Orbit: a mottled amber globe; Venus.
- **Jupiter** (spawn 49 frames / 144 s; Cream Sky-Islands 47 / 150 s; orbit 9 / 17 s). Spawn: the sky says Jupiter in one look (cream and orange belts to a vanishing point, broad soft washes); a yellow-green meadow between cliff walls, now warm sienna-grey; **passes** as a painting. Still digital: the walls are flat vertical planes with square, level tops (extruded blocks: ARTPASS wish 8), and the meadow's red flowers are an even confetti of dots. Vista: **passes**, atmospheric (the cloud sea as a pale mist floor, far islands as grey blocks fading into it); the near island is the same box, and a row of pink dots runs along the bottom edge. Orbit: bold orange and cream bands with soft edges, Jupiter at once (no Great Red Spot).
- **Saturn** (spawn 52 frames / 220 s; Pale Gold Sky-Islands 50 / 316 s; orbit 9 / 28 s). Spawn: the ring arc as pale ribbons across a cream-sepia sky over a gold meadow says Saturn in one look; the wash under the arc is clean now (review 6 found it muddy); **passes**. Still digital: the olive crowns break into speckled holes at their edges (worst top right), the same alpha-noise edge as Mars' groves. Vista: beyond the figure the mist and islands are good, but **a dark trunk still fills the left eighth of the frame** (a wall at the lens, review 6 item 8) and the crown over the figure is speckled. Orbit (**new framing, ARTPASS wish 12**): the whole ring is in the frame for the first time: a banded gold globe inside a pale ring with its dark division, leaning about 35 degrees (the world's tilt against the camera's ecliptic level), the near side across the globe; painted, and Saturn at once. (The ship sits in the middle of every orbit frame: the tour's chase camera.)
- **Uranus** (spawn 46 frames / 232 s; Mint Ice Shelves 30 / 103 s; orbit 9 / 22 s). Spawn: a mint granulated sky over a pale aqua ice plain, blue shard grass and needles on the skyline: the palette says Uranus and it **passes** as a pale study, but it is still one value range from sky to ground (nothing darker than the figure and the ship; AB 2), the ice slab at right is a smooth grey lozenge, and the near ground is an even confetti of white splinter flecks (ARTPASS wish 11). Vista: **passes**: the seracs are slim leaning aqua needles now, not snowy firs (the art pass), before a shelf wall whose top edge is softer than in review 6. Orbit: a pale mint disc, white blots, a rose limb; quiet and right in colour.
- **Neptune** (spawn 33 frames / 101 s; Ultramarine Storm Seas 36 / 85 s; orbit 9 / 9 s; on the art-pass tree, i.e. the old season: the spawn's sun 2 degrees up at "10:00"). Spawn: a twilight painting (a peach-to-violet sky, violet kelp blades as long strokes, a green floor with yellow flecks, a smooth pale boulder at right); **passes** as a dusk study, which it was at every hour (the season is turned since, `dc876f9`, section 5). Vista: the storm sea as horizontal blue strokes with a pale beach is good, but the basalt stacks are **boxy tables with level tops and vertical faces** (as Jupiter's islands), the ship stands in the middle of the view, and **the figure has dropped out of the frame** (only its hat shows at the bottom edge: the third-person camera lifted over a rise behind the stand and kept aiming ahead; PILOT's, fixed: section 5, item 6). Orbit: an ultramarine globe with white cloud streaks and a darker limb: painted, Neptune.
- **Pluto** (spawn 51 frames / 109 s; Lilac Mountains 26 / 109 s; orbit 24 / 49 s). Spawn (stepped 5 m off the boulder it stood on): the figure stands clear, but **the slope is still a dense, even field of smooth lilac lozenges** with white shard clumps between (the art pass thinned lilac_mountains to 0.025 at its stand; the spawn's ground is busier): it **fails** on the boulders (AB 3 dry brush, AB 4 and 10: no rest for the eye), as Mercury's arrival did in review 6. Vista: the figure fills the bottom of the frame (the boom squeezed by something behind the stand: the camera's rule, by design) over an even confetti of white splinters; the lilac ridge and the far bands pass. Orbit: a pale rose-lilac cratered globe; painted, but the heart does not read.

**The worst frames, worst first, with owners**
1. **Pluto's arrival** (PAINTER): an even field of smooth lilac lozenges over the whole slope (AB 3, 4,
   10); boulder shape (ARTPASS wish 1) and the spawn's density (For PAINTER 2).
2. **Mercury's arrival** (PAINTER): saturated cobalt-violet lozenges with pale specks round the figure;
   the same two causes. The figure no longer stands on one (PILOT, fixed).
3. **Night at quality 0** (PAINTER, ARTPASS wish 3): the grand tour's return to Earth at midnight
   (tier 0, 400x225) is a near-black frame with the figure barely visible (AB 1: nothing is pure
   black). At the top tier the weather set's 22:00 storm is an indigo night that reads (section 4).
4. **Neptune's storm-seas vista** (PAINTER for the stacks; PILOT for the figure): basalt stacks as
   boxy tables; the figure out of the frame (PILOT's camera, fixed: section 5, item 6).
5. **Mars from orbit** (PAINTER): a pale peach disc with cream swirls, no rust, no dark markings, no cap.
6. **Saturn's vista** (PAINTER, ARTPASS wish 7): a dark trunk walls the left eighth of the frame.
7. **Foliage edges in specks** (PAINTER): Mars' groves, Saturn's crowns, Venus' caps (an alpha cut with
   noise reads as dithering).
8. **Earth's stream vista** (PAINTER, ARTPASS wish 10): flat orange-red flower ellipses with hard rims.
9. **Venus' arrival** (PAINTER): the lava a flat orange band without light; a muddy ground.
10. **Uranus' arrival** (PAINTER): one value range and a confetti of white splinters (ARTPASS wish 11).
11. **The Moon** (PAINTER 13, the coordinator's ruling): the arrival faces away from Earth.
12. **Jupiter's islands and Neptune's stacks** (PAINTER, ARTPASS wish 8): extruded blocks.
13. **Uranus' Frozen-Wave Forest II vista** (PAINTER; the tier-1 coverage, section 3b): a frozen wave
    at the lens, a flat dark polygon over two thirds of the frame. Ranks with Pluto's arrival.

**Passing**: the spawns of Earth, Mars, the Moon, Venus, Jupiter, Saturn, Uranus and Neptune (8 of 10)
and every vista but Saturn's walled one and Neptune's (framing fixed; the stacks remain); the
strongest frames are Earth's spawn, Mercury's ochre basins, Mars' canyons, Venus' fungal forest and
Jupiter's sky. **Fixed by the art pass since review 6**: Earth's picket fence, the white soap boulders
on the Moon, Mercury's white teeth, Uranus' snowy firs, Saturn's muddy sky; Saturn's ring now whole
from orbit, and Mercury shows a terminator.

### 3b. The tier-1 coverage tour (every biome and vista of every body, quality 1)

`node tests/tour.mjs --quality 1` on the same tree: every biome from its easel (first person) and every
vista (third person); Earth, Mercury and Venus at 960x540 with the orbit, the other seven at 640x360
without it (the top-tier tour has the orbits; a 960x540 frame took 2.7 minutes). **107 frames, every
one settled (26 to 47 game frames), no console error, every vista counted as found where it was
stood on; one flag: Venus' lava_rivers stand moved 8 m to dry ground.** Sheets
`docs/lead/evidence/tour-<body>.jpg` and `.json` (all ten opened). **The landform of every biome is
in its frame (42 of 42), with four partly**: the Moon's rilles (no frame sees a rille), Neptune's
aurora tundra (no aurora: the sky has none), Earth's misty wetland (a clear blue sky over it),
Uranus' frozen waves (read as snowy humps along their crests): all four are on ARTPASS's weakest list.
Earth hangs in the Moon's sky in two of its vistas (Silver Mare II, Winding Rilles II).
New worst frames from it (owners):
- **Uranus' Frozen-Wave Forest II vista** (PAINTER; worst of the run): a flat dark-blue polygon with a
  ruler-straight edge fills two thirds of the frame: a frozen wave at the lens. The camera keeps clear
  only of what `sampleObstacles` lists, at the radius it lists (a trunk's): give the wave a footprint
  the size of its body there (or keep vista stands clear of waves) and PILOT's boom will stay out.
- **Saturn's Crystal Reed Fields II vista** (PAINTER): a blue reed blade walls the right third.
- **Neptune's Ultramarine Storm Seas vista**, again only the hat at the bottom (PILOT's camera, fixed
  since in `a46b6ee`).
- The Moon's and Pluto's easel frames have the ship in the painter's view (the tour parks it 16 m off
  every stand: an artefact of the instrument, not of play).

### 3c. After the review: the Moon and Neptune on the newest clean tree (top tier)

PAINTER 13 (`7a51d42`, the Moon's arrival and stands moved to the near side), PHYSICS `b2aa445`,
PILOT `ce7e69d` (the locked Moon's hour, Neptune's season, the camera under a rise, the berths), built
with `tests/cleantree.sh`; `tour.mjs --bodies moon,neptune --first 1`; every frame settled (the Moon's
spawn 204 s, Neptune's 105 s), no console error. Sheets `docs/lead/evidence/tour-top-moon-7a51d42.jpg`,
`tour-top-neptune-7a51d42.jpg` (opened). **The Moon's arrival now says Earth's moon**: Earth hangs
in the indigo sky above the figure and the ship, a mottled green and rose globe (the brief's one image
for the Moon), on the arrival and the Silver Mare vista; the near boulders are still smooth grey
slabs. **Neptune's arrival is a daylight painting** with the season turned (a blue sky wash, violet
kelp blades, a mint floor with yellow flecks), where it was a twilight at every hour. **The storm-seas
vista has its figure back** in the frame (the camera fix; PAINTER 12 also moved that coast stand, so
the view itself is new): a basalt beach before a calm sea and low far headlands, quiet and passing.

### 4. The picture in motion and the weather (`node tests/motion.mjs`, `node tests/weather.mjs`, top tier)

**Motion** (nine scenes of consecutive frames at 1/30 s, 960x540, quality 2; sheets
`docs/lead/evidence/motion-<scene>.jpg`, numbers `motion.json`; the measures are defined in the
script's header; the still, walk, storm, landing and pulse sheets were opened):

| scene | change a frame (worst pair) | pixels over 3 % | never changes | residual after following (mean, 99th) | blocks over 3 % | pops |
| --- | --- | --- | --- | --- | --- | --- |
| still-frozen (the same instant) | 0 % | 0 % | 100 % | 0, 0.01 % | 0 of 2400 | 0 |
| still, clock running | 0.168 % (0.18) | 0.7 % | 68 % | 0.18, 0.86 % | 0 of 13920 | 0 |
| turn, 11.6 degrees a second | 2.52 % (2.66) | 24 % | 11 % | 1.27, 3.69 % | 21 of 18720 | 1 in 1 of 39 pairs |
| walk, 4.2 m/s | 3.30 % (3.89) | 32 % | 10 % | 1.91, 5.59 % | 63 of 22560 | 34 in 15 of 47 |
| storm at the spawn | 0.362 % (0.40) | 2.3 % | 45 % | 0.37, 1.98 % | 2 of 13920 | 2 in 2 of 29 |
| flight, 40 m up, 28.9 m/s | 1.28 % (1.48) | 12 % | 47 % | 0.70, 4.39 % | 62 of 22560 | 2 in 2 of 47 |
| landing, the last two metres (new) | 2.16 % (4.66) | 17 % | 11 % | 1.60, 7.89 % | 371 of 42720 | 372 in 44 of 89 |
| fill, arriving 600 m away | 1.13 % (2.21) | 5 % | 10 % | 1.06, 2.88 % | 47 of 13920 | **0** |
| pulse, 674 m/s | 0.171 % (0.26) | 0.3 % | 54 % | 0.18, 0.77 % | 0 of 13920 | 0 |

Against "Before review 6" (2026-11-11): the same instant paints the same picture; standing still
in the wind changes 0.17 % of the picture a frame (was 0.30; R-PAINT-3 asks under 0.5 %); the turn
holds R-PAINT-4 in all but 21 of 18720 blocks (was 62); **the arrival no longer pops** (fill: 0 pops,
was 498 in 29 of 29 pairs: PAINTER's block 7); the pulse and space are calm. What moves wrongly:
1. **The landing** (PILOT, SHOULD FIX): 372 pops, all in the left half: the chase camera, 15 m
   behind the ship, sits inside a birch crown as the ship sets down in the wood, so leaf masses a
   metre from the lens jump frame to frame (they also shake in the downwash). The camera keeps
   clear of the ground, not of crowns. Fix planned: shorten the ship's boom where the canopy field
   (`canopyHeight`) puts the camera among crowns, eased as the foot boom is; to be checked in a
   browser.
2. **The walk** (PHYSICS and PAINTER): 34 pops in 15 of 47 pairs (was 13 in 9): the largest are a
   pale boot puff appearing at the foot on a living meadow (P17's `KICK.stepDust` was to give no puff
   on a living sward) and flower dabs at the frame's lower edge; the rest are at the ragged border,
   which stays on the screen by design.
3. **The storm** changes twice as much as in review 5 (0.36 %, was 0.18 %): rain strokes and falling
   leaves; the two pops are leaves, drawn as flat orange ellipses with hard rims (PAINTER: AB 9 asks
   for falling leaves as brush marks).

Space (the pulse's frames and every orbit frame): indigo and violet washes laid wet-in-wet, salt
blots, spattered stars, the sun as bare paper with a warm halo: AB 8 met.

**Weather** (twelve frames in the game, top tier, third person; sheet `docs/lead/evidence/weather.jpg`,
numbers `weather.json`; opened, both halves): every frame settled, no console error. **Passing**: the
Earth spawn's first minute and before the storm (the reference painting), the front arriving (a grey
sky, mist down the stream), the storm at its heaviest (a wet, dark wood under rain strokes), the forced
flash (bare paper through the sky), the gold, misty afternoon after it, **the storm at 22:00 and its
flash** (dense indigo washes in which the figure, the birches and the ship still read: an indigo night,
not black), Mars' dust storm (an ochre veil with streaks across the dunes, the figure in it: one of the
best frames of the set). **Weak** (PAINTER): the blizzard on Earth's alpine meadow is a flat violet
triangle under one ruler-straight crest line (AB 4; the known "ruled crest"); Neptune's gale has a
pale ochre sand band along the basalt shore (the fixed shallows bed, ARTPASS wish 9), a near-black
headland slab, and no white horses (on this tree: PAINTER 12's coast work and the wired sea map came
after it, and the coordinator measured coast.mjs PASS at both stands since); falling leaves are flat
orange ellipses. Cost is small: the kits draw 0 to 6 calls and at most 9 k triangles.

### 5. PILOT's own work in this block (fixed by me)

1. **ARTPASS wish 12, the hour** (`9c93e77`). The hour PILOT set was the hour angle; the world paints
   by its own clock (`src/world/index.js` `lighting.hours`, `sunForHours`: 6 the sun on the horizon in
   the east, 12 highest, 18 on the horizon in the west). They agree only on the equator or at an
   equinox, and Earth is at a solstice at t = 0: at Earth's spawn (36 degrees north) the hour angle's 6
   and 18 had the sun 13 degrees down (night), at Neptune's spawn hour 10 was sunrise, at Uranus' the
   hours 6 to 10 all lay in a circling polar-day sun. Now `Ephemeris.sunHour` / `setSunHour` use the
   world's clock for the first morning, `teleport({hour})`, `__pc.setHour` and the mood's `timeOfDay`:
   6 and 18 are 0 degrees on every spawn where the sun rises; a polar day takes the nearest hour on the
   morning side (test in `tests/orbits.test.mjs`; `node docs/lead/evidence/review6b/hours.mjs`). At
   hour 10 most stands move by under 4 degrees (`standsun.mjs`); Uranus' polar stands get a lower sun
   (`ice_shelves` 69 -> 48 degrees), Earth's first morning at 9.5 a higher one (21 -> 27).
2. **ARTPASS wish 12, Saturn from orbit** (`9c93e77`). `tests/tour.mjs` `captureOrbit` looks at a
   ringed world from 1.8 times the ring's outer radius, 25 degrees off the ring's plane, nose north
   (`teleport` takes a ship heading now). From one radius up the camera was inside the ring. Projected
   in Node (`ringframe.mjs`) the ring spans x 207..768, y 65..370 of 960x540; **seen in the game**: the
   whole ring in frame, leaning about 35 degrees (the camera levels on the ecliptic far out).
3. **The arrival frames on Mercury and Mars** (ARTPASS "arrival frames"; `9c93e77`). The spawn's place
   is PAINTER's, the explorer's footing and view are PILOT's. Measured (`arrival.mjs`): Mercury's and
   Pluto's spawns stood the explorer ON a boulder (its edge 0.03 m from the feet), Mars' had one 2.3 m
   off. Now the world's own arrival (no place asked for) steps to the nearest dry, gentle spot of the
   spawn's biome with 2.5 m of room (Mercury 4 m, Pluto 5 m, Mars 1 m; the other seven unchanged) and
   turns the view off any boulder on the boom; a teleport to a point is never moved (contract test).
   Seen at the top tier: Mercury's figure stands clear, Mars' pale lozenge is out of the view. What is
   left is PAINTER's (the boulders themselves; the spawn's clearing does not thin rocks: For PAINTER 2).
4. **The coordinator's P20 rulings** (`a0e3fb1`). A ship landed on water floats: `Sim.stepAfloat`
   heaves, pitches and rolls with the drawn sea (`env.waterLevel`) averaged over the hull (5 x 3 points
   over 8 m x 4.4 m, taken up at 2.5/s). With PHYSICS P20 in Node: Neptune's storm sea (Hs 0.76 m)
   heave +-0.35 m, pitch +-3.6, roll +-4.4 degrees, at most 1 cm a frame; Earth's calm sea_coast within
   2 cm (`seaship.mjs`); a model 1 m swell of 60 m heaves it 0.89 m and pitches it 5.4 degrees nose
   up into the rising sea, 3 m chop lifts it 0.05 m (`tests/afloat.test.mjs`). A save made afloat comes
   back afloat. The camera's vertical follow is smoothed while swimming (0.45 s). `tests/boulderrun.mjs`
   counts a flight against a boulder only where the ground fell by less than its height plus the limit.
   Not seen in a browser (the tree under the tours has P19, without `env.waterLevel`: there the ship
   rests as before).
5. `tests/all.mjs`: the unit steps' time limits (section 1).
6. **The third-person camera under a rise** (found in the tour; in `a46b6ee`, the coordinator's
   snapshot of my files, exactly as tested). A rise at the explorer's back lifts the boom (up to
   5.7 m), but the camera kept aiming 9 m ahead, so the figure dropped out of the bottom of the view
   (Neptune's storm-seas vista: only the hat). Now the view turns down just enough to keep the feet
   within 0.85 of the half-height from the middle (`CAMERA.feetInFrame`); on level ground they sit at
   0.71 as before. Model rise (scratch `camlift.mjs`): a 25 m bank 10 m behind 1.35 -> 0.85, a 12 m rise
   1.03 -> 0.86; test in `tests/explorer.test.mjs`. Unit 148 on a clean export. Not yet seen in a
   browser.
7. **Neptune's season** (`dc876f9`; PAINTER said yes, the coordinator relayed). `axialTilt` -0.49
   for 0.49: every Neptune stand is north, and its north was in winter at t = 0 (the spawn's sun never
   above 2 degrees, a twilight at every hour; the tour's Neptune frames above were taken so). Now the
   spawn 36 degrees at noon, `aurora_tundra` 33 -> 67, `ice_spires` 58 -> 88, `storm_seas` 71 -> 75; only
   the spin axis turns (orbits, flight, frames unchanged). Not yet seen in a browser.
8. **The ship's berth out of the surf** (`dc876f9`, PAINTER 12's note): at an arrival the ship's spot
   counts a hull (the middle and four points 4.5 m out) less than 1.2 m over a liquid's still level
   against it, since the drawn sea and its run-up wash over a beach above that level. On the head 2 of
   52 spawn and stand berths had a hull point in the water (Earth's autumn_woodland -0.19 m,
   misty_wetland -0.09 m); now 0; no other berth moved, no composed spawn changed (`berth.mjs`; contract
   test).
9. **PHYSICS 20's wiring ask** (`2af3e51`): the explorer's trunks and boulders are looked up 16 m round
   it, not 9, so a lunar run's read-ahead (12 to 13 m) sees a boulder in time. Checked against
   PAINTER's wide-disc fault first: at 652 places a 16 m query lists everything a 9 m one does (the
   misses begin beyond 20 m).
10. **PAINTER 13's bug in PILOT's ephemeris** (`ce7e69d`): `setSunHour` turned the Moon's spin alone
   and broke its tidal lock, so every teleport with an hour, `__pc.setHour` and a boot with
   `?body=moon` moved Earth in the Moon's sky (by up to 178.5 degrees over six hours set). Now a locked
   body's orbit turns with its spin (`orbitShift`, kept in the save): Earth stays within 2.3 degrees
   (twice the Moon's tilt) at every hour (`moonearth.mjs`); a Moon boot at 9.5 has Earth 17.5 degrees up
   from the arrival. PAINTER 13's near-side stands checked in Node: all four stands and seven vistas
   dry, under 20 degrees, in their biome. Tests in `orbits.test.mjs` and `save.test.mjs`; unit 150.

### 6. Milestone 3's verdict, item by item against the brief

The brief's M3: "The painting comes alive. Painter: motion (wind, water, weather, day-night), space
washes, the painted UI theme, and an art pass on the weakest biome of every planet. Pilot: HUD,
sketchbook and vistas, audio, performance tiers, title screen, help card." A role's milestone is done
when the lead's MUST FIX list for it is empty (`docs/lead/TRACK.md`).

| item | owner | verdict | evidence (this review unless said) |
| --- | --- | --- | --- |
| Motion: wind | PAINTER + PHYSICS | MET | the still scene changes 0.17 % of the picture a frame in the wind with sky, paper and ground still (R-PAINT-3: under 0.5 %); grass and crowns move with PHYSICS' wind and gusts under a second (P18); section 4 |
| Motion: water | PAINTER + PHYSICS | MET | the storm sea of Neptune as horizontal reflected strokes (tour vista); waves, wake and swash drawn by PAINTER from PHYSICS' sea (the sea map wired after this tree, `c08dddb`; both coast stands PASS by the coordinator's check); the floating explorer and now a landed ship ride the drawn sea |
| Motion: weather | PAINTER + PHYSICS | MET, with SHOULD FIX | the weather set: the Earth storm by day and at 22:00, the flash, the clearing after, Mars' dust storm pass; SHOULD FIX (PAINTER): the blizzard's ruled crest, Neptune's sand band and slab (section 4) |
| Motion: day-night | PAINTER (+ PILOT's clock) | MET, with SHOULD FIX | noon, a gold afternoon and an indigo night at the top tier in the weather set; the hour PILOT sets now means the same light on every world (section 5); **at quality 0 night goes near-black** (the grand tour's Earth midnight; ARTPASS wish 3 measured the spawn at 23 h at RGB 24, 29, 48; PAINTER, SHOULD FIX for M4); dawn not re-shot here |
| Space washes | PAINTER | MET | every orbit frame of the tour: indigo and Payne's grey washes, salt blots, spattered stars, no black; the pulse scene (0.17 % a frame, 0 pops) |
| The painted UI theme | PILOT (moved from PAINTER by the coordinator, 2026-11-11) | MET | `m3` 31 checks on stubs and in the painted world (title card, sketchbook, vistas, HUD); torn paper, ink keys, stroke lettering (TRACK); PAINTER has still not reviewed its look (open, not a gate) |
| An art pass on the weakest biome of every planet | PAINTER (the owner's art pass) | MET | 36 of 42 biomes improved on all ten bodies (`docs/lead/ARTPASS.md`); the tour's arrivals pass on 8 of 10; what is left is listed in section 3 and ARTPASS's wishes 1 to 11 |
| HUD | PILOT | MET | `m3`, play-through and trip (painted world); the frames of the grand tour |
| Sketchbook and vistas | PILOT | MET | `m3` (a sketch per landscape and view; pages per world); the tour counts each vista as found where the explorer stood (no flag on 10 vistas) |
| Audio | PILOT | MET (measured, never heard) | `audio` PASSED: no clipping, no clicks, no DC |
| Performance tiers (and dynamic resolution) | PILOT | MET as logic; the frame rate on a real GPU is unmeasured | `tests/dynres.test.mjs`, `dynres-sweep.test.mjs` in unit 142; the tour runs at the top tier |
| Title screen, help card | PILOT | MET | `m3` (the card is the loading screen, legible; H shows the help again); README lists every key (`static`) |

**MUST FIX open: none.** Review 7's MUST FIX (PHYSICS) is closed and re-measured here; this review
raises no MUST FIX: every remaining fault is a SHOULD FIX carried to M4 under "Done means" (every frame
passes the freeze-frame test), where it belongs.

**Verdict: milestone 3 can close.** Every item of the brief's M3 is in the game and checked; the
weakest frames that remain (section 3) and the night key are look faults for M4, owned by PAINTER, and
none of them is missing work. What M3 cannot claim, and nobody here can measure: the frame rate on an
integrated GPU, the sound as heard, a real mouse and pad.

### 7. Findings for the other roles (answer each in your notes)

**PAINTER** (none is a MUST FIX for M3; all are for M4's "every frame passes the freeze-frame test"
unless said):
1. **SHOULD FIX now, `src/world/obstacles.js` `cellsAround`: a wide disc misses trunks and
   boulders** (correctness, not look). It reads the cells under the disc's centre and eight rim points
   only, so the wider the disc the more it misses, and the count falls as the radius grows (Pluto's
   spawn: 24 obstacles within 12 m, 22 within 16.5, 18 within 20, 17 within 25). Against the union of
   4 m queries tiling the same disc (`node docs/lead/evidence/review6b/obsmiss.mjs`): 80 m round
   Earth's spawn lists 260 of 536 trunks, Mercury's 15 of 126, Neptune's 88 of 202; 30 m round Pluto's
   22 of 85, Mercury's 18 of 36. PILOT asks 20 to 45 m for the canopy under a low ship and 80 m for the
   trunks round a landing site, so the ship can fly through and set down on painted trunks the query
   did not return (the contract tests share the function and cannot see it). Fix: read every cell the
   disc's bounding box touches on its face(s) (or sample rings at most half a cell apart), deduplicated
   as now; rerun `obsmiss.mjs` until both columns agree.
2. **Boulders on the arrivals**: Pluto's arrival fails on an even field of smooth lilac lozenges and
   Mercury's is crowded with saturated cobalt-violet ones (ARTPASS wish 1, the boulder's shape and
   value); the spawn's clearing (`surface.js` :760, :836-838) thins trees and canopy only, never the
   small kinds: clear rocks and shards within about 6 m of the spawn, and choose the spawn off a
   boulder (PILOT now steps its arrival off one, but the "place to land" ring is your point).
3. **Night at quality 0** (ARTPASS wish 3): the grand tour's Earth at local midnight (tier 0) is a
   near-black frame; at the top tier the 22:00 storm reads as an indigo night. Also from the weather
   set: the blizzard's ruled crest, Neptune's sand band and near-black headland slab.
4. **Mars from orbit**: still a pale peach disc with cream swirls (no rust, no dark markings, no cap).
5. **Foliage edges in specks**: Mars' groves, Saturn's crowns, Venus' caps.
6. **Saturn's Pale Gold Sky-Islands vista**: the trunk at the lens (ARTPASS wish 7).
7. **Flowers and leaves as flat ellipses**: Earth's stream vista's red flowers; the storm's falling
   leaves (orange ellipses with hard rims; AB 9 wants brush marks).
8. **Venus' arrival**: the lava a flat orange band with no light or stroke; a muddy ground.
9. **Uranus' arrival**: one value range; a confetti of white splinters (ARTPASS wish 11).
10. **Extruded islands and stacks**: Jupiter's cliffs, Neptune's basalt stacks (ARTPASS wish 8).
11. **The Moon facing Earth**: done by PAINTER 13 (`7a51d42`); PILOT's ephemeris kept the lock at a
    set hour since (`ce7e69d`).
12. **A frozen wave at the lens** (Uranus' Frozen-Wave Forest II vista) and a reed blade walling
    Saturn's Crystal Reed Fields II: list the wave (and tall blades) in `sampleObstacles` with a
    footprint the size of its body, or keep vista stands clear of them (section 3b).

**PHYSICS**: one question from the walk (section 4): a pale boot puff appears at the foot on Earth's
living spawn meadow (`motion-walk.jpg`, frames 21 to 23), where P17's `KICK.stepDust` was to give
none; is the spawn's glade counted as bare? Nothing else: review 7 is closed, P20's two asks are done
(section 5).

### 8. Not verified, and why

- No frame time on a real GPU; the sound never heard; no real mouse or pad (as ever).
- Seen in a browser since (section 3c): Neptune's new season, the camera fix at the storm-seas vista,
  the Moon facing Earth with PILOT's locked hour. **Still only in Node**: the floating ship (no landing
  on the sea was filmed), the berths out of the surf (Earth's autumn_woodland stand not shot).
- The grand tour ran on `5efc7f4` (before PILOT's commits); the painted play-through, trip and
  milestone 3 checks ran on `9c93e77`.
- The Moon boulder run was re-run at the end on the newest clean tree (PAINTER `7a51d42` with the
  near-side stands, PHYSICS `b2aa445`, PILOT `ce7e69d`; quality 0): **PASSED**, thrown 0 m, no boulder
  lifts the feet over 0.3 m, mean paces 4.55 to 6.05 m/s in four headings (top 7.4), one flight off a
  rim the ground fell 4.57 m under (counted as the ground falling away, by the coordinator's ruling).
  Mars' and Earth's boulder runs were not re-run.
- PAINTER 12's work (`e866f6e`, `994074a`, the sea map `c08dddb`) came after the tree under these
  tours: none of its frames is judged here.

---

## Review 7 (code): everything the other roles committed since `a671ca7` (2026-11-12, ninth PILOT agent)

A lead developer's code review, Node and reading only: the art pass held the machine's two browsers
(load 9 to 13), so nothing here was run in a browser. Read: PHYSICS 15 and 16 (`d186b65`, `c1c8e2c`,
`45338f0`, `f6eaa17`, `5f480bf`; the sea map itself came in the coordinator's snapshot `11f91f8`)
and PAINTER 11 (`90025a3`, `46fcbf8`, `8b058d7`, snapshots `0b76f2c`, `d874259`, `5b083c1`; the
8-bit fallback came in snapshots), as `git diff a671ca7 HEAD` per file. Everything measured on a
clean export of `98edfcd` (`git archive`), in my scratch `/home/user/.pc-scratch/pilot/run9/`.
The two scripts that prove findings 1 to 3 are kept in `docs/lead/evidence/review7/` and take
the trees to compare as arguments (`node docs/lead/evidence/review7/ghostfield.mjs <tree> [<tree>]`,
`seamap-seams.mjs` likewise): run them before and after a fix. Ranked by severity. Line numbers are
at `98edfcd`.

**1. MUST FIX (PHYSICS), `src/physics/explorer.js:365-388` (`ghostCrosses`): the ghost run overwrites
the walker's own step.** P17's ghost runs `stepExplorerBody` from inside the walker's `stepOnce`
(`wayAhead`, :896, then `probeTrial`, then `ghostCrosses`). The ghost's `stepOnce` writes the
module's scratch: `_dir` (:572, :777, :843: the walker's up at its new place) and, through
`genv.ground` (:370, which passes the caller's `out`, which is `_gnd`), the walker's ground `G`
(:589). After `wayAhead` returns, the walker's step still reads both: `_dir` is the normal the
velocity is laid along whenever the walker is clambering (:898-903, `q1 = 0` when `B.grip` or on a
step face), and `G` gives `B.material`, `B.friction`, the boot's sink and its dust (:1027-1032).
The ghost runs on the great circle through +z (`st.p = (sin t, 0, cos t) r`), so after a trial
`_dir` is about (0, 0, 1) whatever the place on the world.
*Failure:* running through a boulder field (a grip on one boulder while the next one is tried),
anywhere but the x-z plane. Measured with `ghostfield.mjs` (PILOT's `scrambleSample`, as
`src/core/sim.js:509` builds the explorer's ground; eight boulders 0.8 to 1.2 m in a row; 6 m/s;
a 4 km sphere): at the place (0.3, 0.9, 0.3), Earth gravity, the worst speed lost in one step is
**2.17 m/s** (0.49 with the fix below), the velocity has up to **1.13 m/s radial** while the feet
are on level ground (0 with the fix) and the run ends 0.91 m off its line (0); Moon gravity
1.71 m/s, 0.88 m/s, 2.35 m off the line; at (0.8, 0.2, -0.55) 0.74 and 0.58 m/s radial. On the
test plane at Earth gravity, where both runs take the same path, 17 grounded steps report a material that is not
the ground underfoot against 11 with the fix (the 11 are the script's own timing at a boulder's
edge): footstep sound, boot sink and dust from the far point's surface for those frames. *Why the
tests pass:* PHYSICS' P17 test runs in the x-z plane through +z, the plane the ghost runs in, so
the overwritten `_dir` is within 0.005 of the right one (radial speed 0.02 m/s there), and its
single boulder is never gripped while a trial runs (the test, turned off that plane by any of
three rotations, still passes; scratch `ghost2.mjs`).
*Fix (exact; four lines in `ghostCrosses`):*
```js
const _gGnd = {};     // module level, beside _gT: the ghost's own ground (_gnd belongs to the step that runs the ghost)
// in ghostCrosses:
genv.ground = P.ground ? (s, out) => P.ground(Q.surf, _gGnd) : undefined;
const dx0 = _dir.x, dy0 = _dir.y, dz0 = _dir.z;
try { for (let k = 0; k < 900; k++) { /* as now */ } } finally { _dir.x = dx0; _dir.y = dy0; _dir.z = dz0; }
```
Checked on a copy (`fixed2`): the boulder field then runs exactly as a copy that saves and restores
both around the whole `wayAhead` call, and PHYSICS' `explorer.test.mjs` passes 36 of 36. While
there (cost, same lines): `Q.surf` never changes during a trial, so call `P.ground(Q.surf, _gGnd)`
once per trial and let `genv.ground` return `_gGnd`. With physics' own `ground()` (through
`bindEnv`, Moon, 30 Hz, 7.4 m/s) one frame of the explorer took up to 1.0 ms of CPU during trials
(two sub-steps, one trial each) against 0.02 ms without reading ahead; with a trivial ground the same
trials take 0.13 ms, so the ground call is most of it. Add a regression test: the P17 run with a
row of boulders and the scene turned off the x-z plane, asserting no radial speed over 0.05 m/s
while grounded.

**2. SHOULD FIX (PHYSICS), `src/physics/seamap.js:198` (`SeaMap.rebase`): after every re-anchor the
waves' crests slide.** `rebase` moves the far point but leaves the published `target` (`x0, z0,
x02, z02, refX, refZ`) in the old frame. The next build's warp solver warm-starts by node offset
from `target.x0` (:460): after a re-anchor of 384 m that offset is about 24 cells, so the warp
starts cold, and `_publish` (:484-487) then picks the warp's free constant afresh. The shown warp
eases to the new constant over `SEA_TEX.ease` (3 s), and the crests move with it. *Failure:* every
384 m of travel along a shore where the map turns the waves. Measured (`seamap-seams.mjs`, part B:
an oblique beach, a walk along it at 6 m/s, the warp at a place 50 m out): the warp moved 14.6 m and
17.1 m in the 5 s after the two re-anchors, 2.9 m in a typical 5 s. *Fix:* in `rebase`, `const T =
this.target; T.x0 -= X; T.z0 -= Z; T.x02 -= X; T.z02 -= Z; T.refX -= X; T.refZ -= Z;`. Nothing
else reads those until the next build overwrites them (`attachMap` returns early while
`T.version` has not moved; `localAt` indexes `T.info` by the shown grid). Checked on a copy: 2.4 m
and 2.3 m after the re-anchors, 2.8 m typical; the one-frame steps of finding 3 are unchanged (a
separate cause).

**3. SHOULD FIX before PAINTER wires the map (PHYSICS), `src/physics/water.js:321-329` (`shiftArr`),
`:384-397` (`attachMap`), `:461` (`_seaAt`) and its GLSL twin `pcPhysSeaP` (:811): the shown sea
map steps in one frame at fixed places.** Three causes, all at the frame a build is published after
the focus has moved: (a) the inner level, its edge and its blend band (`SEA_TEX.band`, 1.5 cells,
:314) move by whole 16 m cells, 1.5 cells between builds at a walk and 2.3 at 50 m/s in a ship (the
0.75 s soonest), so a place near the inner level's edge goes from mostly the inner level to all the
outer one in a frame; (b) nodes new to a level take the build's value at once (`shiftArr` fills them
from the target) instead of easing from what was shown there; (c) after a re-anchor the outer
level's lattice moves by X mod 128 m (X is a multiple of 16), so `attachMap` snaps the whole outer
level (`this._mo.set(T.outer)`, :395). Near a shore the two levels can disagree by a factor of two
(the outer level's 128 m cells do not see a barrier), and the warp exists only on the inner level,
so a place that leaves it loses its turn at once. Measured (`seamap-seams.mjs`, part A: a coast
with lagoons behind barriers, a walk along it at 6 m/s for 150 s, `physics.water()` at a place
60 m out and one in a lagoon): nine one-frame steps over 0.02 m or 2.9 degrees, every one on a
frame that published a build; the worst: 60 m out the significant height fell **0.242 m** in a
frame (the map's scale there 0.997 to 0.699); in the lagoon the waves turned **27.9 degrees** in a
frame, and Hs fell 0.128 m on the frame the first build after a re-anchor landed (0.9 s after it).
On frames without a build the 99th percentile step is 0.0036 m. Not seen in the game yet (no shader
reads the map), but it reaches `physics.water()`, `loose.sea`'s spume and surf at the focus, and it
will be painted the day PAINTER wires the map (AB 7: no pop, never swim). *Fix:* (a) blend the
levels by distance from a centre that moves continuously: a new uniform (say `uPhysSeaFocus`, the
focus in frame metres, which `WaterField.update` already receives as `fx, fz`), `e` measured from it
in `_seaAt` and `pcPhysSeaP`, the band kept inside the published grid for the largest move between
builds (about 2.5 cells), and the warp's taper on the same band; (b) in `shiftArr`, give a node new
to a level what is shown at its place now (the old inner value, else the old outer level's bilinear
value there; warp 0) and let the existing ease carry it to the target; (c) in `attachMap`, on a
shift that is not whole cells, resample the old shown outer level at the new nodes (bilinear)
instead of snapping. A test: part A's places, asserting no step on a build frame over five times
the 99th percentile of the other frames.

**4. Checked, no finding.**
- *physics.setQuality follows the tier* (PHYSICS' P17 ask): `src/main.js:213` at boot and `:274` at
  every change of the controller, the same 0 / 1 / 2 as `painter.setQuality`; `?quality=N` pins
  both. `setQuality` only sets the number and the particles' capacity, so its place after
  `physics.warmUp` (:182) does not matter. `tests/cost.mjs:50` forces only the painter's tier, but
  it runs with `kits=0` and fair weather, so physics' tier changes nothing it counts.
- *PAINTER's prewarm hooks with PILOT's caller* (`src/main.js:321-347`): `world.prewarm()` awaits
  the kits' import only while it is pending, builds the invisible group and returns; PILOT then
  calls `painter.prewarm(scene, camera)` with only microtasks between, so the compile always lands
  well inside the 30 updates before `dropWarm` (`src/world/index.js:227`). three r187's `compile()`
  gathers materials with `scene.traverse` (`vendor/three/three.module.js:17283`), so the invisible
  group is compiled. `painter.prewarm` binds `post.rtScene`, so the programs are keyed as the scene
  pass draws them; `post.warm()` lays both brush sector counts and the sheet. PILOT's fallback
  branch (no painter hook) is unchanged. Consistent with the coordinator's 0 links after ready.
- *`renderer.outputColorSpace = LinearSRGB` changes nothing PILOT owns*: no painted shader includes
  `colorspace_fragment` or calls `linearToOutputTexel`, so the canvas holds what the sheet writes;
  LinearSRGB's drawing buffer space is sRGB in the vendored three (`three.module.js:6821-6831`), so
  the canvas stays sRGB; the sketch capture (`src/core/game.js:340-356`) draws the canvas into a 2D
  canvas, so it takes the same pixels; the HUD is DOM and `src/ui/paint.js` draws 2D canvases; the
  only three materials PILOT owns are in `src/core/stubs`, used only when the real painter is not
  (then `createPainter` never runs); test screenshots read the page or the canvas. Not checked by a
  pixel comparison (no browser in this block).
- *Log depth in the vertex shader* (`src/render/chunks.js`): the same window depth as three's
  fragment write (`log2(1 + w) * logDepthBufFC / 2` both ways); three's vertex chunk declares no
  `logDepthBufFC` (`three.module.js:413`), so `VERT_PARS`' own declaration is no duplicate; GLSL ES
  3.00 makes highp mandatory in fragment shaders, so the uniform's precision matches. The known
  weakness, a triangle crossing the near plane with an interpolated depth, is PAINTER's stated
  trade-off (`PC_FRAG_LOGDEPTH`); not seen by me.
- *The 8-bit fallback*: every reader of the packed target unpacks it (prep, brush, sheet graphite
  and lightning, the kits' glaze, the sky's glaze times 8, the stars' glaze); the keep pass copies
  the packed depth and the water's reflection multiplies it by 32. `floatFallback` is set in
  `Post`'s constructor, so the property `createPainter` returns is final when `src/main.js:90`
  reads it.
- *Gap 17*: the four reversed `smoothstep` edges are now `1 - smoothstep(lo, hi, x)` (the same
  values); the three `atan(0, 0)` are guarded; the only other two-argument GLSL `atan` in `src`
  (`src/physics/flora.glsl.js:164`) has a first argument that is zero only when its second is 1.
- *Gallery and gaitPose*: `strideBob` is what PHYSICS' test pins to the body's bob;
  `window.__pcModel` is gallery-only; `models.js`' reversed `sstep` is JS (clamped).
- *Sub-second gusts* (`wind.js` `gustSubAt`, `air.js`): no NaN or Infinity path (a NaN height or
  share falls back to the minimums; a NaN or negative receiver size or speed makes the octave's
  fade NaN and it is skipped); a function of place, time and seed, so deterministic.
  `gustNodes` is the three per-node functions' arithmetic, pinned by PHYSICS' `Object.is` test.
- *The sea map's cost* (each stage alone, best of 30, quality 2, open water 2 km about: the
  longest march): inner march 0.26 ms a frame, outer 0.25, refraction 0.10, twelve sweeps 0.05, on
  this 2.1 GHz core. *Garbage*: physics.update at the Earth spawn's storm (6,250 particles,
  quality 2) allocates 1 to 33 KB a frame (P17 measured 478 to 548 KB in storms before its fixes).
- *No NaN path in the map*: `windSea` returns zeros for no wind, no fetch or no depth, and
  deep-water values for a NaN depth; every division in `seamap.js` and the map paths of `water.js`
  is guarded. The outer level never went dark after a re-anchor (it is resampled within one build).
- *APIs PILOT depends on*: PILOT does not call `physics.water()`; `here.air.speed` and `.gust01`
  (`src/core/game.js:385`, the sound) keep their meaning and now move under a second, which the
  sound's 0.5 s smoothing takes; `env.air`'s fourth argument is optional; every explorer and ship
  state field PILOT reads is still there.
- *`coast.mjs`*: its waves' angle mixes the stand's axes with the frame's (anchored at the
  waterline), but both coast stands are 4 m from their waterline, so the two easts agree to 0.0
  degrees.

**5. PILOT (fixed by me, `33abe08`).** `src/player/explorer.js` asked `env.air` for the walker's
wind as a point at rest; PHYSICS P18 asks code that samples the air for a body to pass its receiver.
It now passes `{ size: 0.5, the body's velocity }`, the receiver PHYSICS' step uses. Small effect:
in a 17.9 m/s gale the wind along the heading moves 0.41 to 0.45 m/s a frame, was 0.53 to 0.56; the
walk's pace jitters 1.6 % under a second, was 1.8 %. Unit 140, PHYSICS' explorer 36, static rules:
all pass on a clean export of `98edfcd` with the file.

**Not verified.** No browser in this block: the sea map's GLSL twin has never been compiled (no
offline compiler here; its Jacobian and wave-vector algebra agree with the JS twin by reading), and
the prewarm, the vertex log depth, the 8-bit fallback and the colour-space claim rest on reading
plus PAINTER's and the coordinator's browser runs. Finding 1 was measured on a synthetic boulder row
in Node, not filmed in the game. No frame time on a real integrated GPU.

---

## Review 6, the tour: the first view of the worlds at the top tier (2026-11-11, seventh PILOT agent; PARTIAL, stopped for the owner's art pass)

Run by me on one clean tree: PAINTER `b022507` (block 7 part 1), PHYSICS `2e6ce74` (P13),
PILOT `5a5b691` (built with `tests/cleantree.sh`; no "WIP snapshot"). `node tests/tour.mjs
--bodies <body> --first 1` at the top tier (quality 2, 960x540, fair weather held, 10:00
local): the spawn (the world's own arrival, facing the way `getSpawn` says), the first vista,
and the world from orbit. Sheets in `/home/user/.pc-scratch/pilot/run7/sheets-top/` (copied
to `docs/lead/evidence/tour-top-<body>.jpg`); every sheet named below was opened. Settle is
`world.busy` at 0 for ten frames in a row, in game frames and in seconds of this machine
(software rendering at a load of 13 to 15: a frame takes 3 to 8 s).

**Stopped part-way on the coordinator's word** (21:20): the owner has started an art pass
over every planet and biome (four agents by planet group), so every body's look changes in
the next hours and the tour and review 6's second half will be run again on the new
pictures. Done at the top tier on the tree above: **Mercury, Earth, the Moon, Mars, Jupiter,
Uranus** (each exit 0, every frame settled, no console error). Venus and Saturn are judged
from the **sixth PILOT agent's** sheets (its run, PAINTER `ad17d2c`, before block 7; opened by
me; `docs/lead/evidence/tour-top-<body>-ad17d2c.jpg`). **Not judged: Neptune** (its run timed
out waiting for the game to load, 10 minutes, at a load of the art agents' renders; the wait
is 30 minutes now) **and Pluto** (not started). The tier-1 coverage tour (every biome and
vista of every body) was not run. None of these sheets is affected by the import cycle of
`6d5c02a`..`1d036eb`: the tree is older, and every run printed `render, world, art,
physics: real`.

| body | spawn settled (frames / s) | first vista (frames / s) | orbit (frames / s) | triangles at the spawn (information) |
| --- | --- | --- | --- | --- |
| Mercury | 46 / 358 | 43 / 162 | 9 / 22 | 985 k, 499 calls |
| Earth | 9 / 52 (built behind the title card) | 43 / 432 | 9 / 38 | 1445 k, 463 calls |
| Moon | 38 / 185 | 28 / 103 | 24 / 63 | 666 k, 211 calls |
| Mars | 41 / 309 | 46 / 162 | 9 / 13 | 847 k, 349 calls |
| Jupiter | 52 / 406 | 51 / 219 | 9 / 14 | 593 k, 298 calls |
| Uranus | 46 / 220 | 32 / 189 | 9 / 34 | 777 k, 235 calls |
| Venus (`ad17d2c`, sixth agent) | 33 / 150 | 28 / 162 | 9 / 28 | 769 k, 302 calls |
| Saturn (`ad17d2c`, sixth agent) | 34 / 227 | 22 / 67 | 9 / 15 | 780 k, 276 calls |

Frames are game frames until `world.busy` stayed 0 for ten (the ten included); at 60 frames a
second every arrival here would be whole within a second, and block 7 holds it as bare paper
until then. Seconds are this machine's and say nothing about a real one.

Body by body:

- **Mercury.** Spawn (obsidian fields; settled in 46 frames, 358 s): a peach sky with a pale
  sun is a real wash, and the ship stands clear to the right of the figure. The ground does
  not pass: a uniform scatter of smooth periwinkle lozenges with hard outlines and a field of
  white cones like teeth, evenly spaced to the horizon with no place for the eye to rest.
  Obsidian should be dark glass (indigo and sepia with bare-paper glints); these are pale
  plastic. It says "some spiky alien plain", not Mercury. Vista, Cracked Ochre Basins (43
  frames, 162 s): **the best frame of the body**, a plain watercolour of a sun-baked basin,
  sepia crack lines, soft far hills, a granulated sky. From orbit (9 frames): a pale blue-grey
  blotched ball, still no dark side; painted but anonymous.
- **Earth.** Spawn (temperate forest; 9 frames, 52 s: the title card had built it): passes.
  A meadow in a birch and pine wood with the stream on the left and the ship waiting under
  the trees ahead: crowns as dabbed masses with soft edges, birch bark as dark marks, the far
  wood fading to paper. It says Earth at once. Two things are digital: the far bank's birches
  stand as a **picket fence** (white verticals of one height at one spacing, left of the ship),
  and the figure is a smooth shaded doll in a painted scene. Vista, Temperate Forest (43
  frames, 432 s): the stream study, still the reference painting, but the fence is now the
  subject: a single row of white trunks crosses the whole width at one height behind the
  water; and the near red flowers on the bank are flat orange-red ellipses with hard rims
  (block 6 gave near flowers a lobed edge; these are not near enough for it, or are another
  kit). From orbit (9 frames): a mottled globe with a rose-ochre land and white cloud;
  painted; the cloud's edges are still crisp in places.
- **The Moon.** Spawn (38 frames, 185 s): a silver-grey plain under an indigo sky with
  spattered stars, the ship to the right: quiet, minimal, and it does pass as a wash study.
  But the brief's one image for the Moon is **Earth in the sky**, and the first view faces
  away from it: nothing in the frame says "Earth's moon" rather than "a grey world at night".
  The horizon is a ruler-straight line of identical pale boulder blobs. Vista, Silver Mare
  (28 frames, 103 s): almost the same view from a few metres away (the vista is beside the
  spawn); the near boulders are smooth pale slabs with hard violet outlines, like ice floes or
  soap, not rock. From orbit (24 frames): a pale cratered disc on indigo, painted; no dark
  side.
- **Mars.** Spawn (dry riverbed with red-leaf groves; 41 frames, 309 s): the palette says
  Mars (peach sky, ochre ground, maroon groves) and the ship sits well beyond the figure. The
  shrubs do not pass: their masses end in a **speckled, pixel-ragged edge** (dots of maroon
  breaking off like dithering, worst round the shrub between the figure and the ship), where
  a brush would leave a soft or dry edge; the boulders are again smooth pale lozenges with
  crisp outlines. Vista, Rust Canyons (46 frames, 162 s): **a good painting**: banded canyon
  walls stepping back into a warm haze, a dark spire against them, a raking ochre slope.
  From orbit (9 frames): a pale peach disc with cream worm-like swirls; no rust red, no dark
  markings, no polar cap: from space it does not read as Mars.
- **Jupiter.** Spawn (52 frames, 406 s): the sky says Jupiter in one look, cream and orange
  belts running to a vanishing point over the island, laid as broad soft washes. The ground
  is a green meadow with red flecks between grey-green cliff walls, and the walls are the
  weak part: flat vertical planes with level stripes and square tops, like extruded blocks.
  Passes as a painting; the coordinator's "its ground says valley" still holds. Vista, Cream
  Sky-Islands (51 frames, 219 s): the cloud sea as a pale mist floor between the islands,
  far islands as grey blocks in the haze: atmospheric and good, the same boxy cliffs. From
  orbit (9 frames): bold orange and cream bands with soft edges: Jupiter at once (no Great
  Red Spot, which the brief names among its biomes).
- **Uranus.** Spawn (46 frames, 220 s): a mint sky over a pale aqua ice plain with blue
  shard grass and rows of frosted cones on the horizon: the palette says Uranus, the sky is
  a good granulated wash, and it passes as a pale study. It is also the emptiest first view
  after the Moon's: one value range (pale to pale), no dark anywhere but the figure and the
  ship, nothing for the eye to go to; the ice slab at right is a flat white shape with a hard
  rim. Vista, Mint Ice Shelves (32 frames, 189 s): a shelf wall with a ruler-straight top edge
  and flat faces, and blue cones before it that read as snowy firs; the brief's "frozen-wave
  forests" do not show as waves. From orbit (9 frames): a pale mint disc with white blots;
  quiet, right in colour.
- **Venus** (the sixth agent's run, PAINTER `ad17d2c`, before block 7). Spawn (33 frames):
  says Venus at once, an amber haze, fungal towers on the skyline, a basalt spire and the
  lava river beyond the ship; the towers and sky pass. The foreground does not: a flat dark
  brown ground with pale lozenge boulders, muddy where the art bible wants a rich dark; the
  river is a flat orange band with no light in it. Vista, Fungal Tower Forest (28 frames):
  **among the best frames of the game**: striped trunks and caps receding in rows into the
  amber haze (the rows are a little regular). From orbit: a mottled amber globe, Venus.
- **Saturn** (the sixth agent's run, `ad17d2c`). Spawn (34 frames): the ring arc across the
  sky over a gold meadow says Saturn in one look; the wash under the arc is muddy (the
  coordinator saw it too) and the crowns' edges break into pixel specks as on Mars. Vista,
  Pale Gold Sky-Islands (22 frames): a dark trunk fills the left edge of the frame, a wall in
  front of the easel; beyond it mist and islands are good. From orbit: a gold banded disc
  with the ring as two broad vertical bands at the left edge only.

**The three weakest first views** (the spawn, where a player arrives): **1. Mercury** (it
neither passes nor says Mercury), **2. the Moon** (it passes, but is a grey plain at night
with nothing of Earth in it, the brief's one image for it), **3. Mars** (it says Mars, but
its shrubs end in pixel specks and its boulders are plastic). Uranus is the dullest of the
ones that pass. The strongest: Earth's spawn, Jupiter's sky, Venus's fungal forest, Mars's
canyons, Mercury's ochre basins: four of the five strongest frames are vistas, not arrivals.

**Findings for PAINTER** (for the art pass; in the order a player would notice them; each
seen in the sheets named above; none is a MUST FIX while the pass is running)
1. **Mercury's arrival** (AB 2, 4, 10): a uniform scatter of pale smooth lozenges and white
   cones to the horizon, no rest for the eye, nothing dark or glassy. The brief's obsidian
   glass fields want dense indigo-sepia glass with bare-paper glints; the first view of a
   world should be its best picture, and the ochre basins vista already is one.
2. **Boulders are smooth pale lozenges with crisp outlines** on four first views (Mercury,
   Mars, Venus, the Moon's slabs with violet rims). They are the commonest non-painted shape
   in the game: rock wants broken dry-brush edges and a darker, varied value (AB 3, dry brush).
3. **The Moon's first view faces away from Earth** (brief: "Earth in the sky"). Turn the
   arrival towards it, or put it where the first view looks. The horizon is a ruler line of
   identical pale blobs (AB 4).
4. **Earth's far birches stand as a picket fence**: one height, one spacing, white verticals
   across the frame, on the spawn and as the subject of the stream vista. This is the game's
   first view and its reference painting (AB 4, 10: no repetition, far things fewer, larger,
   softer).
5. **Foliage edges break into pixel specks** (Mars' shrubs, Saturn's crowns): an alpha cut
   with noise reads as dithering, not as a brush (AB 3: dry brush leaves paper, not pixels).
6. **Near flowers by Earth's stream are flat orange-red ellipses with hard rims** (block 6's
   lobed edge does not reach them).
7. **From orbit**: Mars does not read as Mars (pale peach, no rust, no markings, no cap);
   Mercury is anonymous; no body shows a dark side; Saturn's ring shows only as two bands at
   the frame's edge.
8. Uranus: one value range from sky to ground (add a dark: AB 2's 3 to 4 value steps); the
   "frozen-wave forests" read as snowy firs; the shelf's top edge is ruler-straight. Jupiter's
   island cliffs are flat planes with square tops. Saturn's vista has a trunk at the lens.
9. The explorer reads as a smooth shaded doll among painted things (Earth), and PAINTER's
   snapshot figure (`6b900e6`) lifts its arms straight out into a T in the air after a jump
   (`docs/shots/pilot/gait-p13.jpg`, last row; it is not committed work).

**GOOD (keep)**: every frame settled with no console error; Earth's spawn still passes as the
reference painting; the vistas named above are watercolours; Jupiter's belts, Saturn's arc
and Venus's towers each say their world in one look.

---

## Review 6, first half: the mechanics on the changed worlds (2026-11-11, runs by the sixth PILOT agent)

**Carried forward, not re-run.** The sixth PILOT agent made every run below and was stopped by
a usage limit before it could put them here; the seventh copies its draft
(`/home/user/.pc-scratch/pilot/run6/review-mech.md`) onto the record unchanged in substance.
The evidence is the sixth agent's, on the commits it names; I have not repeated it.

Everything on one clean tree: PAINTER `ad17d2c` (block 6), PHYSICS `f0b58ea` (P12), PILOT
`54ba154` (built with `tests/cleantree.sh`; no "WIP snapshot"). Browser runs at quality 0,
400x225, `scale=0.5`: they prove the play, not the picture. PAINTER's block 7 (`b022507`) and
PHYSICS' P13 (the gait) came after these runs.

| run | result |
| --- | --- |
| PILOT's unit tests (`node --test tests/*.test.mjs`; the contract test lands on and walks at every spawn) | 116 of 116 pass |
| landing survey (scratch `run6/landsurvey.mjs`: 24 spots a body, from 55 m with the assist, PHYSICS on) | 235 of 240 land, 3 refused as too steep and 2 as blocked, each with its word; no timeout. The same count as before the spawns moved |
| at every spawn (scratch `run6/spawncheck.mjs`, pure simulation): walk to the ship, board, lift off, come down, land, step out | ten of ten: the ship stands 16 m off on a berth of 0 to 5.8 degrees, dry; boarding after 1.8 to 2.5 s of walking; every landing on the first E where the script was below 90 m and slow (on Saturn and Pluto it was not, and the screen said so: "Come down below 90 m to land", "Slow down to land: no air to slow the ship here, hold X") |
| a run from every spawn, eight headings, 20 s each (same script) | 66 to 164 m made good, stalled 0.1 to 0.8 s, on eight bodies. **Venus**: six of eight headings end in the lava (27 to 46 m made good, 11 to 15 s under 1 m/s). **Jupiter**: two headings stop at the bench's cliff (84 degrees; as designed, the jetpack is the way) |
| Earth, Mars, Saturn in the painted world, reload from the save (`node tests/all.mjs --only painted-trip`) | PASS, 47 checks, 653 s |
| the grand tour, eight planets in one sitting (`node tests/grandtour.mjs`) | PASSED: 8 of 8 landed on the first E, no bounce, no reload, no console error; 1619 s of play, 36 minutes |
| the Moon and Pluto (`--bodies moon,pluto --from earth`) | PASSED: 2 of 2, 319 s of play |

**GOOD.** Nothing that landed, walked or left before fails after the spawns moved and
`sampleObstacles` changed (PAINTER's block 5 and 6).

**Fixed by the sixth agent (PILOT), from what the runs showed**
1. **The lava of Venus holds a wader, and nothing said so.** The new first landing stands 25 m
   from a lava river; PHYSICS' lava (viscosity 100 Pa s, Stokes drag) slows a runner from
   5.5 m/s to 0.4 m/s within five seconds of the bank and to 0.32 m/s swimming (60 s to cross
   20 m); walking back out takes 10 s, the jetpack lifts out in 1.5 s. Thick lava is right and
   has character; a new player pressing W into the first thing the view shows should be told
   the way out. Now, after 2.5 s of pushing in a thick liquid: "The lava is thick: hold Space
   and the jetpack lifts you out", once per wade (`6130796`; test on the real Venus).
2. **A player never saw the first views PAINTER composed.** The game starts at Earth's spawn;
   every other world's spawn is reached only through the debug door. The grand tour came down
   in the spawn's own biome on one world of eight (Mars, by chance); on Venus it landed among
   fungal towers, on Saturn in honey mist, on Jupiter in the hanging gardens. So "does the
   first view say which world it is" was judged at places no player stands on arrival. Now a
   world not yet walked on shows **"a place to land"**: a small ring on the spot its first
   view was painted from, or an arrow at the picture's edge when it lies round the curve of
   the world; it goes for good once the world has been walked on, and the player may land
   anywhere else (in the snapshot `1186819`, PILOT's files; seen in a browser over Venus; the
   trip checks it on Mars and Saturn: stub trip 49 checks pass; README). Not yet seen: the
   ring on the ground at 1080p, and whether the arrow's label clears the read-out in a small
   window (at 640x360 it runs under it, as the target's arrow always could).
3. `tests/tour.mjs` could not run at all (`lastSettle` was declared below the top-level run
   that uses it; nobody had run the tour since settle is counted in frames): `73ff24b`. And
   `tour --first 1` now takes the spawn frame as the world's own arrival, facing the way
   `getSpawn` says (`5a5b691`).

**Information, not findings**: obstacles within 30 m of each spawn (trunks or towers /
boulders): Mercury 29 / 26, Venus 11 / 33 (towers to 22 m), Earth 56 / 0, Moon 0 / 12, Mars
4 / 20, Jupiter none within 120 m, Saturn 14 / 13, Uranus 3 / 28, Neptune 38 / 16, Pluto 3 / 57.

**Not in this half** (waits for the coordinator's word, after PAINTER's block 7 lands): the
motion set, the weather set at the top tier, `node tests/all.mjs` in full, the Moon boulder
run against the measure as ruled (no boulder lifts the feet more than 0.3 m and the body is
never thrown up more than 0.3 m without a jump), settle times.

---

## Before review 6: the picture in motion, the Moon run, the head in a browser (2026-11-11, fifth PILOT agent)

Not a milestone review: evidence gathered for review 6, with findings a role can act on now.
Nothing here is a MUST FIX yet; review 6 will sort them. All of it was run by me in a clean
tree (each role's own last commit, never a "WIP snapshot"), software rendering.

### The picture in motion (`tests/motion.mjs`, new)

The first look at this game moving. The test drives the game's clock itself (30 steps a
second through `window.__pc.hold/step`), takes consecutive frames at the top tier, 960x540,
and measures what changes between them (what each number means is in the file's header; the
in-page part is `tests/motionlib.mjs`, usable on any page with a canvas). Sheets:
`docs/lead/evidence/motion-<scene>.jpg`, numbers `motion.json`. Shot on PAINTER `c0e6d03`,
PHYSICS `bf73de5` (still, turn, walk, storm) and on PAINTER `cf2058a`, PHYSICS `9b708e2`
(still-frozen, flight, fill, pulse; the first four were shot there too and the numbers moved
by less than a tenth). I opened every sheet (the four re-shot ones: the storm on the new
head, still, turn and walk on the older one).

| scene | change per frame | pixels changing over 3 % | never changes | residual after following the motion (mean, 99th) | block mean over 3 % | pops |
| --- | --- | --- | --- | --- | --- | --- |
| still-frozen (same instant, 6 frames) | 0 % | 0 % | 100 % | 0, 0.006 % | 0 of 2400 | 0 |
| still, clock running | 0.298 % (worst pair 0.327) | 2.25 % | 58 % | 0.31, 2.26 % | 5 of 13920 | 1 block in 1 of 29 pairs |
| turn, 11.6 degrees a second | 2.69 % | 25 % | 11 % | 1.42, 4.22 % | 62 of 18720 | 2 in 2 of 39 |
| walk, 4.24 m/s, 6.65 m | 3.60 % | 33 % | 10 % | 2.15, 6.00 % | 206 of 22560 | 13 in 9 of 47 |
| storm at the spawn, standing | 0.177 % | 1.13 % | 62 % | 0.18, 1.56 % | 0 of 13920 | 1 in 1 of 29 |
| flight, 40 m up, 28.9 m/s | 1.21 % | 11.7 % | 48 % | 0.68, 3.74 % | 45 of 22560 | 2 in 2 of 47 |
| fill (arriving 600 m away) | 1.35 % (first pair 7.73) | 9.5 % | 13 % | 1.16, 10.0 % | 493 of 13920 | 498 in 29 of 29 |
| pulse, 674 m/s | 0.168 % | 0.35 % | 55 % | 0.17, 0.79 % | 0 of 13920 | 0 |

**GOOD (keep), with the check each passes**
- `R-PAINT-3` (flicker). The same instant painted six times is the same picture to the last
  bit (change 0): nothing in the paint is driven by the wall clock or by chance. With the
  clock running and the wind blowing the mean change is 0.30 % a frame, under the 0.5 % the
  check allows with the wind frozen; the series is level (0.27 to 0.33 %), no stepped boil.
  The sky, the paper border and the ground wash do not change at all (bottom third 0.05 %);
  what moves is the crowns and the grass by the explorer. This is what "only what the wind
  moves should move" looks like.
- `R-PAINT-2` (shower door). In the slow turn, detail five frames apart (the world has moved
  14 px) matches where the world went (broad 0.68, fine 0.30) better than where it was on the
  screen (0.42, 0.24; a frame against itself shifted that far gives 0.27, 0.13). Block by
  block (scratch `run5/stuckmap.mjs`, frames 10 and 15 at full size): fine detail stays on
  the screen only in the open sky top left (0.7 to 0.8: the paper, as the brief wants) and on
  the explorer (0.5 to 0.8: the figure stands still in a turn); over trees and ground it is
  0 on the screen and 0.3 to 0.7 with the world. No wash, granulation or stroke texture
  sticks to the screen.
- `R-PAINT-4` (slow pan). 99.7 % of 32 px blocks keep their mean luminance within 3 % from
  frame to frame at 11.6 degrees a second (99th block 2.2 %); the 62 that do not are birch
  trunks crossing a block edge and the two pops below.
- The storm standing still is the calmest picture of all (0.18 %): the ground holds, the rain
  strokes travel along their slant. On PHYSICS `9b708e2` the same strip had 3 pops and one
  block over 3 %; on `bf73de5` (the wake, gust and outflow fixes) 1 and 0.
- Flight over the wood: the sky does not move at all, the canopy flows; 2 small tier swaps
  in 45 m. The pulse: the washes of space hold, the stars travel outward, nothing pops.

**SHOULD FIX, PAINTER**
1. **Arrival is a pop, then a second of pops** (`R-PAINT-6`; sheet `motion-fill.jpg`). The
   first frame at a place nobody has painted shows the wood as trunks under thin simple
   crowns (691 k triangles); the next frame has 575 k triangles more and the whole canopy:
   7.7 % of the picture's luminance in one frame, residual up to 50 % in 150 blocks. Then
   the ground: the sward and its light arrive in pieces for all of the 29 pairs measured
   (498 blocks flagged, 493 block means over 3 %). In software rendering each frame gives
   the builder seconds, so on a real machine this is slower and longer, not better. A player
   meets it after a landing, after a pulse into a new sky, and at any teleport of the debug
   door. What the art bible asks is the painting repainting itself calmly: a wash that comes
   up over a third of a second, or nothing shown until the near field is whole (how is
   yours). The title card already hides the very first one (see the first ten minutes).
2. **Things change tier in one frame.** Walking 6.65 m the triangle count jumps by more than
   2000 in 10 of 47 frames (the largest -50 k, +20 k, -18.5 k, +10.6 k); in flight in 31 of
   47 (two visible: crowns under the ship re-drawn between frames 13/14 and 16/17, residual
   6 % against a usual 1.4 %, `motion-flight.jpg`). In the walk none of the big jumps shows
   as a flagged block, so most are out of sight or small; in the turn one does: between
   frames 29 and 30 a dark dab of ground mark appears in the middle of the meadow (block at
   192, 320; +746 triangles; on the older head's sheet, kept in scratch). Nothing fades.
3. **A near flower is a flat hard-edged disc.** In the walk a poppy passes the camera at the
   left edge as a perfectly round, flat orange-red disc about 30 px across with a hard rim
   (frames 32 to 36, the four pop crops of the older walk sheet; the detector flags it
   because it moves 30 px a frame, not because it appears). At that size it is a sticker, not
   a touch of the brush (AB: no hard digital shapes).
4. One crown re-deals its dark dabs in a single frame at the same clock time on both heads
   (still: frame 20 to 21, block 288, 128, residual 4.3 % against 0.37 %; turn: frame 8 to
   9, block 448, 64): small, and regular enough to be a scheduled update rather than wind.
5. Where to look next (PAINTER's own note that the handwriting changes at about 17 m): in
   the walk's ground band (scratch `run5/walk-ground.jpg`, frames 0, 12, 24, 36, 47, opened)
   the edge between the bladed sward and the flat far wash with its dots keeps its place on
   the screen, level with the ship's shadow 16 m ahead; what crosses it gains blades. I found
   no single-frame pop there in 47 pairs and could not see a line in stills; whether the
   growth reads as swimming needs eyes at full frame rate. The instrument cannot say.

**SHOULD FIX, PHYSICS (the picture of the marks is PAINTER's glaze; say whose in your notes)**
6. **Splash rings are thin white line ellipses that appear whole in one frame** (storm sheet,
   the one pop: frames 13 to 14 at 416, 448 by the explorer's feet; three to four crisp white
   outlines, one dashed). REFERENCES, rain, what makes it good: "never white lines". Everything else in that picture is
   soft.

**Limits of the instrument, so nobody reads more into it than it holds.** Pops from late
building are understated (above). A near thing that moves more than 16 px a frame is
flagged as a pop (every flagged block must be looked at; the sheet shows the six largest
before and after). The measures are on luminance at half size. No frame rate, no judder, no
tearing can be seen this way; nothing replaces looking at the game at 60 frames a second.

### The Moon boulder run in the game (`tests/boulderrun.mjs`, new), for PHYSICS

Crater fields, the densest place within 320 m of the stand (63 low boulders within 28 m,
tallest 1.09 m), Shift+W in four headings for 12 s each, 30 steps a second, quality 0
(mechanics). No boulder lifts the feet more than **0.16 m**; nothing throws the body up
(0.05 m at most above where the feet left the ground); pace 5.7 to 6.6 m/s, never stopped.
**GOOD: the legs do what P9 said.** Two things for PHYSICS to rule on:
7. **A run over a crater rim sails.** Heading 270, 7.4 s in: over a rim onto a 36 degree wall
   at 6.8 m/s; the ground falls 6.7 m away and the body is in the air for 2.4 s with the
   feet up to 3.7 m over the wall, without rising. Review 6's measure as written ("never
   more than 0.3 m off the ground without a jump") is not met there. It may be right for the
   Moon (a runner would leave that rim); it is 2.4 s without control in a calm game. Your
   call; I will word the measure as "never thrown up more than 0.3 m, and no boulder lifts
   the feet more than 0.3 m" unless you say the rim should be held.
8. In the pure simulation at the same site (scratch `run5/trace.mjs`): stepping off the far
   side of a 0.72 m boulder at a run (the ground under the feet drops 0.67 m in one frame),
   the next frame gives the body +1.06 m/s upward: 0.29 m of rise, feet 0.53 m over the
   falling ground, 1.4 s in the air. Under the limit as a throw, over it as feet over
   ground; it looks like a rebound of the hips after a step down.

### The first ten minutes, as a new player (`node tests/grandtour.mjs --bodies mars --beats 1`)

Played twice from the title card with real keys and mouse. **At the top tier** (960x540,
PAINTER `4c2cf51`, PHYSICS `2c6b25b`) only the opening: a top-tier frame takes about 15 s
here and the clock moves a quarter second a frame, so the run was stopped after the jetpack
(six beats in 25 minutes; frames `docs/shots/pilot/first10-*.jpg`, all opened). **At quality
0** (400x225, PHYSICS `6d588d6`) the whole first leg, title card to standing on Mars: 26
beats, 202 s of play, PASSED; what the screen said at each beat and the camera at every
frame are in `docs/lead/evidence/first10.json` (four of its frames opened: at the ship, airborne, space, the pulse).

**GOOD**
- At "click to begin" the picture is whole: the sward beside the card has its blades and
  flowers, `world.busy` is 0, and the first view three seconds later is the same picture
  (nothing fills in after the card lifts; the sketch slip fades in, it does not pop).
- **No cut anywhere.** Through all thirteen changes of state and view (boarding, lift-off,
  space, pulse on and off, the air of Mars, landing, stepping out) the camera never turns
  more than 1.7 degrees in a frame, except the blend into the ship (8 degrees in a 0.37 s
  frame, 22 degrees a second, as designed); the field of view never jumps more than 1.7.
- The pulse says what it is doing ("Mars 442.8 km 74 s") and the drive lets go with "Mars
  ahead"; the thin air of Mars is explained when it matters; landing took one E.

**Fixed (mine), best first**
1. "[E] Board ship" lay across the explorer's legs (`first10-walking-before.jpg`): on foot in
   third person the prompt, the gauge and the notices sat where the figure stands. They now
   lie under the feet (`first10-at-the-ship-after.jpg`, opened).
2. Three seconds after the first lift-off, a metre over the ground it had just left, the
   screen offered "Land here". It is now offered once the ship has been 12 m clear or eight
   seconds have passed (E lands all the same; unit test).
3. On reaching space for the first time the only words were "Pulse to Pluto" (the nose
   happened to be on it). The screen now says once "M opens the map: choose a world, point
   the nose at its mark, press F".
4. (From the Moon leg) "Moon is in the way" at arrival at the Moon: fixed, with a test.

**Open**
10. **PAINTER and PILOT: leaves between the lens and the figure.** Jetpacking up 15 m among
    the birches, crowns stand between the camera and the explorer as large flat light-green
    shapes with hard edges and hide half the figure (`first10-jetpack.jpg`). The boom knows
    trunks, not crowns. Either the foliage near the lens thins to a wash (PAINTER) or the
    boom needs a crown radius from `sampleObstacles` (additive) to shorten against (mine).
    Say which in your notes.
11. PILOT: the hint at the top ("click the picture to look around with the mouse") stays
    until the player has looked round once; nothing in the first view says that the ship is
    theirs or that it is the way on ("Board ship" appears only beside it). Not changed: the
    brief wants a quiet screen; to be looked at with the owner's eyes.
12. PILOT: the first pulse, to the nearest planet, is 66 s of holding a course (Pluto from
    the Moon 120 s). The countdown is on the screen; the pace is the fourth agent's open
    item ("pulse profile").
13. PILOT: at 400 px wide the read-out, the prompt and the throttle gauge overlap (the HUD
    is sized in pixels): small windows only.
14. Nobody heard any of it: whether a sound starts or stops abruptly at these changes is
    not known (the sound check measures levels and clicks in isolation).

### PHYSICS' questions on feel, answered from the game (PILOT's `Sim`, real ground, Earth spawn, PHYSICS `6d588d6`; scratch `run5/feel.mjs`)

- *The run*: 4.74 m/s at 0.5 s, **7.48 m/s at 1.23 s**, then 7.4 to 7.5: the asked speed is
  reached. Stop from 7.5 m/s in 0.77 s over 2.49 m; the walk is 4.2 m/s within a second.
  Good as it is. (6.1 m/s in the lab is the lab's ground or command, not the game's.)
- *The jetpack*: the game's wrapper holds the climb to 8.4 m/s: Space for 1 s is an apex of
  9.7 m, **2.5 s is 22.7 m** (58 % of the fuel left), the whole tank 54 m, and every fall
  touches down at 4.0 m/s. That is what I want on Earth: over the canopy in one hop, never
  out of sight of where you stood. (49 m from 2.5 s is the body without my cap.)
- *The ship's last metres*: no stall in the game. From 2.2 m to the ground in 1.5 s, slowing
  evenly (2.5, 2.0, 1.6, 1.3, 1.0, 0.8 m/s through the bands; 0.18 s between 1.3 and 1.0 m).
  The same in the browser at 30 steps a second: `node tests/motion.mjs --only landing`
  keeps the height at every frame (`motion.json`, `meta[].alt`): 1.99 m to 0 in 44 frames,
  no plateau. My landing logic does not hold the ship there.
- *The landing crouch*: the explorer model is handed `hip`, `clamber01` and `grounded` in
  `animate` (additive); PAINTER's figure does not read them yet. A crouch before a jump
  needs the same from PAINTER.
- *Wind sound*: the level follows the wind through a 0.4 s ease (the filter 0.5 s), so the
  faster gusts do not flutter it.

**Shot before PHYSICS' P11** (`05856b9`: grass near the eye flutters, trunks lean a third as
far, gusts three times as fast): every motion row above. The still and storm rows and
finding 4 are to be re-shot at review 6 before anyone acts on them.

### What the unit tests could not see

9. **A shader that did not compile was accepted** (closed). On PAINTER `23dea80` the
   browser run on the Moon logged `pc-cloudshell: 'uStorm' : redefinition` (the shared
   chunk's `uniform float uStorm` of quality push 2, `aeff8a6`, against the cloud shell's
   `uniform vec4 uStorm`): no cloud deck on any banded world from outside. The 19 world
   tests and my 115 pass on that commit; only a browser run fails. PAINTER found it too and
   fixed it in `cf2058a`; my runs on `cf2058a` and `c0e6d03` have no console error. For the
   coordinator: acceptance of a PAINTER block should include one browser run that looks at a
   banded world from space (`node tests/all.mjs --only m3,painted-trip` does).

## Review 5, addendum: the three MUST FIX re-measured, 2026-11-11, at commit `0de3fb4`

Asked for by the coordinator after PAINTER's M3 block 2 (`6bb6c91`) and PHYSICS' P7
(`62d061a`, `c11ca37`). Everything on a clean export of `0de3fb4` (their own commits, not a
WIP snapshot), in the game, one browser at a time. Evidence: `docs/lead/evidence/
weather-recheck.jpg` and `.json` (five weather frames), `cost-recheck.json`,
`space-recheck.jpg` (cockpit above the air, orbit, space with a target, the pulse),
`player-recheck.jpg` (night on foot, low flight, cockpit in flight, Saturn at dusk).

**Verdict: two of the three are closed. One is left, for PAINTER, by 1.8 %.** *(Withdrawn by the owner's instruction, 2026-11-11: no count of triangles or draw calls is a limit any more; the numbers stay as a record.)*

| MUST FIX | Before (review 5) | Now, on `0de3fb4` | Verdict |
| --- | --- | --- | --- |
| PAINTER 1, the budget: vista `earth-temperate_forest-1`, quality 1 | 614 k / 341 | **611 k / 339** (budget 600 k / 350) | withdrawn by the owner's instruction (was OPEN: 11 k triangles over) |
| the same vista, quality 0 | 306 k | **304 k** (budget 300 k) | withdrawn by the owner's instruction (was OPEN: 4 k over) |
| the storm at the Earth spawn after dark | 606 k / 315 | 550 k / 300 (by day 527 k / 287) | closed |
| the Earth spawn in fair weather (not a MUST; for scale) | 549 k / 294 | 546 k / 294; quality 0: 272 k | inside |
| PAINTER 2, pepper in dark washes and space | hard specks in every dark wash | none in the storm sky, Neptune's sky, the night at the spawn, space or the pulse frame, looked at 1:1 | **closed** for the washes (see below for what is left) |
| PHYSICS P1, storms bring wind | thunderstorm under 9 m/s above the wood; blizzard 1.4 to 9; dust storm 2 to 3 | thunderstorm 10 to 23 m/s at 30 m, 4 to 11 at 10 m inside the wood, 3 to 8 at 2 m; blizzard 12 to 25 at 10 m (`visibility01` 0.25); dust storm 10 to 20 at 10 m | **closed** (`R-STORM-5` as reworded: in the open at 10 m) |

Other dearest views re-measured at quality 1 and 0: Mercury's crystal garden 420 k / 326 and
217 k; Venus' fungal towers 547 k / 265 and 208 k; Jupiter's hanging gardens 508 k / 238 and
231 k. PAINTER's trim moved the spawn and the storm; it did not move the vista (614 k to
611 k), which looks down a longer run of full trees than the spawn does.
`node tests/cost.mjs --places "earth:vista:earth-temperate_forest-1" --qualities 0,1`.

**The windy storm in the game** (asked for: P7.3 and P7.4 had never run in a browser).
- The weather frames again (`weather-recheck.jpg`): no console errors. The storm by day now
  has the rain as a soft slanted glaze (review 5's item 3: **closed**; it is the wind that
  slants it), a closed sky in the blizzard (`overcast` 0.83, was 0.54), and Neptune's storm
  coast under cloud for the first time ("mist", `overcast` 0.54, `storm` 0.68).
- Walked and flown with real key events in the browser at the spawn, clock 660 to 760 s
  (scratch `run3/stormwalk.mjs`): wind at the explorer 0.9 to 6.1 m/s in gusts and lulls,
  12.5 m/s at the hovering ship; W, S, A and D each held five seconds make 3.5 to 4.0 m/s,
  feet on the ground throughout; a 2.5 s jetpack hop is carried 4 m; the ship, hands off for
  15 s, moves 0.5 m; sink held, it lands in 9 s. No console errors.
- The same in the pure simulation at 60 Hz, in the blizzard on the open meadow (17.5 m/s at
  the explorer): the walk holds 4.2 m/s in every heading, a hop is carried 18.5 m, the ship
  drifts 0.5 m in 25 s and lands. PHYSICS' riskiest change is safe to walk and fly in.

**What is left of the pepper, and what the new frames show** (all SHOULD FIX, PAINTER):
- The ragged border is still a row of hard dark dots in every dark scene; and dark specks
  remain along crown edges against the storm sky.
- The lightning frame still has white dust round the crowns (review 5, item 4).
- **Space has no stars**: in the four frames above the air there is not one (art bible 8:
  spattered masking-fluid stars, salt). The washes themselves are right. The pulse frame is
  still a still picture (PAINTER's next item).
- The near-ground layer is denser and reads more like grass on the lawn than at `62d3529`;
  on Saturn's plain and at night it is still rows of dark spikes. Not re-checked on snow.
- Neptune's sea is still the same clear blue under the new cloud.

**PILOT, since review 5** (the coordinator's relay of PAINTER's and PHYSICS' findings):
PAINTER's six points on the interface taken; the HUD's lower slips move to the top in the
cockpit so the three dials show (`space-recheck.jpg`, first frame); the boom is 5.2 m (was
6.4); a sink that stalls near the ground lands or says why (PHYSICS' hover at 4.1 m on the
Moon: not reproduced in six tries over sloping, bouldered ground, guarded all the same); the
thin-air worlds fly at about 78 m/s under 60 m and reach 138 m/s above 400 m; the three
wall-clock assertions in my unit tests no longer fail on a busy machine. **The step of
`tests/all.mjs` that failed on `db22516` was my fault** (it pinned the quality tier that the
check then reads); fixed.

**Every check on the head after all of this**: `node tests/all.mjs --export` on the export of
`d149255`: ALL 13 PASSED (unit 105, PHYSICS 222, PAINTER 19, the static rules, play-through
37 checks three times over, the trip 47 twice, m3 28 twice, pointer lock, sound; the painted
play-through and the painted Earth, Mars, Saturn trip among them), no console errors.

Not done in this addendum: the tour (114 frames, about two hours of a quiet machine) was not
re-run on `0de3fb4`; nothing was judged in motion.

---

## Review 5 (weather in the game; M3 in progress): 2026-11-11, at commit `62d3529`

Not a milestone gate: PAINTER's M3 block 2 (real models, near-ground layer, rain glaze, pepper)
and PHYSICS' P7 (marks, waves and sky tuned against the picture) are both in mid-flight, and
this review looks at what they had committed at `62d3529` (PAINTER's `29686e8` "near ground
1", PHYSICS' `44c0101` "P7.1"). Everything below was run by me, in the game itself, on a clean
export, one browser at a time, software GL. Evidence: `docs/lead/evidence/weather.jpg` and
`.json` (twelve frames, third person as the player sees it, 960x540, quality 1, HUD hidden;
made by `node tests/weather.mjs`), `docs/lead/evidence/cost.json` (`node tests/cost.mjs`).

**Open MUST FIX after this review.** PAINTER: two, both carried into M3 by the coordinator
(items 1 and 2). PHYSICS: one, new (item P1: storms bring no wind). PILOT: none known.

What I ran, and what came back:
- The weather set, twelve frames, **no console errors**, every frame settled. The numbers are
  the game's own counters (the read-out's `scene` and `weather` lines, now also in
  `__pc.info().weather`):

  | frame | game clock, local time | PHYSICS says | triangles | draw calls | kits (calls, triangles) |
  | --- | --- | --- | --- | --- | --- |
  | Earth spawn, before | 544 s, 17:12 | mist | 579 k | 299 | 2, 34 |
  | **Earth spawn, in the storm, as the game gives it** | 724 s, 19:48 | thunderstorm | **606 k** | 315 | 5, 3.3 k |
  | the same, forced flash | 730 s | thunderstorm | 606 k | 315 | 5, 3.1 k |
  | Earth spawn, after | 874 s, 21:54 | mist | 579 k | 299 | 2, 50 |
  | before, sun held at 11:00 | 544 s | clear | 579 k | 299 | 2, 60 |
  | in the storm, 11:00 | 725 s | thunderstorm | 582 k | 302 | 5, 3.2 k |
  | forced flash, 11:00 | 731 s | thunderstorm | 582 k | 302 | 5, 3.2 k |
  | after, 11:00 | 874 s | clear | 579 k | 299 | 2, 42 |
  | blizzard, Earth's alpine meadow | 474 s, 11:30 | blizzard | 470 k | 234 | 3, 3.5 k |
  | dust storm, Mars' dunes | 845 s, 11:12 | dust storm | 219 k | 108 | 1, 702 |
  | Neptune's storm sea, PHYSICS' own sky | 155 s, 11:18 | windy (30 m/s) | 379 k | 206 | none |
  | the same sea, storm sky forced | 160 s | windy (40 m/s) | 379 k | 206 | none |

  (PAINTER's gallery figure for the storm at the spawn was 551 k and 301. The game's is higher
  because the game has the explorer and the ship in the frame and, since `29686e8`, the
  near-ground layer.)
- **The first storm of the default seed arrives in the dark.** Earth's day is 25 minutes and
  the game begins at 9:30, so the thunderstorm that PHYSICS' default seed sends across the
  spawn at 640 to 800 s falls between half past six in the evening and nine at night. A new
  player who stays at the spawn sees the first four frames of the sheet: a rose dusk, then
  indigo night with pale rain. To judge the storm as a daylight picture I shot it again with
  the sun held at eleven (frames five to eight).
- **Cost in the game at all three quality tiers** (new instrument, `node tests/cost.mjs`; on
  the clean export of `83c604c`, PAINTER's "near ground 2"): the dearest tour frame of every
  body and the Earth spawn, third person as the player arrives, fair weather held, the real
  explorer and ship in the frame, settled. Triangles / draw calls:

  | place | quality 0 (300 k) | quality 1 (600 k, 350) | quality 2 (1.2 M) |
  | --- | --- | --- | --- |
  | earth, spawn | 283 k / 195 | 549 k / 294 | 756 k / 368 |
  | **earth, vista `temperate_forest-1`** | **306 k** / 191 | **614 k** / 341 | 818 k / 405 |
  | mercury, vista `crystal_gardens-2` | 217 k / 167 | 420 k / 326 | 505 k / 419 |
  | venus, vista `fungal_towers-2` | 211 k / 133 | 549 k / 264 | 627 k / 305 |
  | moon, `crater_fields` | 178 k / 92 | 419 k / 160 | 494 k / 189 |
  | mars, `rust_canyons` | 165 k / 99 | 375 k / 210 | 410 k / 252 |
  | jupiter, vista `hanging_gardens-2` | 240 k / 139 | 534 k / 246 | 664 k / 297 |
  | saturn, vista `crystal_reeds-2` | 245 k / 126 | 454 k / 211 | 511 k / 241 |
  | uranus, vista `teal_sinkholes-1` | 201 k / 118 | 398 k / 210 | 445 k / 234 |
  | neptune, vista `storm_seas-1` | 234 k / 135 | 427 k / 242 | 482 k / 281 |
  | pluto, vista `lilac_mountains-1` | 145 k / 91 | 338 k / 167 | 414 k / 202 |

  No console errors. This is the first time quality 0 and 2 have been measured in the game.
  One view is over at quality 1 and at quality 0, the same one as in review 4; every draw-call
  count is now inside (Mercury's crystal garden was 365 with my placeholder models, 326 with
  the real ones, which are one draw call each).
- PHYSICS' weather measured in Node on the same export (scratch `run3/sky.mjs`, `wind.mjs`):
  see the PHYSICS section.
- My own unit tests: 105 pass. `node --test src/physics/`: 215 pass. `node --test
  src/world/*.test.mjs`: 19 pass.
- **The game end to end, on a clean export of `db22516`** (`node tests/all.mjs --export`, the
  new one-command check): play-through in the painted world 37 of 37 checks, the Earth, Mars,
  Saturn trip in the painted world 47 of 47 (reload from the save included), and the same on
  stubs and with PHYSICS; no console errors, no request off the page's own server. One step
  of thirteen failed, through a fault in the step, not in the game (see the addendum).

### PAINTER (M3 in progress)

MUST FIX (M3; both carried by the coordinator's ruling when M2 closed)

*(Withdrawn by the owner's instruction, 2026-11-11: no triangle budget; kept as a record.)*
1. **The frame budget with weather, the real models and the near-ground layer in** (600 k
   triangles and 350 draw calls in the densest view of every body at quality 1, measured in
   the game). **Still open, by a hair, in one view and in one situation**: the vista
   `earth-temperate_forest-1` is at **614 k** triangles and 341 draw calls in fair weather at
   quality 1 (review 4: 652 k and 368 with my placeholders; the draw calls are now inside)
   and at **306 k** at quality 0 (budget 300 k); and the thunderstorm at the Earth spawn, at
   the hour the game gives it, is at **606 k** and 315. Everything else measured is inside:
   291 k to 549 k at quality 1, at most 818 k at quality 2. Wanted, as before: 600 k or less
   and 350 or less at that vista at quality 1 in fair weather and in the storm, 300 k or less
   at quality 0 (`node tests/cost.mjs --places "earth:vista:earth-temperate_forest-1"`).
   One thing to look at on the way: the same storm at the same spot costs **606 k at night and
   582 k at eleven in the morning**, while the night without the storm costs 579 k. Something
   is submitted only when it storms after dark (24 k triangles, 13 draw calls; the kits are
   3.3 k and 5 in both). To see it: fresh game, `__pc.setClock(710)`, wait until
   `__pc.sim.t > 724`, read the `scene` line; then `__pc.teleport({ hour: 11 })` and read it
   again.
2. **Pepper in dark washes and in space.** Still there, and the weather makes more dark
   washes: the storm sky, the wet ground at night, Neptune's sky and sea (the blue sky of the
   Neptune frame is the worst: hard dark specks over the whole wash), and the ragged border,
   which goes dark and dotted under the storm key (your own note). You have this on your list
   for block 2; it is measured again when you report.

SHOULD FIX (the weather as a picture; judged against the art bible, at 960x540)

3. **Rain is still pale opaque sticks** (`R-RAIN-6`: "never white lines"). PHYSICS' P7.1 has
   made the strokes parallel and fewer (about a dozen in the frame), which is right; but each
   is a hard-edged chalk-white bar laid over dark trees, the most digital thing in an
   otherwise convincing wet forest. The glaze you have planned is the fix. In the night
   frames the strokes are the brightest marks in the picture.
4. **The lightning frame has white dust round every crown.** With `flash` at 1 the sky lifts
   to paper (good, and `R-STORM-4` holds: paper, not white), but along the silhouette of the
   trees there is a fringe of pure-white specks, two or three pixels each, that reads as a
   dropout. Both flash frames show it (day and night).
5. **The near-ground layer ignores snow.** In the blizzard frame the fresh snow is bare paper
   everywhere except where the new layer draws: a band of bright green flicks lies on top of
   the snowfield across the whole foreground. (Before `29686e8` that foreground was empty
   paper, which was honest.) On Earth's lawn in fair weather the same marks are small dark
   green triangles a metre apart: they read as teeth, not as grass; on Mars and Neptune, as
   pebbles and ripple marks, they are right.
6. **After the storm, the puddles read as holes**: two or three dark, hard-edged patches on
   the lawn (day frame), and on Neptune's beach one hard white kite. `R-RAIN-4` wants puddles
   in hollows; a puddle is a pale, soft-edged piece of sky.
7. **Neptune's sea does not take the storm.** Under the forced storm sky the land darkens and
   the sky is heavy indigo, and the sea stays the same clear ultramarine as in fair weather.
   Under PHYSICS' own sky (30 to 40 m/s of wind) the sea is nearly flat blue with one foam
   line at the shore: no white horses at all (your note: the waves are smaller than the
   brush; see PHYSICS item P3).
8. **The dust storm is a hazy day.** The sky and the far dunes are right (the whole sheet in
   the ground's ochre). Near the explorer nothing is in the air: the ground is crisp to the
   first ridge with a pencil line on it. PHYSICS' new dust walls (1 draw call, 702 triangles)
   cannot be found in the frame.
9. **The blizzard is a quiet snowfall.** As a painting it is the best frame of the set
   (closed sky, the massif going into the white, the explorer's violet shade). As a blizzard
   it is about fifteen pale flecks in the sky and a massif that is plainly visible (PHYSICS
   item P1).

GOOD
- Weather is in the game and costs almost nothing: the kits are 1 to 5 draw calls and 0.7 to
  3.5 k triangles; sky, haze, light and wet ground add no call.
- The real explorer and ship sit in the painting (hat, coat, red pack; a boat-like hull under
  a canopy), with a cast shade under each. They are the first third-person frames in this
  project that do not have a grey capsule in the middle.
- The storm by day passes as a watercolour of a wet wood: dark heavy sky, the far trees lost
  in a pale band, no cast shadows, richer ground.

### PHYSICS (P7 in progress)

MUST FIX (M3)

P1. **Storms bring no wind.** Measured with `physics.air` on the export, at the place and
   time of each frame, at 2, 10 and 30 m above the ground:

   | weather (PHYSICS' own name) | wind at 2 m | at 10 m | at 30 m | visibility |
   | --- | --- | --- | --- | --- |
   | thunderstorm, Earth spawn, 660 to 720 s | 1.1 to 2.6 m/s | 1.6 to 3.7 | 3.8 to 8.7 | 2.6 to 3.1 km |
   | the drizzle before it, 600 s | 1.7 to 4.2 | 2.5 to 6.0 | 4.9 to 11.7 | 7.6 km |
   | blizzard, alpine meadow, 400 s | 4.7 to 9.2 | 6.5 to 12.7 | 7.7 to 15.1 | 1.2 km (`visibility01` 0.25) |
   | the same blizzard, 470 s (snowfall 0.87) | 1.4 to 4.1 | 2.0 to 5.7 | 2.4 to 6.8 | 2.0 km (0.31) |
   | dust storm, Mars' dunes, 840 s | 2.2 to 3.4 | 2.8 to 4.2 | 3.2 to 4.8 | 350 m |

   `R-STORM-5` asks for gusts of 15 to 30 m/s in a thunderstorm; the storm at the spawn peaks
   under 9 m/s above the canopy and under 3 m/s where the player stands. `R-STORM-2` asks for
   the wind to rise before the rain; here the wind is highest in the drizzle before the storm
   and **falls** as the storm arrives. A blizzard is by definition a wind (15 m/s and more,
   visibility under 400 m); a dust storm on Mars needs a wind strong enough to lift dust. In
   the game all three are the local breeze multiplied by a `windFactor` of 1.4 to 2.5, so what
   the player gets is rain, snow or haze falling through still air: trees that do not toss,
   flakes that drift down, dust that hangs. Wanted: each storm brings its own wind (a gust
   front ahead of the rain; sustained 15 m/s and more in a blizzard with `visibility01` at
   0.3 or less for as long as it is called one; 20 m/s and more in a Martian dust storm), in
   `physics.air`, so that everything that already follows the wind (plants, marks, waves, the
   sound) shows it. The assists keep the explorer on its feet (`R-FOOT-5`).

SHOULD FIX

P2. **The first storm falls in the dark** (see above): 640 to 800 s is 18:30 to 21:00 at the
   spawn. Your note says "late in the first morning". A seed (or an offset) that sends the
   first storm across the spawn before about 400 s (15:30) would let a new player see it.
P3. **Neptune's `storm_seas` never storms.** At the biome's stand, scanned every 20 s for two
   hours of game time: "windy" under a cloudless sky (`cloud` 0, `haze` 1) for most of it,
   with short spells of drizzle, rain and ice fall; never a storm. The wind is 26 to 47 m/s
   at 2 to 10 m (hurricane force) and the sea it raises is 1 m high and 10 m long, which at
   the game's distances is smaller than PAINTER's brush. A sea named for its storms needs a
   storm sky most of the time and a swell that can be seen from the shore (PAINTER asked for
   the same).
P4. **Dust in the air of Earth's forest**: `sky.dust` is 0.27 to 0.29 at the spawn at 600 to
   630 s ("windy", then the first rain) and 0.18 to 0.23 as the storm leaves. A wet temperate
   wood has no dust to raise; is this haze under another name?
P5. Carried from review 4: the stateless `physics.sky(physics.weather(...))` and `here.sky`
   disagree (one visible case today: jumping the clock from 730 to 860 s leaves `wet` at 0.99
   where your state would have dried to 0.4; only tools jump the clock, so it is cosmetic).
P6. **A wind the player cannot walk in.** On Neptune's storm coast the wind at the explorer is
   33 m/s whenever one visits. In the pure simulation (my `Sim`, your body model, PAINTER's
   ground; scratch `run3/windwalk.mjs`, export of `62d3529`): standing still for 15 s the
   explorer does not move (good); walking **downwind makes 0.60 m/s**, upwind 3.54, across
   2.87 (still air 4.2); a 2.5 s jetpack hop is carried 85 m. Downwind slower than upwind is
   the wrong way round whatever one thinks of the rest. And a coast where one heading is
   always a crawl and every hop is a throw fights the player (`R-FOOT-5`: "up to about 25 m/s
   a fit body leans"). Two ways out: a boundary layer that leaves 10 to 15 m/s at two metres
   under a 40 m/s wind aloft, or a lever in the command that says how much of the wind the
   suit cancels (feel is PILOT's call; I would set it so that no heading is under 3 m/s and a
   hop is carried at most 15 m).

GOOD
- P7.1's marks: the rain is parallel and sparse, as PAINTER asked; the snow flecks have their
  own shapes.
- 215 tests pass. The worst `physics.update` frame I saw in the browser was 66 ms under load
  (software GL, three agents on four cores: not a measurement of your code).

### PILOT (self-review)

- **The thicket** (review 4, item 2, my half): a third-person boom squeezed under 2.3 m by
  trunks, crystals or the hull now slides the view into the explorer's eyes (fully at 1.3 m),
  eased over a third of a second, and back out when there is room; the explorer is not drawn
  while it does. Unit-tested, and seen in the game (scratch
  `run3/cost/thicket.jpg`, on `83c604c`): at `mercury-crystal_gardens-2` the boom is 0.8 m and
  the view is fully the explorer's; at `uranus-frozen_waves-2` 1.56 m and 84 % of the way in.
  No frame is the back of a hat any more. **What the camera cannot fix**: both frames are now
  filled by the crystal face and the wave wall that stand a metre or two in front of the
  easel. Review 4's item 2 stays with PAINTER for those two sites (a few metres clear in
  front of the easel as well as behind it). `saturn-crystal_reeds-2` reads as a picture of
  reeds and can stay.
- **Stepping out of the ship** started with the boom at 0.8 m (the camera faced away from the
  hull, so the hull was at its back): the view now turns along the hull until the boom has
  room. Found by the new camera test; it had been so since M1.
- **Mars' spawn** (PHYSICS' finding, confirmed): running from the spawn in eight directions for
  25 s each in the pure simulation with the real ground, obstacles and physics, one heading
  made 5 m (wedged between a rock 0.48 m high and one 0.99 m high) and the others 127 to 154 m
  with up to 2.6 s lost. Fixed on my side, not by moving the spawn: obstacles up to 1.3 m are
  ground the explorer walks up and over; and wedged between two tall ones with the key held,
  the suit walks round the thinner. After: 170 to 179 m in every heading on Mars; Mercury's
  one stall (two crystals) 5 m to 146 m; Neptune's 101 m to 167 m. Two tests.
- **The painted theme, second pass**: keys, button, tabs, pencil frames, rules, map, gauges
  (`docs/shots/pilot/ui-*.jpg`). Not yet looked at by PAINTER. The frame read-out stays plain
  type on purpose.
- Still open in my domain: nothing has met a real mouse, a real pad or a real GPU; the pulse
  profile is still mine, not PHYSICS'.

---

## Review 4: 2026-11-11, at commit `ded1435` (PAINTER's third pass `334eb16`; before its weather block)

The gate for M2 as a whole. Everything below was run by me on a clean export of `ded1435`,
one browser at a time, in software GL. The tour sheets and their numbers are in
`docs/lead/evidence/tour-<body>.jpg` and `.json` (960x540, quality 1, 10:00 local time, HUD
hidden; biome frames in first person from the world's stand, vistas in third person as the
player arrives, one frame from orbit). The plan this review follows is the next section.

**Verdict: M2 has one open MUST FIX for PAINTER, a small one (item 1). With it fixed or
waived by the coordinator, M2 is closed.** PHYSICS: no MUST FIX. PILOT: none known.

What I ran, and what came back:
- `node --test tests/contract.test.mjs`: 8 of 8. The contract holds on all ten bodies, the
  terrain stays under the ceiling, spawns are dry and gentle, 39 of 40 scripted landings set
  down (one honest "too steep" on Earth at -20, -60), and the Earth, Mars, Saturn trip flies in
  the pure simulation on the real worlds (lands in `rust_canyons` and `ring_shadow`).
  `node --test src/world/*.test.mjs`: 19 pass. `node --test tests/*.test.mjs`: 102 pass.
  `node --test src/physics/`: 196 of 197 on this export, which is a coordinator's snapshot of
  PHYSICS' files in mid-edit; its accepted P6 commit is later (not re-run by me).
- Landing survey, 24 spots a body: 235 of 240 from a hover (3 "too steep", 2 "no level
  ground", all said on screen); 232 of 240 entered at speed. No body has a biome that cannot
  be landed in.
- The tour of all ten bodies: 114 frames, **every one settled** (`world.busy` at 0 for ten
  frames) in 0.1 to 58 s, **no console errors**, every vista counted as found where the
  explorer was put, no place had to be moved off wet or steep ground, nobody stands in liquid.
- Cost in the game, the dearest frame of each body at quality 1 (budget 600 k triangles, 350
  draw calls):

  | body | triangles | draw calls | where |
  | --- | --- | --- | --- |
  | mercury | 409 k | 365 (344 without my placeholder models) | vista `crystal_gardens-2` |
  | venus | 545 k | 293 | vista `fungal_towers-2` |
  | **earth** | **652 k (645 k without the models)** | **368 (352)** | vista `temperate_forest-1` |
  | mars | 347 k | 240 | `rust_canyons`, `dry_riverbeds` |
  | jupiter | 535 k | 292 | vistas `hanging_gardens-2`, `sky_islands-1` |
  | saturn | 438 k | 260 | vistas `crystal_reeds-2`, `gold_islands-1` |
  | uranus | 375 k | 215 | vista `teal_sinkholes-1` |
  | neptune | 418 k | 261 | vistas `storm_seas-1`, `aurora_tundra-1` |
  | moon, pluto | 410 k, 318 k | 185, 189 | |

  The two bold numbers were measured again, five frames each, settled, with and without the
  explorer and ship (scratch `run2/remeasure.mjs`): identical every frame.
  Neptune's `kelp_forests` is 359 k (review 3: 727 k). Quality 0 and 2 were not measured in
  the game in this review (PAINTER's gallery: at most 299 k at quality 0).
- `world.update` worst frame: 42 to 511 ms on the tour. That is not a measurement of the 5 ms
  budget: in software GL a frame takes 300 to 1000 ms, and above 80 ms PAINTER's builder takes
  30 % of the frame on purpose. At real frame rates the slice is said to be 4 ms; nobody here
  can check that. See SHOULD FIX 9.
- Space and the pulse drive at 960x540, quality 1: `docs/shots/pilot/m2-pulse.jpg` (new).
- `R-WX-1`: measured, and reworded in `REFERENCES.md` (see PHYSICS below).

### PAINTER

MUST FIX (M2)

*(Withdrawn by the owner's instruction, 2026-11-11: no triangle budget; kept as a record.)*
1. **Earth's first vista is over the frame budget.** Standing at the vista
   `earth-temperate_forest-1` (the easel of the home forest, the first view a new player will
   find) at quality 1, the game submits **645 k triangles and 352 draw calls for the world
   alone**, 652 k and 368 with the placeholder explorer and ship. The budget, upheld by the
   coordinator, is 600 k and 350 in the densest view, measured in the integrated game. To see
   it: `index.html?stats=1&quality=1&dynres=0`, then in the console
   `v = __pc.world.getVistas('earth')[0]; __pc.teleport({ body: 'earth', dir: [v.unitDir.x, v.unitDir.y, v.unitDir.z], heading: v.yaw * 57.2958 })`,
   wait for `world.busy === 0`, read the second line of the read-out. Wanted: 600 k or less
   and 350 or less there, with room for the real explorer and ship (my placeholders cost 7 k
   triangles and about 20 calls; Mercury's `crystal_gardens-2` is at 344 calls without them
   and will go over with them). Honest note for the coordinator: the overrun is 7.5 %, in one
   view, against a budget that is itself a stand-in for a frame rate nobody can measure here;
   a waiver would be defensible. I hold it because the budget only means something if the
   densest view of the showcase obeys it, and because the weather block has since added more.

SHOULD FIX (none blocks M2; several are M3's art pass in all but name)

2. **Three second-site vistas stand in a thicket**: `mercury-crystal_gardens-2` and
   `uranus-frozen_waves-2` (the third-person camera is jammed against a crystal or a wave and
   the frame is the back of a hat), `saturn-crystal_reeds-2` (reed stalks between the camera
   and the explorer). The easels are tested to stand on open, dry ground of their biome; the
   second sites need the same test plus a few metres clear of tall kits. (Mine as well: when
   the boom is squeezed under two metres the camera should go to first person. Noted.)
3. **From orbit, Mercury and Neptune read as glass balls**: a dark disc inside a bright rim
   line. `R-SPACE-5` wants a rim that fades to paper. Earth's cloud is hard-edged white
   patches with dashes round the limb. Venus, Mars, Jupiter, Saturn and Uranus read as painted
   globes; Saturn with its rings across the frame is the best orbit view in the game.
4. **Dark washes are peppered** (`m2-pulse.jpg`, Mercury's sky, Neptune's sea and sky): dense,
   hard, dark specks two to four pixels across are the first thing the eye meets in space.
   Art bible 3 wants granulation that settles into the paper's grain, 8 wants salt and
   spattered stars. Space is M3 by the brief, so this does not gate M2; in M3 it is a MUST.
   In the pulse frame nothing streaks or softens yet (`speed01` is 1 there).
5. **Mars' dunes at mid-morning** are flat tan planes divided by ruler-straight crest lines
   (art bible 4); they were painted for 16:12 and the player arrives at any hour.
   `dry_riverbeds` shows the grove and no bed.
6. **Uranus**: `ice_shelves` is a rounded scarp, `frozen_waves` are capped mounds (your own
   "partly"). The glowing sinkhole is the frame to bring them up to.
7. **Crystals and blades** (Mercury) keep straight edges and flat faces: they read as cut
   paper more than as washes. Venus' fungal towers are still the busiest frame (review 3,
   item 4), and Venus and Mars have dark, hard-edged blots lying on the foreground.
8. **Earth**: `misty_wetland` is nearly empty; `sea_coast` is a cove under cliffs more than a
   sea. Both show their feature; neither is yet a picture one would walk to.
9. **A way to pin the build slice**: accepted that above 80 ms a frame the builder takes 30 %
   of it (a machine that slow is unplayable anyway, and it catches up sooner). But it leaves
   me unable to measure the 5 ms worst frame at all in software GL. Please let
   `world.setBuildBudget(ms, { fixed: true })` (or a URL switch) hold the slice at its real
   value, so the read-out's "world worst" means something in a headless run.

GOOD
- **Every biome the brief names is there**, in the game, where the player is put: canyon
  walls and a butte on Earth, strata and spires on Mars, lava through basalt and a green acid
  lake on Venus, sky-islands in a cloud sea and vines down a cliff on Jupiter, the ring arc
  over Saturn's islands, the teal sinkhole, basalt stacks in an ultramarine sea, the crater
  bowl on Mercury. By my reading of the eight sheets: 27 of 33 clearly, 6 partly
  (`mars-dust_dunes` at this hour, `mars-dry_riverbeds`, `uranus-ice_shelves`,
  `uranus-frozen_waves`, `neptune-aurora_tundra`, `jupiter-lightning_plains`), none missing.
  The stretched ground streaks and the hexagon cracks of the second pass are gone.
- `world.busy` drains everywhere (review 3, item 2: closed). Neptune's spawn is inside the
  budget (review 3, MUST FIX 1: closed).
- The stands and easels: arriving in a biome now shows the biome. `findBiome` with `yaw` and
  `pitch` made the tour honest without any guessing on my side.
- 40 landings, a 240-spot survey and the trip survive a pass that changed every landform.

### PHYSICS

No MUST FIX.
- `R-WX-1`, the question left for this review: does 5 %/s stand for snow squalls? Measured
  through `physics.here.sky` at 2 Hz for half an hour at twelve places a body (scratch
  `run2/squall2.mjs`): on Earth a snow front moves haze 6.3 %/s and snowfall 5.1 %/s,
  everything else under 2.2 %/s; on Uranus nothing over 4.3 %/s; on Neptune rain 8 %/s at a
  storm front, a fog bank 14.6 %/s, overcast 6.2 %/s. So: no, not as a single number. The
  fronts are physical and stay. The check now reads 8 %/s on Earth-like worlds and 15 %/s on
  the ice giants, and PAINTER eases what it shows with a time constant of 2 s or more.
- SHOULD FIX: the stateless query disagrees with the state. `physics.sky(physics.weather(body,
  p, {}, { time }))` at a fixed place, stepping one second: `wet` jumps 55 % in a second on
  Uranus under "windy" and `snow` 10.7 % (scratch `run2/squall.mjs`), while `here.sky` at the
  same places moves 0.5 %. Anyone who reads weather away from the focus will see pops.
- SHOULD FIX (carried from review 3): one test was red in the snapshot `ded1435`.
- Taken from P6, all five levers (in my notes, Decisions 15); flown only by the unit tests
  and one scripted trip so far.

### PILOT (self-review)

- Found by this review in my own domain: the third-person camera has no answer to a thicket
  (item 2); the tour's sheet capture failed twice in a tired browser (fixed: the numbers are
  written first, the sheet is laid out in a fresh browser if need be); the landing prompt
  flickered over rough ground (fixed earlier in this run).
- The painted trip and play-through passed in the browser on the export of `5d411f2`, which
  had PAINTER's work in progress, not `334eb16`. On `ded1435` the browser has stood in every
  biome and at every vista without an error, and the trip passes in the pure simulation; the
  scripted browser trip on the reported commit itself was not re-run.

---

## Review 4: the plan it followed (written before PAINTER's third pass had reported)

Review 4 is the gate for M2 as a whole. It starts when the coordinator relays PAINTER's report,
and it is run on a clean export of that commit (`tools/export-head.sh`), one browser at a time.

1. **Contract and landings** (seconds): `node --test tests/contract.test.mjs` (the contract on
   every body, terrain ceiling, dry spawns, 40 landings, the real-world trip in the pure
   simulation), `node --test src/world/*.test.mjs`, `node --test src/physics/`. Then the
   landing survey (scratch `run2/landsurvey.mjs <export> 24`): 24 spots on every body, from a
   hover and at speed. Baseline before the pass: 235 of 240 land; every refusal says why.
   MUST FIX if a body has a biome nobody can land in, or a refusal without a word.
2. **Cost per body, in the integrated game**: the tour records triangles and draw calls for
   every biome frame and every vista frame at quality 1 (budget 600 k triangles, 350 calls;
   review 3 found Neptune's `kelp_forests` at 727 k). Quality 0 (300 k) and 2 (1.2 M) at each
   body's densest frame with `?quality=0|2&dynres=0&stats=1`. MUST FIX over budget.
3. **`world.busy`**: every tour frame must settle (ten frames in a row at 0) within 120 s in
   software GL; the sheet says which did not. Baseline on PAINTER's committed state of
   2026-11-11 (`a46647f` export): no Earth biome frame settled in 90 s (busy 267 to 412).
   MUST FIX if frames still do not settle: it is the readiness signal for the title card,
   for sketches and for every capture, and PAINTER's own test for it must pass.
4. **`world.update` worst frame**: the tour's caption carries the worst of the last 90 frames
   at each place (software GL on a shared machine: read as relative, and re-measured in Node
   through PAINTER's own profile where a number looks bad). Budget 5 ms. SHOULD FIX unless it
   is tens of milliseconds on arrival, which a player would feel as a hitch.
5. **The freeze-frame test, frame by frame**: `node tests/tour.mjs --bodies <b>` for all ten
   bodies at 960x540, quality 1: every biome (on dry ground of that biome), every vista
   (where the game sends the player, facing the painter's way), one frame from orbit. Each
   frame is judged against the art bible's ten points and against the brief's own words for
   that biome ("rust canyons", "floating sky-islands in banded cloud seas", ...). One line a
   frame in the review: does it show its named landform (yes / partly / no), what reads as
   digital (facets, ruler-straight edges, stretched streaks, tiling, pepper grain, flat
   washes, dark shade instead of a glaze), and whether the vista is a view worth walking to.
   MUST FIX: a biome whose named feature is not in its frame, a vista under liquid or on a
   cliff face, visible facets or streaks. The coordinator can waive single biomes.
6. **From orbit and in space**: the orbit frame of every body (distinct biome colours, soft
   terminator, rim that fades to paper, no seams: `R-SPACE-5`), and the dark specks in space
   seen in `docs/shots/pilot/m2-pulse.jpg` (art bible 1: nothing is black; 8: salt and
   spattered stars, not pepper). Re-shoot the pulse frame at 960x540 and look at it at full
   size. SHOULD FIX unless it reads as noise at a glance, then MUST.
7. **The trip and the loop in the painted worlds**: `node tests/playthrough.mjs` and
   `node tests/trip.mjs` on the export (400x225 for the run, 960x540 for the evidence frames).
   MUST FIX on any console error or a leg that cannot be flown.
8. **`R-WX-1` and snow squalls** (PHYSICS): does the 5 %/s limit on visibility stand? Measure
   `physics.here.sky` at 10 Hz through a squall front on Uranus or Neptune and through the
   Earth thunderstorm (`find=` in the lab gives the place and time): the largest change per
   second of `haze`, `fog`, `snowfall`. The check already allows fog banks and dust fronts to
   arrive faster; if a squall front does too, the check is reworded for precipitation fronts
   and PAINTER is asked to low-pass what it shows (a pop in the picture is the real fault).
9. **Not in review 4** (M3, listed so nobody builds on sand): weather in the picture, the real
   models, night and dusk as paintings, the interface theme (PILOT's; PAINTER reviews it).

Interim finding for PAINTER, measured during this run (no need to wait for review 4):
`world.busy` does not reach 0 on the committed state (item 3). If the fix is in your working
tree, say in your notes which commit carries it.

---

## Interim notes: 2026-11-11, second PILOT agent (not a milestone review)

What I ran is in `docs/notes/pilot.md` ("Ground truth"): every check on clean exports, the
painted play-through and trip, a landing survey of 240 spots, and the new tour on Earth.

### PAINTER (interim: your pass has not been reported, so nothing here is a verdict)

Seen on the tour sheet of Earth taken from your committed work-in-progress (export of
`a46647f`, 960x540, quality 1; the sheet is in my scratch, not in the repo, because it is not
your reported state):
- Better than the frames the coordinator turned down: `desert_canyon` now faces a banded wall
  with a mesa behind it, `alpine_meadow` has a mountain, `sea_coast` has cliffs round a cove,
  and the easels put the camera where the landform is. Keep going this way.
- **Nothing settled**: `world.busy` stood at 65 to 412 after 90 s in all eight frames on foot
  (it reached 0 in 7.6 s from orbit). This will be a MUST FIX in review 4 if it is still so.
- From orbit the globe is covered in hard-edged white patches with a ring of dashes round the
  limb: it reads as torn paper rather than cloud and rim. Look at it before you report.
- Cost was inside the budget in every frame (165 k to 420 k triangles, 118 to 244 calls), but
  on unsettled frames that proves little.

### PHYSICS

No MUST FIX. Used this run exactly as written in your notes: the touchdown recipe (the gear
takes the last metre: 0.6 m/s sink, three feet down and asleep within 5 s on Earth, the Moon
and Jupiter, `tests/physics.test.mjs`), `sky.rain`, `cover.canopy01`,
`particles.system.dripping`, `thunderIn` / `thunder01` and `st.phys.material` for the sound.
Your reading of the flight pace is right (the giants and Earth within 10 m/s): leave the
envelope, let the wind tell the giants apart; I will take a proposal when you have flown it.

### PILOT (self-review of this run; the other roles and the coordinator review this domain)

Added: the sketchbook's sketches, the measured and retuned sound, the painted interface
(paper, lettering, ink markers, cursor), touchdown on the legs, a gamepad, a tour that stands
where the game sends the player. Weak or unverified, bluntly:
- The interface theme is a first pass by someone who is not the painter. The lettering is
  neat rather than beautiful (one weight, no thick-and-thin), the paper slips cast a drop
  shadow that a real sheet on a painting would not, the icons are only four. PAINTER's call.
- The sound is measured, not heard. Timbres are still guesses (the ship is two oscillators).
- The gamepad has only met a simulated pad.
- The painted trip failed once on Saturn because E was pressed just as the prompt went out;
  fixed with hysteresis and a spoken reason; the re-run's result is in my notes.
- Sketches are 192x108: charming at thumbnail size, soft if ever shown larger.
- Planet markers and all HUD slips are DOM over the canvas: they do not get the painting's
  own paper grain or the ragged border treatment of the frame itself.

---

## Review 3: 2026-11-11, at commit `22a10c3` (Painter's `ff51af7` and `1e1801e`, Physics' P2 work in progress)

Short pass, during M2. What I ran:
- Frame cost standing at the spawn of every body in the integrated game (quality 1, 400x225,
  clean export of `ee4c336`; counters from the game's read-out).
- `tests/contract.test.mjs`: 40 landings (the spawn and three other places on each of the ten
  bodies) and the Earth-Mars-Saturn trip on Painter's real worlds with Physics on.
- `node --test src/physics/` on a clean export of `22a10c3`: 158 pass.
  `node --test src/world/*.test.mjs`: 12 pass.
- The scripted trip and the M1 loop inside the painted worlds (results in Pilot's notes).
- Looked at `docs/shots/painter/` (960x540): venus, neptune, mercury from orbit.

### PAINTER (M2 in progress)

MUST FIX (M2)

*(Withdrawn by the owner's instruction, 2026-11-11: no triangle budget; kept as a record.)*
1. **Neptune's spawn is over budget: 727 k triangles at quality 1** (`kelp_forests`; budget
   600 k). Every other body is inside it:

   | body (biome at the spawn) | triangles | draw calls |
   | --- | --- | --- |
   | mercury (obsidian_fields) | 442 k | 296 |
   | venus (lava_rivers) | 312 k | 183 |
   | earth (temperate_forest) | 450 k | 266 |
   | moon (mare) | 333 k | 166 |
   | mars (dry_riverbeds) | 457 k | 247 |
   | jupiter (storm_wall) | 390 k | 206 |
   | saturn (gold_islands) | 394 k | 240 |
   | uranus (ice_shelves) | 334 k | 170 |
   | **neptune (kelp_forests)** | **727 k** | 295 |
   | pluto (lilac_mountains) | 443 k | 190 |

SHOULD FIX

2. **`world.busy` never drains after moving to another body.** After a teleport to each
   planet in turn it sat at 138 to 197 for 90 s and more (it reaches 0 on Earth at boot). If
   those are jobs for bodies the camera has left, they should be dropped; if they are for the
   body in view, something is starved. It is my readiness signal (`__pcReady`, `settle()`).
3. **`world.update` while building**: 8.5 ms on Mercury, 9.4 on Mars, 8.8 on Neptune, 6.3 on
   Earth (smoothed, right after arrival). Budget 5 ms a frame, upheld by the coordinator.
4. **Venus, fungal towers** (`docs/shots/painter/venus-fungal_towers.jpg`): the strongest idea
   so far, and the busiest frame: every stalk carries the same ruler-straight vertical hatch
   (AB 4), the orange foreground shapes are flat cut-outs with hard edges, and nothing recedes
   into the "amber cloud" the brief asks for (AB 5). Thin it: fewer, larger shapes far away.
5. **Neptune, storm seas**: a calm lake under a fair sky. Lovely, not a storm sea. With
   Physics' waves and weather now available this is the frame that should move most in M3.

GOOD

- Every body can be landed on and walked on, in every biome I tried: 40 of 40 landings,
  28 biomes, three of them afloat on Jupiter's and Neptune's liquid.
- Mars and Saturn arrived first, as planned, and the scripted trip plays through them.
- Space from orbit (`mercury-orbit.jpg`): the pepper of review 1 is gone; a soft wash with
  salt marks and a pale rim on the globe. Review 1 item 8 closed.
- `1e1801e` takes up review 2's items: violet shade glaze, wandering shores, and the Physics
  flora field is wired (not yet seen by me in the game: for review 4).

### PHYSICS (P2 in progress)

No MUST FIX.

- GOOD: asked for and delivered within the hour: `cmd.brake` (the drive field as a named
  brake, vacuum only by my choice; my special case is gone), a tested lift-off through the
  gear, a line about the step functions moving `st.p` in place. 158 tests pass on a clean
  export.
- SHOULD FIX: at one point during the restart recovery 7 of 154 tests failed in the working
  tree (uncommitted, mid-edit). Nothing wrong with that, but the other two roles run your
  tests from the same tree: commit green, or say in the notes when the tree is known red.
- SHOULD FIX: in the browser, under load, I still see a worst `physics.update` frame of about
  5 ms on the read-out (0.3 to 0.6 ms on average). Software GL and three busy processes make
  that number soft; it wants one look on a quiet machine.
- Open on my side, not yours: I do not yet call the gear lift-off (my sequence still sets the
  velocity for 2.8 s). First thing in M3 with the real ship model.

---

## Review 2: 2026-11-11, at commit `a9c02bc` (includes Painter's `b2bfcae` and `6a31de3`, Physics' `b0ad22b`)

What I ran:
- The same frame-cost probe as review 1, in the integrated game from a clean export
  (480x270, counters from the game's own read-out, `?stats=1`), at quality 0, 1 and 2.
- `gallery.html?...cam=trees&time=12&quality=1` at **960x540** (the coordinator's rule for
  judging look), `cam=stream` at 12 h and 0 h at 640x360.
- `node --test src/world/*.test.mjs`, `node --test src/physics/` (125 pass),
  `node --test tests/*.test.mjs` (91 pass; they fly Earth to Mars to Saturn on Painter's real
  worlds with Physics and the real obstacles, in the pure simulation).

### PAINTER: M1 is met

MUST FIX from review 1, all three **closed**:

1. **Frame cost: closed.** Measured in the integrated game:

   | view (quality 1) | triangles | draw calls | review 1 |
   | --- | --- | --- | --- |
   | standing at the spawn | 564 k | 334 | 4.36 M, 887 |
   | running | 529 k | 307 | 4.57 M, 848 |
   | flying at 120 m | 217 k | 143 | 1.47 M, 262 |
   | orbit at 5 km | 46 k | 41 | 43 k, 41 |

   Quality 0 at the spawn: 289 k, 206 calls. Quality 2: 708 k, 381 calls. All inside the budget
   (600 k / 350, 300 k, 1.2 M). Software GL at the same viewport went from 0.7 to about 3 fps.
2. **Stippled foliage: closed.** `docs/lead/evidence/painter-a9c02bc-gallery-trees-noon.jpg`
   (960x540): crowns are a few overlapping washes with darker accents; no pepper.
3. **Ruler-straight lines: closed.** Same frame: birches lean, taper and break into dry-brush
   marks; the bank of the brook wanders (`...-stream-noon.jpg`).

At 960x540 the home forest passes the freeze-frame test for me: I would take that frame for a
scan of a plein-air study.

SHOULD FIX (carried or new; none blocks)

4. **Build hitches, still.** `world.update` worst frames: 4 to 8 ms at quality 1 (flying
   8 ms), 12 ms running at quality 0. Budget 5 ms. Better than the 34 ms of review 1, not yet
   inside. The frame read-out now shows `world` ms live (` key).
5. **Shade is dark green, not a cool glaze.** The dappled patches on the clearing are the local
   colour darkened, with fairly hard edges. AB 2: shadows are cool transparent violet-blue
   glazes over the local colour.
6. **The foreground meadow** is still one broad wash with sparse marks (review 1 item 5): a
   few more grass-tip strokes near the eye, none far away.
7. **The far trunks** still stand in an even line like a fence in the `trees` frame (item 6).
8. Night (`...-stream-night.jpg`) is better: trunks take the glaze. Dusk and space unchanged
   from review 1 items 7 and 8; M3 scope.
9. `sampleObstacles` returns at most about 260 entries at large radii. Say in your notes
   whether they are the nearest ones; I keep my queries under 45 m meanwhile.

GOOD (new)

- `canopyHeight` on `sampleSurface`: wired into the ship's cushion the same hour; a low pass
  over the real forest keeps the hull above every tree top (`tests/contract.test.mjs`).
- Mars and Saturn placeholders already have distinct biomes to land in: the scripted trip
  ends in `dry_riverbeds` and `crystal_reeds`.

Answers to PAINTER's questions: the default boom is now 6.4 m (was 5.6) until the real
explorer exists. `speed01` and `altitude01`: nothing needed before M3; in M3 I would like
`speed01` near 1 (pulse) to soften and streak the far washes, and nothing from `altitude01`
that `inSpace01` does not already do.

### PHYSICS: P1 accepted by the coordinator; wiring done

- All of the wiring guide is in (commit after `a9c02bc`): `createPhysics`, `warmUp`,
  `physics.update` once a frame before `world.update`, `world.setPhysics`, the explorer through
  `stepExplorerBody` (with `assistAccel` 4, `jetMaxRise`, `descentLimit`), the ship through
  `stepShipBody` (`carve01: 1`, assists applied to the target), landing sites by friction, the
  parked ship on `stepShipGear`. Measured in my loop tests: `physics.update` averages 0.3 to
  0.5 ms; the gear settles and sleeps on Earth, the Moon and Jupiter.
- One assist I added that PHYSICS should know about and may want to model: in vacuum, X or
  throttling down brakes with the drive field (the kinematic rate) instead of the 14 m/s2
  retro thrusters, because stopping from 750 m/s took over a minute and "let go and it stops"
  is the promise of the ship (`R-SHIP-1`). A `brake` command in `stepShipBody` with a named
  field deceleration would let me drop my special case.
- A bug of mine, found by measuring and fixed: the body model moves `st.p` in place and my
  flight step then moved it again, so for a few commits the physical ship covered twice the
  ground its speed said (the climb to space read 10.9 s instead of 15 s). Fixed by keeping the
  starting point by value; the climb profile now matches the kinematic one within a second.
- GOOD: the lab page and twelve evidence shots exist now; the guide and the replacement
  tables were exactly what was asked for; the reference checks came back with measurements.

---

## Review 1: 2026-11-11, at commit `19f72ce`

What I ran:
- `node --test src/world/*.test.mjs` (12 pass), `node --test src/physics/` (72 pass),
  `node --test tests/*.test.mjs` (70 pass, including `tests/contract.test.mjs`, which checks
  Painter's real `sampleSurface` on every body and walks the real forest with collision).
- `gallery.html?body=earth&biome=temperate_forest&time=<h>&quality=1&cam=<preset>&ui=0&t=0` at
  640x360 from a clean export of HEAD: presets `trees`, `canopy`, `stream` at 12, 18.5 and 0 h.
- The integrated game (`index.html`, Painter's render, world and art as the default):
  `node tests/playthrough.mjs --query "scale=0.5&quality=0" --w 480 --h 270` against a clean
  export of `bb8ec30`: the whole loop passed with no console errors.
- A frame-cost probe in the integrated game (draw calls and triangles from `renderer.info`
  summed over the whole frame; `world.update` timed in the page).
- `createPhysics` driven for 600 frames at Painter's Earth spawn with one disturber.

### PAINTER

MUST FIX (M1: "Earth's temperate forest passes the freeze-frame test")

*(Withdrawn by the owner's instruction, 2026-11-11: no triangle budget; kept as a record.)*
1. **The forest is far over any frame budget: 4.36 million triangles and 887 draw calls per
   frame standing at the spawn** (quality 1, 480x270; 4.57 M while running; 1.47 M and 262
   calls flying at 120 m; 43 k and 41 calls in orbit). Evidence: frame-cost probe at `19f72ce`;
   software GL fell from about 6.7 fps (before flora, `d238c50`) to 0.7 fps at the same
   viewport. The brief's rule is 60 fps at 1080p on an integrated GPU, and a painting that
   needs four million alpha-tested triangles plus a multi-target pass and four full-screen
   passes will not get there (`R-PAINT-8`). Budget I am setting as the owner of performance:
   **at most 600 k triangles and 350 draw calls at quality 1 in the densest view, 300 k at
   quality 0, 1.2 M at quality 2**, measured with the same probe. The far tiers are the
   obvious place: a distant tree is a few strokes (AB 4: "far things are fewer, larger, softer
   strokes"), and that is also what the painting wants.
2. **Foliage is stippled, not brushed.** `docs/lead/evidence/painter-19f72ce-gallery-trees-noon.jpg`:
   the crowns are a field of pixel-sized dark specks, and `docs/shots/pilot/real-01-on-foot.jpg`
   shows it as salt-and-pepper over the whole tree line. A watercolourist lays a crown as three
   or four overlapping washes with a few dark accents; nothing in a real painting is that
   fine-grained. Fails AB 4 ("detail is simplified into brush-sized shapes") and the freeze-frame
   test: this is the first thing that says "3D render with a filter". The looking-up frame
   (`painter-19f72ce-gallery-canopy-noon.jpg`) proves the pipeline can do it: there the leaf
   masses are shapes. Bring the eye-level trees to that.
3. **Ruler-straight lines.** Same frame: every birch trunk is a straight, evenly lit, evenly
   white cylinder of the same thickness, and the left bank of the brook is one straight dark
   line across a third of the picture. Fails AB 4 ("silhouettes wobble slightly, never
   ruler-straight"). Trunks need lean, taper, broken edges and paper showing through (birch is
   mostly bare paper with a few dry-brush marks).

SHOULD FIX

4. **No depth inside the forest.** In the `trees` frame the pines at the back are as dark and
   as saturated as the trunks at the front. AB 5 wants each distance band lighter, cooler and
   lower in contrast; inside a wood that is what separates the layers.
5. **The foreground is one flat wash.** The clearing in the `trees` frame and under the
   explorer in `real-01-on-foot.jpg` is a single yellow-green with a few blobs. AB 3 ("no area
   is flat colour") and AB 4 (near things get a few crisp accents): grass-tip dry brush, a few
   blades against the light. It is also what makes walking read as moving (`R-FOOT-2`).
6. **Trees stand in rows.** Mid-distance trunks in the `trees` frame line up like a plantation.
   Cluster them (birch in groups, pines behind) and leave irregular gaps.
7. **Night is not yet a painting** (`painter-19f72ce-gallery-stream-night.jpg`): the trunks
   glow at full paper white while the ground is close to a flat near-black navy. `R-DAY-3`
   wants a readable ground and nothing near black; the trunks should take the indigo glaze
   like everything else. Dusk (`...-stream-dusk.jpg`) turns the sky grey-violet but leaves the
   grass at noon green: the whole palette should move to gold (`R-DAY-1`). Not M1 scope; listed
   now so it does not get built on.
8. **Space granulation reads as black pepper** (`docs/shots/pilot/real-02-orbit.jpg`): hard dark
   specks at pixel size over the indigo. AB 1: nothing is pure black; AB 8: salt textures and
   spattered stars. Soften and enlarge the grain in space, and the planet needs a rim that
   fades to paper (`R-SPACE-5`). M2/M3 scope.
9. **Build hitches.** `world.update` averaged 7.5 ms with a 34 ms peak while running at
   `d238c50` (budget: 5 ms), and 8.7 ms average flying at 120 m at `19f72ce`. On a 60 fps
   machine a 34 ms update is two dropped frames (`R-SPACE-1`). Keep each slice inside the
   budget you were given (`setBuildBudget`), flora included.
10. **`sampleSurface` cost** is 0.016 to 0.072 ms a call (Mercury slowest, Earth 0.052). I make
    about 12 calls a frame on foot, so it is fine today; keep it under 0.05 ms as detail grows.

GOOD (keep)

- The sheet: paper tone, ragged border fixed to the screen, pooling at silhouettes, wet sky
  with paper clouds. Open-country frames already look like a watercolour sketch.
- The canopy frame. Leaf masses as shapes with sky holes, branches as single strokes.
- The brook: reflections of the trunks as vertical broken strokes with paper glints (AB 9).
- The planet from orbit reads as a painted ball with distinct biome colours and no seams.
- The contract: `sampleSurface` is exact on all ten bodies (unit normals, slope, liquid,
  weights, determinism), spawns are dry and gentle, vistas exist, `world.busy` works as a
  readiness signal, foreign materials are painted without errors, `sampleObstacles` arrived
  the same hour it was asked for. Integration took one flag flip.
- Time of day comes from the real sun; my 09:30 spawn spin gives a clear morning as intended.

Contract note: the Moon's mountains reach 267 m and Pluto's 245 m. I raised `spaceAltitude` on
both to 420 m in `src/data/bodies.js` rather than ask you to lower them.

### PHYSICS

No milestone gate yet (wiring is M2). No MUST FIX.

SHOULD FIX

1. **Worst-case frame.** `physics.update` averages 0.4 ms (well inside 2 ms) but one frame in my
   600-frame run took 6.8 ms. Whatever that is (a re-anchor, a first allocation), spread it:
   the budget is per frame, not on average (`R-PART-6`).
2. **Say which of my numbers each of yours replaces.** `EXPLORER_BODY` and `SHIP_BODY` already
   mirror my tuning (jump 4.8 m/s, float depth 1.25 m, 17 m/s2 of jet thrust). Before I wire
   them in, the notes need the table promised in section F: your constant, my constant it
   replaces, and the assist you expect me to keep on top. Without it I will be guessing.
3. **No lab page and no evidence shots yet.** `physics-lab.html` does not exist and
   `docs/shots/physics/` is empty, so nothing about grass parting, footprints or particles can
   be seen by anyone but you. A plain canvas plot of the wind field, a gust front crossing it
   and a footprint trail is enough for review (`R-WIND-2`, `R-PART-2`, `R-DEF-1`).
4. **The giants' winds are scaled down by 10 to 25.** Reasonable (nobody could stand in 400
   m/s), but keep it in one named constant per body so that `R-FOOT-5` (wind never wins on
   foot) is my assist to tune, not something hidden in the data.

GOOD (keep)

- Real gas tables with sources, vacuum handled as vacuum (`R-PLANET-2`), fall speeds that match
  the references without tuning: rain 6.3 m/s and snow 1.0 m/s on Earth (`R-RAIN-1`,
  `R-SNOW-1`), drizzle-slow acid rain on Venus.
- The density profile was chosen so that constant thrust against drag reproduces my 46 to 160
  m/s envelope (`R-SHIP-3`): exactly the right way to replace a table with a model.
- Gusts that travel with the wind (frozen turbulence), which is `R-WIND-2` by construction.
- 72 tests, a documented API at the top of the notes, allocation-free queries with `out`.
- Gear as a 1.6 Hz spring at 0.65 damping: settles inside `R-SHIP-5`'s one second.

### PILOT (self-review; the other roles and the coordinator review this domain)

Known weaknesses I would flag if this were someone else's work:
- Trees: the explorer, the camera boom and landing-site choice now respect
  `world.sampleObstacles` (tested in Node against the real forest, not yet watched in the
  browser), but the flying ship still passes through crowns: its cushion follows the ground.
- The HUD is a plain paper fallback, not the painted theme, and its ink is only legible over
  space because of a halo (`R-HUD-4` is met in a makeshift way).
- Pointer lock has never been exercised: headless Chromium reports nonsense deltas under lock,
  so every scripted run uses drag-look (`pointerlock=0`).
- No audio, no save, no pulse drive, no map yet (later milestones).
