# FLORA DESIGN: much denser grass, flowers, the other plants, and how each reads from the air

Branch `design-flora` (= `look-proto` = `main` at v37). Written 24 Nov by a painter helper session for the coordinator.
**A design only: no game code was changed.** Earth first; written so that every other world follows the same machine
by data. The owner's words this answers (24 Nov): *"the grass specially it should also be alot denser and there should be
flowers and other kinds of flaura focus on the flaura before the fauna"*, *"make sure it looks beautiful the flaura and the
density of the grass and flowers"*, and the standing ones: 30 a second on the S23 Ultra, the view from the air to a mile,
no blur, no grain, small strokes with no outlines, colours that pop with no detail lost.

What is SEEN below was looked at in a still that I opened. What is MEASURED was counted by a script on this branch's
code. What is DERIVED (every phone millisecond) is worked out from the owner's v37 table and says how; none of it has
been measured on the phone, and each one names the speed-test row that would.

---

## 0. In plain words

1. **The grass is thin today.** In an open meadow there are about 19 blades to a square metre (10 at the wood's landing),
   standing on a carpet of leaf-shaped dabs that is the ground's own paint. At your feet it reads as a leaf carpet with a
   few blades in it; from 10 m up the blades are gone; from 30 m and 150 m a meadow is a flat yellow-green mottle.
2. **Flowers exist only within 12 m of the eye**, every place gets the same four (poppy, ox-eye, buttercup, harebell),
   and from 10 m up they vanish. The level alpine meadow is the best ground in the game today: at 2 m its white and red
   drifts read well. Nowhere does a drift survive past the near ring.
3. **The near grass is not free, and the speed test cannot see it.** The row "no small plants" switches off only the
   50 to 130 larger plant pieces (tufts, ferns, flowers, bushes, stones). The near grass (about 23,000 painted marks at the
   landing) is in no row of the v37 table. Derived from that table: **about 4 to 8 ms of the 89 ms frame.**
4. **The design:** (G) grass four times as dense where the eye reads single blades (within 6 m), blades in their own
   greens with dark roots and lit tips, moving in travelling gusts; (F) flowers as plants in drifts, several kinds for each
   place, from ONE map of where flowers grow that the near grass, the middle distance, the far marks and the ground's own
   colour all read, so a drift at your feet is the same drift as a patch of colour from 150 m and a tinted slope from a
   mile; (O) the plants each place lacks: bracken, fallen logs, toadstools, heather, gorse, thrift, iris, cotton grass,
   water lilies, gentians, sage, yucca; (A) from the air, fields of colour and combed stroke direction.
5. **Paying for it.** About two thirds of today's grass marks are drawn although they are off the screen, and the
   middle band (12 to 40 m) paints every pixel it covers three to four times. Fixing those two pays for the denser grass:
   the grass package is about cost-neutral (between -2.5 and +2.4 ms). Everything together is about **+3 ms** on the phone
   (between -1 and +7), most of it the new plants of package O, which land one by one under a cap. The first thing to
   build is the speed-test row that measures the near grass, so the phone says.
6. **Needed from the owner:** nothing now. Later, one speed test with the new rows (section 4.4).

---

## 1. What was looked at

**Code read:** `src/world/nearground.js` (the near sward, all of it), `floraplace.js`, `florakit.js` (the undergrowth kits),
`kitbuild.js`, `kits/` (the tree kits: the trees lane's), `src/render/kitmat.js` (PHYSICS' draw kits: rain, snow, falling
leaves; not plants), `materials.js` (`NEAR_VERT`, `NEAR_FRAG`, the blade, accent and rock branches of `PROP_FRAG`),
`flora.js` (`_buildUnder`, the kit table, `_showUnder`), `surface.js` (the colour recipes), `src/data/looks/earth.js` and a
survey of the other worlds' looks, `data/mode.js` (`overlayOil`), `core/bench.js` (the rows), `physics/flora.glsl.js` (the
bend and the wind the grass reads), `docs/notes/painter.md`, the handover and log on `r2`, `docs/references/README.md`.

**Stills (all opened; this game's own frames; in `docs/shots/painter/flora-design/`).** The painter's gallery, oil look,
the lighter paint, quality 1 (the phone's tier), picture 936 x 372 (the phone's own size in the v37 table), 15.4 h unless
said. Each "today" sheet is four frames over one spot: top left 1.8 m looking 24 degrees down, top right 10 m (30 down),
bottom left 30 m (32 down), bottom right 150 m (38 down).

| file | what |
| --- | --- |
| `today-aw-sheet.jpg` | the autumn wood at the landing, `season=0.85` (autumn leaf), by the river |
| `today-tf-sheet.jpg` | the green wood under the canopy, summer |
| `today-amf-sheet.jpg` | a LEVEL alpine meadow 660 m from the biome's stand, 11 h (the easel's own spot is a steep slope in shadow at 15.4 h: `today` frames of it were all dark violet ground and are not kept) |
| `today-scv-sheet.jpg` | the sea coast from the painter's easel (`src/art/vantage.js`) |
| `today-sc-sheet.jpg` | the sea coast at the biome's stand (a cliff foot) |
| `today-mw-sheet.jpg` | the misty wetland |
| `today-dc-sheet.jpg` | the desert canyon |
| `exp-meadow-density-1x-3x-5x.jpg` | EXPERIMENT (in the page, nothing saved): the same meadow view with the near rings re-laid at 1x, 3x and 5x their marks |
| `exp-meadow-today-near4x-nomidring.jpg` | today / blades 4x within 6 m / the same without the middle ring |
| `exp-meadow-today-vs-near4x-owncolour.jpg` | today / blades 4x within 6 m AND blades in their own greens (`gm` 0.25 for 0.60) |
| `exp-meadow-10m-midring-vs-none.jpg` | from 10 m: today / without the middle ring |
| `exp-wood-density-1x-3x.jpg` | the autumn wood's bank: today / 3x |

The experiments were made by changing the live page's objects from the lab (`tools/lab.mjs eval`): the rings' `cfg.per`,
a wrapper round `Ring.layFine` that lays more marks in cells near the eye, and `styles[*].gm`. They are evidence for a
choice, not a build: a cell keeps its marks as the eye moves, so the real build does this differently (6.2).

**A trap for whoever shoots the next stills:** in the oil look `world.findBiome('earth', 'autumn_woodland')` returns a
spot in the GREEN wood and `'temperate_forest'` one in the autumn wood (`earth.js` `oil.sites` swaps the two sites and
`getStandPure` reads the list as it was). The autumn wood is the spawn: use `world.getSpawn('earth')`.

---

## 2. What the stills show today (seen)

