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
| `?rainmap=1` | the rain box's drops placed by the rain map at its four corners (turns on `cloudmap`) |
| `?gustbands=1` | the gust bands seen from the air (the physics side; a material shows them only with its `PC_GUST` hook and the `uPhysGust` binding) |
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

### W3.7: THE RAIN BOX FOLLOWS THE MAP (W3.3's last part; `particles.js`, `index.js`; behind `?rainmap=1`)

- **Built:** while it rains at the focus, `physics/index.js` reads `rainAt` at the rain box's four corners and its
  middle (5 calls a frame).
  - Each new drop is kept where it lands by the rate there (the bilinear of the corners) over the wettest corner's,
    with up to 6 tries. The respawn path places a drop where it will be at mid-fall, so this is where it rains.
  - The number of drops is scaled by the box's mean rate over its middle's, so the middle keeps its density.
  - Off: `rainCorners` is null, one comparison, and no extra random draws, so the rain is what it was.
- **MEASURED, and said plainly: the effect is very small.**
  - The box is 48 m across, and a rain cell's edge softens over 250 to 450 m. So even at a storm's edge the corners
    differ by up to about a quarter to a half. The edge found in the test had 3.1 against 1.7 mm/h.
  - There the wind carries each drop across the box in the under 3 s it falls, which smears where it was placed. 53 %
    of the drops lay on the wet half with the switch, against 52 % without.
  - The placement rule itself is exact (tested: 62.5 % on the wet half for corners 3, 1, 3, 1). **No still**: the
    difference cannot be seen in a picture.
  - A sharp shower edge would need sharper cells. That is a choice for the weather's look, not this switch.
- **Cost:** 5 x `rainAt` at 4 microseconds = 0.02 ms a frame here while it rains, about 0.06 ms on the phone with the
  assumed x3. Script only; the GPU draws the same number of drops (within a few per cent).
- **Tests:** one new in `cloudfield.test.mjs`: corners read, count kept within 8 %, and the placement law.
- **Suites:** physics 440, world and looks 73, unit 325, 0 failing.

### W3.8: THE LOOK DIRECTOR'S SECOND LOOK, AND THE MISSING BINDING (24 Nov)

- **The coordinator found at the gate:** the plant shader's far-field sampler `uPhysFar` (096b6d0) was never bound
  without the look director's binding in `render/shared.js` (ccf9609). It fell on texture unit 0, and the near trees,
  grass and flowers VANISHED in the default view, with a WebGL warning and no console error.
  - It is fixed on the live game (v38.3, main e005830). design-weather now has the binding: merge b44b05d of
    look-proto 0d5533b.
  - SEEN after the merge: the autumn wood from the stream, with no switches and with `?wx2=1`, both with the near
    trees, grass and flowers.
  - **My own miss:** the check still I took after the first merge (d4b166c, `?wx2=1`) already lacked the near trees on
    the right, and I did not see it.
  - **The rule from now on (the coordinator): never land a shader uniform without its binding in the same merge.**
- **The look director's second look at the veils:** PASS as a step.
  - The multiply glaze writing no region is the right call: keep it, and keep it out of GLAZES.
  - Bolts region 8: confirmed. rainlook: pass.
  - The look director will lay `storms.flash` in the shared light after tonight's release, as a cool white lift,
    level-stepped, with no glow.
  - Two notes, now done:
    - TWO veils per storm, each 0.30 to 0.50 of the core radius: "two wide beat four thin".
    - Until the clouds lane draws the cloud base, the top comes in by the same two flat steps as the sides, never a
      ragged top in open air.
- **Seen:** `W3.8_B_wood150_storm1700m_two_wide_veils.jpg`, plus a 3x crop, the same view as W3.6. Two wider slanted
  veils whose tops come in by flat steps; they read less like towers than W3.6's four thin ones.
- **Cost:** the same or less (two veils instead of up to three; wider, about the same area).

