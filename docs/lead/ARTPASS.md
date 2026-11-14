# Art pass (owner's order, 2026-11-11/12): integration report, judge and per-biome results

Saved by the coordinator from the workflow's return value (run wf_1e083b58-6f0, base 8f23067, commit 5f12995). The frames named under /home/user/.pc-scratch are scratch and may not survive the container; the committed evidence is docs/shots/art/.

# Art pass: integration report

**Commit `5f12995`** (`5f129953ff9d4e5e3e6945d6403c68e0fcb0f5d6`) is on `cosmos` and pushed. HEAD and origin/cosmos are the same commit.

- **What the commit holds:** 44 files, all under `src/data/looks/*.js` and `docs/shots/art/`. That is earth, jupiter, mercury, neptune, pluto, saturn, uranus and venus, 42 before/after pairs, 3 extra pairs and the final sheet. No other path was committed.
- **Earlier commits:** moon.js and mars.js went up earlier in the coordinator's "[art] WIP" snapshots (d762581, e21e204) and have not changed since. To see the whole pass: `git diff 8f23067 5f12995 -- src/data/looks`.
- **Shared files untouched:** `common.js` and `src/data/looks.js` are identical to 8f23067.

## Tests (latest head e21e204 with every body file laid over it, in /home/user/.pc-scratch/art/integrate/root)
- `node --test src/world/*.test.mjs`: **19 pass, 0 fail**
- `node --test tests/*.test.mjs`: **140 pass, 0 fail**
- `node --test src/physics/`: **291 pass, 0 fail**

Nothing failed, nothing needed a re-run, and no look data was reverted.

