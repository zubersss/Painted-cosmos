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
- The Neptune fix (`bareGeometry(seed, lod, spec)`, florakit.js:76 and :804) is kept in the working tree UNCOMMITTED
  (group B's file; the coordinator has it for v37.1). Commit by naming paths, never `git add -A`.

## State

| step | state | commit | what was seen |
| --- | --- | --- | --- |
| L0 | DONE | see git log (`[painter] L0`) | 7 stills (S1-S6 + S3 at night) against v37: 6 identical to the pixel, 1 with 2 pixels off by 1 of 255 (the 275 m night still); the shader text of all 36 materials of the autumn wood (comments and spaces taken out) identical, the 9 plant shaders with `pcFogAmountV` included, so those 2 pixels are the software renderer's run-to-run noise, not the change. Suites 325 / 65 / 416 pass. |
| T1 | DONE | see git log (`[painter] T1`) | see the T1 section below; stills in docs/shots/painter/look-director/build/T1 (A = `?skyceil=0`, B = on) |
| L1 | DONE | see git log (`[painter] L1`) | see the L1 section below; stills in docs/shots/painter/look-director/build/L1 (_A off, _B on) |
| L2 + L7 | DONE | see git log (`[painter] L2 + L7`) | see the L2 + L7 section below; stills in docs/shots/painter/look-director/build/L2-L7 |
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