### W3.9: A STORM PASSING OVER THE PLAYER, CHECKED IN THE GAME (the coordinator's ask, 24 Nov)

- **How:** the real game (`index.html`, not the gallery): `?look=oil&card=0&audio=0&save=0&fresh=1&dynres=0&quality=1&stormland=1&nearmap=1&farwind=1&rainlook=1&rainshaft=1&bolts=1`,
  with the look director's T2 hook applied locally (look-director 1de2bf6), loaded in the lab (3.5 minutes).
  - A new game's land storm passes over the spawn at game time 3,750 s. It is the only one in 12 game days whose core
    passes within half its radius, 192 m from the explorer, at 16 m/s.
  - `__pc.hold()` and `__pc.step(1/15)` with the painter's render switched off step the game's own frame (sim, physics,
    world) with no picture, about 30 frames in 0.1 s here. A log of every game second from 3,600 to 3,850 s is in
    `docs/shots/physics/weather-build/W3.9_game_storm_pass_log.json`.
  - Stills from the explorer's camera, aimed at the storm, at three moments.
- **What comes together (MEASURED):**
  - Overcast from 850 m out (3,698 s). The gust front at 620 m (3,713 s): wind from 1.3 to 3.8 m/s, gust index 0.97,
    **5 s before the first drizzle**.
  - Rain from 550 m out, a thunderstorm at 400 m, 13.7 mm/h at its peak (3,743 to 3,758 s), clear by 3,803 s: 70 s of
    rain, about 105 s from overcast to clear.
  - Wind 5 to 9 m/s through the storm.
  - **The near plants answer:** grass 6 m off bends from 0.06 to 0.14 rad to about 1 rad, and trees from 0.03 to 0.33 to
    0.39 rad. They are back by 3,803 s.
  - The rain box goes 0 to 1,250 drops.
  - The world's darkening: `uStorm` goes 0 to 0.81, the key light turns a pale grey, the glaze deepens, the haze
    darkens.
- **What was broken and is FIXED here (weather.js, behind the cloud map; switches off bit-identical, 162,000 numbers):**
  the flash of light at the player and the bolts in the sky were TWO DIFFERENT SERIES.
  - The player's lightning followed the cell that covered the place most, often a storm's wider cloud shield (another
    cell), at the rate gathered there. The bolts follow each storm cell's own schedule at its full rate.
  - In the game, before: flashes at 3,731, 3,736 and 3,773 s; bolts at 3,763, 3,778, 3,783 and 3,803 s; never together.
  - Now the lightning at a place is that of the up to three storms that flash most there, each on its own schedule
    (the brightest flash, the latest `last`, the soonest next).
  - In the game, after: **18 frames with a bolt and its flash of light together**. 9 frames have a bolt and no light:
    bolts of storms 0.9 to 1.3 km off, whose light is the look director's `storms.flash`, to come. 27 frames have light
    and no bolt: in-cloud flashes, as they should.
  - A test: under storms, every listed flash of a storm over the place lights it.
- **Seen (game stills):**
  - `W3.9_game_A_3690s_storm950m_approaching.jpg`: the storm 950 m off. **The sky is fair blue with small cumulus**;
    only a faint veil shows behind the trees.
  - `W3.9_game_B_3745s_storm_overhead.jpg`: a dark storm sky, slanting rain, a darker light, the explorer's hood up,
    the grass blown, leaves flying. It reads as a thunderstorm overhead.
  - `W3.9_game_C_3778s_storm_departing.jpg`: the departing storm, a grey sky with light in the air and blown leaves.
    The bolt I stepped to had ended within the grab's first step (the lab's step moves the clock 0.25 s), so no bolt is
    in it.
