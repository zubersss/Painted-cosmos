# THE WATER: design of group E (everything wet on the ground, at every distance)

Branch `design-water` (= `look-proto` = live `main` at v37). Written 24 Nov 2026 by the water group's design session.
**This is a design. No game code was changed.** Every picture named here was taken in this session from this game and
opened; every number was measured or derived here, and the derivation is written next to it. What could not be settled
is in section 7.

The owner's words this answers (24 Nov): *"one session that focuses on water and how it works and move and behaves with
me and the world around it"*; earlier, *"how the water collects and drifts into ponds or into runways into the rivers
and oceans"*; and 23 Nov, *"the oceans and the water system to feel more alive and real it should constantly be moving
the way water would be naturally how it goes down hill and pools in areas it can't find go downhill any further or just
the natural lakes and ponds and oceans and the oceans and the bigger lakes should have waves and airration and fjords
and waterfalls"*.

---

## 0. In one page, in plain words

**What is good today.** The sea. Seen from a beach it is deep blue laid in level dashes and reads as sea at once
(still `w18-shore`). Underneath it, PHYSICS built a real sea: four wave trains, the fetch measured upwind, waves that bend
toward a shore and break on it, white caps by the wind's strength, swash up the beach. The river near the landing, seen
from its bank, is blue water in thin strokes that run along the current and move with it (`w03-bank-edge`). The water
knows which way is downhill since v34 (a drainage map of the whole world, solved once at load).

**What is wrong, in order of how much a player would notice it.**
1. **Rivers do not reach the sea and lakes hardly exist.** Earth's river stops about 250 m short of the sea behind a
   dead-flat shelf 26 m high that ends in a straight sheer wall (`w10`, `w11`). The drainage map knows where the lakes
   are (13 basins on Earth), but the wood's hills still stand everywhere except right beside a channel, so a "lake"
   shows only as flooded channels: in the biggest basin 148 of its 708 map points are water (`map-lake11`, `map-lake4`).
   Streams are drawn as closed rings round hills and end in blunt dead-end pools where a wood meets a marsh
   (`map-spawn-3km`). No waterfall exists anywhere; no fjord; no pond that is a pond.
2. **From the air the water is grey.** At 150 m and at a kilometre every river, pond and lake is a pale grey-lilac in
   big blocky strokes, and still water is painted as a spiral whorl, like a whirlpool (`w06`, `w09`, `w15`, `w16`).
   The owner's river references are deep blue in the middle, lighter at the edges, mirroring the sky.
3. **Water does not answer the weather.** Under a storm the river stays bright blue, brighter than the sky, with no
   rain on it at all (`w14-rain-bank`). There are no puddles after rain and rivers never rise.
4. **Falling water is a flat white band.** Where the water steps down (every 100 to 200 m along a stream) it is a milky
   sheet with a hard straight edge across the stream, on a gentle ramp: nothing falls (`w05-lip-near`).
5. **The banks are bare.** No wet margin on the bank, no foam line at a shore, no reeds (`w03`, `w04`). Grass stands
   in the middle of a shallow run (`w05`).
6. **Smaller paint faults.** The water's strokes jump to double size at fixed distances, so a hard circle shows round
   the eye from above and a line across the water from a bank (`w20`, `w05`); the wide river shows a patchwork of stroke
   directions like wood grain (`w09`).
7. **The player barely touches the water.** Wading and swimming work in the physics (buoyancy, drag, a swim stroke),
   and they make small ring waves, but those are worked out only at the corners of the water's triangles, so a wave a
   metre long is mostly lost. No splash going in, no rings from footsteps, no furrow when flying low over a lake.

**The plan, in one sentence each.**
- **Rivers from the drainage map itself** (`?rivers=tree`): the map already knows where all the rain on a world runs;
  the rivers are drawn along that flow, so every stream joins a bigger one, every river ends at a lake or the sea, and
  they widen downstream. The branching side streams the owner liked are kept, re-attached to the new rivers.
- **Real lakes and ponds** (`?lakes=1`): where the map fills a basin, the land in it is lowered to a lake bed, so the
  lake is open water up to a shoreline that follows the land; low hills become islands. Small ponds in flat glades.
  Puddles that come with rain and dry after it.
- **Waterfalls where rivers meet the cliffs, and fjords** (`?falls=1`, `?fjord=1`): a river's last stretch is cut
  through the coast's shelf and falls into the sea; where the coast is high a river may end at the head of a narrow
  sea inlet with falls off its walls.
- **The water's paint at every distance** (`?wpaint=2`): still water laid along the wind, not in spirals; deep blue
  in the middle and the real sky in it from the air; a sun path that carries to the horizon; rain rings and a grey
  storm sea; foam lines at shores; falling water as falling white strokes; no size jumps.
- **The player and the world** (`?wakes=2`, `?splash=1`): ring waves drawn per pixel near the eye, rings from each
  footstep, a splash going in, a V behind a swimmer, a furrow and spray when flying low, gusts that darken the water,
  lakes that get real waves in a wind, sounds of the river and the falls.

**What it costs on the phone** (derived in section 2, to be confirmed by new speed-test rows): today's water costs
about 0.9 ms when you stand at a river bank and about 3.7 ms when the sea fills three quarters of the picture; in the
landing view it costs nothing because there is no water in it. The whole plan adds at most about 0.6 ms at a bank,
1.2 ms at a sea shore, 1.5 ms close under a waterfall, and about 0.1 ms in the landing view. More lake area is
probably CHEAPER than the ground it covers (a water pixel costs about 0.43 of a ground pixel), if the phone keeps its
depth the way that lets hidden ground be skipped (section 7).

**The build is four lanes on separate files** (section 5): rivers and runoff; lakes, ponds, falls and fjords; the
water's paint; the player and the world. One small first step, done by the coordinator, adds the hooks into the three
shared files so the lanes never edit the same file.

---

## 1. What was looked at

**How.** The painter's gallery in the oil look with the drainage on
(`/gallery.html?body=earth&biome=autumn_woodland&cam=stream&time=15.4&look=oil&flow=1&ui=0`), driven by `tools/lab.mjs`
and a small camera helper added to the page through `eval` (appendix A). **On this machine the gallery loaded in about
30 s and a frame took 5 to 30 s**, far faster than the 4 to 10 minutes `CLAUDE.md` warns of, so many stations could be
taken. Maps were drawn in Node from the surface function itself (`surface.js sample`, oil look, drainage attached): they
are data drawn top-down, not frames of the renderer, and are labelled as maps.

**Stations** (coordinates in appendix B; all Earth, 15:24 in the afternoon, tier 1, 960 x 540):