## Console
- **Start frame:** `tools/shot.mjs /index.html` exited 0 with no console errors. The title card renders over the Earth forest: /home/user/.pc-scratch/art/integrate/start.jpg
- **All ten bodies in one browser session:** earth, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, each at `teleport({body, hour: 11})`, quality 2, 960x540.
  - Every body settled, in 10 to 102 s.
  - 0 console errors, 0 page errors, 0 failed or external requests, and `window.__pc.errors` stayed empty.
  - `info().fallback` was `[]` on every body, and render, world, art and physics were `real` throughout.
  - `ui` reports `stub`. This is intended (`REAL_READY.ui: false` in src/core/providers.js) and not a fall-back; `fallbackProblem` does not count it.
  - Frames: /home/user/.pc-scratch/art/integrate/visit/*.jpg. Montage: /home/user/.pc-scratch/art/integrate/visit-montage.jpg. Log and JSON: /home/user/.pc-scratch/art/integrate/visit.log, visit/report.json.
- **Errors from the head:** none, from look data or from anyone else's code.

## Sheet
`docs/shots/art/sheet.jpg` (2590x2674) has one row per planet and all 42 biomes as 400x225 tiles. Each tile is labelled `body / biome` and tagged improved, unchanged or reverted against 8f23067. The tiles are the kept after-frames: the fixers' frames where a fixer changed the biome, otherwise the painters' tour or check frames. Every frame is from the tour's stand at hour 10 in fair weather. I opened the sheet and it reads correctly.

---

## Per planet: 36 of 42 biomes improved, 1 unchanged, 5 reverted to base

**Earth (4 improved, 2 reverted)**
- **temperate_forest:**
  - The birch stand now has trees of all ages (vary 1, scale 1.25, obs 0.34), which breaks the "picket fence".
  - The darkest pine and birch leaf washes are lifted.
  - Mist went from 1.25 to 0.95, so the back of the wood fades in bands.
- **autumn_woodland:** the same mixed-age gold birches form a middle storey. The autumn crown and undergrowth darks are lifted, and the stream liquid is lighter.
- **alpine_meadow:** turf patches, and a band of dwarf shrubs that gives the frame its first darks. Grass is thinned, and the biome's granite-grey rocks sit a step below the turf instead of pink-beige above it.
- **desert_canyon:** boulders are fewer (0.035) and sienna-toned, so the big pale lozenge is gone. The near-black shrubs are cut from 0.02 to 0.008 and use sage-ochre washes.
- **Reverted:**
  - **sea_coast:** its patch darkened the cliff barcode; t is back to base.
  - **misty_wetland:** no data change helped; its fields are base.
- **Body-wide:** warmer umber boulder washes.

**Moon (4 improved)**
- **mare:** the ground is now dark, cool basalt (Payne's grey, neutral tint and Davy's grey, plus flow patches). Boulders went from 0.03 to 0.010 in basalt washes, so there are no pale slabs.
- **highlands:** paper-grey and sepia patches. Boulders went from 0.05 to 0.014 and are now in the ground's own grey.
- **crater_fields:** pale ejecta patches. Blocks went from 0.06 to 0.020 and are grey, not white.
- **rilles:** patches, and boulders from 0.05 to 0.010, leaving a clean pebbled plain.
- **Body-wide:** a silver hue instead of ochre, and grey rocks.

**Mercury (4 improved)**
- **ochre_basins:** the biome has ochre and sepia rocks at 0.022, so the soap boulders are gone. It also gets the lighter body sky.
- **obsidian_fields:** a dark slate-indigo glass plain (gloss removed, dil 0). Blades and stones are rare dark glass. The darks are lifted, so only the cracks are near-black (before, the frame edge sat at L 5 to 10).
- **crystal_gardens:** crystals stand in clusters (tallD 0.11), shards went from 0.16 to 0.03, needle is 0 (no cream splinters), and there is a lemon accent.
- **shadow_craters:** biome fields are base. It improved only through the body sky: the zenith went from [0.34,0.33,0.50] to [0.54,0.52,0.70], a lighter and finer violet wash.

**Venus (3 improved, 1 unchanged)**
- **lava_rivers:** about twelve grey boulders became a few mid mauve-grey basalt stones. The flow patch and crust are lifted off near-black.
- **acid_terraces:** umber stones sit in the ochre tread. The pool went from lime to milky sage (p95 chroma 45 to 34).
- **pale_mesas:** the horizon row is thinned. t.fog went from [100,40] to [22,14], so the mesas stand clear above the low fog and the frame has bands.
- **Unchanged:** fungal_towers, one of the best frames, left as it was.

**Mars (4 improved)**
- **rust_canyons:** the canyon bushes are removed, including the flat maroon cut-out at the lens. Rocks went from 0.07 to 0.02 in a rust wash.
- **dust_dunes:** lee went from 0.3 to 0.7, a cool rose-violet glaze on the slip faces that gives a third value.
- **polar_frost:** the ground is cobalt frost instead of mint, with blue cracks. Shards are pale rose and rare, and needle and dab are 0.
- **dry_riverbeds:** a softer broadleaf leafP, so the groves have no pixel holes. Rust boulders are at 0.024.

**Jupiter (4 improved)**
- **sky_islands:**
  - The cliffs are warm sienna instead of olive grey, with strata at 0.45.
  - The near crown's washes are warmer, so it reads sap-green or olive instead of slate.
  - Bushes are lighter and rocks are mid violet.
- **storm_wall:** three patch drifts break up the flat sienna plain. Rocks are darker grey-violet and went from 0.08 to 0.03, so the ruled row of boulders is gone.
- **hanging_gardens:** richer meadow patches. Flowers are rose madder only, at 0.07, so the scarlet confetti band is gone and the eye goes to the vine curtains.
- **lightning_plains:** a violet-grey storm plain with indigo cracks. The lemon glass accent is thinned (shard 0.07, needle 1).

**Saturn (3 improved, 1 reverted)**
- **gold_islands:** dil 0.42, shard from 0.03 to 0.01, needle 0. The teal splinter confetti is gone.
- **ring_shadow:**
  - The spires use cool stone washes, with violet glazes at dusk instead of orange cut-outs.
  - The ground is cooler (cobalt violet, cobalt blue, Payne's grey).
  - Rocks are warm neutral at 0.02, and shards are lilac.
- **honey_mist:** a wetter broadleaf leafP gives full, soft gold crowns, and the specks are gone.
- **Reverted:** crystal_reeds. The lemon and rose tries broke the mint idea.

**Uranus (3 improved, 1 reverted)**
- **ice_shelves:**
  - The seracs are slim, leaning aqua needles, no longer "snowy firs".
  - There is a dark recess under each shelf lip, with rag 0.9 and deeper teal seams.
  - The body's hue drift no longer lays warm ochre on the ice.
- **pearl_fog:** the ground went from mint-yellow to mother-of-pearl rose, lilac and mint, with its own stones and a cerulean accent.
- **teal_sinkholes:** the lava-path glow is removed, so there are no scarlet banks. Indigo throat, dark-lee stones, rock 0.015, shard 0.04 and dab 1 (the polka-dot pebbles are halved).
- **Reverted:** frozen_waves. Neither recolour stopped the waves reading as peaks.

**Neptune (3 improved, 1 reverted)**
- **storm_seas:** the headland is dense Payne's grey basalt (dil 0.14, strata 0.55) instead of pale plaster.
- **kelp_forests:**
  - A viridian floor under violet kelp, with tallD 0.4.
  - The ultramarine bush band and the scarlet confetti are thinned.
  - Stones are blue-violet, in this biome only.
- **ice_spires:** the ochre stains are gone. Spires are larger with a deeper cobalt lee, and shards are at 0.08.
- **Reverted:** aurora_tundra.

**Pluto (4 improved)**
- **heart_glacier:**
  - The ground went from green-yellow to cream and rose nitrogen ice with rose cracks.
  - The thicket of penitents near the eye is gone.
  - The body sky is lighter (mkSky [0.50,0.48,0.68]/[0.88,0.86,0.95]) and visibility is [1600,10000], so the far bands fade.
- **lilac_mountains:** the shard clumps and the paper-white slab are gone, and rocks went from 0.07 to 0.025.
- **long_shadow_plain:** lilac-grey ground, and soap boulders from 0.08 to 0.018 with dab 1.
- **nitrogen_dunes:** cobalt, neutral and rose ground, lee 0.8, and a dune crest now stands in view. The slabs are gone.

## Weakest biomes still, worst first
1. **earth/misty_wetland:** fails the freeze-frame test. A "misty" wetland sits under Earth's clear blue sky with cumulus (sky keys are per body). The reeds are an even comb, the near shallows show a halftone dot pattern, and there is no dark.
2. **venus/lava_rivers:** fails. The tour stand is 0.8 m deep in the lava, so the frame is taken in third person 8 m away and shows a bank with no river.
3. **mercury/crystal_gardens:** fails. Every crystal renders the same saturated ultramarine whatever its wash (the shared shadow glaze), and the ship is in view.
4. **neptune/aurora_tundra:** no aurora anywhere, because the sky code has none. A generic meadow with the ship in view.
5. **uranus/frozen_waves:** seen along their crests, the waves read as snow peaks, and the ship fills the foreground.
6. **moon/rilles:** the rille is never in view (vantage), and the horizon is crisp because the airless code adds no haze.
7. **earth/temperate_forest:** the game's reference painting is now its lowest-key daylight frame. There is no bare paper (p99 L 75.5) and the canopy closes the sky. Forest placement ignores tallD.
8. **saturn/gold_islands:** a barren shelf, one flat saturated gold wash (p95 chroma about 40), and a boxy island table.
9. **pluto/long_shadow_plain:** no long shadows at all, and a clump of boulders is left on the left.
10. **earth/sea_coast:** the vertical "barcode" stripes on the cliff about 250 m off. This is terrain.
11. **saturn/crystal_reeds** and **uranus/pearl_fog:** each is one narrow pale value range with nothing for the eye to rest on.
12. **venus/pale_mesas:** the mesas now read, but there is still no dark anywhere (p1 L 69).

**Arrival frames, new from this run.** No one judged the spawn views; the tour shoots each biome's stand.
- Mercury's arrival (obsidian_fields) is crowded with saturated cobalt-violet boulders and pale shard clumps around the explorer. It is much busier than the obsidian stand.
- Mars' arrival (dry_riverbeds) has a large pale peach lozenge boulder next to the explorer, and shrubs with speckled edges.
- Frames: /home/user/.pc-scratch/art/integrate/visit/mercury.jpg and mars.jpg.
- I changed nothing there: I had no before/after for those views. They are follow-ups.

**Looked at by no one:** weather and motion on any body, dawn on most bodies, and day/night on Uranus and Neptune.

**Untested follow-ups from the cross-verifiers:**
- nitrogen_dunes ground `['cobaltViolet','cobaltBlue','roseMadder']`.
- `near.dab 1` on ice_shelves and pearl_fog.

## Wishes for PAINTER (shared code; merged and deduplicated)
1. **Boulder shape** (`src/world/florakit.js` rockGeometry; the rock branch of `makePropMaterial` in `src/render/materials.js`): broken, flatter, dry-brushed silhouettes with varied value and pigment pooled at the edges. Data could only thin and tone them; they are still smooth lozenges. Seen in moon/highlands, earth/desert_canyon, mars/rust_canyons, venus/lava_rivers, jupiter/sky_islands, saturn/ring_shadow, pluto/heart_glacier.
2. **Shadow glaze swamps local colour** (`src/render/chunks.js` pcTone `g2 = pcDensity(c*glaze^1.75, 1.3)`, and the foliage and crystal glaze around `materials.js:1119`): keep the local hue in the deepest step, or use a single lighter glaze for near foliage. This one cause gives the all-ultramarine crystals on Mercury, the slate near crown on Jupiter and the flat sepia autumn crowns on Earth.
3. **Night key** (`src/render/post.js` uNight around lines 150-175, and pcLevel): give the land a floor of about L 18-25 with one or two value steps. Mercury obsidian_fields, shadow_craters and Mars dust_dunes go to one flat mass at L 8. The Earth spawn at 23 h has median RGB 24,29,48.
4. **Cool key for twilight biomes** (`src/world/index.js` blendKeys/twilight): today 78% of the lost day goes into the gold dusk key, so saturn/ring_shadow turns grey-brown at noon.
5. **Sky** (`src/world/sky.js` and `index.js`):
   - Let a biome's mist pale the sky over it (earth/misty_wetland).
   - An aurora for biomes that name it (neptune/aurora_tundra).
   - Smaller, fainter granulation in dense sky washes (Pluto mottles, Neptune pepper).
   - A lighter, cool glaze for the shadowed part of Saturn's ring, which is a dark sepia streak today.
6. **Airless haze** (`src/world/index.js` fog/space01): honour `look.visibility` on airless worlds. The Moon's horizon is a crisp line of boulders.
7. **Stands and views** (`src/art/easels.js`, `src/art/vantage.js`):
   - Turn the Moon's arrival and stands toward Earth.
   - Put the venus/lava_rivers easel on ground under 20 degrees facing the river.
   - A moon/rilles stand that sees the rille.
   - Height-aware fog for pale_mesas. Data has partly solved this with fog [22,14].
8. **Terrain** (`src/world/surface.js` and `terrain.js`):
   - Coast cliff faces: remove the vertical stripe barcode.
   - Gate t.patch by slope in every recipe, not only islands.
   - Islands: ledges, talus and a ragged outline instead of extruded blocks.
   - Ridged recipe: wobble the crests.
   - Basin recipe: fade the 47 m tiny craters with distance, or expose their depth as a t key.
   - Autumn forest moss and mud washes (lines 127-137): lighten them or let a biome override them (e.g. `b.forestPal`).
   - Do not count kelp as a canopy crown (surface.js:66 `leafy`).
9. **Liquids** (`src/render/materials.js`):
   - A cool glow separate from the lava path, for teal_sinkholes (around lines 400-404 and 531).
   - A per-biome shallows bed colour instead of the fixed sand `uBed` at line 544. It leaves a sepia band on Neptune's basalt and an ochre line around Uranus' pool.
   - Visible reflected strokes and paper glints at refl 0.45 (around lines 385-420).
   - Remove the halftone dot pattern on near shallows (or fix it in `nearground.js`).
10. **Flora kits and placement** (`florakit.js`, `flora.js`, `floraplace.js`):
    - Lobed flower heads instead of flat red discs.
    - Varied spire silhouettes.
    - Smaller or fewer vine blossoms.
    - Honour tallD for forest terrain (floraplace.js around line 47).
    - A per-look bush leafP (`_underMats`).
    - A floor for the near-black cores of bushes.
    - A light under-wash in the paper holes of near crowns.
    - Waves whose crest stays level toward the ends, or turned across the stand (`waveGeometry`, and the wave yaw at floraplace.js:57).
    - A stable hash slot per small kind, so editing one density stops reshuffling the other kinds.
11. **Near ground** (`src/world/nearground.js`):
    - Pull pebble dabs toward their ground (mix 0.7, or take rock[1] less often); dark stone colours turn the dabs into a polka-dot.
    - Pull lit splinters toward the ground's value.
    - Give a sunlit near meadow value structure, or lay drifting cloud shadows on it.
12. **For PILOT, with PAINTER:**
    - Make the teleport/tour hour match the world's local solar hour (`src/core/sim.js` vs `index.js` sunForHours). On Earth, tour hours 6 and 18 land in night.
    - Frame Saturn's ring from orbit in `tests/tour.mjs` captureOrbit.

Group 4: the owner named Uranus and Neptune. The workflow added Pluto to that group, and the ice group covered it.


---

# Same-painter judge

Sheets: /home/user/.pc-scratch/art/judge/sheet-after.jpg is every biome's kept after-frame. /home/user/.pc-scratch/art/judge/sheet-before.jpg is the same layout for 8f23067. Both have one row per planet (earth, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto) and 480x270 tiles labelled body/biome. Full-size 2x2 grids of the after-frames are in /home/user/.pc-scratch/art/judge/grid/. The frame list is /home/user/.pc-scratch/art/judge/frames.tsv. For reverted biomes the after-frame is the kept state, for example saturn/gold_islands is the base re-render chk/after-saturn-gold_islands.jpg. The working-tree body files are byte-identical to every group's after tree. I edited no repository file and left no process running.

THE COMMON HAND, shared by about 30 of the 42 biomes. Measured in CIELAB inside the border, and checked by eye at full size:
(1) Paper is the light. The same warm #F4EFE4 ragged border is on every frame. Bare or near-bare paper (L about 88-95) shows somewhere: sky holes, cloud tops, sunlit ground, birch trunks.
(2) A light key with 3-4 value steps. The median L is about 65-85.
(3) The sky is one granulated wash. It is mid-light at the zenith (sky median L about 75-86: Earth 76-78, Jupiter 80, Mars 82, Saturn 85, Uranus 86, Venus 90) and pales to a near-paper horizon band.
(4) The ground is one dominant local wash, broken by t.patch drifts at 5-50 m. Small crisp touches (pebble dabs, cracks, blade flicks) are the only hard edges.
(5) The darks are small indigo, sepia or Payne's grey shapes at about L 20-30: a crack, a pine, the foot of a stone, a basalt seam. They are never large and never below about L 15.
(6) Saturation is moderate: the 95th-percentile chroma is about 20-35. One world hue dominates, plus one small saturated accent.
(7) Boulders are few (small.rock about 0.008-0.035) and sit a step below their ground in its own hue.
(8) Distance falls in 2-3 bands, each paler and cooler, toward a haze of the sky's horizon colour. Shadows are cool violet glazes.
(9) Ice and crystal forms share one vocabulary: leaning cobalt-to-lilac needles (Mercury crystals, Jupiter glass, Saturn spires, Uranus, Neptune, Pluto).
Edge, granulation and border feel are the same everywhere, because the pipeline is shared. Where a frame looks like another hand, the cause is DENSITY in the data: a dense wash granulates into large mottles (the Pluto and Mercury skies) and dense darks go to near-black.

Accepted as each world's own idea, not departures: the Moon's indigo space sky and crisp horizon (airless; shared code ignores look.visibility), Venus' high-chroma sulphur, Neptune's saturated ultramarine sky, and the deliberately dark obsidian plain (only its depth departs). Every biome's palette is 5-7 named pigments plus one accent in the data.

Weather, motion, dawn and night were not compared across planets. All frames are tour noon or hour 10, fair weather. None of the proposed fixes below has been rendered. Each needs a before/after quick shot and node --test src/world/*.test.mjs before it is kept.

## Mismatches the judge flagged

- **mercury / all four (body sky)**: The zenith transmittance [0.34,0.33,0.50] is as dense as a night key. The upper 55% of every Mercury frame is a dull mauve-grey slab: sky median L 64, p5 51, against 75-90 on every other daylight world. The heavy wash granulates into big mottles, so Mercury reads as a heavier, muddier hand than Venus and Mars beside it. Its night key derives from the zenith (x0.28-0.44), which is why the obsidian and crater nights go flat near-black.
  - fix: mercury.js sky: mkSky([0.54,0.52,0.70], [0.97,0.88,0.74], { glaze: [0.62,0.62,0.82], light: [1.0,0.97,0.88] }). The zenith stays violet but one step lighter, and the peach horizon is unchanged. The derived night lifts with it.
- **pluto / all four (body sky)**: The sky is mkSky([0.35,0.34,0.53], [0.78,0.76,0.90]). It is a mottled camouflage slab over half of every Pluto frame (sky median L 60), and the horizon reaches only about L 72. The far ridges and penitent rows run into a mid-value band instead of fading to paper. It is the darkest daylight sky after the Moon's space.
  - fix: pluto.js sky: mkSky([0.50,0.48,0.68], [0.88,0.86,0.95]). A lighter wash also granulates into smaller mottles, so this is the data side of the ice group's sky-mottle wish. Keep visibility [1600,10000].
- **mercury / obsidian_fields**: The darkest frame in the game: L p1 9.3. The near band and the bottom border sit at L 5-10, so the frame edge goes near-black instead of fading to paper. The dark-glass patch [0.10,0.10,0.17] at amt 0.72 and the blades' and stones' bases at about 0.12-0.14 put large areas below every other planet's darkest notes.
  - fix: Keep dil 0 so it still reads as dark glass. In t.patch[1], c [0.10,0.10,0.17] -> [0.22,0.22,0.32] and amt 0.72 -> 0.6. In flora.tall[2] (only obsidian uses it), the darkest bark and leaf wash [0.12,0.12,0.20] -> [0.20,0.20,0.30]. Under.rock base [0.14,0.13,0.21] -> [0.22,0.21,0.30]. Under.crust[1] [0.13,0.14,0.24] -> [0.22,0.22,0.32]. Crack 0.5 stays, so the cracks become the frame's only near-black lines.
- **earth / temperate_forest**: The game's reference painting is now its lowest-key daylight frame. There is no paper anywhere (L p99 74.6, against about 88-95 elsewhere), and the median is L 50. Since birch scale 1.25 the canopy closes the blue sky that the before-frame had at the top. The pines' darkest wash [0.17,0.28,0.35] is one of the densest leaf washes in the game, and the upper-left canopy has p5 L 28. The wood behind the stream hardly fades (mist 1.25 gives more air), so the stacked bands are missing.
  - fix: earth.js conifer (flora.tall[1]): leaf[2] [0.17,0.28,0.35] -> [0.24,0.34,0.42]. Birch (flora.tall[0]): leaf[2] [0.31,0.51,0.37] -> [0.40,0.58,0.42]. temperate_forest: mist 1.25 -> 0.95, so the back of the wood steps toward paper. Keep vary 1 and obs 0.34.
- **earth / autumn_woodland**: The same low key, also without paper (L p99 74.6). The nearest crowns at top right render as flat, hard-edged sepia-brown blotches (L 9-30). The near bank is a dark, muddy olive band. Both are heavier than any warm biome on Venus, Mars or Jupiter.
  - fix: Autumn birch (flora.tall[2]): leaf[2] [0.72,0.42,0.26] -> [0.80,0.54,0.34]. autumn_woodland under.leaf[2] [0.54,0.42,0.30] -> [0.66,0.54,0.38] and under.bush[2] [0.44,0.30,0.30] -> [0.58,0.44,0.36]. The conifer lift from temperate_forest also applies here.
- **earth / desert_canyon**: The shrubs are near-black slate-teal blobs with speckled rims (p5 L 23, min 9). They are the darkest and coolest marks in a warm sienna frame. Mars removed the same shrubs from rust_canyons and Jupiter lifted its bushes, so the arid biomes no longer match.
  - fix: desert_canyon small.bush 0.02 -> 0.008. under.bush [[0.78,0.80,0.60],[0.60,0.66,0.52],[0.42,0.48,0.44]] -> [[0.86,0.84,0.66],[0.74,0.72,0.56],[0.60,0.58,0.48]]: sage-ochre, a step below the sand.
- **venus / lava_rivers**: The basalt boulders render near-black (p5 L 9-17) with crisp rims, darker than any rock on another planet; the common hand puts stones a step below their ground. The dark-flow patch [0.17,0.15,0.19] lays a heavy slate band across the far bank, so the frame jumps from orange dirt to near-black.
  - fix: lava_rivers under.rock [[0.44,0.38,0.40],[0.19,0.16,0.21]] -> [[0.58,0.50,0.50],[0.32,0.27,0.32]]. t.patch[0].c [0.17,0.15,0.19] -> [0.30,0.27,0.32]. under.crust[0] [0.13,0.12,0.16] -> [0.24,0.22,0.28]. The stand-in-lava problem is a separate PAINTER wish (easels.js).
- **venus / pale_mesas**: One value range across the whole frame: L p1 72, no dark at all, no bands. t.fog [100,40] paints every ground below about 140 m 82% toward paper (surface.js:612). It also cuts the camera mist to 0.2x at the 30 m stand (index.js:377). The mesas end up as sky-yellow ghosts.
  - fix: pale_mesas t.fog [100,40] -> [22,14]. The fog then lies in the low ground below the stand, and the mesa walls (amp 330, strata 0.7) stand clear above it, which is 'pale mesas above the fog'. Keep mist 2.6. This changes colour and visibility only, no heights.
- **venus / acid_terraces**: The pool is the largest flat saturated area in the game. Lime [0.80,0.92,0.50] gives a 95th-percentile chroma of 44, against 35 or less elsewhere, with no reflected strokes or paper glints. It breaks 'no area is flat colour'.
  - fix: acid_terraces liquid.color [0.80,0.92,0.50] -> [0.86,0.93,0.68] and keep refl 0.45. The lemon terraces and the turquoise accent then carry the colour.
- **jupiter / sky_islands**: The near broadleaf crown is a near-black slate-green mass, the darkest foliage on any planet: p5 L 18, median 25, over about a fifth of the frame. Its leopard-spot paper holes make it read as a cut-out.
  - fix: jupiter.js flora.tall[0] leaf [[0.70,0.84,0.42],[0.46,0.70,0.44],[0.24,0.46,0.42]] -> [[0.74,0.86,0.46],[0.54,0.75,0.46],[0.36,0.55,0.46]]. Keep leafP [0.6,0.15,1.0,0.3]: the reverted try paired lighter washes with a wetter leafP, and the wetter leafP is what merged the crown.
- **neptune / kelp_forests**: No paper in the frame (L p99 73.9). A band of saturated ultramarine bush blobs (body under.bush, density 0.09) runs under the kelp at p5 L 18, a large dark rather than one in small places. The floor carries an even confetti of scarlet-pink flower dots, the same red confetti Jupiter's hanging_gardens removed.
  - fix: kelp_forests small.bush 0.09 -> 0.03 and small.flower 0.09 -> 0.04. near.flower 5 -> 2. Give it its own under.bush [[0.74,0.76,0.88],[0.56,0.58,0.78],[0.40,0.42,0.62]].
- **saturn / ring_shadow**: The boulders are saturated cobalt-violet lozenges with ultramarine undersides. under.rock [0.80,0.78,0.86]/[0.50,0.48,0.62] is glazed again by twilight 0.75. No other planet has rocks saturated off their ground's hue, and these sit on a grey-brown ground. The group already moved the spires to warm stone for this reason.
  - fix: ring_shadow under.rock -> [[0.86,0.82,0.80],[0.58,0.54,0.56]], warm neutral like the spires, so the twilight glaze supplies the violet. small.rock 0.05 -> 0.02.
- **pluto / long_shadow_plain**: A field of many smooth lilac boulders spread evenly (small.rock 0.05, near.dab 3). This is the soap-boulder scatter that every other group thinned to 0.01-0.035, and it is the dominant subject of the frame.
  - fix: long_shadow_plain small.rock 0.05 -> 0.018 and near.dab 3 -> 1.
- **pluto / lilac_mountains**: small.rock 0.07 is the densest boulder setting among the dry-land biomes. It lines the ridge with a row of identical lozenges.
  - fix: lilac_mountains small.rock 0.07 -> 0.025.
- **jupiter / storm_wall**: small.rock 0.08 still lays a ruled row of boulders along the spire line, now darker, so it reads as a scatter rather than accents.
  - fix: storm_wall small.rock 0.08 -> 0.03.
- **jupiter / lightning_plains**: The lemon glass needles (the accent) cover the whole middle ground as even tufts (small.shard 0.16, near.needle 3). The accent becomes a texture rather than one small saturated note, unlike every other biome.
  - fix: lightning_plains small.shard 0.16 -> 0.07 and near.needle 3 -> 2.
- **uranus / teal_sinkholes**: The sinkhole wall is a dull blue-grey slope over half the frame, evenly scattered with stones and shards (small.rock 0.04, shard 0.08). It is a stipple rather than accents, and it pulls the eye from the pool.
  - fix: teal_sinkholes small.rock 0.04 -> 0.015 and small.shard 0.08 -> 0.04.
- **saturn / gold_islands**: The foreground is one flat, saturated quin-gold wash (95th-percentile chroma 40, the highest outside Venus), with teal splinters scattered evenly like noise (shard 0.03, near.needle 1).
  - fix: gold_islands t.dil 0.42 with the ground order kept (the reverted try also reordered the washes, which is what flattened it). small.shard 0.03 -> 0.01 and near.needle 1 -> 0.

## weakest

[
 "venus/pale_mesas: one pale-yellow value from edge to edge (L p1 72), with no dark, no bands and no readable mesa. The stand is inside the fog layer, and t.fog paints all low ground to paper. It fails the freeze-frame test.",
 "earth/misty_wetland: a 'misty' wetland under Earth's clear blue sky with cumulus, a uniform field of pale reed blades, a dotted halftone on the near shallows, and nothing dark to rest on. It fails, and it sits on the showcase planet. Its data tries were reverted; it needs the shared per-biome sky haze.",
 "venus/lava_rivers: the named river is not in the frame (the stand lies in the lava, so the tour re-stands on the bank). Orange-dirt ground, near-black smooth lozenges, and the explorer in the middle. It fails.",
 "mercury/crystal_gardens: every crystal renders as the same saturated ultramarine plastic prism whatever its wash (shared twilight glaze). The garden is now sparse, with cream bone-flake splinters and the ship in view. It fails.",
 "neptune/aurora_tundra: nothing says aurora or tundra. A generic blue-green meadow under a peppery ultramarine sky that fills 60% of the frame, with the ship at the right. There is no aurora in the sky code.",
 "moon/rilles: the named rille is never in the frame. It is an empty pale plain under a crisp, unfaded horizon line (shared airless code), which reads as a lighter mare.",
 "saturn/gold_islands: the stand is on a barren shelf where nothing grows. Saturated flat gold with teal confetti, a boxy brown island table with a ruled top, and a muddy sepia ring streak.",
 "uranus/frozen_waves: the waves are seen along their crests and read as snow-capped peaks, and the ship fills the foreground. The named idea does not read.",
 "pluto/long_shadow_plain: no long shadows at all, an even field of smooth lilac boulders, and a heavy mottled sky over half the sheet.",
 "uranus/pearl_fog: an empty pale study with nothing for the eye to go to, an even stipple of pebbles, and the ship in view.",
 "saturn/crystal_reeds: one narrow mint-to-paper value range, no accent in view, a muddy mauve-brown scalloped cloud band, and flecks scattered like noise.",
 "earth/sea_coast: a barcode of vertical stripes on the cliff at about 250 m (terrain, persists with all flora hidden). There is no strong dark, and the cliffs do not read as cliffs from the stand."
]


---

# Cross-verifier verdicts

```json
{
 "items": [
  {
   "body": "earth",
   "biome": "temperate_forest",
   "verdict": "keep",
   "reason": "Before and after frames compared at full size, with a 2x crop of the top-left (/home/user/.pc-scratch/art/verify-earth/cmp-temperate_forest-tl.jpg). With vary 1 the left half of the far bank no longer stands as one row of white trunks of one height: crown bases now drop to different heights and fewer, varied trunks show. That addresses the lead's finding 4 in the stream vista. At the spawn (before-x h10 vs after-2 h10; after-2 has the same birch fields as final, checked by diff) the far-left fence is partly hidden and the near birches differ in height. The cost is real but smaller: the canopy in the top band is heavier and slightly darker (mean L 116 to 109, darks below 80 rise from 10.5% to 13.3%), and less sky shows through. It still passes the freeze-frame test, the named idea (birch and pine with dappled light and a stream) still reads, and the right half and the stream are unchanged. The body-wide warmer rock wash makes no visible difference to the bank pebbles here (crop cmp-tf-peb.png). On balance this is a modest gain. The obs 0.30 to 0.34 change is justified by the drawn flared base, and the world tests pass (I re-ran them: 19/19 on /home/user/.pc-scratch/art/earth/after).",
   "fix": "none (if PAINTER later wants a lighter canopy, try scale 1.1 instead of 1.25 on flora.tall[0]; vary alone already breaks the fence; not verified by me)"
  },
  {
   "body": "earth",
   "biome": "autumn_woodland",
   "verdict": "keep",
   "reason": "A clear improvement, judged on a 1.5x crop of the middle storey (cmp-aw-mid.jpg). In the before, a single row of white trunks of one height crosses the left half. In the after, trunks differ in height and young gold birches stand in front of the pines, so the wood now has depth layers (AB 5, AB 10: no repetition). The top-centre crown mass is a duller, heavier burnt sienna (top-band mean L 124 to 118), close to muddy but not worse than the before's brown crown at right. The stream liquid change makes the band lighter (median 134,116,98 to 147,129,110), not bluer as claimed: the hue ratio is unchanged. It is harmless and slightly closer to paper.",
   "fix": "none"
  },
  {
   "body": "earth",
   "biome": "alpine_meadow",
   "verdict": "fix",
   "reason": "The pass's changes help a little. The middle ground gains a band of dark dwarf shrubs (the frame's first darks, a real value step), and the ground reads as green turf rather than dry straw. The near meadow's value structure is unchanged (luminance std 11.1 vs 10.8), as the painter says. One thing got out of line with the group's own hand. The body-wide warmer rock wash turns the central boulder cluster into pinkish-beige lumps, lighter than their ground (rock 191,178,158 vs ground 166,175,114). That breaks the group's rule ('boulders a step below their ground, never paper-pale') and clashes with this biome's cool palette (neutral tint, cobalt blue, cobalt violet). I ran one verification shot at the tour's exact stand (same query, teleport, hour 10, settle) on base plus the final earth/moon plus the change below (/home/user/.pc-scratch/art/verify-earth/fix-alpine.jpg; comparisons cmp-al-fix-mid.png and cmp-al-fix-rock.png). The cluster becomes cool granite grey with violet shadow (172,167,160, about level with the ground instead of above it) and nothing else in the frame changes (near-ground mean identical to 0.1). The shot exited with no console problems.",
   "fix": "src/data/looks/earth.js, biome alpine_meadow extra: add under: { rock: [[0.66, 0.67, 0.72], [0.38, 0.39, 0.48]] } (a biome-level rock wash merged over flora.under; verified in fix-alpine.jpg). One notch darker, [[0.60,0.61,0.66],[0.34,0.35,0.44]], would put the rocks a full step below the turf, but I did not test it."
  },
  {
   "body": "earth",
   "biome": "sea_coast",
   "verdict": "revert",
   "reason": "The worst artefact in the frame got worse. t.patch has no slope gate in surface.js (only the islands recipe gates it). So the dark olive patch [0.50,0.58,0.36] also lands on the cliff face, and the cliff-form shade wash then deepens it: the vertical barcode inside the arch about 250 m off is now darker, greener and crisper. Measured on the same crop (cmp-sc-cliff.jpg, cmp-sc-cliff-iter.jpg): stripe column contrast went from std 7.0 to 10.0, and the darkest stripe from L 179 to 147. It grows step by step with patch strength: after-1 (amt 0.5) gives 8.8/159, final gives 10.0/147. The gain on the hills is a faint mottle. The near shingle changes from soft paper glints to a large paper patch with hard dark olive blotches, which is at best neutral. By the rule (nothing in the frame may get worse; when in doubt, revert), the patch goes. The barcode itself is base terrain (confirmed in the painter's no-flora probe) and stays a wish for PAINTER.",
   "fix": "src/data/looks/earth.js, sea_coast: restore the base t: { cliff: 52, stacks: 0.5, strata: 0.5 } (remove both patch entries). Everything else in the biome is already base."
  },
  {
   "body": "earth",
   "biome": "desert_canyon",
   "verdict": "keep",
   "reason": "A clear improvement. The big pale orange lozenge with the crisp outline, the most digital object in the before, is gone. The remaining boulders are fewer and a sienna step darker than the ochre floor, in line with the group's rule, and the floor reads as a plain under the banded walls. Nothing got worse. The frame is a little emptier in the foreground, but the walls and shrubs carry it. The remaining smooth lozenge shape and the near-black shrubs are shared kit issues.",
   "fix": "none"
  },
  {
   "body": "earth",
   "biome": "misty_wetland",
   "verdict": "keep",
   "reason": "Every wetland field matches base 8f23067 (diff checked). The after frame is practically identical to the before. The only differences are a ghost birch in the mist (body-wide vary) and slightly warmer pebbles (body-wide rock wash), and neither is worse. The reverted state is right. I agree it still fails the freeze-frame test: a clear blue sky with cumulus over a 'misty' wetland, a uniform field of pale reeds, and a halftone dot pattern in the near shallows. None of the biome fields can fix the sky (sky keys are per body), so the painter's wish to PAINTER is the right route.",
   "fix": "none"
  },
  {
   "body": "moon",
   "biome": "mare",
   "verdict": "keep",
   "reason": "The biggest gain in the group. The huge pale slabs with hard violet rims that filled the before's foreground are gone. The mare is now a cool mid-grey plain with dark pebble touches and a smaller, greyer horizon row, so it reads as a quiet silver wash study and is clearly darker than the highlands. Nothing got worse. The crisp horizon (an airless body gets no fade) and the view away from Earth are shared-code issues, correctly filed as wishes.",
   "fix": "none"
  },
  {
   "body": "moon",
   "biome": "highlands",
   "verdict": "keep",
   "reason": "The white soap lumps with blue-violet shadows are now grey stones in the ground's own value, and fewer of them. The bright, warm paper-grey ground keeps the biome distinct from the dark mare. Still borderline: the near boulder is a big smooth lozenge with a crisp rim and paper streaks, and a cluster crowds the left (shared rock geometry). Still, it is better than before in every part of the frame.",
   "fix": "none"
  },
  {
   "body": "moon",
   "biome": "crater_fields",
   "verdict": "keep",
   "reason": "A modest but real improvement. The blocks below the crater-rim skyline are fewer and grey instead of white with violet rims, and the warm tint of the plain is gone. The rim skyline, the biome's named feature from this stand, still reads. The right-hand cluster and the crisp block outlines remain (shared).",
   "fix": "none"
  },
  {
   "body": "moon",
   "biome": "rilles",
   "verdict": "keep",
   "reason": "The frame-filling field of pale soap lumps is gone, leaving a clean pebbled plain that passes as a quiet wash. The named feature was missing before and still is (no rille in view: a stand/vantage issue in shared code). The after looks more like a lighter mare than a distinct biome, but the before looked like the highlands, so distinctness is no worse. The even scatter of dark pebble touches is a near-ground (shared) pattern.",
   "fix": "none"
  }
 ],
 "summary": "Cross-check of group \"earth\" (Earth and the Moon) by verifier \"inner\". I opened every evidence pair and every full-size before/after frame, plus crops and measurements in /home/user/.pc-scratch/art/verify-earth/. Verdicts: 8 keep, 1 fix, 1 revert.\n\n- **Keep:** temperate_forest, autumn_woodland, desert_canyon, misty_wetland (already back to base), and all four Moon biomes.\n- **Fix:** alpine_meadow. The body-wide warmer rock wash makes its boulders pinkish-beige and lighter than the turf. That breaks the group's own rule and the biome's cool palette. A biome-level cool grey rock wash fixes it, and I verified that with one shot at the tour's exact stand (fix-alpine.jpg; exit 0, no console problems, the process ended and none of mine is left running).\n- **Revert:** sea_coast's t.patch. Patches are not slope-gated, so the dark olive patch lands on the cliff and the form wash deepens it: the base terrain's barcode stripes get clearly stronger (contrast std 7.0 to 10.0, darkest stripe L 179 to 147), and they grow step by step with patch strength across after-1 and final. The hill mottle gained is small.\n\n**One hand:** the Moon and Earth do read as one painter. Boulders are thinned and toned to their ground (Earth umber-grey, desert sienna, Moon neutral grey, mare basalt) and patches are colour only. The two exceptions are the ones above: alpine's pink boulders, and the coast patch leaking onto the cliff faces.\n\n**Claims I checked:**\n- Both after trees are base 8f23067 plus only earth.js and moon.js (diff -rq).\n- seed, seaLevel, sites, phys and the terrain recipes are unchanged.\n- The wetland fields equal base.\n- I re-ran the world tests on /home/user/.pc-scratch/art/earth/after: 19 pass, 0 fail.\n- One claim is inaccurate: autumn's new stream liquid is lighter, not bluer (same warm hue ratio), which is harmless.\n\nThe painter's wishes stand: Moon facing Earth, airless haze, the coast cliff barcode, lobed flower heads, dry-brush boulders, per-biome sky haze for the wetland, the halftone shallows, near-meadow value structure, the night key, and teleport vs solar hour. I edited no project file; the only edited copy is the scratch tree /home/user/.pc-scratch/art/verify-earth/tree-fix (base plus the final looks plus the alpine rock line)."
}
```

```json
{
 "items": [
  {
   "body": "mercury",
   "biome": "ochre_basins",
   "verdict": "keep",
   "reason": "Before had two soap boulders (cream top, violet base, crisp outline). After they are gone, and the stones that are left sit in the ochre/sepia palette. The crack pattern, the far rim, the sky and the value structure are unchanged, and nothing in the frame got worse. Each row band of the image stays within a few levels of the before frame. The basin rim's dot scatter is thinner but still there. That and the dull mauve upper sky are shared-code or sky matters, not regressions.",
   "fix": ""
  },
  {
   "body": "mercury",
   "biome": "obsidian_fields",
   "verdict": "keep",
   "reason": "Clearly better. The before frame was cluttered: a dark-dot stipple, white needle cones, a fence of grey spikes and pale lozenge rocks, on pale grey ground that did not read as glass. After is a quiet slate-indigo glass plain with cracks and grouped blades (ground mean about 80 against 104 before, never near-black). The dusk frame (18 h) reads well. Remaining weakness: the band just below the horizon is still the darkest ground, so atmospheric perspective runs the wrong way at the skyline, and the blades are pale-ish smooth solids. Both were already true before. The horizon is only about 87 m away on this 2.2 km world, so a mist value strong enough to lift it would also fog the middle ground. That makes it a shared-pipeline matter, not a one-field data fix.",
   "fix": ""
  },
  {
   "body": "mercury",
   "biome": "crystal_gardens",
   "verdict": "fix",
   "reason": "Keeping the direction is right. Before was a dense, saturated ultramarine plastic spike field to the horizon, the most game-like frame in the group. After has clusters with open ground, and the crystals still read across the far band, though thinner. But the after frame has a new defect: a patch of cream bone-flake splinters in the right foreground. They come from the near layer's needle touches. They break the group's own rule ('spiky undergrowth sparse, in the palette, never white'), and obsidian_fields and polar_frost already set needle to 0 for the same reason. I settled it with one quick shot from the tour's own stand: /home/user/.pc-scratch/art/verify-inner/shot/mercury-crystal_gardens-needle0.jpg (base 8f23067 plus the current mercury.js, with only needle changed). The splinters are gone and nothing else in the frame changes (about 1% of pixels differ, all in that patch). Still weak: the crystals render the same ultramarine whatever their wash (the rose/gold kit washes have no visible effect at noon; this needs the shared glaze wish), the ship sits large in view, and tallD 0.11 is on the thin side for a 'garden'.",
   "fix": "src/data/looks/mercury.js, crystal_gardens: near.needle 2 -> 0 (near becomes { crust: 5, needle: 0, dab: 1 }); leave everything else as is"
  },
  {
   "body": "mercury",
   "biome": "shadow_craters",
   "verdict": "keep",
   "reason": "Reverted to the base fields: that line of mercury.js is unchanged from 8f23067, and the frame is pixel-identical to before (mean difference 0.16). Reverting was right, since the frost-crust attempt rendered as green lichen. It stays borderline: muddy near rim with pale flecks, heavy even mauve sky.",
   "fix": ""
  },
  {
   "body": "venus",
   "biome": "fungal_towers",
   "verdict": "keep",
   "reason": "Not touched, and no Venus body-level field changed. The frame matches before (mean difference 1.1, which is noise). It is still one of the strongest frames: cream ringed stalks, sepia/maroon caps, amber cloud washes on paper. The busy wall of towers and the flat maroon shade blob are as before.",
   "fix": ""
  },
  {
   "body": "venus",
   "biome": "lava_rivers",
   "verdict": "keep",
   "reason": "Same moved stand before and after, so the comparison is fair. About twelve smooth grey boulders, a colour not in the palette, became four or five dark basalt stones in sepia/Payne's grey. The bank and slope are much less cluttered. The darkest stone is a dense sepia (2nd percentile about 36,21,28), not black. The frame still fails because the stand is in the lava and the river is out of view (the shared easels wish), and the stones are still smooth lozenges (the shared rock-geometry wish). Nothing got worse.",
   "fix": ""
  },
  {
   "body": "venus",
   "biome": "acid_terraces",
   "verdict": "keep",
   "reason": "Slate-grey pebbles that were outside the palette are now warm umber and sit in the ochre tread. The two dark spikes that broke the ridge skyline are gone. Sky, pool and far terraces are unchanged. A small but real improvement with no losses. The flat even green pool remains, and liquid refl had no visible effect, so reverting it was right.",
   "fix": ""
  },
  {
   "body": "venus",
   "biome": "pale_mesas",
   "verdict": "keep",
   "reason": "A marginal gain. The ruler-straight row of near-identical lumps along the mesa lip is thinned, and the big pale lozenge in the centre is gone, which removes a 'nothing ruler-straight' violation. The frame lost a few mid-value notes, but those lumps were never good structure. Both frames fail for the same reason: the stand sits inside the fog band, so the frame has one pale yellow value range (the shared fog/stand wish). The change is right but small.",
   "fix": ""
  },
  {
   "body": "mars",
   "biome": "rust_canyons",
   "verdict": "keep",
   "reason": "Clearly better. The big flat maroon cut-out bush at the lens and the speckled shrubs are gone. The remaining stones are fewer and rust-toned, not pale peach plastic. Banded walls and sienna spires now carry a calm composition. The rock wash is set body-wide, and its effect on dry_riverbeds is also an improvement. Still weak: smooth rounded spires and stones, grey-pink far walls.",
   "fix": ""
  },
  {
   "body": "mars",
   "biome": "dust_dunes",
   "verdict": "keep",
   "reason": "lee 0.7 lays a cool rose-violet glaze on the slip face (left) and the far side of the near crest, which gives the frame a third value, as the bible's 'shadows are cool glazes over local colour' asks. The patch on the right near slope is a little blotchy and greyish, but the crest line still reads crisply. At 18 h it is richer, and at 23 h it is the same as before. A net gain.",
   "fix": ""
  },
  {
   "body": "mars",
   "biome": "polar_frost",
   "verdict": "keep",
   "reason": "Clearly better. The mint ground with green crack lines (mint was not even in the biome's pigment list) is now blue-white frost with cobalt polygon cracks, all inside the named palette. The even white/blue needle stipple and the two saturated purple lens shards are gone. It is better at 18 h and 23 h too. Still weak: a large, quiet plane, a few small violet tufts on the horizon, and the ship in view.",
   "fix": ""
  },
  {
   "body": "mars",
   "biome": "dry_riverbeds",
   "verdict": "keep",
   "reason": "At 2x zoom, the grove crowns are softer layered dab masses with fewer pixel holes. The pale peach lozenge boulders among the trees are gone. The straw field and sky are unchanged. A modest, clean improvement. The crisp straw dashes and half-moon marks in the foreground, and the riverbed reading only as a pale band, are the same as before.",
   "fix": ""
  }
 ],
 "summary": "I checked all 12 inner-group biomes: 11 keep, 1 fix, 0 revert. I opened every evidence pair and the full-size before and after tour frames, plus the dusk and night frames, zoomed crops and per-band measurements. I edited no project file. The one fix is mercury/crystal_gardens: set near.needle from 2 to 0. The kept after frame shows new cream bone-flake splinters in the foreground. They break the group's own rule ('undergrowth never white'), and the sibling biomes obsidian_fields and polar_frost already use needle 0 for the same reason. I confirmed it with one quick shot from the tour's own stand: the splinters go and nothing else in the frame changes. The shot is /home/user/.pc-scratch/art/verify-inner/shot/mercury-crystal_gardens-needle0.jpg and the comparison is /home/user/.pc-scratch/art/verify-inner/crystal-after-vs-needle0.jpg. Clearest gains: mercury obsidian_fields, mars rust_canyons, mars polar_frost (the frost ground is now inside its own pigment list) and mercury ochre_basins. Small, clean gains: venus lava_rivers, venus acid_terraces, mars dry_riverbeds, mars dust_dunes. The pale_mesas gain is marginal. shadow_craters and fungal_towers are identical to before, as they should be. One hand: yes. The three worlds share one policy: fewer boulders washed in the ground's own colour with a sepia or basalt base, sparse spiky undergrowth in the palette, the darkest notes kept to small sepia-indigo shapes, and skies and far bands left alone. The crystal_gardens splinters were the only break from it. Weakest frames, unchanged by data: venus/lava_rivers (the stand is in the lava, so the river is out of view), venus/pale_mesas (the stand is inside the fog, one value range), and mercury/crystal_gardens (the crystals all render ultramarine because the shared shadow glaze swamps their washes). The group's wishes for PAINTER (easels, fog, glaze, rock shape, night grade) are the right levers for those. A smaller point: obsidian_fields still has its darkest ground at the skyline, as it did before. Its horizon is only about 87 m away, so no mist value fixes that without fogging the middle ground. I re-ran node --test src/world/*.test.mjs on the inner after tree independently: 19 pass, 0 fail. The quick shot ran in its own scratch tree at /home/user/.pc-scratch/art/verify-inner/tree (base plus the current body files, needle changed). It was my only browser and it has exited, so nothing is left running."
}
```

```json
{
 "items": [
  {
   "body": "jupiter",
   "biome": "sky_islands",
   "verdict": "keep",
   "reason": "The tour frame changes only a little, but nothing in it got worse. The boulders are now mid-value rose-violet where they were the palest ochre lozenges in the frame. The top-left edge of the near crown has slightly fewer specks, and the far slope warms toward the sky. The real gain shows at the easel (chk/base- vs after-jupiter-isl_easel-h10.jpg). The island cliff goes from an olive-grey block with ruled stripes to a warm sienna-violet face that sits in the cream and orange belts. That fixes the painter's own M3 note ('cliffs are olive grey') and softens the lead's ruled-stripe finding. The idea still reads: green tops, islands in cloud. Still weak, and not fixable in data: the near crown seen from below is a near-black slate mass with leopard-spot paper holes, and the cliffs are boxy.",
   "fix": ""
  },
  {
   "body": "jupiter",
   "biome": "storm_wall",
   "verdict": "keep",
   "reason": "I opened both full frames and a 2x crop of the foreground. The pale ochre boulders were the brightest note in the frame, a ruled row along the spires. They are now grey-violet stones that read as cool glaze against the red. The 80 m flat burnt-sienna plain now carries soft drifts: a cool violet-grey one to the left, a warmer one to the right, and a darker grit patch. The broken colour is visible and still harmonious. The 18:00 pair is equal; the olive-grey wall at dusk comes from the shared haze and is the same before and after. It stays clearly the red biome. Still weak: the spires are identical cones in a row, and the storm cannot be seen in fair weather.",
   "fix": ""
  },
  {
   "body": "jupiter",
   "biome": "hanging_gardens",
   "verdict": "keep",
   "reason": "Before, a dense band of scarlet-pink confetti ran across the whole middle distance. After, there are sparse rose and cream flowers over a slightly richer meadow with soft gold and viridian drifts. The eye now goes to the vine curtains, which are the named feature. The accent is roseMadder alone, which matches the biome's palette (limited-palette rule). Nothing got worse: the bushes, trees and curtains are unchanged. The foreground is still a broad pale green crossed by crisp blades, and the vine blossoms are large pink flakes; both come from the shared kit.",
   "fix": ""
  },
  {
   "body": "jupiter",
   "biome": "lightning_plains",
   "verdict": "keep",
   "reason": "The ground goes from an ochre desert to a violet-grey plain. The lemon needles were lost against the ochre before; they now carry the accent. The cracks are indigo, not black, and the far ground fades lighter and cooler. I worried the lavender would look like a filter, but measured it is a greyed violet (HSL saturation 0.09, against 0.33 before), and it reads as a cool wash under the warm rose sky. It now stands apart from storm_wall's red and from the ochre deserts on other worlds. At 18:00 the plain is deep violet with gold needles under a gold sky and is not muddy. The ground is still one value from near to far. Ground patches like storm_wall's might break it up later, but I cannot show they would clearly help, so I am not asking for them.",
   "fix": ""
  },
  {
   "body": "saturn",
   "biome": "gold_islands",
   "verdict": "keep",
   "reason": "Keeping the revert is right. Note that the saturn after-tour ran at 06:04 with an intermediate saturn.js (gold_islands dil 0.38 and honey_mist patch, as in after-s3) before the final file was copied at 06:18. So after-tour/saturn-biome-gold_islands.jpg is the tried frame, not the kept state. The re-render with the final data (chk/after-saturn-gold_islands.jpg, 07:07) is visually identical to before (RMSE 0.018). The softer broadleaf leafP changes nothing visible from this stand. The tried paler meadow was not clearly better, so 'when in doubt, revert' applies. Still the weakest frame in the group: one saturated quin-gold wash (ground saturation 0.62) with even teal splinters, and a boxy far table, but no single data change clearly fixes it.",
   "fix": ""
  },
  {
   "body": "saturn",
   "biome": "crystal_reeds",
   "verdict": "keep",
   "reason": "Keeping the revert is right. after-tour/saturn-biome-crystal_reeds.jpg is the final data, and it matches before except for render noise. The tried lemon patch and rose flowers in the pair's right half turned the cool mint field into a yellow meadow with even red confetti, which would break the biome's idea. The kept frame is a harmonious pale mint study with indigo-edged near reeds. It is weak on value range (mint to paper, no accent in view), but no data change was shown to help.",
   "fix": ""
  },
  {
   "body": "saturn",
   "biome": "ring_shadow",
   "verdict": "fix",
   "reason": "At noon the after is better: the spires go from saturated cartoon cobalt violet (saturation 0.28) to muted slate violet (0.14) with warm-lit tips, and the ground is cooler. At 18:00 it is clearly worse. I cropped base, after and the painter's own 'mid' try (chk/*-saturn-ring_shadow-h18.jpg). The base spires have violet shadow glazes on their shaded sides. The final spires are flat, saturated orange-peach cut-outs (saturation 0.44, value spread 0.035 against 0.044): the cartoon fault has moved from violet at noon to orange at dusk, and the 3-4 value steps are lost. The mid variant (after-s5, which differs from final only in the spire washes) brings back the violet shading at dusk, close to base (chk/mid-saturn-ring_shadow-h18.jpg). It keeps about two thirds of the noon desaturation (0.19 against 0.28 before; chk/mid-saturn-ring_shadow.jpg) and reads more strongly as a cool twilight zone. The ground and boulder edits are fine as they are.",
   "fix": "src/data/looks/saturn.js, flora.tall[2] (kit 'spire'): set bark to [[0.84, 0.80, 0.84], [0.52, 0.48, 0.58]] and leaf to [[0.84, 0.80, 0.84], [0.68, 0.64, 0.72], [0.52, 0.48, 0.58]]. These are the painter's tried 'mid' washes: a cooler, slightly more violet middle and dark than the final stone [0.72,0.68,0.70]/[0.58,0.53,0.55], so the shaded sides keep a violet glaze at dusk. Leave everything else in ring_shadow as it is now."
  },
  {
   "body": "saturn",
   "biome": "honey_mist",
   "verdict": "keep",
   "reason": "The kept-state frame is chk/after-saturn-honey_mist.jpg (the after-tour frame used the intermediate file with a ground patch). In a 1.6x crop the gold crowns become fuller, softer wet-edged masses. The specks and cut-out edges the lead flagged (finding 5) are mostly gone, and the darkest specks lift (crown minimum value 0.09 to 0.15). Mean saturation and value are almost unchanged, so they are not muddier. Small cost: one mid tree loses some branch structure and the left crowns read a touch heavier. The ring arc and palette are unchanged, and the 18:00 pair is equal. Still weak: the ridge crest is ruled, and the ochre foreground is flat with even stipple.",
   "fix": ""
  }
 ],
 "summary": "Cross-verification of group 'giants' (jupiter, saturn) by the ice group. I edited no files. Scratch: /home/user/.pc-scratch/art/verify-giants (crops, montages, and a base+final tree used for the tests). I opened every evidence pair and the full-size before and after frames, plus the painter's chk dusk, easel and 'mid' renders. Biomes that kept a change were compared in crops; the reverted ones at full frame.\n\nVerdicts: 7 keep, 1 fix, 0 revert.\n- Keep: all four Jupiter biomes, which are improved. The clearest gains are sky_islands' warm cliffs (seen at the easel), storm_wall's broken plain colour with the boulders no longer pale lozenges, hanging_gardens without the confetti band, and lightning_plains as a greyed-violet plain where the lemon needles finally read.\n- Keep: Saturn honey_mist (softer crowns, fewer specks) and the reverts of gold_islands and crystal_reeds (both kept states match the base).\n- Fix: Saturn ring_shadow. The warm-stone spires help at noon, but at 18:00 they turn into flat, saturated orange cut-outs with no violet shading. The painter's own tried 'mid' spire washes (bark [[0.84,0.80,0.84],[0.52,0.48,0.58]], leaf [[0.84,0.80,0.84],[0.68,0.64,0.72],[0.52,0.48,0.58]]) bring back the dusk shading close to base and keep most of the noon gain (chk/mid-saturn-ring_shadow*.jpg).\n\nProcess note: the saturn after-tour (06:04) ran before saturn.js reached its final form (copied at 06:18; the run used the after-s3 variant with gold_islands dil 0.38 and a honey_mist patch). Its gold_islands and honey_mist frames are therefore the tried state. The painter correctly used the chk re-renders (07:05) for those two, and the ring_shadow and crystal_reeds tour frames do match the final data.\n\nOne hand: yes, broadly.\n- Both bodies have darks lifted to indigo or sepia, rocks moved toward mid-value violet-grey, foliage edges softened, and one sparse accent per biome.\n- Jupiter is the warmer, bolder planet and Saturn the paler, more muted one.\n- The leafP values differ on purpose: drier on Jupiter so the near crown keeps its dabs, wetter on Saturn.\n- One overstatement in their summary: ring_shadow's ground is grey-brown at noon, not a violet wash like lightning_plains, because the twilight biome takes the gold dusk grade. That is covered by their wish for a cool twilight key in src/world/index.js (blendKeys/twilight), not by a data mismatch.\n- Weakest in the group: gold_islands (a flat saturated gold wash on a bare shelf, under a boxy far island), then crystal_reeds (narrow value range, no accent in view).\n\nThe shared-code wishes they listed (island cliff shape, near-crown glaze and holes, vine blossoms, spire silhouettes, twilight key, shadowed ring glaze, ridge crest, boulder dry brush, orbit framing) match what the frames show.\n\nTests: node --test src/world/*.test.mjs on 8f23067 plus the final jupiter.js and saturn.js passes 19 of 19. I ran no browser and left no process running."
}
```

```json
{
 "items": [
  {
   "body": "uranus",
   "biome": "ice_shelves",
   "verdict": "keep",
   "reason": "I compared the full-size before and after frames and a 2x crop. The shelf used to be a pale hill with a ruler-straight top. Now it reads as a cliff-faced table: there is a dark recess under the lip, a ragged edge, and a cool violet-grey wall that steps back in value. That gives the frame the darker middle step the lead's review 6 (item 8) asked for. The round teardrop cones that read as snowy firs are now leaning, slim needles with paper tips. They read as ice, and they match Neptune's spires and Pluto's penitents (one hand). The darker stones turn the right half of the near ice into an even scatter of grey flat dabs (crop: /home/user/.pc-scratch/art/verify-ice/shelf_crop.jpg). It is soft and much milder than on teal_sinkholes, so it does not undo the gain. Nothing else got worse.",
   "fix": "none"
  },
  {
   "body": "uranus",
   "biome": "frozen_waves",
   "verdict": "keep",
   "reason": "The wave kit and the biome entry are back to base. I diffed the file against 8f23067: only the body-wide hue drift and the stone colours still apply. The final quick shot and the before frame are practically identical at full size, so the revert was the right call. The named idea still does not read: from this stand the waves look like a snow-capped range and the ship fills the foreground. The waves need the shared-code wish (florakit waveGeometry, or the wave yaw). Data cannot fix it.",
   "fix": "none"
  },
  {
   "body": "uranus",
   "biome": "pearl_fog",
   "verdict": "keep",
   "reason": "Before, the ground was one sickly mint-yellow under the mint sky. After, it is pale rose with lilac shards under the mint sky, a complementary harmony that reads as mother-of-pearl. It now stands clearly apart from the mint shelves. The paper light is kept, the fog band is unchanged, and the stones loom a step darker. Weak spots I see in the 2x crop (/home/user/.pc-scratch/art/verify-ice/pearl_crop.jpg): the near foreground leans a little peach, the mint patch barely shows, and there is a light scatter of small grey pebbles on the path. It is still an empty pale study with the ship in the frame, but nothing got worse.",
   "fix": "none"
  },
  {
   "body": "uranus",
   "biome": "teal_sinkholes",
   "verdict": "fix",
   "reason": "Removing liquid.glow was correct: I read materials.js around lines 400-404, and glow is the lava branch (scarlet by the banks, paper-yellow where hot). The scarlet-brown bank and the yellow streaks are gone, the pool is the named teal, and the paper-white marshmallow boulders now sit a step below the ground with a dark lee. One thing got clearly worse. The biome's new dark stone colour [0.24,0.44,0.52] also feeds the near-ground pebble dabs (nearground.js: 60% of pebbles take rock[1], mixed 50% with the ground). The whole slope is now covered by a dense, even polka-dot field of dark dabs, a mechanical pattern against AB 4 ('near things get a few crisp accents'). Crop: /home/user/.pc-scratch/art/verify-ice/teal_crop.jpg. This is the same problem the painter found on lilac_mountains and fixed there by cutting dab to 1. I ran one quick shot of base plus the final three look files plus near: { dab: 1 } on this biome, from the tour's stand at hour 10. It halves the stipple and leaves the boulders, the pool and the slope unchanged. Frame: /home/user/.pc-scratch/art/verify-ice/shot/uranus-biome-teal_sinkholes.jpg; crop of the after against the fix: /home/user/.pc-scratch/art/verify-ice/teal_fix_crop.jpg. World tests on that tree: 19 of 19 pass. A thinner scatter of pebbles is still visible.",
   "fix": "src/data/looks/uranus.js, teal_sinkholes biome entry: add near: { dab: 1 } (the default here works out to 2), the same treatment as pluto lilac_mountains. Leave the biome's under.rock as it is, so the boulders keep their dark lee."
  },
  {
   "body": "neptune",
   "biome": "storm_seas",
   "verdict": "keep",
   "reason": "The headland was a pale grey plaster wall close to the sky's value. It is now a dense Payne's grey basalt mass with visible beds, so it reads as rock and the stacks and far headlands step back in value. The sea, the stacks and the shingle are unchanged. The sepia band at the waterline is in both frames: it is the shared uBed, so it is not a regression. The two pale strata stripes are a little long and level but soft. Weather (the biome is named for storms) was not looked at by the painter. I did not look at it either.",
   "fix": "none"
  },
  {
   "body": "neptune",
   "biome": "kelp_forests",
   "verdict": "keep",
   "reason": "It is a modest but real gain. Before, the whole frame was one violet. After, the floor is a blue-green moss under violet kelp with violet hollows, so the frame has two hues. The kelp is a touch lighter at the tips, and the sea pinks still carry the accent. The kelp forms and their count in this view are unchanged, and nothing got worse. The remaining violet glaze over the top half comes from the shared canopy-shade term (the painter's wish about surface.js 'leafy').",
   "fix": "none"
  },
  {
   "body": "neptune",
   "biome": "ice_spires",
   "verdict": "keep",
   "reason": "The ochre stains on the snow mound came from the default warm hue drift, not from the biome's pigments. They are gone, and the mound is a clean pale lilac-grey. The spires are a little larger with a deeper cobalt lee, so the named feature is a touch stronger at the right. The near shard field looks about the same. The frame is now nearly monochrome blue: some warm-cool play is lost with the ochre, but that is in palette now. It is at least as good as before. The spires still sit behind the mound at the frame edge, which is a stand problem.",
   "fix": "none"
  },
  {
   "body": "neptune",
   "biome": "aurora_tundra",
   "verdict": "keep",
   "reason": "The biome entry is reverted to base. Only the body-wide hue drift and a tiny horizon change apply, and the before and after frames are essentially identical at full size. The revert was correct: the painter's tried variants (blotched wrack, then identical-looking lichens) were not clearly better. Nothing of 'aurora' is in the frame, which needs the shared sky wish.",
   "fix": "none"
  },
  {
   "body": "pluto",
   "biome": "heart_glacier",
   "verdict": "keep",
   "reason": "This is a clear gain. Before: a green-yellow ground off the Pluto palette, plus a thicket of penitents near the eye. After: cream and pale rose nitrogen ice with rose polygon cracks, an open foreground, and a lighter indigo sky with a blue-lilac haze band that lets the far band fade. The stones are now lilac-grey with a dark lee. They read more solid than before but are no longer paper blobs, which is what review 6 finding 2 asked for. I also opened the dusk and night frames (final/pluto/...-h18, -h23). Night passes. Dusk reads as gold, but the upper sky is a heavy muddy sepia with mottling. That is shared sky code, and the base dusk was not rendered for comparison.",
   "fix": "none"
  },
  {
   "body": "pluto",
   "biome": "lilac_mountains",
   "verdict": "keep",
   "reason": "I judged the final quick shot (dab 1) and also compared it with the after-tour frame (dab 3): cutting dab to 1 visibly removed the dark stipple. Compared with before, the busy white shard clumps and the crisp paper-white slab at the lower right are gone, and the boulders are lilac-grey stones rather than marshmallows. The slope is calmer and the far rose hill and the dark sky are unchanged. New in the frame: two cobalt penitents cut by the lower-right corner, where the slab used to be. That is a compositional flaw of about the same weight as the slab it replaced, so I do not count it as a net loss. The slope reads taupe-grey more than lilac, as it did before.",
   "fix": "none"
  },
  {
   "body": "pluto",
   "biome": "long_shadow_plain",
   "verdict": "keep",
   "reason": "The green-grey ground is gone and the plain is a coherent lilac-grey with fewer near boulders. The hue is right for Pluto. The frame is now very close in value and hue from sky to ground to stones: the white boulders that were the paper light before are mid-value now, but the pale near ground keeps a light, so it is not worse. The named idea, long shadows, does not read in either frame. The painter correctly removed the murky twilight try, and the fix needs the shared light and shadow wish. The boulders are still smooth, evenly spread blobs.",
   "fix": "none"
  },
  {
   "body": "pluto",
   "biome": "nitrogen_dunes",
   "verdict": "keep",
   "reason": "The named feature now reads: a dune crest with a shaded slip face stands in the view where before there was only a gentle slope. The green-yellow ground and the big near penitent slabs are gone. Weak spot: the ground is a drab neutral grey (2x crop: /home/user/.pc-scratch/art/verify-ice/dunes_crop.jpg). In the dunes recipe (surface.js ~line 497) t stays around 0.2-0.85, so the MIDDLE wash dominates, and here that is neutralTint. The painter's own kelp note says the middle wash dominates. A follow-up worth trying is ground ['cobaltViolet','cobaltBlue','roseMadder'], which should give nitrogen-ice blue backs and set the dunes apart from long_shadow_plain's lilac-grey. I did not shoot it, so it is not a verified fix. It is still better than before.",
   "fix": "none"
  }
 ],
 "summary": "I checked the ice group's pass (Uranus, Neptune, Pluto; 12 biomes). Eleven are keep and one is fix: teal_sinkholes needs one small data change, which I tested. Nothing needs reverting.\n\n**How I checked**\n- For every biome I opened the evidence pair and the full-size before and after frames. I looked at 2x crops where it mattered and at a 12-frame montage of the kept state (/home/user/.pc-scratch/art/verify-ice/group_after.jpg).\n- I diffed the three look files against 8f23067. seed, seaLevel, phys and sites are unchanged, and the repo copies are identical to the painter's after tree.\n- In materials.js I confirmed that liquid.glow is the lava branch, so removing it from teal_sinkholes was right.\n\n**The one fix: teal_sinkholes**\n- The darker stone colours also darken the near-ground pebble dabs. On teal_sinkholes that covers the slope with a dense, even field of dark dots.\n- The painter hit the same problem on lilac_mountains and cut dab there, but did not do the same here.\n- My one quick shot (base plus the final look files plus near: { dab: 1 }, tour stand, hour 10) halves the stipple and changes nothing else. World tests on that tree pass, 19 of 19. No browser or process of mine is left running.\n\n**One hand across the group: yes**\n- Paper-dominant pale washes.\n- The same leaning ice-needle vocabulary on all three worlds: Uranus needles, Neptune spires, Pluto penitents.\n- Stones a step below their ground, which follows review 6 finding 2.\n- One dense dark per biome.\n- Neptune's saturated ultramarine sky stands apart, but that is the world's identity, not a mismatch.\n\n**Still weakest**\n- **frozen_waves:** the waves read as snow-capped peaks.\n- **aurora_tundra:** a generic meadow with no aurora.\n- **long_shadow_plain:** casts no shadows.\n- **teal_sinkholes:** the pool does not glow.\n\nAll four need shared code, and the group's wishes cover them.\n\n**Data-only follow-ups**\n- **nitrogen_dunes:** the ground is drab grey because the dunes recipe lets the middle wash (neutralTint) dominate. Try ground ['cobaltViolet','cobaltBlue','roseMadder']; I did not shoot it.\n- **ice_shelves and pearl_fog:** both have a milder pebble scatter that could take the same dab cut.\n\n**Not looked at by anyone**\n- Weather and motion on any of the three bodies.\n- Dawn on all three bodies.\n- Day-night on Uranus and Neptune.\n\nMy scratch files are in /home/user/.pc-scratch/art/verify-ice/."
}
```


---

# Fixers

```json
{
 "group": "earth",
 "biomes": [
  {
   "body": "earth",
   "biome": "temperate_forest",
   "verdict": "improved",
   "changes": "Applied the same-painter fix as given. Conifer (flora.tall[1]) leaf[2] [0.17,0.28,0.35] -> [0.24,0.34,0.42]. Birch (flora.tall[0]) leaf[2] [0.31,0.51,0.37] -> [0.40,0.58,0.42]. temperate_forest mist 1.25 -> 0.95 (comment updated). vary 1, scale 1.25 and obs 0.34 are unchanged. Re-shot at the tour's own stand (planPlaces lifted verbatim from tests/tour.mjs, hour 10, fair). At full size the near-black pine washes at the left are now slate green-blue, and the back of the wood steps paler and greyer between the trunks, so there are now stacked bands where there were none. Whole frame against the painter's after: p5 L 33.1 -> 35.9, median 50.3 -> 52.8. Upper-left canopy p5 30.0 -> 33.2. Nothing got worse. The stream, birches and floor are unchanged.",
   "pair": "docs/shots/art/earth/temperate_forest.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/earth/before/earth/earth-biome-temperate_forest.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/earth/fixer/final/earth-biome-temperate_forest.jpg",
   "freezeFrame": "borderline",
   "weakest": "It is still the lowest-key daylight frame in the game. There is no bare paper anywhere (p99 L 75.5) and the median is L 53. The scale-1.25 canopy closes the sky that base showed at the top. For forest terrain tallD is ignored, so the canopy cannot be opened per biome from data (see wishes)."
  },
  {
   "body": "earth",
   "biome": "autumn_woodland",
   "verdict": "improved",
   "changes": "Applied the same-painter fix as given. Autumn birch (flora.tall[2]) leaf[2] [0.72,0.42,0.26] -> [0.80,0.54,0.34]. under.leaf[2] -> [0.66,0.54,0.38] and under.bush[2] -> [0.58,0.44,0.36]. The conifer lift from temperate_forest also applies here. The improvement is small but visible in full-size crops. Near crown at top right: median L 37.8 -> 39.3, min 15.3 -> 19.0. Top-centre canopy median 46.5 -> 49.6. The conifers are less near-black. Nothing got worse.",
   "pair": "docs/shots/art/earth/autumn_woodland.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/earth/before/earth/earth-biome-autumn_woodland.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/earth/fixer/final/earth-biome-autumn_woodland.jpg",
   "freezeFrame": "borderline",
   "weakest": "The nearest crowns are still flat sepia-brown masses. Their shaded outer surface is leafA/leafB (the oranges) under the double shadow glaze in pcTone, so lifting leafC barely moves them. The near bank is still a dark muddy olive band (bottom strip median L 39, p5 24). That band comes from the autumn forest moss/mud washes hard-coded in surface.js, not from a data field. Both are listed as wishes. No paper anywhere (p99 74.6)."
  },
  {
   "body": "earth",
   "biome": "alpine_meadow",
   "verdict": "improved",
   "changes": "Applied the verifier's fix: a biome-level under.rock merged over flora.under. Round 1 used the verified [[0.66,0.67,0.72],[0.38,0.39,0.48]]. The boulder cluster went from pinkish-beige above its ground (rock RGB 190,177,158 vs turf 162,172,117) to cool grey (170,165,159), as in the verifier's shot. Round 2 tried the untested notch darker, [[0.60,0.61,0.66],[0.34,0.35,0.44]], and kept it. The rocks are now 159,155,150: granite grey with a violet shadow, a step below the turf as the group rule asks, and in the meadow's cool palette, with no near-black. The rest of the frame is unchanged (the conifer lift is invisible here). The painter's turf patches, dwarf shrubs and mist 4.5 are kept.",
   "pair": "docs/shots/art/earth/alpine_meadow.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/earth/before/earth/earth-biome-alpine_meadow.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/earth/fixer/final/earth-biome-alpine_meadow.jpg",
   "freezeFrame": "pass",
   "weakest": "The near meadow is one even wash with a uniform scatter of blade flicks. It has little value structure (luminance std about 11) and no foreground shape to lead the eye to the snow peaks."
  },
  {
   "body": "earth",
   "biome": "sea_coast",
   "verdict": "reverted",
   "changes": "Reverted as the verifier asked. t is back to the base { cliff: 52, stacks: 0.5, strata: 0.5 } and both patch entries are gone. The biome line is now byte-identical to 8f23067. The re-shot cliff crop matches base (mean absolute difference 0.40 grey levels). The barcode inside the arch is back to base strength: column std 5.6 (the painter's state gave 8.3) and darkest stripe grey 179 (the painter's gave 149). The remaining whole-frame difference from base is the moving water and shore foam.",
   "pair": "docs/shots/art/earth/sea_coast.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/earth/before/earth/earth-biome-sea_coast.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/earth/fixer/final/earth-biome-sea_coast.jpg",
   "freezeFrame": "borderline",
   "weakest": "The vertical barcode of cliff-form shade stripes inside the arch, about 250 m off. It is base terrain (cliff shade wash in surface.js) and stays a wish for PAINTER. The near shingle is a smear of paper glints."
  },
  {
   "body": "earth",
   "biome": "desert_canyon",
   "verdict": "improved",
   "changes": "Applied the same-painter fix as given: small.bush 0.02 -> 0.008, and under.bush -> [[0.86,0.84,0.66],[0.74,0.72,0.56],[0.60,0.58,0.48]] (sage-ochre). The near-black slate-teal shrubs drop from five visible to two. One shrub slot became a boulder in the sand's own sienna, a step below the sand. Frame p1 L 40.3 -> 42.6. The two remaining shrubs have a slightly paler lit top. Round 2 tried a lighter wash, [[0.90,0.88,0.72],[0.80,0.78,0.62],[0.70,0.68,0.56]]. The shrubs' shaded core stayed near-black (min RGB 37,26,0 -> 45,33,4) while the lit top went ghostly grey, so that try was not better and was dropped in favour of the judge's values.",
   "pair": "docs/shots/art/earth/desert_canyon.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/earth/before/earth/earth-biome-desert_canyon.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/earth/fixer/final/earth-biome-desert_canyon.jpg",
   "freezeFrame": "borderline",
   "weakest": "The two remaining shrubs still have near-black indigo cores. They are the coolest, darkest marks in a warm frame, whatever wash the data gives them (wish for PAINTER). The sand floor is a flat even wash with an even pebble scatter."
  },
  {
   "body": "earth",
   "biome": "misty_wetland",
   "verdict": "unchanged",
   "changes": "No biome field was changed. The body-level birch leaf[2] lift (tall [0,0]) reaches this biome, so it was re-shot. The frame is unchanged: mean absolute difference 1.7 grey levels against the painter's after, all of it wind and flicker on the far shrubs. The far dark dabs are shrubs, not birches.",
   "pair": "docs/shots/art/earth/misty_wetland.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/earth/before/earth/earth-biome-misty_wetland.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/earth/fixer/final/earth-biome-misty_wetland.jpg",
   "freezeFrame": "pass",
   "weakest": "The near reed bed is a dense even comb of straw strokes with no gaps or value steps. The far shrubs are dark green dabs that sit on the mist rather than in it."
  }
 ],
 "perBody": "earth: only frames at tour noon (hour 10), fair weather and first person at each biome's easel were shot in this fixer pass. Dawn, dusk, night and weather were not re-shot. Sky (EARTH_SKY), cloud, deck and visibility are untouched, so day-night and weather behave as in the painter's pass. Motion: tree wind (0.10 broadleaf, 0.05 conifer) is unchanged, and the frames show only wind flicker on shrubs and grass. The style kept is the hand shared with the Moon and the common hand. Darks are lifted toward small slate or indigo shapes instead of near-black masses (conifer and birch darkest washes, autumn crowns, desert shrubs). Boulders sit a step below their ground in their own biome's hue (alpine granite grey and violet, desert sienna). The forest's back planes fade toward paper in bands (temperate mist 0.95). The painter's sea_coast patch is reverted to base terrain. moon: not touched; the moon.js in the test tree is the working-tree file, unchanged. Both shot runs (6 biomes, then alpine and desert) settled every frame, stood in the right biome and ended with no console problems.",
 "wishes": [
  {
   "file": "src/render/materials.js (prop foliage path for bushes) and src/render/chunks.js pcTone",
   "change": "The shaded core of a small bush goes near-black, with the blue channel driven to 0, whatever its wash. Give it a floor, for example cap the level-0 density for props under about 1.5 m, or stop the bush wash multiplying over a saturated ground.",
   "why": "Desert_canyon shrubs: lifting under.bush[2] from 0.42 to 0.60 to 0.70 moved the core minimum only from RGB 21,12,0 to 37,26,0 to 45,33,4. The cores are the darkest and coolest marks in a warm sienna frame, against the common hand's darks of about L 20-30 in the world's own hue. Frames: /home/user/.pc-scratch/art/earth/fixer/shots1/earth-biome-desert_canyon.jpg and /home/user/.pc-scratch/art/earth/fixer/shots2/earth-biome-desert_canyon.jpg (crops: /home/user/.pc-scratch/art/earth/fixer/c-dc2-l.png and /home/user/.pc-scratch/art/earth/fixer/c-dc2-r.png)."
  },
  {
   "file": "src/world/surface.js (forest palette, lines 127-130: autumn p.moss, and p.mud at line 137)",
   "change": "Lighten the autumn forest moss wash (oliveGreen + rawUmber at dilute 0.25) and the mud wash near the stream, or let a biome override them from data (for example b.forestPal { moss, mud }).",
   "why": "In autumn_woodland the near bank is a dark muddy olive band across the bottom of the frame (bottom strip median L 39, p5 24), heavier than any warm biome on Venus, Mars or Jupiter. No look field reaches it: the under.leaf and under.bush lifts left it unchanged. Frame: /home/user/.pc-scratch/art/earth/fixer/shots1/earth-biome-autumn_woodland.jpg (crop: /home/user/.pc-scratch/art/earth/fixer/c-aw-bank.png)."
  },
  {
   "file": "src/render/chunks.js pcTone (g2 = pcDensity(c*glaze*pow(glaze,0.75), 1.3)) as used by the foliage path in src/render/materials.js",
   "change": "A lighter shadow step for crowns near the eye, for example one glaze instead of a double glaze plus density for foliage within about 15 m, so warm crowns in shadow read as a cool violet glaze over orange, not as flat sepia.",
   "why": "The nearest autumn crowns render as flat sepia-brown masses. Their shaded outer surface is leafA/leafB under the double glaze, so a data lift of leafC (0.72,0.42,0.26 -> 0.80,0.54,0.34) moved the crown median only from L 37.8 to 39.3. Frame: /home/user/.pc-scratch/art/earth/fixer/shots1/earth-biome-autumn_woodland.jpg (crop: /home/user/.pc-scratch/art/earth/fixer/c-aw-top.png)."
  },
  {
   "file": "src/world/floraplace.js (around line 47) and the forest recipe in src/world/surface.js",
   "change": "Honour tallD (or a canopy-gap field) for terrain 'forest', so a forest biome can open its canopy from data.",
   "why": "temperate_forest, the game's reference painting, has no bare paper anywhere (p99 L 75.5). Since birch scale 1.25 the canopy closes the sky that base showed at the top. For forests, placement ignores tallD, so the only data levers are leaf washes and mist, and those lift the key only a little. Frame: /home/user/.pc-scratch/art/earth/fixer/shots1/earth-biome-temperate_forest.jpg."
  },
  {
   "file": "src/world/surface.js (coast recipe cliff-form shade wash; t.patch has no slope gate outside the islands recipe)",
   "change": "Soften or break up the vertical cliff-form shade stripes, and gate t.patch by slope in every recipe, as islands already does.",
   "why": "sea_coast: the vertical barcode inside the arch about 250 m off is base terrain (column std 5.6, darkest stripe grey 179). Any ground patch makes it darker because the patch also lands on the cliff face (the painter's patch took it to std 8.3 and grey 1
```

```json
{
 "group": "inner (mercury, venus, mars): fixer pass. I applied the cross-verifier item and the 5 same-painter mismatches. Mars was not touched.",
 "biomes": [
  {
   "body": "mercury",
   "biome": "ochre_basins",
   "verdict": "improved",
   "changes": "Body sky only. mkSky zenith changed from [0.34,0.33,0.50] to [0.54,0.52,0.70]; horizon, glaze and light are unchanged. The painter's kept rock colour and density (0.022) stay. Compared at full size against the current after frame from the same tour stand at hour 10: the sky is now one lighter granulated violet wash running down to the unchanged peach horizon band, with fine speckle instead of big muddy mottles. Sky median L went from 63 to 72 and p5 from 50 to 63. The ground is identical (ground p50 65 in both). Kept: clearly better and nothing got worse.",
   "pair": "docs/shots/art/mercury/ochre_basins.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/mercury/mercury-biome-ochre_basins.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/mercury-ochre_basins.jpg",
   "freezeFrame": "pass",
   "weakest": "The far basin rim carries an even scatter of small dark tiny-crater bumps (terrain, not rocks). The cadOrange accent is still not visible."
  },
  {
   "body": "mercury",
   "biome": "obsidian_fields",
   "verdict": "improved",
   "changes": "Body sky as above, plus the darks lifted as prescribed. t.patch[1].c changed from [0.10,0.10,0.17] to [0.22,0.22,0.32] and amt from 0.72 to 0.6. flora.tall[2] darkest bark and leaf wash changed from [0.12,0.12,0.20] to [0.20,0.20,0.30]. under.rock base changed from [0.14,0.13,0.21] to [0.22,0.21,0.30]. under.crust[1] changed from [0.13,0.14,0.24] to [0.22,0.22,0.32]. dil 0 and crack 0.5 are unchanged. Against the current after frame: the near band and bottom edge no longer go near-black. The ground is a dark slate-indigo glass a step lighter, and the cracks are now the only near-black lines. Ground p5 went from 17 to 23, frame p5 from 18 to 25, sky median from 63 to 71. The plain is still the darkest Mercury frame and stays well darker than the base's pale stippled ground (ground p50: base 48, now 40). The shards and plates still read. Dusk (h18) is still gold over a violet ground, slightly lighter. At night (h23) the sky is a lighter indigo (median 18 to 21) and the ground is unchanged. Kept.",
   "pair": "docs/shots/art/mercury/obsidian_fields.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/mercury/mercury-biome-obsidian_fields.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/mercury-obsidian_fields.jpg",
   "freezeFrame": "borderline",
   "weakest": "The ground reads as dark matt slate more than glossy black glass. At night the whole land goes to one flat mass at L 8. That is the shared night key, not this data (see wish 1)."
  },
  {
   "body": "mercury",
   "biome": "crystal_gardens",
   "verdict": "improved",
   "changes": "near.needle changed from 2 to 0, so near is now { crust: 5, needle: 0, dab: 1 }. Also the body sky lift. Against the current after frame: the cream bone-flake splinter patch in the right foreground is gone. The sky is lighter and finer-grained (median 57 to 64). The crystal clusters, the open ground and the far crystal band are unchanged. Kept.",
   "pair": "docs/shots/art/mercury/crystal_gardens.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/mercury/mercury-biome-crystal_gardens.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/mercury-crystal_gardens.jpg",
   "freezeFrame": "borderline",
   "weakest": "The crystals render the same saturated ultramarine whatever their rose or gold kit washes (see wish 2). The ship sits large in view. tallD 0.11 is thin for a 'garden'."
  },
  {
   "body": "mercury",
   "biome": "shadow_craters",
   "verdict": "improved",
   "changes": "Body sky only. The biome's own fields are still the base's, because the painter reverted them. Against the base, which is also the current after: the heavy mauve slab sky is now a lighter violet wash. The blue-violet far crater wall stands as the darker shape against it, so figure and ground read better. Sky median went from 57 to about 66. The ground and the frost wet-in-wet are unchanged. Dusk and night shots compared side by side: the dusk zenith is a lighter mauve and the night sky a slightly lighter blue (median 19 to 22). Neither is worse. Kept.",
   "pair": "docs/shots/art/mercury/shadow_craters.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/mercury/mercury-biome-shadow_craters.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/mercury-shadow_craters.jpg",
   "freezeFrame": "borderline",
   "weakest": "The foreground is a muddy brown-grey with a pale fleck stipple. 'Frozen' reads only in the far wall's frost. The mint accent is absent."
  },
  {
   "body": "venus",
   "biome": "lava_rivers",
   "verdict": "improved",
   "changes": "under.rock changed from [[0.44,0.38,0.40],[0.19,0.16,0.21]] to [[0.58,0.50,0.50],[0.32,0.27,0.32]]. t.patch[0].c changed from [0.17,0.15,0.19] to [0.30,0.27,0.32]. under.crust[0] changed from [0.13,0.12,0.16] to [0.24,0.22,0.28]. The painter's lower rock density (0.035) stays. Against the current after frame from the same moved stand: the basalt boulders are now mid mauve-grey stones with darker bases instead of near-black cut-outs. The far bank's slate band is a step lighter. Frame p1 went from 14 to 17, p5 from 29 to 32, ground p5 from 24 to 29. Nothing else changed. It keeps the few-stones improvement over the base's field of grey lozenges. Kept.",
   "pair": "docs/shots/art/venus/lava_rivers.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/venus/venus-biome-lava_rivers.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/venus-lava_rivers.jpg",
   "freezeFrame": "borderline",
   "weakest": "The named feature, the lava river, is not in the frame. The tour stand moves 8 m off the 22 deg easel and shoots in third person (wish 4). The boulders still have crisp rims, and the orange ember dirt is busy with flicks."
  },
  {
   "body": "venus",
   "biome": "acid_terraces",
   "verdict": "improved",
   "changes": "liquid.color changed from [0.80,0.92,0.50] to [0.86,0.93,0.68]; refl 0.45 is kept. Against the current after frame: the pool goes from a flat lime lawn to a paler milky sage acid pool with its brown shore shelf intact. The lemon terraces and the yellow sky now carry the colour. Pool chroma went from median 41 to 32 and p95 from 45 to 34. Nothing else changed. Kept.",
   "pair": "docs/shots/art/venus/acid_terraces.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/venus/venus-biome-acid_terraces.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/venus-acid_terraces.jpg",
   "freezeFrame": "borderline",
   "weakest": "The pool is still one large flat area with no horizontal reflected strokes or paper glints, though refl is 0.45 (wish 3). The frame's 95th-percentile chroma is still about 43, from the sulphur sky, which the judge accepted as Venus' own idea."
  },
  {
   "body": "venus",
   "biome": "pale_mesas",
   "verdict": "improved",
   "changes": "t.fog changed from [100,40] to [22,14]; mist 2.6 is kept. No heights changed. Against the current after frame: before, the mesas were sky-yellow ghosts dissolved in haze. Now they stand clear as pale grey-stone mesas with soft strata, framing the view. The frame has bands at last: ochre near ground, a paler far ground, pale mesa walls, then a sky of paper and sienna clouds. Median L went from 87 to 80. The named idea now reads, and the frame stays distinct from Mars' rust. Kept.",
   "pair": "docs/shots/art/venus/pale_mesas.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/inner/before/venus/venus-biome-pale_mesas.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/inner/fixshots/f1/venus-pale_mesas.jpg",
   "freezeFrame": "borderline",
   "weakest": "There is still no dark note anywhere (L p1 69, against L 20-30 darks elsewhere). The near ground is peppered with half-moon terrain flicks. The low fog itself is not visible from this stand. Chroma p95 is 39, slightly above the common 35."
  }
 ],
 "perBody": "Mercury: the zenith is lighter and the peach horizon unchanged. The sky now sits one step under the other daylight worlds (sky median about 64-72 in my crop, against Mars 82 and Venus 90) and has stopped reading as a heavy, muddy slab. Mottles are fine speckle, as on Venus and Mars. The derived night zenith is now [0.15,0.16,0.31], about the same as Earth's night [0.15,0.19,0.36]. Dusk (h18) and night (h23) were shot for obsidian_fields and shadow_craters: gold dusk over violet ground, indigo night sky slightly lifted, neither worse. The night ground is a flat L 8 mass on every body (also Mars dunes, base and after alike), which is shared code. All the darks are now small: cracks, shard bases, crater-wall seams. Venus: high-key sulphur, as the judge accepted. The basalt no longer goes near-black, the acid pool has dropped to the common chroma range, and the mesas read as forms above the fog band. Mars: untouched in this pass. The style held across the group: sepia or indigo darks only as small shapes, few boulders a step below their ground, spiky undergrowth sparse and never white (Mercury's crystal_gardens needles are now off, like obsidian_fields and polar_frost), each world fading to its own warm horizon paper. Weather and motion were not re-checked here. All my comparison frames are fair weather, from the tour's own stands (quick.mjs, hour 10, same query and settle as tests/tour.mjs).",
 "wishes": [
  {
   "file": "src/render/post.js",
   "change": "In the night key (uNight, around :150-175, where every wash takes far more pigment), give the land a floor around L 18-25 and keep one or two value steps in it, instead of letting everything below the horizon merge into one mass at L 8.",
   "why": "At h23 the ground on Mercury obsidian_fields and shadow_craters, and on Mars dust_dunes, is a flat near-black (ground p50 L 8) in both base and after. That breaks 'nothing is pure black', and data cannot fix it: lifting Mercury's derived night zenith lifted only the sky (median 18 to 21). Frame: /home/user/.pc-scratch/art/inner/fixshots/dn-fix/mercury-obsidian_fields-h23.jpg"
  },
  {
   "file": "src/render/materials.js",
   "change": "In the flora and crystal light-and-shadow glaze (around :1119), lay the cool glaze over the kit's own wash rather than letting it replace that wash.",
   "why": "Mercury's crystal kits render the same saturated ultramarine at noon whatever their bark and leaf washes. The rose and gold washes in mercury.js flora.tall[0] and [1] have no visible effect, so crystal_gardens cannot show its cobaltViolet, roseMadder and lemon palette. Frame: /home/user/.pc-scratch/art/inner/fixshots/f1/mercury-crystal_gardens.jpg"
  },
  {
   "file": "src/render/materials.js",
   "change": "Make the water wash show its horizontal reflected strokes and bare-paper glints at moderate refl (0.45) on a calm pool seen from about 30 m. Code around :385-420.",
   "why": "The acid_terraces pool shows none, so it stays one flat area even after its colour was lowered. Frame: /home/user/.pc-scratch/art/inner/fixshots/f1/venus-acid_terraces.jpg"
  },
  {
   "file": "src/art/easels.js (the lava_rivers easel and stand)",
   "change": "Put the lava_rivers easel on ground under 20 deg with the lava river in its view, so the tour stands at the easel in first person.",
   "why": "The tour moves 8 m off the 22 deg easel, shoots in third person and misses the river, so the biome's named feature is never in its frame. I repeat this from the painter's wish. Frame: /home/user/.pc-scratch/art/inner/fixshots/f1/venus-lava_rivers.jpg"
  }
 ],
 "filesChanged": [
  "src/data/looks/mercury.js",
  "src/data/looks/venus.js",
  "docs/shots/art/mercury/ochre_basins.jpg",
  "docs/shots/art/mercury/obsidian_fields.jpg",
  "docs/sh
```

```json
{
 "group": "giants (jupiter, saturn): fixer pass",
 "biomes": [
  {
   "body": "saturn",
   "biome": "ring_shadow",
   "verdict": "improved",
   "changes": "I applied the cross-verifier fix and the same-painter fix together. (1) flora.tall[2] (spire, used only by ring_shadow) now uses the painter's 'mid' washes: bark [[0.84,0.80,0.84],[0.52,0.48,0.58]], leaf [[0.84,0.80,0.84],[0.68,0.64,0.72],[0.52,0.48,0.58]]. (2) under.rock is now warm neutral, [[0.86,0.82,0.80],[0.58,0.54,0.56]], and small.rock goes from 0.05 to 0.02. (3) One extra field the first render showed was needed: under.shard [[0.88,0.86,0.94],[0.58,0.56,0.74]]. Lowering small.rock moves floraplace's cumulative r4 bins, so other hash candidates became shards. That put Saturn's body-level mint splinter clusters (flora.under.shard) right in the foreground (fx/f1-saturn-ring_shadow.jpg), and the near-ground splinters were already mint-green flicks, which are off this biome's palette. With lilac shards (render f2) the foreground holds together: grey-brown ground, lilac and grey splinters, small quinGold flecks. The boulders are now warm stone with violet undersides from the twilight glaze, not saturated cobalt lozenges. At 18:00 the spires keep violet glazes on their shaded sides, close to base, instead of flat orange cut-outs (spire crops: chk/base-, chk/after- and fx/f2-saturn-ring_shadow-h18). Whole frame at noon, base -> after: L p5 23.7 -> 29.9, chroma p95 27.6 -> 21.3. Spire crop at noon: saturation 0.43 -> 0.32, L p5 13 -> 18. The extra pair docs/shots/art/saturn/ring_shadow-h18.jpg shows dusk.",
   "pair": "docs/shots/art/saturn/ring_shadow.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/giants/before/saturn/saturn-biome-ring_shadow.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/giants/fx/f2-saturn-ring_shadow.jpg",
   "freezeFrame": "borderline",
   "weakest": "At noon the spires are still a fairly saturated violet next to the warm grey ground, and their sunlit tips are paper-gold blobs. At dusk the lit faces of the spires are higher in chroma than base (C med 36 against 26). The sky is a heavy overcast brown-grey."
  },
  {
   "body": "saturn",
   "biome": "gold_islands",
   "verdict": "improved",
   "changes": "Base had no t.dil. I added t.dil 0.42 and kept the ground order ['yellowOchre','quinGold','rawSienna']. small.shard 0.03 -> 0.01, near.needle 1 -> 0 (dab still gets 1 of the stroke budget, blades are unchanged). The teal splinter confetti across the meadow is gone. The foreground is now one gold wash with olive blade flicks and pebble dabs: one world hue, as in the common hand. dil 0.42 barely changes the rendered chroma: the stand's ground wash goes from (0.91,0.76,0.48) to (0.91,0.79,0.53), and foreground chroma p95 goes 40.8 -> 40.2. So the 'saturated' half of the judge's complaint is only slightly eased; the 'noise' half is fixed.",
   "pair": "docs/shots/art/saturn/gold_islands.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/giants/before/saturn/saturn-biome-gold_islands.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/giants/fx/f1-saturn-gold_islands.jpg",
   "freezeFrame": "borderline",
   "weakest": "The foreground is still one flat, fairly saturated quin-gold wash (chroma p95 about 40), with no t.patch drift inside 34 m of the stand and little value structure. The cliff is a flat grey-brown band, and the rings are not in this view."
  },
  {
   "body": "jupiter",
   "biome": "sky_islands",
   "verdict": "improved",
   "changes": "flora.tall[0] (broadleaf) leaf goes from [[0.70,0.84,0.42],[0.46,0.70,0.44],[0.24,0.46,0.42]] to [[0.76,0.88,0.46],[0.58,0.77,0.44],[0.46,0.60,0.32]]. leafP stays [0.6,0.15,1.0,0.3], as the judge said. I rendered three variants. The judge's values (f1) lifted the near crown only a little: median L 27 -> 30, p5 17 -> 20, and it went greyer (saturation 0.22 -> 0.17). A lighter blue-green (f3) went slate-grey (saturation 0.14). The reason is that pcTone's shadow is c*glaze^1.75 with Jupiter's violet glaze, so any blue in leafC turns slate. The kept variant (f4) gives leafC a warmer, lower-blue sap green. The crown's shadow mass is now a sap-green/olive glaze, not a near-black slate cut-out: median L 31, p5 21.5, saturation 0.27, chroma p95 25.9. The middle-ground trees' lower crowns are olive now, not slate-blue. The easel view (docs/shots/art/jupiter/sky_islands-easel.jpg) is unchanged apart from the tiny far trees.",
   "pair": "docs/shots/art/jupiter/sky_islands.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/giants/before/jupiter/jupiter-biome-sky_islands.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/giants/fx/f4-jupiter-sky_islands.jpg",
   "freezeFrame": "borderline",
   "weakest": "The near crown is still the largest dark in the frame. Its lower edge keeps the leopard-spot paper holes (the rim raggedness of leafP), so it still reads somewhat as a cut-out. The cloud-sea gap behind is a flat grey-white."
  },
  {
   "body": "jupiter",
   "biome": "hanging_gardens",
   "verdict": "improved",
   "changes": "Changed only through the shared broadleaf kit (flora.tall[0], see sky_islands). No hanging_gardens field changed. The broadleaf crowns are lighter and warmer: crown crop L median 47 -> 51, p5 28.5 -> 32.8. They are sap-green/olive instead of cool blue-green, so the trees now separate from the viridian vine curtain and sit with the warm meadow. Nothing else in the frame changed (whole frame: L median 68.9, chroma p95 33.8 against 33.5). Against base, the painter's earlier fewer-flowers change and the ground patches are still in place. I counted this as improved because base is the before; on the crown change alone it is neutral to slightly better.",
   "pair": "docs/shots/art/jupiter/hanging_gardens.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/giants/before/jupiter/jupiter-biome-hanging_gardens.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/giants/fx/f4-jupiter-hanging_gardens.jpg",
   "freezeFrame": "borderline",
   "weakest": "The rose-madder petals on the vine curtain are large, even, saturated lozenges. The foreground meadow is a dense, uniform field of blade strokes with no value step."
  },
  {
   "body": "jupiter",
   "biome": "storm_wall",
   "verdict": "improved",
   "changes": "small.rock 0.08 -> 0.03, as the judge proposed (near dabs 4 -> 2 per clump). The ruled row of grey boulders along the spire line is gone. The spires now stand straight on the red plain, with a few small stones and the right-hand pebble trail as the only crisp touches, and the burnt-sienna/rose patch drifts carry the ground. Whole-frame stats are unchanged (L median 63.9, chroma p95 34.8).",
   "pair": "docs/shots/art/jupiter/storm_wall.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/giants/before/jupiter/jupiter-biome-storm_wall.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/giants/fx/f1-jupiter-storm_wall.jpg",
   "freezeFrame": "pass",
   "weakest": "The foreground plain is a little empty. The far storm wall is a pale grey-violet silhouette with little inner structure, and the Great Red Spot storm does not show in this fair-weather view."
  },
  {
   "body": "jupiter",
   "biome": "lightning_plains",
   "verdict": "improved",
   "changes": "small.shard 0.16 -> 0.07, as the judge proposed. near.needle 3 -> 1, one step further than the judge's 2. I rendered both: needle 2 (f1) thinned the far dark crystal clusters but left the lemon tufts as a band of texture. Needle 1 (f3) leaves the lemon glass as scattered notes over the cracked violet ground. A crude pale-lemon pixel share in the middle ground goes 0.0039 (current) -> 0.0026 (needle 2) -> 0.0011 (needle 1); base was 0.0143. The cracks (the lightning scars) now read better, and the far plain is calmer.",
   "pair": "docs/shots/art/jupiter/lightning_plains.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/giants/before/jupiter/jupiter-biome-lightning_plains.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/giants/fx/f3-jupiter-lightning_plains.jpg",
   "freezeFrame": "borderline",
   "weakest": "There is still a mid-ground band of pale lemon tufts by the ship. The dark cobalt crystal clusters are hard, dark accents. The plain has no sense of lightning or storm light at noon, and the ground's cracks are uniform dark lines."
  }
 ],
 "perBody": "Jupiter: the cream and orange belted sky is unchanged. The near foliage now follows the group's rule for darks: local colour plus the world's violet glaze, kept warm so the glaze gives olive rather than slate. Rocks and glass are small accents, not scatters (storm_wall rock 0.03, lightning glass needle 1 and shard 0.07). Saturn: the dusty violet-gold overcast is unchanged. ring_shadow now uses the same vocabulary as the other giant biomes and the common hand: boulders a step below their ground in its own warm neutral, with the violet coming from the twilight glaze; crystal splinters in cobalt-to-lilac; one quinGold accent. gold_islands keeps one gold hue without teal confetti. Kept across the group: warm-neutral stone and boulders, violet glazes for shadow, at most one saturated accent, and no off-palette splinters. I compared all frames at tour hour 10 in fair weather, and ring_shadow also at 18:00 (dusk is better than both base and the previous after: violet-glazed spire sides, lilac and ochre flicks instead of green). Weather, night and motion were not shot in this fixer pass.",
 "wishes": [
  {
   "file": "src/world/floraplace.js",
   "change": "Give the small-kind table a stable hash slot per kind (for example, a separate r value per kind, or bins in a fixed order with gaps) instead of cumulative r4 bins in the order grass, fern, bush, rock, flower, reed, shard.",
   "why": "Lowering one density (ring_shadow small.rock 0.05 -> 0.02) moved every later kind onto different candidates. Shards that had been out of view jumped into the foreground (fx/f1-saturn-ring_shadow.jpg), so a density edit cannot be judged on its own."
  },
  {
   "file": "src/render/chunks.js (pcTone)",
   "change": "Consider limiting how far the deepest shadow level (g2 = pcDensity(c*glaze^1.75, 1.3)) can pull a mid-value local colour, or tinting it toward the local hue.",
   "why": "On Jupiter a blue-green leaf wash of transmittance about 0.5 still renders as a near-black slate crown (L p5 17). Only a warm, low-blue leafC keeps it from going slate (fx/f1-, f3- and f4-jupiter-sky_islands.jpg)."
  }
 ],
 "filesChanged": [
  "/home/user/painted-cosmos/src/data/looks/jupiter.js",
  "/home/user/painted-cosmos/src/data/looks/saturn.js",
  "/home/user/painted-cosmos/docs/shots/art/jupiter/sky_islands.jpg",
  "/home/user/painted-cosmos/docs/shots/art/jupiter/sky_islands-easel.jpg",
  "/home/user/painted-cosmos/docs/shots/art/jupiter/hanging_gardens.jpg",
  "/home/user/painted-cosmos/docs/shots/art/jupiter/storm_wall.jpg",
  "/home/user/painted-cosmos/docs/shots/art/jupiter/lightning_plains.jpg",
  "/home/user/painted-cosmos/docs/shots/art/saturn/ring_shadow.jpg",
  "/home/user/painted-cosmos/docs/shots/art/saturn/ring_shadow-h18.jpg",
  "/home/user/painted-cosmos/docs/shots/art/saturn/gold_islands.jpg"
 ],
 "worldTests": "node --test src/world/*.test.mjs on /home/user/.pc-scratch/art/giants/after (base 8f23067 plus the final jupiter.js and saturn.js, byte-identical to the working tree): 19 pass, 0 fail. standcheck: every biome stand and easel on jupiter and saturn is still dry, in its own biome and under 20 degrees, and both spawns are dry. seed, seaLevel, phys and sites are untouched. All shot processes I started have exited; I made no git operations."
}
```

```json
{
 "group": "ice (fixer: uranus, neptune, pluto)",
 "biomes": [
  {
   "body": "uranus",
   "biome": "teal_sinkholes",
   "verdict": "improved",
   "changes": "Applied the cross-verifier fix and the same-painter fix together: near: { dab: 1 } (the default here works out to 2), small.rock 0.04 -> 0.015, small.shard 0.08 -> 0.04. under.rock is unchanged, so the boulders keep their dark lee. Re-shot from the tour's stand at hour 10 and compared at full size against the previous after-frame: the even polka-dot of pebble dabs is about halved (2x crop cmpfix/teal-bottom.jpg). The upper wall carries about 10 dark stones instead of about 25, and fewer pale shards. The pool, the far ridge and the sky are unchanged. A pair of cobalt-to-paper needles now stands in the right foreground where a boulder used to be. It belongs to the shared needle vocabulary and is not a regression. Kept.",
   "pair": "docs/shots/art/uranus/teal_sinkholes.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/ice/before/uranus/uranus-biome-teal_sinkholes.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/ice/fixshot/uranus/uranus-biome-teal_sinkholes.jpg",
   "freezeFrame": "borderline",
   "weakest": "The sinkhole wall is still one dull blue-grey slope over half the frame, and its remaining pebble dabs still lie in an even scatter. Nothing in the frame says 'glowing': the pool is a flat pale-teal wash."
  },
  {
   "body": "neptune",
   "biome": "kelp_forests",
   "verdict": "improved",
   "changes": "Iteration 1, the same-painter fix: small.bush 0.09 -> 0.03, small.flower 0.09 -> 0.04, near.flower 5 -> 2, and a biome under.bush of [[0.74,0.76,0.88],[0.56,0.58,0.78],[0.40,0.42,0.62]]. The band of saturated ultramarine bush blobs under the kelp is gone, and the scarlet confetti on the floor is thinner and smaller (C p95 35.0 -> 32.7). But the bushes had been hiding a large Payne's-grey boulder, which now stood at the left as a near-black lump. Iteration 2 added a kelp-only under.rock of [[0.62,0.66,0.78],[0.36,0.40,0.56]] (the body's rock [0.22,0.24,0.36] stays for the storm_seas basalt). The boulder and the small stones now sit a step below the floor in the frame's own blue-violet (crop cmpfix/kelp-floor2.jpg). The kelp, the sky and the ship are unchanged. Both changes kept.",
   "pair": "docs/shots/art/neptune/kelp_forests.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/ice/before/neptune/neptune-biome-kelp_forests.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/ice/fixshot2/neptune/neptune-biome-kelp_forests.jpg",
   "freezeFrame": "borderline",
   "weakest": "There is still no paper light anywhere (L p99 74). The body's saturated ultramarine-to-rose sky and a mid-value sea-green floor full of dark blade flicks keep the whole frame in a middle key."
  },
  {
   "body": "pluto",
   "biome": "heart_glacier",
   "verdict": "improved",
   "changes": "Changed only the body sky (the same-painter fix): mkSky([0.35,0.34,0.53],[0.78,0.76,0.90]) -> mkSky([0.50,0.48,0.68],[0.88,0.86,0.95]); visibility stays [1600,10000]. The sky is now a mid-light lilac that pales to a near-paper horizon, with finer, fainter mottles (top-40% L median 59 -> 70, frame median 70.6 -> 76.3), and the far penitent rows fade into it. The ground is unchanged. I also checked night at hour 23 against the previous after: it is still an indigo night, a shade lighter, with the stars and the penitents unchanged. Kept.",
   "pair": "docs/shots/art/pluto/heart_glacier.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/ice/before/pluto/pluto-biome-heart_glacier.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/ice/fixshot/pluto/pluto-biome-heart_glacier.jpg",
   "freezeFrame": "pass",
   "weakest": "The big smooth boulder in the lower-right foreground and the grey mid-ground boulders read as smooth plastic lumps. The sky is still darker than the other worlds' (L about 70 against 75-86)."
  },
  {
   "body": "pluto",
   "biome": "lilac_mountains",
   "verdict": "improved",
   "changes": "The body sky change (as above) plus small.rock 0.07 -> 0.025. The row of identical lozenge boulders along the ridge is down from about 20 to about 8, and the penitent companies on the ridge now carry the cobalt. The sky is lighter and its mottle softer (top-40% L 44.5 -> 50.7). Two large foreground needles at the right edge dropped out with the reshuffled placement. That costs nothing: they were cut off by the frame edge. Kept.",
   "pair": "docs/shots/art/pluto/lilac_mountains.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/ice/before/pluto/pluto-biome-lilac_mountains.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/ice/fixshot/pluto/pluto-biome-lilac_mountains.jpg",
   "freezeFrame": "borderline",
   "weakest": "The sky at this stand (lat about 70 deg, low sun) is still a dense slate-indigo band with large mottles over the top third, even with the lighter mkSky. It is the darkest daylight sky left in the group, and the far ridge stands against it instead of fading to paper."
  },
  {
   "body": "pluto",
   "biome": "long_shadow_plain",
   "verdict": "improved",
   "changes": "The body sky change plus small.rock 0.05 -> 0.018 and near.dab 3 -> 1. The even field of soap boulders is broken up: the big central and near boulders are gone, the right half is open ground with a light scatter of pebble dabs, and the penitents now stand as the subject (crop cmpfix/long-ground.jpg). The sky is mid-light lilac to a pale horizon (top-40% L 58 -> 69). Kept.",
   "pair": "docs/shots/art/pluto/long_shadow_plain.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/ice/before/pluto/pluto-biome-long_shadow_plain.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/ice/fixshot/pluto/pluto-biome-long_shadow_plain.jpg",
   "freezeFrame": "borderline",
   "weakest": "A clump of smooth lilac boulders still crowds the left third. The named idea, long shadows, does not read at hour 10: the penitents' shadows are short."
  },
  {
   "body": "pluto",
   "biome": "nitrogen_dunes",
   "verdict": "improved",
   "changes": "Changed only the body sky. The sky is lighter with finer granulation and grades to a pale lilac horizon (top-40% L 58.7 -> 69.6), so the far penitent rows go back into it (crop cmpfix/dunes-sky.jpg). The ground is identical. Kept.",
   "pair": "docs/shots/art/pluto/nitrogen_dunes.jpg",
   "beforeFrame": "/home/user/.pc-scratch/art/ice/before/pluto/pluto-biome-nitrogen_dunes.jpg",
   "afterFrame": "/home/user/.pc-scratch/art/ice/fixshot/pluto/pluto-biome-nitrogen_dunes.jpg",
   "freezeFrame": "borderline",
   "weakest": "The dune's slip face barely reads from the stand. The near slope is covered by a dense, even sprinkle of pale flakes (the near-ground needles and ripples), more confetti than accent."
  }
 ],
 "perBody": "uranus: only teal_sinkholes was touched, seen at hour 10 in fair weather. The mint-to-near-paper sky is unchanged; the change sits in the near ground (pebble dabs, stones, shards), so day-night is unaffected and was not re-shot. Weather and motion were not looked at in this pass. neptune: only kelp_forests was touched, seen at hour 10 in fair weather. The body sky, the kelp (wind 0.5) and the deck are unchanged; only the floor's undergrowth densities and the kelp-only bush and stone washes changed, so day-night is unaffected and was not re-shot. pluto: the body sky changed, so all four biomes were re-shot at hour 10 in fair weather, plus heart_glacier at hour 23 (still an indigo night, a shade lighter than before, stars and penitents unchanged). Pluto has cloud 0 and no weather marks, and dawn and dusk were not re-shot. The shared ice hand is kept across the group: paper and pale wash carry the light, the middle values are each world's own cool pigment (mint, ultramarine and violet, lilac and rose), stones sit a step below their ground in its own hue (now on kelp too), boulders are few (Pluto 0.018-0.025, Uranus sinkholes 0.015, in line with the other groups' 0.008-0.035), and the leaning cobalt-to-lilac needles are the one ice vocabulary. Pluto's sky now sits with the other daylight skies (a mid-light wash that pales to a near-paper band) instead of being the darkest after the Moon.",
 "wishes": [
  {
   "file": "src/world/sky.js (or the shared granulation in src/render that the sky uses)",
   "change": "Scale the sky's granulation and mottle amplitude down as the sky wash gets dense (low sun, high latitude, twilight blend), so a dark sky stays one even granulated wash instead of breaking into large camouflage mottles.",
   "why": "On Pluto's lilac_mountains stand (lat about 70 deg, hour 10) the sky is still a slate-indigo band with large mottles even after the body sky was lightened to mkSky([0.50,0.48,0.68],[0.88,0.86,0.95]). The data cannot lighten it further without washing out the other three biomes. Frame: /home/user/.pc-scratch/art/ice/fixshot/pluto/pluto-biome-lilac_mountains.jpg (top third)."
  },
  {
   "file": "src/world/nearground.js (pebble colour, around line 393)",
   "change": "Pull a pebble dab further toward its ground (for example mix the dark stone colour at 0.7 instead of 0.5), or take rock[1] for a pebble less often than 60% of the time.",
   "why": "When a biome gives its boulders a dark lee colour (the common hand's 'stones a step below their ground'), every near-ground pebble turns into a dark ink dot, and the whole slope becomes an even polka-dot. Right now the only lever in the data is near.dab, which was cut to 1 on Uranus teal_sinkholes and Pluto lilac_mountains and long_shadow_plain, and the dots are still a regular scatter. Frame: /home/user/.pc-scratch/art/ice/cmpfix/teal-bottom.jpg (lower half)."
  }
 ],
 "filesChanged": [
  "src/data/looks/uranus.js",
  "src/data/looks/neptune.js",
  "src/data/looks/pluto.js",
  "docs/shots/art/uranus/teal_sinkholes.jpg",
  "docs/shots/art/neptune/kelp_forests.jpg",
  "docs/shots/art/pluto/heart_glacier.jpg",
  "docs/shots/art/pluto/lilac_mountains.jpg",
  "docs/shots/art/pluto/long_shadow_plain.jpg",
  "docs/shots/art/pluto/nitrogen_dunes.jpg"
 ],
 "worldTests": "node --test src/world/*.test.mjs: 19 tests, 19 pass, 0 fail. Run on /home/user/.pc-scratch/art/ice/fix2, which is base 8f23067 plus only my three body files, byte-identical to the working tree's uranus.js, neptune.js and pluto.js. seed, seaLevel, phys and sites are untouched. None of my browsers is still running (the one open browser belongs to the giants group's stand.mjs and was left alone)."
}
```