- **What is still MISSING (the report to the coordinator):**
  1. **The storm cannot be seen coming** (lane W1, the clouds). The sky draws only the weather at the eye, so a storm
     950 m off leaves a fair blue sky, and then the whole sky turns to a storm deck in about 30 s as it arrives. From
     W1 I need the land storms of `fields.cloud` drawn as clouds: towers from about 3.7 km out, a dark base at the
     map's `base`, an anvil downwind, and the deck overhead being THAT cloud. My veils will then hang from that base.
  2. **The gust front is weak** for a thunderstorm: at most 9 m/s here, against 15 to 25 m/s in a real one, though the
     storm kind carries an outflow of 14. Mine (physics): a stronger outflow ahead of the core, behind a switch.
  3. **The pace:** this storm drifts at 16 m/s (the day's swing at its fastest), so the whole event is about 105 s.
     A cap near 10 m/s would make it about 170 s. Mine; the owner can judge.
  4. **The flash's light on the land** for distant bolts: the look director's, from `storms.flash`, after tonight's
     release.
  5. **Thunder in the audio:** not checked (`audio=0` in a headless browser). The physics gives `thunderIn` and
     `thunder01`; PILOT's audio would need to play them.
- **Suites:** physics 441, world and looks 103, unit 325, 0 failing.

### W3.10: THE GUST FRONT, THE PACE, AND THUNDER (the coordinator's rulings after W3.9; `weather.js`, `audio.js`)

- **A correction of my own W3.9 report.** I wrote "the gust front is weak, 9 m/s at most". That was the wind at the
  explorer's 2 m, not the standard 10 m.
  - Measured properly, the 10 m wind (as the near grid composes it) under the OLD storms was already 8 to 25 m/s at
    the leading edge.
  - What was wrong was WHERE it blew: strongest inside the rain and on the REAR side (13 to 39 m/s behind), and only 1
    to 4 m/s at 1.2 radii ahead.
  - My first attempt (a stronger outflow) pushed the edge to 20 to 37 m/s and was too much. It was replaced before any
    commit.
- **The gust front at the leading edge** (`weather.js`, behind `?stormland`):
  - A storm's outflow now peaks at its edge (0.95 to 1.1 radii), on the side it moves toward.
  - It carries 0.8 of the storm's own speed there and 0.12 of its outflow behind, capped at 16.5 m/s (`STORMGUST`).
  - MEASURED, six mature land storms, at 10 m:

    | where | before | now |
    | --- | --- | --- |
    | 1.2 radii ahead | 1 to 4 m/s | 3 to 10 m/s |
    | the leading edge (0.8 to 1 radius) | 8 to 25 m/s | 12 to 26 m/s |
    | behind | 13 to 39 m/s | 12 to 22 m/s (the storm's own wind; its outflow there under a third of ahead's) |

  - **In the game** (`W3.10_game_storm_pass_log.json`): the explorer's 2 m wind rises from 1.3 to 9 m/s about 18 s
    BEFORE the first drizzle (5 s before), peaks at 11.5 m/s in the first heavy rain (about 15 to 16 m/s at 10 m over
    open grass), and falls to 3 to 4 m/s behind.
- **The pace:** no land storm drifts faster than 10 m/s times the dial (`STORMLAND.driftMax`).
  - In the game the same storm now passes over the spawn in 157 s of cloud and 106 s of rain (was 105 and 70).
  - The dial's table, measured again over 200 days, in `src/data/looks/earth.js`: dial 1 over the wood 22 % and in sight
    62 %; 0.5 gives 11 / 42; 1.5 gives 27 / 68.
  - `?stormswing=0` is still W3.2's exactly (hashed).
- **Thunder** (`src/audio/audio.js`, PILOT's file, given to group D for this one piece; behind `?stormland` or `?wx2`,
  read from the address; without them exactly as before):
  - `thunderPlan(dist, cover, roof, seed)`: a near bolt (under 450 m) CRACKS, a rip of high noise then a slap, then the
    boom and a roll. Up to 1.6 km it is a softened clap and rolls. Beyond, only two to four low rolls, slow to swell,
    over up to about 10 s.
  - Under leaves a quarter quieter; in the ship or under its hull no crack, muffled, and at most 0.55 of the loudness.
  - The distance is read back from the loudness the thunder arrives with (`thunderDistance`), so `core/game.js` is
    untouched.
  - The bang plays when the count-down crosses zero, as before. With the switch, a crossing found more than 0.5 s late
    is not played (`thunderDue(prev, now, 0.5)`).
  - The physics now hands the count-down of the NEXT thunder among the storms here, so a switch between storms never
    makes a late or double bang. In the first game run one late quiet roll had been read as 32 km off.
  - **In the game:** 6 thunderclaps, each 0.9 to 1.8 s after its flash, within one frame of the distance over 340 m/s.
    Near ones crack, ones 465 to 590 m off clap and roll.
  - `tests/audiocheck.mjs`, which renders the graph in an OfflineAudioContext and fails on clipping, clicks or DC,
    PASSES with and without the switch. Its click measure in the thunderstorm case goes from 1.2 to 2.3 with the
    switch (the crack's 4 ms attack), within its limits.
  - **Nobody has heard it**: there is no sound in a cloud session. The owner's ears decide.
- **Tests:** `tests/thunder.test.mjs` (3: the bang due once at any frame rate and never late with the switch; the delay
  as distance over the speed of sound with the distance read back; crack near, roll far, quieter under cover).
  `stormland.test.mjs` gained the gust front and the drift cap.
- **Suites:** physics 442, world and looks 103, unit 328, 0 failing. Switches off: bit-identical, 162,000 numbers.

### W3.11: THE FLIP, READY BUT NOT APPLIED, AND THE GUARD (the coordinator, 24 Nov)

- **The guard (committed, ade2f6f):** `src/world/wxguard.js`, `watchPrograms(mesh, name)`.
  - On the frames after a mesh's first draw it looks once at the program three compiled for it. A failed one
    (`diagnostics.runnable === false`) is hidden for good, with a console warning, and the game goes on without it.
  - `world/storms.js` uses it for the veils and the bolts; the clouds lane may use it for its clouds.
  - SEEN: a deliberately broken material was hidden and reported, a good one beside it untouched.
- **THE FLIP, as one commit, NOT applied:** `docs/lead/WEATHER-FLIP.patch` (`git am docs/lead/WEATHER-FLIP.patch`).
  It applies on top of the look director's storms hook (look-director 1de2bf6), which it changes; checked to apply
  cleanly on design-weather plus that hook. What it does:
  - `physics/wx2.js`: in a page every switch of the new weather is on unless the address turns it off. **?weather=old**
    turns them all off (the weather of v37 to the last digit). `rainmap` stays off. In Node (no page) every switch stays
    off, so no test changes meaning.
  - `render/kitmat.js` and `audio/audio.js` read the same: on unless `?weather=old`.
  - `world/index.js`: the hook fetches wx2.js and storms.js in the oil look unless `?weather=old`.
  - `core/bench.js`: the row 'weather: the old weather (?weather=old)': the whole new weather against the old, live.
  - CHECKED in the game: with no switches every switch is on but `rainmap`, the storms are loaded, the maps run, there
    are no errors and the picture draws. With `?weather=old` every switch is off and storms.js is never fetched.
  - NOT in it: the clouds lane's own switch (`?clouds3d`, the look director's and W1's) flips with their review.

### W3.12: THE WIND SEEN FROM THE AIR (the coordinator, 24 Nov; `flora.js`, `flora.glsl.js`, `wx2.js`, `core/bench.js`)

- **What the far land already took from the wind** (`?farwind`):
  - The far trees' painted stand-ins (A1, trees-far `render/impostor.js`) lean at their foot with the far field
    (pcPhysBendLite). From 150 m to 1 km a lean moves a crown's top about a pixel: no gusts can be seen in it.
  - The ground reads only the push field (the trodden track, within 70 m). The near grass strokes read only its
    flattening.
  - The near plants carry travelling gust waves (`uPhysWave`), but these are 11 to 19 m long and their phases are kept
    modulo one wave, so they cannot drive bands seen from far off.
- **What a gust looks like from above:** not a bend but a SHEEN. Where it lays the grass and turns the leaves, their
  paler side shows, and the pale patch runs downwind.
- **Built (physics side, committed):** behind `?gustbands=1` (`WX2.gustbands`).
  - `flora.js` hands the shaders `uPhysGust`: xyz the bands' direction (the near waves' own slowly turning direction,
    in body axes) times their strength, which is 0 in a calm and full in a fresh breeze (`GUSTBAND.windLo` 0.4 and
    `windHi` 2.2 m/s at the blades). w is how far they have run (1.5 times the blade wind), wrapped at the noise's
    period so that they never jump.
  - `flora.glsl.js pcGustBand(p)`: 0..1 at a body-local point (a stroke's centre). It is one read of the shared 3D noise,
    stretched to bands about 40 m along the wind and 120 m across, lying on the world (no jump when the frame
    re-anchors), with more and bolder bands the stronger the wind.
  - **Compiled only where a material defines `PC_GUST`**, and that material must bind `uPhysGust` (the coordinator's
    rule: no unbound uniform anywhere).
  - Test: `gustband.test.mjs` (off by default; on in a breeze along the ground, running, wrapped, never jumping; the
    function behind its define).
- **The hooks, as patches for their owners (applied locally for the stills only, NOT committed):**
  - `docs/shots/physics/weather-build/T_gust_render_shared_js.patch.txt`, for the look director: `uPhysGust` in
    shared.js `PHYS`, one line. syncPhysFlora's loop then copies it.
  - `docs/shots/physics/weather-build/T_gust_ground_materials_js.patch.txt`, for C, the far ground: in
    `makeTerrainMaterial` `PC_GUST` with `?gustbands=1` or `?wx2=1` in the oil look. In `pcGroundPaint` a growth stroke
    (green to lemon and straw: `k.g - k.b`; not rock, not snow) under a band is laid a pale, cooler step, by whole
    strokes.
  - For A1, the far crowns: the same, one `pcGustBand(tree foot)` a tree in the impostor's fragment stage, a pale
    lift of the crown's leaves (they turn their paler side); `PC_GUST` and the same binding.
- **Seen** (`W3.12_*`): the green wood from 150 m in a 5 m/s breeze, A off, B on at t and one second later, a 3x crop
  stack and a x12 difference.
  - B has patches of paler, cooler ground strokes between the trees, and one second later they have moved downwind.
    2.3 % of the pixels differ from A; 1.3 % differ between B's two frames.
  - **Said plainly: it is subtle over a wood.** The crowns cover most of the ground from the air, so over woods the
    visible answer needs the crowns too (A1's impostors, and the middle trees). Over open grass it reads more.
  - In a calm, which this game's near winds mostly are (0.3 to 2.5 m/s at 2 m), it is off.
- **Phone cost, derived (uncertain: no device):** one 3D texture read and about fifteen operations per ground stroke
  layer, in growth strokes, while there is a breeze. The ground's paint is 24 to 34 ns a pixel (v37) with many reads,
  so this is about a tenth of it: about 0.3 to 0.5 ms from the air over grass.
  - That is over the 0.3 ms a change. On the phone tier, read it once a pixel at the coarse layer's stroke: about a
    third of that.
  - Speed-test row: 'weather: no gust bands seen from the air' (live).
- **Suites:** physics 443, world and looks 103, unit 328.

## NEXT

1. **The look director's second review** of the veils (W3.6), and their decision on region (a glaze keeping the region
   under it, or region 7).
2. (W3.3's remainder, the rain box from the map's corners: built as W3.7, with a very small effect.)
3. **Then the water group's turn on `physics/index.js`** (touch T6): the rain field is in place for them
   (`fields.rain`: `cells`, `cellsX`, `now`, `GLSL`, `rainAt`, `rainBetween`, `throughfall`).
4. W1 CLOUDS is another session's; the storm cannot be seen as a cloud until it lands, and the veils hang from nothing
   until then.
