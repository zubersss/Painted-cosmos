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
  6. `sample`: `c.still = c.bank = c.cap = c.swell = 0` beside `c.fu = 0; c.fv = 0;`, and `o.still = c.still; ...` beside
     `o.fu = c.fu; o.fv = c.fv;` (written EVERY time: the v37 rule).
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

### W1 RIVERS (built 24 Nov, this session; behind ?rivers=tree)

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
  2.29 us (today's rivers, same run), the river part 0.55 us; build 100 ms cold (63 warm) + drainage 57-75 ms. Game: landing
  view water 6.8 % (was 0.0), bank view 20.9 % (the search finds the new brook at 8 m).
- PHONE COST, DERIVED (14 ns a water pixel, 32 ns a ground pixel, design section 2): landing view +0.33 ms of water (23,540 px;
  range 0.19-0.66), which replaces 0.75 ms of ground if the phone skips hidden ground; bank view 1.0 ms (today's 0.9). Script:
  patch building a third cheaper. Load about 0.4 s on the phone (assumed 2.5x this machine). Bench: there is no runtime
  switch for the rivers (the ground is built from them), so the phone compares TWO RUNS, with and without ?rivers=tree: the
  as-set rows and the bank and shore views' no-water rows.
- Stills: `docs/shots/painter/water-w1/` (A today | B tree, at the bank, 150 m over the landing, 150 m over the new main river,
  1 km, the coast; the tree maps; the game's landing and bank views).
- NOT DONE (said plainly): the drop to the sea at each mouth (W2's mouth cut and fall: the wood stands at least 12 m over the
  sea everywhere on Earth); grey from the air (W3); basins flood only along channels (W2's lake beds); the build is 10-25 ms
  over the design's 150 ms here.
- NEXT for W1, if the review asks: stronger meanders on the big rivers (references: long S-bends); the main river by the
  landing is now a brook (a spring with a larger catchment would bring a wider one past it: one number in Earth's look).

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
- **ASKED OF LANE 0 (24 Nov, waiting):** two lines in surface.js sample() so a water part can set its own churn and speed
  (`c.turbW`, `c.fspdW`): without them the cut and a pond take the drainage field's slope across the coast blend and paint
  WHITE all along (turb 0.26-0.47 measured in the cut). hydro.js already sets both.
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
- **OPEN ASKS (sent to the coordinator):** lane 0's `c.turbW`/`c.fspdW` in sample() (else the cut paints white); W3's
  mesher must skip a water cell whose corners' levels differ by more than 2 m and half the cell (else a flat blue
  curtain stands behind every fall); bench.js's falls view; C: the berm's ruled, striped wall and the cut's banks in leaf
  paint (o.bank is written for whoever paints it).
- Camera places for the falls views: `fallsView(S)` and the scratch `fallcams.mjs` (sea60, sea150, air400, bank, E7).
- NEXT: lake stills at E4/E5 (A/B), ponds from 150 m, the fjord; then what the review asks.

## Stations and tools

The stations E0..E12 are in the design's appendix B; the camera helper for the gallery in appendix A (`window.__off`,
`window.__goto`, put into the page with `tools/lab.mjs eval`). On this machine the gallery loads in about 30 s and a frame
takes 5 to 30 s.
