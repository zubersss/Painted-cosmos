# THE WEATHER BUILD: hand-over (group D; kept current after every step)

Branch `design-weather` (it becomes the weather branch; **the coordinator merges it, never this session**). The design
is `docs/lead/WEATHER-DESIGN.md`. The coordinator's go of 24 Nov: build **W2 WIND** first, then **W3 STORMS AND RAIN**.
A separate session builds W1 CLOUDS once the look director's sky ceiling (touch T1) has landed. The look director
(group F) does touches T1, T3, T4 and T5.

**If the container restarted: read this file, then `git log --oneline origin/design-weather`, then carry on at
"NEXT".**

## Rules the coordinator set (24 Nov)

- Every step goes behind a switch (`src/physics/wx2.js`; all switches are off by default).
- The three suites stay green: `node --test src/physics/`, `node --test src/world/*.test.mjs src/data/looks/*.test.mjs`,
  and `node --test tests/*.test.mjs`.
- Every step needs A/B stills that I open, a derived phone cost, and its speed-test row.
- Send the A/B stills to the LOOK DIRECTOR (`session_01R5Brhzz2JPPF6Ecz6XRQHx`) for review before a step is called
  done.
- After each step, send a short message to the coordinator (`session_01R5Bri1TV3HBTyuxNZZuhNw`).
- Touch T6, `physics/index.js`, is mine, in the order W2, W3, then the water group. Touch T7, the `rain` and `snow`
  strings of `render/kitmat.js`, is mine for W3. Touch T9, my rows in `core/bench.js`, I add on this branch.
- `stormDays` defaults to my proposal: a storm over the range on 2 days in 3, reaching the wood on 1 in 3. It is one
  number, and the owner judges it.
- The rain field must reconcile with the water group's ask (`origin/design-water`, `docs/lead/WATER-DESIGN.md` 5.6):
  `uRainCells[8]` as `vec4(east, north, radius, rate)` from the focus, plus `uRainNow`, plus `rainAt()`.

## The switches (`src/physics/wx2.js`, read from the address with a guard, as `fauna.js` reads its dials)

| switch | what it does |
| --- | --- |
| `?wx2=1` | everything built so far |
| `?windmap=1` | the planet wind map |
| `?thermal=0` | the map without its thermal winds |
| `?nearmap=1` | the near grid takes its base from the map |
| `?farwind=1` | the far plants read the map |
| `?cloudmap=1` | the cloud and rain map, the rain field for the water group, and the storm-held bench rows |
| `?stormland=1` | storms born from the land (turns on `windmap` and `cloudmap` too) |
| `?rainlook=1` | a downpour reads as one: more of the box's drops drawn, from nearer the eye, each a third longer |
| `?rainshaft=1` | rain shafts under every raining storm 1 to 7 km off (`world/storms.js`; turns on `cloudmap`; oil look only) |
| `?bolts=1` | lightning bolts, cloud to ground (`world/storms.js`; turns on `cloudmap`; oil look only) |
| `?stormswing=0` | with `?stormland`: the land storms as W3.2 laid them (1 to 3 a day, the usual wind aloft); on by default |
| `?clouds3d=1` | (the look director's switch for W1's clouds) also turns on `cloudmap` and `windmap` |

## Done

### W2.1 + W2.2: THE WIND MAP (`src/physics/windmap.js`, `src/physics/wx2.js`, wiring in `src/physics/index.js`, `src/physics/windmap.test.mjs`)

- **The land is read once per world, in slices.** It covers heights (H1 about 400 m, H2 about 1 km), relief, slope,
  valley axis and confinement, passes, water share, heating and moisture. It finds the convection sites.
  - MEASURED on Earth's oil land: 563 ms cold, all at once (24,576 samples). Sliced in the game, at 96 texels a
    frame without a clock, or 2 ms a frame with one.
  - **All 40 sites are on the alpine range.**