| place | 2 m | 10 m | 30 m | 150 m |
| --- | --- | --- | --- | --- |
| autumn wood | a carpet of leaf dabs in greens and yellows with thin blades standing sparse in it; a few large orange tufts (the undergrowth's grass kit) standing alone, out of scale with the sward; flowers are pin-heads | the blades are gone (the fine ring reaches 12 m from the EYE); the floor is dab paint, with good tree shadows | a glade is flat yellow-green dab paint with pale leaf shapes; no tufts, no flowers, no direction | the wood dominates; glades are flat lemon-lime mottle; no drift, no stroke direction |
| green wood | the same floor in greener paint, blades sparse | dab floor | inside the crowns | dark crowns over lime glades, flat |
| alpine meadow (level) | **the best floor in the game**: green blades over green dabs, a white drift and a red drift. The poppies are pure red ovals that read as confetti; the blades share the ground's colour, so they barely read as blades | the drifts are gone; short white horizontal dashes and yellow specks of the middle ring | flat green dab carpet | green and violet slopes, no flowers |
| sea coast | the cliff top is a yellow-ochre leaf carpet with a handful of blades; dark brown ovals (stones) that read as HOLES | the same carpet | the same | a beige mottled headland with dark round trees; no heather, no gorse, nothing that says "cliff top" |
| misty wetland | tall reeds (good: straw strokes) and dark round blots (stones read as holes again) | a beige-olive dab floor with pools | the same, paler | beige-grey and blue; no sedge green, no flowers, no cotton grass |
| desert canyon | the floor is orange and lemon LEAF dabs: it reads as autumn leaves on sand | the same | the same | good canyon walls, the same leaf floor |

What every row has in common: **past 12 m (from the eye) no plant of the sward is seen, and from 30 m up a place is
told from another only by the ground's colour.** The far view's only carrier of flora is the ground's paint.

---

## 3. What there is today, counted (measured)

**The near sward** (`nearground.js`): four rings of instanced marks round the eye, one draw call each, every mark 5
vertices and 3 triangles, laid per cell of a cube-sphere grid and kept while the cell is in range.

| ring | cell | reach at tier 0 / 1 / 2 | marks a cell (max) | fades in | gone above | pool (slots) |
| --- | --- | --- | --- | --- | --- | --- |
| fine (blades, flowers, litter, pebbles) | 0.6 m | 11 / **12** / 23 m | 12 | 0.8-2.6 m | 45 m | 59,412 |
| mid (fan touches, flower dashes, stones) | 1.9 m | 0 / **40** / 66 m | 7 | 6-13 m | 90 m | 27,112 |
| far | 6.5 m | 0 / **0** / 240 m | 5 | 38-66 m | 200 m | 30,959 |
| vista (flat drags, the 275 m upgrade) | 13 m | 0 / **190** / 450 m | 4 (6 sized) | 40-72 m at tier 1 | 220 m | 22,513 |

Blades: an open meadow cell (0.36 m2) has a tuft or two in five cells of six, about 8 blades a tufted cell: **about 19
blades a square metre** (`layFine`: `round(st.blade * (per - 1) * meadow * (0.7 + 0.5 * rough))`, `st.blade` 0.75 on
Earth's grassy places). At the landing, counted in the page: 7,893 blades on 748 m2 of cells: **10.5 a square metre**.

**At the landing** (gallery `cam=trees`, tier 1, 936 x 372; counted in the page): near marks **23,305** (fine 11,902,
mid 8,256, vista 3,147), **69,915 triangles**; of those marks only **40 / 31 / 30 per cent** (fine / mid / vista) have
their root inside the view. The undergrowth (`pc-prop-under`, the PROP kits): 128 instances, 6,912 triangles.

**Fragments** (`tools/overdraw.mjs` from this branch, run as a scratch copy with the tier set to 1 and the picture
936 x 372, at the spawn, eye 1.62 m, level; it rasterises every triangle the game would draw):

| kind | triangles | fragments rasterised | covers px | self-lap |
| --- | --- | --- | --- | --- |
| trees far | 816,132 | 585,252 | 65,632 | 8.92 |
| trees near (full) | 118,614 | 224,145 | 66,253 | 3.38 |
| trees mid | 55,666 | 152,411 | 43,423 | 3.51 |
| undergrowth (PROP kits) | 2,862 | 4,818 | 2,973 | 1.62 |
| **near strokes: fine** | 20,823 | **89,481** | 51,946 | 1.72 |
| **near strokes: mid** | 12,999 | **140,971** | 37,447 | **3.76** |
| near strokes: vista | 5,079 | 723 | 689 | 1.05 |
| ground | 350,208 | 315,677 (78,852 left by early depth test in three's order) | 190,437 | 1.66 |
| total | 1,509,543 | 1,565,255 (4.50 screens) | | |

The middle ring's fan touches paint each pixel they cover almost four times: big comb-cut quads standing up at a grazing
angle hide one another, and the hidden ones are painted anyway.

**On the level meadow looking 24 degrees down** (the worst case for the sward), the same tool, near rings re-laid:

| near rings | fine marks | fine fragments | mid fragments | sward fragments |
| --- | --- | --- | --- | --- |
| today (12 / 7 a cell) | 8,975 | 91,786 | 114,040 | 205,826 |
| everything 3x (36 / 14) | 23,226 | 201,919 | 229,699 | 431,618 |
| everything 5x (60 / 21) | 37,081 | 309,243 | 338,750 | 647,993 |
| **blades 4x within 6 m only** (48 within 6 m, 12 beyond) | 15,180 | 179,279 | 114,040 | 293,319 |
| blades 5x within 6 m | 17,208 | 208,275 | 114,040 | 322,315 |

**Why the same density everywhere is wrong** (worked from the camera, 1.8 m eye, 55 degrees, 372 lines): at 3 m a square
metre of ground covers about 5,300 pixels and a 30 cm blade about 40 pixels, so 19 blades cover **14 per cent** of the
ground's pixels; at 8 m a square metre is about 420 pixels and a blade about 22 (it never goes under 1.7 pixels wide), so
the same 19 blades cover **all of it, overlapping**. That is why the stills show bare carpet at your feet and a textured
band at 8 to 12 m. Coverage goes as density times distance squared: to hold it, blades a square metre must fall as
1/d2 from the feet outward. 4x within 6 m is the affordable step toward that.

---

## 4. What it costs on the phone (derived from the v37 table)

The v37 table (Adreno 740, 936 x 372, tier 1, lighter paint, 2,077k triangles, script 12.9 ms; settled rows only): as set
about 89 ms; plants one flat colour -34.0; plants written at once -34.4; a leaf in its own colour -0.6; no air on the
plants -1.8; no near trees -51.8; no trees 16.7 (the 60 cap); no small plants -0.6; no water -0.6; no ground -4.8; no
shadows -4.2; trees cast no shadow -1.2; half again as sharp +39.4. This machine draws in software and has been wrong
about the phone three times, so nothing here is timed on it: the counts are this machine's, the milliseconds are the
phone's, and the arithmetic joins them.

### 4.1 The constants

- **K1 = 35 ns: the plants' paint, per rasterised plant fragment.** 34.0 ms ("plants one flat colour") over the
  966,626 plant fragments at the spawn (far 585,252 + near 224,145 + mid 152,411 + undergrowth 4,818). The plant shader
  has discards, so its fragments cannot be thrown away by the depth test before they are painted: they all count.
- **K2 = 20 ns: the whole picture, per rasterised fragment.** "Half again as sharp" is 2.25 times the pixels and adds
  39.4 ms: 31.5 ms for each picture's worth, over 1,565,255 fragments a picture. (This also carries the post pass's own
  per-pixel work, so it slightly overstates a fragment.) Used for the near sward's shader, which is lighter than the
  plants' (no stroke layers, no bark) and heavier than a flat colour (the shadow map, the cast, the lantern, the air).
  **Range 12-35 ns.**
- **K3 = 0.21 us: a leaf-card triangle in the main pass.** "No near trees" -51.8 ms; their 376,556 fragments at about
  40 ns (K1 plus a little) are 15.1 ms; the other 36.7 ms over their 174,280 triangles. A leaf card's VERTEX shader carries
  its paint since v22 (`PROP_VERT`, "a leaf's paint once a leaf"), which is why it is dear. **A stroke or blade triangle
  of the PROP kits is cheaper** (no paint in its vertex shader): the trees' shadow pass, a light vertex shader, costs all
  the trees 1.2 ms.
- **Near-sward vertex: 4-25 ns a vertex, 5 a mark, unmeasured.** `NEAR_VERT` reads PHYSICS' bend field
  (`pcPhysBend`: three texture fetches) at every vertex. The low end is the shadow pass's light shader, the high end a
  vertex shader with texture fetches on a tile GPU. **Every live mark is shaded**, in view or not, in range or not: the
  ring's mesh is not culled (`frustumCulled = false`), and a mark beyond its range is only shrunk to nothing inside the
  vertex shader.
- **Checks against the table.** The ground: 350k light triangles and 79-190k painted fragments at 20-35 ns give 1.6-6.6
  ms for the fragments alone, plus a little for the triangles; the table says 4.8. The undergrowth: 2.9-6.9k blade
  triangles and 4.8-13.3k fragments give 0.2-1.0 ms; the table says 0.6 (and its own noise is plus or minus 1.3: the
  as-set rows wander from 88.1 to 90.7).

### 4.2 The near grass today: about 4 to 8 ms, and in no row

- Vertices: 23,305 marks x 5 x 4-25 ns = **0.5-2.9 ms**.
- Fragments: the fine ring's 89,481 (blades: no discard on Earth, all painted) and the mid ring's 140,971 (comb-cut
  quads: about half painted, half thrown away early, at about 4 ns) = 89.5k x 20 + 70.5k x 20 + 70.5k x 4 ns = **3.5 ms
  (2.2-6.0)**.
- Bound from above: "no trees" read 16.7 ms, the phone's cap, so everything that is not a tree fits in 16.7 ms: the
  ground (4.8), the water (0.6), the sky, the post pass and the near grass. So the grass is at most about 8 ms.
- **So: about 4 to 8 ms.** The brief's premise that "the undergrowth is nearly free" is true of the PROP undergrowth and
  NOT of the near grass, which the "no small plants" row does not touch (its pattern is `^pc-prop-(?!tall|far)`; the
  grass's material is `pc-near`; `NEAR_FRAG` does not read the flat-colour switch either).

### 4.3 What density costs, and where the cost starts to show

- **Fragments are the cost**, at about 20 ns each (12-35): every 50,000 added sward fragments (a seventh of the screen
  painted once) is about **1 ms**.
- **Triangles are not**, for the sward: with 4x the blades within 6 m the fine ring and the carpet hold about 45-52k
  triangles in range (2.5 per cent of the frame's 2.08M), and once marks outside the view are culled in the vertex
  shader (6.1) the ones the eye cannot see cost only the cull test.
- **Where it starts to show:** 4x within 6 m adds 87.5k fragments on the meadow looking down (+1.75 ms, 1.0-3.1); 5x adds
  116.5k (+2.3 ms). 3x EVERYWHERE adds 225.8k (+4.5 ms, 2.7-7.9): rejected. Beyond about 4x near, each step costs more
  than the cull and the middle-band fix can pay back.

### 4.4 The speed-test rows to add first (`src/core/bench.js`, PILOT's file)

Before any flora is built, so the phone measures today's grass:

    ['no near grass', () => show(/^pc-near$/, false), () => show(/^pc-near$/, true)],
    ['near grass: the blades only (fine ring)', () => nearRing((r) => r.material.visible = r.cfg.name === 'fine'),
                                                () => nearRing((r) => r.material.visible = true)],

(`nearRing` walks `pc.world._near.rings`; each ring has its own material, all named `pc-near`; `show` toggles
`material.visible`, which the ring's own update does not reset.) Then one row per package, each THE CHANGE ITSELF
turned off, set through a uniform so no shader is rebuilt while a row is timed (5.4): 'near grass as before',
'grass not culled off-screen', 'no carpet of near blades', 'the old middle band', 'no flowers', 'no new small plants',
and one row that RAISES the load: 'near blades twice as dense'.

---

## 5. The machine the four packages share

### 5.1 One map of where things bloom: `src/world/bloom.js` (new, pure JS, no three)

`bloomAt(S, x, y, z, s, bi, out)`: for a unit direction on the body, its surface sample `s` and its biome index `bi`,
it writes `out.kind` (which of the biome's flower kinds), `out.dens` (0..1, plants a square metre over the kind's peak),
`out.heart` (0..1, how deep into a drift) and `out.season` (0..1, how much in flower now). It is the ONE place that
decides where flowers and the low plants stand, and every distance reads it:

- the near carpet and fine ring (6.2, 7.2) lay plants where `dens` is high;
- the middle ring (7.3) lays the drift's colour as round touches;
- the vista ring (9.2) lays a drift's heart as a flat drag of its colour;
- `surface.js` mixes the drift's colour into the ground's own colour by its coverage (9.1), which is what is seen from
  150 m to a mile.

So a drift is in the same place at every distance and never pops from one kind of mark to another in a different spot.

How it decides (all deterministic, value noise on the cube face in metres, like `nearground.js vnoise`):
- **Habitat** from the sample: the meadow share (`s.under`), the canopy (`s.canopy`), the distance to water (`s.s`), the
  slope, the height, rock (`s.rock`), glade (`s.glade`). Each kind names its window (wet ground, wood edge, open turf,
  cliff edge, above the trees) and its curve.
- **Flowering slopes** at 150-600 m: a slow field that makes whole slopes rich or poor in flower (a hillside of
  buttercup, a moor of heather). This is what reads from a mile.
- **Drifts** at the kind's own scale (4-30 m): a kind grows in clonal patches, dense at the heart and thinning to its
  ragged edge, with outliers beyond. Which kind a drift is comes from a larger field (as `which` does today), so the
  neighbours differ.
- **A sprinkle**: a low share of a second kind everywhere in its habitat, so a meadow is never one colour.
- **The year**: each kind's flowering window on `SEASON.t` (0 summer to 1 autumn): meadow flowers thin and shrink as
  autumn comes, autumn kinds (asters, goldenrod, toadstools, rust bracken) come up. Nothing pops: density is scaled.

Cost: CPU only. Two to four value-noise reads per call; called once a cell by the rings and once a surface sample by
the colour recipe (9.1).

### 5.2 The data: a biome's `oil.flora` (`src/data/looks/<world>.js`)

Laid over the biome in the oil look only, through the existing `oil.over` (`data/mode.js overlayOil`), so the
watercolour game never sees it. Pure data, safe in Node:

    flora: {
      sward: { blade: 0.75, carpet: 4, gm: 0.25, root: 0.8, tip: 1.1, tall: 0.4 },     // package G
      blooms: [                                                                          // package F
        { kind: 'buttercup', shape: 'cup',   pig: ['lemonYellow', 'quinGold'], head: [0.015, 0.025], stalk: [0.25, 0.55],
          heads: [1, 4], drift: 9, peak: 14, share: 0.35, habitat: { wet: [0.2, 1], open: [0.5, 1] }, season: [0, 0.55] },
        ...
      ],
      plants: [                                                                          // package O
        { kit: 'bracken', mark: 'frond', drift: 14, peak: 3, habitat: { canopy: [0.25, 0.9], open: [0, 0.6] }, autumn: 'rust' },
        ...
      ],
    }

Colours are NAMED PIGMENTS (`pig('cadScarlet')` and so on, `data/looks/common.js`), never loose numbers: the rule the
animals' coats already keep, so a flower can never be a colour that is not in its place's paint box.

### 5.3 Density by the size on the screen

Every package follows one rule: **a kind of mark is laid as densely as keeps it covering about the same share of its
pixels at every distance, and no mark is drawn where it would be under about 1.5 pixels across** (no grain). Blades
get denser toward the feet (they cover too little there), tufts and touches get fewer and larger outward, and the
thing a mark stands for passes on to the next coarser carrier (blade, then tuft, then flat drag, then the ground's
colour) inside a fade band, as the rings already hand over.

### 5.4 Switches, uniforms and rows

- Everything is behind `LOOK.oil` / `PC_OIL` / `MODE.oil`: the watercolour game is untouched.
- Each package has an address switch (read where `VISTA` is read in `nearground.js`, or with `_qn` in `shared.js`):
  `?grass2=0|1` (G), `?bloom=0|1` (F, and A's tint), `?flora2=0|1` (O), `?bloomair=0|1` (A's ground tint alone),
  `?sheen=0|1`. Off means the game as it is today, exactly.
- One new uniform on the near material, `uNearK` (vec4): x 1 cull marks outside the view, y how much of the carpet is
  drawn (0..1), z flowers drawn (0/1), w new low plants drawn (0/1). The vertex shader collapses a mark by its class
  (a class number in one more per-instance float: `iExt` grows from two floats to three), so the speed test turns each
  package off at once with no shader rebuilt and no buffer re-laid.
- The new PROP kits (section 8) get materials named `pc-prop-under2-*`, so a row can `show()` them off by name, and the old
  "no small plants" row still means what it meant.

### 5.5 How the other worlds follow

The machine is the same everywhere; a world gets flora by writing data. Today's flora-bearing biomes off Earth (by their
`small` tables): two on Jupiter (grass, ferns, flowers, bushes), two on Saturn (one a grassy meadow with flowers, one
crystal splinters with grass), one on Venus (ferns, bushes, flowers) and one on Neptune (ferns, bushes, flowers). For
each: an `oil.flora` with its own sward dials, two to five bloom kinds in its own pigments (the references' "three colours
that key a world": a strange world's flowers can be its accent) and the plants its ground wants. The ice and rock
worlds (Mercury, the Moon, Mars, Uranus, Pluto) take no blooms; their
"plants" are the crust, splinter and lichen marks the near ground already lays, and `bloomAt` returns nothing there.

---

## 6. Package G: much denser grass

### 6.1 G1. Cull the marks the eye cannot see (`materials.js NEAR_VERT`)
At the top of `main`, before `pcPhysBend` and the fog: the root in view space (`modelViewMatrix * vec4(iRoot, 1.0)`);
if it lies behind the eye by more than the mark's length, or outside the view's side planes by more than the mark's
length plus a margin, or past its own range (`range`, as now), write `gl_Position = vec4(2.0, 2.0, 2.0, 1.0)` (outside
the clip volume) and return. The phone's binning pass computes the same position, so it drops the triangles there too.
- **Look:** none (only what is off-screen goes).
- **Device:** today 60 to 70 per cent of 23k marks are off-screen; after G2, about 19k marks x 5 vertices skip the
  expensive part: **-0.3 to -1.9 ms**. Row: 'grass not culled off-screen' (`uNearK.x` 0).
- **Risk:** a mark whose root is just off the edge but whose blade leans into view; the margin is its own length. The
  shadow map does not draw the sward, so nothing else depends on it.

### 6.2 G2. A carpet of blades near the feet (`nearground.js`)
A fifth ring, first in `RINGS_OIL`: `{ name: 'carpet', cell: 0.45, range: [0, 7, 8], per: 30, inner: [0.5, 1.2], alt: 14,
step: 2, carpet: 1 }`, with its own pool and `layCarpet()`: tufts of 8 to 24 blades, three times the fine ring's blades a
square metre, so together the near sward has about **4x the blades within 6 m** (about 80 a square metre in open
meadow, 40 at the wood's landing). Each blade's own range falls between 4 and 7 m (`range = mix(...)` per stroke as now),
so the carpet thins smoothly into the fine ring.
- WHY A RING AND NOT MORE MARKS IN THE FINE RING: a cell keeps its marks as the eye walks on (it is laid when it enters
  the ring at 12 m), so density cannot follow distance by laying; the fine ring would have to carry 4x blades in every
  cell to 12 m (53k of its 59k slots at tier 1, far over its pool at tier 2's 23 m) and collapse most of them. The
  carpet ring is small and short-ranged, and it is not laid at all on tier 0 or above 14 m of height.
- **Look:** the meadow experiment (`exp-meadow-today-vs-near4x-owncolour.jpg`, bottom) is the nearest still: with the
  blades in their own colours (6.4) the near ground reads as GRASS, not as a carpet with blades on it. Seen.
- **Device:** +87.5k fragments on the meadow looking down: **+1.0 to +3.1 ms** (1.75 at K2). Vertices: about 6-9k more
  marks, two thirds culled by G1: under 0.3 ms. Script: a re-list every 0.9 m walked, scaled from the fine ring's
  measured 4.8 ms every 1.2 m (`nearground.js` header; Node on this machine, and a phone's script may be two to three
  times slower) by its cell count: about 1-1.5 ms per re-list, so about 0.05 ms a frame walking and 0.25 running, inside
  the existing slice. Row: 'no carpet of near blades' (`uNearK.y` 0).
- **Risk:** the script time on the phone (12.9 ms today); the pool sizing (count it in Node for the densest place, the
  alpine meadow, at every tier). The fade-in at 0.5-1.2 m keeps blades out of the lens.

### 6.3 G3. The middle band rebuilt (`nearground.js layBroad`, `materials.js NEAR_VERT` / `NEAR_FRAG`)
Today's fan touches (12 to 40 m) are comb-cut quads with five to ten teeth whatever their size, so at 20 m (5.6 cm a
pixel) a 20 cm touch has teeth under a pixel wide: the yellow speckle in the 10 m stills, and a self-lap of 2 to 4.8.
- The vertex shader passes the touch's width in pixels (`iPar.x / wPx`); the fragment shader cuts `clamp(floor(px /
  2.2), 2, 9)` teeth, so a tooth is never under about 2 pixels.
- Touches narrower (0.6x) and more upright; each with its own range so that past about 25 m half of them go (the 1/d2
  rule of 5.3 with the size growing as they thin).
- Their colour follows the blades' (6.4): own greens, a dark foot, a lit top; the gold of seed heads where the grass is
  rough, as now.
- **Look:** the band at 12-40 m reads as tufts, not as speckle. From eye height the middle ring does carry the far
  meadow's texture and its flower dashes (`exp-meadow-today-near4x-nomidring.jpg`: without it the horizon band goes
  smooth), so it is rebuilt, not dropped.
- **Device:** its fragments from 114-141k to about 60k, half of the ones that go being painted ones and half thrown away
  early: **-0.4 to -1.6 ms**. Row: 'the old middle band'.
- **Risk:** the fade between blades and tufts at 6-13 m must not show a seam; judge it in a still from 1.8 m and from 10 m.

### 6.4 G4. Grass in its own greens, dark at the root, lit at the tip, moving in gusts
(`nearground.js styleOf` / `layFine` / `layCarpet`; `materials.js NEAR_VERT`, `NEAR_FRAG` oil branch; `surface.js`)
- **Own colour:** a blade takes the biome's three grass tones (`under.leaf`) with `gm` 0.25 toward the ground's wash, not
  0.60. Seen in the experiment: the blades stand out as strokes. A biome may set `oil.flora.sward.gm`.
- **Dark roots, lit tips:** `NEAR_FRAG` already lightens a blade's upper part in the sun; add a step deeper on its lowest
  quarter (`vS.x < 0.25`), never darker than the floor's shade green. The references' grass is "deep green in the shade
  and bright yellow-green in the sun"; a sward is dark between the blades and light on top.
- **The floor under a dense sward a step darker:** in `surface.js`, where the sward is dense (`under` x meadow share),
  the NEAR paint (`b.r, b.g, b.b`) goes a step toward the grass's shade green, and the FAR colour (`b.r2, b.g2, b.b2`)
  a step toward the tip colour: up close the gaps show dark roots, from the air a meadow is the colour of its tips. One
  line each in the recipes that set the grass colours (`_forest`, the generic recipe's patches).
- **Gusts that travel:** PHYSICS' bend already carries wind waves (`physics/flora.glsl.js`: `uPhysWind` with gust01, the
  wave train in `pcPhysBend`). `NEAR_VERT` hands the bend toward or away from the eye to the fragment shader
  (`vBend`), which lifts or lowers the blade's tone a half step: bands of sheen sweep across a meadow as the gusts pass
  (`?sheen=0` off). The same tone is laid on the middle ring and, read once at a mark's root, on the vista drags (9.2),
  so the gusts are seen from the air too.
- **The stones that read as holes** (sea coast, wetland: `layFine` "by the water: stones", `layBroad` stones): a stone
  is lit on top and its own colour at a middle value, never the dark brown oval that reads as a hole. (The far-view lane
  owns rocks; these are the sward's pebbles, `nearground.js`. Tell them.)
- **Device:** arithmetic only: about 0, under 0.3 ms with the sheen. No row of its own; it is in 'near grass as before'.
- **Risk:** the floor darkening touches `surface.js`, which the far-view lane also edits (section 10).

### 6.5 G in sum
**Device: +1.75 (G2) -1.0 (G1) -1.0 (G3) = about -0.25 ms; range -2.5 to +2.4.** Rows: 'no near grass' (today and after),
'near grass as before' (`?grass2=0` as a uniform state), 'grass not culled off-screen', 'no carpet of near blades', 'the
old middle band', 'near blades twice as dense'. **Switch:** `?grass2=0|1`. **Stills that judge it:** the same view, A
and B, at the level meadow (1.8 m, 24 down; 10 m, 30 down), at the autumn landing by the river, and inside the green wood;
plus a walk of 20 frames along a line at 1.5 m/s (the carpet must not show cells arriving).

---

## 7. Package F: flowers

### 7.1 F1. The kinds, place by place (data: `earth.js`, each biome's `oil.flora.blooms`)
Shapes are the near ring's own touches (7.2). Colours from the biome's named pigments; every flower a step below the
explorer's cloak in strength (the cloak is the strongest colour in the picture: handover section 2, item 6) and lit at its own
value, so it pops against the grass and keeps its form.

| place | kinds (shape; pigments) | where they grow |
| --- | --- | --- |
| green wood | bluebell (bell; ultramarine + cobaltViolet), wood anemone (rayed; paper + a breath of roseMadder), red campion (rayed; alizarin + roseMadder), buttercup (cup; lemonYellow) in glades, foxglove (spike; roseMadder + alizarin) at the edges | carpets under open canopy in spring; campion and foxglove at the wood's edge; buttercup in damp glades |
| autumn wood | Michaelmas aster (rayed; cobaltViolet, gold eye), harebell (bell; cobaltViolet), late hawkbit (rayed; quinGold), goldenrod (spike; quinGold) in glades; red toadstools under the trees (8) | violet against the yellow-green and gold is the floor's complement: the strongest pop the wood can have |
| alpine meadow | gentian (cup; ultramarine, deep), alpine aster (rayed; cobaltViolet), ox-eye and edelweiss (rayed; paper, grey eye), globe flower (cup; lemonYellow), alpine pink (cushion; roseMadder), alpine poppy (cup; cadScarlet, kept from today's drift) | gentian and pink on the high turf; globe flower in damp hollows; ox-eye on dry slopes; poppy on stony ground |
| sea coast | thrift (cushion with pom-poms; roseMadder), sea campion (rayed; paper), bird's-foot trefoil and kidney vetch (cup; quinGold, lemonYellow); heather and gorse are plants with flowers (8) | thrift along the cliff edge (where `lip` is high); trefoil in the short turf; campion on stony ground |
| misty wetland | yellow flag iris (spike-kit; lemonYellow), marsh marigold (cup; quinGold), purple loosestrife (spike; alizarin + cobaltViolet), meadowsweet (froth; yellowOchre thinned), cotton grass (froth tufts; paper) | iris and marigold at the water's edge (`s.s` small); loosestrife on wet banks; cotton grass in drifts over the bog; meadowsweet on the drier rims |
| desert canyon | desert marigold (rayed; lemonYellow), globemallow (cup; cadOrange), prickly pear flowers on the kit (8) | sparse, in the dry washes (the canyon floor's drainage lines) and at the foot of walls |

### 7.2 F2. Flowers as plants near the eye (`nearground.js layFine` / `layCarpet`; `materials.js NEAR_VERT` / `NEAR_FRAG`)
Today a flower is one stalk stroke and one round touch of pure colour. A flower is a PLANT:
- one to four heads (`heads`) on a stalk that forks, at different heights, with one or two short leaf strokes at its
  foot, a few buds (small closed touches) on some;
- in a drift's heart 6 to 14 plants a square metre (`peak`), at its edge 0.5 to 2, as outliers 0.2;
- **head shapes** as new touch kinds, each cut by the fragment shader from one quad facing the eye as the round touch
  is now, each a clean flat piece with no outline: **rayed** (a disc of petal colour with a centre dab: daisy, aster),
  **cup** (a disc whose upper part is a step paler, the light in the cup: buttercup, gentian, poppy), **bell** (a small
  inverted cup seen from the side, hanging: harebell, bluebell), **spike** (a tall quad cut into four to eight stacked
  dabs: foxglove, loosestrife, goldenrod), **froth** (five to nine small dabs in a loose head, each at least 2 pixels:
  meadowsweet, cotton grass), **cushion** (a low dome with a lit top and a shaded foot, heads on it: thrift, alpine
  pink). The second tone of each is worked out by rule from the first (a daisy's eye gold, a poppy's eye a deep version
  of its own red, a cup's light a step paler), so no new attribute is needed;
- the vertex shader's frame test (`NEAR_VERT`: `broad`, `fan`, `lying`, `dab`, today "over 5.5 lies flat") becomes a
  small table of kinds: lying flat (the fallen leaf, the rosette of 8), facing the eye (the round touch and the six heads),
  standing (blades, fans, the frond of 8); and the same in `tools/overdraw.mjs nearReplica` so the counter stays true;
- heads never under 2 pixels (the round touch's `wPx * 1.3` floor, as now).
- **Look:** the drift of the level meadow, but with flowers that have a form at 2 m (two tones, stalks, several heads,
  buds), several kinds a place, and drifts that grow where their habitat is.
- **Device:** today's meadow fine ring holds about 2.8k heads; doubling in the hearts and adding stalks, buds and leaves
  is about +3 to 6k marks (two thirds culled) and +30 to 60k fragments: **+0.4 to +1.5 ms**. Row: 'no flowers'
  (`uNearK.z` 0).
- **Risk:** too many pure colours become confetti: hold it with the drift structure (one kind a drift, dense at the
  heart, a sprinkle only) and judge it at 2 m and 10 m.

### 7.3 F3. Drifts in the middle distance (`nearground.js layBroad`)
Today: short horizontal dashes of colour, read as white and red lines at 10-40 m. Instead: round touches of the drift's
colour, 6 to 14 cm, at least 2 pixels, as many as its heart density says, standing at the sward's height, with a few
taller spikes where the kind has them. **Device:** about the same marks as today's dashes: near zero.

### 7.4 F4. Flowers that stand above the grass, as kits (`src/world/underkit.js` new; `floraplace.js placeUnder`; `flora.js _buildUnder`)
Only the tall ones that must be seen standing at 40-110 m: foxglove, loosestrife, goldenrod, iris, thistle. Built from
strokes (stalks, sword leaves: part 2) and accent touches (heads: part 3), NOT leaf cards (whose vertex paint is the
dear path, K3). One to two a drift heart, at most a few hundred in reach. **Device:** at most about 1.5k triangles in
view and a few thousand fragments: under 0.3 ms. Counted in 'no new small plants'.

### 7.5 F in sum
**Device: +0.4 to +1.8 ms, about +1.** **Switch:** `?bloom=0|1`. **Rows:** 'no flowers', 'no new small plants'.
**Stills that judge it:** each place at 1.8 m and 10 m in summer (`season=0.15`) and in autumn (`season=0.85`), A and B; a close still of one
drift heart at 1.2 m to judge the heads' forms; and the 30 m and 150 m frames of package A.

---

## 8. Package O: the other plants

Each in this game's own hand, built in code from `kitbuild.js`'s pieces (`tube`, `stroke`, `leafCards`) or as near-ring
touches; no pictures from anywhere. Two ways to build, chosen by what the phone pays:
- **Low plants as near-ring touches** (the sward's machine: 5 vertices, a light vertex shader, culled by G1): moss,
  clover, heather sprigs, bracken fronds near the eye, sphagnum, lichen, rosettes, cushions. New touch kinds:
  **frond** (an arching quad cut into pinnae along its length, the teeth at least 2 pixels), **cushion** (7.2),
  **rosette** (a flat round touch cut into five to eight lancets, lying on the ground).
- **Plants with a body as PROP kits** in a new file `src/world/underkit.js` (so the trees lane's `florakit.js` is not
  edited), placed by `floraplace.js placeUnder` (new `U_*` kinds read from the biome's `oil.flora.plants`), meshed by
  `flora.js _buildUnder` (new lists, one mesh a kind a cell, as now), each with a far form or none past 40 m (the vista
  ring and the ground's colour carry them beyond). Strokes and big leaves, few leaf cards.

### 8.1 What each place needs

| place | low plants (touches) | plants with a body (kits, triangles each) | what it adds from the air |
| --- | --- | --- | --- |
| green wood | moss on banks and by streams (deep green flat touches), bracken fronds near, wood sorrel/clover carpets | bracken (frond kit: 6 fronds, ~60), hazel bush (bush variant, ~90), fallen log with moss (`logGeometry`: a 6-sided tube with a broken end and two stubs, moss as accent dabs, ~80), bramble (arching canes, dark leaves, white flowers, ~100) | bracken drifts as darker green masses in the glades' edges |
| autumn wood | the same, the bracken in RUST and orange as autumn comes (`leafSum`/`leafAut`, the same machine the undergrowth already turns with), thick litter drifts under the stands | rust bracken (~60), fallen logs (~80), toadstools (`toadstoolGeometry`: a cluster of two to four stalks and caps, red with pale flecks, ~40), holly (few large dark glossy leaves and red berry dabs, ~80), rosehip bush (~90) | rust bracken under gold crowns, which is the references' "russet" floor |
| alpine meadow | juniper mats (dark blue-green flat touches), saxifrage and lichen on boulders (crust touches: orange, grey-green), tussocks | alpine rose (low pink-flowered shrub, ~80), dwarf pine (krummholz: a low spreading conifer of strokes, ~100) | pink and dark-green patches on the turf; lichen colour on the rocks |
| sea coast | thrift cushions along the edge, orange sea lichen on rocks (the coast's accent pigment is cadOrange), short turf | **heather** (a low mound of short strokes with violet accent touches, ~60), **gorse** (a dense spiky mound of dark strokes with lemon-yellow accent touches, ~110), marram tussock (pale grass kit, ~50) | **purple heather and yellow gorse in large patches on the cliff tops**: the one thing that tells a coast from a meadow at 150 m |
| misty wetland | sphagnum (red-green flat touches), sedge tussocks, duckweed and water-lily pads lying ON still water (flat touches on the water's level: the water lane's surface; tell them) | bulrush (the reed kit with a brown cigar head, ~45), yellow flag iris (sword leaves and heads, ~45), cotton grass tussock (white froth heads, ~50), willow (exists) | sedge-green and red bog colours, white drifts of cotton grass, dark reed beds round the pools |
| desert canyon | pale dry grass tufts, lichen on the walls' feet | sagebrush (a round blue-grey mound of strokes, ~70), yucca (a rosette of long swords, ~50), prickly pear (flat oval pads in a stack, yellow flowers, ~50) | grey-green dots along the washes; the floor stops being all one colour |

Also for every wooded place: **a fringe at the water's edge** (sedge and rush touches, iris and marigold where it is wet,
a band 1 to 4 m wide in a darker olive green), which also makes a river read from the air (the references: "grass down
to the water").

### 8.2 Device
Low plants as touches: about +2 to 4k marks in reach and +20 to 60k fragments: **+0.3 to +1.2 ms**. Kits: a hard budget
of **at most 4,000 triangles and 20,000 fragments in view at the landing**, checked with `tools/overdraw.mjs` before each
kit lands: 4k x 0.05-0.21 us + 20k x 35 ns = **about 0.9 to 1.5 ms**. Together O is +1.2 to +2.7 ms, about +1.8: the
dearest package, so it lands kit by kit, the places that lack most first (the coast's heather and gorse, the wetland's iris and
cotton grass, the autumn wood's bracken, logs and toadstools, the meadow's cushions, the canyon's sage and yucca).
**Switch:** `?flora2=0|1`. **Rows:** 'no new small plants' (`show(/^pc-prop-under2/)` and `uNearK.w` 0).
**Risk:** the kits share `makePropMaterial` with the trees, so whatever the trees lane does to `PROP_VERT` / `PROP_FRAG`
(the leaf's paint, impostors) changes these kits' look and cost too (section 10). **Stills that judge it:** each place at
1.8 m and 10 m with and without `?flora2`, and a 30 m frame of the coast's cliff top and the wetland.

---

## 9. Package A: how it reads from the air

The stills say why this matters: at 150 m the vista ring (reach 190 m from the EYE at tier 1, so a disc of only about
117 m round the point below) holds every flora mark there is, and the frame's middle is about 244 m away. **Beyond that
disc the only carrier of flora is the ground's own colour.** So A puts the flora into the ground's colour first.

### 9.1 A1. The drift's colour in the ground (`surface.js`, via `bloom.js`)
After a recipe sets its grass colours, one call `bloomTint(b, x, y, z, bi)` mixes the bloom kind's colour into the NEAR
paint and the FAR colour by its coverage: about 0.25 to 0.5 at a drift's heart, about 0.1 to 0.2 averaged over a
flowering slope. The ground's dabs (`TERRAIN_FRAG`) pick their paint at their own centres (`pcGroundAt`), so a tinted
patch is laid in dabs, each one flat colour, and its edge is broken by them, not smeared; but each dab carries the MIX
of flower and grass, which is why the pointillist variant below is the better picture. The same call carries the low
plants' masses (heather purple, gorse yellow, rust bracken, cotton-grass white, sedge green) and the meadow's own fields
(the gold of seed heads where the grass is rough, the dark of the sward's shade, 6.4).
- **Look:** from 150 m drifts of 8 to 20 m are patches of 10 to 30 pixels in their own colours; from a mile (about
  7 m a pixel) a single drift is gone but a flowering slope or a moor of heather is a tinted field. NOT SEEN: it needs
  the build; the stills to take are below.
- **Device:** zero on the GPU (the ground's colour is laid when its patch is built); CPU two to four noise reads a
  surface sample. **Switch:** `?bloomair=0`.
- **Pointillist variant (for the far-view lane to choose):** a dab picks the flower colour WHOLE with probability equal
  to the coverage instead of a mixed colour, which keeps the colour pure from the air. It needs a channel in the
  ground's vertex data (`patchgen.js`) and a branch in `TERRAIN_FRAG`: both the far-view lane's files.

### 9.2 A2. The vista ring carries drifts, shrubs and gusts (`nearground.js layVista`)
Add to the flat drags it lays: a drift's heart as a round or oval drag of the kind's colour (mixed half with the ground,
as its other drags are, `?vistaink=`), heather and gorse patches as their colours, cotton grass as white, all turned
along the grass's comb (A3) and toned by the gust (6.4). **Device:** a few hundred more of its marks, which paint under
a thousand fragments today: about 0.05 ms.

### 9.3 A3. Stroke direction
The vista ring already turns a flat drag along the land's contour (`contourTurn`). On grass, blend that with the
prevailing wind of the place (one direction per world and season, the mean of `uPhysWind`): a meadow seen from the air
is COMBED one way and gusts sweep across it, the direction the references' painters lay grass ("the direction of the
strokes: along the ground's slope"). Ask the far-view lane to lay the ground's own dabs on grass along the same comb
(`TERRAIN_FRAG`), so the two agree.

### 9.4 A4. Reach from height (the far-view lane's call)
The vista ring's reach is measured from the eye, so from 150 m it covers only the ground almost under the camera. If
the far-view lane extends or re-measures it (horizontal distance, or a ring that lives from 100 m to 450 m of ground),
A2's marks go with it. Otherwise A1 carries everything past about 120 m, which is why A1 comes first.

### 9.5 A in sum
**Device: +0.1 to +0.4 ms.** **Switches:** `?bloomair=0|1`, `?sheen=0|1`. **Stills that judge it:** each place at 30 m,
150 m, 300 m and 1,600 m (a mile), A and B, same camera, same hour; the autumn wood and the level meadow first. For the
mile: the gallery's `high` preset raised (`&dy=`), or the recipe of Appendix A with a height of 1,600.

---

## 10. Where these overlap the other lanes

| file | the trees lane | the far-view lane | the flora (this design) | how to keep apart |
| --- | --- | --- | --- | --- |
| `src/world/flora.js` | tiers, `update`'s tree scaling, `_instanced`, `_retier`, far cells | | `_buildUnder` (new lists), the kit table (new entries), `_underMats` | different functions; flora lands after the trees lane's changes to this file, rebased on them |
| `src/world/florakit.js` | tree geometries (`birch`, `pine`, `fir`, `bare`, `far*`) | `rockGeometry` | none: new kits go to `src/world/underkit.js`; today's `grass`/`fern`/`bush`/`flower` kits are left alone | no edit |
| `src/world/floraplace.js` | `placeTrees` | | `placeUnder` (new kinds) | different functions |
| `src/render/materials.js` | `PROP_VERT` / `PROP_FRAG` leaf, bark and far-crown work | `TERRAIN_FRAG` (near and far), `WATER_*`, the rock branch of `PROP_FRAG` | `NEAR_VERT` / `NEAR_FRAG` only | flora does not touch `PROP_*`; its PROP kits use the existing blade (part 2) and accent (part 3) branches as they are |
| `src/render/kitmat.js` | named in the brief | | none | no edit |
| `src/world/surface.js` | | the ground's colour recipes, the far colour | one call `bloomTint` after the grass colours are set, and the sward's dark-roots step (6.4) | agree the call's place with the far-view lane; it changes `b.r..b.b2` only where `bloomAt` says |
| `src/world/patchgen.js` | | the ground's vertex data | only for the pointillist variant (9.1), which is theirs to choose | |
| `src/world/nearground.js` | | the vista ring (built for the 275 m upgrade) may be extended | the carpet ring, `layFine`, `layBroad`, `layVista`'s new marks, `styleOf` | flora owns the file; the far-view lane's vista changes and A2 go through one person |
| `src/core/bench.js` | its own rows | its own rows | the rows of 4.4 | PILOT's file: add all lanes' rows in one commit |
| `tools/overdraw.mjs` | | | the new touch kinds in `nearReplica`; a tier argument (it hard-codes tier 2 and `/home/user/pc-dev`) | coordinator's file |
| rocks | | owns them | the sward's pebbles only (6.4) | tell them about the "holes" |
| water | | owns it | lily pads and duckweed lie on still water (8.1) | flora lays them as near touches at the water's level; agree the level |

---

## 11. Order, budget, risks

**Order** (each lands with its rows, A/B stills and the three test suites):
1. The two speed-test rows of 4.4 on today's code, and the owner's next speed test reads them: it calibrates 4.2.
2. G1 (the cull): free picture, buys back time.
3. G4 (colour and value) and G2 (the carpet): the change the owner will see first.
4. G3 (the middle band).
5. `bloom.js` with F1-F3 and A1 together (they share the map), then A2-A3.
6. O kit by kit; F4 with it.

**Budget, central estimates, on the phone:** G about 0 (-2.5 to +2.4); F about +1 (+0.4 to +1.8); O about +1.8 (+1.2 to
+2.7, held by its cap); A +0.2 (+0.1 to +0.4). **About +3 ms over today's frame** (between -1 and +7), on top of a near
grass that is already about 4-8 ms. If the trees lane brings the frame to exactly 33 ms, this puts it near 36 (28 a
second). The carpet's density and O's cap are the two dials that give it back (G alone is about free; G, F and A together
about +1), and the rows say what each is worth on the real device.

**Risks, ranked:**
1. My device constants are derived, not measured (K2 could be 12 or 35 ns): the net of G could be +2 instead of 0.
   The rows of 4.4 settle it with the first speed test.
2. The PROP kits ride on the trees' material: if the trees lane changes how a leaf is painted, O's kits change with it.
3. Confetti: too many pure colours at once. The drift structure, one kind a drift and a step below the cloak, is the
   guard; the 2 m and 10 m stills judge it.
4. Script time: the carpet ring re-lists every 0.9 m; on a phone whose script is 12.9 ms, count it in Node first.
5. `surface.js` is shared with the far-view lane; one agreed call, landed once.

---

## 12. What I could not settle

- **The phone's cost of the near grass.** Derived as 4-8 ms; no row measures it. Section 4.4's first row does.
- **The phone's cost of a near-sward vertex** (4-25 ns): no row comes near it. 'grass not culled off-screen' measures it
  as a by-product.
- **How the drifts read from 150 m and a mile.** Argued from pixel sizes (9.1), not seen: it needs the build.
- **How the gusts look in motion.** Nothing in motion can be judged on this machine; only the owner's phone can.
- **The tier-2 (desktop) pool sizes** for the carpet ring: to be counted in Node when it is built.
- **Whether the alpine meadow's easel spot is the right stand.** At 15.4 h it is a steep slope in shadow and every frame
  of it is dark violet; the level meadow used here is 660 m away. The vantage finder may want a flora term.

---

## Appendix A: the camera recipe used (for the A/B stills)

The lab (`tools/lab.mjs serve`, then `open` with the gallery address at 936 372), then in the page:

    const g = window.__pcGallery, w = g.world, st = g.state, V = st.pos.constructor;
    // the spot: w.getSpawn('earth') for the autumn landing; for the level meadow:
    //   sp = w.findBiome('earth', 'alpine_meadow'), then 660 m along the bearing 9/24 of a turn
    //   (east = (0,1,0) x up, north = up x east; offset = east * sin(a) * 660 + north * cos(a) * 660)
    st.pos.copy(dir).multiplyScalar(groundRadius + height);  st.pitch = deg(-24); st.yaw = deg(yaw);
    root.position.copy(st.pos).multiplyScalar(-1);            // the body under the camera, as the gallery's placeBodies
    w.setBuildBudget(60); for (...) w.update(0.1, g.camera.position, 'earth') until w.busy is 0 three times; w.setBuildBudget(5);

then `node tools/lab.mjs grab out.png 3`. Heights and pitches used: 1.8 m / -24, 10 m / -30, 30 m / -32, 150 m / -38.
The autumn landing: spawn, east 6 m, north 4 m, yaw 200. The level meadow: yaw 60, 11 h.

## Appendix B: the counter run

`tools/overdraw.mjs` copied to scratch with `REPO` set to this checkout and `QUALITY.level = 1`, run as
`node overdraw.mjs w=936 h=372 aspect=screen raster=1 where=spawn rings=1 ez=1` (13 s). For the meadow rows of section 3,
a stand added at the level meadow, the camera pitched -24 degrees, and the near rings re-laid after the first settle with
the marks a cell named in the table. The full outputs are not committed (they are in the session's scratch); the numbers
that matter are in sections 3 and 4.
