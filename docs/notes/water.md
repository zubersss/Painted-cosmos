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
- SEEN (Node maps of the surface, not the renderer): the river south of the landing winds in S-bends with bars inside them;
  tributaries meet it; the contours run through the bars without steps. Stills: see below.
- Test changes (`src/world/rivers.test.mjs`): test 3 skips reaches the edge thinning reached into (`thin`); test 4 takes its
  river inland (a reach ending in a junction, not thinned: at the sea the mouth is W2's, and the widest segment there was a
  river thinning into a meadow).

## Stations and tools

The stations E0..E12 are in the design's appendix B; the camera helper for the gallery in appendix A (`window.__off`,
`window.__goto`, put into the page with `tools/lab.mjs eval`). On this machine the gallery loads in about 30 s and a frame
takes 5 to 30 s.
