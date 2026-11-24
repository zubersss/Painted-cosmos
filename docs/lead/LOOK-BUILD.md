# LOOK BUILD: the look director's build lane, state and hand-over (group F)

Branch `look-director`. Kept current after every step, because the container can restart. The plan, the rules and
the faults are in `docs/lead/LOOK-AUDIT.md` and `docs/lead/LOOK-RULES.md`.

## The go-ahead (the coordinator, 24 Nov)

In this order, each step its own commit, behind a switch where the picture changes, A/B stills opened at the standard
set S1-S6 (LOOK-RULES R8) plus night and from the air, the three suites green, lookstats numbers, a short message to
the coordinator after each step:

1. L0 one air chunk (bit-identical, proved).
2. T1 the sky ceiling from the weather design (`origin/design-weather`, docs/lead/WEATHER-DESIGN.md 4.2 A1 and 8.4
   T1): the sky stays blue to about 2.8 km above the land; the clouds hooks D asks for in world/index.js. Check night,
   the aurora and the climb to orbit on Earth, Mars and Neptune.
3. L1 the night key.
4. L2 one foliage shade + L7 quiet darks (the one-line swaps in other groups' lines of materials.js allowed, one
   commit, lines named; tell the coordinator the commit so the other lanes rebase).
5. L3 one light (`pcLit`) with the figure's and the creatures' shadow (same permission).
HELD: L5 and L6 (until the far-view group's design is in), L4 (the morning: the owner sees it first), L8-L10 after.
Also: review requests from the other groups' builders (the 15 checks; a group fails only where its B is worse than
its A).

## THE SWITCH `?light=old` (24 Nov; the owner: "No do make it look different")

The night key (L1), the foliage shade and quiet darks (L2 + L7), one light (L3) and the sky's ceiling with the air's
top and FV1 (T1 reworked) are ON by default. `?look=oil&light=old` turns all of them off together: the oil look
exactly as it was before them (the proof: the six standard stills against look-proto, pixel by pixel, below), for
the owner to compare. Each part keeps its own switch either way. L0 (bit-identical) is always on. L5 (the air from
the air) is OFF until it passes the coordinator's eye (`?airfar=1`). L6 is off (`?shadehue=1`). (An opt-in
`?light=new` was built first and replaced the same hour by the owner's word.)

| what | the new look | the "before" |
| --- | --- | --- |
| everything | `?look=oil` | `?look=oil&light=old` |
| L1 the night key | on | `&nightkey=0` |
| L2 + L7 the foliage shade and quiet darks | on | `&leafshade=0&postdark=0` |
| L3 one light (figure, creatures, bark, rock) | on | `&onelight=0` |
| T1 + the air's top + FV1 (the sky from the air) | on | `&skyceil=0&airtop=0` |
| L5 the air from the air | on | `&airfar=0` |

