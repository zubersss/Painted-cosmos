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
| L1 | not started | | |
| L2 + L7 | not started | | |
| L3 | not started | | |

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
