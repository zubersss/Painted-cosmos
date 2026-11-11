# PAINTER notes

Branch: `cosmos` (shared with PILOT and PHYSICS, one working tree). Commits: `tools/commit.sh painter`.
This file was rewritten by the second PAINTER agent (the first ran out of working context). The
first agent's record of M1 is kept at the end ("Earlier answers").

## Handover (read this first if you are a fresh PAINTER)

Written by the tenth PAINTER agent (M3 block 7, after the ninth was stopped by a usage limit).
The eighth agent's handover is kept below it ("Handover of block 6"); its rules still hold.

- **Where things stand**: block 7 (the picture in motion, the weather) is verified and
  finished: see "M3 block 7" below for every piece, the evidence and a blunt verdict each. In
  short: arrival, fill and walk pass (no pops, no tier flicker); Neptune's sea heaves and runs
  up; the pale forms in Neptune's storm sky were headlands in a near-white mist (fixed in shared
  code: storm mist is grey, the low sky takes it); the dust storm veils the explorer (near-air
  veil `G.uAirNear`); spray is a soft blot. Weak: no torn white crests on the near sea; the near
  headland's vertical end; the blizzard's ruled crest.
- **The explorer steps** by PHYSICS' gait (`models.js`, item 2): boots by `feet`, hips by
  `ride`, no clock of its own; PILOT's `figureArgs` passes the fields. Gallery `gait=` poses it.
- **Branches move** (item 3): PHYSICS' `pcPhysCrown` in the tree shader (`PC_PHYS_BRANCH`,
  materials.js), per-vertex `aBranchId` / `aLeaf01` from the kit builder (`florakit.js`:
  a trunk -1, every other tube or blob its own number, a birch's foliage masses take the number
  of the branch whose tip is within 2.2 m), `uPhysBranchClock` in `PHYS` (shared.js). See item
  3 below for what was seen.