**THE PROOF (24 Nov):** the six standard stills (S1-S6, gallery, 1024x480, quality 1, lite), one browser, an export of
origin/look-proto 3408e03 against look-director 7dae2f2 with `?look=oil&light=old`: S1, S2, S3, S4 and S5 identical to
the pixel (0 of 491,520 differ); S6 (Neptune at night) 12 pixels differ by at most 1 of 255, the software renderer's
run-to-run noise (L0's proof saw the same). No page or shader error. So `?light=old` is the oil look as it was.
The new look by default in the same merged tree, opened: S1 (build/S1_new_look_default.jpg, against
build/S1_light_old.jpg) is the reworked picture (crowns as fiery, banks a quieter sage); 150 m (build/airtop/
c150_down_old_over_new.jpg, top the old sky, bottom the new) now has its painted sky, blue with its clouds down to a
pale band at the horizon, where the old one is a flat lavender band.

## How the stills are taken (so a later session can repeat them exactly)

- The scratch tools live in the session's scratchpad and are lost on a restart; what they do: `tools/lab.mjs serve`
  in the tree to shoot, then for each line of a list `open` the gallery at 1024 x 480 with
  `look=oil&ui=0&t=0&lite=1&quality=1&cam=<view><extra>`, `hold`, then for each hour
  `eval world.setTime(body, h)` and `grab out.png 2`. The standard list (S1-S6, plus S3 at night):

      earth autumn_woodland stream &season=1 16.8
      earth temperate_forest vista - 12
      earth autumn_woodland jet &season=1&dy=30&pitch=5 12,23
      earth autumn_woodland high &season=1 12
      earth temperate_forest stream - 23
      neptune aurora_tundra stream - 23

- A side: a clean copy of the commit before the step (with the one-line `bareGeometry` fix until v37.1 is on
  look-proto, or Neptune does not load); B side: the working tree. Pixel identity is checked with numpy on the PNGs.
- The Neptune fix (`bareGeometry(seed, lod, spec)`, florakit.js:76 and :804) is in look-proto as v37.1 (2bd8f85),
  and look-proto (v38, f1bfcf6) is merged into this branch (a merge, not a rebase, because other lanes were told to
  build on this branch's commit ids). After the merge: suites 325 / 70 / 416; the autumn wood at 16.8 and 23 with the
  explorer and Neptune at 23 load and draw with no page error. Commit by naming paths, never `git add -A`.

## State

| step | state | commit | what was seen |
| --- | --- | --- | --- |
| L0 | DONE | see git log (`[painter] L0`) | 7 stills (S1-S6 + S3 at night) against v37: 6 identical to the pixel, 1 with 2 pixels off by 1 of 255 (the 275 m night still); the shader text of all 36 materials of the autumn wood (comments and spaces taken out) identical, the 9 plant shaders with `pcFogAmountV` included, so those 2 pixels are the software renderer's run-to-run noise, not the change. Suites 325 / 65 / 416 pass. |
| T1 | DONE, REWORKED as THE AIR'S TOP (+ FV1) | see git log (`[painter] T1`, then `[painter] The air's top`) | see the T1 section below and its AIR'S TOP part; stills in build/T1 and build/airtop |
| L1 | DONE | see git log (`[painter] L1`) | see the L1 section below; stills in docs/shots/painter/look-director/build/L1 (_A off, _B on) |
| L2 + L7 | DONE, REWORKED | see git log (`[painter] L2 + L7`, then `[painter] L2 + L7 reworked`) | see the L2 + L7 section below (and its REWORKED part); stills in docs/shots/painter/look-director/build/L2-L7 and L2-L7-rework |
| L3 | DONE | see git log (`[painter] L3`) | see the L3 section below; stills in docs/shots/painter/look-director/build/L3 |

## T1, the sky ceiling: what was built and what was seen

- `src/world/index.js`: `SKYCEIL` (`?skyceil=a,b` metres for every world; `?skyceil=0` the sky as it was; oil look
  only), `skyCeiling(body, look)` (a look's `weather.ceiling` row if it has one, else 3.5 and 7.5 of the world's own
  atmosphere: Earth 2,800 / 6,000 m, Mars 1,575 / 3,375, Neptune 3,500 / 7,500, Pluto 420 / 900), `skySpace01`
  (the eye's height above the LAND through that ceiling). It replaces `space01` for: the sky (`uAtmo.x`), the aurora
  (`uAurora.x`, `uAuroraK`), the moon on the land, the night key, the dusk and night grade, the far air under a
  closed sky, the ring painted in a ringed world's sky, the ring mesh's visibility, and `lighting.skySpace01`.
  NOT for: the weather numbers (`air`), the ground's own air (`air01`: L5, held for the far-view design), the limb,
  the dust in the near air, the leaves in the air.
- The weather group's hooks (WEATHER-DESIGN 8.4 T1 b-d): `CLOUDS3D` (`?clouds3d=`, default 0 until group D's first
  commit flips it, one line, with F's leave), `askWeatherModules()` fetching `./clouds.js` (`createClouds(scene)`)
  and `./wxfield.js` (`createWxField()` or a module with `update`) on first use; per frame
  `wxfield.update(physics.fields)` and `clouds.update(dt, camLocal, root, sunDirL, fields, skyU)` beside the sky
  uniforms; `G.uAirNear.x = max(dust, clouds.eyeInCloud01)`; `world.clouds` for render/index.js (T5).
- On the ground and at 420 m nothing changes (both numbers are 0 there), so the review's standard set is the same.

**SEEN (27 stills, A = `?skyceil=0`, B = the ceiling on; all opened):**
- Earth over the autumn wood at noon from 1,020 m and 2,020 m: A is a black starfield with purple wisps over a sunlit
  land (the old fault); B a pale day sky. At 3,520 m B is still a pale sky (looking down steeply, the planet a ball in
  it), at 6,020 m B is space with stars, the same as A; from orbit A and B are the same. So the climb now goes: day
  sky to 2.8 km, a gradual turn, space by 6 km.
- The golden hour from 1,020 m: B a flat beige sky (the far air's khaki of audit F6, now seen instead of space).
- Night from 1,020 m: B a blue night sky with streaks and stars; looking level, Neptune's aurora stands over the
  horizon at 1,020 m and 2,020 m (A: space, no aurora). The land under it is now in the night key, so it shows the
  night fault F1 (lemon and orange at full strength): that is L1's.
- Mars from 1,020 m: B its pale salmon day sky (its own ceiling 1,575 / 3,375 m).
- STILL TO WATCH, said plainly: between 920 m and 2.8 km the LAND's own air has already gone (air01, not moved: L5)
  while the sky stays a day sky, so the far land is crisp and saturated under a pale sky; in these stills the far land
  fades into the sky's band at the limb and does not read as a cut-out, but the far-view group and L5 should look at
  this pair together. The ball in a pale sky at 3.5 km is the in-between of the climb; the weather group's orbit shell
  (their A8) takes over above 2.8 km.

### THE AIR'S TOP: T1 REWORKED, FV1 FOLDED IN (the coordinator's review of T1: the day sky from 1 to 3 km was one flat pale grey-blue)

- WHY IT WAS FLAT: Earth is 4 km across, so from a mile up the horizon stands 44 degrees below level (the dip,
  acos(R / (R + h))). The sky laid its bands from LEVEL, and everything between the true horizon and level was the
  flat band of haze laid under the horizon -- which from the air is nearly all the sky one sees.
- `world/index.js` `AIRTOP` (`?airtop=0` is T1 as committed): (1) the sky goes to space by the dip, a day sky to
  52 degrees and space by 66 (Earth 2.5 and 6.0 km; at the mile the dip is 44); a world's `weather.ceiling` row and
  `?skyceil=a,b` still name heights. (2) `uSkyAir.z`, the true horizon as dot(view, up), eased in from a dip of 20
  to 36 degrees (Earth 257 m to 944 m): `sky.js` lays its bands, strokes and low air band from there; the cloud
  sea, the aurora's and the rain's directions keep the true angle (`eR`). (3) FV1, where a look sets
  `oil.airTop` (Earth only): the ground's air and `space01` by the dip 46 to 59 degrees (Earth 1.76 to 3.68 km,
  FV1's four times), the cloud deck with the sky's own turn (52 to 66), the relief rounding from 0.6 radii, the
  visibility growing 1.2 m a metre over 160 m to 1,640 m more.
- DERIVED: at 160 m and below every number is what it was (dip under 20 degrees, the visibility term 0), so on
  foot and over the wood nothing moves. At 420 m (the standard S4 still) the visibility grows by 312 m and the
  bands are laid a fifth of the way from the true horizon: see the S4 pair.
- SEEN (opened), Earth autumn wood, noon, A `?airtop=0` against B: at 1,620 m (the mile) A is one flat pale
  grey-blue (S 0.10 looking level), B a sky that deepens to blue overhead in painted bands down to a pale band at
  the limb (S 0.54 level, 0.36 looking down 29 degrees); at the golden hour A is flat beige, B a warm sky graded
  in bands; at 2,420 m the same (A S 0.10, B 0.54); at 1,020 m B is the same painted blue; at 3,520 m B is the
  turn begun, the sky deepening toward indigo (sky 0.38), the world a small ball below.
- S4 at 420 m (A over B opened): the same picture but for a band of the painted blue now at the top of the frame;
  the land does not move to the eye (the visibility grows 312 m there); S 0.10 -> 0.15, V over 0.90 5.1 -> 5.8 %
  (both over C6 before this change). The sky at 420 m is still mostly the flat band: the remap is only a fifth in
  at that height. Starting it lower (a dip of 10 degrees, Earth 62 m) would paint the sky from 150 m too; held,
  for the coordinator's word, because it moves the over-the-wood view the owner has seen.
- STILL WRONG, said plainly: under the thick air FV1 keeps to 1.76 km the land at the mile is pale and pastel
  (L5's job: a share of far paint kept and the air's hue); at 1,020 m a thin pale arc and some lilac wisps stand
  near the limb (the sky's own cloud layer seen from above and the low band's stepped edge; not yet traced); the
  golden hour's sky is warm but still khaki-leaning (F6, L5). Only Earth was looked at; other worlds keep T1's
  heights for the ground (no `airTop`) and take the dip for the sky.
- Stills: docs/shots/painter/look-director/build/airtop (c<height>_<down|level|gold>_<A|B>.jpg, and two
  side-by-sides).

## L1, the night key: what was built and what was seen

- `chunks.js`: `pcNight(c)` (by the moon only: the colour part of the way to its own value in the night key's hue;
  `uLookN.y`), taken by `pcBody`, so every paint built on a body colour is in the night's key, including the five
  private foliage shades of audit F4 (they call `pcBody`); `pcTone` pulls the colour once for its lit paint and lays
  the lit and local paints at the night's strength (`uLookN.x`). `uLookF`, `uLookN` declared in VERT_PARS and
  FRAG_PARS. `post.js`: the night's warm excuse taken from the lantern's reach (depth against `uLampV`, 4.5-6 m) and
  region 8, not from the hue. `shared.js`: `OIL.uLookF` (x night key, y/z/w for L2, L3, L7) and `OIL.uLookN`.
  `world/index.js`: per world 0.60 / 0.45, or 0.85 / 0.20 for a world with its own night key (Neptune); a look's
  `oil.night.v` / `.c` overrides.
- FOUND ON THE WAY: the first build left the autumn leaves at full orange by night, because at night most leaves fall
  to the shade level, and the leaf shade is one of F4's private copies, which bypassed `pcTone`. Putting the pull in
  `pcBody` reaches them without touching their lines (L2 then makes them one function).
- The A/B is taken from ONE page, flipping `OIL.uLookF.x` between grabs. By day nothing moves (uMoon is 0); the only
  day differences seen are on the stream (at most 3 of 255), which mirrors the previous frame, so two grabs in a row
  differ there by themselves.

**SEEN (26 stills, A = `uLookF.x` 0, B = on, each pair from one page; all opened), median V by lookstats:**
- Autumn wood on foot at 23:00: lemon grass and orange leaves at full strength -> blue-green moonlit grass and dull
  wine-red leaves; V 0.54 -> 0.32 (the golden hour is 0.42: the night is now the darker of the two); S(V<.3) 0.53 ->
  0.45. At 275 m by night: V 0.67 -> 0.45, the crowns plum, the meadow blue-grey. The green wood: V 0.51 -> 0.27.
  The coast: the bank from cream and orange to mauve-grey. Mars: the orange floor to a violet-blue (0.61 -> 0.35).
  Pluto: a step down (0.60 -> 0.44), so its night parts from its day. NEPTUNE, the night the owner liked: 0.57 ->
  0.56, by eye the same picture (its own gentler numbers).
- By day nothing moves: S2 at noon identical to the pixel; S1 at 16.8 differs only on the stream (at most 3 of 255:
  the water mirrors the previous frame). Dusk at 18.4 (moon 0.32): a breath darker (V 0.42 -> 0.40).
- The lantern (the gallery's `models=1`, the explorer 5 m ahead): its warm pool stays gold on the bank with the key
  on; the cloak keeps its blue.
- LEFT AS IT IS (not this step): by night the stream is now the lightest and bluest thing in the wood, because water
  is not painted through pcTone; group E's (LOOK-RULES R1.2c, C11). Neptune's lake by night is still the loud
  green-and-navy field (audit, Neptune).

## L2 + L7, one foliage shade and quiet darks: what was built and what was seen

- `chunks.js` `pcShadeLeaf(c)`: the recipe the five copies shared, once, then half of it at its own value in a
  breath of the cool key's hue (luminance kept), lifted a tenth; `uLookF.y` 0 the recipe as it was. THE ONE-LINE
  SWAPS IN OTHER GROUPS' LINES (materials.js at this commit): 489 (TERRAIN_FRAG pcGroundPaint, the green dabs'
  shade: group C), 1839 (PROP_VERT `deepL`, a leaf: group A), 2207 (PROP_FRAG `deepF`, crown dabs: group A),
  2943 (NEAR_FRAG `deepO`, the near ground: group B). The watercolour crown's variant (`pcDensity(c, 1.45) * ...`,
  only by day in the watercolour path) is untouched.
- `post.js` OIL_FRAG (L7, `uLookF.w`): the S laid on the value and the colour scaled to it, never above where the
  old S took the brightest channel (without that cap the share of S2 over V 0.90 grew 4.1 -> 4.8 per cent; with it
  4.1 -> 4.0); the colour push measured by the real saturation and faded out under V 0.30.
- SEEN (22 stills, A both off, B both on, one page each; all opened): S(V<.3) by lookstats, A -> B: autumn wood
  16.8 0.55 -> 0.35, its night 0.45 -> 0.34, green wood noon 0.42 -> 0.29, its morning 0.58 -> 0.31, its night
  0.45 -> 0.34, 275 m 0.27 -> 0.13, alpine 0.36 -> 0.26, Mars 0.59 -> 0.46, Venus 0.72 -> 0.45, Neptune night
  0.86 -> 0.72. The lights keep their colour (satL 0.48 -> 0.47 on S2, 0.37 -> 0.35 on S1) and the share over V
  0.90 does not grow anywhere. By eye: the golden hour's shaded leaves and banks go from lurid red-brown and acid
  green to a deep, quieter red and olive (the approved picture moves: the owner should see S1 A/B); the crowns at
  275 m lose their maroon; Neptune's night is the same picture with the snow a breath less bright.

### L2 + L7 REWORKED (the coordinator's S1 review: "S1 golden hour lost its fire")

The coordinator held L2's leaf part from look-proto: in S1 B the crowns went dull brown-maroon and the bank murky.
Measured on S1 in three states on one page (A0 both off, A1 L7 only, B both), warm crown pixels (hue under 50 or
over 340, S over 0.35) in the top right of the frame:
- the FIRST L2 did not touch the crowns at all once reworked (A1 and B crowns identical); the fire was lost in
  L7: laying the S on the value dimmed every saturated middle value (crowns V 0.54 -> 0.49, S 0.73 -> 0.68),
  because the old per-channel S is what lifted a red's top channel, and measuring the push by the real
  saturation took most of the push off every saturated middle value.
- `pcShadeLeaf` now keeps the recipe as it was (value down, saturation held or up) for every hue but the acid
  greens: a green past hue ~70 that comes out over S 0.55 is pulled toward its own value in a breath of the cool
  key's hue only as far as S 0.55, and lifted by 0.6 of that pull so it sits in the shaded grass's band and does
  not sink into murk.
- `post.js` L7 is now the darks' step only: under V 0.30 the S on the value, over 0.50 the old S exactly, a blend
  between; the push measured as before and eased to 0.4 of itself under V 0.20, back in full by 0.40.
- MEASURED S1 (A0 -> B): crowns warm S 0.73 -> 0.71, V 0.54 -> 0.54, share 61 -> 59 %; the far bank's greens
  S 0.90 -> 0.56 at V 0.21 -> 0.21, the near bank's 0.91 -> 0.58 at 0.24 -> 0.24; whole frame S(V<.3) 0.51 ->
  0.41, V over 0.90 0.6 -> 0.6 %. SEEN (opened): the crowns' reds and oranges as A0's; the banks a quieter sage
  green under the same orange leaf litter, at the same value. S2 (green wood, noon): the lit grass keeps its colour
  (satL 0.56 -> 0.55), the shaded hillside goes from a lurid dark green to a quieter sage (whole frame S 0.69 ->
  0.52, S(V<.3) 0.39 -> 0.30), V over 0.90 3.4 -> 3.4 %. S5 (green wood, 23 h): the same picture, the bank a breath
  greyer (S(V<.3) 0.45 -> 0.36), and the few cool lilac strokes along the grass tops (the coordinator's L1 note)
  are still there. Stills (A0, A1, B, and S1 A0 over B): docs/shots/painter/look-director/build/L2-L7-rework.

## L3, one light: what was built

- `chunks.js`: `pcLit(x, sunny, canopy, soft)` in PAINT (the ground's own formula); `pcSunAtView(viewPos, lift)`
  as its own piece `SUN_VIEW_SRC` (included in FRAG_PARS; the creatures' vertex shader takes it with its own
  declarations); `uShV`, `uSunV` declared in FRAG_PARS. All behind `uLookF.z` (`?onelight=0`).
- materials.js (lines at this commit, other groups' code, one-line swaps with the coordinator's leave): the bark's
  base paint and its streaks, the crown dabs (with their floor kept as a level), the rock; FIG_FRAG (the explorer:
  shadow read at its place lifted 0.8 m toward the sun, its rim the sun's). beastmat.js: the painted pieces (fragment)
  and the flat pieces (vertex), lifted 1.4 m. The ground is the reference and is not touched; the leaves are not
  swapped (in shade they already fall to the one foliage shade whatever their level).
- Tests: 325 / 65 / 416; one run of the physics suite showed 1 failure while the browser was loading all four cores
  and did not repeat in two reruns (416 / 416): a timing-sensitive test under load, not this change (physics reads
  none of these files).

**L3 SEEN (18 stills, A = `uLookF.z` 0, B = on, one page each; all opened).** The explorer in the gallery
(`models=1`, the vista at 16.8) stands at the edge of a tree's shadow: A paints its cloak in full sun beside a shaded
floor; B shades it with the floor (the cloak a deeper blue, still the strongest colour), and the ship's hull with
it. The big trunks' sun sides in the floor's shadow come down to the floor's value (S1 and the vista: 25,000 to
50,000 pixels change, the trunks only). The 275 m view, Mars' spires, the green wood at night and Neptune are the same
to lookstats' two decimals. NOT SEEN: a creature in frame (`beasts=1` put none in view); their two changes compile
and are the same call as the explorer's. Lines at this commit: materials.js 2134 (bark base), 2169 (bark streaks),
2207 (crown dabs), 2347 (rock), 2705-2706 (FIG_FRAG); beastmat.js 536-537 (flat pieces, vertex), 609-610 (painted
pieces).

## PROPOSED, NOT BUILT: the bark lit the right way round (found by A2, 24 Nov)

Every tube in the plant kits (kitbuild.js tube: every trunk and bough) is wound with its front facing INWARD (A2
counted in Node: 953 of 954 wood triangles of a roundmaple, 1912 of 1924 of a birch). The trees are drawn
DoubleSide in the oil look, so the eye sees a back face, and PROP_FRAG's bark branch turns the normal round
(`if (!gl_FrontFacing) nV = -nV`): TODAY'S BARK IS LIT WITH ITS NORMALS POINTING INTO THE TRUNK, the sun side
painted as the side away. A2 saw it the right way round by accident (its BackSide wood program: birches cream on the
sun side at noon where today's are an even lilac) and put the old facing back (PC_WOOD_FLIP) so its A/B stays the
same picture. Flipping it is one line in PROP_FRAG and dropping that define, in one commit, but it changes every
trunk in the approved picture: it wants A/B stills (S1, S2 at noon, the 275 m view) in front of the coordinator and
the owner first. Not started.

## L5, the air from the air: built and seen (ACCEPTED by the coordinator 24 Nov; on by default, `?airfar=0` or `?light=old` off)

- `chunks.js` pcFogAmount: from the air (OIL.uLookN.w, set by world/index.js from the air's reach: 0 on foot, 1 by
  the air's) the distance is taken 1.4 times instead of 2.4, and a share of 0.16 of the far land's own paint is kept
  at the horizon by the same knee the ground uses; SHADOW.air (the lit air's twin in world/index.js) changed with it.
  pcAtmosV and sky.js pcSkyAir: from the air the far air's gold lies toward the sun and its blue-violet away from it
  and deeper with distance, where one fixed mix of the two made khaki (F6). In the sky only the air band at the
  horizon takes the split: laid through the sky's own bands it flattened the painted sky to one periwinkle (seen,
  fixed in 9a9bc1e).
- SEEN (opened; A `airfar` 0, B 1, same page; build/L5/L5_sheet_off_left_on_right.jpg): 150 m the land deeper and
  less washed (S 0.35 -> 0.46), the sky as it was; 420 m noon the far wood and the hills keep more of their own paint
  (S 0.32 -> 0.36, satD 0.16 -> 0.30); 420 m at 16.8 the far land warmer toward the sun and the band at the limb
  blue-violet away from it (khaki less, not gone); the mile the peaks and the meadow a step deeper and more modelled
  under the same painted sky. On foot S1 is identical to the pixel with it on (0 pixels differ). V over 0.90 moves at
  most 0.8 of a point. NOT fixed by it: the mile at noon is still pale (FV1's thick air lasts to 1.76 km), and the
  golden-hour sky itself is still one warm ochre wash -- that is the sky's own gold key, a separate step.

## The golden hour's sky (24 Nov; the coordinator's ruling (b))

- Old: one gold wash all round the dome (0.80 of it low, 0.45 high), so from the air every direction was the same flat
  ochre. Four tries were built and seen (rings by the angle to the sun, glazed over the bands); the third and fourth
  painted the air well but from the ground at S1, which faces away from the sun, the approved golden-hour still lost its
  warm sky. Ruling (b): on the ground the wash holds; the rings come in with height.
- sky.js (`?goldsky=0` the wash everywhere; on unless `?light=old`): five rings by the angle to the sun, edges a pixel
  wide and wandering: pale gold by the sun, gold, peach, cool lilac, and away from the sun the sky's own blue a step
  deeper; each ring a glaze that keeps the value of the bands and clouds under it; a rose band low on the far side.
  Mixed in by uSkyAir.w (world/index.js: a dip of 10 to 17 degrees, Earth 62 m to 180 m, as the sky's remap).
- SEEN: S1 with it on is identical to the pixel to S1 without it (0 pixels differ): the warm sky over the fiery crowns
  is today's. At 420 m (build/goldsky/b_420m_toward_then_away_old_left_new_right.jpg): toward the sun lilac, peach and
  gold rings where the old is flat ochre; away from it a cool deep blue with its clouds and a rose band low where the
  old is the same flat ochre.

## The summer canopy (24 Nov; the coordinator: the summer wood from the air a carpet of lime crowns)

- world/flora.js, behind LOOK.canopyGreen (on unless `?light=old`; `?canopygreen=0` alone): each tree kind's summer
  dress (leafSum) through a scale per channel: the lightest green to an olive-gold (hue 73 to 59, V 0.92 to 0.78), the
  middle a step deeper (V 0.80 to 0.66), the darkest toward a blue-green (V 0.58 to 0.46). Autumn dress, conifers and
  the undergrowth (B's) untouched; the same uniforms feed near trees, far trees and impostors.
- SEEN (opened; one page each, A `canopygreen=0`): with the impostors on (`fartree=impostor`), 150 m: a carpet of bright
  lime crowns becomes a deeper olive-green with gold lights (V median 0.57 to 0.49, V over 0.90 5.3 to 3.7 %); 420 m the
  same, calmer (V median 0.69 to 0.64). On foot S2: the leaves a step deeper; the bright lime left there is the floor
  grass (B's sward and C's ground, not this). Honest limit: B reads a little greyer than ideal; more variety between
  crowns (some warmer, some bluer) would be the next step if wanted.
- EACH SUMMER TREE ITS OWN GREEN (the coordinator's next step): chunks.js pcSummerTree, by the tree's own number over a
  third lean warm and golden and over a third cool and deeper, in PROP_VERT, PROP_FRAG and the impostor (impostor.js,
  one line); OIL.uLookG.y = LOOK.treeVar x (1 - season), so 0 in autumn; `?treevar=0` or `?light=old` off. SEEN: on foot
  S2 4.8 % of pixels (the leaves only), stats unchanged; from 150 m with the impostors 31 % of pixels, S 0.21 to 0.23:
  a modest mottle of warmer olive and bluer crowns, not yet a clear many-trees read, because at that distance a crown
  is a few strokes (A1's two-step small crowns, `?impsmall=1`, should let it carry). Stills: build/canopy/treevar_*.


## The olive darks (c0ec9f8, 24 Nov): SEEN

- chunks.js pcShadeLeaf, inside the L2 quieting (so `?leafshade=0` or `?light=old` take it out): besides the
  strongly green darks, dark strokes of hue 44 to 200 under value 0.28-0.34 and over saturation 0.50-0.70 are also
  turned toward the cool shade's grey, so the olive and ochre-green darks in shade stop reading as mud.
- SEEN (look-director with and without c0ec9f8, one page each, phone settings): green wood vista 12 and 16.8, coast
  16.8, autumn stream 16.8. Changed pixels 1.5, 2.2, 0.0 and 3.2 per cent; on them saturation 0.39 to 0.26, 0.58 to
  0.43, 0.87 to 0.57 (the autumn stream's shaded grass blades), value up 0.01 to 0.03. Hues changed 49 to 71 (10th to
  90th percentile): the warm reds and oranges untouched. The darks land at about S 0.55, R2.2's target. Stills:
  build/olive/ (top without, below with).
- The fresh-eyes audit of v39.2 and its three findings are in `docs/lead/LOOK-AUDIT-2.md`; the cloud shell's limb
  (?skylimb) fixed on the way is in its section 4.
