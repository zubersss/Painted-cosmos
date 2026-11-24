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
| `?nearmap=1` | the near grid takes its base from the map (not built yet) |
| `?farwind=1` | the far plants read the map (not built yet) |

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

## NEXT

1. **W2.3:** `air.js`, the near grid's 3 x 3 lattice (`_sup`) takes the map's 10 m wind in place of `windLarge` when
   `WX2.nearmap` is on. Add a test that the near grid and the map agree within 10 % at the grid's centre.
2. **W2.4:** `flora.js` `FloraField.far` (64 x 64 at 32 m, 1 Hz, from `fields.wind.at`), and `flora.glsl.js`
   `pcPhysBend` / `pcPhysBendLite` blending to it beyond 112 to 128 m.
   - Needs the look director's T4: `PHYS.uPhysFar` and `uPhysFarMap` in `render/shared.js`.
   - Bench rows: `weather: no far wind on plants`, `weather: wind and cloud maps frozen`.
   - A/B stills to the look director: the far wood at W-150, two frames 0.5 s apart.
3. **W3.1:** `cloudfield.js` and the rain field (the design's 9.2 and 9.3, plus the water group's
   `uRainCells[8]` / `rainNow`).