- **The wind is refreshed every 2 s, a slice a frame.** It covers the large-scale wind (a 16-a-face lattice), crest
  speed-up and lee shelter (a 16-bearing table of Winstral's Sx at 200, 400, 650 and 950 m, built with the land),
  valley channelling, gap jets, anabatic, katabatic, lake and sea breeze, lift (orographic, thermal with elevated
  heating, convergence), the trigger (lift x the afternoon's heat x moisture), and the aloft wind.
  - MEASURED here, warm: about 2.7 ms a full refresh. At 30 frames a second that is about 0.05 ms a frame here, and
    about 0.14 ms on the phone if it is three times slower (unverified).
- **Published** as `physics.fields.wind`, which is null while the switch is off. The contract is in the comment
  above `get wind()` in `index.js` and in the design's section 9.1.
- **Tests** (9, in `windmap.test.mjs`):
  - the cube mapping equals `world/cubesphere.js`, and the hour equals `core/orbits.js sunHourAt`;
  - the hill is the first site;
  - crest at least 1.3 times the plain, the lee calmer over at least 70 %, lift up the windward slope and down the
    lee;
  - thermal winds go up by day and down by night on at least 90 % of slope texels;
  - the sea lifts nothing and triggers nothing by day;
  - real Earth: at least 60 % of sites on the range (it is 40 of 40); at least 70 % of confined valleys within 20
    degrees of their axis without the sun (87 %); crest at least 1.3 times the plain (1.55 against 1.00); at least
    70 % of sunny slopes lift (79 %);
  - wired: off means null, on means read in slices and ready.
- **Suites:** physics 425 / 425, world 65 / 65, unit 325 / 325.
- **Seen:** two diagnostic pictures of the game's own data (not frames of the game). They are
  `docs/shots/physics/weather-build/W2_windmap_alpine_1500.jpg` and `..._0300.jpg`: the range at 15:00, with air
  rising over its high ground and sinking over the sea, and the trigger on the upper range only; and at 03:00, with
  drainage and no trigger.
  - **Nothing in the game's picture changes at this step.** Nothing draws from the map until the near grid, the far
    plants and the clouds read it.
- **Phone cost:** script only, about 0.14 ms a frame with the switch on (derived as above). The speed-test row
  `weather: wind and cloud maps frozen` comes with W2.3/W2.4.

### W2.3 + W2.4: THE NEAR GRID AND THE FAR PLANTS (`src/physics/air.js`, `flora.js`, `flora.glsl.js`, `windmap.js`, `index.js`)

- **`?nearmap=1`.** `AirGrid`'s 3 x 3 lattice takes `windMap.nearVecAt`, which is the map's wind with the map's own
  crest speed-up divided back out, because the grid lays its own. `airAt` away from the grid takes `vecAt`.
  - Test: at the focus, the near wind averaged over a minute is within 15 degrees of the map's direction, at the
    log law's share of its speed.
- **`?farwind=1`.** `FloraField.far` is 64 x 64 cells of 32 m, refreshed each second from the map, holding the same
  load law as the bend field without its oscillator. `FLORA_GLSL` `pcPhysLoad` reads the bend field inside 112 m,
  the far field beyond 128 m, and both only in the 16 m band between, so a plant pays one lookup either way. The
  CPU twins (`plantBend`, `plantBendLite`) do the same.
  - Tests: off means `uPhysFarMap.w` 0; on, at least 90 % of far cells carry a load; a plant 600 m off leans with
    the far field; a plant inside the near field is untouched to the digit.
- **What reaches the picture today.** Only the tall trees between 112 m and their hand-over to the far tier.
  **The far tier (`world/flora.js` `far-tree` material, the trees group's) does not use the physics bend at all.**
  - SEEN and MEASURED (wood, 150 m, the spawn's storm at 11 m/s), the noise floor between two identical shots being
    0.00 %:
    - without the far tier reading it, 0.04 % of pixels change (lower third only);
    - with the far tier opted in (`phys: 'lite', stiff: 1, plantHeight: 12` on that material, tried locally and NOT
      committed), 1.13 % change, the crowns across the whole far wood out to the far bank.
  - Stills: `docs/shots/physics/weather-build/W2.4_*`. The opt-in line for the trees group:
    `A_far_tree_tier_opt_in.patch.txt`.
- **Touch T4 (the look director's).** The binding in `render/shared.js` is in
  `docs/shots/physics/weather-build/T4_render_shared_js.patch.txt` (8 lines). It was applied locally for the stills
  only and is NOT committed.
- **Bench rows** (in `src/core/bench.js`, asked only while `WX2.windmap` is on): `weather: no far wind on plants` and
  `weather: wind map frozen` (new switch `WX2.freeze`).
- **Phone cost.**
  - CPU, MEASURED in a physics frame here: the map 0.04 ms a frame on average; the far field 0.58 ms once a second,
    which is 0.02 ms a frame at 30 a second. That is about 0.2 ms on the phone (assuming three times slower).
  - GPU: the same number of lookups as before outside the 16 m band. If the trees group opts the far tier in, each
    far-tree vertex gains one bilinear lookup (4 fetches). That needs its own row ('far trees bend with the wind')
    before it is turned on.
- **Suites:** physics 427, world 65, unit 325, 0 failing.

### W3.1: THE CLOUD AND RAIN MAP, THE RAIN FIELD, A STORM HELD OVERHEAD (`src/physics/cloudfield.js`, `weather.js`, `index.js`, `core/bench.js`)

- **`weather.js` restructured, today's numbers unchanged.** `gather`'s loop body is now `accumulate(a, cell, ...)`.
  The new exports are:
  - `liveCells(body, t, seed, out)`: every live cell once, with `dotMin`, its reach as a dot product;
  - `gatherFrom(cells, body, ux, uy, uz)`: gather over that list;
  - `gather1`: gather itself;
  - `setForcedCell` and `forcedCell`;
  - `CLOUD_FORM`: each kind's cumuliform share, base and thickness.

  `accumulate` also sums the cover-weighted form (`conv`, `baseW`, `topH`, `coverSum`), which nothing old reads.
  MEASURED **bit-identical** against the committed `weather.js`: 162,000 numbers (`weatherAt`, `weatherWind`) on six
  worlds, 0 differ.
- **`cloudfield.js` (new).** Per texel of the wind map's grid it holds `low`, `conv`, `base`, `top` (above the
  datum: the wind map's H2 plus each kind's form), `mid`, `high`, `valley` (zero until W3.2), and `rain` and `snow`
  (mm/h at the ground, split as `weatherAt` splits them, with the land's moisture and the air's temperature at the
  land's height). Plus `storm`.
  - Refreshed every 0.5 s in slices. MEASURED: 0.67 ms for a full refresh here, best of 50, so 0.045 ms a frame at
    30 a second. It was 3.9 ms until `gatherFrom`'s accumulator object was made a literal: `Object.assign` had made
    it a slow dictionary.
- **THE RAIN FIELD (reconciled with `docs/lead/WATER-DESIGN.md` 5.6 on `origin/design-water`).** Their ask was
  `uRainCells[8]` as `vec4(east, north, radius, rate)` from the focus, `uRainNow`, and `rainAt()`. Delivered:
  - `fields.rain.cells`, a Float32Array(32): `uRainCells[8]` = (east, north, radius m, PEAK mm/h) about
    **uPhysAnchor** along uPhysEast / uPhysNorth (the coordinates `pcPhysGrid` gives, not about the focus, so the
    water's shader needs no new frame);
  - `fields.rain.cellsX`, a Float32Array(8): `uRainCellsX[2]`, each cell's core edge x0. **This is the one addition
    to their ask**: without it `pcRainCells` cannot reproduce the weather's own profile;
  - `RAIN_GLSL` with `float pcRainCells(vec2 en)`;
  - `fields.rain.now` (mm/h liquid at the focus) = their `uRainNow`;
  - `rainAt` (exact, any place and time), `rainBetween` (mm, the weather's clock) and `throughfall(canopy, wet)`;
  - the per-texel `rate` and `snow`.

  The cells leave out the place's moisture and snow share; the CPU functions include them. Test: the eight cells give
  `rainAt`'s rate at the focus within 5 %.
- **`physics.forceWeather({ kind, radius, strength } | null)`:** a system held over the focus, gathered everywhere
  like a real one. For the speed test and stills.
- **Bench rows** (only with `?cloudmap=1`): `weather: a storm held overhead`, and `storm: no rain drawn`.
- **Tests:** `cloudfield.test.mjs`, 6 new.
- **Suites:** physics 433, world 65, unit 325, 0 failing.
- **Seen:** `docs/shots/physics/weather-build/W3.1_cloudmap_earth_t1760.jpg`, a diagnostic of the data. Today's
  weather is round systems scattered at random, two storm cores, one at the spawn. **Nothing in the game's picture
  changes yet**: the clouds lane reads the map later.

### W3.2: STORMS BORN FROM THE LAND (`src/physics/weather.js` STORMLAND, `cloudfield.js`, `windmap.js` sites, `index.js`)

- **On a stormy afternoon, a few of the wind map's sites fire.** That is `stormDays` 0.667 of days, with 1 to 3
  storms. Each fires at 12:30 to 16:00 LOCAL SOLAR time (the sun's hour angle, which runs evenly; the painted hour
  does not at this latitude, and the first schedule laid on it came out in the morning).
  - Each lives 4 to 6.5 game hours, standing over its slope for its first quarter, then drifting at half the wind
    aloft.
  - Each is two cells: a cloud from birth, and a storm from the towering stage, so nothing steps.
  - Pure in (body, seed, t, the sites, the sun's reference). `setLandStorms` re-anchors only when the clock jumps by
    1.5 h.
- **Random thunderstorms become showers** after 1,900 s, with their rain kept and no lightning.
- **Nothing land-born before 1,900 s**, so the first day and the tuned first storm at the spawn are untouched. A test
  shows them identical.
- **The weather lives under its own top.** `weatherAt` takes `env.cloudTop` from the cloud map over the land, with
  `env.rainK` (windward more, lee less) and `env.cu` (fair cumulus).
- **Sites:** 64, spaced 450 m, with the score's relief term square-rooted so lesser hills host lesser storms.
- **The cloud map** gains:
  - `cu`, fair cumulus from the trigger, with its base rising 300 to 380 m through the day;
  - `high`, the anvils downwind of storms plus a slow cirrus field;
  - `valley`, dawn mist in calm hollows;
  - the windward and lee rain factor;
  - `flashesFor`: the last flash of every storm cell within 4 km (ground point, cloud-to-ground or in-cloud, seed,
    base, brightness by age, next).
- **`rainAt`** reads the same windward and lee factor through `RAINLAND.map`, and applies the old ceiling when
  `?stormland` is off, so it is what the game does.
- **MEASURED** (60 game days, the real Earth, the game's own ephemeris, `stormland.test.mjs` on 50):

  | what | result |
  | --- | --- |
  | days with a mature storm over the range | 72 % |
  | first matured | 14:42 to 17:42 local solar time (p10 to p90), median 15:48 |
  | a mature storm within sight of the spawn's wood (within 4.5 km) | 33 % of days (**4.5 km overstated it**: on this 4 km world a storm's top 2.4 km up is under the horizon past 3.7 km of ground; at 3.7 km it is 17 %) |
  | a land storm passing within 1.5 km of the spawn | **0 days of 60** |
  | the upper alpine meadow (above 500 m) over 10 days | **0.0 mm of water without**; 3.9 mm rain + 15.7 mm snow with, against its valleys' 11.8 + 8.4 |
  | windward against lee rain | at least 1.3 times (tested) |

  - Why no storm passes over the wood: the spawn's nearest sites are 1.9 to 3 km off, and the wind aloft there
    carries storms away. Raising `perDay` or `steer`, or adding a site on the wood's own hills, would change it.
  - **The owner's default (the wood on 1 day in 3) is NOT met by the land as it is.** I did not force it.
- **Seen:** `W3.2_A_alpine150_stormland_off.jpg` and `W3.2_B_..._on.jpg`, the alpine station from 150 m facing a
  mature land storm 1.1 km away at game time 7,020 (anchored through the lab, because the gallery holds its sun).
  - B is greyer: at the station, cloud 0.68 to 0.91 and snow 0.74 to 1.63 mm/h.
  - **The storm itself cannot be seen yet**: nothing draws the cloud map. That needs lane W1 (clouds), and W3.4 for
    shafts and bolts.
- **Phone cost:** the land cells are at most 6 more cells in each gather (`moistureAt`'s 21 lags included), plus the
  per-texel cumulus, cirrus noise and valley terms. That is under 0.05 ms a frame here: script only.
- **Tests:** `stormland.test.mjs`, 5 new.
- **Suites:** physics 438, world 65, unit 325, 0 failing.
- **Bit-identical** with the switches off (162,000 numbers).

### W3.3: A DOWNPOUR THAT READS AS ONE (`src/physics/three/kits.js`, behind `?rainlook=1`)

- **What was wrong:** at the spawn's own thunderstorm (23.7 mm/h) a few dozen strokes were in view: a light shower to
  the eye. The box already holds about 1,500 drops at tier 1; the painter's dials drew few of them.
- **Built:** three of those dials are let go while the switch is on, and put back exactly when it is off: all of the
  drops drawn from about three quarters of a downpour up (`shareGain` 1.4, from 1); drops from 3.5 m out drawn (from
  6 m); each stroke a third longer (`exposure` and `maxLen` x 1.35). The number of drops in the box is unchanged.
- **NOT built (said plainly):** the box's rain read from the map's four corners, and the kitmat `rain` and `snow`
  strings (touch T7, not needed so far). The box's rate is still `here.weather`, which with `?stormland` already reads
  the cloud top and the windward and lee factor.
- **Seen:** `W3.3_A_rain_spawnstorm_rainlook_off.jpg` and `W3.3_B_..._on.jpg`, the spawn's thunderstorm from the
  ground. B has visibly more rain strokes, and longer ones, across the whole picture; the leaves and the sky are the same.
- **Phone cost, derived:** the drops drawn go up about a quarter at full rain, each a third longer and some nearer:
  about 1.7 to 2 times the rain's own pixels. The rain's own cost is the gap between the rows 'weather: a storm held
  overhead' and 'storm: no rain drawn'; run the table with `?rainlook=1` and the same gap is the new cost.

### W3.4: RAIN SHAFTS AND LIGHTNING BOLTS (`src/world/storms.js`, new; behind `?rainshaft=1` and `?bolts=1`)

- **Rain shafts:** one instanced draw. Under every raining storm cell 1 to 7 km away (rate x strength squared at
  least 2 mm/h, at most 12), an open cylinder from the cloud base to the ground, its top leaning upwind. It is painted
  in small vertical strokes, with no outline and no blur: 440 columns round, each in runs with gaps, thinned by distance,
  in the haze's grey. Inside a storm's own curtain (within 0.6 of its radius) it is not drawn: the rain round the eye is
  the particles'.
- **Bolts:** one small draw, only while a flash is on. For each cloud-to-ground flash brighter than 0.12 and younger than
  0.5 s, a seeded jagged channel (16 segments) with one to three branches, from the cloud base to the ground. It is 2 to 4
  pixels wide whatever its distance, white, with no glow.
- **Needs a hook in `world/index.js`** (touch T2, the look director's file): 6 lines, saved as
  `docs/shots/physics/weather-build/T2_world_index_js.patch.txt`. **It is NOT in this branch's commit**; the stills were
  taken with it applied locally. Without the hook nothing of `storms.js` is loaded, ever.
- **Seen:**
  - `W3.4_A_alpine450_shafts_off.jpg` / `W3.4_B_..._on.jpg`: the alpine station from 450 m, facing a mature land storm
    1 km off (game time 7,049).
    - B shows the shafts as pale vertical strokes: a band over the left-hand slopes, and to the right a row of thin
      separate wavy lines against the far ground.
    - **Not good yet:** the right-hand part reads as a comb of lines more than a curtain of rain. Over the slopes the
      strokes read as scratches on the mountain. **It needs the look director's eye.**
  - `W3.4_A_valley_bolt_off.jpg` / `W3.4_B_..._on.jpg` (and a 4x crop): from a valley 500 m from a cloud-to-ground flash,
    looking up.
    - B shows a thin, crisp, white jagged bolt with one branch, onto the ridge; nothing else differs.
    - **What is wrong in that picture is not the bolt:** the sky over a mature storm is still today's fair sky, so the
      bolt starts out of blue air. That is lane W1 (the clouds that read the cloud map). The bolt is also short (154 m),
      because the cloud base is only that far over a ridge at 377 m.
  - How to get these frames: the gallery with `&physics=1&stormland=1&rainshaft=1&bolts=1&wtime=7049.15&t=30&pre=12`,
    then re-anchor the land storms with t0 = 1999 through `tools/lab.mjs eval`. The gallery fixes the sun from the
    camera's spot, so a camera moved 1.6 km away needs `time=16.6` to keep the same storms.
- **Phone cost, derived** (the v37 table: the ground's paint 24 to 34 ns a pixel; the shaft's shader is about a third):
  - one storm's curtain 3 km off is about 5 % of the picture with both walls: about 0.2 ms;
  - three in view: about 0.6 ms;
  - bolts: a few hundred pixels, nothing measurable;
  - no storm in view: nothing.
- **Speed-test row:** 'storm: no rain shafts or bolts' (it hides `pc-storm-*`), asked only while one of the two
  switches is on. It means something only with a storm in sight.
- **Suites:** physics 438, world and looks 65, unit 325, 0 failing.

### W3.5: STORMS THAT COME TO THE PLAYER NOW AND THEN (the coordinator's ruling of 24 Nov; `weather.js`, `windmap.js`, `index.js`, the Earth look)

- **The ruling:** a storm over the spawn's wood on about 1 day in 4, one within sight on about every other day, by
  NATURAL means (the wind aloft swinging from day to day; a weak site on the wood's hills only if that is not enough);
  never forced on the player; the dial one number in the look data.
- **Built, behind `WX2.stormswing`** (on with `?stormland`; `?stormswing=0` gives W3.2 exactly: every land cell of 30 days hashed, identical):
  1. **Every site has its own chance** on a stormy afternoon, by its weight and the day's instability (0.5 to 1.5). This
     replaces 1 to 3 drawn over the whole world. `STORMLAND.count` is 12 expected over the world, at most 24.
  2. **The day's wind aloft swings:** its direction turns by up to 180 degrees and its speed is 0.6 to 2.2 times the
     usual. It changes smoothly over about 1.6 days and is the same for every storm of the day. `steer` is 0.8 (W3.2's
     0.5 kept as `steer0` for `?stormswing=0`): a storm moves with most of the wind in its cloud layer.
  3. **Lesser hills host lesser storms:** the wind map keeps 128 sites (was 64), so the range's front right above the
     wood, at 1.1 to 1.8 km, gets sites. A storm's size and strength go down with its site's weight. This counts as
     the weak sites; none was placed by hand.
  4. **The dial:** `storms: 1` in `src/data/looks/earth.js`, passed in by `physics/index.js` (`setStormDial`). It sets
     how many storms grow and how far they drift; 0 means none.
- **Why not by the wind alone:** the wood lies SOUTH of the range and the usual wind aloft blows toward the north-east,
  so storms leave the wood behind. With the swing alone (64 sites, 6 a day) it was 6 to 13 % over the wood.
- **MEASURED** (200 game days, the real Earth, the game's own sun; within sight = 3.7 km, see the W3.2 correction):

  | | storm days | within sight | over the wood (1.5 km) | its core over the spawn |
  | --- | --- | --- | --- | --- |
  | `?stormswing=0` (W3.2) | 71 % | 17 % | **0 %** | 0 % |
  | dial 1 (default) | 71 % | **65 %** | **24 %** | 7 % |
  | dial 0.5 | 70 % | 43 % | 11 % | 2 % |
  | dial 1.5 | 71 % | 67 % | 36 % | 17 % |

  - **Said plainly:** at the default, "over the wood" meets the target (24 % against 25 %), but "within sight" is
    65 %, above the target of about every other day.
  - With this land the two cannot both be met: every extra storm on the range adds to "in sight" faster than to "over
    the wood". Dial 0.5 gives in sight 43 % but over the wood only 11 %. **The owner chooses with the dial.**
- **Seen:**
  - `W3.5_storm_tracks_60days_A_B.jpg`: a true-distance map, 10 x 10 km round the spawn, of every mature land storm in
    60 days. A: 38 tracks, all over the range or off to the east; none crosses the wood. B: 229 tracks, crossing in every
    direction, several over the wood.
  - Two game stills at the wood (t 52,310, with and without the swing) show no difference to the eye, though the
    physics says thunderstorm 6.6 mm/h against breeze. The gallery's frozen clock also freezes the sky's easing toward
    the weather, so the storm overhead does not show. Not committed: they show nothing.
- **Cost:** at the busiest moment in 20 days, 21 land cells live against 6. The cloud map's full refresh goes from
  2.14 to 2.59 ms here, so its slice each frame goes from 0.143 to 0.173 ms. `weatherAt` costs the same. Phone: about
  +0.1 ms of script, with the assumed x3.
- **Tests:** a new one in `stormland.test.mjs` (over the wood 15 to 40 %, in sight at least 40 %, the dial working,
  none over the wood without the swing). The sight distance is now 3.7 km in both.
- **Suites:** physics 439, world and looks 73, unit 325, 0 failing.

### W3.6: THE LOOK DIRECTOR'S REVIEW OF W3.3 / W3.4, ANSWERED (`world/storms.js`, `render/kitmat.js`)

- **The review (24 Nov):** rainlook PASS (but streaks to the sky's pale value, V at most about 0.85). Bolts PASS (the
  fault is the fair sky behind them, which is W1's). Shafts NOT YET: a comb of thin lines, and scratches over the slopes.
  Use veils. Regions: shafts 7, bolts 8. The T2 hook is committed on look-director as 1de2bf6, with wx2.js and
  storms.js both fetched lazily, only when the address names `?rainshaft=`, `?bolts=` or `?wx2=`. **Keep that
  contract:** nothing shared may import `physics/wx2.js` at the top.
- **The shafts are now veils**, per the review: two or three per storm (three from 12 mm/h), each at a place fixed in
  the storm.
  - Each veil is a flat sheet from the cloud's base to the ground, turned about the vertical to face the eye, its top
    upwind by 10 to 25 degrees with the wind.
  - Width 0.16 to 0.30 of the storm's core radius. The look director asked for 20 to 80 px at 1 km; this is about 40 to
    80 px for an average storm, and narrower for lesser ones.
  - Each is a VALUE STEP: a multiply of 0.06 to 0.10 (by the rain rate), half of it in the hue of the cool key
    (`pcOilShadeC`).
  - Strokes inside run along the slant, at the brush's width (4.6 px at 720 lines, never under 2 px), each within 0.03
    of the step. Under three strokes wide the veil is one flat step.
  - It thins in flat steps toward its sides (1, 2/3, 1/3, with edges that wander stroke by stroke), its top, and its
    foot. The air in front takes back 60 % of its step at full fog.
  - **Drawn in the scene pass, after everything solid, as a multiply** (CustomBlending: colour times the step, alpha
    kept). The second target, region and depth (`pcAux`), is written as 1, times 1, so the land and sky under the veil
    keep their own region and depth.
  - So it writes NO region of its own. That is my answer to the region-7 ask: a glaze over the land, the land keeping
    its region. Depth-tested, so the land in front cuts it.
  - Why not the GLAZES path after the scene: it needs the full-screen copy into rtAbs that the plain frame skips (the
    2026-11-18 note in post.js), which on a dry day with only distant storms would cost more than the veils.
- **Bolts:** region 8.
- **rainlook:** with the switch, the rain streak's pale is the sky's own (`uHaze`) capped at V 0.85, not near-white.
  The switch is read from the address in kitmat.js, not imported (the contract above).
  - MEASURED at the spawn's storm: the median streak V went from 0.72 to 0.67.
  - The brightest 5 % of changed pixels stay at 0.90. Those may be leaves and flakes that also differ between frames;
    the shader caps the pale itself.
- **The flash's light, for the look director:** `storms.flash` (a THREE.Vector4).
  - xyz: the direction from the eye to the brightest flash on now, in the body's axes, as `uSunDirL`.
  - w: its strength 0..1 (its brightness, 1 within 500 m, a quarter at 2.5 km); 0 between flashes.
  - Every flash counts, cloud to ground or in the cloud.
- **Seen:**
  - `W3.6_A_wood150_storm1700m_veils_off.jpg` and `W3.6_B_..._on.jpg`, plus a 3x crop: from 150 m over the wood,
    facing a 14 mm/h storm 1.7 km off (t 25,520, re-anchored at 1999).
    - B: four slanted veils of violet-grey glaze over the horizon, made of low-contrast strokes, with stepped sides and
      ragged tops. Nothing else changes.
    - **What is still wrong:** with no storm cloud drawn above them (W1), they hang from nothing. At this distance they
      are tall and narrow, a little like towers. Their feet are under the curve of this small world past about 1 km.
  - At the mountain station from 450 m (W3.4's view) the veils are behind the near ridge: 353 pixels change.
  - `W3.6_B_rain_spawnstorm_rainlook_pale.jpg`: the downpour still reads as rain, the streaks greyer than in
    `W3.3_B_...`.
  - `W3.6_B_valley_bolt_region8.jpg`: the bolt is unchanged to the eye in region 8.
- **Phone cost, derived:** the veils' shader is under a third of the ground's paint per pixel (about 8 ns).
  - A storm 1.5 km off: about 2 % of the picture, about 0.05 ms.
  - A storm at 1 km: about 0.1 ms.
  - A few storms in view: about 0.2 ms.
  - The speed-test row 'storm: no rain shafts or bolts' stands.
- **Suites:** physics 439, world and looks 73, unit 325, 0 failing.

## NEXT

1. **The look director's second review** of the veils (W3.6), and their decision on region (a glaze keeping the region
   under it, or region 7).
2. **W3.3's remainder** (the coordinator, 24 Nov): the rain box reads the map's four corners.
3. **Then the water group's turn on `physics/index.js`** (touch T6): the rain field is in place for them
   (`fields.rain`: `cells`, `cellsX`, `now`, `GLSL`, `rainAt`, `rainBetween`, `throughfall`).
4. W1 CLOUDS is another session's; the storm cannot be seen as a cloud until it lands, and the veils hang from nothing
   until then.