- **The art pass** (owner's order, 2026-11-11): `src/data/looks.js` and `src/data/looks/` belong
  to the 'art' role until the coordinator ends the pass. Do not edit them; keep to shared code.
- **How to work here**: render only from a clean export of the head with only the files you
  changed laid over it. Scratch tools in `/home/user/.pc-scratch/painter/m10/` (may be gone):
  `mkexp.sh <name> [base]` (export plus your changed files), `strip.mjs <export> <prefix> <body>
  <biome|spawn> <t> <yaw|''> <frames> <dt> <k>` (the game at a stand, the clock driven, a frame
  every k steps), `arr.mjs` (an arrival filmed 2.8 s), `nep.mjs` (Neptune's stand at several
  yaws, with the haze numbers), `gait.mjs` (the figure posed by PHYSICS' stride in the gallery),
  `why.mjs <export>` (prints the console line if any module fell back to a stub), `sheet.py`,
  `js/prof.mjs` (the skyline from a stand: elevation, distance and height per azimuth). The
  lead's `tests/motion.mjs` and `tests/weather.mjs` with `--root --out --sheets` (always pass
  the last two or they write into the lead's evidence). The machine is shared and slow: the
  game is ready after 5 to 15 minutes, a frame of a strip 15 to 70 s.
- **Next, in this order** (the lead's hardening review, `docs/lead/HARDENING.md` "PAINTER (in
  order)", relayed by the coordinator): **A3** `uPhysBranchClock` is in `PHYS` at the head
  (`shared.js:135`, committed): confirmed in the file; the lens's own check (read it on
  `pc-prop-tall-broadleaf0` twice 10 s apart) was not run. **A2** prewarm hooks for PILOT's P3:
  `world.prewarm()` (await the kits import kept from `buildKits`, `makeDab` for every body,
  `st.flora._init()` for every body with flora, or compile its prop materials against a tiny
  InstancedMesh) and `painter.prewarm()` (draw `mAbs[4]`, `mAbs[8]`, `mSheet` and the prep and
  keep materials once into a 2x2 target); PILOT 8 writes the caller. **A1** log depth in the
  vertex shader when EXT_clip_control is missing (exact lines in HARDENING.md; `PC_FRAG_LOGDEPTH`
  only for water and near ground if they poke through; check the explorer at the shore and the
  ship on its pad). Optional: the reversed smoothstep edges (gap 17). **After the art pass**:
  both coast biomes must face open water (Neptune `storm_seas` faces a lagoon dry 120 to 170 m
  out with the storm wind from E/ENE; Earth `sea_coast` a pool under 50 m with the wind
  offshore): 2 km of fetch at about 20 m deep toward the storm wind; tell the coordinator if
  it needs the sites (look data) changed. Then the unfinished block 7 bits: torn white crests
  on the near sea, the near headland's vertical end, the blizzard's ruled crest, the gallery
  run re-filmed after the heel change, item 4 of the block (the brush, two walled vistas,
  Mercury from orbit, Mars' dune crests, the explorer's face, PILOT's UI look review).
- **Rules that bit me**: (1) the coordinator's WIP snapshots sweep your working files into the
  head within minutes; commit under your own message as soon as tests pass. (2) A head can be
  broken in the browser while every Node test passes (a module cycle: the game silently ran on
  PILOT's stubs); `why.mjs` or `__pc.info().using` tells. (3) Before you fix a "glitter", find
  which term draws it: I changed three water terms before a zoomed crop showed the specks were
  the spray kit. (4) The gallery `cam=vista` stands on the easel 9 m up: use `cam=trees` for
  the figure.

## Handover of block 6 (eighth PAINTER agent; kept)

Written by the eighth PAINTER agent at the end of M3 block 6 (the last art block before the
lead's review 6). My commits: `5edf80c` (the worlds' ideas, the motion fixes, orbit, the timed
test) and the one after it (flowers, splash rings, rain, veils, orbit frames, these notes).
Block 5 and the earlier records follow; "Rules that bit me" of the earlier agents still hold.

- **Where things stand**: Venus, Saturn and Jupiter now say which world they are in the first
  view (frames `docs/shots/painter/idea-<world>.jpg`, before | after, all opened at full size).
  The lead's motion faults 1 (pop-in), 2 (flower disc), 3 (splash rings), 4 (crowns hiding the
  figure) and 5 (crouch) are in code; **none of them has been seen in motion** (no filmstrip
  was run: one frame costs minutes here). The ten bodies were opened from orbit before and
  after (`orbit-before.jpg`, `orbit-after.jpg`). The brush (item 4) and the short list (item
  5) were not started. See "M3 block 6" for every verdict and what is weak.
- **Where the new things are** (all in my files):
  `src/data/looks.js`: `spawn: [x, y, z, yaw, pitch, clearing r, berth bearing]` (a first
  landing chosen by eye; degrees; the berth is the compass bearing, 16 m off, of the level
  spot where PILOT's `spawnOn` will find the flattest ground for the ship: it is one of
  PILOT's ten directions, 55.6 - 36 i degrees); `skyBelts: [belts, wander, strength]`,
  `seaDeck: [top m, strength, heads]`, `limb` (how far the limb thins into haze from space;
  default by the depth of the air); on a riverbed `t.flow`, `t.lqD`, `t.ember`, `t.emberR`.
  `src/world/surface.js`: `getSpawn` takes `look.spawn` while it is dry and nearly level
  (else the old search), pushes a levelled place (`pads`, applied in `sample`) and a
  clearing; riverbed: swelling bed, ember and char washes, negative `aux` = cracks of fire
  (drawn in `materials.js` where `vPar.w < 0`); island patches only on the tops.
  `src/world/sky.js`: three blocks before the clouds: the ring arc (plane y = 0 of the body,
  `uRingS`, `uRingC`, profile shared with `orbit.js` `RING_PROFILE`), the belts (`uBelt`),
  the far cloud sea and its cumulus heads (`uSeaC`). `src/world/index.js` sets them per
  body, hides the ring's geometry below space01 0.55, carries the limb strength in
  `uFog.w`, returns yaw and pitch from `getSpawn`. `src/world/orbit.js`: ring profile and
  the planet's shadow on the ring, `uLimbCos` (cloud not drawn past the limb).
  `src/world/flora.js`: the wash clock (`washNow`, real time in steps of 0.02 to 0.1 s),
  `aBorn` per instance (when it came into its mesh; negative: when it left), a second fill
  of the chunk when the wash has dried (`washUntil`), `busy` counts a wash in progress,
  `_focus` (the explorer's figure in view space: `G.figure` is set by `models.js`).
  `src/render/materials.js` (flora shader): `vWash` and the two interlocking discards,
  `uFocus` window; lava; the near flower's lobed edge. `src/render/kitmat.js`: the splash
  ring is a glaze; rain 0.64 to 0.78; veil gain 1.5 to 2.6.
- **How to work here**: render from a clean export, two renders at a time, kill only your own
  processes by PID. Scratch tools in `/home/user/.pc-scratch/painter/m8/` (may be gone):
  `mkexp.sh <name>` (export of HEAD plus my working files), `v.mjs <export> <prefix> <body>
  spawn | "x,y,z,yaw,pitch,hour" ...` (the game at the top tier in third person at the true
  spawn or at places; prints PROBLEMS if the console had any), `orb.sh <export> <prefix>
  body...` (each body from orbit through the gallery), `lib.mjs` with `sv.mjs` (lava banks),
  `si2.mjs` (island rims: what the easel sees over the rim), `near.mjs`, `lv.mjs`.
  A frame took 3 to 6 minutes; the game was ready after 90 to 310 s.
- **Rules that bit me**: (1) these planets are tiny (R 3.6 to 5 km): from the top of a
  100 m island the cloud sea's horizon lies 12 degrees below eye level and the island's own
  rim hides everything below 6: **the sea cannot be seen from a level landing**, whatever
  the spot. That is why the far sea and its heads are painted into the sky. (2) Saturn's
  rings stand 49 to 69 degrees up at latitude 12 and 14 to 40 at latitude 30: the arc is in
  a third-person frame only between about 28 and 42 degrees of latitude, facing the equator.
  (3) A `python` edit that slices a function by two anchors removes what lies between: I cut
  the tangent frame out of `getSpawn` that way; the tests caught it. (4) The coordinator's
  WIP snapshot commits sweep working files: commit under your own message as soon as the
  tests pass. (5) to (13): the earlier agents' rules below still hold.
- **Next**: (1) see the motion fixes in the lead's `tests/motion.mjs` (fill, walk, low
  flight, jetpack among trees) and correct them: the wash-in pattern may be too coarse or
  too fine, the window round the figure too wide. (2) The build order after a landing (far
  and tall first) and the ground arriving in pieces: not touched. (3) Item 3's frames:
  leaves, sand skim and blown snow blowing; Neptune's far sea; PHYSICS' pale rectangle in
  Neptune's sky (yaw 236 from the `storm_seas` stand, 34 to 42 s): not looked for. (4) The
  brush at full resolution. (5) The short list (two vistas in a thicket, Mars' dune crests,
  branch sway and drifts, the explorer's face, the UI look review).

## M3 block 7: the picture holding in motion, and the weather (ninth and tenth PAINTER agents)

The ninth agent was stopped by a usage limit mid-block; its record is the message of `b022507`
("Block 7, part 1") and its unfinished files in the coordinator's backup `6b900e6`. The tenth
agent verified it on clean exports and finished it. Everything below was rendered from a clean
export (`tools/export-head.sh`) at the top tier (quality 2), 960 x 540, and **opened** unless
it says otherwise.

(Relayed for item 3, PHYSICS `1a7ed8c`: add `uPhysBranchClock` to `PHYS`; per-vertex `aBranchId`
(one number per branch with its foliage, -1 on the trunk) and `aLeaf01`; in the tree shader
`id = aBranchId < 0 ? -1 : fract(aBranchId + treeHash)`, `pb = pcPhysBend(root, 1.0)`,
`rel += pcPhysCrown(rel, up, H, root, pb, id, aLeaf01)`, then `pcPhysDisplace`; branches reach
0.27 H; mid and far tiers may skip it; reference `physics-lab.html?painted=1&crown=0,0`. Strip:
Earth spawn storm, clock 160 to 170 s, gust front 149 s.)

### Item 1: verifying block 7 part 1 (tenth agent)

- **Walk** (`node tests/motion.mjs --only walk`, clean export of `20b6bb5`; sheet
  `docs/shots/painter/motion-walk-after.jpg`, opened): mean change 3.10 % (3.60 before, lead's
  `motion-walk.jpg`), 19 pop blocks in 12 of 47 pairs (13 in 9 before), **every one with
  triangles +0**: no tree changed tier, appeared or doubled in the 48 frames. What the
  instrument calls pops are the near birch trunk sliding past the eye (its bark marks do not
  follow the block match) and a step puff at the boot. Verdict: **passes**; the near strokes
  did not re-lay over the 6.65 m walked.
- **Fill** (arrival 600 m east, 30 frames, `motion-fill-after.jpg`, opened): frame 0 is bare
  paper, frame 29 (1 s) the picture half up out of the paper, pale, everything at once, sky a
  touch ahead of the ground; **0 pops** (498 pop blocks in 29 of 29 pairs before); mean change
  1.0 % a frame, spread evenly over the sheet (no tile, no stipple). The instrument's second is
  shorter than the arrival; the whole of it is filmed below.
- **The whole arrival** (scratch `arr.mjs`: 14 frames 0.2 s apart; `motion-arrival-after.jpg`,
  opened): bare paper for 1.0 s while the land is laid (`busy` 8435 to 4), then the picture
  comes up out of the paper as one between 1.0 and 2.2 s, the canopy and sky a little before the
  ground; from 2.2 to 2.8 s the four frames are the same picture (busy 0): nothing arrives late,
  nothing pops. It reads as a wash laid over the whole sheet, soft, never a stipple. Verdict:
  **works as designed**. Weak: a second of blank paper is long if anything in real play ever
  leaps (nothing does: the game's start is under the loading sheet).
- **Weather set** (`node tests/weather.mjs --only earth-arrives,earth-storm,earth-blizzard,
  mars-dust,neptune-gale`, clean export of `20b6bb5`; frames in scratch `m10/wx0/out`, all
  opened): *earth-arrives*: the gust front's leaves read, forty or so lens-shaped marks in two
  tones (ochre-red and dark) tumbling over the meadow and against the sky: **pass**.
  *earth-storm*: rain as pale slanted strokes, leaves, splash rings as soft pale smudges on the
  grass (no wire): **pass**; no spray there (it is an inland spawn) and the walker's track
  cannot show in a frame of a figure standing still. *earth-blizzard*: flakes soft white
  specks, a few blown streaks; the near slope's crest is one ruled diagonal against the sky
  (terrain silhouette, smooth under fresh snow): **weak, not fixed**. *mars-dust*: the far is
  lost in dust and the sand skims run low on the left, **but the explorer at 5 m stood crisp**,
  not veiled at all: the far washes' fog comes in six stacked bands and gives nothing inside
  20 m (3 % at 5 m in visibility 85 m): **fixed**, see below. *neptune-gale* (clock 154, mist):
  the headland is a grey mass in the mist, the stacks dark; the pale flat-topped forms stand at
  the right horizon; white horses are scattered white specks rather than torn crests.
- **Neptune's coast in motion** (scratch `strip.mjs`: the game at the `storm_seas` stand, clock
  150 to 156 s, 12 frames 0.5 s apart; scratch `m10/ns0`, sheet and a crop of the shore
  opened): the swell's dark hollows move through the bay and out past 100 m (the long train
  carried far: **the sea heaves**); the waterline's lace swells up the shingle and draws back
  over the 5.5 s, torn anew in every frame (**the run-up works, the foam is alive**). But
  **there were no white horses**: what read as white horses were PHYSICS' spray drops drawn as
  4 px flecks, clusters of glitter over the bay; on the waves themselves nothing breaks between
  30 and 150 m (the near crests are dropped there as finer than the brush, the far strokes have
  not begun, and the far dabs waited on a whitecap cover of 2 % or more).
- **The pale forms in Neptune's sky, found** (scratch `nep.mjs` at the stand, yaw 236, clock
  40: a thunderstorm, rain 0.92, fog 0.76, storm 1; skyline traced from the stand with the
  terrain sampler, scratch `js/prof.mjs`): they are **the coast's headlands**: the near one
  55 m off (a 43 m cliff with a vertical end, which gives the ruled vertical edge) and a far
  one at 228 m, 50 m high, standing 10 degrees up. The far one's lower part is lost in the mist,
  and the mist was painted **near-white** (`uHaze` 0.90, 0.91, 0.94: fog lerps the haze 55 % to
  white) while above 2 degrees `pcHazeAt` takes it into the storm's dark mass: so a pale band
  with a hard top stood under the dark cloud, cut off by the near cliff's straight edge. The
  sky's own low band was never given the mist at all (the haze went white, the horizon did not),
  so far land stood paler than the sky behind it.

**What the tenth agent changed for item 1** (all in my files):
- *Mist in a storm* (`src/world/index.js`): the mist the far land is lost into is white only
  under a light sky; under a closed storm sky it is the storm's own grey (`_fogC`: the paper
  white lerped toward the storm wash lightened 48 %, by storm x overcast), and **the low sky
  takes the same mist** (`tmpKey.horizon` lerps with the haze), so the far land runs into the
  sky behind it. At the PHYSICS view (yaw 236, clock 40) `uHaze` went from 0.90 to 0.76: the
  pale slab is now a grey-blue misty distance under the cloud (before | after crop in
  `docs/shots/painter/weather-after.jpg`, top row Mars, bottom row Neptune, opened); from yaw 195 the far headland is a soft
  grey mass in the rain with the storm drags above it (opened). What stays: the near headland's
  end is a vertical cliff, so its silhouette is still a straight edge 40 m tall (terrain shape,
  not touched: it would move the coast under PHYSICS and PILOT).
- *The near air in a dust storm* (`G.uAirNear` in `shared.js`, both fog functions in
  `chunks.js` and `materials.js`, set in `index.js` from the dust weight: 0.85 x dustW at 7 m):
  the fog's six stacked bands left everything inside 20 m clear, so the explorer stood crisp in
  a storm that had swallowed the far dunes. Now the figure at 5 m is about half veiled, the
  ground at the feet a third (scratch `m10/md0`, opened). Six consecutive frames at 1/30 s:
  mean change 0.9 to 1.2 levels a frame, all of it the sand streamers travelling; **no dust
  near the lens flickers** (amplified difference opened).
- *The sea in a gale* (water shader in `materials.js`): the torn pattern of the foam, the
  crests and the surf is sized to the distance beyond 20 m in octaves that give way to one
  another and drawn out three to one along the crest, and it changes as it goes (`tornW`); the
  sun's glints go under a closed sky (`1 - 0.9 uWx.x`); in a sea running high (Hs 0.5 to 2 m)
  white horses are laid beyond 10 m whether or not the waves under them are drawn.
- *Spray* (`kitmat.js` `spume`, `index.js` draw table): a soft pale blot broken where the
  brush lifted (was a 4 px fleck), told from the rain's long grey strokes. Seen at 0.34 m and
  9 px (scratch `m10/ns5`, zoomed and opened): soft white touches of 4 to 6 output pixels in
  clusters over the bay, no longer hard specks, but still small; then set to 0.5 m, 14 px and a
  fainter wash so that a cluster runs together into a wisp: **that last step is not seen**.
- *Far white horses* (the far-sea strokes): a white horse's band is at least two pixels deep
  (`fwidth(q)`); seen across the water it was a tenth of a pixel tall.

**Verdicts, item 1** (blunt):
- Arrival and fill: **pass**. The land comes up as one over 1.2 s after a second of paper;
  nothing pops, nothing arrives late; soft, never a stipple.
- Walk: **pass**. No tier change, hole or doubling in 48 frames (every flagged block +0
  triangles); near strokes stay put. Weak: a step on the meadow raises a pale round puff at
  the boot (PHYSICS' dust puff in my `puff` mark) that appears in one frame.
- Neptune's sea: **heaves and runs up: pass**; the swash lace is alive. **White horses: weak.**
  The near and middle water still shows no torn white crests (the near crests need PHYSICS'
  whitecap cover and the wave detail the brush keeps; the gale term I added is gated by Hs
  and was not seen to fire at the stand, whose bay is sheltered); what reads as white on the
  bay is the spray.
- The pale forms in Neptune's sky: **found and fixed** (shared code, `index.js`): storm mist
  is grey and the low sky takes it. The straight vertical end of the near headland stays (a
  terrain form).
- Weather marks: leaves, rain, rings **pass**; dust storm now veils the figure **(fixed)**, no
  flicker near the lens **(pass)**; spray softened **(partly seen)**; the walker's track not
  seen (no walk was filmed in the weather); blizzard's ruled crest **weak, not touched**.

### Item 2: the explorer steps (PHYSICS' gait)

`src/art/models.js` `animate`: when `feet` (PHYSICS' `[left, right] { fwd, up, side, down }`) is
passed, each leg is a two-bone chain (thigh 0.41 m, shin and boot 0.48 m) reaching for its
boot: `fwd - surge` ahead of the hips, the hips at `L1 + L2 + ride` (`ride` = hip plus the
stride's bob), the thigh angle taken against the back's lean; the swinging leg's heel is drawn up
by PHYSICS' clearance times 1.4 to 2.7 (to about the other knee at a run, 0.30 m at most), so a
run's flight reads in the knee; the torso rides at `ride` and moves by `surge`; the arms and
the torso's twist follow `stride` (no cycle on the figure's own clock). Standing (both boots
under the hips) the weight still settles on one leg. `crouch01` (the 0.12 s before a jump):
the back leans in and the arms go back. Without `feet` the old cycle runs as before. PILOT's
`figureArgs` (src/player/figure.js) passes exactly these.
- *Gallery* (`gait=<m/s>`, `stride=`, `grav=`; `window.__pcGait` for a tool): the figure posed
  by PHYSICS' own stride (gaitOf; the feet and the bob as stepGait lays them). Strip of six
  poses of a run at 4.2 m/s and six of a walk at 1.5 m/s, side on
  (`docs/shots/painter/gait-gallery-before-heel.jpg`, opened): **the walk reads** (legs
  scissor, the trailing heel lifts, knees soft); **the run read as running but knelt in the
  air** (the heel drawn up to hip height): heel lift reduced (0.42 m and x4.4 to 0.30 m and
  x2.7) and not re-filmed in the gallery.
- *In the game* (PILOT's wiring in the head; `node tests/motion.mjs --only walk` on a clean
  export of `194171b`, W held, 4.2 m/s, a run by its gait; the lower body cropped from twelve
  consecutive frames: `docs/shots/painter/gait-game-run.jpg`, opened): seen from behind, the
  boots alternate, a heel kicks up behind at each step, the legs cross under the coat about
  every ten frames (three steps a second at 30 frames a second), the arms swing against the
  legs: **the explorer steps, on the game's clock**. Whether a planted boot slides against the
  ground could not be judged from behind at this size. The walk's pops: 17 blocks (19 before),
  none from the figure. Not filmed: a walk under 2 m/s in the game, a jump's crouch, the Moon's
  bound.

### Item 3: branches that move (PHYSICS' crown)

Wired as PHYSICS asked (relayed with `1a7ed8c`): `uPhysBranchClock` in `PHYS`; the kit builder
lays `aBranchId` and `aLeaf01` on every vertex (`florakit.js`: a trunk, a tube with `swayH` >
1.5, is -1; any other tube or blob takes its own number from its hash; a birch's three branches
take 0.13 + 0.618 k and every foliage mass within 2.2 m of a branch's tip takes that branch's
number, the others are branches of their own hidden in the wash; a pine's six tiers each their
own); `flora.js` shares the two attributes with the instanced meshes; the tree shader
(`PC_PHYS_BRANCH`, broadleaf, conifer, fungus, kelp; near and mid tiers, not the far form)
takes `pb = pcPhysBend(root, stiff)` and adds `pcPhysCrown(rel, up, H, root, pb, id, aLeaf01)`
before `pcPhysDisplace`, `id = fract(aBranchId + 7.31 seed)` so no two trees move alike.
- *Seen* (scratch `strip.mjs` at the Earth spawn, clock 165 s, the storm, 10 frames 1/15 s
  apart; one crown against the sky zoomed over 0.6 s: `docs/shots/painter/crown-storm-after.jpg`,
  opened; an amplified difference over 0.27 s, opened): the holes of sky between the masses of
  foliage open, close and change shape from frame to frame, the masses shift against one
  another while the white trunks stand: **the crowns move in pieces, not as one**. No console
  error. Not seen side by side with the crown as it was (the lobes of `pcPhysBranch`), and not
  in the gust front (149 s) or in a breeze; the far form does not move (by PHYSICS' leave).

### Needs (block 7, tenth agent)

- *PHYSICS*: (1) at Neptune's `storm_seas` stand in the gale (clock 150), what are Hs and the
  whitecap cover (`uPhysWaterSea.x`, `.w`) over the bay? My white horses wait on Hs 0.5 to 2 m
  and did not show there. (2) Should a step on a meadow raise a dust puff? It shows as a pale
  round puff at the boot that appears in one frame. (3) Export `bobAt` (or a pose helper
  `gaitPose(v, g, stride)`): the gallery copies its formula to pose the figure.
- *PILOT*: none.
- *For the art pass* (look data, not mine to change during the pass): none of my findings came
  from a body's look data; Neptune's `storm_seas` `t.cliff` (46 m) sets the height of the
  vertical cliff ends that make the ruled edges (the form itself is shared code in
  `surface.js`).

## M3 block 6: each world's idea in its first view, motion faults, orbit (eighth PAINTER agent)

INTEGRATION: see the last lines of this section for what was run on a clean export.
Every frame named here was rendered from a clean export of the head with my working files laid
over it, at the top tier, 960x540 unless said, in the game in third person. "Opened" means with
my own eyes; I say for each how.

### 1. The worlds' ideas (the coordinator's brief: Venus, Saturn, Jupiter)

| world | what the brief promises | frame (before, after) | what is in the first view now | blunt verdict |
|---|---|---|---|---|
| Venus | lava rivers through basalt, fungal tower forests in amber cloud | `idea-venus.jpg` (both halves opened at full size; the after is the stored render of the true spawn) | a grove of the old fungal towers left (pale ringed stalks, amber caps), a basalt spire, the lava river behind the ship running into the haze, towers ghosting in the sulphur haze right, dark basalt underfoot warmed toward the bank | It says Venus in one look, which it did not. Weak: the lava is a band, not a river filling the middle distance (the ship stands in front of part of it); the foreground is one brown mass with a bland pale boulder; the cracks of fire in the cooled levee cannot be told apart from the ember wash at this size |
| Saturn | ring arcs across the sky, pale gold islands, honey mist | `idea-saturn.jpg` (both opened at full size; the after is the stored render, sky colour of the commit; the last small change to the inner ring's glaze was not rendered again) | the rings as a great pale arc from the left horizon to the upper right, white cloud in front of it, gold meadow with teal crystal reeds, gold trees, the ship left, a far island and white cloud heads on the horizon | From the palest and emptiest to a place with its sign in the sky. Weak: the wash under the arc is a brownish band (the dusky inner ring over a violet sky: muddy); the arc is soft, its division a faint line; no sea of cloud below (it cannot be seen from a level landing, see the handover) |
| Jupiter | sky-islands in banded cream and orange cloud seas | `idea-jupiter.jpg` (both opened at full size; the after is the stored render) | the belts of the sky, cream and orange, running down to a vanishing point between islands that stand on three sides with strata cliffs; a bank of white cloud in the gap; the ship right; poppies | The sky alone now says Jupiter. Weak: the islands read as the walls of a valley, not as tables standing in cloud (the cliffs' feet meet the meadow's edge: no sea below them in view); the cliffs are olive grey (the biome's middle pigment is sap green); the belts are flat slabs with little inner life |

How: (a) a first landing chosen by eye is data (`looks.js` `spawn`), found with scratch searches
(`sv.mjs`: a dry level bank with lava running away along the view; `si2.mjs`: an island spot
whose easel sees other islands over its rim), then looked at. The ground within 14 m is drawn
to the spot's height and eased back by 23.8 m (`pads`), with a second level spot 16 m off where
PILOT's ship search looks, so the ship stands 28 to 32 degrees to the side of the view.
(b) Venus: the lava bed swells and narrows (`flow`), stands brim-full (`lqD` 1.5), is scarlet
by the banks and paper-yellow only where deep, keeps its fire through the haze (fog on lava
cut by 0.6); banks get an ember wash to 26 m and a charred levee; a fourth tall kit (full-grown
towers, scale 1.45, obstacle radius 1.0 m, height 20 m) lines the lava with the spires.
(c) Saturn: sky zenith [0.76, 0.70, 0.78] (was [0.90, 0.84, 0.60]); the arc is cut per view
ray in the sky's wash, under the clouds, with the ring's own profile (thin inner ring, broad
pale ring, division, outer ring with a hair-line gap) and the planet's shadow across its far
side; it hands over to the ring's geometry between space01 0.55 and 0.9. (d) Jupiter:
`skyBelts` [20, 0.016, 0.85]: the cloud shell's parallels seen from inside; `seaDeck`: beyond
the island's rim a deck of cloud at 106 m (Saturn 84 m) out to its own horizon with heads of
cumulus standing 1 to 6 degrees above it; from a bench below the deck the heads stand as a
bank between the islands.

**Spawns moved** (PILOT's landing and tour tests stand there): Venus from the first site's
plain to the lava bank at [0.441599, 0.870687, 0.216551] (same biome, lava 18 to 34 m off to
the north and east, towers and spires beyond the 15 m clearing); Saturn from latitude 12 to
latitude -31 on another gold island at [-0.847849, -0.520723, 0.099999]; Jupiter stays on the
first island, on a bench at [0.124426, 0.328288, 0.936347] (61 m above the cloud, 290 m from
the nearest other island). All three pass "every planet has a level, dry arrival place with
room for the ship". `world.getSpawn` now returns `yaw` and `pitch` for them (additive; PILOT's
`spawnOn` already reads them).

Numbers (the game at the spawn, 960x540, this machine): Venus 769 k triangles, 303 draw
calls; Saturn 781 k, 279; Jupiter 594 k, 302; Earth 1.44 M, 465. No console error in any.

### 2. The lead's motion faults (relayed during the block; none seen in motion)

1. **Things appear in one frame**: every tree carries the time it came into its mesh; for
   0.55 s its strokes are kept only where a noise fixed in the tree is below the wash's
   progress, so it fills in as broken strokes. A tree that changes tier stays in its old
   mesh for the same 0.55 s with the complementary rule, so the two interlock and the sum is
   one tree. A cell of undergrowth washes in as a whole when it is built. `world.busy` stays
   above 0 while a wash is being laid (a frame taken at busy 0 shows nothing half arrived).
   **Not done**: the build order (far and tall first after a landing), the ground arriving
   in pieces, the near ground's strokes growing in. **Not seen**: any of it moving; the Earth
   spawn's still (`h-earth-1.jpg` in scratch, opened at full size) shows whole trees.
2. Near flowers: the round touch has a lobed outline (three sines of the angle, seeded per
   touch) and dry flecks toward the edge. Not seen close to the lens.
3. Splash rings: a glaze of paper colour at up to 0.58, soft across the ring, broken by a
   noise fixed in the ring; no longer an opaque white region-6 mark. Not seen.
4. Crowns hiding the figure: **the fade** (not obstacles). Strokes of trees and undergrowth
   nearer than the figure part within 0.8 to 2.0 m of the line of sight to it (ragged, by a
   noise fixed in the plant). The figure is found by itself (`models.js` registers it), so
   PILOT changes nothing; it is off while the figure is hidden. Not seen.
5. The explorer reads `hip`: the knees fold by acos(1 - hip/0.86), the back leans in, the
   arms spread a little; eased at 22/s. **Not done**: knees bending before a jump (there is
   no signal before take-off; if PHYSICS sends `hip` then, it shows by itself). `clamber01`
   and `grounded` are not read. Not seen.

### 3. The worlds from orbit

`orbit-before.jpg` (all ten, 480x360 each on one sheet, opened on the sheet) and
`orbit-after.jpg` (Mercury, Earth, Saturn, Neptune, Mars after the changes, opened on the
sheet). Found: Mercury a grey ball with a pale rim (glass); Earth's scattered cloud stood out
past the limb as a ragged hard fringe; Saturn's broad ring was paper white; Neptune had a
bright rim. Changed: the limb thins into haze in proportion to the depth of the air (Mercury
0.26, Moon 0, Pluto 0.17, Neptune 0.3 by its look); scattered cloud thins toward the limb and
is not drawn beyond it; the ring is gold with its division and lies in the planet's shadow on
the far side. After: Earth has one outline, Neptune is a banded blue ball without the rim,
Saturn reads as Saturn. **Still weak**: Mercury is still grey and dull (its grounds average to
grey from afar; it wants ochre and obsidian in broad shapes); no body shows a dark side in
these views (the gallery's orbit camera has the sun behind it); the discs have a crisp edge.
The eight stale `<world>-orbit.jpg` frames are removed.

### 4. Weather leftovers and PHYSICS' findings

Changed without a frame: dust veil gain 1.5 to 2.6 (cap 0.86); rain stroke 0.64 to 0.78.
Seen: `wx-mars-dust.jpg` (the lead's `tests/weather.mjs --only mars-dust` on a clean export, 960x540,
opened at two thirds size beside another frame; it replaces the stale frame of that name): dust 0.87,
the veils are pale level drags across the dunes of the middle distance and the horizon is lost in
them, no blots; **the explorer is still not half veiled** (no veil stands between the lens and the
figure in that frame). I did not open the stored frame of the same moment before the change, so
"more than before" rests on the gain alone. A gallery frame of the thunderstorm at the stream
(scratch, 640x360, opened) compiled the rain and the ring glaze with no console error; the rain
in it is still faint and no ring could be told at that size.
Not done: leaves, sand skim and blown snow were not seen blowing; Neptune's far sea, the pale
rectangle in its sky, the sea's heave and the frozen foam rim were not looked at; the track
through grass round a walker (denser, shorter strokes at the feet) was not started.

### 5. Small and required

"sampleSurface stays cheap on every body" takes the best of ten batches of 1500 calls, reports
the number for every body as a test diagnostic on every run, and asserts the 50 us limit only
when `PC_TIMING=1`. Alone here: 8 to 26 us.

### Not started

The brush at full resolution (item 4); the short list (item 5).

INTEGRATION: ready. On a clean export of the head with these files: `node --test
src/world/*.test.mjs` 19 pass, `node --test tests/*.test.mjs` 116 pass; the game loads and
stands at the Earth spawn, on foot, with no console error (640x360, the top tier, opened), and at
the Venus, Saturn and Jupiter spawns likewise (960x540).

Needs from PILOT: (1) run the landing, tour and motion sets once on the three moved spawns
(Venus, Saturn, Jupiter); the ship's berth is 16 m off on one of `spawnOn`'s ten bearings: if
those constants change, the ship simply stands elsewhere on the level place. (2) If `settle`
or the title's readiness must not wait for a wash-in, say so: `world.busy` now stays above 0
for about 0.65 s of the wash clock after the last tree or cell arrived. (3) `G.figure` is the
explorer made by `createExplorer`: if a second explorer is ever made, the last one made is the
one foliage parts for.
Needs from PHYSICS: a `hip` dip before take-off if the knees are to bend before a jump.

## M3 block 5: the push on the other worlds, the weather ruling (seventh PAINTER agent)

All frames are the game at the top tier (quality 2), third person at the spawn, 960x540,
on a clean export with my working files laid over it. "Opened" means with my own eyes.

**0. A fault found on the way.** Since block 4 the cloud shell (`pc-cloudshell`, every banded
world seen from outside, and the far worlds' decks) did not compile: the body uniform
`uStorm` (a float) collided with the shell's own `uStorm` (a vec4, the Great Red Spot). The
console of the Mercury spawn showed it. Renamed the shell's to `uSpot`; the Mercury frame
after it has no console error. Not seen in a frame from orbit.

**1. The seven worlds.** What each spawn is, what was raised, the frame, the verdict.
Common to all: the ground is no longer one wash (patches of a second and third wash at a few
metres and at tens of metres); what lies on it lies in drifts (crust, stones, splinters) with
bare ground between; tall growth is of all ages; spires and boulders are finely cut.
- **Venus** (spawn: lava plain, not the fungal forest). Before: a grey-olive plain sown
  evenly with pebbles, six cones on the horizon. After: dark flows, sulphur and ember patches,
  boulders in drifts, spires from 2 m to 14 m. `push-venus.jpg` (both opened, before at full
  size, after on a sheet of four). Verdict: the better painting and calmer; still no lava in
  the first view (the spawn keeps 13 m from liquid and the river is far), and the small dark
  dashes are still a little evenly sown. The fungal forest has new looks (young fungi as
  flowers with caps, litter, mould crust, towers of all ages): NOT opened.
- **Mercury** (spawn: obsidian field). Before: the easel a metre behind a wall of grey
  blades, neither explorer nor ship in sight. After: a clearing, a field of blades of all
  sizes to the horizon, plates of glass and ash drifts. `push-mercury.jpg` (both opened).
  Verdict: from a wall to a place; still busy (many small pale splinters, blue-violet
  boulders that are too saturated).
- **Jupiter** (spawn: sky-island top). Before: an ochre plain with sparse green flicks.
  After: a green meadow with bare ochre patches, shrubs, boulders, trees of all ages.
  `push-jupiter.jpg` (before opened at full size; the stored after is the last round, NOT
  opened; I opened the first round's, which differs by the gathered stones and the tufts). Verdict:
  the largest gain of the seven, a landscape now; nothing in the first view says "island in a
  sea of cloud" (the edge is 200 m away), and the flower drifts did not show in the frame.
- **Saturn** (spawn: gold island top). Before: a pale gold blank with flicks. After: olive
  and honey patches, violet flowers, mint crystal shards, shrubs, trees of all ages.
  `push-saturn.jpg` (both opened, the after on a sheet of four). Verdict: better, still
  the palest and emptiest of the seven; the ring arcs are not in the first view's sky; the
  shrubs, a heap of earth in the first round, are a low olive mound now.
- **Uranus** (spawn: ice shelf). Before: already the best of the seven (mint ice, cracks,
  teardrop spires in haze). After: frost drifts and deep aqua patches, spires of all sizes in
  three bands. `push-uranus.jpg` (before opened on a sheet; the stored after is the last round, NOT opened;
  I opened the first round's).
  Verdict: richer and still calm; the terrace itself is not in view.
- **Neptune** (spawn: kelp forest). Before: the easel inside a kelp clump, flat violet straps
  across the whole sheet, the explorer hidden. After: a clearing; kelp in tussocks of all
  sizes at four depths, a moss floor with drifts of yellow stars. `push-neptune.jpg` (both
  opened). Verdict: a painting now; a frond is still a flat strap of one tone.
- **Pluto** (spawn: lilac mountains). Before: pale ground, blobby boulders, a far ridge under
  an indigo sky (a good composition, thin near ground). After: frost and rose patches, more
  stones, penitent spires in companies on the slopes. `push-pluto.jpg` (both opened on
  sheets). Verdict: richer, a boulder field under the ridge; the shards are fewer but still
  read violet-blue in their shadows, the right of the sheet is busy with stones, and the far
  penitents are a stipple on the hill.
Weaker biomes than the spawn, by the code and not by a frame: none was opened this block.

**2. Numbers** (information, not a limit; software rendering, load 13 to 17, 960x540).
Time to "click to begin", frames, `world.update` summed, triangles / draw calls, before -> after:
Venus 73 s / 43 / 2.5 s / 448 k / 230 -> 141 s / 41 / 3.4 s / 830 k / 242;
Mercury 97 s / 48 / 1.7 s / 678 k / 506 -> 178 s / 48 / 4.7 s / 985 k / 498;
Neptune 118 s / 49 / 2.3 s / 599 k / 268 -> 200 s / 41 / 4.0 s / 1.02 M / 291;
Pluto 133 s / 47 / 3.1 s / 668 k / 296 -> 246 s / 57 / 4.5 s / 1.63 M / 487;
Jupiter 180 s / 50 / 3.7 s / 728 k / 318 -> 283 s / 58 / 4.5 s / 1.01 M / 354;
Saturn 179 s / 46 / 4.7 s / 696 k / 320 -> 213 s / 48 / 3.8 s / 1.07 M / 376;
Uranus 115 s / 48 / 2.3 s / 515 k / 224 -> 137 s / 51 / 3.3 s / 779 k / 238.
Earth spawn on the clean export of the head, 960x540, with two other jobs of mine running:
404 s / 54 frames / 4.4 s / 1.44 M / 465 (block 4: 3.35 s of building, 1.36 M): the single
strokes to 23 m cost about a second of building.
The world is settled (`world.busy` 0) by the time the title is ready in every run. The frame
counts hardly move: the longer wall time is each software frame drawing more.
`node --test src/world/*.test.mjs`: 19 pass (the slice test among them) after every change
in the working tree. On the clean export of the head: 19 pass in two runs of four; twice
"sampleSurface stays cheap on every body" failed (57 us a call on Uranus against a limit of
50) while two renders ran beside it: it is a wall-clock test; measured alone a call costs 6 to
13 us on every body (Pluto 5.6 -> 10.0 with its patches, the others unchanged).
`node --test tests/*.test.mjs` on the same export: 115 pass. The game loads on it and stands
at the Earth spawn with no console error (`push-earth-spawn-b5.jpg`, opened at full size).

**3. The weather ruling** (coordinator, this block). In code: (1) the dust glaze reads
PHYSICS' veil fields: a streamer is one level drag, densest above its foot, thinning to its
top and ends, broken where the brush ran dry, lifted toward paper; a puff stays round and
soft; (2) leaves are a glaze (a lens), so a thin leaf is not brushed away; (3) blown sand is
paler and heavier; blown snow comes through the dust kit with the snow's ink and is lifted
the same way; (4) `D.snow` was already spread; (5) the far sea: the gate was not the fault,
the gale's murk swallowed the strokes; the fog on the sea is cut by up to 0.45 where the far
strokes are laid, the strokes begin nearer and are stronger. (6) noted: Mars' dark dashes are my ripple strokes.
SEEN in the game with the lead's `tests/weather.mjs` at the top tier on a clean export:
`mars-dust` with the first version of the veil (opened at full size, not stored): a hazy
dune with a few pale drags of sand and NO veil to be seen: a veil in the dust's own middle
tone is lost against the haze behind it. Since then the veil is lifted toward paper after the
air is laid over it (commit `3af362b`); `push-mars-dust.jpg` is that
version in the game (opened on a sheet of two): pale level drags at two or three depths over
the far dune and across the middle ground, soft, no blot, no console error; fainter than
PHYSICS' stand-in (`docs/shots/physics/painted-proposal.jpg`, top left, opened once) and the
explorer is not half veiled: the opacity gain (`vPcData.y * 1.5` in `SHAPES.veil`) can go up.
`neptune-gale` under PHYSICS' own sky (`push-neptune-gale.jpg`, opened on a sheet): the sea
is a deep ultramarine body to a horizon under slate murk, the stacks and the cliff pale
ghosts in it, foam on the shore, two white horses: a storm sea now and not a blank; the far
swell strokes are still faint and the white horses few. The blizzard: left as it is (the
coordinator saw it work). Leaves, blown snow: in code, the leaf glaze compiled (forced to
draw at the Earth spawn, no error), not seen blowing. `earth-arrives` (the far world as an
orange dot before the storm cloud): `push-earth-arrives.jpg` (the game, PHYSICS' own front,
opened on a sheet of two): a slate bank, slanted rain, the wood in the cloud's shadow, and
no dot in front of the cloud. Passes in this frame; where the far world stood at that moment
I did not check, so it is one frame's evidence.

**4. Earth.** The "V" pairs (a tuft's flicks now lean about one direction; only the first two
or a third of the dark ones are crisp) and the change of hand at 17 m (single strokes to
23 m, fan touches from 6 m): `push-earth-spawn-b5.jpg` (960x540, opened at full size): the
meadow runs to the wood without a seam I can find and the tufts read as tufts; a few dark
flicks still stand in pairs at the sheet's foot. Not compared side by side with block 4's
frame at the same size. The brush: not touched.

Frames removed because they no longer show the truth: `push-dust.jpg` (the gallery's forced
dust under the old glaze; see `push-mars-dust.jpg`) and `push-neptune-swell-forced.jpg` (the
swell with its gate forced; see `push-neptune-gale.jpg`). Block 4's text below still names them.

**Contract changes (additive)**: looks: `t.patch`, `near.crust / gm / flowerSize`,
`under.crust / stalk`, tall spec `vary`; Pluto has tall growth now, so `sampleObstacles`
returns spires there (true radius and height by scale: 1.4 m x 13 m at scale 1, most are a
third of that); more boulders on Venus, Mercury, Pluto and Uranus (the same rule: scale
0.7 and up are obstacles, 0.62 x 0.58 of the scale). A non-forest spawn with tall growth has
a clearing of 15 m. Fallen blocks at a spire's foot are inside its own outline and are not
separate obstacles. Nothing else added to `sampleObstacles`.

**Needs.** From PILOT: nothing new; the top-tier settle time-outs as before. From PHYSICS:
nothing new; the veil fields are read as handed over.

**Weak / not done**: one round only on each world and three of the seven last frames not
re-opened; no signature biome off the spawn opened; item 2's frames as listed; the Earth
changes unseen; the brush, the vistas in a thicket, Mercury and Neptune from orbit, Mars'
crests, branch sway and drifts, the explorer's face, the UI look review: not started.

## M3 block 4: the quality push (sixth PAINTER agent)

All frames below are at the top tier (quality 2). "Opened at full size" means with my own
eyes at the stored resolution. Stored frames are in `docs/shots/painter/push-*.jpg`.

**1. The Earth forest.**
- The ground. Was: one ring of flicks, 0.66 m cells to 11 m, at most 6400 strokes, 13 k
  triangles in the spawn frame, a flat wash beyond. Now three rings to 240 m, about 77 k marks
  in the spawn frame (228 k triangles, 3 draw calls): tufts, flowers in drifts (poppy, ox-eye,
  buttercup, harebell: a drift is of one kind), taller grass gone to seed where it is rough,
  fallen leaves and twigs under the trees, stones and moss by the brook, fern fronds and
  dashes of fallen leaves under the wood, broad soft touches far out. Frames:
  `push-spawn-before.jpg` / `push-spawn-after.jpg` (1280x720, the game, both opened at full
  size; the after frame is one commit before the last, which changed only the far sea, dune
  ripples and snow). Verdict: the after frame is the better painting, and it is a meadow now;
  the near flicks still pair into small "V"s here and there, and the fine ring ends in a
  visible change of handwriting at about 17 m.
- The trees. Full trees to 90 m (52), the middle tier to 190 m (128), far tiers to 420 and
  600 m (300, 470), undergrowth to 110 m (60), about twice the bushes in the wood. No
  saplings (they would be obstacles). Frames: `push-vista-before.jpg` / `push-vista-after.jpg`
  (the lead's `earth-temperate_forest-1`, 1280x720, both opened at full size; same caveat).
  Verdict: better: the far bank has a floor, the trunks stand in undergrowth, the distance
  has one more band; the pale band of mist at the trunks' feet is unchanged.
- The far distance: only the forest's air (visibility 185 m to 231 m) and the longer tiers.
  On a world of 4 km radius the ground hides a tree beyond about 480 m; I did not add painted
  bands beyond that.
- The near terrain: looked at the bank at three times size in the vista: no facets, the
  brook edge is a drawn sienna line. Left as it was (`SPLIT_BY_QUALITY` 1.25).
- The brush: not touched.
- Numbers (plain information; software rendering, a shared machine): the spawn 733 k
  triangles / 360 calls before, 1.36 M / 465 after; the vista 0.74 M / about 365 before,
  1.40 M / 489 after. Time to "click to begin", both builds run side by side at 480x270:
  87 s before, 153 s after, in the same 50 frames; `world.update` summed over the load 3.05 s
  before, 3.35 s after (10 % more building; the rest is each software frame taking longer to
  draw). At 1280x720 the load took 262 s before and 309 s after on different machine loads.
  The vista after a teleport: 78 s before, about 416 s after (46 frames against 37, each far
  slower under a load of 15): the lead's tools may time out waiting for it here.
  `world.update` worst frame as measured here (slices grow with slow frames, so not the 5 ms
  figure): standing 394 / 212 ms, running 165 / 104 ms before / after.
  `src/world/busy.test.mjs` (one arriving frame at 60 frames a second, priced in surface
  samples) passes: the heaviest frame fits 5.5 ms.

**2. The other bodies.** Moon: `push-moon.jpg` (before above, after below; the after frame
opened at full size, at the code before the last commit): stones of unequal size to the
horizon and boulders farther out, where there was bare dust; 289 k / 146 before, 429 k / 211
after. Verdict: richer; the small stones are still a little evenly sown. Mars:
`push-mars.jpg` (opened as that sheet only): dry tufts and fans across the ground and more
far growth, 423 k / 271 to 715 k / 350; better, busier. Venus, Mercury, the giants, Pluto:
not opened.

**3. PHYSICS' critique.** Storm: `push-storm.jpg` (gallery, forced storm sky, 960x540,
opened at full size): the wood stands in the cloud's shadow, no sunlit green, no cast
shadows; passes. Under PHYSICS' own gust front (storm rising before overcast) the same code
applies (`sunless = max(overcast, 1.5 storm)`), not seen. Blizzard: the snowfield is in the
cool glaze and the air a blue-grey veil where snow falls, so flakes have a ground; the frame
I opened had no flakes in it (the gallery's forced sky does not make PHYSICS snow), so this
is not verified; the green tufts left on snow are dead stalks now (not re-rendered). Dust:
puffs, ash and sand are glazes with soft edges; `push-dust.jpg` (gallery, forced dust sky,
opened at full size) shows a soft veil and no blot, but I cannot say PHYSICS' wall was in
that frame. Neptune: swell strokes and white horses on the far sea, spaced by pixel
footprint; seen only with the gate forced on (`push-neptune-swell-forced.jpg`, lower half);
at the time I could reach in the gallery the sea was too slight to open the gate.

**4. Far worlds.** The ball now thins away over the world itself between 8 and 12 px
(a fixed stipple the brush softens), and a world behind cloud is veiled as overcast or storm
rises from 0.06 to 0.6 and lost into the storm's own wash; only then is it left out. In
code; no frame.

**Contract changes (additive)**: reads `mood.pulse01` when PILOT gives it (the ship model's
mode is the fallback); body uniform `uStorm`; `MOTION.given`; looks `under.flowers`,
`under.litter`, biome `near: { flower, fern, litter }`. `world._near.mesh` is a group of
three meshes now. Nothing added to `sampleObstacles`.

**For PILOT's README: what each quality tier draws.**
- Tier 2 (best, where the game starts): full internal resolution; trees in full detail to
  90 m and as simpler trees to 600 m; undergrowth to 110 m; the sward in three rings (single
  strokes, flowers, fallen leaves to 17 m; fan-brush clumps and ferns to 66 m; broad soft
  touches to 240 m); the finest terrain; pencil underdrawing.
- Tier 1: 0.8 of the resolution; full trees to about 54 m, simpler trees to 360 m;
  undergrowth to 66 m; the sward's two nearer rings (to 12 m and 40 m); coarser terrain.
- Tier 0: 0.62 of the resolution; no full-detail trees, simpler ones to 170 m; half the
  undergrowth; one ring of strokes to 11 m at half density; a simpler brush (four sectors),
  no pencil line.

**Needs.** From PILOT: `mood.pulse01` is read as soon as it is passed in `setMood`; the
tour's settle time-out wants raising for the top tier in software rendering (the forest
vista needed about 46 frames of 5 to 9 s). From PHYSICS: a painted frame of the far sea in
its hurricane and of the dust wall with the new glazes (their lab renders my kit materials),
and of a blizzard with flakes over the shadowed snowfield.

**Weak**: everything under "not verified" above; the settle time in software rendering;
no saplings; the brush untouched; items 5 of the block not started.

## M3 block 3: the MUST items, day-night, space, pulse, flicks (fifth PAINTER agent)

INTEGRATION: ready (`626b086`; the game on a clean export loads and plays on foot, in orbit,
in deep space and in the pulse drive with no console error; 19 world tests and the project's 109 tests pass on a clean export of `895a178`).

### The two MUST items
- **Cost, at the lead's instrument** (`tests/cost.mjs`, clean export, the game, fair weather):
  vista `earth-temperate_forest-1` **537 k / 305 at quality 1** (was 614 k / 341; budget 600 k /
  350) and **240 k / 180 at quality 0** (was 315 k in my run, 304 to 306 k in the lead's; budget
  300 k). The thunderstorm at the Earth spawn: **524 k / 286** (the lead's 606 k / 315; the same
  storm with the sun put at 21 h: 523 k / 287).
  What it was: not trees. Every far world in the view frustum was submitted in full (14 k
  triangles of terrain and 6 draw calls each, plus water and a cloud shell: up to 25 k and
  13 calls a world), seen or not. At the vista four of them stood in the view (Mercury, Venus,
  Uranus, Pluto: 72 k triangles, 36 calls, for one dot of ten pixels and three of under one
  pixel); "the storm after dark" was Neptune behind the cloud. Now a far world that cannot be
  seen is not drawn (wholly under the horizon, behind a closed sky, or under 1.3 px of radius),
  one under about 9 px is a dab (a washed ball, 320 triangles, one call; hysteresis 8 to 10 px)
  and by day it is veiled by the sky it is seen through. Nothing was trimmed from the flora:
  `TRIM` and `MAXS` are as they were.
  `world.update` in the storm frame, software rendering under load: mean 1.2 to 1.7, ninetieth percentile 3.1 to 4.8, worst 7.6 to 8.9 (50 frames at 13 h and 50 at 21 h; the same script on `62d061a` gave 1.1 to 1.7, 4.3 to 6.1 and 8.7 to 9.2: no change from this block; the worst frame is over 5 ms here as it was, on a machine at a load of 15) ms.
- **Pepper**: (a) saturated middle washes (Neptune's sky) and everything under the night's
  glaze now settle soft instead of in pits (`pepper-neptune.jpg`, before | after: opened both
  at full size; the after's sky enlarged three times before, not after); (b) the border of a
  dark wash is ragged in broad pieces with a pooled rim and a few flecks of paper, no pale rim
  with dark dots in it (`night-storm.jpg`; `space-deep.jpg`). The lead closed the washes
  himself on `0de3fb4`; the border he saw there is the old one.

### What is in, the frame that shows it, my verdict
Frames in `docs/shots/painter/`, 960x540 each, quality 1. Pairs are before | after.
Opened at full size, each half as its own frame: `pepper-neptune`, `night-earth` (the after
one commit earlier, and the last render on a two-frame sheet at full width), `space-orbit`,
`flash`, `flicks-lawn`, `night-storm`; `space-deep`, `space-pulse`; `daynight-mars` and
`daynight-uranus` as stored (two frames stacked); `night-mars`, `night-uranus` on two-frame
sheets at full width; `wx-neptune-gale` and the lower half of `near-saturn`'s after on one
sheet. **Not opened in the stored render**: `daynight-earth` (the same two frames one commit
earlier were opened, with the old strokes in them), `wx-earth-blizzard` (opened one tweak
earlier: a few more stems came through), `wx-earth-storm` (the same view one commit earlier
was opened), the before half of `near-saturn` beyond its first render.

| what | frame | verdict |
| --- | --- | --- |
| night on Earth | `night-earth.jpg` (gallery, forest easel, 23 h) | yes. Before: the day multiplied by blue. After: a nocturne: tree masses run together into deep indigo-green, the sky is a middle indigo paling to a band over the wood with a pale lifted cloud, and the lights are reserved paper: birch trunks, the stream's reflections, the canopy glass, the coat, five stars. Weak: the foreground ground is one flat dark; edges are all crisp (a nocturne wants more lost edges); the coat is the brightest thing in the picture |
| dawn and dusk on Earth | `daynight-earth.jpg` (dawn over dusk) | yes: a rose-lilac dawn sky with long cool shade; a warm grey-gold dusk on toned paper. Dusk's sky wants more gold at the horizon |
| Mars | `daynight-mars.jpg` (dawn over dusk), `night-mars.jpg` | yes, the best of the set: a salmon dawn with mesas stepping back in mauve layers; the blue dusk; at night dark sepia terraces with pale strata under a deep sky with stars. Weak: the night sky is nearly one value |
| Uranus | `daynight-uranus.jpg` (dawn over dusk; rendered before the splinters were clustered), `night-uranus.jpg` | yes: mint sky to rose at dawn, teal to gold at dusk with the spire lit cream; at night the spire and the shelf are the reserved lights |
| space, in orbit | `space-orbit.jpg` | yes. Before: one soft wash, no stars. After: two layers of indigo with lost and found edges, a violet drift, spattered stars of unequal size |
| deep space, the game | `space-deep.jpg` | yes: layered washes, about seventy stars, the sun as bare paper with a halo, the ship's two warm lights |
| pulse drive, the game at 5.3 km/s | `space-pulse.jpg` | yes: pale drags lifted out of the wash run out from the point the ship flies toward, soft-edged, wandering a little, dry at their tails; stars fade under them. Not seen in motion. Weak: a little like combed hair where many lie side by side |
| lightning | `flash.jpg` (before: the game on `e56d65e`; after: gallery, storm at 21 h, flash forced) | yes: the open sky goes to bare paper, trees and trunks stand as silhouettes, no fringe of specks in the crowns. Weak: the crown edge against the paper is stepped in places (the sky mask is at the scene's resolution) |
| near strokes as flicks | `flicks-lawn.jpg` (the lead's vista in the game), `wx-earth-storm.jpg`, `near-saturn.jpg` | yes for the lawn: tufts of soft touches close to the ground's value, a few olive accents, uneven; no teeth. On Saturn the splinters stand in loose clusters of unequal size. Weak: at the boom's distance most flicks merge into the wash, so the lawn is quieter than a painter would leave it; not judged in first person or in motion |
| none on snow | `wx-earth-blizzard.jpg` (gallery, fresh snow forced) | yes: the snowfield is bare paper; two or three tall stems come through. PHYSICS' `sky.fresh` drives it in the game (not rendered in the game by me) |
| puddles, wet shade | `wx-earth-storm.jpg` (the game, the thunderstorm at 13 h) | partly: the shade under the trees is no longer a row of dark holes; puddles are faint pale soft shapes on the lawn, hard to find. At a stronger setting they covered a third of the lawn like snow patches: there is no hollow to put them in, only flat ground and a noise |
| Neptune's sea takes the storm | `wx-neptune-gale.jpg` (gallery, forced storm) | partly: sea and beach go dark indigo under the closed sky. No white horses (not done) |
| the storm after dark | `night-storm.jpg` (before: the game on `62d061a`; after: the game, sun put at 21 h) | see the file: yes as a picture: a low-key wet night, the storm sky the darkest wash with a pale band under it, trunks, the ship and the coat as the lights, the border a clean ragged edge. Dark for play: the explorer reads by the coat. One dark round blot in the air is a flying leaf (PHYSICS' kit in my ink): it wants to be a flick |

### How each part works
- **Night key** (sheet pass). Three things, by `SHEET.night` (1 at night on the ground, 0 by
  day and in space): the hue narrows toward indigo; every wash is given 0.68 to 0.94 more
  pigment by the density model, so darks and middles run together and bare paper stays bare;
  the last glaze over the sheet is light ([0.64, 0.70, 0.90], was [0.42, 0.48, 0.70]) and
  what is near paper is kept out of it (the reserve). The world lays the sky's keys lighter
  by the inverse of the density (`undens`), so the sky lands on the look's night values.
  The brush is a little broader and wetter at night and the pencil nearly gone.
- **Stars and streaks** are one glaze object (`pc-sky-glaze`, one triangle, drawn after the
  abstraction pass only at night, in space or under the drive). Stars: one dot at most per
  cell of two cube-map grids, radius 1.3 to 4.4 px, where the sky pass allows (no cloud, no
  overcast, above the horizon haze, out of the sun's glare). Streaks: in polar coordinates
  round the ship's heading (`userData.pcCaster === 'ship'`, else the camera's), sectors with a
  drag each, flowing outward in log radius; strength is `pulse01` (eased 0.45 s from the
  ship model's `mode: 'pulse'`) or, at a full cruise in space, 0.16 of it from `speed01`.
- **Flicks**. A cell has no tuft (one in five), one or two; blades start within 8 cm of the
  tuft's root, fan out, most short, the leader long; the shape is narrow at the root, full
  at a third, a point at the tip. Washes: two thirds of the way to the ground's own, a third
  of them paler, one in seven an accent (denser, left crisp). Under fresh snow all but the
  tallest are gone by half cover.
- **Lightning**: the lift to paper is by the share of open sky in five taps, so the gaps
  inside a crown stay with the crown; during a flash light things are reserved from the
  night's glaze.

### Not done, not verified, weak (blunt)
- **Not done from item 4**: white horses, the dust storm near the explorer, the two vistas in
  a thicket, Mercury and Neptune from orbit, Mars' dune crests, branch sway, drifts.
- **Not verified**: anything in motion (streak flow, star stability under a turn, flicks
  under the storm wind: the stills show no torn or stretched strokes, which is all I can
  say); quality 0 and 2 looks; the tour; other bodies' densest views (the far-world change
  can only lower them); a real GPU. `tests/weather.mjs` was run on `e56d65e` only (five
  frames; its "neptune-gale-forced" frame stayed on the meadow because of `--only`).
- **Storm wind on trees and strokes** (PHYSICS asked): in three storm stills nothing is torn,
  stretched or laid flat; I cannot say more without motion.
- **Rain**: with PHYSICS' own share I count about twenty strokes in the frame in the
  thunderstorm (it says 37 are in view): enough to read as rain, soft, paler than the wood.
- Puddles are weak (above). The walker's track and the ship's wash were not re-rendered with
  the flicks (`wx-grass-part.jpg`, `wx-grass-wash.jpg` removed as stale; trodden blades are
  now only a little paler and broader, so the track will read less).
- `models-*.jpg` and M2's biome frames predate this block (old strokes, old night).
- A far world between 8 and 10 px of radius swaps from dab to terrain in one frame (no
  cross-fade); a dab has no clouds, bands or rings' shadow; a far world behind a closed sky
  vanishes at overcast 0.6 without a fade.

### Contract changes in this block (all additive; nothing removed)
- `setMood.speed01` and `inSpace01` are now read (streaks at a full cruise in space).
- The ship's `animate({ mode: 'pulse' })` switches the streaks on (no new call for PILOT).
- `sky.fresh` (PHYSICS) is the fresh-snow cover when present; my own model is the fallback.
- `sampleObstacles`: a boulder's `height` is 0.58 of its scale (was 0.5): the top of the
  drawn boulder over the ground beside it. The largest boulder is about 1.2 m.
- Render: `SHEET.night`, `MOTION`; the sky writes where stars may lie into the aux target's
  x for region 0. World: `world._glaze` (a debug string). Gallery: `odist=`, `chase=1`
  (`cdist=`, `cdown=`, `cside=`), `speed01=`.
- I no longer close the sky under rain or snow myself (PHYSICS does), and the rain share
  is PHYSICS' own.

### For PHYSICS
- Snow: `sky.fresh` is used. Rain: your share is used as it is; about twenty strokes show in
  the thunderstorm. Storm wind: no damage seen in stills; nobody has watched it.
- Still open from my side: `pcPhysWaterCrestLine` (white horses), `pcPhysBranch`, drifts.

### For PILOT (and the lead)
- `tests/weather.mjs` still looks for the storm at 720 s; it is at 160 to 320 s now.
- A cleaner signal for the streaks would be `mood.pulse01` (0 to 1); today I read the ship
  model's mode. If you want no drags at a plain cruise, say so (one constant, 0.16).
- Boulders: all are under 1.3 m by their true height, so all are walked over; if some should
  block, tell me the size and I will grow a few.
- **UI second look (PILOT asked): not done.** No interface frame was opened in this block.

## M3 block 2: explorer and ship, near ground, glazes, dark washes (fourth PAINTER agent)

INTEGRATION: ready (`6bb6c91`; the game on a clean export loads, plays on foot, in the
cockpit and in the chase view with no console error; 19 world tests pass; the project's
105 tests pass on a clean export of `09a8338`. In the working tree one of PILOT's tests failed
while PHYSICS was mid-save: test from an export).

### What is in, the frame that shows it, my verdict
Frames in `docs/shots/painter/`, 960x540 unless said, quality 1, gallery from a clean export.
Rendered at `db22516`, except `models-forest`, `models-game`, `wx-earth-storm` and
`wx-grass-wash` at `6bb6c91` (which made the near blades slender and uneven in length and
raised the rain share: the others show slightly broader, more even blades and fewer strokes).
Opened at full size: `models-forest`, `models-game`, `wx-earth-storm`, `wx-grass-part`,
`wx-grass-wash`. Seen on a contact sheet at two thirds size only: `models-mars`, `-moon`,
`-uranus`, `-cockpit`, `wx-jupiter-storm`, `wx-neptune-gale`, `wx-mars-dust`,
`wx-earth-blizzard`. **Not opened in its final render**: `models-poses` (the same poses were
opened in an earlier render). `wx-earth-before` and `wx-earth-after` were removed (stale).

| what | frame | verdict |
| --- | --- | --- |
| explorer and ship in the Earth forest | `models-forest.jpg` | yes. A traveller in a canvas coat with a broad dark hat, a pack with a rolled sheet and two copper jet bottles, a red scarf down the back; a planked flying skiff with a canvas deck, a framed glass bubble, cloth wings on ribs, a red-tipped fin, two copper pots, three legs, a rope ladder. Both read as painted things, sit in the light of the place and lay a shade on the ground. Weak: the explorer is still a little of a doll from the front (a blank face under the hat, stiff sleeves); the canopy is a pale egg |
| the game, third person at the Earth spawn | `models-game.jpg` (the game on a clean export, 960x540) | yes: at the 6.4 m boom the figure is about 110 px tall and reads by hat, pack, scarf and coat; its shade is on the grass; the ship beside the birches is a boat with a red fin |
| on Mars, on the Moon, on Uranus | `models-mars.jpg`, `models-moon.jpg`, `models-uranus.jpg` | yes (contact sheet only): the pale coat and dark hat carry the figure on ochre, on pale grey and on teal ice; the red reads on all three. On the Moon the pebbles are dark commas on the regolith, on Uranus frost needles stand all over the ice (a little too many, all alike) |
| the cockpit from `userData.seat` | `models-cockpit.jpg` | yes: a wooden hoop frames the view near its edges, the cowl with three dials lies along the bottom, the canvas foredeck runs to the bow lantern. (The HUD covers the dials in the game.) |
| walk and jet poses | `models-poses.jpg` (two 640x360 frames side by side) | yes: the stride, the coat and the scarf streaming; the jet with the legs trailing, the flame under the bottles and the shade below on the ground. Run, fall were looked at once (scratch), sit and wade never |
| near ground: a walker's track | `wx-grass-part.jpg` (top: PHYSICS' push on; bottom: `push=0`; the lower two thirds of each frame) | partly. Top, a pale band about a metre wide runs from the left to the explorer's feet: the trodden tufts lie over and show their pale side, and stay down (PHYSICS' flatten). It is a track, not a sward parting: the grass is tufts 0.66 m apart. 1.0 % of the frame's pixels differ by more than 12 of 255 |
| near ground: the ship's wash | `wx-grass-wash.jpg` (top: 90 kN at 3 m; bottom: no wash) | yes for the motion: every blade in a wide disc lies over, away from the hull (8.2 % of the frame's pixels differ by more than 12). As a picture it is weak: seen from a low camera the nearest blades are flat triangles |
| rain as a glaze | `wx-earth-storm.jpg`, `wx-jupiter-storm.jpg` | yes on Jupiter (contact sheet): parallel transparent strokes, darker than the pale gap, lighter than the dark cloud. Partly on Earth (opened): the strokes are right but few (PHYSICS draws a quarter of them now; I ask for 1.6 times that) |
| dark washes without pepper | `models-moon.jpg` (space), `wx-earth-storm.jpg`, `wx-neptune-gale.jpg` | yes: the Moon's sky and the storm sky are soft, broadly mottled washes; enlarged three times there is no hard speck left. The dust sky on Mars keeps its fine grain (it is a light wash: that is where pits belong) |
| drift ripples, blizzard | `wx-mars-dust.jpg`, `wx-earth-blizzard.jpg` | (contact sheet) the near dune carries short dark commas along its crest; the blizzard is as it was, a few green tufts standing in the snow at the bottom edge |

How each part works, briefly:
- **Models**. Every form is a loft (rings of a superellipse along a path) whose surface is
  pushed about by a smooth noise, so no silhouette is ruler-true and nothing is a primitive.
  The washes are vertex colours from one palette of ten (canvas cream and its dirty hem,
  indigo-sepia, grey-blue, copper, sepia, flesh, glass, ochre planks, and ONE accent, a red
  that the scarf, the hat band, the fin and the wing tips share). `makeFigureMaterial` lays
  the wash with drifting pigment, pooling just inside the silhouette, a few long soft strokes
  down the form (folds, weather runs), light in soft steps and a little dry brush on the lit
  side; flames and the bow lantern are bare paper running into warm colour (`glow`). Each
  figure is one mesh and ONE draw call (the placeholders were 8 and 17): parts are moved by
  `uPart[]`. Explorer: 11 parts, about 3 k triangles; ship: 6 parts, about 7.5 k.
- **Animation** (C10 unchanged). Explorer: the modes are blended (weights eased at 9 /s), so
  walk runs into jet into fall. The stride phase advances by the ground covered (one step is
  0.45 m + 0.22 s of travel, the leg swing is the arc that step needs), the hips bob twice a
  stride, the coat streams back, the scarf lifts with speed and flies up in a fall, the head
  follows `lookPitch`, at rest the weight is on one leg. Jet flames scale with `jet01` and
  boil at 8 frames a second. Additive state fields: `phase` (radians, sets the stride),
  `snap` (no easing), both for stills. Ship: the legs fold (`gear01`: nose leg back under the
  belly, the outriggers up to the wings), the canopy hinges at the back (`canopy01`), the
  flames lengthen with `throttle01` and are long and thin in `pulse`, a slow bob in `hover`.
- **Shade**. `pcCast` in the terrain and near-ground fragments: an oval glaze thrown away
  from the sun (as long as the figure is tall over the sun's height, a pool under a closed
  sky), ragged at the edge, fading as the explorer or the ship rises. The world finds the two
  in the scene by `userData.pcCaster`; PILOT wires nothing. Trees and props do not take it.
- **Near ground**. One instanced mesh, one draw call, at most 6400 strokes (19.2 k
  triangles), three triangles a stroke. The ground is divided into cells of the cube sphere
  (0.66 m); each cell owns a clump of up to eight strokes whose places, shapes and washes are
  a pure function of the cell (so they are anchored). Clumps are laid nearest first inside a
  time slice (a quarter of the build budget; one surface sample and two heights a clump),
  come and go at 11 m where a stroke's length is already nothing, and grow in over 0.7 s
  when laid inside the range. Kinds by biome (`styleOf`: from `small`, `terrain`, `under`,
  or a biome's own `near: { blade, reed, needle, dab, ripple }` in looks.js): grass blades
  (fanned tufts in the biome's leaf washes run into the ground's), reed stubble, frost
  needles and splinters, pebbles, drift ripples. Each stroke faces the picture plane about
  its own axis, is lit like the ground under it (dapple and the cast shade included), is
  never thinner than 2.3 pixels of the scene pass, thins with distance (full to 7 m, none at
  11 m), is slender close to the eye, and half of them are region 6 (crisp accents).
  PHYSICS: each blade bends with `pcPhysBend` at its own root, and where the field says
  flattened it lies over the way it already leaned, broader and paler. `world.busy` counts
  clumps still to lay. Fresh snow buries most of a blade.
- **Glaze pass**. Objects in `GLAZES` sit out the scene pass and are drawn after the
  abstraction pass straight onto the brushed picture with ordinary blending; they test their
  depth by hand against the scene's second target. Rain is the first: a transparent stroke
  of a middle value. Cost: one more draw call per glaze object, no new target.
- **Dark washes**. In the sheet pass the granulation has two regimes: in light and middle
  washes pigment sits in the pits of the paper (the fine speckle, as before); in a dark wash
  (and in any wash under a storm key) the pits are full and only the broad soft settling of
  the pigment shows (the same paper sampled out of focus, at 40 % of the strength). The
  floor of the darkest value and the paper relief follow the same rule. The border's dry
  edge skips in larger pieces.
- **Eased sky**. The world eases PHYSICS' sky numbers with a time constant of 0.9 s (90 % in
  two seconds) before painting from them; a forced sky, the first frame and a change of body
  are taken as they are; `flash` is never eased.

### Numbers
- **Cost** (quality 1, with the explorer, the ship and the near ground in; budget 600 k / 350):
  Gallery (whole frame, `models=1`): Earth spawn 516 k triangles / 280 draw calls (quality 0:
  265 k / 189; quality 2: 700 k / 351); temperate forest easel, the densest view known:
  546 k / 299 (quality 0: 255 k / 181; quality 2: 740 k / 365 draw calls). The game on a clean
  export, its own read-out: third person at the Earth spawn 527 k / 285 (579 k / 300 two
  commits earlier, before the tree trim and with every stroke slot submitted); the cockpit
  9 m up 350 k / 202.
  Before this block: Earth spawn 539 k / 296 (gallery, no models), forest easel 580 k / 317.
  What changed the count: the models are 2 draw calls instead of 25; the near layer is 1 draw
  call and at most 19.2 k triangles (only live strokes are submitted); the old near grass
  patches are gone (about 12 k triangles and one draw call a near chunk); **full trees and
  middle-tier trees hand over 18 % and 12 % sooner at quality 1** (`TRIM` in
  `src/world/flora.js`: 43 m to 35 m, 105 m to 92 m), which pays for the rest. The lead's
  vista `earth-temperate_forest-1` (645 k / 352 before, in the game) **was not re-measured
  by me in the game**: by the same deltas it should be under the budget; the lead must check.
  Other bodies were not re-measured (the trim applies to all, the near layer adds at most
  19.2 k and one call to each). **Not measured on a real GPU.**
- **Near ground build**: one clump costs a surface sample and two heights (about 0.1 ms here
  under load); a first fill is about 900 clumps and is spread over frames by the slice.
- **Crawl**: the Earth spawn seen from 1.6 m up and pitched 20 degrees down (the foreground
  fills the frame), camera turned 0.15 degrees (about 1.6 px): mean difference 3.85 of 255,
  7.6 % of pixels change by more than 12, 1.6 % by more than 30. The same pair with `near=0`:
  3.18, 6.0 %, 1.4 %. The strokes add about a quarter to what this view already does under a
  turn: crisp marks that travel with the ground they are anchored to. Two renders of one
  frame are identical. That is not a measure of shimmer in motion, and nobody has watched it.
  **Not measured**: the strokes in motion under wind (PHYSICS' field moving them), rain in
  motion through the glaze pass, the walk cycle's foot slip, anything by eye in motion.

### Not done, not verified, weak (blunt)
- **The sward is still tufts**: one clump every 0.66 m. A walker leaves a pale track, not a
  parted sward; seen from the game's boom the strokes are small dark flicks, rather even in
  size. Each blade is a flat two-segment triangle: close to a low camera they are cut paper
  (I made them slender within 7 m; not re-judged in first person in the game).
- **Explorer**: no face, no hands to speak of; sleeves are one stiff piece (no elbow);
  `sit` and `wade` poses never rendered; foot slip not measured; the hat brim hides the head
  from the game camera (intended) but from the front the head is a brown ball.
- **Ship**: the canopy glass is an opaque pale wash (an egg from some sides); no pilot is seen
  inside; the pulse state (long flames) was never rendered; the hover bob and the gear
  folding were seen only in the game's chase frame.
- **Cast shade** falls on terrain and near strokes only: not on props, water or the ship's own
  deck. Under a low sun it is capped at 2.2 heights.
- **Rain on Earth is thin**: a handful of strokes in a frame. Snow, dust, hail, leaves are
  still opaque marks in the scene pass (only rain is a glaze). Lightning still unseen.
- **Not done from item 4**: PHYSICS' branch sway and drifts; the instanced kit variant;
  half-float flora fields; the debug flag PHYSICS asked for.
- **The ragged border** still pools dark and a little dotted under a storm key.
- **M2's 42 biome frames in `docs/shots/painter/` predate this block** (no near ground, the old
  granulation): they are true to the landforms, not to today's foregrounds and darks.
- The tour was not run. Venus, Saturn, Mercury, Neptune, Pluto were not looked at with the
  near layer (their kinds follow from `small` automatically: mostly pebbles and needles).
- Quality 0 and 2 with the near layer: counted (cost line), never looked at.

### Contract changes in this block (all additive; nothing removed)
- `createExplorer()`, `createShip()`: C10 kept (sizes, origins, facing -Z, `userData.seat`
  (0, 1.75, -1.3), `userData.hatch` (-2.3, 0, -0.6), the state shapes). New: the ship's pads
  stand where PHYSICS' legs are ((0, 0, -3.2), (+-2.2, 0, 1.8)); `object3D.userData.pcCaster`
  ('explorer' | 'ship': the world lays their shade; any object added to the scene with that
  tag is treated the same); explorer `animate` also reads `phase`, `snap`; ship `snap`.
  Each `object3D` is a Group holding ONE mesh (`makeFigureMaterial`); do not swap its material.
- `world.setBuildBudget(ms, { fixed: true })`: pins the slice (the lead asked): no larger share
  of slow frames. `world.busy` now includes near-ground clumps still to lay.
- `world.update` eases the sky numbers itself; PILOT changes nothing.
- Render: `GLAZES` (shared.js) and `makeFigureMaterial`, `makeNearMaterial` (materials.js);
  `FRAG_PARS` declares `uCast[4]`, `uCastK` and gains `pcCast`; `makePaintUniforms` supplies
  them (kits built on the old factory still work: the uniforms default to no shade).
- Gallery: `pose=`, `speed=`, `phase=`, `jet=`, `lift=`, `mface=`, `epitch=`, `smode=`, `gear=`,
  `canopy=`, `throttle=`, `sface=`, `cockpit=1`, `near=0` (see "Gallery URL parameters").

### For PHYSICS
- **Rain** is a glaze now and your `share: 0.25`, `parallel`, `maxLen`, `near: 6` are in use:
  parallel strokes read as rain at last (`wx-jupiter-storm.jpg`). On Earth a quarter is too
  few through the trees (`wx-earth-storm.jpg`): I multiply your share by 1.6. If you can, make
  the share follow the rain rate so a downpour has three times the strokes of a shower.
- **Grass**: I use `pcPhysBend(root, 0.0)` per blade and your `flatten` (z) to lay a blade
  over along its own lean and keep it down: the plastic part (60 s) is what makes the
  walker's track visible, since the push load itself is gone a second after the feet. A
  track 1 m wide is about one clump of mine: a wider flatten radius for the explorer (0.8 m)
  would read better. The downwash disc is strong and right.
- **Sky numbers** are eased by me (0.9 s time constant): no need to slow yours for my sake.
- Pads: the ship's drawn pads are at your `legs`; tell me if they move.

### For PILOT (and the lead)
- **Cost** (MUST FIX of review 4): numbers above; please re-measure `earth-temperate_forest-1`
  and the densest view of each body in the game. If a body is still over, the knob is `TRIM`
  in `src/world/flora.js` (quality 1 only) or `MAXS` in `src/world/nearground.js`.
- **Dark specks** (MUST in M3): fixed in the sheet pass for every dark wash; please look at a
  fresh `m2-pulse` frame.
- `setBuildBudget(ms, { fixed: true })` is there. `world.busy` reaches 0 with the near layer
  (the gallery's ready flag waits on it); the tour was not re-run by me.
- The boom: the figure now reads at the default 6.4 m ("longer while the explorer is a
  placeholder" in `camera.js`): try 5 m, your call.
- The cockpit: the hoop and the cowl sit where the HUD's lower panels are; if the dials
  should be seen, the panels want to move outward 80 px or so.
- The ship has no pilot inside and the explorer's `sit` pose is unused: if you ever show the
  explorer in the cockpit from outside, tell me and I will seat a figure under the glass.
- **UI theme, look review** (from `ui-title`, `ui-map`, `ui-painted-book`, `ui-foot`, seen on a
  half-size contact sheet). It belongs to the picture: torn paper in the sheet's own white,
  a hand-lettered face, "click to begin" as a brush stroke, the sketch pinned like a small
  painting. Change, in this order: (1) the key caps are the one digital thing on the title
  card (even blue-grey rounded rectangles with a hard outline): make each a loose wash dab
  with a broken pencil ring, none quite alike; (2) the map lies on a flat navy field with
  pixel-dot stars: either the sheet's own indigo wash with spattered stars, or no dark field
  at all (an ink chart on bare paper); (3) the orbits are perfect ellipses of one line
  weight: let the line break and swell like dry brush; (4) the sketchbook's empty slots are
  grey dashed boxes and the selected planet is a hard navy pill: faint pencil rectangles,
  and a brush stroke for the selection; (5) the hint line sits on a clean rectangle: tear it
  like the others; (6) every panel shares one tear profile: vary it per panel.

## M3 block 1: weather in the picture (third PAINTER agent)

INTEGRATION: ready (`9d9caf1`; render, world and art usable on all ten bodies; the game on a
clean export of that commit loads and plays into the storm with no console error).

### What is in, the frame that shows it, my verdict
Frames in `docs/shots/painter/`, 960x540, quality 1, gallery. "physics" = PHYSICS' own
weather at that place and time (`physics=1&wtime=..&pre=6`); "forced" = sky numbers set by
hand (`wx=`). I opened every frame named here at full size unless I say otherwise.

| what | frame | how made | verdict |
| --- | --- | --- | --- |
| Earth spawn before the storm | `wx-earth-before.jpg` | physics, t 540 | fair day, sun and cast shade, a few dark grass strokes in the foreground (opened on a contact sheet at two thirds size) |
| Earth spawn in the thunderstorm | `wx-earth-storm.jpg` | physics, t 720 | passes: indigo sky with a torn pale gap, far trees lost in a pale band, no cast shadows, darker richer ground with two small puddles, slanted rain strokes. The committed frame has the longer, thinner strokes and was opened at 640x360 only; the one before it at full size |
| after the storm | `wx-earth-after.jpg` | physics, t 870 | sun back, ground a little richer (wet 0.4); quiet, as it should be (contact sheet) |
| blizzard on a snowy biome | `wx-earth-blizzard.jpg` | physics, alpine meadow easel, t 400, `fresh=1` | passes: closed grey sky, the massif going into the white, fresh snow as bare paper with rocks capped, pines as dark dabs, paper flecks in the air. Weak: the foreground is empty paper; the grass tufts left standing are too green |
| dust storm on Mars | `wx-mars-dust.jpg` | physics, dust dunes easel, t 840 | passes as a picture of dust: the whole sheet in the dunes' own ochre, far dunes dissolved, dust masses in the sky, a glow at the horizon. Weak: the near billows (kits) are soft blotches, more sponge than drift |
| storm on a giant | `wx-jupiter-storm.jpg` | physics, storm wall easel, t 120 | passes: a sepia storm sky (not grey), the wall ghostly, wet red plain, rain. The strokes are many and all alike |
| Neptune's sea in a gale | `wx-neptune-gale.jpg` | PHYSICS' waves (wind 34 m/s, Hs 1.0 m, 10.6 m waves) under a forced storm sky | partly: heavy indigo sky with veils, the sea in broken dark strokes, a pale foam patch, swash at the shore. Few white horses: at this distance the 10 m waves are smaller than the brush and are dropped; the far sea carries only anchored dabs. Under PHYSICS' own sky there (fair, "windy") it is a choppy blue sea |
| grass parting round the explorer | `wx-grass-part.jpg` (left push off, right on) | physics, alpine meadow, explorer walked in | partly: the clump at the explorer's feet leans away (0.93 % of the frame's pixels change by more than 12 of 255); nothing reads as a sward parting |
| grass under the ship's wash | `wx-grass-wash.jpg` (left no wash, right 90 kN at 3 m) | physics | yes: the near clumps lie over, away from the hull (2.3 % of the pixels of the grass band change by more than 12) |
| the game itself | not committed (scratch `game-storm.jpg`, opened) | clean export of `02486d3`, `index.html`, clock set to t 700, third person | storm sky, wet ground, rain, kits 5 draw calls and 3.3 k triangles, state ON_FOOT, no console error. In that view from above the rain strokes read as short pale petals; made longer and thinner since (`9d9caf1`), **not re-checked in the game** |

How each part works, briefly:
- **Sky**: under an overcast the zenith and horizon keys become one heavy wash of that
  world's storm pigment (its cloud shadow laid dense and glazed with indigo: Payne's grey on
  the cool worlds, sepia on the warm ones, because orange mixed with indigo is mud), dense
  overhead, paler toward the horizon. Clouds stop being bare paper and become masses of the
  same wash with dark bellies and pale torn edges. Rain or snow in the air drags soft slanted
  veils through the low sky (anchored to the planet). Where rain or snow falls the sky is
  closed whatever `cloud` says. Dust tints zenith, horizon, haze and light with the mid ground
  wash of the biomes under the camera and raises dust masses.
- **Haze**: the fog distance is multiplied by `haze / 0.8` (PHYSICS' fair weather is 0.7 to
  0.95: I treat 0.8 and up as my clear day); the haze colour goes to the pale band under the
  cloud, to grey water (`fog`) or to the ground's dust.
- **Light**: overcast flattens the light to two soft steps (local colour and one glaze),
  switches off cast dapple, cools the light; a storm deepens the glaze.
- **Sheet**: a storm adds pigment to every wash (the density model: paper stays the brightest
  value); granulation is damped under that key; `flash` lifts the sky and the lights to bare
  paper and leaves the darks as silhouettes (same frame).
- **Ground and flora**: `wet` darkens and enriches (`pcWetWash`), softens edges, and leaves a
  few small pale puddles on level ground near the eye; snow lies as bare paper on up-facing
  forms with a ragged edge, thinner under trees, on crown tops and rocks; four fifths of
  the grass and flowers are buried.
- **Liquid**: the mesh is lifted by PHYSICS' wave trains and wakes within about 2 to 6
  wavelengths of the eye (where the mesh is fine enough), dying at the waterline. In the
  fragment: PHYSICS' height and slope give the normal; crest lines (high water where the
  slope along the waves' way turns over) are torn bare-paper dashes; whitecaps torn dabs on
  the crest fronts; surf on breaking crests in the shallows and a swash line at the shore;
  detail smaller than a pixel is dropped (so far water cannot shimmer) and replaced by the
  same share of white as anchored dabs; a running sea mirrors less and is laid in broken
  strokes of unequal weight.
- **Kits** (`src/render/kitmat.js`): rain a broad wet stroke in the sky's own wash, nothing
  nearer than 3.2 m; snow a ragged paper fleck; dust a soft patch close to the haze's value;
  prints the ground's wash laid darker; rings broken circles on region 6. Sixteen inks a
  biome by PHYSICS' material names, blended by biome weight under the camera.
- **Grass**: each near grass tuft (the seed-below-0.55 half, within 15 m) is now a patch of
  12 broad blades about 1.6 m across; each blade carries its root in `aMass.xz` and is bent
  about it by `pcPhysBend` at that root.

### Numbers
- **Cost with weather on** (gallery, whole frame, `renderer.info` over one frame):
  Earth spawn in the thunderstorm (`cam=trees`) quality 1: 551 k triangles, 301 draw calls
  (the same view before this block: 539 k, 296); quality 0: 246 k, 179 (before: 241 k, 174).
  The densest view known (temperate forest easel, quality 1): 580 k, 317 (was 571 k, 315).
  Kits in the storm: 5 draw calls, 3.3 to 3.4 k triangles, 0.2 to 0.3 ms a frame for
  `kits.update` in the browser (one reading of 8.9 ms with four browsers running at once).
  Budgets 600 k / 350 at quality 1 and 300 k at quality 0: inside. Quality 2 not re-measured.
  The sky, haze, light and sheet changes add no draw call and no pass; the water fragment
  adds PHYSICS' four wave trains (16 sin or cos) and three noise lookups; the water vertex
  the same plus the 16-step wake loop. **Not measured on a real GPU.**
- **Crawl** (frame pairs at 960x540, mean difference on 0 to 255 and share of pixels changing
  by more than 12): storm sky, veils and wet ground one frame (1/30 s) apart, kits off: 0.32
  and 0.04 %. The gale sea one frame apart: 1.81 and 2.3 % inside the sea band (0.02 % by
  more than 30): it moves, nothing pops. The sea with the camera turned 0.15 degrees: 1.39 and
  0.87 %. The snow-covered meadow under the same turn: 1.25 and 1.32 %, less than the same
  meadow in fair weather (1.59 and 1.79 %): the snow edge adds no crawl. Two renders of the
  same frame with physics on are identical outside what was pushed (0.02). **Not measured**:
  crawl of rain, flakes, dust and rings in motion (PHYSICS measured its marks; I did not
  measure them through my post pass), and nothing was judged in motion by eye.

### Not done, not verified, weak (blunt)
- **Lightning** is implemented (`flash`) and has never been seen: no frame caught a flash.
- **Rain in the game's view** was re-shaped after the only game frame I took; not re-checked.
  Rain strokes are opaque (the scene pass cannot glaze): they are pale sticks against dark
  trees. The glaze target promised to PHYSICS (its gap 3) is still not built.
- **Grass is not a sward**: tufts stand 1.5 to 3 m apart, so there are a few clumps of broad
  strokes near the eye. The patch stands on the planet's up, not on the slope (blades hover
  or sink on steep ground). On the alpine meadow the blades are pale. A meadow of grass
  needs its own dense near layer (a camera-centred grid of strokes, about 3 a square metre
  within 12 m: about 20 k triangles, one draw call).
- **Snow**: I draw only fresh snow (see contract changes). The edge is ragged, the cover has
  no drifts (PHYSICS' section F, `physics.fields.drift`, is not read).
- **Not wired from PHYSICS' P6**: branches (`pcPhysBranch`, one line and two uniforms),
  drifts, the instanced kit variant (`expand: 'gpu'`), half-float linear flora fields, and the
  debug flag that writes the displaced position (asked for; not built).
- **Puddles** are two or three pale shapes; they do not mirror anything.
- The tour was not run in this block; landings and the trip were not re-run (terrain did not
  change; spawns and stands did not move).
- Venus, Saturn, Uranus, Mercury, the Moon and Pluto were not looked at under weather.
- The ragged border goes dark and dotted under the storm key.

### Contract changes in this block (all additive)
- `world.setPhysics(physics, opts?)` now also builds PHYSICS' draw kits (dynamic import of
  `src/physics/three/index.js`) and draws them under the active body's root; `{ kits: false }`
  turns that off. **PILOT: do not create kits yourself.** `world.kits` is the kit object
  (`stats.drawCalls`, `stats.triangles`) or null.
- `world.setWeather(sky | null)`: force the eleven sky numbers (gallery, tests).
  `world.freshSnow`, `world.setFreshSnow(x)`.
- `painter.setMood({ sky })` is read: `flash` in the same frame; the rest only if PHYSICS was
  not handed to the world. With `world.setPhysics` the world reads `physics.here.sky` itself.
- **Snow, my reading of the contract (look is my call)**: PHYSICS' `snow` is 1.0 on the
  alpine meadow in fair weather, 0.74 on Mars' polar frost, 0.96 on Neptune's tundra, 0.54 on
  Uranus' shelves: the standing cover of a cold place. Drawn as given, the alpine meadow the
  brief names would be white for ever. The standing cover is already in each biome's painting;
  the picture adds **fresh** snow only: it gathers while `snowfall` is above 0.02 (full after
  about 25 s of a blizzard), is gone five minutes after, and never exceeds `snow`.
- Regions: 6 = small crisp marks (the abstraction pass keeps 92 % of the drawing), 7 = in the
  air (no graphite line). `FRAG_PARS` declares `uniform vec4 uWx` and gains `pcWetWash`,
  `pcSnowCover`; `makePaintUniforms` supplies `uWx`. Kits built on the old factory still work.
- `src/render/index.js` consumers: nothing removed. New file `src/render/kitmat.js`
  (`makeKitMaterial(kind, info, { shapeGlsl })`, `biomeInks`, `KIT_INK`, `KIT_PALETTE`).
- Gallery: `wx=`, `sky=`, `physics=1&wtime=&pre=`, `fresh=1`, `kits=0`, `models=1&walk=&mdist=
  &sdist=&hover=&wash=`, `push=0` (see "Gallery URL parameters").

### For PHYSICS: what looks wrong in the physics as painted (frame by frame)
- `wx-earth-storm.jpg`, `wx-jupiter-storm.jpg` (rain): near drops are drawn in perspective,
  so strokes left and right of the view axis lean opposite ways and cross; a painter lays rain
  in parallel strokes. Ask: one screen direction for all strokes of a frame (the mean), or
  nothing nearer than 4 m (I discard nearer than 3.2 m myself). On Jupiter drops fall so fast
  that at any exposure worth a stroke they are several metres long: an upper bound on stroke
  length in metres would help (I use 120 ms on every world). With the 4 px floor about 40
  strokes are in the frame: a third of that would be "a few".
- `wx-earth-blizzard.jpg` (snow): the first try (size 0.1 m, ceiling 10 px) gave round discs
  the size of popcorn; I use 0.07 m, floor 3.5 px, ceiling 6.5 px and a ragged cut. Flakes
  are fine in number. **At the easel the blizzard has `cloud` 0.46 and `overcast` 0.43 with
  `snowfall` 0.81**: a blizzard under a half-blue sky; I close the sky wherever rain or snow
  falls, but the numbers should agree.
- `wx-mars-dust.jpg` (dust): the billows come as about twenty separate round patches of 40 to
  80 px; drawn in the ground's ink they are blotches. Fewer and larger (two or three low
  walls of dust, wider than high, hugging the ground) would be a drift.
- Rings: on region 6 they survive and are few (two or three in a storm frame at 960x540);
  more would not hurt. Not checked on water.
- `wx-neptune-gale.jpg` (sea): `crest01` covers the whole top of a wave, which paints as a
  white sheet from near by; I use the crest line instead (height high and the slope along the
  wave direction near zero). `foam01` patches are several metres across; I tear them with
  noise. The waves are 10 m long and 1 m high in a 34 m/s wind (fetch-limited): from the shore
  they are smaller than the brush beyond 60 m, so the storm sea is mostly my far strokes. A
  longer, higher swell train on the open side of `storm_seas` would be seen.
- `snow`: see the contract note; a number for fresh cover alone would let me drop my own.
- Grass (`wx-grass-part.jpg`): the push round a walking explorer is one clump wide; the
  flattening under the wash is strong and reads. Bend in a breeze is not judged.
- The standing `wet` 0.55 on Neptune's tundra darkens that biome permanently: fine by me.

### For PILOT
- `world.setPhysics(physics)` now draws the weather kits: nothing to wire. Pass `eye` to
  `physics.update` as PHYSICS asks. `setMood.sky` stays useful for `flash`.
- The read-out will show 5 more draw calls and about 3.4 k more triangles in a storm.
- Lightning: I would like to see one. A debug way to force `flash` for a frame would do.

## M2 status (second PAINTER agent; kept as written)

INTEGRATION: ready (latest `[painter]` commit; render, world and art usable on all ten bodies).

**M2, third pass: every biome of the eight planets now shows the feature the brief names, as
terrain in the surface function**; the per-biome table is below, with the frames I opened.
M1 stays closed. Moon and Pluto are untouched placeholders (they use the same recipes).

What changed in this pass (all in my files):

- **Landforms** (`src/world/surface.js`): new or rebuilt recipes: `canyon` (a plateau cut by a
  wandering network of gorges: dry floor, walls in steps with benches, buttes on the plateau),
  `mesa` (tables with cliffs all round and a talus skirt, two tiers), `terraced` (level treads
  ending in cliffs; with `pools` a rimmed pool on every tread, each at its own level), `wall`
  (one great escarpment in two lifts with folded buttresses), `spires` (wind-scoured ridges
  that the slim spire kit stands along), `dunes` (transverse dunes: long back, short slip
  face, smaller dunes on the backs, baked lee shade), `alpine` (flat meadow floors, sharp
  ridges whose crest height rises and falls, snow line), `coast` (cliffs at the shore, stacks
  in the shallows), `islands` (tables in a sea of water or cloud, islets, the rock fading into
  the cloud at its foot so the islands seem to float), craters on a cell grid laid over the
  cube-sphere faces (whole bowls of many sizes, flat floor, steep inner wall, rim, apron;
  frost in the bowls), ponds on flats. Cliff lips are rounded a little so the mesh shows no
  knife edge. Strata are painted in the shader from the height (`aColor.a`), strongest on
  steep faces. Fog lying in low ground (`t.fog`), lasting half-light (`twilight`) and a chosen
  hour (`hour`) are per biome.
- **Nothing stretched**: the terrain's brush marks no longer come from the triplanar stroke
  atlas (its streak channel smeared into long radial streaks). Marks are thresholds of the 3D
  noise, anchored to the planet, in two octaves cross-faded by distance so that a mark keeps
  about the same size on the sheet: soft dabs, a few crisp flecks (fewer on smooth sand and
  ice), dry-brush sparkle. Rocks likewise. Cracks: the cell pattern is now uneven (a quarter of
  the cells left out, coordinates bent), looked up through a warp, with lines that swell, thin
  and break off, at two sizes. Graphite outlines are fainter and more broken.
- **Kits**: hanging vines (a mound on the cliff lip and a curtain of strands falling down the
  face, placed on lips and turned to face out over the drop; not an obstacle), frozen waves as
  a swept profile (back, crest, curling lip, hollow), slim leaning ice spires, crystals that
  bow, tall things in groups with empty stretches (outside the woods), bushes and grass in each
  biome's own washes (`biome.under`).
- **From orbit**: banded worlds close into a full cloud deck seen from outside: belts along
  the latitude with weather-pushed edges, white streaks, and Jupiter's Great Red Spot standing
  over the first `storm_wall` site. Decks ride above the highest ground.
- **The easel** (`src/art/vantage.js`, `src/art/easels.js`): `cam=vista` no longer guesses. It
  scans the ground from candidate spots, keeps what is not hidden, and scores each view for
  what that kind of place should show (skyline, overlapping ridges, water with land beyond it,
  a wall, a hollow with its far side, a crest running into the picture, ring arcs in the sky,
  nothing standing in front of the lens). The spot chosen for each biome is kept in
  `easels.js`, so the evidence frames are reproducible.
- **Cost and readiness**: terrain and flora take turns at a frame's building slice; a flora
  step starts only if it is likely to fit; undergrowth placement rejects most candidates
  before sampling; steep ground is refined from further away (no rows of teeth on cliff
  lines), less so at quality 0; the low tier draws no full trees and 55 % of the undergrowth.
  `world.busy` draining after a change of body is now tested.

### Per biome: is the named feature in the frame?

Frames: `docs/shots/painter/<body>-<biome>.jpg` and `<body>-orbit.jpg`, 960x540, quality 1,
`gallery.html?ui=0&t=0&quality=1&body=..&biome=..&cam=vista` (orbit: `cam=orbit`; Jupiter's with
`&biome=storm_wall`). Each was rendered twice from the kept easels (the committed frame and a
second render compared with it by image difference: all 40 reproduce). **I opened every one of
the 40 at full size.** Verdicts are mine, as a painting teacher would give them.

| frame | what the brief names | in the frame? |
| --- | --- | --- |
| mercury-orbit | the planet by its washes | yes: grey disc, a dark glass region, ochre edge, pale crater dots |
| mercury-ochre_basins | cracked ochre basins | yes: wandering cracks in the near slab, a basin with low crater mounds |
| mercury-obsidian_fields | obsidian glass fields | yes: dark bowed blades on cracked grey ground |
| mercury-crystal_gardens | twilight-band crystal gardens | yes: violet crystals in a lasting dusk; crowded, one crystal too near the lens |
| mercury-shadow_craters | frozen shadow craters | yes: from the rim into a bowl, frost floor, far wall in blue shadow |
| venus-orbit | sulphur-gold haze | yes: gold disc with wandering orange belts |
| venus-fungal_towers | fungal towers in amber cloud | yes (busy, as the lead said; not repainted) |
| venus-lava_rivers | lava rivers through basalt | yes |
| venus-acid_terraces | acid-lake terraces | yes: a green lake among stepped yellow ground; the steps are soft |
| venus-pale_mesas | pale mesas above the fog | yes: a mesa's shadowed cliff, ghost mesas standing in sulphur fog |
| earth-orbit | the planet | yes |
| earth-autumn_woodland | autumn woodland | yes: birches, gold crowns, the brook mirroring them |
| earth-alpine_meadow | alpine meadow and snow peaks | yes: flowered meadow, pines, a snow massif |
| earth-sea_coast | sea cliffs and coast | yes: a cliff headland with trees on top, beach, sea |
| earth-desert_canyon | desert canyon | yes: banded walls both sides, a butte beyond |
| earth-misty_wetland | misty wetland | yes: pool, reeds, trees lost in mist; emptier than it should be |
| mars-orbit | the planet | yes: rust globe, pale cap, canyon traces |
| mars-rust_canyons | rust canyons | yes: stepped strata walls, a spire, boulders; the far wall goes grey in the haze |
| mars-dust_dunes | dust-storm dunes | yes: a crest running into the picture, lit backs and violet troughs, more dunes behind (painted at 16.2 h; at noon the forms are flatter) |
| mars-polar_frost | polar frost fields | yes, quietly: frost polygons drawn by hand, a low scarp, ice shards |
| mars-dry_riverbeds | dry riverbeds, red-leaf groves | yes for the groves; the bed is only a pale band |
| jupiter-orbit | banded cream and orange, the Red Spot | yes |
| jupiter-sky_islands | sky-islands in cloud seas | yes: a table island with trees, pillars and islands across the cloud sea |
| jupiter-storm_wall | storm-wall cliffs | yes: the wall above a red plain with spires, in storm light (the storm itself is weather, M3) |
| jupiter-hanging_gardens | hanging gardens | yes: curtains of vine falling down a cliff above a garden |
| jupiter-lightning_plains | lightning plains | partly: cracked plain, pits, glass shards, brooding light; no lightning yet |
| saturn-orbit | rings and gold belts | yes |
| saturn-gold_islands | gold sky-islands, ring arcs | yes: islands and islets in the cloud sea, the ring arc in the sky |
| saturn-crystal_reeds | crystal reed fields | yes |
| saturn-ring_shadow | ring-shadow twilight | yes: dim violet spires, the ring a pale streak |
| saturn-honey_mist | honey mist valleys | yes |
| uranus-orbit | mint and aqua | yes |
| uranus-ice_shelves | mint ice shelves | partly: cracked ice and one shelf cliff; the cliff is a rounded scarp, not a sharp table edge |
| uranus-frozen_waves | frozen-wave forests | partly: the waves still read as snow-capped mounds; one shows its curl |
| uranus-pearl_fog | pearl fog flats | yes: the ground and the shards go into the fog |
| uranus-teal_sinkholes | glowing teal sinkholes | yes: the pool inside its pit walls |
| neptune-orbit | ultramarine, storm streaks | yes |
| neptune-storm_seas | storm seas with basalt stacks | yes for sea and stacks; the sea is calm (weather, M3) |
| neptune-kelp_forests | blue-violet kelp forests | yes |
| neptune-ice_spires | wind-carved ice spires | yes: leaning needles in a row |
| neptune-aurora_tundra | aurora tundra | partly: tundra with ponds; no aurora (sky work, M3) |

Earth's home forest: `earth-forest-*.jpg` (the M1 set) regenerated with the new ground marks. Opened at full size: `earth-forest-trees-noon.jpg` (still passes: leaning birches, crowns as washes, the brook, a softer meadow). **Not opened after regeneration**: stream-noon, canopy, jet, dusk, dawn, night, high, models-in-forest, stability-a and -b.

By my count: 28 biomes yes, 5 partly (`lightning_plains`, `ice_shelves`, `frozen_waves`,
`aurora_tundra`, and the channel of `dry_riverbeds`), none missing; eight orbit views
recognisable.

### In the integrated game (PILOT's tour, on a clean export)

`node tests/tour.mjs --bodies <body> --root <export>` at 960x540, quality 1, third person. The
tour stands where `world.findBiome` says (now the biome's **stand**: level ground that shows
the biome whichever way one faces) and at every vista.
Run by me for all eight planets on exports of `0d8ce45` to `6d0a92e` (the stands and easels
did not change between them except Uranus' sinkhole stand, re-run on `ddb5758`). I opened the
biome frames of every planet (my own contact sheets of the tour's frames) and two vista frames
each of Jupiter and Saturn; **I did not open the other vista frames**.

- Every frame settled (5 to 62 s; before this pass they never did) and no run reported a
  console error. Jupiter's and Uranus' first runs ended "TOUR FAILED" only because the browser
  refused the final contact-sheet screenshot under load; their frames were captured.
- The game's own counters at the stands, quality 1 (budget 600 k, 350): Earth 302 to 573 k and
  181 to 336 calls (autumn woodland the heaviest), Venus 316 to 512 k, Jupiter 321 to 532 k,
  Saturn 294 to 402 k, Neptune 224 to 375 k, Mars 178 to 361 k, Mercury 196 to 358 k (309
  calls in the crystal gardens), Uranus 252 to 375 k. All inside.
- What the game frames show: Earth: forest by the brook, autumn birches (with long dark cast
  shadows across the ground: hard-edged, to soften), meadow under snow peaks, a sea inlet under
  cliffs, banded canyon walls and a butte, a misty pool. Mars: canyon floor between strata
  walls; dune swells (soft at 10 h); frost polygons (the ice shards read too violet in the
  game's light); red groves over a pale bed. Jupiter: island top with the cloud sea and other
  islands behind; the storm wall above the red plain; a vine-hung cliff over the garden;
  cracked plain with shards. Saturn: an island top facing another island's cliff, the ring in
  the sky; reeds; twilight spires; misty valley. Mercury: cracks; glass blades; crystals in
  dusk; a crater's far wall and rim. Venus: towers; lava; the acid lake; pale mesas in fog.
  Uranus: spires before a shelf; frozen swell (weak); fog; the glowing pool inside its pit (after the stand was moved down to it). Neptune: cliff, sea and a
  stack; kelp; leaning spires behind a ridge; tundra and a pond.
- Second-site vistas stood on cliffs in two Jupiter cases (44 and 68 degrees); they are now
  moved to standable ground (tested for every vista on all ten bodies).

### Frame cost

Gallery, 480x270, at each biome's easel, whole painted frame (`renderer.info` over one frame),
after settling. Budget: 600 k triangles and 350 draw calls at quality 1, 300 k at quality 0,
1.2 M at quality 2. Densest view of each planet:

| planet | quality 1 triangles | quality 1 draw calls | quality 0 | quality 2 |
| --- | --- | --- | --- | --- |
| mercury | 370 k (crystal_gardens) | 316 (crystal_gardens) | 195 k (crystal_gardens) | 415 k (crystal_gardens) |
| venus | 459 k (fungal_towers) | 233 (fungal_towers) | 274 k (fungal_towers) | 519 k (fungal_towers) |
| earth | 571 k (temperate_forest) | 315 (temperate_forest) | 394 k (misty_wetland) | 728 k (temperate_forest) |
| mars | 329 k (dry_riverbeds) | 219 (dry_riverbeds) | 210 k (dry_riverbeds) | 406 k (dry_riverbeds) |
| jupiter | 455 k (hanging_gardens) | 226 (sky_islands) | 296 k (hanging_gardens) | 513 k (hanging_gardens) |
| saturn | 381 k (gold_islands) | 229 (gold_islands) | 222 k (crystal_reeds) | 451 k (gold_islands) |
| uranus | 324 k (teal_sinkholes) | 183 (teal_sinkholes) | 165 k (pearl_fog) | 360 k (teal_sinkholes) |
| neptune | 404 k (aurora_tundra) | 269 (aurora_tundra) | 267 k (aurora_tundra) | 442 k (aurora_tundra) |

Every planet is inside the budget at quality 1 (worst: Earth's home forest, 571 k and 315
calls) and at quality 2 (worst 728 k). At quality 0 the first probe found two Earth views
over (wetland 394 k, alpine 312 k); the low tier was then trimmed (no full trees, half the
undergrowth, little extra refinement on cliffs, a coarser split) and re-measured: alpine
168 k, home forest 242 k, Jupiter's gardens 209 k, wetland 299 k (at the edge of the budget). The other planets' low
tier figures in the table are from before the trim (so they are upper bounds).
`sampleSurface`: 10 to 34 microseconds a call on the ten bodies in Node under load (budget 50;
tested). `world.update` while arriving: see the answer to the lead below.
### Not done, not verified, weakest (blunt)

- **Not verified on a real GPU**: frame rate, and `world.update` worst frames in wall-clock
  time (only counted work, in Node).
- **In the game the picture depends on PILOT's camera.** The stands help (each shows its
  biome in most directions) but the explorer looks toward the parked ship. Tour sheets I did
  not open are named above.
- Two easels stand on steep ground (`mercury/shadow_craters` on a crater rim at 34 degrees,
  `uranus/teal_sinkholes` at 26 degrees): fine for the gallery, awkward as vistas on foot.
- **Weakest biome of each planet, for the M3 repaint**: Mercury `ochre_basins` (the basin
  itself is hardly a hollow); Venus `acid_terraces` (soft steps) and `fungal_towers` (busy);
  Earth `misty_wetland` (empty) and the dark shadow patches in `autumn_woodland`; Mars
  `polar_frost` (quiet) and the bed of `dry_riverbeds`; Jupiter `lightning_plains`; Saturn
  `ring_shadow` (little relief); Uranus `frozen_waves` (mounds, not waves) and `ice_shelves`
  (rounded scarp); Neptune `aurora_tundra` (no aurora) and the calm `storm_seas`.
- Foregrounds are bare on most worlds; explorer and ship are still toys and are in every
  game frame; no weather, no night or dusk pass on the new worlds (frames are at noon, the
  dunes at 16.2 h); Moon and Pluto untouched.
- `jupiter-lightning_plains.jpg` was rendered just before crater rims were given rounded
  crests (its pits changed by centimetres); not re-rendered.
- The lead's review-3 SHOULD FIX 4 (Venus' towers) is not addressed.
- `world.update` deliberately takes up to 30 % of the frame when the smoothed frame time is
  above 80 ms (software rendering): PILOT's read-out will show "world worst" of 100 to 300 ms
  in headless runs. At real frame rates the slice is 4 ms. Say if you would rather have a
  switch.

## Contract changes in this pass (all additive)

- `world.findBiome(bodyId, biomeId)` -> `{ unitDir, yaw, pitch }`: now the **easel** of that
  biome (the dry, standable spot its picture was painted from) and the way the painter faced
  (`yaw` from local north toward east, `pitch`, radians; north = `up x (Y x up)`). Falls back
  to the biome's first site (yaw 0) on the Moon and Pluto.
- `world.getVistas(bodyId)`: the first vista of each biome (`<body>-<biome>-1`, same ids as
  before) is now that easel and carries `yaw` and `pitch`; second sites follow as before.
- `world.sampleObstacles(bodyId, unitDir, radius, soft)`: `soft === true` also lists bushes
  (`kind: 'bush'`); default unchanged. Hanging vines are never listed.
- `src/render/index.js` also exports `makePaintUniforms(bodyUniforms?, own?)` and the three
  scene chunks `VERT_PARS`, `VERT_END`, `FRAG_PARS` (for PHYSICS' kits).
- `looks.js` biome fields: `under` (own undergrowth washes), `twilight`, `hour`, `want`,
  `hang`, `t.fog`, `t.strata` and the recipe parameters; body fields `deck` (cloud deck from
  outside: height, belts, wobble, colours, streaks, storm) and `fine` (one more terrain level).
- Spawns moved on every body except Earth (the search now wants level, dry ground out to
  13 m); Jupiter has hand-placed sites now and its spawn stands on a sky-island. Every
  landform changed: PILOT's landings and the trip need re-running.
- Gallery: `cam=vista` uses the kept easel; without `time=` the biome's `hour` applies (only
  Mars' dunes name one: 16.2 h); `cam=orbit` over a banded world stands over the low latitudes;
  `cam=orbit&biome=storm_wall` centres Jupiter's Great Red Spot.

## Answers to the lead (review 3) and to PILOT's numbered needs

- **MUST FIX 1, Neptune's spawn 727 k**: fixed. Gallery, standing at the spawn: 318 k triangles and 174 draw calls at quality 1, 165 k at quality 0 (the lead measured 727 k in the game before; PILOT's tour now reads the game's own counters at each stand, below).
  Every view measured is in the table above; the densest is Earth's home forest.
- **SHOULD FIX 2, `world.busy` never drains after a change of body**: fixed and tested
  (`src/world/busy.test.mjs`: Earth, Mars, Neptune, Mercury, Earth again, then deep space; and a
  body left with work queued). A body that stops being the active one drops its queues on the
  next update.
- **SHOULD FIX 3, `world.update` 8.5 to 9.4 ms while building**: the cause was a full terrain
  slice plus a flora step in the same frame. They now take turns and a flora step starts only
  if it fits. Counted in work (surface samples, in Node, where machine load does not hide it)
  the heaviest frame of an arrival is about 4.2 ms at the 5 ms budget; wall-clock spikes above
  that remain on this shared machine (scavenges and pre-emption), so a real GPU run is still
  owed. The test asserts the counted figure.
- SHOULD FIX 4 (Venus' fungal towers too busy): not repainted in this pass.
- SHOULD FIX 5 (Neptune's storm sea is calm): the sea now has stacks standing in it; the storm
  is weather (M3).
- PILOT 4 (ceiling): tested for all ten bodies. PILOT 5 (liquid edges): unchanged mechanism
  (a berm closes each liquid at the edge of its group); pools on terraces switch level on a
  dry rim, never on a wall. PILOT 6 (spawns): tested dry, under 0.12 rad at the spot and under
  0.30 rad out to 12 m on the eight planets, Moon and Pluto. PILOT 7 (vistas): the first vista
  of each biome is a spot I stood on; markers are not painted yet (M3). PILOT 8 to 11: M3,
  nothing delivered yet.

## For PHYSICS (complete on its own)

Your six gaps:
1. *No public constructor for the uniforms `FRAG_PARS` needs*: `makePaintUniforms(bodyUniforms?,
   own?)` from `src/render/index.js` (commit `ebd9b4d`). Pass `world.bodyUniforms(bodyId)` to be
   lit and hazed like that body.
2. *Chunks not re-exported*: `VERT_PARS`, `VERT_END`, `FRAG_PARS` are exported from
   `src/render/index.js`.
3. *An opaque pass cannot glaze*: agreed, and it is mine to solve. Plan for M3: kits write the
   **change of pigment density** they cause rather than ink of their own. Ground marks go
   through the terrain itself (I take your ground-mark field as a texture around the focus and
   darken, lighten or wet my own wash in the terrain shader, so a print in litter is litter
   pressed down, not a brown blot). Airborne kinds (dust, spray) get one small blended target
   that the abstraction pass multiplies in. Your ground-material tag on every particle is what
   I need for the first; keep it.
4. *The 3 px floor of the post pass*: by design (art bible 4: detail becomes brush-sized
   shapes). Rain will be drawn as a few broad slanted strokes and a veil on the far bands,
   snow as soft dabs of bare paper, both at sizes that survive; your size floor is right.
5. *Waves*: yes. My liquid material will take your chunk (displacement, slope, crest, foam
   measure, wakes) as an include; it already has per-vertex liquid look (colour, mirror, glow,
   cloud) and reflects the previous frame.
6. *Nothing reads the weather*: first M3 block, in the coordinator's order: sky, haze and
   sheet from `setMood.sky` (`cloud`, `overcast`, `haze`, `fog`, `dust`, `flash`), then ground
   washes (`wet`, `snow`), then waves, then the kits.

Your earlier needs: (2) ground words: keep yours. (3) Cloud seas carrying the explorer as a
froth: fine with me. (4) Ground under a cloud sea lies 40 m below it and under lava about 3 m;
both liquids are opaque, so it is never seen from above; it would be seen by anything that
sank. New liquids in this pass: ponds on Neptune's tundra (`aurora_tundra`, shallow water) and a
pool on every tread of Venus' acid terraces, each at its own level. New ground you may want
words for: `polar_frost` is terraced ice scarps now; `ice_spires` low wind-scoured ridges;
`storm_wall` a great cliff with a talus skirt; biome ids are unchanged.

The material contract for a kit is unchanged: one opaque pass into two targets, holes by
`discard`; output 0 `vec4(wash, wetness)` (wash = transmittance over paper, 1 = bare paper),
output 1 `vec4(viewNormal.xy, log2(1 + viewDepth), regionId)` (0 sky, 1 ground, 2 liquid,
3 solid prop, 4 foliage, 5 characters); call `pcWrite(col, wet, nV, -viewPos.z, id)`; set
`material.userData.pcPainted = true`.

## How to use my modules

```js
import { createPainter, RENDERER_OPTIONS, makeWashMaterial, makePaintUniforms } from './src/render/index.js';
import { createWorld } from './src/world/index.js';
import { createExplorer, createShip } from './src/art/models.js';
```
- `world.busy`: pending build jobs (terrain + flora), 0 when nothing is left to build for the
  current camera. `world.setBuildBudget(ms)`: the building slice inside `update` (default 5).
- `world.getLighting()` -> `{ bodyId, sunElevation, hours, dayness, altitude, space01 }`.
- `world.sampleSurface` adds `liquidRadius`, `canopyHeight`, `canopy01`.
- `world.sampleObstacles(bodyId, unitDir, radius)` -> `[{ unitDir, radius, height, kind }]`,
  within `radius` metres (max 60), unsorted.
- Quality tiers scale flora ranges (0.42 / 0.82 / 1.0) and the terrain split factor; tier 0
  also draws no full trees and 55 % of the undergrowth.

## Gallery URL parameters (C13)

`gallery.html?body=earth&biome=temperate_forest&quality=1&cam=vista&ui=0&t=0`
- `cam`: `vista` (the kept easel of the biome), `stream`, `trees`, `canopy`, `jet` (30 m up),
  `high` (420 m), `orbit`; `time=` hours (default 12, or the biome's `hour`)
- `t=0` freezes wind and drift (deterministic frames); `ui=0` hides the panel
- `view=1..5`: scene colour, wetness, normal + depth, regions, abstraction
- `dx, dy, dz` (metres), `yaw`, `pitch` (degrees) nudge the camera; `scale`, `fov`, `models=1`,
  `physics=1`, `look=pooling:1,granulation:1,wobble:2.6,graphite:0.4,border:1,abstraction:1,bleed:0.8`
- weather: `wx=fair|overcast|rain|storm|after|blizzard|snow|dust|fog` or `sky=cloud:0.9,..`
  force the sky numbers; `physics=1&wtime=<s>&pre=<s>` runs PHYSICS at that time on its clock
  after a pre-roll (the Earth spawn's thunderstorm is 640 to 800 s; `skye.mjs` finds others);
  `fresh=1` fresh snow already lying; `kits=0` no rain, snow, dust or marks; `models=1` with
  `walk=<m/s>` (the explorer walks in during the pre-roll), `mdist=`, `sdist=`, `hover=<m>`,
  `wash=<newtons>` (the ship's downwash), `push=0` (nothing pushes the grass)
- models (`models=1`): explorer `pose=idle|walk|jet|fall|wade|sit`, `speed=`, `phase=` (radians
  of the stride), `jet=`, `lift=<m>`, `mface=<deg>` (turned to the right of the view; 0 shows
  its back), `epitch=`; ship `smode=landed|hover|fly|pulse`, `gear=`, `canopy=`, `throttle=`,
  `sface=<deg>`; `cockpit=1` the view from the ship's seat (fov 62, near 0.12 m);
  `near=0` hides the near ground strokes
- space: `cam=orbit&odist=<radii>` (how far out, default 2.6), `chase=1` (the ship ahead of
  the camera, flying where it looks; `cdist=`, `cdown=`, `cside=`), `smode=pulse` (streaks),
  `speed01=<0..1>` (the mood's speed); lightning: `wx=storm&sky=flash:1`
- `window.__pcReady` once terrain and flora have settled and three frames are painted (and,
  with `physics=1`, once PHYSICS and its kits are loaded);
  `window.__pcVantage` the easel in use.

## Decisions

- **Colour model**: every scene colour is the transmittance of a wash over paper; layering
  multiplies; the sheet pass multiplies by the paper colour.
- **Pipeline**: scene MRT -> half-res prep -> abstraction (mip Kuwahara, wet-in-wet bleed) ->
  sheet (wobble, pooling, granulation, graphite, ragged border, paper). Only the paper is
  anchored to the screen.
- **Marks are 3D** (this pass): anything laid on the ground or on rock comes from noise
  anchored to the planet in three dimensions; the 2D stroke atlas is kept for bark (along the
  trunk) and for the crack network (looked up through a warp).
- **Form may be baked**: slip faces, cliff faces, cut banks and the undersides of cliff lips
  carry a second, cooler wash in the vertex colour, so landforms read at noon as well as in
  raking light. Strata are computed in the shader from the height.
- **Terrain**: cube-sphere quadtree, 32 x 32 patches, geomorph, skirts, resumable generation;
  patches holding much relief for their size split from further away.
- **Biomes**: hand-placed sites (Earth, Mars, Saturn, Jupiter) or a jittered Fibonacci sphere,
  warped Voronoi, about 280 m blends; liquid keeps its true level inside its group.
- **The easel is data**: found by search, looked at, kept (`src/art/easels.js`); the same
  spots are the game's vistas.
- **Time of day**: light keys blend by the sun's elevation at the camera; a biome's `twilight`
  moves the day key toward dusk and night (ring shadow, storm wall, shadowed craters).

## Ideas and critique

- (self, blunt) The gallery frames are chosen views. In the game the explorer faces wherever
  the ship was parked, so a biome's picture depends on PILOT's camera; see "Needs".
- (self) Foregrounds are still the weak half of most frames: one broad wash with a few marks.
  The next thing to paint is near ground: stones, tufts, cast shadows of the tall kits.
- (self) Tall rock kits (spires, crystals, waves) are single smooth forms with one wash each;
  up close their tone steps are soft but they have no crevices. Frozen waves still read as
  mounds from behind.
- (self) Distant cliffs lose their local colour to the cool haze on the warm-skied planets
  (Jupiter's islands and storm wall go grey-green); the haze should lean toward each sky.
- (to PILOT) The third-person camera looks at the ship from wherever the explorer lands. A
  landscape wants the explorer small in the lower third and the land ahead: if the camera sat
  a little higher and looked past the explorer toward the open side, every arrival would be a
  better picture.
- (to PHYSICS) Grass at 47 degrees in a breeze is too much for a painting: a field that
  leans that far reads as flattened. I will scale the bend I draw (not your model) in M3.

## Tests

`node --test src/world/*.test.mjs`: 19 tests: the 12 of M1 (noise, cube-sphere, biome coverage,
`sampleSurface` purity, Earth spawn, liquid, vistas, patch edges, mesh and sample agreement,
ceiling, flora determinism, obstacles), and new: every planet's arrival place is level and
dry with room for the ship; `sampleSurface` under 0.05 ms a call on every body; every kept
easel stands on dry ground of its own biome and is that biome's first vista; every vista is a place a walker can stand; `world.busy`
reaches 0 at the spawn, after every change of body and in deep space; jobs of a body just left
are dropped at once; the heaviest frame of an arrival fits the building slice.

## Earlier answers (first PAINTER agent, M1; kept for the record)

- Lead review 1, MUST FIX 1 to 3 (frame cost, stippled foliage, ruler-straight lines): fixed in
  `b2bfcae`, closed by lead review 2. Every tree is submitted once in the tier its distance
  puts it in (near about 650 triangles, mid about 180, far 26); crowns are a few overlapping
  washes; trunks lean and bend; the brook's bank wanders; trees stand in clumps.
- PHYSICS wiring of the flora field: done in `1e1801e` (`world.setPhysics`; undergrowth uses
  the full bend, bushes and near trees the lite one). `FLORA_PHYS` (plant height and stiffness
  per kit) is exported from `src/world/florakit.js`.
- PILOT: `hatch` is on the ground 2.3 m left of the ship's centre line, `seat` at
  (0, 1.75, -1.3); `sampleObstacles` shares the placement cells with the painted flora.
