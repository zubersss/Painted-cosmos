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

**STATE (24 Nov, 18:45), the short of it.** THE WATER IS LIVE in v39.3 (look-proto 87053ed; merged here 48f1809). Before that, v39.2 shipped WITHOUT the water (the coordinator pulled it at its gate for two
faults, both now answered); the water goes into v39.3 with the weather. design-water HEAD 792d1f1 = v39.2 (look-proto c7d8d9e)
merged in (df7c3ba: the ground sample 25 floats, the water's still at 23, the far view's snow at 24; W3's runoff cap and swell
to take 25, 26; THE LAYOUT FOR THE WATER LANES IS THIS SESSION'S, the coordinator's word) plus:
- THE FIRST VIEW (05aa102): keep r 3 and Earth's oil.face [100, -6.9] (surface.js getSpawn reads a look's oil.face for the
  landing it already picks): in the game, the river beside the explorer into the distance, the ship on the left, 8.5 % water
  plus 2.8 % churn against v39.1's 6.4 % (first-view-3.jpg).
- FROM THE AIR (792d1f1, "THE WATER FROM THE AIR" below): the old high frame has little water because the rivers run
  elsewhere; the added gate frame at the landing's river (cam=high&yaw=145.6&pitch=-13.4) shows it and a lake; 150 m and
  400 m read; at 1 km the 19 m river is lost in the far ground itself. v39.3 TOOK 792d1f1 (the water ships with the weather).
- THE FAR WATER LINE (a1f12fd, then e01eea8 the lake's own colour by the angle; C agreed; F PASSED 18:22): DEFAULT in the oil
  look (?farwater=0 opts out); waiting for the coordinator's next batch. The ground-sample layout is now CS 30 (27-29 the line's).
