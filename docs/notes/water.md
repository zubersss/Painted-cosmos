# WATER notes (group E: everything wet on the ground)

The design is `docs/lead/WATER-DESIGN.md` (read it first). This file is the hand-over: what is built, on which branch,
what is next. Kept current after every step; the container can restart.

## Hand-over (READ THIS FIRST; kept current)

**Branch `design-water`** (the water branch; the coordinator merges it, never this session). Cut from `look-proto` = live
`main` at v37. The coordinator's GO (24 Nov): lane 0 first, push, tell the coordinator; then build W1 RIVERS here; two
other sessions build the other lanes. Every step: behind a switch, the three suites green, A/B stills opened (bank, 150 m,
1 km), the phone cost derived with its speed-test row, stills to the LOOK DIRECTOR (session_01R5Brhzz2JPPF6Ecz6XRQHx) for
review before a step is called done, a short message to the coordinator (session_01R5Bri1TV3HBTyuxNZZuhNw) after each.
The weather group lands the rain field (its section 9.3: `fields.rain` at 32 a face, mm/h, 2 Hz, `rainAt`,
`rainBetween`, a GPU channel `pcRainAt`): use theirs for rain (the design's `uRainCells[8]` and `rainAt` are replaced).

**STATE (24 Nov, 12:10), the short of it.** Pushed on design-water (01ec60c, ready for the coordinator's release): W1 rivers
with S-bends (aeca809), the index fix, mountain streams behind ?mount=1 (1eed43a, dfbe555; F: keep behind the switch, the
white water is the paint's), THE DEFAULT FLIP in the oil look (4873c6a: rivers of the tree, lakes, ponds, puddles, fjord on;
falls held), the speed test's falls view and ?bench=water (597ab63), the landing's river (c229268: Earth's oil.springs and
oil.keep, the save's nudge to 24 m; ACCEPTED by the coordinator from the stills 1ec1984), E-W2's puddle fix merged (110b43e:
round the landing 1.39 % of the dry ground). THEN (a877068): water-paint merged (f05eee3) with THE FALLS FLIP (W.falls = n('falls', d), E-W2's line, F passed the falls with the paint's curtain fix; they ship with water-paint, never before). THEN (2d40220, THE v39.2 WATER, the coordinator's ruling): ?wpaint defaults to 0 (v37's strokes: the look director found the sea from the air a blocky checker with ?wpaint=1 and 2); the falls stay on; stills v392-*.jpg. NEXT: merge look-proto when the coordinator says v39.1 has landed; W3 will later make its strokes the default for rivers and ponds only. OPEN: F's sand-bar notes (colour, grass,
pebbles: C's recipe, asked; the trees' line can read c.barZone); the runoff paint (E-W3/W4) and its A/B in a storm; the
falls flip (one line in mode.js when E-W2 sends it). The lead's sessions: coordinator session_01R5Bri1TV3HBTyuxNZZuhNw,
F session_01R5Brhzz2JPPF6Ecz6XRQHx, E-W2 session_01R5Bri2xowNiwS1SnP3VG3f, E-W3/W4 session_01R5Bri2fSASVVvyrSG11UGF,
C session_01R5Bri2AMBsFiRcxvUUZMvu, D (weather) session_01R5Bri2bBgFSfCmxpKKuURT (src/physics/index.js is now the water's).

### LANE 0 (built and pushed 24 Nov, commit b5924da): the hooks, the switches, the speed test's water views

- `src/data/mode.js`: `MODE.water` and `waterFromSearch(search)`: `?rivers=tree ?lakes= ?ponds= ?puddles= ?swell= ?falls=
  ?fjord= ?wpaint= ?wakes= ?splash=`. `MODE.water.on` = any part that changes the world (rivers, lakes, ponds, puddles,
  swell, falls, fjord). Read in `main.js` (after the beasts line) and `art/gallery.js` (after the flow block).
- `src/world/waterhooks.js` (new): `loadWater()` (fetches drainage.js, rivers.js, hydro.js, falls.js as asked; nothing
  without a switch or without the oil look), `ensureWater(bodyId)` (drainage, then `attachRivers(S, drain)`, then
  `attachHydro(S, drain, S.rivers)`; once a world), `frame(st, dt, camL, lighting)` (steps `WATER_PARTS`),
  `WATER_BENCH` (rows a lane adds for the speed test's water views, from its own file).
- Stubs that fix each lane's contract (their headers say it exactly): `src/world/rivers.js` (W1), `src/world/hydro.js`
  and `src/world/falls.js` (W2).
- `src/world/surface.js`, EXACTLY these hooks (each does nothing while the part is null):
  1. constructor: `this.rivers = null; this.hydro = null;` (after `this.drain = null;`);
  2. `makeSample`: four fields `still, bank, cap, swell`;
  3. `_base`, right after `c.L = this._bigL(x, y, z);`: `if (this.rivers) { c.s = this.rivers.sample(this, c); return; }`;
  4. `_forest`, right after the water level (`} else b.lq = L - 0.4;`) and before `if (!full) return;`: one line that fills
     a scratch `H` with the parts of `b.h` and calls `this.hydro.forest(this, c, b, H)` if `this.hydro`;
  5. the coast branch of `_generic`, right before `h = hh + C.n3(x * R / 9 ...`: `let lqC = NaN; if (this.hydro) { hh =
     this.hydro.coast(this, c, hh, T); lqC = c.lqC; }`, and right after `lq = this.sea == null ? 0 : this.sea;`:
     `if (lqC === lqC) lq = lqC;`;
  6. `sample`: `c.still = c.bank = c.cap = c.swell = 0; c.lvR = NaN; c.turbW = NaN; c.fspdW = 0` beside `c.fu = 0; c.fv = 0;`,
     and `o.still = c.still; ...` beside `o.fu = c.fu; o.fv = c.fv;` (written EVERY time: the v37 rule);
  7. (added 24 Nov for E-W2) right after the drainage block that sets `o.turb` and `o.fspd`: `if (c.turbW === c.turbW)
     { o.turb = c.turbW; o.fspd = c.fspdW; }` -- a water part that owns the water there (a mouth cut, a pond, a fall) MAY set
     c.turbW (0..1) and c.fspdW (m/s); without it E-W2's 380 m cut through the coast's berm painted white end to end;
  8. (W1) in `_forest` right after the water level: `if (c.lvR === c.lvR) b.lq = c.lvR;` (the rivers' own level).
- FOUND BY E-W2 (24 Nov): the flat 26 m shelf and sheer wall at Earth's coast (stills w10, w11 of the design) are sample()'s
  BERM (a water group's ground lifted where its weight falls under 0.55-0.78), not the coast recipe; W2 cuts through it with
  lane 0's hooks only.
- `src/world/index.js`: a `let WATERH` beside `DRAIN`; two lines after `DRAIN.ensureDrainage` (fetch the hooks on first
  use when `MODE.water.on`; `WATERH.ensureWater(active.id)`), one line after the animals' block (`WATERH.frame(...)`).
- `src/core/bench.js`: THE WATER VIEWS. The speed test's own view (the landing) has 0.0 % water, so two places on Earth
  are held for the water's rows: the BANK (the nearest water to E1, found at run time so it follows ?rivers=tree; two
  metres back, looking the way the water runs longest) and the SHORE (E9, at the waterline); the run waits for the
  arrival veil after a move. Rows: `as set,
  bank view`, `bank view: no water drawn`, then any `WATER_BENCH` rows for the bank; the same for the shore; then the old
  `as set` row goes back to the landing. A water view's "as set" is left out of the agreement check.
- MEASURED: bit-identical with every water switch off: the old surface (HEAD) and the new on 40,000 samples in each of
  four settings (watercolour/oil x without/with the drainage), every field of the old sample object: 0 differ.
  Test: `src/world/waterhooks.test.mjs` (switches, nothing attached without a switch, the hooks asked only when attached,
  the fields written every time, the frame).

### W1 RIVERS (built 24 Nov, this session; behind ?rivers=tree) -- REVIEWED BY F: PASS

F (look director), 24 Nov, on ab-150m, ab-1km, ab-bank, ab-main150, ab-coast150, B-game-landing: "B is one river system
where A was scraps; the brook at the landing sits right." Its one open point (the far water near V 0.8 against the rules'
0.45-0.70; hue from the sky's zenith, not grey) is the paint's: forwarded to E-W3/W4 (session_01R5Bri2fSASVVvyrSG11UGF).
The other water sessions: E-W2 bodies (lakes, ponds, puddles, falls, fjords), session_01R5Bri2xowNiwS1SnP3VG3f, branch
water-bodies; E-W3/W4 paint and player (with FV5 and the night key), session_01R5Bri2fSASVVvyrSG11UGF, branch water-paint.
This session is the water group's lead: it answers their questions on the design and their seams.

- `src/world/drainage.js`: `keepTree` keeps `to`, a float `accF`, the routing order `ordR`; `rough` (2.5 m at 450 m) is laid on
  the base field for a SECOND flood used only for the routing (`lvlR`), so the levels (`lvl`, the lakes, the staircase) stay
  v34's exactly. `ensureDrainage` asks for both when `MODE.water.rivers` and the oil look are on.
- `src/world/rivers.js`: `buildRivers(S, D, opts)` / `attachRivers(S, drain)`; `RIVER_DEF` holds every number. Read its header.
  The level: `P = min(max(lvl, ter - cutMax), P upstream)` down the tree. The sample grades `c.L` toward `P + depth` within
  55..220 m of a river and sets `c.lvR = c.L - depth` (the lake's level blended in where the field fills a basin), which
  `_forest` uses in place of the staircase. Twigs (`_sf3`) are kept, masked by a slow noise, ending at the tree's rivers by
  the side of the nearest segment. The noise side streams (`_sf2`) are NOT used in tree mode: the tree's own streams are the
  tributaries.
- Earth's look: `oil.springs: [{ at: 'landing', up: 4, acc: 30 }]` keeps a brook by the landing.
- MEASURED: 267 reaches (246 joins, 9 sea, 12 edge), 21 mouths, 13 lakes, 10,383 segments, 1.6 MB; sample 1.49 us against
  2.29 us (today's rivers, same run), the river part 0.55 us; BUILD, COLD, ON A QUIET MACHINE (three fresh processes, the
  first build as the game makes it): drainage 54-55 ms (two floods 25) + rivers 90-92 ms (the index 62-66) = 143-147 ms,
  inside the design's 150 ms (the 160-175 ms first reported were measured while test suites ran alongside). Game: landing
  view water 6.8 % (was 0.0), bank view 20.9 % (the search finds the new brook at 8 m).
- PHONE COST, DERIVED (14 ns a water pixel, 32 ns a ground pixel, design section 2): landing view +0.33 ms of water (23,540 px;
  range 0.19-0.66), which replaces 0.75 ms of ground if the phone skips hidden ground; bank view 1.0 ms (today's 0.9). Script:
  patch building a third cheaper. Load about 0.4 s on the phone (assumed 2.5x this machine). Bench: there is no runtime
  switch for the rivers (the ground is built from them), so the phone compares TWO RUNS, with and without ?rivers=tree: the
  as-set rows and the bank and shore views' no-water rows.
- Stills: `docs/shots/painter/water-w1/` (A today | B tree, at the bank, 150 m over the landing, 150 m over the new main river,
  1 km, the coast; the tree maps; the game's landing and bank views).
- AFTER THE PUSH (polish): the index packed flat (no per-node arrays: the same network to the pixel); the seam at the
  exact/coarse switch (100 m) closed -- the coarse field undercut 100 m at 0.97 % of samples past it, by up to 37 m, which
  would dip the hills along a line; now the two meet at 100 m and the river's level eases across the last 25 m. Test 7
  walks out from the rivers and holds the ground's steps over 1 m to today's along the same lines (9,455 steps over 0.25 m
  against today's 17,411; at the switch line no more than today's).
- NOT DONE (said plainly): the drop to the sea at each mouth (W2's mouth cut and fall: the wood stands at least 12 m over the
  sea everywhere on Earth); grey from the air (W3); basins flood only along channels (W2's lake beds).
- TRIED AND REFUSED: the index built from a full window of the grid round each chunk (face arithmetic, no walk): 200 ms
  against the walk's 65; the walk stays.
- NEXT for W1: (done: the S-bends, below); the main river by the
  landing is now a brook (a spring with a larger catchment would bring a wider one past it: one number in Earth's look).

### RUNOFF (data side built 24 Nov, this session; ?runoff=1 with ?rivers=tree): the owner's own ask

"how the water collects and drifts into ponds or into runways into the rivers and oceans". The DATA is this session's, the
DRAWING the water-paint lane's (E-W3/W4): the contract below was sent to it before building.
- `src/data/mode.js`: `?runoff=1` (`MODE.water.runoff`; counts as a part that changes the world).
- `src/world/rivers.js` (under runoff): the twigs are RUNNELS: about four in five of them run (half without runoff), and
  they reach 160 m from a stream (110 without); `c.cap = 0.6` m on a runnel, and on the heads of the tree's smallest streams
  (catchment under 40 nodes, eased from 24); the water level there is the FULL one. `c.swell` (how much water rises after
  rain) is now also 0.6 of a lake's basin.
- `src/world/waterstate.js` (new): `WATERSTATE = { wet, rise, mud, rain, from }`, a hydrograph at the eye stepped once a
  frame (a WATER_PART): from the weather's rain field when the physics has it (`physics.fields.rain.rainBetween` over the
  last 30 min and 3 h, asked twice a second), else from the ground's wetness (the world's `uWx.y`). `RUNOFF` holds the
  numbers: runnels full at 2 mm in half an hour, up in 60 s, down in 600 s; streams up to 0.4 m for 20 mm in three hours,
  up in 300 s, down in 1,800 s; mud 0.7 of the rise.
- `src/world/waterhooks.js`: loads waterstate.js when `?runoff=1`; the frame's ctx now carries `physics` (world/index.js
  passes it).
- THE PAINT'S SIDE (E-W3/W4): `depthNow = vDepth - (1 - WATERSTATE.wet) * cap`, discard where none is left; the water lifted
  by `WATERSTATE.rise * swell`; a swollen river browner by `mud`. Until that lands ?runoff=1 shows only the longer, denser
  twigs, all the time.
- SEEN (a Node map of the surface, not the renderer): `docs/shots/painter/water-runoff/map-runoff-storm-dry-3km.jpg`, the
  runnels (cyan) running at full wet and gone in the dry.
- Test: `src/world/runoff.test.mjs` (the switch; the hydrograph's timings; the part reading the rain field when there is
  one, the wetness when not, not every frame; the data: runnels carry cap, rivers swell, the landing dry).

### THE DEFAULT FLIP (24 Nov, this session; the owner via the coordinator: reviewed work becomes the default tonight)

`src/data/mode.js` waterFromSearch: with `?look=oil` and nothing said, `rivers` (the tree, with its S-bends), `lakes`,
`ponds`, `puddles` and `fjord` are 1; opt-outs `?rivers=old` (or `0`), `?lakes=0`, `?ponds=0`, `?puddles=0`, `?fjord=0` (all
five: the oil look as it was). `falls` stays 0 until the water's paint lands the curtain (then `W.falls = n('falls', 1)`).
The watercolour game (no `?look=oil`): every part 0, as it was. Merged first: `origin/water-bodies` 7c4daa6 (W2's parts
build only where the look asks: 221040b).
- `src/world/waterhooks.js` ensureWater builds NOTHING on a world without a wood (the drainage field alone changes a world's
  white water and pools): `?flow=1` still builds the field anywhere, as it did.
- `src/core/save.js` (PILOT's file, the coordinator's word: "if needed, lift or nudge to dry ground on load"): a place saved
  on dry ground that stands in shallow water NOW comes back on the nearest dry ground within 24 m; one saved swimming still
  swims.
- THE FOUR CHECKS, measured: (1) the landing dry, its brook 32 m off with every default part on (rivers.test: under 60 m);
  (2) 800 places on the old brook's banks within 400 m of the landing: 11 stand in water now (up to 0.56 m, none deep
  enough to swim); loaded through the real Sim and restore, all 11 come back on dry ground, moved 1.5-3 m; nobody can load
  inside a bank (restore sets the explorer on the ground as it is now: it always did); (3) the speed test's bank view finds
  water 12.5 m from its spot with a long run of it (the old: 2 m); (4) every other world: the same samples, bit for bit,
  under the default address (`?look=oil`), with no drainage, rivers or hydro built; Earth alone changes.
- `src/world/waterhooks.test.mjs` test 1 now holds the defaults and their opt-outs.
- HELD BY THE COORDINATOR (11:26): THE LANDING LOST ITS RIVER (the owner's approved first view is a wide stream under the
  maples; on the default it was a 5.5 m brook, and from 150 m no river by the landing). Cure, in Earth's look
  (`data/looks/earth.js` oil): `springs: [{ at: 'landing', up: 16, acc: 1100, ramp: 10 }]` -- catchment added sixteen nodes up
  the tree from the landing, growing over ten (`ramp`, new in rivers.js), so the river widens down to the landing -- and
  `keep: [{ at: 'landing', r: 12 }]` (new in rivers.js): the river bends round the landing, its water's edge at least 12 m
  off (a nearer point of the curve carried out along the line from the landing, eased). MEASURED: the river by the landing
  18.8 m wide, its centre line 22 m and its water's edge 16 m from the landing, the landing dry; the bank view finds water
  12.5 m off; 28 of the 800 old bank places stand in water now (up to 1.24 m) and the save's nudge, widened to 24 m, brings
  all 28 back on dry ground (moved up to 13.5 m).

### THE SPEED TEST'S FALLS VIEW AND ?bench=water (24 Nov, this session; lane 0, the coordinator's order)

`src/core/bench.js`: a water part may PLACE its own view: a WATER_BENCH row with `place(S)` returning { dir, yaw (degrees),
pitch (radians) } or null (E-W2's `fallsView`, in the sea 60 m before the widest fall). The view is asked once, of Earth's
surface as built; a part that is not loaded adds no row, and a place that finds nothing (null: no falls on the world) adds
no view. The views loop as bank, shore, then every placed view. `?bench=water` runs the water's views only (the landing's
as-set row, then each view's as-set, no-water and part rows): short, for a phone and for a headless check.
- CHECKED HEADLESS (the game, `?look=oil&falls=1&bench=water`): all 8 rows ran -- the landing, the bank (as set, no water),
  the shore (as set, no water), the FALLS view (as set 431k triangles, no water 352k, no falls 429k) -- and the explorer
  went back to the landing; no errors. The view itself, opened in the gallery at the place it gives:
  `docs/shots/painter/water-default/bench-falls-view.jpg` (from the sea, the widest fall's sheet in the cliff).
- `c.barZone` (world/rivers.js, written every call): the bar and 6 m beyond, for the wood's trees to stand back from it (F's
  bar notes); not read yet: the bar's colour, grass and pebbles are C's recipe, asked of C with the tree line.

### S-BENDS ON THE BIG RIVERS (built 24 Nov, this session; part of ?rivers=tree, ?bends=0 for the A side)

The coordinator's order (3a): the references' long S-bends on the big rivers. All in `src/world/rivers.js` (and one switch,
`?bends=0`, in `src/data/mode.js`).
- A RIVER IS NOW ONE CURVE through its junctions: the STEMS (from a source down through every junction where it drains the
  most, to where it joins a bigger river, the sea, the wood's edge or an outlet), drawn rivers first, tributaries after.
  Before, each reach was a curve of its own held still at every junction, so no bend could run through one. `net.reaches`
  is kept as before (the tests' and the hydro lane's account; each reach now says `thin` if the thinning at a wood's edge
  reached back into it).
- THE BENDS: wide rivers (full width 8 to 16 m and over, `bendW`) swing in the SINE-GENERATED CURVE of real meanders
  (Langbein and Leopold; tabled once in `sbTable`, `sbend(phase, omega)`), wavelength `bendLam` = 16 widths (the field ratio is
  10-14; at 12 the maps read as a wiggle from the air), swing angle `bendOmega` 1.25 rad varied 0.8-1.35x along the river,
  bends early or late by `bendJit`; the bend's radius is about 0.2 of the wavelength (3 widths); the swing about a quarter
  wavelength each way (+-100 m on a 26 m river). The phase runs along the whole stem. Streams keep W1's wander (now a noise
  along the stem's own phase, so it too runs through junctions). The wide rivers' nodes are smoothed 6 passes more
  (`bendSmooth`), so the bends are theirs and not the grid's turns.
- A TRIBUTARY meets the bent river at the NEAREST point of its curve to the old junction (searched 60 points either way),
  its last stretch carried there over max(60 m, 2.5x the carry); carried to where the junction itself went, short ones
  folded back on themselves (turns of 120-133 degrees, found by a scan of every joined pair of segments; now none over 45).
  A tributary keeps its OWN width to the junction (it used to flare to the main river's width over its last 98 m).
- POINT BARS: every segment carries the turn at both ends (`sK`, widths over the bend's radius, signed; smoothed over 50 m);
  on rivers of the bars (kM >= 2.2) a bar of sand lies on the inside of each bend, `2.2 hw` wide at a bend of radius
  3 widths, standing a bank up from the water and flat (s 4.5-7: 0.2-0.6 m over the water), with a short scarp behind it
  back to the land's own lie (so two rivers' grounds still meet: without it the ground behind a bar stepped where the nearest
  river changed). The noise bars stay where they are wider.
- THE CURVE is sampled at 6 m along the S-bends (12 m elsewhere) and THINNED to what it needs: no point further than `sag`
  (0.25 m) from a segment, none longer than `segMax` (24 m), every node and change of reach kept. 10,423 segments (A side
  8,284; before today 10,383). Before the thinning, 12 m samples stretched to 60 m segments across the bends (sags to 3.5 m).
- FIXED ON THE WAY (a W1 fault, there since the first push): the index walked CHUNKS of eight consecutive segments, and a chunk
  could run from one river's end into the next river anywhere on the world; the walk round its middle missed the far ones.
  Measured by brute force on 4,000 points within 90 m of a river: 128 of 3,761 (3.4 %) had their nearest segment missing from
  their node's list, by up to 65 m (a river's water or channel missing there). Now a chunk is segments that join, end to
  start: 0 of 3,787.
- BUILD (cold, fresh processes, same machine, same hour, against HEAD): HEAD drainage 57-60 + rivers 100-112 = 159-171 ms;
  now drainage 56-60 + rivers 98-125 = 157-167 ms (one outlier 201). The S-bends cost about 25 ms; paid for by `len3` in place
  of `Math.hypot` in the build and the index (the index 47-54 ms, was 64-73), the slow noises asked on a coarse grid, the turn
  asked once a point. The machine is slower this hour than when W1's 143-147 ms was measured: HEAD itself reads 159-171 now.
- SEEN (Node maps of the surface): the river south of the landing winds in S-bends with bars inside them; tributaries meet
  it; the contours run through the bars without steps (`docs/shots/painter/water-sbends/map-ab-*.jpg`). SEEN (the gallery,
  A `?bends=0` | B, `ab-*.jpg` there): 150 m over the river south of the landing (A straight, B one long S with its
  tributary meeting it); 1 km (B winds into the distance in S-bends); 35 m over a bend (B's bar a pale crescent between the
  trees and the water); on the bar at 1.7 m (pale ground, pebbles and thin grass, the river beside: it reads as a pebbly
  bank more than as sand). The bars do not show from 150 m (the water's paint and the trees hide them).
- Test changes (`src/world/rivers.test.mjs`): test 3 skips reaches the edge thinning reached into (`thin`); test 4 takes its
  river inland (a reach ending in a junction, not thinned: at the sea the mouth is W2's, and the widest segment there was a
  river thinning into a meadow).

### MOUNTAIN STREAMS (built 24 Nov, this session; ?mount=1 with ?rivers=tree)

The coordinator's order (3c). Plan sent to the coordinator before touching surface.js. Files: `src/world/mountain.js` (new),
`src/world/rivers.js`, `src/world/drainage.js` (one kept array), `src/world/waterhooks.js`, `src/data/mode.js`, and ONE hook in
`src/world/surface.js` (the alpine branch of `_generic`, plus `this.mount = null` in the constructor).
- WHAT WAS THERE: Earth's alpine meadow (a sixth of the world, peaks to 890 m, mountains 1-3 km north of the landing) had no
  water: its recipe carries no liquid (group -1) and the drainage field reads it as a wall 30 m over the wood's base.
- FIRST TRY, REFUSED (measured): the field over the mountains' own height. Their terrain is ridges round closed valleys: the
  flood filled a quarter of the mountain's nodes, p90 by 160 m, up to 488 m; a stream's path out climbed over saddles, so
  either lakes hundreds of metres deep or gorges as deep (a 70 m trench with 42-degree walls in the first map); and the
  basins reached into the wood at the mountains' feet as sheets of water. Pruning the climbing streams left almost none.
- WHAT IS BUILT: the field is untouched (W1's levels, lakes and routing exactly; it only keeps the mountains' share of each
  node, `D.share`, from the weights it asks anyway). `rivers.js` gives the mountains a LOCAL flow: each node over half
  mountain drains down its steepest slope on the mountain's own large-scale height (`mountain.js alpineMacro`, the alpine
  recipe's sums without the noises under 60 m; `mountBaseAt` blends it with the wood's base at the edges), into the valley
  floors, where a torrent ends (thinning away as at a wood's edge: 107 pits) or runs off the mountain into the wood's own
  tree. The hybrid tree's catchments and order (peeled from the sources) replace the field's for the build. A stream starts
  at `mountA1` = 6 nodes on the mountain (the mountain's flow runs into a hundred small valleys of about forty nodes each;
  at the wood's 24 there were 57 stream nodes in all); `mountW` 5 m wide at most; `mountWander` 0.7 of the wood's wander.
- THE WATER'S LEVEL on a mountain stream (`sM` 1 marks its segments) is NOT the nodes': between two 98 m nodes a crag rises
  and falls tens of metres, and a level drawn straight between them stood up to 275 m under the slope and 46 m over it. At
  build, each end of each mountain segment (24 m at most) takes the mountain's large-scale height (`mountBaseAt`), 0.5 m
  under it (`mountSink`), and the level runs down the stream as a running minimum: it NEVER RISES (taking the slope's height
  as it came, the water rose along 28 % of the mountain's segments, by up to 149 m in one: the test caught it). Where the
  slope rises across the stream it cuts a gorge, at most `mountCut` = 10 m; where a crag stands higher than that, the stretch
  runs DRY (`sM` 2: no water, no gully, a torrent under scree) and the stream comes out below at the slope's level.
  MEASURED: 40.7 km wet, 3.2 km dry (7 %); the land over the water at a wet segment's middle p1 -5.1, p10 -0.9, p50 0.5,
  p90 3.3, p99 11.2, max 37 m (perched where the slope dips between two ends: a low bank keeps it in). White water from
  the level's fall along a segment (turbW from 0.05 to 0.22 m a metre).
- THE GULLY: a shallow trough under the water, walls at 0.9 (42 degrees) up to the slope, a 3 m bank where the slope lies
  lower, a bed of stones, no trees within 5 m, no water over the snow line + 30 m (the gully stays). Nothing beyond 30 m.
- BUILD (rivers): about 157-165 ms with ?mount=1 against about 110-125 without (the mountain's own flow about 20 ms: the
  mountain's height at 6,000 nodes 11, steepest slopes 5.5, the order 3; the levels at the segments' ends about 7; the rest
  the 2,700 more segments). The sample is no dearer (the hook reads the segment's level). Without ?mount the network and
  20,000 samples hash the same as the S-bends commit; switches off, 0 differ.
- NOT DONE (said plainly): tarns in the mountain hollows (lakes are W2's: under ?mount=1 the field is unchanged, so W2 has
  nothing new to read; a tarn would need the alpine hook to be handed the hollow); the torrents are short and straight on
  the 98 m grid (a finer grid for the mountains would cost about 130 ms); the streams do not branch much.
- SEEN (the gallery, A ?rivers=tree | B &mount=1, `docs/shots/painter/water-mount/`): 150 m over a mountain valley (A no
  water; B a torrent down the flank, white where steep, joining a stream across the meadow); at a stream's bank (B a white
  cascade on the slope and the stream across the meadow: the white is one flat even white, no strokes: the paint's, W3);
  1 km toward the mountains (the streams, 5 m wide, do not show at 2 km: A and B alike). The map `map-ab-valley.jpg`.
- Test: `src/world/mountain.test.mjs` (the switch and the groups; streams on the mountains, narrow, their water never rising,
  dry stretches under 15 %; water in every wet gully under the snow line, white water, the snow rule asked directly; the
  landing as without the switch).

### W2 THE BODIES OF WATER (branch `water-bodies`, session_01R5Bri2xowNiwS1SnP3VG3f; READ THIS to pick W2 up)

Branch `water-bodies` = lane 0 + look-proto v37.1 + `origin/design-water` (W1's rivers, merged 24 Nov for `net.mouths` and
`net.lakes`). Files W2 owns: `src/world/hydro.js`, `src/world/falls.js`, `src/render/fallmat.js`, their tests, the look keys
`oil.lakeK`, `oil.ponds`, `oil.puddles`, `oil.fjords`, and its speed-test rows through `WATER_BENCH`.

- **STEP 1 + 2 (built 24 Nov): `src/world/hydro.js` and `src/world/hydro.test.mjs`.** Every number is in `HYDRO_DEF`.
  - LAKES (`?lakes=1`, `lakeCarve`): in a filled basin the wood's relief over the base level shrinks by `lakeK` (0.78) as the
    fill goes from lakeMin to 1.6 lakeMin, and the bed is let down up to 1.4 m more. MEASURED (Node, Earth, the wood's basins'
    points, 25 a node): wet 20.6 % -> 71.8 %; the four big basins 71 to 86 % (islands remain); lake 11 (780 m from the landing)
    14 -> 53 %; lakes dead level; the landing in no basin, its ground and water unchanged, the nearest water to it still 10 m.
  - THE MOUTH CUT (`?falls=1`): TRACED: the "26 m shelf and sheer wall" at a mouth are surface.js sample()'s BERM over the
    wood-sea blend (the coast recipe there is open sea at -11 to -22 m), and the wall is where the wood's weight falls under
    0.0015. A corridor runs from 18 m up the river's end, turning down the wood's weight, to that wall (found at load by
    walking the unchanged surface, the lip bisected to 0.1 m). In it the wood's b.lq and the coast's c.lqC carry the cut's
    level (so sample() merges the groups and no berm fires) and both recipes return the same bed and banks; the banks rise to
    the shelf measured beside each station at load. MEASURED at Earth's main mouth (E6/E7): water 20.80 m at the river's
    end, 19.59 m at the lip 383 m on, bed 1.2 m under it, banks to 24-25.6 m, then the sea floor at -22.1 m: a 19.5 m fall.
    9 falls on Earth (of 21 mouths: 10 cross a biome the hooks cannot cut, 2 end on land). `S.hydro.falls` lists them.
  - FJORDS (`?fjord=1`, rivers at least 8 m wide): the corridor and the river's own last reach at the sea's level, 40-90 m
    wide, floor 12 m down, steep walls; the river falls into its head. Built and mapped only (`map-fjord13-B.jpg`); not seen.
  - PONDS (`?ponds=1`, a biome's or the world's `oil.ponds` = the chance a 120 m cell holds one): only on low ground (the
    wood's hills under 9 m), no basin, 22 m from running water, rim spread under 1.4 m, 80 m from a clearing; level 0.22 m
    under the lowest of eight rim points (held in: tested at 1.3 radii); bent-ellipse outline 6-22 m. Earth at 0.3: 102.
  - PUDDLES (`?puddles=1`, `oil.puddles`): `c.cap` (m at full wetness, at most 0.12) in the 15 m relief's hollows on slopes
    under 3 %. MEASURED near the landing: 2.6 % of dry ground, mean 3 cm. Drawn by W3's mesher and `uWet` (not built here).
  - LOAD (here): cuts 45 ms, ponds 25-30 ms (both at load, once a world).
- **LANDED (lane 0 on design-water, merged into water-bodies 24 Nov):** `c.turbW` / `c.fspdW` in surface.js sample(): a
  water part sets its own churn and speed. MEASURED in the main cut after the merge: turb 0 all along, 0.41 at the lip
  (was 0.26-0.47 all along from the drainage field's slope across the coast blend).
- Maps (Node, data drawn top down, not the renderer): `docs/shots/painter/water-w2/` (A today | B with the parts).
- Scratch tools (not committed, in the session's scratchpad): `map.mjs` (top-down PNG of sample()), `cutprof.mjs` (a cut's
  long profile and cross sections against the bare surface), `lakes2.mjs`, `ponds.mjs`, `puddles.mjs`, `mouths.mjs`.
- **STEP 3 (built 24 Nov, commit 0aa7cb7): THE WATERFALL.** `src/world/falls.js` draws `S.hydro.falls` within 1.5 km: the
  sheet along the jet's real path (leaves the lip at sqrt(g d) over the hard lip, 2.7 m/s at the main mouth, a parabola;
  its top edge follows the wall's line, which hydro.js measures across the cut), the plunge pool (a disc of milk and lace
  on the sea), the spray (dabs from the foot and off the lower sheet). Detail by distance; two draws. `src/render/fallmat.js`
  paints the sheet in pcThinLayer strokes on its own chart (down the fall in time of flight), whole strokes left out
  where it thins; the pool's strokes run out from the foot; spray dabs never under 3 px. SEEN (A ?rivers=tree | B
  +falls=1, gallery): from the sea at 68 m, 150 m up and 400 m up the fall reads as a white fall at the end of the cut;
  phone and top tier alike (`falls-AB-grid.jpg`). MEASURED: the layer is 5.9 % of the picture at 68 m, 1.2 % at 150 m;
  DERIVED 0.29 ms and 0.06 ms on the phone (1.2 ms close under it; budget 1.5). Test `src/world/falls.test.mjs`.
- **STEP 4 (commit f832ff2):** Earth's look keys `oil.lakeK 0.78`, `oil.ponds 0.25` (82 ponds), `oil.puddles 1`,
  `oil.fjords { every: 2, len, width, depth, minW: 8 }` (mouth 8 drowned, the main mouth stays a fall). `fallsView(S)` on
  the WATER_BENCH row as `place` for a falls view in core/bench.js (asked of its owner, exact lines sent).
- **OPEN ASKS (sent to the coordinator):** W3's
  mesher must skip a water cell whose corners' levels differ by more than 2 m and half the cell (else a flat blue
  curtain stands behind every fall); bench.js's falls view; C: the berm's ruled, striped wall and the cut's banks in leaf
  paint (o.bank is written for whoever paints it).
- **AFTER (24 Nov, a950282):** the plunge pool's strokes run straight out from the cliff (a polar chart drew a starburst from
  above); the hooks share one 120 m cell lookup and mark the cells near a cut at load. MEASURED (noisy here, about 0.15 us):
  every part on adds about 0.1-0.2 us to a wood sample, lakes alone nothing measurable. lookstats, 68 m view A | B: V>0.90
  13.3 -> 11.7 %, satL 0.44 -> 0.32, S(V<0.3) 0.43. Lakes, ponds and the fjord SEEN (`lakes-AB-grid.jpg`, `fjord-*.jpg`):
  basin 6 becomes one open lake reaching the mountains' foot (86 % wet): the owner should see it before it is a default.
  The game boots with every water switch (`game-landing-allwater-B.jpg`).
- Camera places for the falls views: `fallsView(S)` and the scratch `fallcams.mjs` (sea60, sea150, air400, bank, E7, close25,
  pool); the lakes' in the scratch `lshots.sh` (E4, E5, lake 11, ponds); the fjord's in `fjcams.mjs`.
- **THE REVIEW OF 24 NOV (688c2b6).** F: PASS for the falls, three notes, all done (the curtain is W3's; a broken lip;
  few whites near V 0.92, the body milk and pale blue). The coordinator: LAKES SIT IN THE WOOD, the largest about a
  kilometre across: each basin drowns only its deepest core, at most `lakeArea` 0.75 km2 (`_buildLakes`, per node
  `lakeF0`); basin 6 now 0.76 km2 of its 5.6, lake 11 whole with its island (`lakes-cores-AB-E4-E5-L11.jpg`). The sheet in
  ropes with slate gaps painted (not cut out), widening and fraying, a 1.6 m run and a 0.35 m brink at the lip, a spray
  cloud of small pale dabs (`falls-ropes-68m-29m-B1-scratchcurtainfix.jpg`, taken with W3's curtain lines in a scratch
  copy only). The fjord: the wide mouth nearest the landing stays a fall. `c.cap` / `c.swell` by the max rule (runnels).
  RULE from F: do not show the owner the 68 m falls view until W3's curtain lines land.
- **DEFAULTS (the coordinator, 24 Nov, with the owner's leave):** the coordinator ACCEPTED the lake cores and the reworked
  falls. Lakes, ponds, puddles and the fjord become the default on Earth in the oil look with E's rivers flip; `?x=0` opts
  out. W2's side is landed (221040b): a part is built only on a world whose look asks for it (`oil.lakeK`, `oil.fjords`,
  `oil.ponds`, `oil.puddles`); with every switch on only Earth changes (test). The flip itself is E's, in data/mode.js
  (exact lines sent: `n('lakes', 1)` etc., falls staying `n('falls', 0)`). THE FALLS FLIP (`n('falls', 1)`) IS HELD until
  W3's curtain lines land and F has seen the falls without the curtain.
- **F's second look: PASS** (688c2b6); its one note (smaller, fewer spray dabs near the eye) done in 55293a2.
- **MOUNTAIN TARNS (67dd740, ?mount=1 with the lakes; the coordinator's next job):** `_buildTarns` finds the hollows of
  mountain.js `alpineMacro` (E's, imported read only) where 15+ nodes drain in by steepest descent, 350 m apart, below the
  snow; round each it floods the REAL ground on 13 x 13 points 18 m apart, stopping before a spill, 0.038 km2 or 7 m. Mask:
  1 basin, 2 the ring beside it (water where the ground is under the level: the shore is the land's contour), 3 the rim
  (raised to level + 0.15 where it dips). `hydro.alpine(S, c, h)` is the hook; it is called ONLY once E lands one line in
  mountain.js prepareMountain (asked 11:15; the exact line is in my message to E; my test wraps the hook itself). 24 tarns
  on Earth, 41-55 ms at load. Seen (with the line in a scratch copy only): `tarns-AB-floor-150m-400m-scratchhook.jpg`.
- **E's DEFAULT FLIP is in (4873c6a, merged):** with ?look=oil, rivers=tree, lakes, ponds, puddles and fjord default on
  (?rivers=old, ?lakes=0 ... to opt out); falls stays off. E commits the held falls flip when W2 sends the word.
- **E's mountain line is in (597ab63, merged 4fdf9bf):** prepareMountain's alpine hook now calls `hydro.alpine`, so the
  tarns need no scratch copy any more. SEEN with the real hook, in the gallery (`?look=oil&flow=1&mount=1`, 24 tarns
  reported by the page, no console problems): `tarns-real-hook.jpg` (valley floor 1.7 m, 150 m, 400 m; the same views as
  the scratch A/B, and they match it). The shore is crisp against meadow and trees, the water flat and level, nothing on a
  slope. Not good yet, said plainly: at 150 m the surface reads as long grey-blue bands (the shared still-water strokes, as
  on the lakes), more like ribbed metal than a still tarn; for F to judge. Not yet looked at in the game itself (only the
  gallery, which uses the same surface code).
- **F on the tarns: PASS** to keep behind the switch (shores crisp at all three distances; no change to the tarn code). The ribbed
  bands are the shared still-water strokes: F and the coordinator have given them to water-paint (step 3), the tarns as a test
  case.
- **IN THE GAME (not only the gallery):** `/?body=earth&look=oil&mount=1&card=0&time=15.4&quality=1` booted in the lab in about
  4 minutes; the page reports 24 tarns, lakes on, no errors. The explorer placed 7 m from the south shore of the tarn at
  [-0.014061, 0.899892, 0.435885] (shore found 42 to 45 m south of its middle), facing north: `tarn-in-game-shore.jpg`. SEEN:
  the water lies at the back of the meadow where it should, the shore crisp against the grass; the strokes on it are choppy,
  the same shared still-water strokes as above. (c.swell, which the tarn sets to 0.4, is how far water rises after rain,
  not waves.)
- **PUDDLES BESIDE A WIDE RIVER (110b43e, for E's landing river 784184b, which made the puddle test read 7.73 %):** on a
  river's flat floor a hollow must be deeper (capFloor 0.12 m times (1 - rise) squared) and none lies within capBank 4 to 10 m
  of the water's edge. Measured in 288 m squares beside Earth's six widest rivers (half width 13 m): 5 to 9 % of the dry
  ground before, 1.0 to 2.7 % now; round the landing 3.3 to 1.2 %; the wood's uplands unchanged. The test holds the widest
  river's square under 4 % too. NOT run on top of E's commit by me (E runs it after the merge). E's own suggestion, no puddle
  within 30 m of any stream, was measured by E and works, but would take most of the wood's puddles (the streams are dense).
- **E's LANDING RIVER (c229268, in design-water 01ec60c with 110b43e; merged here d5b4437, suites 325 / 96 / 416):** round
  the landing puddles on 1.39 % of the dry ground (7.73 % with the old rule); hydro, falls and tarns 18 of 18. Of the nine
  falls eight are the same; the main one is 26.0 m wide (was 25.6), its lip 0.2 m over, the same 19.5 m drop: the landing's
  river now carries more water to it. The 22 mouths are the same, so is the fjord's choice; ponds 84 to 85.
- **THE FALLS WITHOUT THE CURTAIN (W3's fix, water-paint 7889acf, merged in a SCRATCH copy only with design-water):** SEEN
  at phone settings, 68 m from the sea, 150 m, 400 m: `falls-nocurtain-68m-150m-400m-P1.jpg`, and the fall at 150 m before
  and after: `falls-curtain-before-after-150m.jpg`. The blue strips beside the sheet are gone; the sheet meets the cliff
  faces. Not mine but seen: the sheet reads paler and greyer than at F's PASS (its milk takes the water's wash, which W3's
  new colour changed); asked F whether to raise the whites (fallmat.js, mine). Sent to F; when F passes, the falls line to E.
  (The scratch merge of design-water and water-paint conflicts in data/mode.js and data/looks/earth.js, two lines each:
  water-paint's wpaint default 1 against E's switches test, and earth.js oil needs E's keys and W3's airTop; told the
  coordinator.)
- **F: the curtain-free falls PASS.** THE FALLS FLIP SENT TO E: `W.falls = n('falls', d)` in data/mode.js waterFromSearch (the
  oil look's default like the lakes; `?falls=0` opts out), with the dependency said plainly: the curtain fix is on
  water-paint, so the flip ships with or after water-paint 7889acf, never on design-water alone. The top tier seen too:
  `falls-nocurtain-68m-150m-400m-T2.jpg` (no curtain).
- **THE FALL'S OWN WATER (ef3e182, F's note):** the sheet, the pool's milk and the spray no longer take the river's wash (W3's
  deeper blue made the sheet grey and flat): FALL_CHUNK's FALL_WHITE / FALL_MILK / FALL_PALE, a few whites mostly on the
  ropes, the milk body, the pale blue under it; only the lip's glass and the outflow keep the river's colour. SEEN at phone
  settings (scratch copy): lit whites V 0.91, the body's median 0.88 (0.87 before) with clear steps. F's literal numbers
  (milk 0.75 0.80 0.83) tried: the body went grey, median 0.83; both in `falls-ownmilk-ABC.jpg`; F to choose (three numbers).
- **F: the fall's own water PASS** (the committed, lighter set; F's literal numbers read grey). Nothing more on the falls until
  W3's sea fix lands.
- **THE SEA'S CHECKER FROM THE AIR (F's note 3, given to W2 by the coordinator; branch `water-sea`, 9525b16, cut from
  water-paint 46b7657; W3 told the lines; W3 owns waterchunk.js, untouched):** cause: at ?wpaint=1 still water kept v37's
  three steps in near equal shares (one very deep) on short square-ended strokes; off Earth's coast the crests run toward the
  coast, so from offshore the strokes foreshorten into squares, and two cells' and two octaves' overlaps read as a checker.
  Fix in render/materials.js only (two places in PC_WPAINT): still water's strokes 10 long, kept long on the screen (up to 3x
  against the foreshortening); far still water at wpaint 1 fewer light and deep strokes in closer steps. SEEN 150 m, 400 m,
  1 km at phone settings (`sea-air-150m-400m-1km-wpaint0-wpaint1-fix.jpg` on water-sea): no checker, spread 0.26 at 150 m
  (0.40 before). ?wpaint=0 unchanged (0 to 2 pixels of 518400 by at most 2 of 255). NOT GOOD YET: where the crests run
  toward the eye the near sea reads as long streaks, not v37's swell; option rendered (far still water across the view; turns
  with the camera, a seam between near and far): F to choose.
- **F on the sea (13:00):** the checker PASSES (keep the spread 0.26); across-the-view REFUSED (it would swim); the body a
  step deeper: done on water-sea 079fcf3 (median 0.66 / 0.66 / 0.65 at 150 m / 400 m / 1 km, spread 0.26 at 150 m). The
  crests' direction checked in the page: the strokes are along the crests; the crests run toward this coast because the wind
  does (gallery ?physics=1: uPhysWaterDir -0.996, 0.091; the sea map off, uPhysSeaGrid.w 0); in the game physics' warp, which
  turns crests toward a shore, covers 17 x 16 m round the player only. Turning them along the coast within ~300 m of land
  needs a shore direction per sea vertex from the mesher (patchgen, a new two-byte attribute in terrain.js, read in
  WATER_FRAG): asked the coordinator who does it.
- design-water a877068 (the falls flip, with water-paint and its curtain fix) merged here (1dbc5ee); E's one line in
  hydro.test kept (every part switched off for 'no part asked for'). Suites 325 / 107 / 445.
- **THE SEA'S SHORE AND CHOP (the coordinator gave it to W2, F's design; branch `water-sea`, da7baa7, a merge of W3's
  water-paint 05bfe0a; all behind ?wsea=1, the default sea v37):** world/shore.js (new, with shore.test.mjs): the way toward
  land times its nearness (by the share of rings at 120 / 250 / 450 m on land) and the narrowest crossing (land each side,
  read to 700 m), on a 160 m lattice of the cube faces, measured once a node, read bilinearly from the nodes that ARE sea.
  patchgen (only with ?wsea >= 1, sea found by W3's aTurb.z byte) hands it to the water mesh as aShore, four bytes, bound in
  terrain.js; no ground-sample slot. WATER_FRAG: the wind's waves turned toward land by the nearness (left alone when they run
  out to sea), the strokes along the turned crests; the fetch (the crossing over how squarely the wind crosses it) under
  900 m (fully 300 m) makes the strokes short chop, 3.5 widths, fewer light ones. The deeper far body (079fcf3) is the sea's
  only (vOpen), so ponds and lakes keep water-paint's values. SEEN at phone settings with ?physics=1
  (`sea-shore-chop-strait150-strait400-coast150-coast400-v37-off-on.jpg` on water-sea): the falls strait short broken chop;
  facing a coast with the wind along it the strokes bend along the coast. PROVEN: the default against water-paint 05bfe0a's
  own files, at most 74 of 518400 pixels by 6 of 255. Cost: a sea node 0.1 ms in the browser, about 2,800 over three views,
  once a world. NOT RIGHT YET: end-on up the strait the chop still lines up toward the horizon; the bent strokes may read as
  current lines round headlands. With F. Slots: W3 go ahead, C agreed, B no reply. (Commit 521202e said "agreed" before the
  replies came: left as it is.) Heads-up passed on: water-paint's runoff slots 24-25 against C's snow at 24 in v39.2.
- C (far view) paints the coast's wall (?rockfield=1); agreed: no geometry change within 30 m of any fall, and C runs
  hydro.test and falls.test on its merge.
- **F on da7baa7: NOT YET** (keep ?wsea off): (a) the radial line-up read as planks; (b) the shore's curl as current lines
  and whirlpools; also the new sea flatter in value than v37 (sparkle) and cool under a gold sky (shared with F). Done on
  water-sea 9ec9b3a: (a) the sea's crest turned toward the eye's sideways axis by how grazing the eye looks (smoothstep
  0.35 .. 0.85 of 1 - |forward . up|), from the EYE'S forward, one value a frame (per pixel it sheared every cell's rows);
  so at a grazing look the strokes turn as the eye turns -- told F plainly, only the owner's device can judge it moving;
  chop 3 widths. (b) the turn at most 35 degrees, within ~120 m of land (near 1 / 0.3 / 0 / 0), none from stacks (share
  0.2 .. 0.5). The sea-only lines where vOpen >= 0.75 (wpL always the sea there). SEEN: the strait's chop across the view,
  the coast in level bands (`sea-foreshortened-...-v37-before-now.jpg`, `sea-strait150-crop-v37-before-now.jpg` on
  water-sea). PROVEN: default against water-paint 05bfe0a's files, at most 28 of 518400 pixels by 2 of 255.
- NEXT: F's word on 9ec9b3a; then the sea's sparkle (sparse light strokes toward the sun, a few dark troughs) if F wants
  it; after the branches meet (the coordinator's call): the pool's pcThinLayer to W3's
  pcWStrokes, pcFallMilk and the FALL_ colours into waterchunk.js.
- Camera places for the falls views: `fallsView(S)` and the scratch `fallcams.mjs` (sea60, sea150, air400, bank, E7).

## Stations and tools

The stations E0..E12 are in the design's appendix B; the camera helper for the gallery in appendix A (`window.__off`,
`window.__goto`, put into the page with `tools/lab.mjs eval`). On this machine the gallery loads in about 30 s and a frame
takes 5 to 30 s.