| still | station | what it SHOWS (seen) |
| --- | --- | --- |
| `w01-bank` | E0 the landing (the gallery's stream view) | the brook only at the frame's right edge behind grass: little water in the landing view |
| `w03-bank-edge` | E1 the brook's bank, looking upstream | blue water in thin dashes along the current; a pale band across the stream far ahead (a lip); no wet bank margin; pebbles as flat dabs; no reeds |
| `w04-bank-other` | E1, looking downstream | the same; an earth cut bank meeting the water with no margin |
| `w05-lip-near` | E2 35 m below a lip | the lip: a milky white sheet with a hard straight edge across the stream on a gentle rise (the level climbs 1.8 m over 25 m, measured); yellow grass blades standing in the middle of the run; a faint straight line across the water |
| `w06-150m-spawn` | E3 150 m over the landing's junction | water pale grey-lilac in big blocky strokes; the junction POND painted as concentric rings, a whorl |
| `w08-1km-south-400m` | 400 m over the landing, looking at the main river 1.1 km south | the river a faint grey thread lost in the beige haze; the marsh a mottled grey-blue |
| `w09-lake4-150m` | E4 150 m over the widest water on Earth (a river widened through a filled basin) | grey-slate water with whorled, contour-like strokes and a patchwork of stroke directions with visible edges, like wood grain; no sky in it |
| `w15-lake4-1km` | E5 the same water from a kilometre, 350 m up | a grey-lilac band winding through the wood: legible by its shape, not its colour |
| `w10-cliff-from-sea` | E6 20 m over the sea facing the coast where the river is nearest | a straight sheer wall painted as vertical stripes, a ruled top edge; calm blue sea with no surf or foam at its foot |
| `w11-coast-150m` | E7 150 m over the wood's edge facing the sea | the river (foreground) ends; a bare flat shelf; a strip of sea; headlands beyond |
| `w12-wetland-ground` | E8 in the misty wetland | from the ground the marsh's pools are hardly seen |
| `w13-wetland-60m` | E8 from 60 m | pools of noise-shaped outline, grey slabs of parallel dashes, hard edges, no margin |
| `w14-rain-bank` | E1 under the forced rain sky (`&wx=rain`) | the sky a dark storm; the river exactly as bright and blue as in sun; nothing of rain on it |
| `w16-sea-1km` | E10 300 m up, the sea about a kilometre off | the marsh a field of grey pools; a pond a pale grey-white block; the sea a pale strip under the haze |
| `w18-shore` | E9 a beach | the sea: deep blue, level dashes, reads well (calm: the gallery runs no physics); a thin sand line at the headland's foot, no surf |
| `w20-octave-ring-from-above` | E12 straight down on the sea from 20 m, only water drawn | a hard circle round the point under the eye where the dashes halve in size |

**Maps** (Node, from the surface function): `map-spawn-3km` (5 m a pixel), `map-spawn-8km` (10 m), `map-lake11`,
`map-lake4`, and `map-flowtree-64` / `map-flowtree-128`: the river network the drainage map's own flow tree implies
(drawn where at least 8 / 16 map points drain through, width growing with the square root of that), over the basins the
map fills (light blue ovals). What they show:
- `map-spawn-3km`: the wood's streams as CLOSED RINGS round rises and side streams in loops; the main river (south)
  braided; channels ending in blunt dark pools at the edges of the two marsh bands; the marsh a speckle of puddles.
- `map-spawn-8km`: the landing's wood is a small piece between two marsh bands; the sea to the south-west and east;
  thin WHITE seams (water the paint would make white) along the marsh's edge against the coast.
- `map-flowtree-*`: the flow tree has the right SHAPE of a river system (it converges, every branch ends in a bigger one,
  a lake or the sea: 21 river mouths on Earth at 64 points a face edge, 62 at 128) but drawn node to node it is
  ZIGZAGS and PARALLEL COMBS on the even slopes. The topology is right; the geometry is not. Section 3.2 is built on
  exactly that finding.

**Measured in Node** (oil look, drainage attached, Earth):
- wet share of the ground: 12.0 % of a 3 km square round the landing, 19.5 % of an 8 km square (sea and marsh in it);
  of the wet points, 1.6 % and 2.1 % are painted white (falling water).
- the drainage build: 43 to 45 ms here at 64 points a face edge (98 m cells), 106 ms at 128 (49 m cells).
- lakes: 13 filled basins; the share of each basin's map points that is water in the full sample: 6 of 72, 38 of 219,
  13 of 209, 148 of 708, 44 of 170 (and 0 in the four alpine and canyon basins, which have no water group).
- the coast nearest the landing: the river's level 20.8 m, 244 to 267 m from the sea; the land between rises to a
  shelf at exactly 26.0 m for 120 m, then falls to the sea floor at -20.4 m within one 12 m sample step.
- a surface sample in the wood within 900 m of the landing: 1.89 us; 2.05 us with the drainage; of that,
  `_riversOil` with its field `_sfO` alone is **0.95 us**. (200,000 points, this machine.)

---

## 2. What the phone can afford: the cost derivation

The rule (standing): this machine draws in software and has been wrong about the phone three times; device costs are
derived from the phone's own table. The table used is speed test 9 at v37 (24 Nov, the log on `r2`): Adreno 740,
picture **936 x 372 = 348,192 pixels**, tier 1, lighter paint, as set about 89 ms; "no water" -0.6 ms; "no ground"
-4.8 ms.

**The water has never been measured on the phone.** I rebuilt the landing view in the gallery at 936 x 372 and hid
the water: **0.0 % of the pixels changed** (15 pixels). The speed test's own view is the explorer at the landing, so
its "no water -0.6 ms" (and v35's "-0.0 ms") is noise, not the water's cost. The water's cost must be derived another
way:

1. **The ground's cost a pixel on the phone.** Hiding the ground in the same landing view changed **42.5 %** of the
   pixels (148,000). The phone's "no ground" is 4.8 ms, so the ground costs at most **4.8 ms / 148,000 = 32 ns a
   visible pixel** (an upper bound: the 4.8 ms also holds the ground's vertex work, 380,000 triangles at this size).
2. **A water pixel against a ground pixel.** Measured here, each alone on a full frame, at full size and at a quarter of
   the pixels, so the fixed costs (vertices, passes) fall out: sea straight down, 2.506 s and 0.855 s, empty frame
   1.215 s and 0.445 s; ground straight down 4.684 s and 1.868 s. Per pixel: water (1.291 - 0.410) s / 261,144 =
   **3.37 us**, ground (3.469 - 1.423) s / 261,144 = **7.83 us**: **a water pixel is 0.43 of a ground pixel.**
   (A software renderer's cost is close to the shader's instruction count, which is what this ratio needs; a tile GPU's
   memory traffic is not in it.)
3. **So a water pixel costs about 0.43 x 32 = 14 ns on the phone** (range about 8 to 28 ns: the ground's share could be
   30 to 60 % in the speed test's real view, and the ratio 0.37 to 0.6).

What follows, at 936 x 372:

| view | water share (measured here) | water today on the phone (derived) |
| --- | --- | --- |
| the landing (speed-test view) | 0.0 % | 0 ms |
| a river bank, E1 | 18.4 % (64,000 px) | **0.9 ms** (0.5 to 1.8) |
| a lake or sea shore filling three quarters | ~75 % (261,000 px) | **3.7 ms** (2.2 to 7.3) |

**Water hides the ground under it.** The oil look draws the ground last, after the water (`terrain.js:147`), and the
water is opaque and writes depth. If the phone keeps its depth reversed (the speed test's header says which), the ground
under the water is never painted, and every pixel turned from ground into water saves about 32 - 14 = 18 ns. If depth
is logarithmic, nothing hidden is skipped and the water's cost simply adds. Not known (section 7).

**THE GROUP'S PHONE BUDGET** (what every lane is held to, each lane's share given in its section):
- landing view: at most **+0.3 ms** in all (it has no water; only a far fall or puddles in rain can add);
- river bank E1: at most **+0.6 ms** (today 0.9);
- lake or sea shore E9: at most **+1.2 ms** (today 3.7);
- close under a waterfall (the fall a quarter of the picture): at most **1.5 ms** for the sheet and its spray;
- script: at most **+0.3 ms a frame**; the surface sample in the wood no dearer than today (2.05 us);
- load: drainage and river network at most **150 ms here**, which at the phone's usual 2 to 3 times is at most
  about 400 ms, once a world;
- draw calls: at most **+6** in any view except a lake view (at most +10, with the remedy in 3.3);
- memory: at most **+2 MB**.
Every new piece of paint sits behind a UNIFORM branch, not a compile-time define, so the speed test can switch it off
without rebuilding the shaders while it times (the speed test's own rule: two rows were once timed while shaders were
being rebuilt).

---

## 3. The parts

### 3.1 Runoff, rain puddles and ponds

**Today and its gaps.**
- Rain falls in the physics and the sky (the weather's storm cells, `physics/weather.js cellsAt`), and the ground's
  wetness is the integral of past rain at a place (`moistureAt`, `wetness01`), reaching the paint as `uWx.y`. Raindrops
  splash on wet ground (`ground.js splashOn`, P21). **Nothing collects.** No puddle forms, no rill runs, no stream rises.
- The only ponds are the misty wetland's pools: a noise field cut at a level, grey slabs of parallel dashes (`w13`).
  In the wood, pools exist only as the widened parts of channels (`_riversOil` `pool`), and one of them is painted as a
  whorl (`w06`).
- The drainage map already holds the runoff network: each point knows which way it drains and how much land drains
  through it (`drainage.js` `acc`). Nothing draws it at the small scale.

**The change.**
- **Puddles** (`?puddles=1`). Where the fine relief of the ground has hollows (the 15 m and 3.4 m terms of `_forest`,
  `sm` and `mi`), water can stand to a level just under the hollow's rim. A new function `puddleCap(c)` in a new file
  `src/world/hydro.js` returns the hollow's capacity (metres, 0 where there is none, never more than 0.12 m, 0 on slopes
  over 3 % and in biomes that do not allow it, a look's `oil.puddles`). The mesher builds those cells into the patch's
  water mesh at the FULL level, on the two finest patch levels only (within about 60 m: from the air a puddle is
  invisible anyway). The water's vertex shader lowers them by `(1 - uWet) * cap` and the fragment discards where no
  water is left, so puddles come and go with the ground's wetness (`uWx.y`) without rebuilding a patch. A puddle is
  painted as still water (3.3): it mirrors the sky and the trees, dark at its edge.
- **Rills in heavy rain.** The twig lines (`_sf3`, the finest tributaries) carry water only while the ground is wet:
  their water is lowered under the bed by `(1 - uWet)` the same way, so in a downpour thin threads of running water appear
  down the slopes into the streams, and dry after it.
- **Streams rise after rain** (`?swell=1`). Each water vertex gets a "how much it swells" byte (the spare third byte of
  `aTurb`): grows with the catchment, `min(1, (acc / 400)^0.4)`. The vertex shader lifts the water by
  `uRise * swell`, `uRise` from the wetness integral over the last minutes (D's `moistureAt` at the focus, eased over
  three to five minutes): at most 0.4 m (the water mesh keeps cells to 0.45 m above the still level, so no rebuild).
  A swollen river is a little browner (`uMud`) and more aerated.
- **Ponds** (`?ponds=1`). Small still ponds in flat glades and meadows: a jittered grid of cells 120 m apart; a cell
  may hold one pond (chance from the biome's `oil.ponds` and the place's flatness and wetness); its outline a
  noise-bent ellipse 12 to 45 m across; its level the wood's base level `L` at the cell's centre minus 0.2 m (on the
  valley floor `L` changes by at most 0.6 m over 100 m, measured from `_bigL`'s amplitude and scale, so the level's
  error over a pond is under 0.25 m and is hidden by the 0.6 to 1.2 m carve); the bed carved by a bowl. `pondAt(x, y, z,
  L, out)` in `hydro.js`; a pond near a channel gets a short outflow to it. Reeds and lilies placed by B (3.7).
- **The marsh's pools** (misty wetland) keep their noise outline but are painted as still water (3.3) and get margins.

**The look and how it is judged.**
- Puddles: E1 and a glade near the landing, at ground height, after `&wx=rain` and with the ground wet: dark, sharp
  edged pools in the hollows mirroring the sky; dry after the wetness falls (two stills at two wetness values).
- Ponds: a still from 150 m over E3's area: round still ponds in the glades, each mirroring the sky, with reeds.
- Rills: E1 looking up the slope in the rain: threads of white-flecked water.
- Failure to watch for: puddles on slopes (they must not tilt), puddles in a field like a rash (cap the share of ground
  under puddles at 4 % of a glade, measured in Node before the browser).

**Phone cost.** Puddles: 2 to 5 % of the picture near the eye in rain, 7,000 to 17,000 pixels x 14 ns = **0.1 to
0.25 ms**, nothing when dry (the cells exist but are discarded at the first line; their triangles are few). Ponds:
water instead of ground (cheaper per pixel, section 2). Rills and swelling: vertex work only. Script: one uniform.

**Risk.** Puddle cells inflate the water meshes' triangle counts near the eye (bounded: finest two levels only, flat
ground only). A pond carved where a tree stands (the flora placer reads `o.lq` and skips water already, so trees move
off it by themselves). The time-dependent level must never write into the shared sample object conditionally (the v37
rule: a field on the shared sample is written every time or not at all).

**Switch.** `?puddles=1`, `?ponds=1`, `?swell=1` (all need `look=oil&flow=1`).

### 3.2 Rivers

**Today and its gaps.**
- The oil look's river system (`surface.js _riversOil`, 16 Nov) is drawn from the zero lines of noise fields: one wide
  river (11 to 22 m) with bars, islands and a third arm, side streams (`_sf2`) that end at it, twigs (`_sf3`) that end
  at those. It looks organic up close. But a zero line of a noise field on a sphere is a CLOSED LOOP: the main river and
  the side streams run round in rings (`map-spawn-3km`), no river can run downhill all the way (the log of 23 Nov), and
  none reaches the sea.
- v34 made the water level a staircase of dead-level reaches and 4 m lips from the drainage map, and took the current's
  sign from the land's fall. So within a reach the water is level and it never climbs following its own direction, but
  every 100 to 200 m there is a lip, painted as a white band (`w05`), which is a workaround for the closed loops, not a
  feature of a real lowland river.
- Channels end blunt where the wood meets the marsh (`map-spawn-3km`), and along the marsh's edge against the coast the
  drainage's fall makes white seams (`map-spawn-8km`).

**The change: rivers from the drainage map's own flow tree** (`?rivers=tree`).
1. **Keep the flow tree.** `drainage.js` keeps `to` (each point's downstream point) and `acc` as a float (it is a 16-bit
   count today and saturates at 65,535 on a finer grid). A small ROUTING roughness is added to the base field ONLY for
   the routing, not for the levels (a 300 to 600 m noise of +-2 to 3 m): on an even slope steepest descent makes
   parallel combs (seen in `map-flowtree-*`); roughness turns them into branches that join.
2. **Pick the rivers.** Points with at least `A1` points draining through (64 a face edge: about 30 = 0.29 km2 of land)
   carry a stream; `A2` (about 150) a river; the main stem whatever is largest. Each river is the chain of points from
   its source to its mouth, where the mouth is a lake, the sea or another river.
3. **Smooth and bend them.** Each chain becomes a smooth curve through the points' centres (Catmull-Rom), then bent by a
   meander whose wavelength is about eleven times the river's width and whose amplitude grows with it (the classic
   field ratio of meanders), and sampled every ~8 m into segments. Width from the catchment, about
   `w = 1.5 + 2.2 sqrt(acc / 10)` metres (the width-grows-as-the-root-of-the-flow rule of real rivers) with a cap from the
   look: a 30-point stream about 5 m, a 150-point river about 10 m, a 500-point stem about 17 m (today's river is 11 to
   22 m; the largest catchment on Earth, 2,944 points, would give 39 m, so the cap matters). The maps above were drawn
   with a wider rule, `2 + 3.2 sqrt(acc / 10)`, to make thin streams visible at 10 m a pixel; W1 tunes the real one in
   its own maps. Kept in a spatial index: each drainage cell lists the segments within reach.
4. **The water level runs downhill along the river.** Along each river the level is the filled map level, smoothed
   along the curve, and never rising downstream; inside a lake it is the lake's level. The staircase and its lips are
   no longer needed in tree mode: a river falls where the land falls, and falls steeply only where the land does (3.5).
5. **What a sample asks.** A new file `src/world/rivers.js`: `riverAt(net, x, y, z, out)` returns the SIGNED distance to
   the nearest river's centre line (m), its half width, its level, its flow direction (a unit vector in the body's
   frame), its catchment, and which river it is. `_forest` reads that in place of `_riversOil`'s main line, so the bank,
   the bed, the trees and the colours follow exactly as now (they all read `c.s`).
6. **Keep what the owner liked.** The bars, the second arm round an island, the third arm and the pools are laid along
   the new centre line by the same code (`_riversOil`'s `lay` takes a signed distance; it does not care where it came
   from). The side streams (`_sf2`) and twigs (`_sf3`) are kept as they are and re-attached: they take their level on
   either side of a river from the new signed distance's sign (the trick `_riversOil` already uses), so each still ENDS
   at a river and runs toward it, and they now join rivers that go somewhere.
7. **The landing keeps its brook.** `oil.riverAt` today moves the noise field so the river passes the first landing. In
   tree mode a look gives `oil.springs: [[x, y, z, acc]]`: extra catchment added at a point before the flow is summed,
   so a stream is born there and runs past the landing to wherever the land sends it.

**The look and how it is judged.** First in Node, as maps, before any browser (the project's habit since 16 Nov):
the network over 8 km round the landing at 10 m a pixel must show (a) no ring, (b) every stream ending in a river, a
lake or the sea, (c) widths growing downstream, (d) no comb of parallel channels, (e) the river reaching the sea at
the coast of E6/E7. Then stills: E3 and E4 from 150 m (one wide winding river, tributaries forking like a tree, bars
and islands, against the owner's two sheets of rivers from the air); E5 and the 400 m view of `w08` from a kilometre
(the river plain and blue, 3.4); E1 from the bank (unchanged in kind: strokes along a current).

**Phone cost.** None in the picture (the same water mesh; it is where the water lies that changes). Script: the river
part of a sample must cost **at most 0.8 us** against today's 0.95 us (the segment index makes it a few distance tests,
in place of nine warped noise fields and their gradients); measured in Node on the same 200,000 points before a
browser. Load: the flow tree and the network at most 150 ms here (the map alone is 45 ms at 64 points a face edge);
memory about 0.3 MB at 64, about 1 MB at 96.

**Risk.** The largest of the plan: it moves where every river on Earth is, so the landing, the vistas, the first view
and the play-tests' routes change (they are behind the switch until judged). The drainage map is solved on the smooth
base field; the wood's hills are built round the channels (`rise` in `_forest`), so a river from the map gets its valley
by construction. A river crossing a biome edge into a world part with no water group (alpine, canyon) must stop at a
lake, the sea or a sink there; with the routing roughness a grid this coarse may still draw an odd straight reach (the
maps will show it). Load time on the phone is derived, not measured.

**Switch.** `?rivers=tree` (with `flow=1`); without it `_riversOil` is exactly today's.

### 3.3 Lakes

**Today and its gaps.** The map fills 13 basins on Earth to their sills (v34): level water, exactly level. But the
ground's hills (`hill * 24 + mid * 4.5`, times `rise`) stand everywhere more than 95 m from a channel, so only the
channels inside a basin flood (the measured shares above; `map-lake11` shows the nearest "lake" as a few channel
fragments). No beach, no shoreline that follows the land, no open water to have waves. The wood's fetch is capped at
14 m (`physics/water.js FETCH.autumn_woodland`), so even a big lake would only ripple.

**The change** (`?lakes=1`).
- **Lake beds.** In `_forest`, inside a filled basin the hills are drowned: `rise` is multiplied by
  `1 - lakeK * smoothstep(lakeMin, 2 lakeMin, fill)` (`lakeK` from the look, 0.6 to 0.9), so the low hills sink under
  the sill level and the tall ones stand as islands. The shoreline is then wherever the land rises through the sill:
  smooth, following the base field's contour, never a hand-drawn shape. One function, `lakeCarve(c, dr)` in
  `hydro.js`, called from one line in `_forest`.
- **Shores.** A narrow shelving beach of sand or pebbles where the slope at the waterline is gentle, a cut bank where
  it is steep (a new sample field `o.bank`, written every time); reeds in still shallows (B).
- **The river through the lake.** In tree mode a river enters a lake and leaves it at the sill; a short reach of
  current shows at the inflow and the outflow (the flow tree's direction there), the rest of the lake is still.
- **Waves.** The fetch caps for the wood and the forest rise to the size of their biggest lake (`FETCH`, 2,000 m), so
  the sea map (`seamap.js`) measures the real fetch over a lake: at 10 m/s over 1.5 km the formula already in
  `windSea` gives about 0.2 m of chop (0.0016 x sqrt(9.81 x 1500 / 100) x 100 / 9.81), white caps above about 10 m/s
  by the same law as the sea's. That is the owner's "bigger lakes should have waves".
- **Still water in the paint** (3.4): the strokes lie along the wind, the sky and the trees mirrored, deeper blue in the
  middle.

**The look and how it is judged.** The nearest basin (lake 11, about 785 m from the landing) and the largest near it
(lake 4, E4) from 150 m and from a kilometre: open water to a shoreline, islands where hills stood, a beach on the
gentle side, mirrored sky and cloud shapes ("lakes that mirror the sky", the owner's aerial references); at a shore at
ground height with `&physics=1` and a wind: a chop with a few white caps.

**Phone cost.** Lake pixels replace ground pixels: 14 ns against 32 ns, so a lake view is CHEAPER than the wood it
replaces if depth is reversed, and costs its water pixels (up to the 3.7 ms of a shore view, which the budget already
counts) if not. **Draw calls**: today every terrain patch with water has its own water mesh (41 of 232 calls in the wood,
the note at `terrain.js:20`); a lake spanning ten patches adds about ten calls. Remedy if the phone's row says calls
cost: draw all of a frame's water meshes in one multi-draw (`WEBGL_multi_draw`, which three.js r187 supports through
`BatchedMesh`, which uses it where the device has it).

**Risk.** Drowning hills moves trees and vistas that stood on them (behind the switch). A lake must not reach the
landing pad (the pads already level the ground; the landing site must be checked to stand above every sill). A basin
on a biome seam takes its level from the blended map (the v34 note: on a seam the grid reads metres too high); the carve
must use the caller's own base, as `poolLevel` already does.

**Switch.** `?lakes=1` (with `flow=1`; best with `rivers=tree`).

### 3.4 The sea (and the water's paint at every distance)

**Today and its gaps.** PHYSICS' sea is excellent and is kept: wave trains, the measured fetch, refraction and
shoaling, white caps by the wind, a surf zone and swash (`physics/water.js`, `seamap.js`). Seen from a beach it reads as
sea (`w18`). Gaps, all in the paint:
- **From the air every water is pale grey.** In `WATER_FRAG`'s oil branch the water's body is half its own wash laid
  heavy, the rest the sky mixed with 30 % white, lit and then hazed by the air (`pcAtmosV`); seen from above, the
  reflected ray points at a pale golden zenith and the result is a grey-lilac (`w06`, `w09`, `w15`, `w16`).
- **Still water as whorls and wood grain.** Where the water has a current, its dashes follow it, in cells 26 m across
  each turned on its own; inside a widened pool the "current" is the tangent of the noise field's own closed contours,
  so the dashes run in rings (`w06`), and in the wide river the cells' turns and edges make a patchwork (`w09`).
- **The size jump.** `pcStrokeOct` returns the stroke's width AND how far it is toward the next octave; the water passes
  only the width to `pcThinLayer`, so at fixed distances every dash doubles at once: a circle round the eye seen from
  above (`w20`), a straight line across a river seen from a bank (very likely the faint line in `w05`).
- **Weather.** The storm glaze is laid BEFORE the oil branch, which then lays half the water's own blue over it
  "whatever the sky gives", so a storm river stays bright (`w14`). Rain only lowers the mirror.
- **No foam line at a shore, no surf at the foot of a cliff** (`w10`, `w18` calm), no lingering foam after a cap at
  low winds.
- **From a kilometre the sun's path is gone** (the sun mark's exponent is 56 and has no far form) and the haze takes the
  water to the colour of the sky's haze.

**The change** (all in the water's own paint, `?wpaint=2`; v37's paint stays under `?wpaint=0`).
- **A body by depth and the real sky.** The water's own colour deepens with depth (the mesh already carries `aDepth`):
  deep blue in the middle of wide water, lighter blue over shallows and in narrow arms (the owner's aerial river sheets,
  and the measured water family of the twenty oils, `#66728e`, value 0.56). The reflected sky is the sky's own colour in
  the reflected direction (`uSkyZenith` / `uSkyHorizon` as they are, NOT mixed toward white), and still water carries
  the clouds' shapes (a cheap reflected-ray lookup of the cloud layer's coverage, with F).
- **Still water laid still.** A new per-vertex flag, `still` (from the sample: 1 in a lake, a pond, a puddle, the sea;
  0 in a channel; in a widened pool by how wide), packed by the mesher into a free byte. Where `still` is high the dashes
  lie along the WIND's direction (`pcPhysSeaDir`, which already exists for the sea), long and level, never along a
  field's contour; where it is low they follow the current. The 26 m cells keep their own pace but a dash belongs to
  ONE cell, judged at its centre, so no edge is drawn between cells (the same idea as the ground's dabs, which come and
  go whole).
- **No size jump.** The strokes cross an octave the way the ground's dabs do: inside the band where two octaves share,
  each stroke of the finer octave survives by its own number against the blend (`pcStrokeOct4`'s `y`), else the coarser
  layer shows. Two `pcThinLayer` calls only inside that band.
- **Weather.** The oil branch's own blue is scaled by the light: under a storm (`uWx.x`) the water takes the sky's grey
  and goes darker than the land (as the watercolour already does); **rain rings** (3.7) and a grey stipple of drops;
  the mirror and the sun's marks fade with the rain.
- **Shores and cliffs.** A FOAM LINE: broken white strokes one to four metres out from the waterline, lying along the
  shore and carried in and out with the swash (PHYSICS' run-up), even on a calm sea (the Rime reference). At the FOOT OF
  A CLIFF (the ground's slope at the waterline over 1, a new per-vertex byte from the mesher): white lace up the wall
  with each wave and a band of milky aerated water below it. After a cap breaks, its foam lingers as streaks along the
  wind for several seconds (an extension of the streaks PHYSICS' P26 already paints above 15 % white, to lower winds).
- **The far water** (with C, section 5.6): a sun path of broken gold marks sized to the distance that carries to the
  horizon (Sea of Thieves and Breath of the Wild references); the haze over water keeps more of the water's own value
  (with F: water is a glossy surface and reads darker than the land's haze at a distance in every one of the owner's
  aerial references). A GLSL function `pcWaterFar(...)` in a new chunk file, so C's far ground paints thin far rivers
  exactly as the water mesh paints wide ones.

**The look and how it is judged.** E3 and E4 (no whorl, no patchwork: still water in long level dashes, deep blue with
sky; rivers with dashes along the current); E5, E10 and the 400 m view (water reads blue and shining from a kilometre,
plain against the wood); E12 (no circle); E1 and E2 (no line across the water); E11 rain (the river grey, darker than
the land, ringed); E6 with `&physics=1` and a wind (surf and lace at the wall's foot); E9 (foam line). F reviews each
pair against v37's paint (`?wpaint=0`) before a merge.

**Phone cost**, from 14 ns a water pixel and what each piece adds to the water's fragment (counted against today's,
which is roughly 25 texture reads and 300 arithmetic steps; each estimate to be measured here by the quarter-size method
of section 2 and on the phone by the rows of section 6):
- depth body and real sky: about 0;
- still water: replaces the current's branch: about 0;
- the octave band (a second stroke layer in about half the pixels): +10 % on average: bank +0.09 ms, shore +0.37 ms;
- rain rings (3 grids of a hash and a circle each, no texture): +10 % while it rains: bank +0.09, shore +0.37;
- foam line and cliff lace: only in the shallow band (about 5 % of the water): under 0.05 ms;
- far sun path: only past 150 m: under 0.1 ms;
- per-pixel wakes (3.6): about +40 % in the near 30 m and only while a wake lives: bank about +0.14 ms.
**Totals: bank about +0.4 ms (budget 0.6); shore about +0.9 ms (budget 1.2).**

**Risk.** The water's shader is long; adding to it risks the varyings limit (the oil look already packs extras into
spare parts) and compile time on the phone. Every addition goes behind a uniform branch, and v37's paint stays
selectable. The far colour must be agreed with C and F or two lanes will fight over the same pixels.

**Switch.** `?wpaint=2` (v37 is `?wpaint=0`; the default stays 0 until judged).

### 3.5 Waterfalls and fjords

**Today and its gaps.** No waterfall exists. The lane started for them (branch `falls`) was stopped with nothing
written. v37 paints falling water white wherever the drainage map's level drops (`o.turb`, 7.2 % of wet points),
which today means the 4 m lips of the staircase on gentle ramps (`w05`). The big fall on Earth would be at the coast:
the river at 20.8 m, a 26 m shelf, a sheer wall to the sea (`w10`); the river never gets there. No fjord exists.

**The change.**
- **The river's mouth cut** (`?falls=1`): where a river (tree mode: the flow tree's mouths; without it, a search for wood
  water within 300 m of the sea, as was done in Node for this design) meets a cliff coast, a channel of the river's width
  is cut through the shelf from the river to the cliff's lip, its bed falling gently to a hard rock LIP at the cliff
  edge. `mouthCut(x, y, z, hh, mouths)` in `hydro.js`, called from the coast recipe (`surface.js _generic`, `coast`,
  one line). THIS IS THE ONE PLACE THE WATER LANE CHANGES THE COAST'S GROUND, and it must be agreed with C (5.7).
- **The fall** (a new file `src/world/falls.js` and its material `src/render/fallmat.js`): a list of falls per world
  (from the network: wherever the river's level drops more than 3 m within 8 m), each a curved RIBBON from the lip to the
  plunge pool, its width the river's, bowed out by the water's speed at the lip (a jet leaves a lip at the river's speed
  and falls in a parabola: at 2 m/s it clears a 21 m drop by about 4 m). Painted in falling strokes: long thin streaks
  that slide DOWN fast (the fall speed after a drop d is sqrt(2 g d): about 20 m/s at the foot of a 21 m fall), white
  and milk with the cliff showing through thin parts at the edges, broken into strands; never a flat white sheet and
  never a blur. A plunge pool: the water at the foot laid as churned milk and lace (the aeration paint v37 built), with a
  ring of white flecks (spray) thrown out and falling back: a few hundred camera-facing dabs, crisp, each a stroke.
  Meshes made only within 1.5 km, with fewer segments far off; one draw call for all sheets and one for all spray.
- **Steps on a river where the land steps.** In tree mode the staircase goes; a river crossing a steep bank (a terrace,
  the edge of the coast's ramp, the foot of the alpine range) gets a short cascade: two to four small falls of 1 to 3 m
  with pools between, from the same list.
- **Mountain streams (later stage).** The alpine meadow has no water group today; streams of snowmelt down the flanks
  with falls over the crags need the drainage solved on the real ground there, not on the wood's base field: a later
  stage, not in the first build.
- **Fjords** (`?fjord=1`): where a big river's mouth meets a high cliff coast, the river's last 300 to 600 m is drowned
  into a narrow sea inlet 40 to 90 m wide: the sea floor pressed down along the river's own curve (the coast recipe's
  `_open` already presses a sea floor along a line; a fjord does it along a curve), the walls the coast's own cliff
  profile, and the river falling into the fjord's head; smaller streams off the walls fall straight into it.
  `fjordCut(...)` in `hydro.js`, a look's `oil.fjords: { every, len: [300, 600], width: [40, 90], depth }` choosing which
  mouths. The owner asked for fjords by name; on a world 4 km in radius a fjord is necessarily small (a few hundred
  metres), and that should be said to them plainly.

**The look and how it is judged.** At E6 from the sea and from a boat's height close in: the fall leaving the lip in a
curve, strands of white, the cliff through its thin edges, the plunge pool churning, spray flecks; from E7 at 150 m: the
river running through its cut in the shelf to the lip; from a kilometre (E10 direction): a white thread down the cliff,
legible. A fjord from its mouth at sea level and from 300 m. Each against the clip's rule: crisp strokes, no blur.

**Phone cost.** A 21 m fall seen from 60 m covers about 135 x 124 = 16,700 pixels (4.8 % of 936 x 372: 20 degrees of
a 55-degree view by about 14 degrees across), at about one water pixel's cost each (its shader is the aeration path):
**0.23 ms**, spray about 0.05 ms. Close under it (a quarter of the picture, 87,000 pixels): **1.2 ms + 0.2 ms spray =
1.4 ms** (budget 1.5). Triangles: a few hundred. Draw calls: +2. Script: the list is made once at load; the meshes'
level of detail every few frames.

**Risk.** The cut changes the coast's ground, which is C's ground; the first falls lane was stopped before it wrote
anything, so nothing of it can be reused. Spray must stay strokes: if it reads as a blur the owner will hate it (no blur
is the rule they care about most). Without tree rivers, falls can be placed only by the fallback search.

**Switch.** `?falls=1`, `?fjord=1`.

### 3.6 The player

**Today and its gaps** (`physics/explorer.js`, `physics/index.js`, `physics/water.js`, the paint):
- Wading, floating and swimming work: buoyancy and drag, the feet leaving the bottom, a swim stroke for the figure
  (`B.swim`, `stroke`, `strokeRate`). A footstep in water makes the water sound (`audio.js` footstep `'water'`).
- A body moving in the water and a jet over it leave RING WAVES: up to 16 sources (`WATER.wakes`), the explorer's bow
  wave at most 6 cm. The paint works the wakes out in the VERTEX shader (`vWake = pcPhysWake(...)`), so a wave a metre
  long between vertices that may be a metre or more apart is mostly lost. The explorer flying (no jet now: it flies by
  itself) makes no wake at all: only `hgt < 0.2` counts.
- No splash going in, no rings from footsteps, no V behind a swimmer beyond the bow rings, no spray from flying low,
  no sign the figure was wet. The wind powers' "move water" parts a channel (`uPwChanA/B`); the gust, the gather and the
  tornado do nothing visible to water.

**The change.**
- **Wakes per pixel near the eye** (W3 paint, W4 physics, `?wakes=2`): the wake sum moves to the fragment shader within
  30 m of the eye and only while at least one source lives (a uniform count; zero sources skips the loop). Sources go
  from 16 to 32 with a kind: a BOW ring (as now), a FOOTSTEP ring (short, 0.3 to 0.5 m long, 1 to 2 cm, one each time a
  foot comes down in water deeper than 3 cm: the gait already reports each footfall), a STROKE pulse (each arm stroke
  of a swimmer: rings along the path add up to a V), a PRESSURE furrow (flying within 8 m over water faster than 8 m/s:
  sources dropped behind at a spacing set by speed, amplitude growing as the height falls).
- **Splashes** (a new file `src/physics/splash.js`, `?splash=1`): events with a place, a size and a direction:
  entering water from a run or a fall (droplets in a crown, more with the square of the speed), each footstep in water
  (a small crown of flecks), the low flight's spray trail, rain drops on water near the eye (3.7). They are handed to
  the particle system already in the game (`physics/particles.js`) through one emitter call, and painted as crisp
  white strokes.
- **The figure wet.** After swimming, a `wet01` in the figure's state that falls off over a minute or two: the cloak
  heavier and darker (its paint is not the water's: 5.6).
- **The powers.** A GUST over water raises a dark ruffled patch that races across it (a cat's paw) and spray off the
  crests; the TORNADO's foot on water a ring of spray and a whirl in the strokes. The paint reads the near wind field
  (the physics' wind grid near the eye) and darkens and ruffles where the local wind runs above the region's.
- **Sound** (PILOT's audio): a river murmur by the water's speed and nearness, a roar for a fall by its distance and
  drop, the patter of rain on water, a splash going in. W4 hands over `here.water = { near, speed, fallD, fallDrop,
  rainOn, submerged }`.

**The look and how it is judged.** The gallery has no player, so these are judged in the GAME at E1 and E9 with a
scripted walk into the water, a swim and a low flight (the play-test harness, `tests/playthrough.mjs` style): stills
at the moment of entry (the splash), mid-swim from above (the V), and a low pass over E9's water (furrow and spray);
sounds by the audio debug values (`audio.js debug()`).

**Phone cost.** Per-pixel wakes: about +40 % of a water pixel in the near band, only while a wake lives: at a bank
about +0.14 ms (counted in 3.4's total). Splash particles: at most 300 live, one draw call, under 0.1 ms. Script:
32 sources (a 512-byte uniform), events, the furrow: under 0.05 ms.

**Risk.** The wake loop per pixel is the dearest single piece; it must skip when idle and stay within 30 m. The play
harness drives the old explorer in places (the log): the tests for this must use the wanderer.

**Switch.** `?wakes=2` (`1` is today's vertex wakes), `?splash=1`.

### 3.7 The world around the water: wind, rain, banks and plants

**Wind on water.** The sea map raises wind waves over each water point's own fetch; with the fetch caps raised (3.3)
lakes get them. Rivers keep their current with a little wind texture. Gusts: 3.6.

**Rain on water** (W3 and D): rings, each a thin crisp circle stroke, broken, growing and fading in a third of a second,
drawn from three grids of hashed cells in the water's own chart (no texture); their number from the rain rate AT THAT
POINT, so the edge of a shower can be seen crossing a lake. Near the eye, splash crowns as flecks (3.6). The water greys
and darkens under the storm (3.4). D hands the rain field as described in 5.6.

**The banks.**
- A WET MARGIN: the ground within about 0.3 m above the water's level darker and more saturated, its strokes laid along
  the shore; after rain the margin widens. This is the ground's paint (`TERRAIN_FRAG`), not the water's: the water lane
  supplies the height above the water at each ground vertex, C (or whoever owns the ground's near paint) paints it (5.6).
- PLANTS (B places them where the water lane says the water is): reeds and rushes in clumps in still shallows 0 to 0.5 m
  deep (`o.still` over 0.5), rushes and sedges on flowing banks up to 1.5 m above the water, water lilies on still water
  0.6 to 2 m deep in ponds and lake bays, no near-ground grass blades where the water is over 0.15 m deep (the blades in
  `w05`), pale stones along brooks with white water over them (the owner's aerial references), bank boulders as today.
  B already reads `o.lq`, `o.h` and `o.s` (`floraplace.js:46`, `:121`, `:159`); the new fields are `o.still` and
  `o.bank`.
- Trees overhang the banks as now; their reflections come from the last frame (`post.js _finishOil`), which a still does
  not have.

---

## 4. Summary of the faults found, with their cure and lane

| # | fault (where seen or measured) | cure | lane |
| --- | --- | --- | --- |
| 1 | rivers in closed rings, never reach the sea (`map-spawn-3km`, the log) | rivers from the flow tree | W1 |
| 2 | lakes only as flooded channels (148 of 708 points, `map-lake11`) | lake beds carved in filled basins | W2 |
| 3 | river stops 250 m short of the sea behind a 26 m shelf and a sheer wall (`w10`, `w11`) | the mouth cut and the fall; fjords | W2 (+C) |
| 4 | water grey from the air (`w06`, `w09`, `w15`, `w16`) | depth body, real sky, far shine, haze kept off water | W3 (+C, F) |
| 5 | still water as whorls, wide water as wood grain (`w06`, `w09`) | the `still` flag; strokes along the wind; one cell a stroke | W3 |
| 6 | strokes double at fixed distances (`w20`, `w05`) | octave crossed stroke by stroke | W3 |
| 7 | storm leaves the river bright; no rain on water (`w14`) | storm grey; rain rings from D's field | W3 (+D) |
| 8 | falling water a flat white band with a hard edge (`w05`) | falls as falling strokes; staircase gone in tree mode | W2, W3 |
| 9 | no wet margin, no foam line, no reeds (`w03`, `w04`, `w18`) | margin (C paints), foam line (W3), plants (B) | W3, C, B |
| 10 | grass blades standing in the stream (`w05`) | no near blades under 0.15 m of water | B |
| 11 | wakes lost between vertices; no splash; no flight furrow | per-pixel wakes, kinds, splash events | W4, W3 |
| 12 | white seams along the marsh's edge against the coast (`map-spawn-8km`) | in tree mode the staircase and its lips go; the marsh-coast edge checked in the maps | W1 |
| 13 | lakes would only ripple (fetch cap 14 m) | fetch caps raised | W4 |

---

## 5. Build lanes on disjoint files

Four lanes, each on files no other lane edits, plus one small first step done by the coordinator. Each lane builds in
its own working copy or helper session, keeps the three test suites passing, and adds Node tests beside its files.

### 5.0 Lane 0: the hooks (the coordinator, first; about half a day; needs C's and F's agreement)

So that no two lanes edit the same file, the coordinator lands ONE commit that adds the calls into the new files,
every one behind its switch and doing nothing while the new files are stubs:
- `src/data/mode.js`: `MODE.water = { rivers, lakes, ponds, puddles, swell, falls, fjord, wpaint, wakes, splash }`, read
  from the address in `main.js` and `gallery.js` before anything is made (the `MODE.beasts` lesson of v34: a flag set
  after the static imports reads 0 at module scope; read it at use).
- `src/world/surface.js` (shared): (a) in `_base`, `if (MODE.water.rivers && this.rivers) { c.s = riverSample(this,
  c); return; }` before the `_riversOil` line; (b) in `_forest`, one call `hydroForest(this, c, b)` after `b.h` is made
  (lakes, ponds, puddle capacity); (c) in the coast branch of `_generic`, one call `hh = hydroCoast(this, x, y, z, hh)`
  after `_open` (the mouth cut and the fjord); (d) in `sample`, the new fields `o.still`, `o.bank`, `o.cap`, `o.swell`
  WRITTEN EVERY TIME (the v37 rule).
- `src/world/index.js` (F's light lives here; this is not light): one line to make and update the falls layer, and the
  water's per-frame uniforms (`uWet`, `uRise`, rain cells) through one call into a new `src/world/waterframe.js`.
- `src/world/patchgen.js`, the water section (section 4 of that function, today's lines 207 to 291), is the water's and
  goes to W3 whole; the rest of `patchgen.js` stays with C. Lane 0 only marks the boundary with a comment.
- `src/core/bench.js` (PILOT): the water views and rows of section 6.

### 5.1 Lane W1: RUNOFF AND RIVERS (the network)

**Files (only these):** `src/world/drainage.js`, new `src/world/rivers.js`, new `src/world/rivers.test.mjs`,
`src/world/drainage.test.mjs`, and the look data for rivers in `src/data/looks/earth.js` (`oil.springs`, the
thresholds; Earth's look file is shared data: these keys only).
**Builds:** the flow tree kept (`to`, float `acc`), routing roughness, river extraction, smoothing, meanders, widths,
levels down the river, the segment index, `riverAt`, the mouths list, the lakes list (each basin's level, sill point and
outflow), the swell factor; the side streams and twigs re-attached.
**First deliverable is maps, not a browser:** the network over 8 km round the landing (section 3.2's five checks),
the sample cost on the 200,000 points (at most 0.8 us for the river part), the load time.
**Exports to the others:** `net.mouths` (W2), `net.lakes` (W2), the `still` and `swell` values and the flow direction
through the sample (W3 via the mesher), `net.springs` (data).

### 5.2 Lane W2: LAKES, PONDS, PUDDLES, FALLS AND FJORDS (the bodies of water)

**Files (only these):** new `src/world/hydro.js` (`lakeCarve`, `pondAt`, `puddleCap`, `mouthCut`, `fjordCut`,
`hydroForest`, `hydroCoast`), new `src/world/falls.js` (the list and the layer: meshes, detail, update), new
`src/render/fallmat.js` (the falling sheet's and the spray's materials, registered like every painted material),
new `src/world/hydro.test.mjs`, the look keys `oil.lakeK`, `oil.ponds`, `oil.puddles`, `oil.fjords` in the looks.
**Depends on W1** for mouths and lakes in tree mode; until then it uses the fallback search for mouths and the drainage
map's own fill for lakes, so it can start at once.
**First deliverables:** Node maps of the lake beds and ponds over 8 km (the shoreline follows the land; islands; no
pond on a slope; the landing above every sill); the mouth cut's profile at the coast of E6 (the river's bed reaching the
lip, the drop measured); then stills at E4, E6, E7.

### 5.3 Lane W3: THE WATER'S PAINT (the look at every distance)

**Files (only these):** in `src/render/materials.js` ONLY `WATER_VERT`, `WATER_FRAG` and `makeWaterMaterial` (today's
lines 1006 to 1505), new `src/render/waterchunk.js` (the GLSL the water, the falls' material and C's far ground share:
`pcWaterFar`, `pcRainRings`, `pcWaterStill`, the body-by-depth), the water section of `src/world/patchgen.js` (new
packed bytes: `still`, `swell`, `cap`, the wall-foot flag, the far coverage hand-over to C).
**Builds:** everything in 3.4, the rain rings, the per-pixel wakes' drawing, the puddles' and rills' come-and-go by
`uWet`, the swell lift, the falls' lace on the plunge pool (shared with W2's material through `waterchunk.js`).
**First deliverables:** the still-water fix and the octave fix (the two plainest faults), A and B against `?wpaint=0` at
E3, E4, E12; then colour and far shine at E5 and E10 with C and F; then rain at E11.

### 5.4 Lane W4: THE PLAYER AND THE WORLD (interaction)

**Files (only these):** `src/physics/water.js` (wake sources 16 to 32 with kinds; the fetch caps; rain-on-water state),
`src/physics/seamap.js` (only if the lakes' fetch needs the outer level's reach changed), new `src/physics/splash.js`,
`src/physics/water.test.mjs`, new `src/physics/splash.test.mjs`.
**Builds:** the sources and their kinds, the footstep, stroke and furrow sources, the splash events, `wet01`,
`here.water` for the audio, the cat's paw and the tornado's spray events.
**Touches other owners' files at single points** (5.7): `physics/index.js` (the wake block), `physics/particles.js`
(one emitter), `audio.js`, the figure's paint, the powers.

### 5.5 Connections between the lanes (exact)

- **W1 to W2:** `net.mouths = [{ end: [x, y, z], lip: [x, y, z], width, levelTop, levelSea, dir: [x, y, z] }]` and
  `net.lakes = [{ level, sill: [x, y, z], out: [x, y, z], nodes }]`, built with the drainage at load.
- **W1 and W2 to W3, through the sample:** `o.still` (0..1), `o.bank` (0 shelving .. 1 cut), `o.cap` (puddle
  capacity, m), `o.swell` (0..1), and the current (`o.fu`, `o.fv`, as now) and speed (`o.fspd`, as now). The mesher
  (W3's section of `patchgen.js`) packs them; `aTurb.z` swell, `aTurb.w` still, a new `aWater2` (cap, wall foot) if
  the attribute budget allows, else packed in `aLiqP` (its `x` is lava's glow, which water never uses: a liquid kind
  test chooses).
- **W4 to W3:** `uPhysWake[32]` as `vec4(east, north, age, amp)` with the KIND in the sign and range of `amp` (negative
  for a footstep ring, amp over 1 for a pressure source carrying its speed); `uPhysWakeN` the live count (0 skips).
- **W2 to W3:** `fallmat.js` includes `waterchunk.js` for the plunge pool's lace and the spray's colour.

### 5.6 Connections to the other groups

- **C, the far view.** (1) The water's look at every distance is the water's. Far rivers too thin for the water mesh
  (today: `patchgen` keeps a coarse patch's water only if it is level 5 or more or over 8 % of the patch, line 290) are
  drawn in C's far ground colour; C's far paint calls `pcWaterFar(vec3 own, vec3 skyRefl, float shine, float frac)`
  from `waterchunk.js` with `frac` the share of that ground sample under water, which the mesher writes into C's far
  attribute (the "as wide as the samples lie apart" logic already there, `S.foot`). So a river looks the same where it
  passes from the mesh to the far colour. (2) The coast: W2's `hydroCoast` cut is applied after `_open` in the coast
  recipe, and C must agree where; C also owns why the shelf is a flat 26.0 m and why the wall is painted as vertical
  stripes (`w10`: the cliff's paint is C's). (3) Lake beds change the ground's shape in basins, which C's far paint sees.
- **D, the weather.** D hands the RAIN FIELD: (a) to the shaders, `uRainCells[8]` as `vec4(east, north, radius, rate)`
  (metres from the focus in the body's tangent frame; mm an hour), the eight cells nearest the eye from `cellsAt`, and
  `uRainNow` (mm an hour at the eye); (b) to the physics, `rainAt(bodyId, x, y, z, t)`, the same rate at any point, for
  splash counts and the rills; (c) the ground's wetness integral already in `uWx.y` and `moistureAt`, used for puddles,
  rills and the rivers' rise (the rise eased over minutes, with the lag of a real catchment). The water does not make
  its own rain.
- **F, the look director.** The water uses F's shared functions as they are (`pcDensity`, `pcThinLayer`,
  `pcStrokeOct(4)`, `pcGroundChart(D)`, `pcAtmosV`, `pcFogAmount`, `pcOilSunC`). Asks of F: (1) the haze over water at
  a distance keeps more of the water's own value (an argument to `pcAtmosV` or a water-only factor); (2) the reflected
  clouds: the cloud layer's coverage in a reflected direction, cheaply; (3) F reviews W3's and W2's stills before each
  merge.
- **B, the flora.** Places reeds, rushes, sedges, lilies and brook stones by `o.still`, `o.bank`, `o.lq`, `o.h`, `o.s`
  (3.7); no near-ground blades under 0.15 m of water (`nearground.js`).
- **A, the trees.** Nothing new; trees keep off water by `o.lq` as now.
- **PILOT.** `audio.js`: the river, falls, rain-on-water voices from `here.water`; the figure's wetness in its paint;
  the speed test's water views (section 6); the play harness walking and flying into water.
- **PHYSICS (shared files).** `physics/index.js` wake block; `particles.js` emitter.

### 5.7 Where a lane must touch a file another group owns (for the coordinator to order)

| file (owner) | lane | what, exactly |
| --- | --- | --- |
| `src/world/surface.js` (shared; coast with C) | Lane 0 | the four hooks of 5.0; nothing else in this file by any water lane |
| `src/world/index.js` (F) | Lane 0 | one line making the falls layer; one call to `waterframe.js` for the water's uniforms |
| `src/world/patchgen.js` (C, except the water section) | W3 | the water section only; plus writing `frac` into C's far attribute: agree the byte with C |
| `src/world/terrain.js` (C) | W3, if needed | the water mesh's attributes bound (two lines), and the multi-draw remedy of 3.3 if the phone asks for it |
| `src/render/materials.js` (shared; trees A, plants B) | W3 | the water section only (`WATER_VERT`, `WATER_FRAG`, `makeWaterMaterial`) |
| `TERRAIN_FRAG` in `materials.js` (C or the ground's owner) | none: C | the wet margin painted by C from the water lane's height-above-water byte |
| `src/physics/index.js` (PHYSICS) | W4 | the wake block (today's lines 533 to 556) and `here.water` |
| `src/physics/particles.js` (PHYSICS / D) | W4 | one emitter for splash events |
| `src/audio/audio.js` (PILOT) | W4 hands, PILOT builds | three voices from `here.water` |
| the figure's paint (`FIG_FRAG`, F or PILOT) | W4 hands `wet01` | the cloak darker and heavier while wet |
| `src/physics/powers.js` (powers) | W4 | the gust and tornado over water: events only |
| `src/world/nearground.js` (B) | none: B | no blades under 0.15 m of water |
| `src/core/bench.js` (PILOT) | Lane 0 | the rows of section 6 |
| `src/data/looks/earth.js` (shared data) | W1, W2 | only the water keys (`oil.springs`, `oil.lakeK`, `oil.ponds`, `oil.puddles`, `oil.fjords`) |

### 5.8 Order and merges

1. **Lane 0** (hooks, switches, bench views). Agreed with C (the coast hook) and F (`world/index.js`).
2. **W3 and W4 start at once; W1 starts at once; W2 starts with its fallbacks.**
3. **Merge W3's first two fixes first** (still water, octave): the plainest faults, low risk, behind `?wpaint=2`.
4. **Then W4** (wakes, splashes) with W3's per-pixel wake drawing.
5. **Then W1** (rivers from the tree) once its maps pass, behind `?rivers=tree`.
6. **Then W2** rebased on W1 (lakes, falls, fjords).
7. W3's colour, far shine and rain go with C and D as their sides land.
Each merge: the three suites, `node tests/all.mjs --only static,unit`, the default game unchanged (bit-identical
samples with every water switch off, as v34 proved for its field: 80,000 samples x 29 fields), the stills above
reviewed by F, and the speed test's water rows on the phone before a switch is turned on by default.

---

## 6. Speed-test rows (for `src/core/bench.js`)

The speed test's view has no water in it (0.0 % measured), so **no row taken there can measure the water**. Two pinned
WATER VIEWS are needed, the explorer put at a fixed place and held there as the test already holds it:
- **the bank view**: Earth E1, the explorer on the bank facing upstream (water about 18 % of the picture);
- **the shore view**: Earth E9, at the waterline facing the sea (water about 75 %).
Rows (each against the "as set" row before it, as now; every new piece switched by a uniform, not a recompile):

| row | view | what it answers |
| --- | --- | --- |
| bank view as set | bank | the base |
| bank view: no water drawn | bank | the water's real cost a pixel on the phone (today's derivation: about 0.9 ms) |
| bank view: v37 water paint | bank | what the new paint costs (budget: at most +0.6 ms with everything below on) |
| bank view: no wakes | bank | the per-pixel wakes (a scripted wade keeps sources alive) |
| bank view: rain, no rings | bank | the rain rings (the forced rain sky on for both rows) |
| shore view as set | shore | the base |
| shore view: no water drawn | shore | the cost of three quarters of a picture of water, and whether hidden ground is skipped (if "no water" is SLOWER, it is) |
| shore view: v37 water paint | shore | budget +1.2 ms |
| falls view: no falls | a fall (once built) | the sheet and spray (budget 1.5 ms close) |
| no water drawn | landing (exists) | stays, as the check that the landing pays nothing |

---

## 7. What I could not settle (said plainly)

- **The phone's real cost of water is not known.** It has never been in the speed test's view. The 14 ns a pixel is
  derived from the ground's measured cost and a ratio measured here in software, with a range of about two either way.
  The water views of section 6 are how it gets settled.
- **Whether the phone skips the ground under the water** depends on how it keeps depth (reversed: skipped; logarithmic:
  not). The speed test's header prints it; I did not have the table's text.
- **Rain under the game's own weather was not seen on water.** With `&physics=1&wtime=700` the storm was not over the
  bank; only the forced rain sky was seen (`w14`).
- **The player's interaction was not seen at all**: the gallery has no player. Wakes, splashes, swimming were read from
  the code.
- **Reflections were not judged**: they come from the last frame, which a still may not have.
- **The night, the aurora on water, other worlds' liquids** (Neptune's methane sea, lava, acid, a sea of cloud) were not
  looked at in this design; every new piece is per look and per biome, Earth first.
- **The smoothed tree network has not been drawn yet.** The raw flow tree was drawn (`map-flowtree-*`); its zigzags and
  combs are why section 3.2 smooths, bends and roughens. W1's first deliverable is the map that proves the cure.
- **Why the coast's shelf is exactly 26.0 m and its wall a single sheer step painted in vertical stripes** was not
  traced: it is the coast recipe's (C's) and it is exactly where the falls must go.
- **Fjords on a 4 km world are small** (a few hundred metres): whether that is what the owner imagines is theirs to say.
- **Moving the rivers moves the landing's brook.** `oil.springs` can keep a stream by the landing, but the first view
  will change under `?rivers=tree`; the owner should see A and B before it becomes the default.

---

## Appendix A: the camera helper used for the stills

Put into the gallery page with `node tools/lab.mjs eval "<this>"` after `open` (the page exposes `__pcGallery`):

```js
window.__off = (dir, e, n) => {           // a point east/north metres from a unit direction (the gallery's frame)
  const R = 4000, l = Math.hypot(...dir), u = dir.map((v) => v / l);
  let ex = u[2], ey = 0, ez = -u[0]; const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
  const nx = u[1] * ez - u[2] * ey, ny = u[2] * ex - u[0] * ez, nz = u[0] * ey - u[1] * ex;
  const x = u[0] + (ex * e + nx * n) / R, y = u[1] + (ey * e + ny * n) / R, z = u[2] + (ez * e + nz * n) / R, k = Math.hypot(x, y, z);
  return [x / k, y / k, z / k];
};
window.__goto = async (dir, h, yawDeg, pitchDeg) => {   // stand h metres over the higher of ground and water
  const G = window.__pcGallery, st = G.state, W = G.world, l = Math.hypot(...dir);
  const d = { x: dir[0] / l, y: dir[1] / l, z: dir[2] / l }, s = W.sampleSurface('earth', d);
  st.pos.set(d.x, d.y, d.z).multiplyScalar(Math.max(s.radius, s.liquidRadius || 0) + h);
  st.yaw = yawDeg * Math.PI / 180; st.pitch = pitchDeg * Math.PI / 180;
  const root = W.bodies.get('earth'); root.position.copy(st.pos).multiplyScalar(-1); root.updateMatrixWorld(true);
  W.setBuildBudget(60); let idle = 0, g = 0; const t0 = performance.now();
  while (idle < 3 && g++ < 4000 && performance.now() - t0 < 120000) { W.update(0, G.camera.position, 'earth'); idle = W.busy === 0 ? idle + 1 : 0; }
  W.setBuildBudget(5);
};
```
Then `node tools/lab.mjs eval "return await window.__goto(<dir>, <h>, <yaw>, <pitch>)"` and `node tools/lab.mjs grab
out.png 2`. The first grab after a long move may still be building: grab twice and compare before measuring anything
(a first measurement of the ground's share read 23.7 % before the view settled and 42.5 % after).

## Appendix B: the stations

All Earth, oil look, `flow=1`, 15:24 (`time=15.4`), tier 1. `P0` = the landing direction `(0.19461, 0.62161, 0.75877)`;
`L4` = the largest basin near it `(-0.33668, 0.81380, 0.47368)`. Offsets are (east, north) metres in the gallery's
frame at that direction; heights over the higher of ground and water; yaw from north toward east; pitch in degrees.

| station | place | height | yaw | pitch | stills |
| --- | --- | --- | --- | --- | --- |
| E0 | the gallery's stream view at the landing (`cam=stream`) | 1.55 | 40.7 | -4 | `w01` |
| E1 | `(0.196307, 0.620916, 0.758899)` (the brook's bank) | 1.6 | 20 / 200 | -14 / -10 | `w03`, `w04`, `w14` (`&wx=rain`) |
| E2 | E1 + (19.5, 30.1) | 1.7 | 20 | -8 | `w05` |
| E3 | P0 + (0, 100) | 150 | 20 | -38 | `w06` |
| E4 | L4 + (0, -280) | 150 | 10 | -24 | `w09` |
| E5 | L4 + (0, -1000) | 350 | 0 | -24 | `w15` |
| E6 | P0 + (-1560, -1420) | 20 | 50 | -4 | `w10` |
| E7 | P0 + (-1150, -1000) | 150 | 225 | -30 | `w11` |
| E8 | P0 + (-1250, 250) | 1.7 / 60 | 300 | -12 / -35 | `w12`, `w13` |
| E9 | P0 + (-1720, -1202) | 1.8 | 185 | -9 | `w18` |
| E10 | P0 + (-700, -500) | 300 | 228 | -20 | `w16` |
| E12 | P0 + (-1720, -1240), only the water drawn, 936 x 372 | 20 | 180 | -89 | `w20` |
| (1 km) | P0 | 400 | 185 | -26 | `w08` |

## Appendix C: the scratch tools (not committed; described so they can be rebuilt)

All Node, importing the game's own modules with the oil look on and the drainage attached:
- `stations`: the filled basins as connected components with their wet share; the nearest sea, cliff tops, white
  points; where wood water comes within 400 m of the sea and the ground between.
- `map`: a top-down picture of `sample()` round a point (water by depth and kind, white where `turb > 0.25`, ground by
  height and biome).
- `tree`: the drainage map built with the flow tree kept (`to`, a float `acc`), drawn where `acc` passes a threshold with
  width `2 + 3.2 sqrt(acc / 10)` m, over the filled basins; prints the counts and the river mouths.
- `samplecost`: 200,000 points in the wood, the sample's cost with and without the drainage, and `_riversOil` alone.
- `diff`: two stills compared pixel by pixel (a channel sum over 24 counts as changed): the water's and the ground's
  share of a view.