- Earlier today, all on this branch: W1 rivers with S-bends and point bars (the trees stand back from the bars, F passed);
  mountain streams behind ?mount=1 (F: the white water is W3's paint, queued); THE DEFAULT FLIP in the oil look (rivers of the
  tree, lakes, ponds, puddles, fjord, falls on; ?wpaint 0); the speed test's falls view, ?bench=water; the landing's river
  (oil.springs, oil.keep, the save's nudge); RUNOFF behind ?runoff=1 (the hydrograph on the weather's clock, streams falling
  within the hour; runnels 1-2 m, F passed; c.capOnly for C's dry bed; still OFF until W3's muddy colour and C's dry bed).
- ORDER (the coordinator): W3 splits rivers and ponds from the sea (done, 05bfe0a on water-paint), E-W2 and W3 fix the sea,
  then the mountain streams (W3's white water; nothing of this session's blocks them).
OPEN: F's sand-bar colour (C, after the cliff); the runnel's mud colour (W3); the far water line (asked). The lead's sessions:
coordinator session_01R5Bri1TV3HBTyuxNZZuhNw, F session_01R5Brhzz2JPPF6Ecz6XRQHx, E-W2 session_01R5Bri2xowNiwS1SnP3VG3f,
E-W3/W4 session_01R5Bri2fSASVVvyrSG11UGF, C session_01R5Bri2AMBsFiRcxvUUZMvu, A1 (far trees) session_01R5Bri1GA9riShvfh4TrjW4,
D (weather) session_01R5Bri2bBgFSfCmxpKKuURT (src/physics/index.js is now the water's).

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
  numbers, all on THE WORLD'S CLOCK (an hour of weather is a game minute, WEATHER.timeScale 60; mended 24 Nov, see the A/B
  below): runnels run at about 1 mm in ten minutes, up in 60 s, down in 300 s; streams from the last half hour's rain and
  0.15 of the three hours' before it, 63 % of 0.4 m for 6 mm, up in 300 s, down in 1,200 s; mud 0.7 of the rise. The rain
  field is asked over 10, 30 and 180 GAME seconds (the world's 10 min, 30 min, 3 h).
- `src/world/waterhooks.js`: loads waterstate.js when `?runoff=1`; the frame's ctx now carries `physics` (world/index.js
  passes it).
- THE PAINT'S SIDE (E-W3/W4): `depthNow = vDepth - (1 - WATERSTATE.wet) * cap`, discard where none is left; the water lifted
  by `WATERSTATE.rise * swell`; a swollen river browner by `mud`. Until that lands ?runoff=1 shows only the longer, denser
  twigs, all the time.
- SEEN (a Node map of the surface, not the renderer): `docs/shots/painter/water-runoff/map-runoff-storm-dry-3km.jpg`, the
  runnels (cyan) running at full wet and gone in the dry.
- Test: `src/world/runoff.test.mjs` (the switch; the hydrograph's timings; the part reading the rain field when there is
  one, the wetness when not, not every frame; the data: runnels carry cap, rivers swell, the landing dry).
- THE A/B IN A STORM AND AFTER (24 Nov, 13:10-13:25, this session; W3's paint d18ca49 merged onto 7f3ad70 in a SCRATCH
  worktree only, nothing of it pushed here). Gallery, oil, quality 1, 936x372, `?rivers=tree`, A `runoff=0`, B `runoff=1`.
  WATERSTATE was PINNED to the hydrograph's own output (stepRunoff, 1 s steps, a storm of 30 mm/h for 20 min, then dry),
  not timed live: STORM = minute 15 (wet 0.97, rise 0.089 m, mud 0.155) under `&wx=rain`; AFTER = minute 60 (wet 0.26,
  rise 0.157 m, mud 0.275) under `&wx=after`. Stills `docs/shots/painter/water-runoff/`: `ab-near.jpg` (eye 2.5 m, 9 m from
  the runnel 40 m north of the landing), `ab-150m.jpg`, `after-150m-crop-ab.jpg`, `near-dry-vs-storm.jpg` (the same frame,
  state pinned dry vs storm). SEEN: in the storm the runnel runs full (a stream about 4 m wide in its gully); an hour after,
  a thin ribbon down its middle; pinned dry, the gully bare. Without the switch that runnel is not there at all (the ground
  is not carved). Within 300 m of the landing: 1,064 wet cells (3 m) without, 1,163 with, 139 of them water only in the wet
  (and 40 heads of small streams become wet-only). From 150 m the runnels are under the trees; the river: same water area
  in the storm (17,087 vs 16,881 water-blue pixels), a hint warmer; an hour after it reads GREYER, not brown (mud 0.28).
  PROBLEMS FOUND: (1) THE DRY GULLY KEEPS A RIVER BED'S BLUE: its sample's second colour is (0.45, 0.63, 0.84), the bed's
  colour under water, so the dry runnel reads as a ghost of painted water (`near-dry-vs-storm.jpg`, top). Where all the
  water is cap water (cap >= depth) the bed wants the dry bed's colours: C's recipe, asked. (2) THE STREAMS STAYED UP FOR
  THREE HOURS: the rise's target came from the rain of the last 3 h, so after a 20 min storm it held until the rain left
  that window, then fell over 30 min. FIXED (the coordinator, 13:27): the target is now the last half hour's rain and 0.15
  of the older (quick and slow flow). AND A WORSE FAULT FOUND IN FIXING IT: the hydrograph ran on GAME seconds while the
  weather runs 60 times faster (the game's day is 25 min; physics/weather.js WEATHER.timeScale; cloudfield.js rainBetween
  lays a game second of 6 mm/h as 0.1 mm), so its "last half hour" was 30 hours of weather. Now every time in it is the
  world's: a frame's game seconds times RUNOFF.clock (60, held equal to WEATHER.timeScale by the test), the rain field asked
  over 10, 30 and 180 game seconds (also far cheaper: 2, 6 and 36 quadrature steps, where the old 10,800 s window took
  2,160). A storm of 30 mm/h for 20 min, the hydrograph's own output (runoff.test.mjs asserts it): runnels 0.6 at 3 min,
  full at 10, 0.10 twenty minutes after the storm; streams peak 0.32 m eleven minutes after it, 0.13 an hour after it,
  0.09 at 3 h, 0.003 at 4 h 20; a 20 mm soaking over 3 h still gives 0.25 m as before. In the game: runnels within seconds
  of a heavy shower and gone about twenty seconds after it; streams falling over the next minute or so. Also mended: the
  rate at the eye is fields.rain.now (it read the per-texel array). The A/B stills were taken with the state pinned, so
  they stand.
- AFTER F'S REVIEW (13:27: keep it OFF; three things before it is shown): (a) WIDTH, done here: a runnel's bed and water are
  `RIVER_DEF.runnel` = 2 times narrower than the twig it replaces, its banks as steep (only under ?runoff=1). MEASURED
  (rain-only water, 8-direction transects at 120-400 runnel points within 1.5 km of the landing): wet width p10 2.0, p50
  3.0, p90 3.5 m before; p10 1.2, p50 1.9, p90 2.2 after. The few wider (to 6.7 m) are rain-only water in a small lake
  basin and the head of a small stream, not runnels. SEEN: `runnel-narrow-ab.jpg` (the storm and an hour after, before |
  after; trees now stand nearer the narrower runnel). (b) THE DRY BED: C asked for a flag; written in surface.js `_forest`
  (rivers.js cannot know the bed, the recipe makes it): `c.capOnly` 1 where ALL the water is rain-only (cap >= lq - h),
  reset every sample; C gives such a bed the dry bed's colours after the coast cliff. Measured: 255 of 317 runnel points;
  the rest are hollows a runnel crosses, deeper than its cap, which keep a pool in the dry (natural). Of all the cap water
  in the wood, 429 of 557 points are also wet without runoff: the heads of small streams, which by design keep part of
  their water in the dry. KNOWN, small, not fixed: where a runnel's mouth meets a river, the river's shallow margin within
  the runnel's own zone loses up to 0.6 m in the dry (a notch a runnel wide). (c) COLOUR, muddy storm water: W3's paint
  (`WATER_FRAG` PC_RUNOFF's mud line), driven by RUNOFF.mudK; F's target hue 35-40, S 0.30-0.40, V 0.45-0.55 in the storm
  light, the churned edge a step lighter, not white. Tests: runoff.test.mjs (runnels 1-2 m, capOnly exactly where the cap
  holds all the water). (3) The swollen river's brown is too weak to
  read from 150 m (F's call). For W3: after v39.2 C's snow takes patchgen slot 24, where water-paint packs the runoff's cap
  (24, 25): they move to 25, 26 on water-paint's merge.

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

- THE OWNER'S FIRST VIEW IN THE GAME (24 Nov 14:00-14:47; the coordinator held v39.2 on it). The gallery's cam=trees lost
  the river, so the GAME page was opened on a fresh start (/?look=oil&fresh=1&save=0, 1280x720, the camera as the game
  places it). v39.1 (main 038b885): the stream beside the explorer on the left, 6.4 % of the frame water. The v39.2 candidate
  (2d40220): the river behind the ship on the right, 1.8 %: LESS, against the coordinator's ruling. Why: the game faces the
  camera toward the ship, which it parks on the flattest dry ground 16 m off (sim.js spawnOn), and keep r 12 had moved the
  river and so the ship. FIX (earth.js oil + one optional field in surface.js getSpawn): `keep` r 3 (the water 6.5 m from
  the landing, still dry) and `oil.face: [100, -6.9]`, the first view's yaw and pitch at the landing the world already
  chooses (same spot, same ground, no pad; only with MODE.oil; the watercolour game's spawn has no yaw: 0 of 1,568,000
  values differ). The facing was chosen by counting the water in the camera's view at every facing for keep 12, 8, 5, 3
  and 2 (a ray count from 5 m behind the explorer, +-44 degrees): 46 at keep 3 and yaw 100, about 41 for v39.1, 22 for the
  candidate; the ship's likely berth stays in frame on the left. SEEN in the game: `first-view-fix-game.jpg` (the river from
  beside the explorer into the distance on the right, a riffle, the ship on the left, a meadow of yellow flowers): 8.5 %
  water-blue and 2.8 % white churn, against 6.4 % for v39.1; the three side by side `first-view-3.jpg`.

### THE CONFLUENCE BY THE LANDING (24 Nov 19:20-19:55; the coordinator's PRIORITY, live in v39.3)

Another lane's still from 10 m up at the landing (design-flora 8aa970d, a7-aw10-before-after-v39.3-merge.jpg) showed zig-zag
staircase seams and straight polygon lines across the water and a broad white band. CAUSE (measured; mine, not the paint): the
landing's river and a tributary meet just south of the landing, and each point took the level and the current of its NEAREST
segment, which switches along a line between the two: the water stepped 0.35 to 0.45 m within half a metre there (22.65 against
22.30) and the current flipped by more than 60 degrees at 17 points of a 60 x 40 m map. The mesh drew the step as a staircase;
patchgen's churn read the fall as white water. FIX (rivers.js RIVER_DEF.blend = 8 m, `_blend`): in a river and on its banks
(its half width and 3 blend) the level and the current are blended over the segments within 3 blend of the nearest, weighted
exp(-extra / blend). MEASURED there: the largest level step 3 cm a metre (under the churn's 3.5 %), no step over 5 cm, the
current's jumps 17 to 2; over a 6 km box random water pairs 1 m apart are unchanged elsewhere (13 steps over 5 cm, before and
after: they are not confluences). The sample costs about 9 % more near the landing (1.57 to 1.71 us). SEEN
(`docs/shots/painter/water-default/confluence-step-before-after.jpg`, B's view and near the first view): the white band, the
staircase and the straight lines GONE; HONEST: the strokes now follow a current that curves through the confluence, so they
swirl and marble there, and a faint line of fine hatching remains along where the seam was: for the look director.
- F (19:52): keep the level blend; the swirl NOT acceptable (marbled paper). MADE (14772ce): the current blended over 1.5 m only
  (RIVER_DEF.blendDir), the level still over 8 m (the step stays gone: 3 cm a metre at most). SEEN (`confluence-current-short-
  turn.jpg`: v39.3 | both over 8 m | current over 1.5 m, B's view and near the first view): the tributary's strokes long and
  nearly straight again to where the rivers meet; some curved banding and fine hatching remain on the main river by the meeting,
  as v39.3's own frame shows on that bending reach. CAUSE of that (read in WATER_FRAG, v37's strokes, the default): a current
  turns the stroke chart at each pixel about the middle of a 26 m cell, so where a river bends a point 13 m from the middle
  shifts metres for a few degrees and the strokes bunch: ONE DIRECTION PER STROKE needs the paint (W3's), asked.
- F PASSED it (20:07): ship it as the live fault's fix (14772ce). TO CHECK LATER: when W3's new river paint (one direction per
  stroke, its own chart) becomes the default (planned v39.6), look again at this same view: the banding on bending reaches
  should go with it.

### THE WATER FROM THE AIR (24 Nov 14:50-16:15, this session; the coordinator held the water out of v39.2 for it)

The gate's high frame (gallery cam=high at the landing, 420 m up, looking north-north-east and down 29 degrees, 936x372)
showed NO water with the water branch (`docs/shots/painter/water-air/gate-high-as-it-was-no-water.jpg`; ?canopy=0 the same).
- THE MAIN CAUSE IS WHERE THE WATER IS, not a layer: over the ground in that frame (280 m to the horizon) the surface itself is
  water at 14.0 % in v39.1 (the old oil rivers' dense net of wide channels and pools) and 0.31 % here. Round the landing there
  is as much water or more (within 1 km 8.2 % against 7.7 %, 3 km 14.5 % against 11.3 %, 6 km 21.2 % against 15.8 %, with the
  lakes): the rivers of the tree run elsewhere, the landing's south of the landing. RULING (the coordinator): keep the old
  frame and ADD one at the landing's river; no denser rivers for a frame. THE ADDED FRAME: gallery.html?body=earth&biome=
  autumn_woodland&time=15.4&cam=high&yaw=145.6&pitch=-13.4&t=0&ui=0&quality=1&look=oil (cam=high's place, facing south, 42
  degrees down). SEEN: `gate-high-at-the-river.jpg`, the landing's river winding into a big lake.
- THE FAR TREES: every impostor is one of placeTrees' trees, none in water (A1 checked). SEEN over the landing's river,
  impostors against ?fartree=old (`impostors-vs-oldfar-150-400-1km.jpg`): 150 m reads either way; 400 m reads, thinner with
  the impostors; 1 km the river is hidden (the lake reads). Tried: the wood standing back from a big river's water's edge
  (full from 6 m, then from 12 m): no gain at 1 km (`bank-trees-tried-400-1km.jpg`), so NOT KEPT (the picture is the last
  commit's to the sample: 0 of 60,000 differ). c.bankD (metres past a river's edge) stays written in rivers.js, unread.
- AT 1 KM THE RIVER IS LOST IN THE GROUND ITSELF: with no trees and no painted canopy (`1km-bare-ground-no-trees-no-canopy.jpg`)
  it is a faint broken line; a 19 m river falls between the far ground's vertices and under its brush. The fix proposed (not
  built): pack the signed distance to the water's edge at each vertex (patchgen, the layout is this session's) and let the
  far ground's paint (C's farground.js) draw a river-coloured line where the interpolated distance crosses zero: a line that
  survives any vertex spacing. W3's notes already name "the far water byte for C".
- WHY 1 KM LOST IT, exactly: patchgen drops a patch's water when it covers under 8 % of the patch below level 5 ("thin water is
  left to the terrain's far colour"), and the far colour's own widening (surface.js, S.foot) makes a river as wide as the
  samples lie apart, at part strength: a faint broken band 50 to 100 m wide.
- BUILT, ?farwater=1 (the coordinator, 16:14: after v39.3 took 792d1f1; C agreed, 16:22), off by default, the oil look only:
  rivers.js writes c.rsd (the signed distance to the nearest river's centre line, its sign the segment's side) and c.rhw (that
  river's half width), every call; surface.js hands them out as o.rsd, o.rhw while the rivers are attached (the context reset
  each sample). patchgen.js: THE LAYOUT, CS 30: 23 still, 24 snow, 25 and 26 W3's runoff (reserved), 27 the signed distance,
  28 its size, 29 the half width; packed only with the switch into aFarW (+ aFarWP for the morph: x 0.5 + sd / 96 m, y size
  over 48 m, z half width over 24 m); terrain.js binds them. render/farground.js (at C's place: FARWATER_VERT_DECL / _MAIN /
  _FRAG, inside #ifdef PC_FARWATER): pcFarWaterLay lays the river over the ground's finished paint at each pixel, as wide as
  the interpolated distance says, in water's tone from above (the haze with 0.3 white, as the water's own paint takes the
  sky), only past 250 m (fading in to 500 m), and only where the size says a river is near both vertices (two rivers'
  distances of opposite sign would cross zero between them). materials.js: the includes and one line before the haze.
  TRIED AND NOT KEPT (C's first wish): the water's wash in the dabs at their centres and between them, with crowns and fallen
  leaves gated off a river dab: from 1 km the river is about 7 px, narrower than a dab, and lost again
  (`farwater-in-dabs-tried-1km.jpg`). SEEN (`farwater-ab-400-1km-1600.jpg`, same frames A | B): 400 m unchanged (the water's
  own mesh holds the river there); 1 km the landing's river a continuous line from near the eye into the lake, and two other
  rivers; 1.6 km the rivers winding lines. HONEST: the line is a plain pale stroke, lighter than the lake's painted water and
  without its strokes: the look director's call. Test: src/world/farwater.test.mjs (nothing packed without the switch; with
  it, coarse patches over the landing carry vertices inside the river, and they are wet). Switches off: 0 of 1,688,000 values
  differ, both looks; the ground's program is compiled without any of it.
- F's REVIEW (17:33): keep it, the right fix. Changes asked and MADE: (1) the lake's own hue, a step darker than the land (its
  value set to 0.70 of the paint it lies on; the hue the sky's tone pulled halfway to the lakes' blue, since the air greys it:
  the sky's tone alone at 0.82 read grey-green and was lost in the wood, SEEN 17:45); (2) a crisp edge (about a pixel) and the
  width breathing (the packed half width now the river's with its pools, and +-18 % along it over about 100 m); (3) near the
  eye it narrows to nothing from 500 m to 250 m, no cross-fade. SEEN (`farwater-F-notes-1km-1600.jpg`, before | after): 1 km a
  continuous darker blue-grey line into the lake; 1.6 km FAINT in the haze (value 0.59 against the land's 0.74 at 1 km, the
  air greying it to saturation 0.07), where the pale line read more. Asked F to choose the value for the far end.
- F's SECOND WORD (17:58): darker loses it; water far off MIRRORS THE SKY. Made: the line is the lake's own colour by the angle,
  the water's own paint's sky (v37's WATER_FRAG: horizon to zenith along the reflected ray, three tenths of white, the liquid's
  wash and the mirror's share; terrain.js binds the sky's uSkyZenith and uSkyHorizon with the switch), a step deeper and bluer
  as the lake's strokes average, and looking nearly straight down the water's body (darker than the land). MEASURED in the
  same frames (the purest line pixels against the lake's water): 1 km line hue 208 S 0.20 V 0.75, lake 206 0.17 0.71; 1.6 km
  line 210 0.17 0.72, lake 222 0.15 0.72. SEEN (`farwater-lake-colour-1km-1600.jpg`, darker | the lake's colour): 1 km a blue
  line into the lake in the lake's own colour; 1.6 km subtler, a winding line of the same blue. Not yet: the gold toward a low sun.
- F PASSED it (18:22): "right on"; DEFAULT in the oil look since then (mode.js W.farwater = n('farwater', d); ?farwater=0 the
  opt-out; the watercolour game off). The gold toward a low sun comes after: take the sky along the reflected ray at a golden
  hour as the water's mirror does (look director cbf7f41's wash and glow in the water's skyc), so line and lake turn together.
  v39.3 (look-proto 87053ed, the water live) merged in (48f1809): C's flower drifts from the air (aBloom, ?bloomfar) beside the
  line's aFarW; with both on 14 of the 16 attributes. Its 3D clouds now cover much of the 1 km views: later A/Bs with &wx=fair.

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
  bar notes). READ NOW (24 Nov, C's yes): surface.js `_forest`, the trees `(1 - max(bar, barZone))`, only when the rivers
  of the tree are attached. MEASURED: 0.18 % of points within 2 km of the landing change their tree density, nothing else
  (height, colour) changes; with the water switches off 0 of 1,568,000 values differ in both looks. SEEN:
  `docs/shots/painter/water-sbends/bars-trees-ab.jpg` (40 m up: at the landing's river the small trees and shrubs that stood
  on the bar are gone; a second bar had none). The bar's colour still reads close to the autumn floor: C's sand (ochre-cream)
  and the bar's under are queued after the coast cliff; pebbles are nearground.js's owner's. Test: rivers.test.mjs.

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
- **F on 9ec9b3a: (a) and (b) ACCEPTED.** FIRST THING TO CHECK IN MOTION ON THE OWNER'S DEVICE (F's order): at a grazing
  look the sea's strokes turn as the eye turns (yaw), because the foreshortening takes the eye's forward for the whole frame.
  If it swims, the fallback is the crests alone (kG = 0 in WATER_FRAG; the strait then reads as planks again).
- **THE SEA'S SPARKLE (water-sea ca13cff; W3's 6fcd2ed merged on top, 25e5cde):** far still sea only (so): whole light
  strokes, more and brighter toward the sun's side (15-22 %, to value 0.88, capped 0.90), whole dark troughs (16 %, to 0.42).
  MEASURED value p5 / p95 / sd: strait 150 m 0.42 / 0.88 / 0.118 (v37 0.151), coast 150 m 0.41 / 0.88 / 0.127 (v37
  0.151); 400 m still short (0.105 and 0.089 against 0.138 and 0.117). The POINTED DASH ENDS are W3's (waterchunk.js, all
  water at the new paint); F's full sheet and the strait crop go when they land. F passes ?wsea for the coordinator's
  default decision only if it then reads at least as well as v37 in all four rows.
- **400 m sparkle (water-sea b053b4b):** the light and dark shares grow 8 points each from 200 to 600 m out; strait / coast
  400 m spread 0.120 / 0.108 (p95 0.85); F: on target. **The sun path in gold (cba04ab, F's note):** the sea's light strokes
  toward the sun take pcOilSunC by the square of the sun's side (a path, not half the sea), cap 0.90. SEEN at 18.3 h facing
  the low sun (`sea-sunpath-1818-white-then-gold.jpg` on water-sea): gold dashes down the strait, where white read as floes.
  F now owns the sky's gold on the water generally (look-director cbf7f41, ?goldsky).
- The lab (tools/lab.mjs serve) hit the machine's two-hour limit twice; later stills come from tools/shot.mjs one-offs with
  the scratch helper and sunview.js (scratch only).
- **LAKE WIDTHS for the paint (5377ec9, W3's ask; F's condition: lakes wider than ~150 m take the sea's level, ponds keep
  the strokes):** _buildLakes keeps each basin's id per node (lakeComp, halo too) and its core's width, the narrow axis of
  the ellipse of the core's area and shape (2 sqrt(A r / pi)); S.hydro.lakeWidthAt(x, y, z) answers it at load (0 where no
  lake: ponds, tarns, puddles). Not a sample field: surface.js untouched. Earth: 13 lakes, 212 to 958 m, 12 over 150 m.
  Suites 325 / 108 / 445 (the commit message says 107: written before the run).
- F accepted the gold sun path; for the full sheet: W3's pointed ends to cure the square slabs; and at golden hour the sea's
  troughs toward violet by pcGold() -- W3 chose option (b), mine, after W3's golden-hour wash change lands.
- NEXT: W3's push (pointed ends, pcWCellC(wL, asp), wLow, gWLens around the pcWStrokes call: merge with care at my aspW /
  lenF / kG lines), the violet troughs, then the full sheet, the strait crop and the 18.3 h sun view to F; after the
  branches meet (the coordinator's call): the pool's pcThinLayer to W3's
  pcWStrokes, pcFallMilk and the FALL_ colours into waterchunk.js.
- Camera places for the falls views: `fallsView(S)` and the scratch `fallcams.mjs` (sea60, sea150, air400, bank, E7).

## Stations and tools

The stations E0..E12 are in the design's appendix B; the camera helper for the gallery in appendix A (`window.__off`,
`window.__goto`, put into the page with `tools/lab.mjs eval`). On this machine the gallery loads in about 30 s and a frame
takes 5 to 30 s.
