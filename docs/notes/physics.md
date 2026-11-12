# PHYSICS notes

Branch: `cosmos` (shared with PAINTER and PILOT, one working tree). Commits: `tools/commit.sh physics`.
Owner of: `src/physics/**`, `physics-lab.html`, `docs/notes/physics.md`, `docs/shots/physics/**`.

## Hand-over P21 (nineteenth PHYSICS agent; read this block first; P20 and older below hold for everything not named here)

**Where things stand.** The block: (1) the brace at a face or concave slope the read-ahead misses; (2) the close row; (3) rain
rings on grass; (4) the float strips after P20's arrival fix, and any strip item 1 changes. Done: (1) the brace takes only the
speed INTO the face (the run keeps v cos^2 of a slope to within 2 %, where the head held it at 0.62 to 0.95 of that), and a
fault found under it is fixed (the legs' base sank up to 5.3 m under the floor between close boulders); (2) no read-ahead fix
is better in every case, measured, and why (item 2); (3) rain makes no splash on a meadow, a forest floor, sand or snow,
only on water and wet hard ground; (4) six strips filmed on the head and OPENED (item 4). Added by the coordinator during the
block, from PAINTER 12: (5) the floating twin copies PAINTER's new lift of the sheet in the shallows; (6) Neptune's coast
report: the target, not the settle, was the thing to change (a sea grows with the wind's duration), and arriving and
staying disagree (item 6: the first item of Next). Commits: `3cd06dc` (items 1 and 3, the tests) and the hand-over's (items 4
to 6, the strips, these notes). Tests: `node --test src/physics/` **300
pass** (296 + 4 new: `explorer.test.mjs` 2, `particles.test.mjs` 1, `water.test.mjs` 1; `load.test.mjs` among them), `node
--test tests/*.test.mjs` **146 pass** (PILOT added four), `node --test src/world/*.test.mjs` **19 pass**, on a clean
export of `e866f6e` with this block's final files (`final4/`); `coast.mjs` PASS at both stands on it.
Every new test fails on the head (`adf0923`). Scratch: `/home/user/.pc-scratch/physics/p21/` (`head/`: the head as exported;
`work/`: it with my files; `s/hill.mjs <tree> [g v hz degs H after]` a run onto a concave kink (`FILLET=` a gradual one),
`s/t1.mjs <trees>` the brace test's cases, `s/kink.mjs` the game's Moon kink (P20's heading 180 at 9.2 s) in PILOT's Sim,
`s/rowloss2.mjs <trees>` the close and spread rows with every measure, `s/p19row2.mjs` P19's row and how far the legs' base
sinks, `s/rowtrace.mjs` the row step by step, `s/rings.mjs <trees>` splashes and ripples per ground in a downpour;
`trace8-head.txt`, `trace8-work2.txt` PILOT's boulderrun replayed in Node on head and P21, 8 headings; `film/` the strips).
**Next, in order:** (0) the sea on arrival should be the sea the wind's recent history has raised, not the equilibrium of
the wind now (item 6: at Neptune's stand an arriving player sees Hs 6.0 m 80 m out, one who stood through the squall 3.5 m);
(1) the close row's trial standard (item 2: a trial counts a face crossed only with no brace at all, which
is now stricter than the brace; deciding what a clean crossing is now is a design call, P16's and P17's tests would move);
(2) a hill read as a face: on Mars and Earth a run onto a 43 degree slope is slowed by P16's law to 1.1-1.2 m/s, the law's
pace for a face it cannot see the top of (item 1, the last paragraph); (3) the crest of a rim met at speed: the feet leave the
falling ground (0.15 to 0.54 m up, not thrown: item 1); a read of crests would let the walker ease off before one.
**API added (additive):** coast.mjs's report: `target` is now what the storm raises in the time it has blown, with
`target.blownForEver` (the old target) and `target.settle`; explorer.js `EXPLORER_BODY.braceSide` (m: where the face's tilt across the path is read),
`EXPLORER_BODY_STATE().baseLo` (the lowest ground the feet have stood on since the legs began to work); near.js
`TerrainGrid.groundQN(q)` (groundQ and q[4] the nearest known node); ground.js `splashOn(id, wet, snow)`; particles.js
`Particles.splashOf`, `.splashCover`, `.splashCW`, `.splashSlot`, `.splashHere`, `.splashAt(n)` (set by physics.update).
`gamefilm.mjs`: the float subjects run 15 s of clock before their frames (10 before). Nothing removed or renamed.
**Behaviour changed without a call changing:** (1) where the ground rises faster than the hips can follow and the read-ahead
held no pace for it, the run loses only its speed into the face: up a slope it carries on (the Moon, 6.7 m/s onto 29 degrees:
5.13 m/s at the slowest, was 3.72), against a boulder face met square it slows about as before (the face's normal is most of
the speed), met at a slant it slows less; the soles (and the limbs, on a hold) keep it on its line; (2) between close
boulders the hips can be raised for the next one (the row on the Moon: 2.38 m/s at the slowest past the first boulder, was
1.74); (3) over the crest of a crater rim met at speed the feet may leave the falling ground (item 1); (4) rain makes no
splash events (rings) on grass, moss, a forest floor's litter, sand, dust, ash, gravel or snow; on rock, glass, crystal,
ice and a stream's bed only once a film of water lies on them (wetness 0.2 to 0.6), on earth only soaked (0.55 to 0.9), on
mud from 0.3; on liquid as before (P20: none on a running sea); (5) the floating or wading explorer rides 6 cm higher
in the last 0.4 m of the shallows, as the drawn sheet now lies (PAINTER 12).

**1. The brace (`explorer.js` braceFace, the folded-out branch).** Where the ground ahead rises faster than the hips can be
raised (the legs at the end of their fold) and no pace was held for it, P13 let the feet go only as far up as the hips could
follow and the legs take up the WHOLE velocity at legCatch (0.5 m/s a step at 60 Hz). A face pushes along its own normal.
Now (`braceFace`): the face's rise along the path (the step's secant) and across it (the ground `braceSide` either side of
the step's end); the mass's velocity (the horizontal speed along the path, the hips' vertical speed); the legs take up the
speed INTO the face, legCatch dt at most a step, the body coming on over its planted feet meanwhile (surge, as in P13); the
push across the path (a face tilted to the side) is held by the soles, whose grip the push itself presses on (hold times the
normal impulse), and on a hold by the limbs too (braceAccel), so the run keeps its line; the speed along the face is kept:
up it as fast as the hips may honestly rise (no faster than gravity and a hold can stop them within the reach over the
lowest ground they will be over meanwhile: the step's end, the ground a look ahead, and where they would stop when that lies
further; never less than P13's capB), the rest of the up-face speed taken by the legs too, within what is left of legCatch.
The velocity it leaves is laid in the ground's own plane where the step ends (else the step would shorten it a second time).
A wall (more than a clamber in one step) and a hold on the way down are as they were.
- *Synthetic kinks* (`s/t1.mjs`: level ground, then a straight slope from 10 m, its own normals, a run started 6 m short at
  6.7 m/s so the read-ahead reads past the foot; 60 and 30 Hz the same to 0.03 m/s): the slowest speed on the slope, head
  -> P21, against v cos^2 (the speed along the slope, level): **the Moon 29 degrees 3.72 -> 5.13 (5.13), 43 degrees 2.21 ->
  3.52 (3.58), Mars 29 degrees 4.04 -> 5.13, Earth 29 degrees 4.85 -> 5.13**; the speed braced in all on the Moon's 29 degree
  slope 6.93 -> 1.06 m/s, 43 degrees 12.29 -> 4.61. No step in the air on any slope. On a 2.2 m rim (then falling at 10
  degrees) the same climb, and over its crest the feet leave the falling ground on the Moon (0.40 m up at 29 degrees, 0.15 m
  at 43), rising 0.003 to 0.005 m: not thrown (the head crawled over at 3.7 and 2.2 m/s). Mars and Earth at 43 degrees read
  the slope coming and slow before it (P16's law: 1.09 and 1.24 m/s), unchanged: Next 2.
- *The game's Moon kink* (P20's: heading 180 at 9.2 s, the rim of a crater 2.2 m high at up to 43 degrees, PILOT's Sim on
  PAINTER's ground at 30 Hz, `s/kink.mjs`): **6.95 -> 1.95 m/s in 0.2 s (head) -> 6.95 -> 4.09 m/s at the slowest, 4.5 m/s
  0.3 s later (P21)**, the hips rising up the rim at 4.5 m/s.
- *PILOT's boulderrun replayed in Node* (`trace8`, 8 headings, with and without the boulders, on today's world: PAINTER's
  snapshots moved the field since P20, so head and P21 are both measured here): thrown up at most 0.024 m with the boulders
  (head 0.001), 0.075 m without (head 0.028); two new times the feet leave the ground, both over a rim's crest where the
  ground falls away: heading 180 at 9.7 s feet 0.31 m over ground that fell 0.98 m (boulder 0.44 m tall 0.6 m off), heading 45
  at 7.7 s 0.15 m; PILOT's rule counts neither against a boulder (the ground fell more than the boulder's height plus 0.3 m).
  Mean pace heading 45 5.83 -> 6.26 m/s, heading 180 5.93 -> 6.23; the other six headings the same to the last digit.
- *Kept:* `ghostfield.mjs` at all six places and both gravities: radial speed while grounded 0, off the line 0, wrong-material
  steps 0, steps in the air 0 (worst step loss 0.55 -> 0.39 on Earth, 0.52 -> 0.47 on the Moon); P17's single boulder 0 to
  0.55 m off the path at three places and three gravities (`p17off.mjs`): the same to the last digit; the P13 boulder face, the
  P12 far side, the 0.3 m field (60 and 20 Hz, both profiles), the 1.3 m P8 boulder: all pass; no NaN.
- *A fault found under it: the legs' base sank under the floor.* B.base (the ground the hips' reach is counted from while the
  legs work) was carried on at the frozen trend, and that trend is a descent's on the far side of a boulder: it went on
  sinking after the feet reached the floor (P19's row: up to 2.0 m under it on Earth at 60 Hz, 5.3 m at 30 Hz, 1.5 m on the
  Moon), the throw cap went to nothing and the hips could not be raised for the next boulder: met braced (with the new brace
  and not this, 2.68 -> 1.47 m/s on the Moon at 30 Hz). Now it is never carried below the lowest ground the feet have stood on since (`baseLo`). P19's row: the
  slowest past the first boulder **1.74 -> 2.38 m/s (Moon 60 Hz), 1.91 -> 2.40 (30 Hz)**, Earth 2.34 / 2.18 -> 2.29 / 2.22;
  braced in all 4.09 -> 1.14 m/s (Moon 60 Hz), 11.47 -> 5.24 (Earth 30 Hz).
- *Tests* (`explorer.test.mjs`, P21, both fail on the head): the kinks above (the Moon 29 and 43 degrees, Mars and Earth 29,
  slope and rim, 60 and 30 Hz: the read-ahead holds no pace, the slowest at least 0.96 v cos^2, no air on a slope, not thrown
  on a rim); P19's row at Earth and Moon, 60 and 30 Hz: the base never under the floor, never slower than 2.1 m/s, no air,
  on the line.

**2. The close row (P20 item 7): no fix better in every case, and why.** Measured (`s/rowloss2.mjs`: P19's row 2.6-2.8 m apart
and the same 5.2-5.6 m apart, 7.4 m/s wished, Earth and Moon, 60 and 30 Hz: steps losing over 0.3 m/s (braced ones), the
speed braced in all, the slowest past the first boulder, the time through):

| case | head | P21 (item 1) | + (a) | + (b) | + (a) cut at the valley, (b) |
|---|---|---|---|---|---|
| close Earth 60 | 14 (14), 7.24, 2.35, 8.27 s | 13 (13), 5.70, 2.29, 7.95 s | 9 (9), 3.57, 1.98, 8.50 s | 9 (9), 4.13, 2.20, 8.07 s | 10 (10), 4.37, 2.40, 8.38 s |
| close Earth 30 | 13 (12), 11.47, 2.18, 8.10 s | 11 (8), 5.24, 2.22, 7.87 s | 6 (6), 4.29, 2.08, 8.40 s | 6 (6), 3.74, 2.27, 8.33 s | 3 (3), 1.73, 2.36, 8.27 s |
| close Moon 60 | 9 (8), 4.75, 1.74, 10.83 s | 2 (1), 1.14, 2.38, 10.62 s | 6 (5), 3.25, 2.32, 10.48 s | as P21 | 2 (1), 1.48, 2.39, 10.68 s |
| close Moon 30 | 8 (6), 4.47, 1.86, 10.43 s | 4 (2), 1.47, 2.40, 10.60 s | 6 (3), 1.49, 2.11, 10.60 s | as P21 | 7 (4), 2.66, 2.34, 10.57 s |
| spread Moon 60 | 4 (2), 1.15, 2.49 | 4 (1), 0.77, 2.46 | as P21 | 5 (2), 1.12, 2.49 | 5 (2), 1.12, 2.49 |
| spread Moon 30 | 4 (1), 1.23, 2.50 | 4 (1), 0.55, 2.50 | as P21 | 5 (2), 1.47, 2.49 | 5 (2), 1.47, 2.49 |

(The spread row on Earth loses nothing in any column.) (a) is P20's: "comes down again" judged by the lowest ground past the
top, not the profile's last sample (in a close row the profile ends on the next boulder and the face was read as a hill:
`noTry`); (b) P20's: the gate's rise from min(h1, hN), not from the ground under the walker still high on the last boulder;
the last column cuts the tried profile at the valley before the next rise, so the trial is of this boulder only. Item 1
alone is better than the head in every case but three numbers (Earth 60 Hz 0.06 m/s slower at the slowest, the Moon's
close row at 30 Hz 0.17 s longer through, its spread row at 60 Hz 0.03 m/s slower at the slowest). Each read-ahead change helps Earth's braces and hurts elsewhere: slower through on Earth (8.0 ->
8.1-8.5 s), more braced on the Moon or in the spread row. **Why none can win everywhere:** a trial counts a face as crossed
only with no brace at all (P17), so the pace it plans is the pace at which the legs take up nothing. With item 1 a brace
costs only the speed into the face, which is usually less than the soles must shed to reach the planned pace: so every
face moved from "met braced" to "read and tried" trades a small brace at the face for a larger slowing before it, and the
run gets slower; and on the Moon the soles (1.6 m/s^2 of grip and 1.8 of assist) cannot shed that speed in the 2.6 m between
boulders, so the walker still arrives fast (P20's cause (c): the ghost's run-up starts standing on the valley floor at the
trial pace, not from the walker's own state) and braces as well. A fix that wins everywhere needs a different trial standard
(a crossing is clean when the legs take up no more than the face's normal share within legCatch, and the feet stay down),
which moves P16's and P17's tested results (P16: no brace at a square 1 m face): a design call for the next block, not a
tuning. Left as item 1 leaves it.

**3. Rain rings on grass (`particles.js`, `ground.js`, `index.js`, `near.js`).** Physics made a splash event wherever a drop met
the ground, and PAINTER's kit draws every event as a ring: the strips showed crisp rings over the meadow. A drop's crown and
ring stand in a film of water; the blades of a sward and the leaves of a forest floor take it with none, sand, dust, ash and
gravel swallow it, snow covers everything. `ground.js splashOn(id, wet, snow)`: rock, glass, crystal, ice, a stream's bed
smoothstep(0.2, 0.6) of the ground's wetness, mud smoothstep(0.3, 0.7), soil smoothstep(0.55, 0.9) (soaked: standing water),
everything else 0, all 0 under lying snow. Each frame `index.js` fills a table by material (the ground as it is now) and
hands the particles the near grid's per-node material (`groundInto` keeps it at slot 8); the near-focus ring spawner and
each drop that lands near the focus scale their splash by the node's value (`near.groundQN` gives the node in the per-drop
loop with nothing boxed; `Particles._fall` is still optimised whole: status 81 before and after, P17's `optstat.mjs`). The
hull's splashes and every ripple on liquid are as they were. A downpour, 6 s (`s/rings.mjs`): splash events alive **on a
meadow 512 -> 0, a forest floor 512 -> 0, sand 221 -> 0**; wet rock 512 and a wetland's mud 512 as before; ripples on water
512 as before. Test (`particles.test.mjs`, P21, fails on the head); two older tests that counted crowns on a meadow now count
them on a wetland's mud. The drawing is PAINTER's: their ring shape ignores the event's kind, so a snowflake's settle and a
hailstone's bounce would be drawn as rings too: the exact line is in "For PAINTER", P21 (my lab's ring shape has it).

**4. The strips (`docs/shots/physics/motion-*.jpg` with `.json`).** Filmed in the GAME (`gamefilm.mjs`) on a clean export of
`e866f6e` (PAINTER 12's world) with this block's code, one browser, by the game's own clock; all OPENED. (A first run on
`adf0923` was stopped when the head moved; its stale process then opened a browser for its next subject and was stopped by
PID too, so for about two minutes two browsers of mine ran.)
- `motion-game-float-neptune` (Neptune storm_seas at 240 s, 75 m/s, the explorer floating 25 m out, now **15 s** of clock after
  arriving). Seen: the figure's head at the waterline in every frame, the sea a dark ultramarine heaving round it, basalt stacks
  on the horizon, rain streaks driven flat, no raindrop rings on the storm sea, no large spray blots at the lens; on the left the
  big cliff is still a near-black slab with a ruler-straight vertical edge (PAINTER 12 changed the stack, not this cliff).
  Numbers: **Hs 25 m out 2.97 m rising to 4.87 m over the 3.2 s** (P20's strip, 10 s after arriving and before the arrival's
  last step: 0.78 to 1.03 m), the feet 1.13 to 1.37 m under the drawn surface (float depth 1.25), the body heaving 0.84 m while
  the surface there moves 0.93 m, spray 4 to 166 drops. Verdict: the sea is there on arrival in the game (P20 3b's last step),
  and the figure rides it; the sea still rising at 18 s, and how high it rises on arrival, is item 6.
- `motion-game-float-earth` (Earth sea_coast at 8850 s, 13 m/s from the E, 15 s after arriving). Seen: the explorer floating
  head and shoulders out of a grey-green sea of soft strokes, an islet, the sandy headland on the right still combed with
  diagonal stripes (PAINTER's), rain as small blue-grey dashes, no crisp rings on the sea. Numbers: **Hs 0.45 to 0.62 m** (P20:
  0.13 to 0.16 m; `coast.mjs` about 0.5 m), feet 1.16 to 1.39 m under the drawn surface. Verdict: right.
- `motion-game-moon-boulder` (the Moon, crater_fields' densest field, its tallest boulder on gentle ground: on PAINTER 12's
  flatter boulders that is now 0.68 m, radius 1.07 m; Shift+W from 6 m/s; 30 Hz). Seen: the explorer runs out across a field of
  violet-grey boulders under a starry indigo sky, crouches over the boulder at frames 14 to 16 with an arm out as it scrambles
  over, and runs on; never in the air. Numbers: feet 0.000 m off the ground at all 90 steps, thrown up 0; **the face costs
  7.40 -> 7.15 m/s** (P20, a different boulder: 7.40 -> 5.09 in 0.1 s), and over the top the hold checks the run so the feet
  can follow the far side down, **7.15 -> 2.52 m/s in 0.3 s** (slowest within 3 m 2.42); the read-ahead held no pace for it
  (P20 item 5's open finding). Verdict: the 0.3 m rule holds; where the speed is shed moved from the face to the top, which is
  where a runner who had not slowed would have to shed it; a run that saw it coming would slow before it (Next 1).
- `motion-game-moon-boulder-side` (the same field, a 0.65 m boulder met 0.45 m off its middle). Seen: the figure passes the
  flank in a brief crouch (frames 15 to 16) and runs on. Numbers: **7.40 m/s throughout, not a step slower**, legs folding
  0.34 m, feet 0.000 m off the ground at all 90 steps, thrown up 0 (P20 on its boulders: a bump 6.14 -> 3.51 and a rock 6.22 ->
  2.37, both braced). Verdict: P17's off-path crossing, in the game.
- `motion-game-grass-sub` (Earth spawn at 176 s, the storm, 30 frames a second for 0.4 s). Seen: the explorer in the meadow, the
  grass strokes shifting a little from frame to frame, smooth, no flicker; **no rings at the feet** (P20's frame 0 had two crisp
  white rings there: `film2/grass-p20-row.png` against `grass-p21-row.png`). Small pale specks with darker rims stand at the
  upper right in every frame of both strips, the same places and sizes 0.1 s apart (`film2/grass-zoom0.png`, `-zoom3.png`):
  not rings (a ring grows 3.5 cm in that time and is gone in 0.28 s); PAINTER's flower heads or flecks on the blades.
  Numbers: the wind half a metre up 3.5 to 9.2 m/s within the 0.4 s, four blades leaning 16.9 -> 28.4, 24.5 -> 37.0, 39.5 ->
  52.2, 22.0 -> 36.9 degrees. Verdict: item 3 holds in the game.
- `motion-clamber-row-moon` (the lab, P19's close row on the Moon at 7.4 m/s; re-filmed: item 1 changes its third face). Seen:
  the wide framing again (the figure small), the stand-in clambering cone after cone, never in the air; kicked dust left
  behind as soft round puffs (in the lab; PAINTER's airless grains are set by the game's world). Numbers: mound 1 at the pace
  held (2.66 m/s, no loss), mound 2 rising 2.70 -> 3.13, **mound 3 (1.1 m) 3.68 -> 3.12 m/s over 0.25 s at the face and 3.24 ->
  2.76 over the top** (P20: met braced, 3.76 -> 2.46 in 1/8 s), then onto mound 4; the feet with the lab's boulders 0 m over
  the rock throughout. Verdict: a continuous clamber; the third face no longer a stumble in the numbers (still too small to
  see at this framing).

**5. The floating twin and PAINTER's lift in the shallows (the coordinator, from PAINTER 12; `index.js` waterLevelAt).**
PAINTER 12 lays the drawn sheet higher where the still water is shallow (`materials.js` WATER_VERT, after the waves' mix:
`p += up * 0.06 * (1 - smoothstep(0.05, 0.40, aDepth))`, aDepth the still depth: the bed's bumps showed through as a halftone).
`env.waterLevel` adds the same term, waves or none (off the active body nothing): a wading figure stood 6 cm into the sheet.
Test (`water.test.mjs`, P21, fails on the head): in a calm, from 0.1 to 1 m of water the twin over its level at 2 m deep is
the shader's term within 2 mm (at 0.1 m deep 0.0567 m; the head gave 0).

**6. Neptune's coast report: the target, not the settle (the coordinator, from PAINTER 12; `coast.mjs`).** The squall peaks
at 240 s; the report's 150 s settle starts at 90 s, and the swell, which follows its wind over WATER.swellTime (90 s), never
comes up: the most exposed water reaches 0.73 to 0.78 of the target, the stand 3.51 m at 80 m out against 4.19. The target
was the sea the peak wind raises over 2.5 km of 20 m water blowing for ever. A sea grows with the wind's duration as well as
its fetch, and the game's sea grows with it (the wind sea over growTime, the swell over swellTime): no water raises 4.19 m
in this squall. So the settle (a player standing at the stand through the squall) is the honest measure, and the target
should be what the same squall raises over the reference water in the same time, by the same growth: `coast.mjs` now
integrates WaterField's two lags over the weather's wind at the stand from the settle's start (where the run arrives) to the
storm, over 2.5 km of 20 m water. **Neptune: target 4.19 -> 2.96 m (wind sea 2.22, swell 1.95), the stand 3.51 m: 1.19 of it
(was 0.84); Earth: 0.68 -> 0.52 m, the stand 0.54.** Both PASS, with room that is the terrain's, not the timing's. *The other
half, mine and not done:* a player who ARRIVES at the stand 20 s before the peak (`--settle=20`) sees Hs **6.04 m** 80 m out
(the most exposed water 6.53), one who stood there 150 s sees **3.51 m**. The arrival's quick settling (P20, Decision 51)
settles to the equilibrium of the wind NOW, as if the storm had always blown; it should settle to what the wind's recent
history raised (the same two lags over the past wind, as `moistureAt` sums past rain). Then arriving and staying agree and
the report's 150 s settle is what every player sees. Next 0.

**Not done or not verified.** (0) The arrival's sea from the wind's history (item 6). (1) The close row's trial standard (item 2). (2) A 43 degree hill on Mars and Earth is read as a
face by P16's law and run at 1.1-1.2 m/s (item 1). (3) Over a rim's crest met at speed the feet leave the falling ground
(0.15 to 0.54 m in the Node replay of the game run; physics by Decision 50, but new in this block); the walker reads faces,
not crests. (4) The ship landed on water: done by PILOT (`a0e3fb1`, on `env.waterLevel`); the gear's floor left as PILOT asks. (5) No frame
rate on a real GPU; every strip is software GL by its own clock. (6) PC_TIMING not run this block (the machine at load 9 to
12); `Particles._fall`'s optimisation checked instead.

## Hand-over P20 (eighteenth PHYSICS agent; read this block first; P19 and older below hold for everything not named here)

**Where things stand.** The block: (1) the PC_TIMING suite while the load was low; (2) film and OPEN the strips never opened
(`tree-gust`, `clamber-walk-moon`, the storm frame) and what was new and never seen in the game (sub-second gusts in grass and
trees, the off-path boulder, the close row, milestone 3's Moon boulder run measured in the game); (3) PAINTER 12's sea-map
wiring against physics; (4) P19's open items where a player could notice them. Done: (1) all, numbers below; (2) twelve strips filmed and OPENED (four in the lab, eight in the game: item 6), the
Moon boulder run measured in the game (item 5: the 0.3 m rule holds for everything a boulder does);
(3) the wiring (`c08dddb`) read and checked: it is what P18/P19 asked for; one mismatch found, on MY side, and fixed: the
floating explorer floated on the still level and the drawn waves passed through it; (4) the re-anchor fixed on every world
(on the small worlds it was up to eight times what P19 measured on Earth), the close row diagnosed (two causes found, a
third left; not fixed: see "Not done"), `physics.water()`'s 1 km step left (nothing in the game reads it). And two faults the
float strip showed, fixed: the sea started flat after arriving at a coast and took minutes to rise (3b), and rain drew rings on
a storm sea (3c). Commits: `95f79cc` (the re-anchor, the float, the tools, the Moon strips), `38a3266` (the arrival, the rings,
the strips) and the hand-over's commit (the arrival waits for the finished rose, the float strips, this hand-over). Tests: `node --test src/physics/` **296 pass** (291 + 5 new: `reanchor.test.mjs` 2, `water.test.mjs`
3; `load.test.mjs` among them: every module loads alone), PILOT's `node --test tests/*.test.mjs` **142 pass** (PILOT added two
since P19) and `node --test src/world/*.test.mjs` **19 pass**, all on one clean export of `95f79cc` with this block's final
files (`expw3/`). Every new test fails on
the head before P20. Scratch: `/home/user/.pc-scratch/physics/p20/` (`exp/`: an export of the head as filmed first; `expw/`,
`expw2/`, `expw3/`: the heads `c08dddb`, `418ac5b`, `95f79cc` with this block's files, where everything later was filmed and
tested; `s/reanchor-err.mjs` the re-anchor's
shift by world and distance; `s/radbg.mjs` each re-anchor of a walk traced; `s/reliefwalk.mjs <tree> <body> <biome>` the
re-anchor on PAINTER's real ground, 8 km of straight walks; `s/rate.mjs` rateAt against heightAt's finite difference;
`s/trace8.mjs` PILOT's boulderrun replayed in Node, 8 headings, with and without the boulders; `s/rowloss.mjs <tree>` the
close row and a spread row, the steps that lose speed; `s/rowdbg.mjs` the row step by step with the read-ahead's state;
`br30/` PILOT's boulderrun in the game; `film/` every strip as made, with its log). *A warning for whoever shares the
coordinator's scratchpad*: subagents of one coordinator session share its scratchpad directory. My first export went to
`<scratchpad>/exp` and wiped the coordinator's `exp/art` under its running visit check (PID 30041, 10:59); its log reads
all ten bodies ok, but that run should be repeated. Work in your own `/home/user/.pc-scratch/physics/pNN/`.
**Next, in order:** (1) the brace (Not done 1): at a face or a concave kink the read-ahead did not hold, the legs' catch takes
the whole speed, where only the speed into the new ground should go (on the Moon 4.5 m/s in 0.17 s; the close row's third
cause); then the close row's two read-ahead causes (item 7: measured, reverted); (2) re-film `game-float-neptune` and
`game-float-earth` with 15 s of clock before the frames, to see the arrival fix (3b's last step) in the game; (3) the ship's
gear on liquid (Not done 3, waiting on PILOT); (4) no splash rings on grass (Not done 5).
**API added (additive):** `physics.bindEnv` sets `env.waterLevel(p, depth, rate?)` (the drawn sea's surface over the still
level at p where the liquid is `depth` deep, m; `rate[0]` how fast it rises, m/s); water.js `WaterField.rateAt(x, z)`;
near.js `LocalFrame.carry(oldFrame, x, z, out)`; index.js `reanchorAt(R)`, `QUALITY.reanchorShift`, `QUALITY.reanchorBand`;
particles.js `Particles.rebase(frame, X, Z, dr, old?)` (old: the frame before), `Particles.seaCalm01`; water.js `WATER.arriveWait`, `WaterField.expectMap`, `.seaMeasured`; seamap.js `target.roseReady`; explorer.js scratch `wr`. Lab
(`physics-lab.html`): `rocks=e,n,h[,r];...` (any number of boulders). Film: `src/physics/three/gamefilm.mjs` (strips of the
GAME, index.html, by its own clock) and seven new subjects; `film.mjs`: `clamber-run-moon-side`, `clamber-row-moon`,
`clamber-row`, and `P.ex().up` (the feet over the ground WITH the lab's boulders). Nothing removed or renamed.
**Behaviour changed without a call changing:** (1) on the Moon, Pluto, Mercury, Mars and Venus the near field re-anchors
sooner (125, 145, 205, 284, 344 m from the anchor; Earth and the giants 384 as before) and the anchor keeps its radius through
a re-anchor unless the focus has left a band of 2 % of the world's radius about it; `physics.stats.reanchors` counts more on
the small worlds; (2) particles are carried through a re-anchor exactly, and the splash and settle events alive in that
frame stay where they were (they were drawn the whole re-anchor, 384 m, away); (3) a floating or wading explorer rides the
drawn sea: it heaves with the waves (in a gale on Earth, Hs 0.9 m, its height has an sd of 0.29 m; it had none), its drag
in the water is against the water's own heave, and its wading depth and buoyancy at touchdown are the drawn surface's. (4) arriving at a coast (a teleport, a landing, a re-anchor from far) the sea stands at its height within a few seconds, not
over minutes; (5) rain makes no rings on a sea running higher than about 0.3 m (none over 0.5 m; all under 0.1 m).

**1. PC_TIMING (item 1).** `PC_TIMING=1 node --test src/physics/` on a clean export of `5efc7f4`, load 3.8 rising to 5.9, 2.5
min: **291 of 291 pass**, every wall-clock assert met. The numbers (limit in brackets): `index.test` physics.update per frame,
walk mean 0.708 ms p95 1.023, ship at 46 m/s 0.738 / 1.142, at 160 m/s 0.760 / 1.128 (median < 1.0, mean < 1.6); warmUp 25 ms
(400), the worst frame in the first 5 s 0.63 ms (2.0); on PAINTER's Earth mean 0.587 ms (2.0); quality 2, a gale through a
tall wood, 3963 leaves: 1.46 ms of wall, 1.39 ms of main-thread CPU (2.0); `kits.test` 1600 streaks 110 us (400), 1600 dabs
118 (400), shades 14 (200), 256 marks 153 (500), water 41 x 41 119 (400); `seamap.test` the map 0.030 ms a frame, worst 0.80
(0.25 mean). Two asserts pass silently (`timing()` prints only a miss): re-run with it printing, `drift.test` arrival 12.19 ms
then 0.080 ms a frame (30, 0.25); `loose.test` median frames Earth 1.28 ms (736 particles), Mars 1.05, Moon 0.76, Venus 1.11,
Neptune 1.45 (1871), Pluto 1.04, Mercury 0.78 (1.5: Neptune is near it). That second run put five timed files side by side
(load 5.5 rising to 9.8) and two failed: `index.test` at 160 m/s mean 2.89 ms (median 0.93) and `seamap.test` 0.42 ms; each
file alone at load 6.5 passes (means 0.75 / 0.60 / 0.84 ms, warm-up 27 ms, worst frame 0.96, PAINTER's Earth 0.85, quality 2
1.21 ms of CPU; the map 0.047 ms): the load's, not the code's. PILOT's `tests/physics.test.mjs` and `contract.test.mjs` under
PC_TIMING: 18 of 18 pass.

**2. The re-anchor on every world (P19's open item 3; `index.js`, `near.js`, `particles.js`).** The frame is a gnomonic grid on
the tangent plane at its anchor; a re-anchor of D m moves every grid over by whole cells, exact at the new anchor only: a
ground point s m from it lands about D s (D + s) / R^2 from where the grids put it (`s/reanchor-err.mjs`; the formula and the
frame agree to 1 %). P19 measured Earth (R 4 km, D 384: 0.30 m 30 m out, 1.46 m 120 m out). On the small worlds the same 384 m:
**the Moon (R 1.4 km) 0.77 m 10 m out, 2.45 m 30 m out, 12.1 m 120 m out; Pluto 0.59 / 1.87 / 9.2 m; Mercury 0.31 / 0.99 /
4.8 m.** A second term P19 did not name: the grid's metres are metres at the anchor's radius, and the anchor took the focus's
radius at each re-anchor, so every grid was rescaled by r0' / r0 (a point s m out moves s dr / r0; on the Moon's crater fields
dr reached 54 m in one re-anchor). What moved: the particles (a drop 30 m out 2.4 m on the Moon), the trail trough and the
drifts (64 x 0.5 m grids), the flora and wind grids, the waves' phases; and every splash or settle event alive in that frame
was drawn the whole re-anchor away (`events.origin` follows the anchor every frame, nothing moved their offsets). The marks
(footprints) were exact: they are body-local. Fixed, three ways:
- *Points are carried exactly*: `LocalFrame.carry` maps an old grid position to the new through the ray of its ground; the
  particles and the wakes' last ring use it; the events' offsets move with their origin.
- *The distance scales with the world*: D (D + 30) / R^2 <= 0.00994 (Earth's own level at 384 m), so a ground point 30 m out
  moves no more than on Earth: the Moon re-anchors at 125 m, Pluto 145, Mercury 205, Mars 284, Venus 344; Earth and the giants
  384 as before (`reanchorAt`).
- *The anchor keeps its radius* unless the focus has left a band of 2 % of the world's radius about it (then it moves only to
  the band's edge): within the band a re-anchor rescales nothing, and a grid metre stays within 2 % of a ground metre. Nothing
  reads r0 as the ground (every use is a height over r0 plus a grid height; the GLSL pcPhysGrid is the same ray projection).
- *Measured on PAINTER's real ground* (`s/reliefwalk.mjs`, 8 straight walks of 1 km from each stand), the worst shift of a
  ground point 30 m out at a re-anchor, head -> P20: **Moon crater_fields median 2.31 -> 0.29 m, p90 2.83 -> 0.33, worst 3.03
  -> 0.84** (56 re-anchors where there were 16; the worst is one exit from the band on a crater wall, 26 m); **Pluto
  long_shadow_plain 1.79 -> 0.28, worst 2.22 -> 1.02** (a 65 m climb in one re-anchor); Earth temperate_forest 0.25 / 0.35 ->
  0.30 / 0.30 (the band keeps its radius; Earth's distance unchanged).
- *Tests* (`reanchor.test.mjs`, new): every world's distance; on a smooth sphere of each world's radius a ground point 30 m
  out moves 0.19 to 0.31 m (under 0.36; the Moon 2.45 on the head); on the stubs' relief the same bound (the stub Moon 0.60 m
  before the band); a drop and a splash event moved by a re-anchor under 2 mm (the head: 3.11 m on the Moon, 0.41 m on Earth,
  and the events the whole re-anchor). The file fails on the head (its import).

**3. The floating explorer rides the drawn sea (item 3; `index.js` bindEnv, `explorer.js`, `water.js`).** Checking PAINTER's
wiring I followed what floats on the sea: the body step took the liquid's surface from `env.sample(...).liquidRadius`, the
world's still level, and nothing handed it the waves (`fields.water.heightAt`, documented as what a floating thing rides, was
read by no body). So the drawn sea heaved through the figure: on Earth in a breeze the crests reach its chin and the troughs
bare its waist; in Neptune's storm (Hs about 2.8 m there with the old trains, 0.7 m with the map) the crests bury it. Now
`bindEnv` sets `env.waterLevel(p, depth, rate)`: the surface PAINTER's WATER_VERT draws near the eye, the waves and the wake,
giving way to the swash (0.07 beach) where the liquid is shallower than 1.28 Hs (the same mix, the same local Hs, `sea.x`), and
the surface's own rate (`WaterField.rateAt`, heightAt's time derivative: the phases run at omega, the sets at omega GK / 2;
against a finite difference of heightAt the error is 0.08 % rms). The step floats and wades in that surface and measures its
vertical drag and wave-making against the water's heave (a body in water heaving with it feels no drag; with the drag on its
absolute speed it lagged: correlation 0.73). Test (`water.test.mjs`, P20): a floating explorer in a gale (Hs 0.92 m) for 30
s: **the head: its height's sd 0.000 m, correlation with the drawn surface 0.04, 0.229 m (sd) off it; P20: sd 0.285 m,
correlation 0.945, 0.101 m off it**, feet 1.29 m under the mean surface (floatDepth 1.25). It rides the short waves a little
higher than they are (its own heave period is about 2.2 s, damped at about 0.4): that is a floating body, not a cork on rails.
*In the game* (`motion-game-float-neptune`, `motion-game-float-earth`, on `95f79cc` with this block's files through 3c, before
the arrival's last step; 10 s of clock before the frames): at Neptune's storm stand (75 m/s) the explorer floats 25 m out with its feet 1.20 to 1.36 m under the
drawn surface while its body heaves 0.36 m; the strip shows its head at the waterline in every frame while the sea heaves round
it, no rain rings (3c), soft white spray crossing near the lens, 183 to 423 drops of spray and the surf at 0.52 to 0.69. On
Earth's storm stand (13 m/s at 8850 s) the feet 1.21 to 1.34 m under the surface; rings still show there, the local sea being
0.13 to 0.16 m (the arrival in the game: item 4, "`coast.mjs` against the frame"). The first Neptune strip, before 3b and 3c, is in `film/` (crisp rings over
the storm sea, Hs 0.19 to 0.50 m).

**3b. The sea is there when you arrive (item 3; `water.js`, `index.js`).** The first float strip at Neptune's new stand
showed Hs 0.19 m rising to 0.50 m in 3 s, where `coast.mjs` gives 2.84 m 20 m out. Reproduced in Node (`s/arrive.mjs`, 30 m off
a synthetic open coast in a gale): **Hs 0.13 m 1 s after the field anchors, 0.16 at 8 s, 0.50 at 40 s, 0.98 at 150 s.** The
quick settling on arrival (`WATER.arriveTime`, 1.5 s at a 0.2 s time constant) ran out before the sea map's first build had
measured the fetch: the sea settled to the short upwind estimate's small sea, then grew over `growTime` (25 s) once the map
came. A sea a storm has raised is there before anyone arrives: now the 1.5 s counts down only once the sea has been measured,
a map built with the far rose finished (seamap.js `target.roseReady` -> `WaterField.seaMeasured`), or after `WATER.arriveWait`
(20 s) of known liquid without one, and only where physics builds a map (`WaterField.expectMap`; a bare WaterField keeps its
old timing). **Now 0.65 m at 3 s, 1.06 m at 8 s, 1.14 at 12 s, 1.18 at 150 s.** Test (`water.test.mjs`, P20): Hs at 8 s at
least 0.8 of Hs at 60 s (the head: 0.16 against 0.64; now 1.06 against 1.17).

**3c. No raindrop rings on a running sea (`particles.js`, `index.js`).** The same strip drew crisp rain rings all over a storm
sea. A raindrop's ring shows on still water and is lost among the waves of a sea that is running; physics made a ripple for
every drop that hit liquid, whatever the sea. Now `index.js` hands the particles the calm of the liquid about the focus
(`seaCalm01 = 1 - smoothstep(0.1, 0.5, Hs there)`, the map's local Hs, so a calm lagoon keeps its rings in a storm) and a
ripple's strength is scaled by it (none under 0.02). Test (`water.test.mjs`, P20): 30 m off the coast in a gale (Hs 1.11 m) 0 of
50 ripples kept; in a calm (Hs 0.00) 50 of 50. How the rings look where they are kept (crisp, near-white, region 6) is
PAINTER's (kitmat.js): For PAINTER.

**4. PAINTER's wiring (`c08dddb`) against physics (item 3).** Read line by line against P18 A and P19: `uPhysSeaMap` a 17 x 51
float DataTexture over the same array, re-uploaded when `mapVersion` moves (it moves at every compose, so the texture is never
a frame behind the twin); `uPhysSeaGrid`, `uPhysSeaGrid2`, `uPhysSeaBand` copied (the grids zeroed with no physics); the
water material defines `PC_PHYS_SEA_MAP`; the vertex stage's shoal reads `pcPhysSeaLocal(vBody).x`; the fragment stage reads
`sea` for every `uPhysWaterSea`, `sdir` for `uPhysWaterDir`, `pcPhysWaterCrestAt` / `pcPhysWaterSurfAt`. Compiled by PAINTER
in the game (36 programs, no link log). Where the drawn sea and physics differ, and whose: (a) the floating explorer: mine,
fixed (3 above); (b) the ship's gear stands on the still level (`ship.js` stepShipGear: the liquid is a floor at
`liquidRadius`): mine, not changed (Not done 3); (c) beyond `carry` (2.2 to 6 wavelengths of the short trains from the eye)
the shader drops the short trains and physics keeps them: nothing physics floats there is drawn (the focus is the eye's
body), no change; (d) spray and surf: physics' surf and spume read the same local sea (`surfAt`, `localAt`) as
`pcPhysWaterSurfAt(vDep, sea)`, so they break where the shader draws the surf, by construction; seen in `game-float-neptune` and `game-float-earth`.
`coast.mjs`: on `c08dddb` (before PAINTER's coast terrain) both NOT YET as in P18 (Neptune 80 m out 0.71 m over 778 m;
Earth's stand of then found its strongest wind at 6.3 m/s); on **`418ac5b` (PAINTER 12's coasts 1b-1d) with this block's files:
both PASS** (Earth sea_coast: the storm 13.2 m/s from the E at 8850 s, 80 m out fetch 2309 m, Hs over the 0.51 m mark, white
over 2.96 %, surf at the waterline; Neptune storm_seas: 75 m/s from the E at 240 s, fetch 2500 m, 30.6 m deep, Hs over 3.14 m,
white over 9 %). **`coast.mjs` against the frame.** The sea the frame shows on arrival is lower than `coast.mjs`'s: Neptune 25 m out 0.78 to
1.03 m after 10 s of clock (`coast.mjs` 2.84 m 20 m out, 3.18 m 80 m out, after its 150 s settle); Earth 0.13 to 0.16 m (about
0.5 m). The cause is 3b's: the sea waits to be measured, and in the game, on this loaded machine, sampling is rationed by time
(`QUALITY.sampleMs`), so the far rose finishes late. After the floats were filmed I made the quick settling wait for a map
built with the far rose FINISHED (seamap.js `target.roseReady`, `WaterField.seaMeasured`, the cap `arriveWait` 20 s): on
PAINTER's real Neptune coast in Node (`s/arrive-real.mjs`), Hs 25 m out **2.94 m at 4 s, 4.88 m at 8 s** with fast sampling,
**3.06 m at 10 s, 5.19 m at 15 s** with 150 us a sample (before: 2.48 and 3.97 m; the head: the sea rose over minutes). The
floats were not re-filmed after that last step: a strip of a coast should still wait 15 s of clock after arriving.

**5. Milestone 3's Moon boulder run, in the game.** PILOT's `tests/boulderrun.mjs` on a clean export (`exp/`), crater_fields'
densest field near the stand (19 low boulders within 28 m, tallest 1.01 m; 160 m W, 280 m S of the stand), Shift+W 12 s in
8 headings, 30 steps a second, quality 0, real keys: **no run throws the body more than 0.172 m above where its feet left the
ground** (heading 225, over a 0.99 m boulder, the feet 0.097 m over the ground); headings 0, 90, 270, 315 never more than
0.01 m off it; pace 5.4 to 6.4 m/s (top 7.4), never stopped. PILOT's script FAILS its boulder clause on three flights, each
off a crater wall: heading 45 feet 1.71 m up for 1.63 s (the ground fell 2.68 m, left at 4.1 m/s on 37 degrees), heading 135
7.09 m (fell 10.4 m, 44 degrees, at 4.3 m/s), heading 180 3.07 m (fell 3.21 m, 43 degrees, 6.2 m/s); the body rose 0.009 to
0.017 m in each: not thrown. They count against a boulder because one stood within 1.5 m of the feet. Replayed in Node
(`s/trace8.mjs`, PILOT's Sim on the same ground, the game's numbers to a few cm: 2.02 / 7.12 / 3.07 m, thrown 0.164 m) and then
**with the boulders taken away: the same three flights, 2.09 / 7.35 / 1.79 m**. They are the slopes': on the Moon a run cannot
follow a convex edge sharper than v^2 / (g cos theta), about 29 m of radius at 6 m/s on 40 degrees (5 m on Earth); a runner
there leaves the ground. **Verdict: the 0.3 m rule is met by everything a boulder does (0.172 m at most, thrown; no boulder
lifts the feet over 0.1 m); the rim flights are physics, review 6's item 7, and I keep them** (Decision 50). For PILOT: the
script's classification, exact change in For PILOT.
*Two things the game run shows that are not the 0.3 m rule's* (`s/aheadgame.mjs`, `s/waydbg.mjs`, PILOT's Sim on the same
field, 4 headings): the read-ahead held a pace in 52 and 123 of 360 frames on headings 90 and 270 and in none on 0 and 180;
and where it holds none the legs meet the ground braced: heading 180 at 9.2 s, after landing from the wall flight, the run
meets a concave kink from the crater floor onto a slope of about 29 degrees at 6.7 m/s, the legs reach their full fold (hip
-0.45 m) and brace five steps, **6.7 -> 2.2 m/s in 0.17 s**. The gate never fired: the way ahead was a long rise (1.5 m over
10 m) with no step within the read's 1.2 m span. Geometry asks less: only the speed into the new slope (6.7 sin 29, about
3.2 m/s) has to be taken up; the 5.9 m/s along it should carry on up the slope, slowed by g sin theta. So the brace takes the
whole speed where it should take the normal share. The same family as the close row's (c) and the boulder strip's 7.4 ->
5.1 m/s: one fix for the next agent (Not done 1).

**6. The strips (item 2; `docs/shots/physics/motion-*.jpg` with `.json`).** All opened.
- `motion-game-moon-boulder` (NEW, the GAME, `gamefilm.mjs`; the Moon, crater_fields' densest field, the tallest boulder on
  ground under 8 degrees: 0.70 m, radius 0.74 m; Shift+W from 6 m/s, 12 m of clear run-up; 30 frames, 0.1 s apart, simulated at
  30 Hz). Seen: the explorer runs out across a boulder field of violet-grey soft-edged boulders, a crater beyond, the ship to
  the right; pale puffs of dust at each boot; at the boulder (frames 14 to 17) the figure drops into a crouch over it, legs
  folded, and runs on; at no frame is it in the air; frames 26 to 29 PILOT's camera sinks behind a rise and the figure
  shrinks. Numbers (every step, not only the kept frames): **the feet 0.000 m over the ground at all 90 steps, thrown up 0**;
  but the face is taken at the full run, 7.40 -> 5.09 m/s in 0.1 s (the read-ahead held no pace: its trial crossed at 7.4 with
  the legs' catch), and a second boulder 4 m on 6.5 -> 3.2 m/s over 0.4 s. Verdict: the 0.3 m rule holds in the game; the
  knock at the face is P13's allowance (legCatch) at 30 Hz, three steps of it: a runner on the Moon would slow for a 0.7 m
  rock, which is the close row's cause (c) again (item 7).
- `motion-game-moon-boulder-side` (NEW, the GAME; the same boulder met 0.45 m off its middle, P17). Seen: the explorer runs
  out, crouches early (frames 2 to 5) over a bump near the start, passes the boulder in a shallow crouch (frames 20 to 22) and
  crouches again on the rock 4 m beyond; never in the air. Numbers: feet 0.000 m over the ground at all 90 steps, thrown up 0;
  at the boulder 7.39 m/s, legs folding 0.29 m, slowest within 3 m 6.69 (no loss: P17's off-path crossing in the game); the bump
  at the start 6.14 -> 3.51 m/s and the rock beyond 6.22 -> 2.37 m/s, both braced with no pace held (item 5's finding).
- `motion-tree-gust` (re-filmed and OPENED; the painted lab, PAINTER's trees, Earth spawn 143 to 149 s, a frame every 0.5 s).
  Seen: birch crowns as soft green masses, white trunks, a grey sky, many leaves falling as dark-red and orange dabs (the
  nearest large, fairly hard-edged ellipses, but leaves); the crowns barely change from frame to frame, the leaves move.
  Numbers: the 10 m wind 3.3 to 7.1 m/s (the weather's epoch has moved: this clock is no longer the first storm's gust front),
  the trunks' lean 1.6 to 3.4 and 4.6 to 9.9 degrees over 2 to 3 s, branch tips 4 to 8 cm. Verdict: right: birches in 5 to 7
  m/s barely move at the branch; what shows is the leaves (P11's calibration: a 3.5 m branch sets 0.06 m at 5 m/s). The
  subject's note is stale (its clock); the storm's crowns are `game-tree-sub`.
- `motion-clamber-walk-moon` (re-filmed and OPENED; the lab's stand-in, now with knees; the Moon, a walk at 4.2 m/s over a 1 m
  boulder). Seen: the figure walks in, steps up onto the mound (frames 13 to 16), crosses its top with the legs folded, steps
  down and walks on, knees bending, legs alternating. The feet with the legs' fold counted (up - hip) stay within 0.1 m of the
  rock. Kicked dust lingers behind 2 to 2.5 s as soft round puffs. Verdict: the clamber is right and continuous; the dust's
  time in the air is ballistic (physics flies it without drag in vacuum: grains kicked at 2 m/s are 2.5 s up at 1/6 g), but
  drawn as round soft clouds it reads as smoke: in vacuum a kick is a fan of grains on sharp arcs that keeps its shape and
  falls (For PAINTER).
- `motion-clamber-run-moon-side` (NEW; the lab; the Moon, a run at a 1 m boulder met 0.45 m off its middle: P17's case). Seen:
  the stand-in slows before it (3.78 -> 3.12 m/s, the pace held for the face: 3.12), runs over the boulder's flank (feet up to
  0.73 m, legs folding 0.28 m), no step losing speed, and runs on; the dust gathers into a long low band lingering along the
  ground 2 to 3 s after it has gone (ballistic again; reads as fog). Verdict: P17's off-path crossing is right: no brace, no
  hold, contact throughout.
- `motion-clamber-row-moon` (NEW; the lab; the Moon, P19's close row, a run). The framing is wide (15 m off, 60 degrees) and the
  figure small, but it can be followed over the cones: mound 1 frames 7 to 13 at the pace held (2.66 m/s, no loss), mound 2
  rising 2.7 -> 3.1 m/s, mound 3 (1.1 m) with a held pace of 5.5 (no slowing) met braced, 3.76 -> 2.46 m/s in 1/8 s, then onto
  mound 4. Verdict: a continuous clamber with one face met braced, too small to see at this framing but in the numbers: item 7.
- `motion-game-grass-sub` (NEW, the GAME; Earth spawn at 176 s, the storm, 11 m/s at 10 m; 30 frames a second for 0.4 s: the
  sub-second motion never seen in the game). Seen: the explorer from above and behind in a meadow of dark grass strokes, rain;
  from frame to frame the strokes shift and change slant a little, none appears or vanishes: smooth, no flicker. Numbers: the
  wind half a metre up swings 3.5 to 9.2 m/s within the 0.4 s, three of four blades' leans move 8 to 15 degrees (15 -> 30.5,
  45.6 -> 53.6, 29.7 -> 41.4), here.air 6.4 to 10.6 m/s. Verdict: the grass moves under a second as a meadow in gusts does,
  continuously. One fault: small crisp white rings all over the grass: splash events drawn as rings. A raindrop leaves no ring
  on a meadow (the blades take it), and white lines fail the art bible. Physics makes a splash wherever rain meets ground:
  it should make none on grass, litter or moss (Not done 5). (The crop runs into the paper border at the bottom.)
- `motion-game-tree-sub` (NEW, the GAME; Earth spawn at 167 s, the storm's height; the camera looking up into the crowns, 15
  frames a second for 1.6 s). Seen: birch crowns left and right, a storm sky, rain streaks, leaf dabs; frame 21 is paler all
  over (a lightning flash). Frames 0 and 20 compared at full size (`film/tree-sub-0-20.png`): the right crown's edges and inner
  dabs have moved, the left is nearly still. Numbers: the 10 m wind swings 11.7 -> 9.2 m/s within 1/15 s (the sub-second
  octaves at a point), the trunks ease 3.56 -> 1.47 and 7.12 -> 2.77 degrees over 1.6 s as a gust passes (the top of a 13 m
  tree about 0.9 m), the branch clock runs. Verdict: right: crowns sway by the gust, leaves and rain carry the storm; at 1.6 s
  the sway is a few pixels at this size, which is what a tree 10 m off moving under a metre in that time looks like.
- `motion-game-storm` (THE STORM FRAME, re-shot in the GAME at last; Earth spawn, the first thunderstorm at 240 s, standing,
  the top tier at 960 x 540, four frames 0.1 s apart). Seen: a dark indigo sky of heavy cloud, the birch wood in deep green
  masses, a pale band of mist along the trees, rain everywhere as slanted pale strokes, the meadow and the path darkened, the
  explorer in the grass, the ragged painted border; darks indigo and green, never black; the four frames differ only in the
  rain. Numbers: thunderstorm, 22.6 mm/h, 2945 drops, overcast 0.99, wet 0.99, storm 0.84, 6 to 7 m/s at 2 m, 8 to 10 m/s at
  10 m. Verdict: passes the freeze-frame test as a storm study; P10's complaint (the sun out and the ground dry under the
  storm) is gone: the sky, the light and the wet ground carry it. The one fault: a few small white rings on the grass at the
  feet (Not done 5).

**7. The close row (P19's open item 2), diagnosed, not fixed.** Measured (`s/rowloss.mjs`, P19's row, 7.4 m/s wished): on
Earth at 60 Hz the run loses over 0.3 m/s in 14 steps, all braced (four steps of 0.49 m/s in a row at a face: about 2 m/s in
1/15 s), at 30 Hz 13 (12 braced; two steps of 0.98 m/s a face); the Moon 9 and 8. The same boulders 5.2 to 5.6 m apart: 0 on
Earth. A runner who sees a boulder 2.6 m ahead slows for it; a player feels this as a stumble at every face, so it is worth
fixing. Three causes, traced step by step (`s/rowdbg.mjs`): (a) **noTry**: probeStart tries only what comes down again, and
judged that by the profile's LAST sample; in a close row the profile ends on the next boulder, as high as this one, so the
boulder is read as a hill that goes on rising, not tried, and no face is held (`A -` at the face); fix: the lowest ground past
the top, not the last sample; (b) **the gate** `rise = hF - h1 - slope d` is measured from the ground under the walker, still
high on the last boulder; fix: from min(h1, hN); (c) even with both, the face is tried (meet it at 3.60 m/s) but the walker
arrives at 3.72 m/s and still braces two steps of 0.5 m/s. With (a) and (b): Earth 60 Hz 14 -> 10 braced, 30 Hz 13 -> 6, the
Moon 60 Hz 9 -> 11 (worse), 30 Hz 8 -> 4 but the row slower. Mixed, and P17's tuning would have to be re-proved: reverted. The
next agent: (a) and (b) as above, then (c) (the ghost's run-up from the walker's own state and pace, not the valley's), and
re-prove P17 (`p17off.mjs`, `pathsame1.mjs`) and P19 (`ghostfield.mjs`).

**8. `physics.water()` at 1 km (P19's open item 4).** Nothing in the game calls it (PILOT, PAINTER: no caller in `src/`; only
physics' tests); the floating body reads `waterLevel`, the shader the map and trains. A player cannot meet the 0.1 m step at
1024 m from the focus. Left.

**Not done or not verified.** (1) The close row (7), and the brace that takes the whole speed at a face or a concave kink the read-ahead did not hold (5): on the Moon 4.5 m/s in 0.17 s; the next agent should start here: the legs' catch should take up the speed INTO the new ground, not along it. (2) PAINTER's coast fix came in during this block (`418ac5b`); `coast.mjs` passes both stands on it and the float strips were filmed on it. (3) The ship's gear stands on the liquid's still level while the drawn sea heaves
(`ship.js` stepShipGear): making its floor `env.waterLevel` would heave a ship landed on water, and PILOT's landing sequence
and the gear's sleep (LANDED) would have to be checked with PILOT first: asked in For PILOT. (4) PILOT's `boulderrun.mjs`
still reports the rim flights as a boulder's (For PILOT). (5) Rain makes a splash event wherever it meets ground, and they are
drawn as crisp white rings on a meadow (`game-grass-sub`): a drop leaves no visible ring on grass, litter or moss; the particles
would need the ground's material where a drop lands, or at least at the focus (`physics.ground` there): not done. (6) The read-
ahead holds no pace on some headings of the Moon field (5): part of (1). (7) The lab row strip's framing is too wide to see
the stumble (numbers only). (8) No frame rate on a real GPU; every strip is software GL by its own clock.

## Hand-over P19 (seventeenth PHYSICS agent; read this block first; P18 and older below hold for everything not named here)

**Where things stand.** The block was PILOT 9's review 7 (code), `docs/lead/REVIEW.md`: item 1 (MUST FIX, finding 1, the ghost
overwrote the walker's scratch), item 2 (SHOULD FIX, finding 2, SeaMap.rebase) and item 3 (SHOULD FIX, finding 3, the shown sea
map stepped when a build landed) are done, committed and proved with PILOT's own scripts (`docs/lead/evidence/review7/`), and a
fourth fault found while proving item 1 is fixed too (item 1b: the ghost was set down in the air in a boulder field, so the run
crawled). Node only, as told (the art pass holds the machine; load 6 to 11): no browser, no picture, no strip, no PC_TIMING
suite. Commits: `976b954` (item 1), `40f8f7d` (items 2 and 3), `b5db96b` (item 1b), and this hand-over. Tests: `node --test
src/physics/` 291 pass (288 + 3 new: explorer.test.mjs 1, seamap.test.mjs 2; load.test.mjs among them), `node --test
tests/*.test.mjs` 140 pass, on a clean export of the hand-over's commit (`tools/export-head.sh`). Every new test fails on the
head before P19 (`d762581`; checked by running it there). Scratch: `/home/user/.pc-scratch/physics/p19/` (`head/`: an export of
`d762581`; `pre/`: P19 before item 1b; `ghostcpu.mjs <tree>` the ghost's CPU, `PLACE=x,y,z`, run under `node
--single-threaded`; `pathsame.mjs`, `pathsame1.mjs` (`OFF=`, `GS=`) the walker's path compared to the last digit between trees;
`p17off.mjs` P17's cases off the x-z plane and the boulder row; `rowspeed.mjs`, `crawl.mjs` the row, step by step;
`seamsteps.mjs`, `seamsteps-speed.mjs` (`SPEED=`, `SECS=`) the sea map's steps by kind of frame; `bandsize.mjs <tree> <m/s>`;
`composecost.mjs`; `reanchor.mjs`, `frame.mjs` the frame's re-anchor).
**Next, in order:** (1) when the machine is free, P18's Next 1 to 4 still stand (film and OPEN `tree-gust`, `clamber-walk-moon`,
the storm frame; `PC_TIMING=1 node --test src/physics/` at a load under 8; a coast once PAINTER has wired the map; `coast.mjs`
after PAINTER's coast fix; `clamber-run-moon` with a boulder off the line), and add a strip of a run through a boulder row on the
Moon and on Earth (P19's test row: `explorer.test.mjs`, P19); (2) the faces a close row hides (see "Not done" 2); (3) the frame's
re-anchor is a translation only near the anchor (see "Not done" 3): every field, and the waves' phases, step by up to 1.2 m
120 m from the new anchor on a 4 km world.
**API added (additive):** water.js `uniforms.uPhysSeaBand` [centre x, z, half-width east, north] (frame m; GLSL, behind
`PC_PHYS_SEA_MAP`: `uniform vec4 uPhysSeaBand`, and `vec2 pcPhysSeaWarp(vec2 g, out mat2 Jt)`), `SEA_TEX.margin`,
`SEA_TEX.relax`; seamap.js `SEA_MAP.edgeZero`, `SeaMap.target.nextOn`, `.nextX0`, `.nextZ0` (the inner grid of the build under
way). PAINTER must copy `uPhysSeaBand` when the map is wired ("For PAINTER", P19: three lines). Nothing removed or renamed.
**Behaviour changed without a call changing:** (1) the explorer's `st.phys.material`, `.friction`, `.sink` and `.dust` are the
ground where the step ENDS (they were the ground where it began: a step late at every boulder edge); (2) a run through a
boulder field no longer gains radial speed or strays off its line (off the x-z plane), and no longer crawls at 0.5 m/s to a
boulder whose profile begins on the boulder before; (3) where the sea map's inner level gives way to its outer one moves
continuously with the focus (a band inside a rectangle), and the inner level's turns fade across that band: at walking pace
the inner level is whole within 83 to 92 m of the focus (measured; it was 85 to 112 m by the old band's geometry, by where
the focus stood in its grid and how far the grid lagged), and the
turns die out a cell further in (`SEA_MAP.edgeZero`); the P18 lagoon test's open shore 0.43 -> 0.40 m (its points now lie in
the band), the beach's turn 39/34 -> 40/35 degrees; (4) after a re-anchor the next build keeps the waves' crests where they
were (finding 2).

**1. The ghost keeps to its own scratch (review 7, finding 1, MUST FIX; `explorer.js`, `976b954`).** P17's ghost runs the body's
own step from inside the walker's step (wayAhead -> probeTrial -> ghostCrosses -> stepExplorerBody), and both wrote one set of
module scratch: each trial left the walker's `_dir` (its up at its new place, which lays the velocity along the ground while it
clambers) and `_gnd` (its ground: material, friction, sink, dust) those of the ghost's far point. Off the x-z plane (the ghost
runs on the great circle through +z, so P17's test, in that plane, could not see it) a run through boulders gained radial speed
with its feet on level ground and strayed off its line. The fix makes the separation structural, not a save and restore:
- *The step's scratch is an argument.* Everything a step writes and reads back (the direction it sampled last, env.ground's out,
  the air and the receiver, a point read ahead, gaitOf's out) is one set (`stepScratch()`) handed down to every function the step
  calls (`stepBody`, `stepOnce`, `groundAhead`, `wayAhead`, `probeStart`, `stepGait`). The walker's steps use `_walkS`, the
  ghost's `_ghostS`; no module-level `_dir`, `_dir2`, `_gnd`, `_air`, `_recv` or `_gt` is left for anything to reach.
- *The ghost never calls the walker's env.* `probeStart` asks `env.ground` once for the far point's surface, into the probe's own
  object (`Q.G`); the ghost's env returns it (PILOT's review: the ground call was most of a trial's cost).
- *The ghost lays no stride* (the gait is output only: P13's test proves the path is the same without it) and reuses one body
  state (`_gB`, reset from a frozen template): no garbage a trial.
- *The ground reported is where the step ends* (material, friction, sink, dust): the step that comes down on a boulder's rock
  reports rock. It is kept with the place, and the next step starts on it while the body is still exactly there, so it is still
  one env.ground call a step (two when PILOT's obstacle push has moved the body between steps).
- *Proof* (`ghostfield.mjs`, PILOT's eight boulders, 6 m/s, a 4 km sphere; head `d762581` -> P19): radial speed while grounded
  1.13 / 0.88 / 0.74 / 0.58 -> **0** m/s (at (0.3, 0.9, 0.3) Earth / Moon, (0.8, 0.2, -0.55) Earth / Moon), off the line 0.91 /
  2.35 / 0.23 / 0.81 -> **0** m, steps reporting a material not under the feet 23 / 9 / 17 / 17 (17 / 11 in the x-z plane) ->
  **0** everywhere, steps in the air 0 -> 0, worst speed lost in a step 2.17 / 1.71 / 0.53 / 0.48 -> 0.49 / 0.48 / 0.49 / 0.48
  with item 1 alone (0.55 / 0.52 / 0.55 / 0.52 with item 1b: see 1b). With item 1 alone the walker's path was the same to the last
  digit as PILOT's checked fix (`fixed2`, which saves and restores both around the whole wayAhead call) in all 12 cases (three
  places, Earth and Moon, 60 and 30 Hz).
- *The ghost's worst CPU in a frame* (PILOT's 14-boulder field, the Moon, physics' own ground through bindEnv as the game's env;
  process CPU under `node --single-threaded`, so no helper threads; the worst frame in which a trial ran, median of 20 runs (their
  least and largest); load 6 to 9): in the x-z plane, where head and fix run the same path, 60 Hz 6 m/s **0.75 ms (0.62 to 4.5)
  -> 0.15 ms (0.12 to 0.23)**, 30 Hz 6 m/s 0.50 -> 0.16, 30 Hz 7.4 m/s 0.32 -> 0.16; at (0.3, 0.9, 0.3), 30 Hz, 0.54 / 0.31 ->
  0.16 / 0.16. (The largest runs of the head include main-thread compiles, which `--single-threaded` puts in the frame.) A frame
  without a trial: 0.004 ms either way.
- *Kept, P17's results*: no brace and no hold off the path, the feet never leave the ground: P17's single boulder met 0 to 0.55 m
  off the path on the Moon, Mars and Earth, now also at (0.3, 0.9, 0.3) and (0.8, 0.2, -0.55): brace 0, holds 0, 0 steps in the
  air, feet 0 m up (scratch `p17off.mjs`).
- *Test* (`explorer.test.mjs`, P19): the row of eight boulders laid off the x-z plane at two places, Earth and Moon, 60 and 30 Hz:
  radial speed with the feet down under 0.05 m/s, under 0.05 m off the line, every step's material the ground under the feet, no
  step in the air, no frame losing more than legCatch + braceAccel, and (item 1b) never slower than 1.5 m/s past the first
  boulder. Fails on the head (1.13 m/s radial), passes.

**1b. The ghost is set down on the ground in a boulder field (found proving item 1; `explorer.js`, `b5db96b`).** With item 1 the
row's run still crawled, in the x-z plane as off it and on the head as after: on Earth at 0.50 m/s from 17.8 m on (19.6 m in
9 s), on the Moon at 1.03 m/s. Cause (traced trial by trial, scratch `crawl.mjs`): when the profile of the boulder ahead begins
on the far flank of the boulder the walker is coming off, `probeStart` found the start of the rise as the first sample 5 cm above
the profile's FIRST sample, which lies past the valley, partway up the next boulder; `ghostCrosses` then set the ghost down there
at the first sample's height, in the air; every trial failed at its first step ("AIR"), and the pace fell to the least, 0.5 m/s.
Now the rise starts at the valley (the lowest ground before the top, when the profile falls into it by more than 5 cm), the
ghost's run-up lies on the valley's floor (that descent is the last feature's: a ghost run off it at speed leaves the ground),
and the ghost is set down at the profile's own height where it starts (`profileAt`). A boulder met from level ground (no fall
first) is tried exactly as before: 72 runs (one boulder 0 to 0.55 m off the path, three places, three gravities, 60 and 30 Hz)
the same to the last digit (`pathsame1.mjs`). The row: slowest pace past the first boulder 0.50 -> 2.34 m/s (Earth, 60 Hz), 1.03
-> 1.74 (Moon), on to 29.2 and 22.0 m in 9 s; the ghost's worst frame halves again (above). The run now meets the faces of a
close row faster, so the worst speed lost in a step is 0.55 / 0.52 m/s (the legs taking a face up at legCatch, 0.50 a step at
60 Hz, as P13 allows).

**2. The crests stay put through a re-anchor (review 7, finding 2; `seamap.js`, `40f8f7d`).** `SeaMap.rebase` moves the published
target into the new frame (`x0`, `z0`, `x02`, `z02`, `refX`, `refZ`) as `WaterField.rebase` moves what it shows, so the next
build warm-starts its warp node by node and keeps its free constant. `seamap-seams.mjs` part B (an oblique beach, a walk at
6 m/s, the warp 50 m out): moved in the 5 s after each of two re-anchors **14.59 / 17.10 m -> 2.44 / 2.34 m** with this alone (a
typical 5 s: 2.91 -> 2.81 m), 2.21 / 1.95 m (typical 2.36) with item 3 too. Test (`seamap.test.mjs`, P19): under twice the typical
5 s after the re-anchor; fails on the head (14.6 against 3.1), passes.

**3. The shown sea map does not step when a build lands (review 7, finding 3; `water.js`, `seamap.js`, `40f8f7d`).** The three
causes, each fixed in the JS and in its GLSL twin (water.js is mine):
- *(a) The band between the levels moved in whole cells.* It is now a rectangle (`uPhysSeaBand`: centre, half-widths) whose every
  edge moves continuously: each lies `SEA_TEX.margin` (a quarter cell) inside the shown inner grid, inside the grid of the build
  under way (`target.nextX0`, `nextZ0`, from its snapshot: it is shown when it lands) and inside any grid a build could start on
  now (centred on the focus's nearest node, so within 7.5 cells of the focus). A build landing only drops a grid from these, and a
  build starting adds one no tighter than the focus's own term, so no edge ever has to step inward; an edge moving outward goes at
  `SEA_TEX.relax` (a quarter cell a second) or the focus's speed, if faster. The inner level's share falls from 1 to 0 over 1.5
  cells inside the edge (`pcPhysSeaP` and `_seaAt`). A first try (a square about the focus, inset by its offset from the grids'
  centres) swept its trailing edge at twice the walking speed and doubled the steps of ordinary frames; the rectangle sweeps at
  the walking speed. Sizes (`bandsize.mjs`): standing, every edge 116 m from the focus; at 6 m/s the nearest 107 to 108 m; at
  50 m/s the leading edge 4 to 15 m ahead (the shown grid then lags 1 to 2 s behind the ship: so did the old band, at its edge).
- *The warp, through the band.* The warp exists only on the inner level and a place that left it lost its turn at once. Now each
  node of the warp rows holds the shown warp read where the band lets it be read: at the node itself within the band's inner edge,
  beyond it at a place drawn in toward it (each axis: d -> r0 + b (u - u^2 / 2), u = (|d| - r0) / b, held at u = 1). So the turns
  fade across the band (C1) and are gone beyond it, every value shown comes from inside the band (from nodes both the shown grid
  and the next hold), and a place reads its own cell: its warp and turn change only as smoothly as the band moves. (A first try
  pulled the READ point in per fragment; the point then crossed cell lines as the band moved and the bilinear Jacobian stepped 2.1
  degrees in a frame; doing it at the nodes avoids that and leaves the shader a plain tap.) The builder's turns now die out a cell
  short of the grid's edge (`SEA_MAP.edgeZero` 1, then `edgeTaper` 2.5 as before), so where the warp is read farthest out it holds
  no turn and nothing is carried beyond the band.
- *(b) New nodes snapped to the build.* A node new to the inner level starts from the outer level's shown value at its place (the
  band keeps the inner level off every node a build adds or drops, so the outer level is what was shown there), a new warp node
  from the edge it extends; then both ease to the build like the rest.
- *(c) The outer level snapped after a re-anchor* (its lattice moves by X mod 128 m). It is now read at its new nodes from what
  was shown (bilinear, held at its old edge); a build that comes without its outer level leaves the old one shown.
- *Proof* (`seamap-seams.mjs` part A, a coast with lagoons, 6 m/s for 150 s, `physics.water()` at a place 60 m out and one in a
  lagoon; head -> P19): steps over 0.02 m or 2.9 degrees **9 -> 0**, on build frames **9 -> 0**; p99 of the other frames 0.0036
  -> 0.0041 m. By kind of frame (`seamsteps.mjs`): the largest Hs step on a build frame 60 m out **0.242 -> 0.0048 m** (other
  frames: at most 0.0047, p99 0.0041), in the lagoon **0.1285 -> 0.0058 m** (0.0057, 0.0042); the waves' way on a build frame
  8.35 / 27.91 -> **0.05 / 0.61 degrees** (other frames at most 0.05 / 0.60). At 50 m/s (`SPEED=50 SECS=26`, within the map's
  query reach): build frames 0.113 / 0.041 -> 0.0034 / 0.0062 m, 38.9 / 13.1 -> 0.12 / 0.47 degrees. Test (`seamap.test.mjs`,
  P19): part A's places for 100 s, a build frame's step no more than 1.5 x the largest of the other frames (or 5 x their p99), the
  way no more than 1.5 x theirs (or 0.5 degrees); fails on the head (0.242 m), passes.
- *Cost*: `_composeMap` 77 to 82 -> 88 us a frame (the warp rows read through the band); `attachMap` 12 -> 29 us a build (about
  one a second) (`composecost.mjs`, load about 10).
- *The twin*: the refraction test's check that surfaceAt's slope is heightAt's gradient now skips samples within 0.16 m of a line
  of nodes (k = 31 lies on one to the last digit: the bilinear twin's slope is each cell's own there, and a central difference
  straddles two; it read 0.0034 against the 2e-3 bound once the map changed, on that sample only).

**Not done or not verified.** (1) No GLSL was compiled (no browser was mine; no offline compiler here): `pcPhysSeaP`, the new
`pcPhysSeaWarp` and `uPhysSeaBand` were read, not compiled; the map is still not wired by PAINTER, so nothing in the picture
changed. No strip, no picture, no PC_TIMING suite (load 6 to 11). (2) *A close row hides its next face*: in the row the run still
meets some faces braced (a step losing 0.50 m/s, legCatch's take-up: P13 allows it): coming off one boulder, the next (2.6 m on)
never rises more than the fold above the ground under the walker, which is still high on the first, so wayAhead does not read it
as a feature (`rise > legFold` is measured from that ground). Not changed: a fix wants the rise measured from the valley ahead,
and P17's tuning re-proved. (3) *The frame's re-anchor is a translation only near the anchor*: on a 4 km world a fixed ground
point 120 m from the new anchor (490 m from the old) lands 1.2 m from where the fields put it (`reanchor.mjs`; the frame's own
re-anchor of a lone point is exact, `frame.mjs`: it is the ground-to-grid mapping of the old frame against the new). Every field
and the waves' phases step by that in the re-anchor frame; the sea map's band makes it show as an Hs step of 0.0185 m in the
lagoon on that frame (0.0037 on the head, where the place lay outside the band). Not mine to change in this block. (4)
`physics.water()` switches from the map to the far estimate 1024 m from the focus (P18): a step of 0.1 m there (seen at 50 m/s).
(5) After a re-anchor the outer level's resample leaves a few mm (0.006 m in Hs 330 m out at 50 m/s) on the first build. (6) The
row of finding 1 was measured in Node on a synthetic row, not filmed in the game.

## Hand-over P18 (sixteenth PHYSICS agent; read this block first; P17 and older below hold for everything not named here)

**Where things stand.** Items 1 (the sea's open items: the sea map, the turn toward the longest fetch, refraction, the coast
report for PAINTER), 2 (sub-second gusts), 3 (the wind grid's garbage, bit for bit) and 4 (the lab stand-in's knee) are done
and committed. Item 5 (film and OPEN `tree-gust`, `clamber-walk-moon`, the storm frame; the PC_TIMING suite) is NOT done: the
coordinator had not released the machine (the art pass and PAINTER 11 had it; load 13 to 16 throughout) when items 1-4 were
done, so as told I wrote this and ended. Nothing in this block was looked at in a browser: no picture was made, the new GLSL
was never compiled (see "For PAINTER", P18). Tests: `node --test src/physics/` 288 pass (279 + 9 new: seamap.test.mjs 6,
wind.test.mjs 3; load.test.mjs among them: every module loads alone, no import cycle), PILOT's `node --test tests/*.test.mjs`
140 pass, on a clean export of `f6eaa17` (`tools/export-head.sh`). Not run under PC_TIMING (load 13 to 16). Scratch:
`/home/user/.pc-scratch/physics/p18/` (`coastsyn.mjs <root> lagoon|beach|lake [secs] [windScale]`: the sea map on synthetic
coasts, `DUMP=u,v` for a node's radials and the depth map; `stagecost.mjs`: the builder's cost by stage; `alloc.mjs`:
garbage a frame of physics.update and AirGrid.update (`node --expose-gc --max-semi-space-size=128`); `ident.mjs`,
`ident2.mjs`: the wind grid's checksum over a run (item 3's proof); `subspec.mjs`, `airloop.mjs`: the point wind under one
second; `head/`: an export of `9b5c941`, the head before P18).
**Next, in order:** (1) item 5 when the machine is free: film and OPEN `tree-gust`, `clamber-walk-moon` (now with the knee) and
the storm frame; run `PC_TIMING=1 node --test src/physics/` at a load under 8; (2) once PAINTER has wired the sea map (For
PAINTER, P18), film a coast with a sheltered bay (`shore-*`, `sea-out-*`) and judge it; (3) re-run `node src/physics/coast.mjs`
after PAINTER's coast fix and say whether the surf is back (the targets are below); (4) re-film `clamber-run-moon` with a
boulder off the line (P17's Next 3, still open).
**API added (additive):** `physics.air(bodyId, p, out, height, recv?)` and `env.air(p, out, height, recv?)`: `recv = { size
(m), vx, vy, vz }`, what feels the air (default: a point at rest); `airAt(..., devils, recv)`. `physics.water()` now reports
the sea AT p (as far as the map reaches, 2 km) and three more fields: `waveHs` (the wind sea there, m), `open` (how far the
open sea's swell reaches there), `nodeDepth`. `physics.fields.water.local(p, out)` (water.js `localAt`: significant, foamAt,
edge, cover, dirx, dirz, sW, s3, fetch, depth, Hs, open, heading, nodeDepth), `.surfAt(p, depth)`, `.map` (the builder:
`.target`, `.rose`, `.outer`, `.wp`, `.stats`), `.mapVersion`; `uniforms.uPhysSeaMap` (Float32Array 17 x 51 x 4),
`.uPhysSeaGrid`, `.uPhysSeaGrid2`. `.gauge` is kept (fetch, depth, radial, ready, final, samples, measured) and now reads the
map (the reference sea's fetch and depth, the far rose's 24 radials). water.js: `SEA_TEX`, `WaterField.attachMap`,
`.localAt`, `.mapVersion`; GLSL (behind `PC_PHYS_SEA_MAP`): `uPhysSeaMap`, `uPhysSeaGrid`, `uPhysSeaGrid2`, `pcPhysSeaTap`,
`pcPhysSeaP`, `pcPhysSeaLocal`, `pcPhysSeaDir`; and, outside the define, `pcPhysWaterCrestAt(w, sea)`, `pcPhysWaterSurfAt(depth,
sea)`. New modules: `seamap.js` (`SeaMap`, `FetchRose`, `SEA_MAP`), `coast.mjs` (`coastReport`, `COAST_TARGET`; a CLI). wind.js:
`GUST_SUB`, `gustSubAt`, `gustSubAmplitudes`, `gustNodes`; util.js `noise3q`; near.js `TerrainGrid.nearKnownQ`; testworld.mjs
`coastWorld`; index.js exports `SEA_TEX`, `SEA_MAP`. Lab: the stand-in's legs have knees (`LEG_THIGH`, `LEG_SHIN`).
**Behaviour changed without a call changing:** (1) the sea is no longer one state: every surface query (`fields.water.sample`,
`.heightAt`, `.runup`, `physics.water`, the floating explorer through bindEnv's liquid) reads the sea map where there is one;
the trains (the uniforms PAINTER's shader reads today) stay the sea of the water nearest the focus (P16's water point) UNTIL
something reads `uniforms.uPhysSeaMap` (a getter: PAINTER's syncPhysWater, once wired), and from then on they are the sea of the
MOST EXPOSED water about, which the map scales down everywhere sheltered; so nothing changes in the picture until the map is
wired, and a lagoon is never drawn with the open sea's waves (while unread, a node with a bigger sea than the focus's is that
sea's trains made higher, never steeper than 1 in 10: the JS twins far from the focus are approximate until then); (2) the wind sea turns toward its longest
fetch, so on Neptune's storm coast the waves at the beach come in from the open water to the south-east: at 50 s (30 m/s, P16's
window) 0.30 m where P16 had 0.21 m, at the storm's height (55 m/s, 240 s) 0.71 m; spray at the beach again (P17's `block.mjs`,
34-44 s, q2, the map unread as in the game today: 0 -> 347 drops); (3) the point air (here.air, the explorer's
wind load, the ship's air) has sub-second gusts; `here.air.turbulence` includes their share (higher near the ground: 0.27
-> 0.35 m/s at 2 m in a light wind), and loose.js's leaf and litter sweeps read it (leaves at the Earth gust front, q2: 1273 ->
1328); (4) the wind grid's fields are bit for bit as before (items 2 and 3).

**1. The sea (`seamap.js` new, `water.js`, `index.js`, `loose.js`).** As the brief asked: the sea varies with each point's own
fetch and depth, turns toward the longest fetch and refracts toward the shore.
- *The map*: two levels round the focus, the wind grid's 17 x 17 nodes 16 m apart (their ground is already sampled) and a new
  outer grid of 17 x 17 nodes 128 m apart (2 km; sampled only when liquid is near, within the old gauge's ration; resampled on
  a re-anchor: 128 m does not divide the 16 m lattice). At each wet node, eleven radials 15 degrees apart about upwind run over
  both levels' liquid until dry ground (half-cell steps on the inner level: a whole cell stepped over a barrier one node thick at
  a corner); a radial that leaves both levels wet is carried on by the far rose (24 radials, to the biome's cap, from the inner
  node that sees most open water upwind, kept by place: the P16 gauge's job, same ration), the far shore taken as square to the
  radial (a radial that ran to the cap: open water to the cap from anywhere). A heading's fetch: its radial and the two beside
  it (1/4, 1/2, 1/4: about the SPM's 24 degrees).
- *The turn toward the longest fetch*: the wind sea runs on the heading (up to 60 degrees off the wind) that makes the most of
  U cos(phi) over the fetch that way (fetch-limited H ~ U cos(phi) sqrt(F); fully developed (U cos(phi))^2): the slanting-fetch
  result (Donelan et al. 1992; Pettersson et al. 2010). Then windSea (SPM 1984, depth-limited) at that heading, its whitecaps
  from its own steepness; the open sea's swell reaches it as far as its fetch toward the wind over +-45 degrees is open.
- *Refraction and shoaling* (inner level): over the local contours (the depth's gradient), Snell (sin / c kept, c / c0 = tanh kd
  for each period), Ks = sqrt(cg0 / cg), Kr = sqrt(cos theta0 / cos theta); waves running off a shore are left alone; one way
  for all four trains, the wind sea's and the swell's by their energy.
- *How it is drawn*: the trains stay one set of waves (lengths and phases: the reference sea, the most exposed node's); per node
  the map scales the wind sea's three trains (sW) and the long one (s3), and holds the local foam level and white share; where
  the map turns the waves the trains are read at g + warp(g), the warp the least-squares fit of grad(warp) = R(-alpha) - I over
  the inner level (Gauss-Seidel with over-relaxation, warm-started, the free constant set so the crests move least), so the
  crests stay continuous lines that bend; the turns die out over the inner level's last 2.5 cells. Shown eased over 3 s, kept
  with its ground when the grid scrolls. Built in slices (marching, the sea per row, refraction, the warp, publish: about 20
  frames) when the ground, the wind or the far rose changes, at least every 4 s.
- *Numbers*, synthetic coasts (`seamap.test.mjs`, `p18/coastsyn.mjs`; Earth, a 21 m/s gale): **a lagoon behind a barrier**,
  3 m deep, 140 m and more from its mouth: Hs 0.07 m (fetch 73 to 142 m), no swell, white 2.2 %, against **the open shore beside
  it** 0.43 m (fetch 2500 m, the swell whole, white 5.9 %) in a 24 s run (0.60 to 0.66 m once the swell is up); within 100 m of
  the mouth 0.19 to 0.26 m (the open sea's fetch through the mouth, partly a leak of the 16 m grid round the barrier's end).
  **A long lake** (1200 x 200 m, 4 m deep) with the gale 45 degrees across it: the sea runs 21 degrees off the wind toward the
  axis, over 344 to 621 m of fetch (141 m straight downwind). **An oblique beach** (the wind 45 degrees onshore): the waves 54
  degrees off the shore's normal 200 m out (14 m deep), 39 at 40 m (2.5 m deep), 34 at 10 m (0.4 m deep). Snell alone would
  turn the wind sea to about 19 degrees at 0.3 m: the warp's fit smooths a turn that changes within two cells. The twin: with the
  map on, surfaceAt's slope is heightAt's gradient within 2e-3.
- *Cost*: the map 0.06 to 0.17 ms a frame on average on the synthetic coasts (slices 0.04 to 0.18 ms warm; cold first builds up
  to 16 ms, JIT and GC on a machine at load 13); physics.update at Neptune's storm coast, q2, main-thread CPU (P17's
  `block.mjs`, the better of 2 runs; head 0.75 and 0.81 ms in two sessions): 0.89 ms; nothing on a dry world (no samples, no build).
- *THE COAST REPORT for PAINTER* (`node src/physics/coast.mjs [root] [body:biome ...]`, default Earth sea_coast and Neptune
  storm_seas; about 13 s): finds the storm at the stand (the strongest wind in 9000 s, or `--t=`), runs the physics into it with
  the focus 2 m up the beach and prints, at the waterline and 20, 80, 200, 500 m out to sea, the fetch and the mean depth along
  it, Hs (all of it, and the wind sea), how far the swell reaches, the white-horse fraction, which way the waves run; the far
  rose; where the storms come from; the TARGET (the same storm over 2.5 km of water 20 m deep: the ruling) and PASS / NOT YET
  (80 m out: fetch >= 2000 m, mean depth >= 12 m, Hs >= 0.75 x target, white >= 0.6 x target; at the waterline Hs >= 0.25 m).
  On the tree as it stood (art pass under way):

  | stand | storm | 80 m out now: water depth, fetch, mean depth, Hs, white | target Hs (wind sea + swell), white | verdict |
  |---|---|---|---|---|
  | Neptune storm_seas | 55.4 m/s at 240 s, strong winds from E (5), ESE (3), ENE (2); the sea lies SE of the stand | 6.4 m, 778 m (turned SE), 10.9 m, 0.71 m, 10.6 % | 3.23 m (1.83 + 2.66), 15 % | NOT YET (fetch, depth, Hs) |
  | Earth sea_coast | 15.3 m/s at 5460 s, strong winds from ESE (9 of 17), E, ENE, SSE: offshore; the sea lies W | dry (the waterline faces a pool 2 m deep 20 m out) | 0.78 m (0.40 + 0.67), 6.8 % | NOT YET (all) |

**2. Sub-second gusts (`wind.js` `GUST_SUB`, `gustSubAt`; `air.js`; `explorer.js`, `ship.js`, `index.js` pass a receiver).**
The pattern's finest lattice is 5 m: under one second a point's wind held 0.1 to 0.2 % of its variance (measured at 2 and 10
m), where Kaimal's spectrum puts 4 to 10 % at 10 m and 10 to 25 % at 2 m. Now four more octaves (lattices 8.7, 3.5, 1.4, 0.55
m) are added at a POINT (airAt: here.air, the explorer's wind load, the ship), carried with the pattern (frozen turbulence:
deterministic), each weighted by Kaimal et al. (1972) at the point's own height over the canopy's displacement, of sigma_u = I
U10 (the surface layer's sigma_u does not change with height; I carries the roughness), along (f S / u*^2 = 105 n / (1 + 33
n)^(5/3)) and across (17 n / (1 + 9.5 n)^(5/3)); the first octave carries only what the spectrum wants below 10 m beyond what
the pattern (fitted at 10 m) holds there. A receiver of size D averages eddies smaller than itself (Davenport's admittance 1 /
(1 + (2 D / lambda)^(4/3))) and an octave fades as the receiver meets its eddies 15 to 25 times a second (aliasing at 60 Hz):
the explorer is 0.5 m, the ship's hull 8 m (sqrt of its gust area), here.air a point moving with the focus. The octaves are
weighted against the OPEN profile at the point (the log law of its ground's roughness, no canopy, no lee), so what they add is
U10 I times Kaimal's share times fMean / fOpen: in the lee of a wood or under a canopy the small eddies are as much smaller as
the mean wind is (sigma follows the local friction velocity). Variance gains 1.5
along, 2.2 across (a lattice of value noise spreads part of its variance below its band; measured). Not in the wind grid: a 16
m grid cannot carry a 1 m eddy, and the particles and plants keep their own (the grid's fields are bit for bit as before).
- *Numbers* (`wind.test.mjs`, a mast composed as airAt composes a point): the share of sigma_u^2 under one second against
  Kaimal's from 1 Hz to min(U10 / 0.38 m, 20 Hz): 2 m over grass in 8 m/s 0.126 (Kaimal 0.160), 10 m 0.069 (0.071), 2 m in 16
  m/s 0.198 (0.239), 2 m over z0 0.3 0.090 (0.122), 1 m in 4 m/s 0.094 (0.131): 0.72 to 0.97 of it along, 0.69 to 1.06 across;
  before, 0.002. Frame-to-frame (60 Hz) rms change at 2 m in 8 m/s 0.15 m/s; over rough ground (z0 0.3) 0.21. In the game loop
  (Node world, 2 m, a light 1.4 m/s wind): share under 1 s 0.002 -> 0.048, rms change a frame 0.0011 -> 0.0088 m/s; the explorer
  feels 11 times what the grid alone gives under a second, the hull a fifth of what the explorer feels.
- *Cost*: a point query 0.79 -> 4.0 us (a handful a frame: about 20 us); gustSubAt 1.3 us.
- *Tests changed, with the reason*: the three acceleration bounds in `air.test.mjs` (the first storm at the spawn, on PAINTER's
  ground, the runner crossing the grid) and `index.test.mjs`'s re-anchoring seam test measure the grid and the pattern it carries
  (a step at a hop, a wake that switches, a seam): they now ask the air as a receiver 1000 m across, which averages the point's
  eddies away; their limits are unchanged. (Counted into the bound, the eddies raised it threefold and it would no longer have
  caught the 407 m/s^2 step it was written for.) Two more read one instant of the wind where they meant the mean, and now ask
  the same large receiver: `flora.test.mjs` "plants shelter each other" took the wind's direction from one sample of here.air to
  plant its wood upwind (in its 0.7 m/s breeze the lateral eddies swing one sample by tens of degrees: the wood landed beside the
  wind); `loose.test.mjs` "Mars: a dust storm keeps sand hopping" compares the storm's wind with the fluid threshold (one instant
  read 27.6 against 0.8 x 33.4). New: the spectrum test, and the game-loop receiver test.

**3. The wind grid's garbage (`wind.js` `gustNodes`, util.js `noise3q`, near.js `nearKnownQ`, `air.js`).** gustLevelAt,
gustCrossAt and gustFineAt were called per node with twelve numbers each: every number handed over and every answer was boxed.
Now `gustNodes` works the cycle's numbers out once and the 289 nodes' three levels in one call through `noise3q` (noise3 through
a scratch array, line for line), and the upwind shelter search goes through `groundQ` and `nearKnownQ` (exactly heightAt,
nearest, known). Garbage (Node world with bumps, gale x3.3, walking, 60 Hz; heap between clean frames): AirGrid.update 383 ->
39 KB a frame, physics.update 455 -> 112 KB. **Bit for bit**: the same checksum (a4ac96f7) over 4.69 million numbers, every
grid field and here.air over 1800 frames through a wood's wakes and two re-anchors, on the head before P18 (`9b5c941`) and
after item 3; after item 2 the grid fields again (fafb4f5e). New test: gustNodes is `Object.is` each of the three at 5400
points on three worlds, noise3q is noise3 at 2000. **A correction**: item 3's commit message (`45338f0`) quotes the checksum
d0e1909c and 446 -> 103 KB; those came from a run whose test world was handed to createPhysics wrongly (its ground was NaN, so
the grid's we, wn and shel were NaN: only gust, cross, fine and I were real numbers). The numbers in this paragraph are from
the corrected run.

**4. The lab stand-in's knee (`src/physics/three/painted-lab.js`, mine).** Each leg is a thigh (0.43 m) and a shin (0.40 m) from
the hips to the ankle at the top of the boot, placed by the two-bone solution in the plane of the leg and the way ahead, the
knee bending forward, with a knee cap; checked in Node (the bones keep their lengths, the knee lies ahead of the hip-ankle
line; standing it bends about 9 degrees, a planted foot 0.3 m ahead under hips 0.1 m low 50, a swing foot 0.25 m up 95). Not
seen: no strip was made (item 5).

**5. Not done**: the strips `tree-gust`, `clamber-walk-moon`, the storm frame (not filmed, not opened); the PC_TIMING suite (not
run: the load stayed 13 to 16). The GLSL of the sea map has never been compiled.

## Hand-over P17 (fifteenth PHYSICS agent; read this block first; P16 and older below hold for everything not named here)

**Where things stand.** Item 1 (quality 2 confirmed, and made cheaper at every quality), item 2 (the boulder met off the
middle of the path) and the coordinator's two asks from PAINTER (no puff at the boot on a meadow; `bobAt` exported) are
done. Item 3 (P13 and P14's open items) is NOT started: see "Next". Tests: `node --test src/physics/` 279 pass (4 new),
PILOT's `node --test tests/*.test.mjs` 140 pass, on a clean export of `085d5e1` with my files (`p17/ex.sh`). Scratch:
`/home/user/.pc-scratch/physics/p17/` (`storm.mjs <root> <scenario|all|more|worst> <q> [runs] [secs] [kit]`: physics.update
and the weather kit in the worst storms, wall per frame (its per-frame thread CPU is NOT trustworthy: see item 1), `ALLOC=1`
heap per frame, `WALK=line` a run at 6 m/s instead of a 5 m circle, `reg.mjs` resolves `three` for the kit; `block.mjs <root>
<scenario> <q> [secs] [line]`: physics.update alone, main-thread CPU over a whole block (the trustworthy number);
`blockmatrix.sh`: head against the working tree; `side.mjs <root> <body> <h> <pace> <assist> [offsets]`: a run past a boulder off the line of the run;
`probecost.mjs`: the body step's cost with the trials; `hill.mjs`; `head/`: an export of `7509a6e` as it was).
**Next, in order:** (1) P13/P14's open items as P16 listed them (the sea is still one state round the focus; waves do not
turn toward the longest fetch; nothing under one second in the gust pattern; the strips `tree-gust`, `clamber-walk-moon`
and the storm frame not opened; the lab stand-in has no knee); (2) the air grid still makes about 400 KB of garbage a
frame (below: the gust functions are called per node with twelve numbers each); (3) re-film `clamber-run-moon` with a
boulder off the line (`side.mjs` has the numbers; no strip was made: the art pass had the machine).
**API added (additive):** `strideBob(v, g, stride, T?, o?)` and `bobAt(ph, o, gE, T?)` exported from `explorer.js`,
`physics.explorer.bob` (= strideBob); `util.js fsin, fcos`; `TerrainGrid.groundQ(q)`; explorer tunings `aheadProbe`,
`aheadProbeBefore`, `aheadProbeAfter`, `aheadProbeMargin`, `aheadProbeTries`; state `st.phys.probe`, `.seen`, `.noTry`,
`st.phys.ahead.tried` and `.hold`; `KICK.stepDust`; loose.js `Loose._move`, particles.js `Particles._fall` (internal).
**Behaviour changed without a call changing:** (1) a run at a hump it would have to brake on (anything with a top that the
legs must work on: a rise of more than their 0.45 m fold) slows before it with its soles to the pace the body itself
crosses it at, tried in a ghost run; the flank of a boulder off the line of the run is no longer met with a brace;
(2) a step or a landing on grass (0.02 of loose fines) or bare rock raises no dust puff (KICK.stepDust 0.05); soil,
gravel, sand, dust, ash, litter and moss as before; (3) none in the numbers of the weather: the per-particle loops are
the same arithmetic (sin and cos to 6e-8, sqrt for Math.hypot), the leaf count of the q2 test is identical before and after
(3997).

**1. Quality 2 in the worst storms (the hardening review's confirmation; PILOT may let physics.setQuality follow the
tier).** Measured in Node on this machine (a 2.1 GHz Xeon, 4 CPUs, load average 10 to 22 from the art pass's browsers
throughout), `p17/storm.mjs`: the explorer walking a 5 m circle at 1.4 m/s with the game's camera (5.2 m boom, 2 m up), the
weather kit expanding every buffer each frame as the world's kit does (PAINTER's draw table), 60 Hz. Places: the Earth spawn
at the first storm's gust front (146-152 s) and height (161-167 s); a closed wood in a 22 m/s gale (Node world, canopy 0.75
at 14 m); Neptune's storm coast (44-50 s, 2 m up the beach; rain 2950 at q2); a Mars dust storm (dust_dunes stand, dust
0.83: dust 1200, sand 2250 at q2); an Earth blizzard (62.4 N, 160-166 s: snow 2765, the skim 1255); and the heaviest, a run
at 6 m/s into a tall wood at the storm (canopy 0.6 at 23 m, 21 m/s: 5000 to 5500 leaves at q2, the cap is 6000).
- *Main-thread CPU a frame* (`p17/block.mjs`: the walker's path worked out first, then the measured 5 s of frames call
  physics.update and nothing else, and `process.threadCpuUsage` is read once before and once after the block; the better
  of 2 runs; head and these files one after the other; the particle counts come out the same in both, the arithmetic
  being the same), physics.update at q2 / q1:

  | storm (q2 counts) | head q2 | P17 q2 | head q1 | P17 q1 |
  |---|---|---|---|---|
  | Earth gust front (rain 565, leaves 1273) | 1.06 ms | 0.88 | 1.08 | 0.79 |
  | Earth storm (rain 1734, leaves 606) | 0.85 | 0.79 | 1.03 | 0.71 |
  | closed wood, 22 m/s (leaves 1702) | 0.90 | 0.84 | 0.87 | 0.77 |
  | Neptune storm coast (rain 2945) | 1.08 | 0.82 | 0.71 | 0.72 |
  | Mars dust storm (dust 1220, sand 2423) | 1.48 | 1.27 | 0.87 | 0.84 |
  | Earth blizzard (snow 2764, skim 1191) | 1.56 | 1.50 | 1.17 | 1.08 |
  | run into a tall wood at the storm (leaves 5028; q1 2994) | 2.27 | 1.93 | 1.57 | 1.17 |

  Wall clock in the same blocks (load 19 to 22): head 0.9 to 7.2 ms, P17 1.0 to 2.5 ms (the wait for a core dominates).
  The weather kit (wall, best of 3 runs per frame, `storm.mjs`): 0.1 to 0.3 ms in these storms, 0.7 ms in the blizzard and
  in the tall wood, about the same before and after. (A first table in this hand-over's draft read the thread clock per
  frame around each update: Linux spreads that clock's ticks over the whole thread, so short windows come out low. Only
  whole blocks are trustworthy; the table above is that.)
- *Verdict*: quality 2 fits. The heaviest storm a player can stand in (a run into a tall wood at the storm, 5000 leaves in
  the box, the cap 6000 not reached) costs physics.update 1.9 ms of CPU a frame on this 2.1 GHz server core and the kit
  0.7: 2.6 of the 16.7 ms; every other storm 0.8 to 1.5 ms and 0.1 to 0.7. Nothing the player sees was cut: no cap, count
  or sampling rate changed. Quality 2 costs 0.1 to 0.8 ms a frame more than quality 1 where a storm fills the buffers
  (rain, dust, sand, snow, leaves in a tall wood), nothing where it does not.
- *What was made cheaper, and why it was slow* (found with V8's own tools: `--cpu-prof` line ticks, `--trace-deopt`,
  `%GetOptimizationStatus`, a sampling heap profile that keeps collected objects):
  (a) **a deoptimisation loop**: `FloraField._pushStep` was thrown away and rebuilt about 300 times in 12 s at Neptune's
  coast (every other frame): Math.round hands back -0 for a focus just west or south of the anchor, and the grid centre
  fields changed their kind of storage. The centres now start as -0 (flora, near, deform, drift); 0 deopts after.
  (b) **two long updates never optimised whole**: `Loose.update` and `Particles.update` ran their particle loops only as
  on-the-fly (OSR) code, so every lookup per particle stayed a call and every number handed over was boxed on the heap.
  Each kind's loop is now its own method (`Loose._move`, `Particles._fall`, the code moved verbatim), optimised whole.
  (c) **the ground lookups per particle** go through `TerrainGrid.groundQ(q)` (a scratch array in and out: nothing boxed).
  (d) **`Math.hypot` is twenty times slower than `Math.sqrt` in V8** and `x % 1` three times slower than `x - floor(x)`: in
  the particle loops they are replaced; sin and cos of the flutter, the tumble and the leaf's mark use `fsin`/`fcos`
  (util.js: within 6e-8, 2.5 times faster). Heap garbage of physics.update at q2: Neptune's coast 933 -> 478 KB a frame, the
  blizzard 1392 -> 548 KB (process heap between clean frames). What is left is mostly the air grid (gustLevelAt,
  gustCrossAt, gustFineAt per node, twelve numbers each, and noise3): Next (2).
- *Tests*: `P17: quality 2 ... in a gale through a tall wood` (index.test.mjs): 3997 leaves at q2, mean under 2 ms under
  PC_TIMING (the same limit as quality 1's budget tests), measured as main-thread CPU where Node has `threadCpuUsage`: in the
  full suite under PC_TIMING (the test files run side by side, load 19) the wall clock gave 2.08 ms against 1.55 to 1.84
  alone; the wait for a core is not the frame's cost. The other timing tests keep the wall clock and passed.

**2. The boulder met off the middle of the path (`explorer.js`, mine).** P16 read the way ahead along the path and called a
face only a rise over the legs' stroke (0.73 m). The flank of a 1 m boulder 0.4 to 0.55 m off the line of the run is a
lower, narrower hump (0.67 m at 0.5 m off): not a face to P16, but the body still met it braced (two steps of 0.5 m/s) and
held back over its top by the limbs (P13's hold, 20 m/s^2): 6 -> 2.9 m/s in a quarter of a second on the Moon. The reading
was not too narrow (the body is a point: it feels only the path's own section, which is what was read); the criterion was.
Now (EXPLORER_BODY.aheadProbe): anything with a top that the legs must work on (a rise of more than their fold within the
span) is read along the path once (20 samples, 0.2 m apart, from 0.6 m short of the span to 2.6 m beyond the far point),
and the body itself is run over that profile in a ghost (the same step function, the walker's own normals, no world
samples) at trial paces, one trial a body step: the wished pace, the law's, then halving; the fastest that crosses with no
brace, no hold checking it and the feet never off the ground, less 8 %, is the pace to meet it at, and the face is held to
until the body is back on its feet past its top. Ground that goes on rising (a hill, a ledge) is not tried: P16's reading
holds there (a 20 % and a 40 % hill: the same numbers as before). Runs at 6 m/s past a 1 m boulder (PILOT's profile, no
assist), speed before, least over it, worst loss in one step, brace:

  | world, off the line | head | P17 |
  |---|---|---|
  | Moon 0 / 0.4 / 0.5 / 0.55 m | 2.78, 0.03, 0 / 3.09, 0.50, 0.5 / 2.87, 0.50, 0.5 / 4.55, 0.36, 0 | 2.54, 0.03, 0 / 3.06, 0.02, 0 / 3.40, 0.02, 0 / 3.58, 0.02, 0 |
  | Mars 0 / 0.4 / 0.5 / 0.55 m | 2.75, 0.05, 0 / 3.43, 0.28, 0.15 / 3.13, 0.50, 0.5 / 4.04, 0.39, 0 | 2.88, 0.05, 0 / 3.40, 0.05, 0 / 3.92, 0.05, 0 / 4.27, 0.05, 0 |
  | Earth 0 / 0.4 / 0.5 / 0.55 m | 2.74, 0.10, 0 / 4.09, 0.09, 0 / 4.11, 0.50, 0.5 / 6.00 | 2.88, 0.10, 0 / 4.10, 0.09, 0 / 4.79, 0.08, 0 / 6.00 |

  At 7.4 m/s past 0.7 m and 1.2 m boulders, 0 to 0.7 m off, on the Moon and Earth: head braced in 4 of 16 runs (and lost
  7.4 -> 4.7 m/s to the hold in one more); P17 in none, the worst step 0.11 m/s. Feet never off the ground in any run.
  *Cost*: a trial is a ghost run of 1 to 2.5 s of body steps; the worst body step with a trial in it was 0.9 ms (best of 7
  runs, 2.1 GHz Xeon), once in each of up to six steps when a feature comes into reading; the mean body step 7.5 -> 13 us
  over a run at a boulder. Only while running (over 2.5 m/s).
- *Tests*: new `P17 the way ahead, tried` (explorer.test.mjs): Moon, Mars (3.7), Earth, 0 to 0.55 m off: no brace, no
  hold, the worst step within the soles' grip, in contact, never under 2.2 m/s. P16's test passes unchanged.

**3. PAINTER's two asks (by the coordinator).** (a) *A puff at the boot on a meadow*: decided physically: a living sward's
roots bind the soil and its blades cover it; a step raises none. Each kicked grain is drawn as a puff, and the meadow's 0.02
of loose fines came out as a lone puff now and then on a run or a landing (8 in 6 s of running with 12 landings, measured
on head). `KICK.stepDust` 0.05: no foot kick below it (grass 0.02, rock 0.03, glass, crystal); soil 0.15, gravel, sand,
dust, ash, litter (0.06) and moss (0.08) as before. New test `P17: a step on a living sward raises no puff` (fails on head
with 8, passes now; the sand still smokes under the same run). (b) *`bobAt` exported* with a small helper:
`strideBob(v, g, stride)` is the hips' height off standing in a steady stride exactly as stepGait lays it (tested equal to
the body's own `st.phys.bob` to 1e-9 at 1.4, 4.2, 6.5 m/s on Earth and 3 m/s on the Moon); `physics.explorer.bob` too.
For PAINTER: see "For PAINTER", P17.

## Hand-over P16 (fourteenth PHYSICS agent; read this block first; P15 and older below hold for everything not named here)

**Where things stand.** Items 1 (import cycles), 2 (the fetch) and 3 (the Moon run at the boulder) are done; no hardening
finding reached me (item 4); item 5 not started. Commits: `dc4e3f5` (items 1 and 2; most of their files went up first in
the coordinator's backup `fbd611f`), then item 3 and the strips (the next physics commit). Tests: `node --test
src/physics/` 275 pass and PILOT's `node --test tests/*.test.mjs` 125 pass on a clean export of `194171b` with my files. Scratch:
`/home/user/.pc-scratch/physics/p16/` (`ex.sh`: export of HEAD with the working physics over it into `p16/root`;
`sea.mjs <root> <body> <biome> <t0> <t1> [up]`: the sea state at the lab's shore in Node on PAINTER's world;
`rose.mjs <root> <body> <biome> <t>`: the fetch by direction at the water point and where the wind comes from;
`rock.mjs <root> <body> <assist> <height> <pace>`: a run at a boulder on PILOT's profile, the speeds and braces;
`cycles.mjs`: import cycles; `x6d/`: an export of 6d5c02a for the load test).
**Next, in order:** (1) the hardening findings as the coordinator sends them; (2) P14 and P13's open items (P13 hand-over,
"Not done": the stand-in's knee, the storm frame, `tree-gust`, `clamber-walk-moon` not opened; the sea is still one state
round the focus); (3) the fetch by direction could also turn the waves (a lagoon's chop runs where its fetch is longest,
not only down the wind); (4) the way ahead reads only along the path: a boulder met side-on at the edge of the path is
still taken by the face brace (legCatch) as before.
**API added (additive):** see "Added in P16" in the API section: `physics.water().fetch/.depth`, `fields.water.gauge`,
`.waterPoint`, `stats.msFetch`, `.fetchSamples`, `FetchGauge`, `FETCH_GAUGE`, `whiteScale`, `WATER.whiteSpeed`,
`wind.js wakeAt`/`WAKE`, `testworld timing()`; explorer: `st.phys.paceAhead`, `st.phys.ahead`, tuning `aheadFrom`,
`aheadMax`, `aheadSpan`, `aheadMargin`, `aheadPace`, `aheadExp`; film `clamber-run-moon-long`; probe columns `fetch`, `fdepth`.
**Behaviour changed without a call changing:** (1) the sea near the focus is raised over the measured fetch and limited
by the depth along it: lagoons, pools and channels carry a chop or ripples, not the biome's open sea (Neptune's storm
coast: Hs 2.75 -> 0.21 m; Earth's sea_coast stand in a breeze: 0.64 -> 0.02 m); no swell where the water upwind is under
600 m; (2) short waves (phase speed under 0.9 m/s, under half a metre long) never show whitecaps; (3) running (over 2.5
m/s) the explorer reads the ground ahead (two samples a step) and slows with its soles before a face it must clamber, to
the pace it can cross it at; the face no longer checks it; (4) wall-clock asserts in the physics tests run only under
PC_TIMING=1.

**1. Import cycles (`wind.js`, `air.js`, `flora.js`, `load.test.mjs`).** `wakeAt` and its two numbers (`WAKE.full` 0.5,
`WAKE.top` 1.5) live in `wind.js` now; `flora.js` imports it from there, so nothing in the physics imports `air.js` back.
`air.js` re-exports `wakeAt` (the same function) and keeps `AIR.wakeFull`/`AIR.wakeTop` (the same numbers) and the
coordinator's lazy `HF0` (it costs nothing and keeps `air.js` safe whatever enters first). `load.test.mjs` (2 tests):
every `src/physics/**/*.js` is imported as the ENTRY of a fresh Node process (`three` resolved to `vendor/three` as the
pages' import maps do; `painted-lab.js` reads `location` in its body, so it passes when the only error is a browser
global missing in its own body, which means all it imports loaded); and no static import cycle among the 49 modules the
physics reaches (`ALLOWED_CYCLES` is empty). On an export of `6d5c02a` the first fails three ways (`flora.glsl.js`,
`flora.js`, `painted-lab.js`: "Cannot access 'FLORA' before initialization") and the second names
`air.js -> flora.js -> air.js`; on the head with my files both pass (about 8 s).

**2. The fetch, measured (`water.js` `FetchGauge`, `windSea`, `whiteScale`; `index.js`).** As ruled: the sea state comes
from the water that is there.
- *The gauge*: from a water point (the focus where it stands in liquid at least 1 m deep, else the nearest such node of
  the 256 m wind grid, else the deepest liquid about) five radials (0, +-6, +-12 degrees about upwind: the Shore
  Protection Manual 1984 takes the mean of radials over 24 degrees) run upwind over the world's liquid until dry ground
  or the cap (the point's biome fetch, 2500 m on sea coasts); steps of 16 m growing by a tenth of the distance gone (39
  samples to 2500 m; the shore placed within 5 % of its distance, 2.5 % in the height); fetch = the mean of the radials;
  depth = the mean depth over their wet length. Cached: a measurement holds within max(48 m, a tenth of its fetch) and the
  same sixteenth of the compass (24 kept); a few samples a frame (2/4/6 by tier, x9 while nothing is known on arrival,
  time-rationed by `QUALITY.sampleMs`); while it runs the last finished value is held, and on arrival the radials so far
  (a lower bound that only grows). Upwind is against the way the sea runs (it follows the wind over 40 s).
- *Depth-limited growth* (`windSea`): the SPM 1984 shallow-water curves (Bretschneider) as the ratio of each to its own
  deep-water form, so deep water is exactly as before: 3.4 m of water under 30 m/s over 30 km holds 1.1 m where deep water
  raises 2.7 m. Until now only the breaking cap (0.55 of the depth) knew the bottom.
- *No whitecaps on ripples* (`whiteScale`): waves under about a metre long break without trapping air (microscale
  breaking; Banner and Phillips 1974, Jessup, Zappa and Yeh 1997): none under 0.9 m/s of phase speed, all above 1.5.
- *Numbers* (Node, `p16/sea.mjs`, PAINTER's world at the lab's places; `p16/before-*.txt`, `after-*.txt`):

  | place | wind | fetch | depth | Hs | length | swell | cover |
  |---|---|---|---|---|---|---|---|
  | Neptune storm_seas, 44-50 s, before | 30 m/s from the E | 2500 (biome) | grid's deepest | 2.75 m | 10.7 m | 1.73 m (open) | 15 % |
  | the same, after | the same | 133 m (radials 168 136 136 120 104) | 3.3 m | 0.21 m | 1.5 m | none | 15 % (a steep, white chop) |
  | Earth sea_coast, 1150 s, before | 8.8 m/s from the ESE (offshore) | 2500 | | 0.64 m | 4.8 m | 0.40 m | 1 % |
  | the same, after | the same | 24 m (a pool 1.7 m deep) | 0.4 m | 0.02 m | 0.2 m | none | 0 |
- *Strips* (from `p16/root`, `kits=painter`; before = P15's, kept as `-before`), all OPENED:
  `motion-sea-out-neptune-before`: a tongue of leopard foam runs up and drains, reach 1.5 to 7.0 m, spray to 482 drops;
  `motion-sea-out-neptune` (after): the lagoon's surface is a fine-grained chop with small white flecks; the waterline
  barely moves (reach -0.03 to 0.44 m), a thin warm edge along it, no foam tongue, 1 to 2 spray drops.
  `motion-shore-earth-breeze-before`: a white foam rim along the edge, reach 0.5 to 1.9 m; `motion-shore-earth-breeze`
  (after): a still pool, no rim, reach -0.01 to 0.06 m (fetch 18 m at the lab's focus), no spray.
- *Cost*: the gauge spends at most its ration (24 samples a frame on arrival in the tests, 2 to 6 after) once per place
  and wind sector; then nothing. **For PAINTER**: what changed on Neptune's coast, and what would keep a storm's surf
  there, is the first entry of "For PAINTER".

**3. The Moon run at the boulder (`explorer.js`, mine).** The check was the clamber's face contact in my body model
(P13's `legCatch` brace: the legs at the end of their fold, the face takes the speed the feet cannot carry up it, 0.5 m/s
a step); PILOT's wrapper passes the command through unchanged. What the ruling meets, measured (`p16/rock.mjs`, PILOT's
`scrambleSample` dome, 1.3 m across): **within the standing rule (feet never 0.3 m off, never thrown up 0.3 m) a face
the hips must climb can be crossed in contact only at a pace the hips can be raised onto it and brought down beyond it**:
constant-pace runs that need no brace at the face reach 4, 3 and 2.25 to 2.5 m/s for boulders of 0.8, 1.0 and 1.2 m, the
same on the Moon, Mars and Earth (the hold's pull, not gravity, sets it). So a lunar run at 6 m/s cannot lose only m g h
(2.2 J/kg for 1 m, which would leave 5.8 m/s) without a bound over the top, which the rule forbids; it must shed about
14 J/kg. What changed is WHERE and HOW: the runner reads the way ahead (`wayAhead`: one point as far ahead as its soles
need to slow from this pace, and one 1.2 m short of it; a rise of more than the legs' stroke within that 1.2 m is a face;
a hill under 60 % is not), plans the crossing pace by the law above (8 % under the measured edge) and brakes to it with
its soles and the suit's assist, within the grip there, from as far out as that takes; the face then costs the climb.
Before and after (1 m boulder, run at 7.4 m/s, Node, no assist as in the lab):

  | world | before: least speed over it, brace | after: speed at the face, least over it, brace, worst step of the approach |
  |---|---|---|
  | Moon (g 2.2) | 2.33 m/s, 0.5 m/s a step at the face | 2.90, 2.78, none, 0.03 m/s (1.8 m/s^2) |
  | Mars | 2.61 | 3.10, 2.75, none, 0.05 |
  | Earth | 3.17 | 3.32, 2.76, none, 0.10 |

  Still in contact everywhere (feet 0.000 m off). The run from 6 m/s on the Moon now slows over about 2 s and 8 m before
  the boulder instead of in 0.13 s at its face. Boulders of 0.8 and 1.3 m: no brace at the face either (crossing 3.0 to
  3.9 and 2.0 m/s). Tests: one new (`P16 the way ahead`: no brace at the face on the Moon, Mars, Earth; the approach's
  worst step within grip plus assist; in contact; 2.2 to 3.3 m/s at the face; a 20 % and a 40 % hill never read as a
  face); one changed with its reason (`one the hips must climb costs pace: more in low gravity`: the crossing pace is now
  the same on every world within 10 %, measured, so it reads "no faster on the Moon").
- *Strips* (from `p16/root` = a clean export of `194171b` with my files, `kits=painter`), all OPENED:
  `motion-clamber-run-moon-before` (P15's): at the face the runner is checked, 5.41 -> 2.11 m/s between 0.625 and 0.75 s,
  then climbs, crosses and slowly runs on (4.6 m/s at 3 s). `motion-clamber-run-moon` (after, the same subject): it
  arrives already easing, 3.55 -> 2.84 m/s over the first 0.75 s (about 1 m/s^2: the lab gives no assist), climbs from
  0.88 to 1.25 s at 2.78 -> 2.76 m/s (no check), is over the top at 1.25 s and down by 1.6 s, 4.57 m/s at 3 s.
  `motion-clamber-run-moon-long` (new: from 10 m out, wider): the face is seen 9.1 m out at 4.4 m/s; the pace falls
  smoothly 4.67 -> 2.76 m/s over 1.9 s, the clamber at 2.71 m/s, over at 2.75 s, on at 4.06 m/s at 4 s. The figure is
  small in that frame but the even approach reads. If the coordinator would rather the run kept its pace over clamberable
  boulders in low gravity (the energy-only cost), that needs the 0.3 m rule relaxed for a clamber (a bound over the top):
  a decision, not something I took.

## Hand-over P15 (thirteenth PHYSICS agent; read this block first; P14 and older below hold for everything not named here)

**Where things stand.** All four P15 items done and committed (`6f9fdd8` leaves, then the shore, the crowns' shelter,
the three strips). `node --test src/physics/` 268 pass; PILOT's 123 pass on a clean export of HEAD with my files.
**Next, in order:** (1) the coordinator's word on the fetch (item 2: the sea state from the water that is there, not
the biome's 2500 m; it would calm Neptune's lagoon coast to a chop); (2) the Moon clamber's check at the face, on PILOT's
word (item 4); (3) the lead's findings as the coordinator gives them; (4) P14 and P13's open items.
**API added (additive):** `particles.<kind>.turn` (and internal `_tp`); `here.blown.leaves`, `.litter`, `.leafStock01`;
`BLOWN.leafFlux, leafTornMax, leafStock, leafAutumn, leafRecover, leafFetch, leafLitter, litterFrom, litterFull, leafRo,
leafRock`; `LOOSE.leaves.tumble`; `air.js wakeAt(wk, wkH, z)`, `AIR.wakeFull`; `sampleWind` [9] [10] [11] when the array has
room; lab: `__lab.eye`, `info().place`, `info().seed`, the hull draws `buffetAngle`; film subjects `leaves-front`,
`leaves-front-detail`, `shore-earth-calm`, `shore-earth-breeze`, `sea-out-earth-breeze`, `sea-out-neptune`; helper
`P.nearEye`; `SHORE_PROBE` columns `runup`, `reach`, `slope`, `w80`, `deep`; `CROWN_PROBE` `w2`, `uc`, `load`.
**Behaviour changed without a call changing:** leaves (count, where they come from, `turb` 0.5 -> 0.9, `leafCalm` now in
units of torn, capacities 800 / 3000 / 6000); the kit's leaf quads are mirrored while a leaf shows its other side; the
lee of trees thins above half their height for the particles' air and `profileAt`, and the crowns take it at their height. Scratch: `/home/user/.pc-scratch/physics/p15/` (`ex.sh`: a
clean export of HEAD with the working physics over it into `p15/root`; `forest.mjs <biome> <k> <secs>`: leaves in the
Node test world, wind scaled down k times; `timing.mjs <q> <k>`: physics.update in a closed wood gale; `diag.mjs`: where
the leaves are in the painted lab).

**1. Leaves (`loose.js`, `particles.js`, `three/expand.js`).** At the gust front the box held 200 leaves (cap 260), shed
uniformly over the box whatever stood there, and 190 showed as specks. Now:
- *How many is what the wood sheds, not the buffer*: `BLOWN.leafFlux` 0.04 leaves a second off each m2 of closed canopy at
  torn 1, torn up to `leafTornMax` 6 (0.24 a m2 a second: a summer gale strips 1 to 2 in 100 of a wood's 2000 leaves a m2 in
  its first minutes), each candidate kept by the canopy closure and leafiness at its place (`air.coverNear`) and the wind
  there to the fourth power (the 4 x 4 patch, gusts in it): bursts and streams. A stock (`leafStock` 40 a m2, 9 x in an
  autumn wood) that a long gale drains and a calm restores over 1200 s (`here.blown.leafStock01`).
- *Inflow*: a leaf torn off a 14 m crown falls for ten seconds and goes 100 m downwind, so most leaves crossing the box
  near the ground were shed upwind of it; they now come in through the box's upwind side at the height they have come
  down to (`leafFetch` 300 m). Until now the box held only what its own crowns let go, high up, and it left downwind before
  it came down. Under the crowns the air now holds flux / vs leaves a m3 (0.09 a m3 below 3 m in a closed wood gale).
- *Litter* off the floor in the streamers where the wind at 1 m (with the sweeps, +-1.7 sigma) is over 3 m/s (full at 9),
  dry ground only (`leafLitter` 0.04 a m2 a second at full). Under a closed canopy it hardly ever lifts (the floor is calm).
- *Tumble*: `buf.turn` (new, every buffer; radians about the leaf's long side; 0 for kinds that do not tumble): three
  quarters tumble at 2 Ro |v - w| / c (Ro 0.2 to 0.4, c 0.6 of the leaf's length: about 5 turns a second), a quarter
  rock through +-0.9 to 1.35 rad and never turn over. The kit (`expandDabs`) uses it: the quad's short side is reversed
  while cos(turn) < 0, so its winding turns over and PAINTER's two-toned leaf (gl_FrontFacing) flickers. No PAINTER change.
- `LOOSE.leaves.turb` 0.5 -> 0.9 (a leaf answers the air within 0.15 s). Capacities 80 / 260 / 600 -> 800 / 3000 / 6000.
- Numbers. Painted spawn (a clearing by an open wood), gust front 146 to 150 s, quality 1: 200 -> 990 to 1050 leaves in the
  box; within 8 m of the lens 25 to 30 -> 9 to 18 (the old uniform shedding put leaves where no tree stood), within 3 m 0
  to 1 (the clearing is open: 0.01 a m3 at head height). Node closed wood (canopy 0.75, 14 m) in 15.6 m/s: 2230 leaves,
  635 below 3 m (0.09 a m3); a leaf shows its other side 11 times a second. Autumn wood in a breeze: 16 (was 6).
- Cost, Node, this machine: physics.update mean 0.80 -> 1.27 ms at quality 1 in a closed wood gale (2257 leaves against
  255); worst frames are spikes of the machine (7 to 35 ms either way).
- Strips (`docs/shots/physics/motion-leaves-front*.jpg`, from `p15/root`, `kits=painter`, the game's camera: 5.2 m boom,
  pivot 2.05 m, 58 degrees, looking across the wind): `-before` OPENED (a handful of specks); `leaves-front` OPENED (half
  size tiles: 15 to 25 thin marks a frame against the crowns and the sky, few low); `leaves-front-detail` (960 x 540, the
  upper right at its own pixels, 30 frames a second) OPENED: 30 to 40 dark red and pale ochre lenses in a quarter of the
  picture, a leaf changing tone from one frame to the next: a flock that flickers.
- **For PAINTER** (top of "For PAINTER"): leaves read at full size; at half size they are specks because the floor keeps
  their ink (a 3 px leaf drawn at 10 px is drawn 1 in 11). See there.

**2. The shore (verification; no model changed).** The probe's run-up columns printed null (it read `field.runup`, which
never existed): `SHORE_PROBE` now reads `physics.fields.water.runup(p, slope)` at the beach's own slope (measured 10 m
landward of the waterline): `runup` (m over the still level), `reach` (m up the beach from the still waterline), `slope`,
`w80` (the water's height 80 m out), `deep` (the liquid's depth 20/40/80/160/320 m out along the ray, -1 dry). Lab
`info()` also gives `place` and `seed`. Strips from `p15/root` (a clean export of HEAD = PAINTER's committed water,
`b022507`'s recipe), `kits=painter`, all OPENED:
- `shore-earth-calm` (480 s: 2.4 m/s, the calmest this coast gets in 2.5 h; Hs 0.31 m of old sea): reach 0.3 to 1.1 m on a
  0.07 beach (2 to 8 cm of height), a period of about 4 s. In the picture the foam line and the wet band change shape a
  little from frame to frame: the edge moves, barely.
- `shore-earth-breeze` (1150 s: 8.8 m/s, Hs 0.64 m, whitecap cover 1.3 %): reach 0.5 to 1.9 m, period 3.5 s; 80 m out
  +-0.3 m. `sea-out-earth-breeze` (the eye 1.6 m up, out across the water): the swash zone's foam spreads up the sand and
  draws back with the reach (frames 0, 7: long; 5: short). **Water runs up and drains back: yes.** White horses: none to
  be seen (the water is a channel 20 to 40 m wide: 1.5 m deep 20 m out, dry 40 m out).
- `shore-neptune` (44 to 50 s: 30 m/s, Hs 2.8 m, cover 15 %): reach 1.5 to 7.3 m on a 0.13 beach, period about 5 s; a
  tongue of foam runs into a hollow and drains from it (frames 0 to 7). `sea-out-neptune`: the run-up again; rain is long
  thin slanting strokes, spray tiny white dots low over the water's far edge (370 to 470 drops at 47 to 48 s): told apart
  by shape and place, but the dots are a pixel or two. The foam is a leopard pattern (white with round dark holes): PAINTER's.
- **The sea beyond 64 m cannot be judged at these places**: the water they face is small. Neptune's storm_seas shore faces a
  lagoon 0.3 m deep 20 m out, 3.4 m at 80 m, DRY at 160 m; Earth's sea_coast shore a channel. The physics puts +-0.75 m
  (Neptune) and +-0.3 m (Earth) 80 m out, and PAINTER's committed shader carries the long train to 2.2 to 6 of its lengths.
- **A fault on my side, found, NOT changed (a decision for the coordinator)**: the sea state comes from the biome's fetch
  (`water.js FETCH`: sea_coast and storm_seas 2500 m), not from the water that is there. A 30 m/s wind over a lagoon 150 m
  across raises Hs about 0.2 m (fetch-limited growth), and 3.4 m of depth holds at most 2.6 m; the 2.8 m surf on that
  lagoon is not physical. The fix is mine: measure the fetch upwind over the liquid the terrain grid knows (march up the
  wind from the focus; the biome's fetch only where the liquid runs off the grid). It would turn that coast's storm surf
  into a steep chop unless PAINTER's open sea is elsewhere; so not done without a word from the coordinator.

**3. Are the crowns sheltered twice? No (checked; one corner fixed).** Inside a wood no stand upwind is taller or denser
than the place, so `AirGrid` casts no wake there and a crown feels the canopy's own profile, `heightFactor` at the
canopy's top: d = 0.65 hc and zr = min(1 m, 0.1 hc). Against the standard profile (d = 2/3 hc, z0 = 0.1 hc, matched to
the open log law at the 60 m blending height) the code gives MORE at the top, not less: 0.53 of the reference 10 m wind
at a 14 m top (standard 0.44), 0.41 at 10 m (0.40), 0.66 at 20 m (0.50); the 1 m cap on zr is why. So 30 m/s of regional
wind gives 13 m/s at a 14 m canopy top by the standard profile and 16 by the code: the 11 to 18 m/s the crowns feel at the
storm's height is the profile, not a second shelter. (The twelfth agent's "8 to 9 m/s at the top for 20.5 m/s" is the
same ratio; the 5 m/s it saw at 240 s was the lab's stand-in birch, which stands in the spawn's CLEARING behind the wood.)
What was wrong: the crowns took the lee of taller trees upwind (`sampleWind` multiplies it into the reference) as it is
near the ground, at any height; the particles and `profileAt` kept it whole up to the trees' full height. Now one shape,
`air.js wakeAt(wk, wkH, z)` (new export): whole up to `AIR.wakeFull` 0.5 of their height, half the loss at their height,
gone at 1.5 x (Heisler and DeWalle 1988; Wang and Takle 1996), used by the particles' air, `profileAt` and the crowns
(`flora.js`: the stiff class's load takes `wakeAt` at the canopy top or 10 m over the ground-level wake). `sampleWind`
also writes [9] the wake, [10] its trees' height, [11] the canopy height when the array has room (additive).
Numbers (painted lab, `crown-storm` at 167 s, numbers only, not re-opened): the stand-in crown in the clearing 15.0 to
16.2 m/s before, 15.2 to 16.4 after (it is at 10 m behind a 14 m wood: the wake is still nearly whole there); the walker
at 2 m 8.5 to 10.4 m/s before, 8.6 to 10.8 after (the frames differ by the grid's learning, not by the change: 2 m is
under half the height of anything that casts a lee there). A crown taller than the wood upwind now feels up to the whole
wind above 1.5 x that wood's height. PILOT's suite passes.

**4. Three strips re-filmed** (from `p15/root`, `kits=painter`, `docs/shots/physics/motion-*.jpg`, all OPENED):
- `explorer-jet`: up to 49 m over the wood and down; the brake eases in: -16.6, -13.1, -10.1, -7.8, -6.0, -4.6 m/s at
  0.55 s steps (6.3 easing to 2.5 m/s2), touchdown at 4.6 m/s taken by a 4.5 cm fold. The camera (30 m, following) goes
  through two crowns on the way (the lab's camera, not the game's).
- `ship-hover` (176 s, 6.5 to 10.5 m/s at 6 m): the lab's hull now draws `buffetAngle` (rotateX pitch, rotateZ roll,
  rotateY yaw): roll -0.35 to -0.52, pitch -0.2 to +0.1, yaw +0.33 to +0.47 degrees; at 17 m the hull still reads level
  (half a degree is 2 cm at its edge). The storm's leaves stream across the whole picture, some large near the lens.
- `clamber-run-moon`: legs fold at the face, cross the top, run on: a clamber that reads. But the run is still CHECKED at
  the face: 5.4 -> 2.1 m/s between two frames 0.125 s apart (26 m/s2: lunar friction gives 1.6, so it is the face), then
  back to 4.6 m/s over 2.4 s. P13's "0.5 m/s a step" holds per 1/64 s step, but the loss is over a tenth of a second, not a
  stride (0.5 s on the Moon at 5 m/s). The explorer's body is PILOT's to review now: not changed (For PILOT).

## Hand-over P14 (twelfth PHYSICS agent; read this block first; P13 and older below hold for everything not named here)

**Where things stand.** Item 1 of P14 (trees alive in a storm) is done and committed; items 2 (leaves), 3 (the
shore) and 4 (three strips to re-film) are NOT done: I stopped near the end of my working context. `node --test
src/physics/` 265 pass (2 new); PILOT's 123 pass on a clean export of `6a9e44e` with my files. Scratch:
`/home/user/.pc-scratch/physics/p14/` (`ex.sh`: export of HEAD with the working physics over it into `p14/root`;
`crown.mjs <t0:secs,...> [biome]`: branch tips in the Node spawn world; `synth.mjs`: tips in a uniform wind,
spectral peak, correlation; `scan.mjs <root>`: the painted lab's spawn scanned over its clock, wind and crown load;
`after/`: the strips).

**1. Branches (`flora.js` `plantCrown`, `flora.glsl.js` `pcPhysCrown`).** The eleventh agent's crown model (a branch
loaded by the wind on its own foliage: a set downwind as U^1.3, thrash from three frozen eddy trains 6, 11 and 19 m
long carried at crown height, twigs trembling at 3.6 Hz) was judged in Node at the Earth spawn (P8's world): the
amplitudes were right (set 0.44 m, 0.4 to 0.55 m in 2 s in the gust front) but **the tips moved at 0.2 to 0.8 Hz in
every wind and three branches correlated 0.7 to 0.9**: the eddy trains are lines whose frequencies the wind sets
(k U / 2 pi), so a branch only followed them and its own period never showed. Corrected:
- *The resonant part* (Davenport's buffeting response): four clock lines at 0.72, 1.01, 1.43, 2.02 Hz (new uniform
  `uPhysBranchClock`), each weighted by the branch's own oscillator |H(f)| and the turbulence at f (von Karman,
  `crownLu` 25 m), with phases from the branch's id and from the place (`clockK`). Variance about the set =
  1.69 Ic^2 phi(fb Lu / U) pi / (4 zeta), tested within 35 %. Across the wind 0.6 and up 0.45 of it.
- *The eddy trains are now the background* (followed below the branch's frequency, shed above: no resonant peak of
  their own, which was double counting) and carry the share of sigma_u that 5 to 25 m eddies hold (`crownBand` 0.33)
  of the turbulence AT THE CROWN (`crownI` 3 x the open air's, capped at 0.6: the roughness sublayer and the crown's
  own wake, Raupach, Finnigan and Brunet 1996). Numerically the old 1.3 x I, now capped.
- Numbers, Node spawn world (open alpine meadow), a 3.5 m branch of 0.94 Hz: a breeze (4 m/s at 10 m) 7 cm in 2 s,
  most at 1.03 Hz; the storm's height (240 s, 20 m/s) set 0.34 m, 0.49 m in 2 s; the gust front (184 s, 28 to 31
  m/s, gusts to 51) 0.61 m. Branches of 0.85, 0.94, 1.69 Hz swing most at 0.72, 1.03, 1.42 Hz in 3 and in 20 m/s;
  their quick swings correlate -0.3 to 0.5. In a uniform 20 m/s: tip from 0.0 to 0.6 m downwind, up +-0.16, across
  +-0.18. Foliage 1 cm in a breeze, 6 cm in a gale at 3.6 Hz (unchanged).
- **The game's spawn is a temperate wood, not the Node world's meadow, and its storm comes earlier**: the regional
  wind peaks at 30 m/s at 161 to 169 s (gust front at about 149 s; at 240 s it is 21 m/s and easing). Among the
  trees the 10 m wind is 12 to 18 m/s at the height and the crowns feel loads of 2 to 5 (11 to 18 m/s); a set of
  0.12 to 0.26 m. That shelter is the air model's (`AirGrid.sampleWind`: the wake of upwind trees multiplies the
  reference wind for crowns too, and the crown height factor). By the log law over a forest a 20.5 m/s open-ground
  storm gives 8 to 9 m/s at a 13 m canopy top; the painted spawn gave 5 m/s at 240 s, so the crowns there may be
  sheltered up to twice too much in speed. **Next: check whether the wake factor should apply at crown height**
  (the canopy's top is above the lee of its neighbours), with a test; not changed here.

**The strips** (from `p14/root`: a clean export of `f86bd1b` with my working files; `docs/shots/physics/motion-crown-*`;
the lab's own stand-in birch, `crown=0,0`, 13 m, seven 3.5 m branches with foliage dabs, drawn through PAINTER's
painter, camera 13 m off looking across the wind at 8.5 m, 10 frames a second):
- `crown-storm` (167 s), OPENED: the trunk leans 7.9 to 8.9 degrees downwind; the foliage lobes change shape frame to
  frame (the lower right mass reaches further out at 0.4 to 0.5 s than at 0.1 s while the upper left lobes rise and
  fall out of step); tips 0.13, 0.42, 0.15 m in 1.2 s. A living crown, not a still one; a big gale it is not,
  because the wood shelters it (above).
- `crown-gust` (149 s), OPENED: the same, smaller (trunk 4.6 to 5.6 degrees, tips 0.10 to 0.16 m in 1.2 s).
- `crown-breeze` (100 s, 4 m/s at 10 m), NOT opened: numbers only, tips 2 to 6 cm in 1.2 s, trunk 1.0 to 1.1 degrees.

**API added (all additive).** `flora.js`: `FLORA.crownLu`, `clockR`, `clockK`, `branchRes`, `branchResX`,
`branchResUp`, `crownI`, `crownBand`; exports `CLOCK_F`, `CLOCK_W`, `CLOCK_ID`, `CLOCK_M`; `FloraField.clockPhase`;
uniform `uPhysBranchClock` (in `fields.flora.uniforms` and declared in `FLORA_GLSL`); `plantCrown`'s out also
carries `res` (rms of the resonant swing, m). The eleventh agent's, now judged and kept: `plantCrown`,
`FloraField.crownAt`, `crownWind`, `pcPhysCrown`, `physics.fields.flora.plantCrown(re, rn, h, H, root, shake01, id,
leaf01, out)`, uniforms `uPhysBranch` (x is now the wind at load 1, m/s), `uPhysBranchPhase` (xyz eddy trains, w the
twig clock). Lab: `crown=e,n[;...]`, `crownH=`, `__lab.crownTip(k, i)`. Film: `crown-breeze`, `crown-gust`, `crown-storm`.

**Behaviour that changed without a call changing.** `pcPhysBranch` / `plantBranch` no longer read the trunk's bend:
the branch's wind is looked up at the root (the eleventh agent's change), and now also rings at its own frequency.
Nothing draws branches in the game yet (PAINTER's define is off), so nothing in the game's picture changes until
PAINTER switches it on.

**Cost.** `physics.update`: four more phase advances a frame (nothing measurable); not re-measured. The shader:
24 sines, 4 powers, 2 field lookups a crown vertex.

**Not done, in order.** (1) P14 item 2, leaves that can be seen (nothing changed: five to ten times the count in a
gale, some carried near the camera's path, a tumble phase for PAINTER's two-toned leaf). (2) Item 3, the shore (the
probe's run-up columns still print null; Earth beach calm and breeze, Neptune's storm coast at 40 to 55 s, with
`kits=painter`). (3) Item 4, re-film `explorer-jet`, `ship-hover` (make the lab's hull draw `buffetAngle`, roll and
yaw), `clamber-run-moon`. (4) The crown shelter in a wood (above). (5) From P13 and P12: see those blocks.

## Hand-over P13 (tenth PHYSICS agent; read this block first; P12 and older below hold for everything not named here)

**Where things stand.** `node --test src/physics/` 262 tests pass (9 new); PILOT's 117 pass on a clean export of
`1186819` with my files (run twice: after the gait, and after the three judgements). Nothing half-edited, no job
running. Scratch: `/home/user/.pc-scratch/physics/p13/` (`ex.sh`: a clean export of HEAD with the working
`src/physics` and `physics-lab.html` over it, into `p13/root`; `gait.mjs`: the stride's numbers per world and pace;
`rock.mjs`, `rock2.mjs`: a run at a 1 m boulder on PILOT's profile, the largest loss of speed in one step and a
trace; `hull.mjs`: the hovering hull's attitude in three winds; `cost.mjs`: the crouch and the body step's cost;
`before/`, `after/`: the strips). Items 1 and 2 of the order are done; **items 3 (trees and leaves in a storm) and
4 (the Earth shore, seen) are not done**: what I found for item 3 without filming is under "Not done".

**1. The gait (`explorer.js`; `gaitOf`, `stepGait`).** The body PILOT tuned (`st.p`, `st.v`: the path, the top
speeds, the stops) is the stride's MEAN and is not touched: a test runs the same commands with two different
stride phases and gets the same place and velocity to the last digit. Within the stride the hips ride the standard
mechanics of a legged walker:
- *Which gait and how long a step*: dynamic similarity (Alexander). Froude number Fr = v^2 / (g L), L = 0.9 m, g
  the planet's (less buoyancy when wading). A walk below Fr 0.5, a run above (hysteresis 0.45 / 0.55): 2.0 m/s on
  Earth, 1.0 m/s on the Moon. Step = L x 1.10 Fr^0.21 walking (0.72 m at 1.4 m/s: Grieve's v^0.42), L x 1.20
  Fr^0.34 running (the form of Alexander and Jayes). Cadence = v / step. **PILOT's "walk" (4.2 m/s) is by its gait a
  run (Fr 2.2)**; a walking gait is seen only under 2 m/s (a gamepad's half stick, a climb, sand, a headwind).
- *A walk* is an inverted pendulum on a rocker foot (roll-over radius 0.3 L): the hips are at standing height over
  the stance foot and lowest while both feet are down (the weight passing from one arc to the other), and slowest
  at the top (65 % of the rise comes back as speed).
- *A run* is a spring-mass: a ballistic flight under the planet's own gravity between contacts; in contact the leg's
  force is half a sine whose impulse carries the weight over the whole step (peak = pi/2 x g x period / contact);
  the foot is down while the body travels 2 L sin(30 deg) = 0.9 m; lowest at mid-stance, highest in mid-flight;
  braked while the foot is ahead, driven when it is behind.
- Numbers (`p13/gait.mjs`, the body's own 60 Hz steps; g as in `src/data/bodies.js`):

  | world, pace | gait | step | steps / s | foot down | flight | in flight | hips (cm under standing) | bob | peak force |
  |---|---|---|---|---|---|---|---|---|---|
  | Earth 1.5 m/s | walk | 0.76 m | 2.0 | 0.60 s | none | 0 % | 5.5 to 0 | 5.5 cm | 1.3 x weight |
  | Earth 4.2 m/s | run | 1.41 m | 3.0 | 0.21 s | 0.12 s | 36 % | 12.7 to 5.9 | 6.8 cm | 2.5 |
  | Earth 7.4 m/s | run | 2.07 m | 3.6 | 0.12 s | 0.16 s | 58 % | 10.8 to 4.8 | 6.0 cm | 3.6 |
  | Moon 1.5 m/s | run | 1.13 m | 1.3 | 0.60 s | 0.16 s | 21 % | 13.5 to 7.0 | 6.6 cm | 2.0 (lunar) |
  | Moon 4.2 m/s | run | 2.27 m | 1.85 | 0.21 s | 0.33 s | 61 % | 10.4 to 4.7 | 5.7 cm | 4.0 |
  | Moon 7.4 m/s | run | 3.34 m | 2.2 | 0.12 s | 0.33 s | 73 % | 9.1 to 4.6 | 4.5 cm | 5.9 |
  | Jupiter (11.5) 7.4 m/s | run | 1.90 m | 3.9 | 0.12 s | 0.14 s | 53 % | 11.2 to 4.9 | 6.3 cm | 3.3 |
  | Pluto (1.4) 7.4 m/s | run | 3.89 m | 1.9 | 0.12 s | 0.41 s | 78 % | 8.8 to 4.7 | 4.0 cm | 6.8 |
  | gravity 24.8, 7.4 m/s | run | 1.47 m | 5.1 | 0.12 s | 0.08 s | 39 % | 12.5 to 5.8 | 6.8 cm | 2.6 |

  The speed within the stride (`pulse`): -0.07 to +0.14 m/s strolling, -0.18 to +0.09 at 4.2 m/s, -0.18 to +0.05 at
  7.4 m/s on Earth, half that on the Moon. A lope's rise is small by its own arithmetic (a 0.33 s flight under
  2.2 m/s^2 rises 3 cm): the Moon reads in the long steps, the slow cadence and the time in the air, not in height.
  Caveat, written down: people in simulated low gravity lengthen their stride less than dynamic similarity says
  (Donelan and Kram 2000), so this lope is if anything too long; the standard model was asked for and is what is in.
- *Footfalls*: each foot comes down at stride phase 0 (left) and 0.5 (right), half a stance's travel ahead of the
  body and 8 cm to its own side, on the ground there (one more surface sample per footfall); a landing from the air
  is a footfall of both feet. Tested: none missed, left / right alternate, a step length apart, on the ground.
- *The jump's anticipation*: on a jump command the legs fold for `jumpCrouch` (0.12 s) before the push; the hips
  fall no faster than gravity (nothing can pull them down): 4.5 cm on Earth, 1.1 cm on the Moon, in `st.phys.hip`;
  `crouch01` runs 0 to 1. Then the same take-off speed and the same height as before. `cmd.jumpCrouch = 0` (or the
  tuning) is the old jump. A real counter-movement of 0.3 m takes 0.26 s on Earth and 0.5 s on the Moon: how much
  of that the game wants is PILOT's.

**2. Three judgements (`explorer.js`, `ship.js`; each held by a test).**
- *Jetpack descent.* The 5 s at 9 m/s of the P12 strip was the LAB's own `descentLimit: 9`. In the game the limit
  is PILOT's wrapper's (`terminalFall` 24 m/s, then `softFallSpeed` + 0.45 m/s per metre over 1.5 m): a 49 m fall is
  free for 1.9 s, meets the limit at 33 m and 17 m/s and is gathered in to 4 m/s over 3.4 s: never one speed. What
  was mine: the brake came on at full in the step the limit was passed. It now lights a quarter of the limit before
  it and grows with the square (`retroBand`), carrying the weight exactly at the limit: the largest change of
  acceleration in one step was 9 m/s^2, now under 1.2. The lab commands PILOT's law (`descent=<m/s>` for one speed).
- *The hovering hull.* `buffetAngle` was the chop alone: 0.07 degrees in a breeze. Now the wind's force on the hull
  acts above and aft of the centre of mass (`cpHeight` 0.5 m, `cpAft` 1.2 m, `cpPlan` 0.6 m) against an attitude
  hold (`holdRate` 1.6 rad/s, `holdDamp` 0.45: it overshoots a gust and comes back): a side wind rolls the hull
  away from the wind and swings the nose into it. By the hull's own mass (4.2 t) and areas (`p13/hull.mjs`): in
  gusts of 6.5 to 10 m/s roll 0.2 to 0.7 degrees and yaw 0.2 to 0.6; in 14 to 26 m/s roll 0.9 to 4.8, yaw 0.9 to
  3.8; in 30 to 50 m/s roll 4.5 to 17. **So in the breeze the lead saw, the hull really is nearly level (half a
  degree); it rocks by degrees in a storm.** `buffetAngle.yaw` is new. Drawn attitude only, never the flight.
- *The check at a boulder.* The feet still go no further up a face than the hips can follow, but the body is not
  stopped in that step: the legs take its speed up at `legCatch` (30 m/s^2) while it comes on over its planted feet
  (`st.phys.surge`, 0.4 m at most). Moon, 7.4 m/s at a 1 m boulder: 2.2 m/s lost in one step before, 0.5 now, over
  0.16 s; Earth, Mars the same bound; still no step in the air, the top crossed at the same pace.

**The strips** (640 x 360, quality 1; `docs/shots/physics/motion-explorer-*.jpg` with `.json`; the "before" from a
clean export of `1186819` as committed, the "after" from the same export with my working files after the gait
commit `60423e0`, before the three judgements). Opened: `explorer-walk` before and after, `explorer-run-moon` before
and after, `explorer-run` after, `explorer-stroll` after. Not opened: `explorer-run` before, `explorer-stroll`
before, `explorer-walk-moon` before and after (numbers only: hips 10.6 to 4.6 cm under standing, feet down
`001100022200011000`).
- Before (`-before.jpg`): a peg on one fused leg, the same in all 18 frames, sliding over the ground (hips 0.000).
- `explorer-walk` after (Earth, 4.2 m/s, 15 frames a second): two legs scissor, crossing under the hips every third
  frame; the torso is visibly lower at mid-stance than at the spread; a figure that plainly steps, three steps a
  second. With stick legs the flight does not read as a flight: at the spread both boots are within centimetres of
  the ground (a run's rise is 3 cm), so it reads as a brisk striding walk. A knee and a heel kick are PAINTER's.
- `explorer-run-moon` after (4.3 to 5.4 m/s: without PILOT's thrusters the lab's body is still gaining pace):
  the same scissor at about half the cadence, the spread pose held for three to four frames of twelve a second
  (the flight), the legs together for two (the contact). It steps; the lope reads as slowness, not as height.
- `explorer-run` after: stands with its feet together, steps off, the stride lengthens with the run, stops with
  the feet together again at 2.4 s; one last small step as it settles.
- `explorer-stroll` after (1.5 m/s): a walk, two steps a second, both boots on the ground at the spread, legs
  together over the stance foot.
- NOT re-rendered after the three judgements: `explorer-jet`, `ship-hover`, `clamber-run-moon` (their numbers come
  from Node: `rock.mjs`, `hull.mjs`, the tests). The lab does not draw `buffetAngle` on its hull.

**API added in P13 (all additive).** `explorer.js`: `gaitOf(v, g, T, out, was)` (also `physics.explorer.gait`);
`st.phys`: `gait`, `stride`, `stepPhase`, `cadence`, `stepLength`, `duty`, `footDown`, `flight`, `bob`, `bobV`,
`ride`, `pulse`, `surge`, `load`, `steps`, `footfall`, `footfalls`, `feet`, `heading`, `crouch01`, `jumpT`;
`cmd.jumpCrouch`; tuning `gaitFr`, `walkStep`, `walkStepExp`, `walkDuty`, `walkDutyFr`, `runStep`, `runStepExp`,
`gaitSweep`, `runDutyMax`, `gaitRocker`, `recovery`, `stepWidth`, `jumpCrouch`, `retroBand`. `ship.js`:
`buffetAngle.yaw`, `st.phys.gustAtt`, tuning `cpHeight`, `cpAft`, `cpPlan`, `holdRate`, `holdDamp`. Lab: `descent=`;
the stand-in has two legs. Film: `explorer-walk`, `explorer-stroll`, `explorer-walk-moon`, `explorer-run-moon`;
`P.ex()` carries `ride`, `gait`, `stride`, `feet`, `steps`.

**Behaviour that changed without a call changing.** (1) The feet leave the ground 0.12 s after a jump command
(same speed, same height). (2) At a face `st.v` falls at 30 m/s^2 instead of in one step (the place is as before).
(3) The descent brake begins at three quarters of `cmd.descentLimit` (a fall reaches the limit a little later and
never with a step in its acceleration; a jump's last 0.1 s is a touch softer). (4) `buffetAngle.pitch` and `.roll`
carry the wind's trim (PILOT draws them on the hull, clamped at 0.12 rad). (5) The lab's descent is PILOT's law.

**Cost.** The body step at a run over rolling ground: 2.9 microseconds with the gait (the P12 file measured 3.7 in
the same minute: the difference is the machine's noise, not a gain), plus one surface sample per footfall (2 to 4
a second). `physics.update` was not touched and not re-measured. No timing test failed in three full runs.

**Not done, in order.**
1. *Item 3, trees and leaves in a storm* (nothing filmed, nothing changed). Found by search: **PAINTER does not
   call `pcPhysBranch` anywhere in `src/world` or `src/render`**, so no branch moves in the game or in the painted
   lab; the "+-7 cm at 1.7 Hz" of P12 was `plantBranch`'s number, never a picture. And the number itself is small:
   branch swing is `branchGain` (1.3) x the TRUNK's lean, and P11 made trunks stiff, so the branches went quiet
   with them. A leafy birch branch of 3.5 m in a 20 m/s gale carries tens of newtons of its own drag and its tip
   moves +-0.3 to 0.6 m at 1 to 2 Hz. Next: drive the branch by its own wind load (the gust speed at the crown, not
   the trunk's lean), in `plantBranch` and `pcPhysBranch` alike, aim at those tips, and prove it in the lab by
   applying `pcPhysBranch` in a stand-in crown. Leaves: `PARTICLES.capacity.leaves` is [80, 260, 600] and a leaf's
   `size` is its real 4 to 6 cm: 190 leaves round the focus are about ten in view, 3 px each at 10 m. Next: five
   to ten times the count in a gale, and a mark that stands for a spray of leaves (see For PAINTER).
2. *Item 4, the Earth shore*: half done. `shore-earth` (a calm: Hs 0.37 m, 3.4 m waves, not breaking; the water
   8 m out moving +-0.09 m, 22 m out +-0.12 m) was rendered from the export of `1186819` with my files and OPENED
   (`motion-shore-earth.jpg`): from 4 m up a sand beach, looking along the shore, a white foam rim lies along the
   water's edge and **the edge is in the same place in all 24 frames (6 s)**; the rim swells and thins a little
   with a period near 3 s (brighter and broader at 0 to 1 s and 2.5 to 3.5 s) and the dark patches of the water
   shift, but nothing runs up the sand and nothing drains back. In that export PAINTER's shaders do not use
   `pcPhysWaterRunup` or `pcPhysWaterLong` (PAINTER's uncommitted `src/render/materials.js` in the working tree now
   names them), so this is the shore BEFORE the run-up is drawn. What it should show there: on a 0.07 beach the
   edge travelling about 0.8 m up and back (Stockdon: swing 0.75 x slope x sqrt(H L) = 6 cm of height) in the long
   train's period. To do: re-film when PAINTER's wiring is committed; a breeze (the subject takes `--q "t=..."` for
   a time of stronger wind); the probe's `runup` and `swash` columns print null (the probe does not reach
   `fields.water.runup`): fix it so the strip carries the edge's travel in numbers.
3. The lab's hull does not show `buffetAngle`; `explorer-jet`, `ship-hover`, `clamber-run-moon` not re-filmed.
4. The stand-in's legs are sticks: no knee, so a flight phase does not read as one. A knee that folds in the swing
   (heel toward the hip) would show it; that belongs to whoever draws the figure.
5. From P12, still open: the storm frame not re-shot; `tree-gust`, `clamber-run`, `clamber-walk-moon` not opened;
   the sea state is one state round the focus; nothing under one second in the gust pattern.

## Hand-over P12 (ninth PHYSICS agent; P13 above is newer; P11 and older below hold for everything not named here)

**Where things stand.** `node --test src/physics/` 253 tests pass; PILOT's 117 pass on a clean export of `6130796`
with my files. Nothing half-edited, no job running. Scratch: `/home/user/.pc-scratch/physics/p12/` (`ex.sh`: a clean
export of HEAD with the working `src/physics` and `physics-lab.html` over it, into `p12/root`; `descend.mjs`: the
ship's last metre; `seam.mjs <speed>`: the wind at the focus across a re-anchoring, part by part; `kick.mjs`: a step
off a boulder; `oneair.mjs`: the particles' wind against `physics.air` at a wood's edge; `cross.mjs`: the lateral
turbulence against Kaimal; `nept.mjs`: what the wave chunk gives and what PAINTER's vertex shader keeps of it on
Neptune's storm coast; `after/`: the strips; `motion-before/`, `motion-after/`: PILOT's landing scene with the old
and the new ship model).

**The four faults (all fixed, each held by a test).**
1. *The ship's descent hung above the gear* (`ship.js`). Cause: the ventral thrusters gain a third more lift near the
   ground and the flight computer, a proportional hold, let that lift balance its whole velocity error (0.05 m/s at
   1.1 m where 0.6 was asked; 2.12 s for the 0.6 m from 1.6 to 1.0 m). Now the computer allows for the cushion
   (`SHIP_BODY.groundComp`, 0 = as before): 0.78 s, slowest 0.45 m/s (the engine's lag: a real, small cushion). The
   cushion is of air (`groundAir`: none in a vacuum). The gear model's wash is of the thrust the cushion leaves.
   **The game's own landing does not go through this**: PILOT's `tests/motion.mjs --only landing` gives the same
   heights with the old and the new `ship.js` (1.99 m to the ground in 44 frames at 30 Hz, no plateau, within 8 mm
   of each other frame by frame); the hang was in the lab's `ship=fly` sequence and in any hover that sinks on a
   velocity target.
2. *The re-anchoring* (`air.js`, `near.js`, `flora.glsl.js`, `water.js`). 0.38 and 0.61 m/s in the frame of the
   re-anchoring against 0.030 in any other, at a walk. Four causes: the wind lay in the tangent plane of the ANCHOR
   (5.5 degrees off the ground 384 m away); the gust pattern was read on that plane (18 m above the sphere there); a
   point's place in the grid (`lx`, `lz`, the shader's `pcPhysGrid`) was not the place whose ground the grid had
   sampled (1.8 m apart at 384 m, more with relief); the planet's wind was projected onto the plane, not turned into
   it. Now 0.007 and 0.009 against 0.030. `LocalFrame.lx / lz` and `pcPhysGrid` are the exact inverse of `dir()`.
3. *One air* (`particles.js`, `loose.js`, `air.js`). Every particle had the wind profile of the ground the FOCUS
   stood on and the whole lee of the trees at every height: up to 3.5 m/s off `physics.air` at a wood's edge. Now
   each node of the wind grid has its own profile (`AirGrid.profileAt`, and the same blend tabulated every metre on
   the 5 x 5 nodes round the focus: `_wv`, `_ht` in the particle system). Largest difference 0.39 m/s.
4. *Across the wind* (`wind.js`, `air.js`). `gustCrossAt` (two large octaves, in the grid's fields), `gustCrossFineAt`
   (two fine ones, at a point), `gustCross`, `gustCrossFull`; `WIND.crossWeights`, `crossNorm`, `crossRatio`.
   sigma_v / sigma_u 0.77 to 0.79, shares by period within 0.06 of Kaimal's lateral spectrum, direction 8 degrees rms
   over grass at 10 m. `physics.air().veer` is the lateral speed over the mean wind.
Also, from the lead's relay: *no upward kick off a boulder* (`explorer.js`: the hold lets go a body that rises no
faster than the ground it ran on: +0.2 to +0.35 m/s where it was +0.9 to +1.5; `explorer.test.mjs`), and *rings are
born soft* (`pcPhysRingCover`).

**The strips (all in `docs/shots/physics/motion-*.jpg` with `.json`; 640 x 360, quality 1, a clean export with my
working files).** Opened in P12 and what was seen:
- `ship-land` (before and after): before, five frames at one height from 4.3 to 5.7 s; after, an even descent,
  first foot at 6.0 s, down by 6.3 s.
- `clamber-walk` (Earth): the figure walks up to the mound, shortens on the face (legs folded 0.44 m), crosses the
  top at 2.3 to 2.7 m/s, comes down still folded 0.28 m and is straight 0.6 s later. In contact all the way.
- `clamber-run-moon`: 5.3 m/s to 1.97 m/s within one frame at the face (a hard check), three frames near the
  top, down in contact, no flight. `clamber-run`, `clamber-walk-moon`: numbers only (no frame in the air; feet top
  out at the boulder's 0.96 to 1.0 m).
- `shore-neptune`: from 4 m up the beach, looking along the shore: the foam-rimmed pool at the water's edge is the
  same in all 24 frames (6 s); nothing runs up or drains back; the sea beyond does not heave; a dark slab with a
  straight vertical edge stands against a pale sky. `shore-earth`: not opened (Hs 0.37 m, water 8 m out moving
  +-0.09 m).
- `spray-neptune` (every kit but the spray hidden): **spray is seen**: level pale dashes over the surf and against
  the sky, 160 growing to 580 in 2 s, 15 to 17 m/s, 1 to 2.5 m up. With the rain shown they cannot be told from the
  rain (both are pale level dashes). In this view the surf lines DO move (white ragged patches spread over the
  mid-ground from 1 s on); two pale forms with hard curved edges stand in the sky left and right (not kits).
- `grass-gust`: the strokes' slant changes from frame to frame (18 to 60 degrees, the direction swinging 50 degrees
  either way); no stroke appears or vanishes; the meadow is too sparse for the front to read as a wave.
- `tree-storm` (after the trunk fix): rain and sky carry the storm; the trees are nearly the same in every frame
  (trunks 3.6 to 4.0 and 10.1 to 10.3 degrees in 1.2 s, branch tips +-7 cm at 1.7 Hz): **in a 1.2 s window the
  birches read as still**. `tree-gust` (not opened): 1.4 to 3.0 and 3.8 to 8.2 degrees over 6 s.
- `explorer-run`: the figure does not bob at all (hip +-0.01 m): **a run that glides**; the ground slides evenly.
- `explorer-jet`: an even climb to 49 m and an even 9 m/s descent (5 s at one speed reads as floating); the lab's
  camera goes through the crowns.
- `ship-liftoff`: smooth; the wash falls to 0 for 0.75 s at the top of the climb (the lab's height hold cutting the
  thrusters) and comes back. `ship-hover`: the hull hangs dead level in gusts of 6.5 to 10 m/s (4 cm, 15 cm of
  bob): **reads as pinned**; `st.phys.buffetAngle` is not drawn by the lab.
- `mars-dust`: sand streaks steady; the pale puffs near the eye are in one frame and gone in the next at 6 frames
  a second (a puff crossing the view in under 0.2 s): reads as flicker.
- `leaves-gust`: 190 leaves in the air and a handful of one-pixel specks in the picture: **leaves do not read**.
  They now ride the calm under the crowns (4.5 to 5.2 m/s where the meadow's wind at 2 m is 8.5).

**Neptune's coast (item 3; `nept.mjs`).** The wave chunk gives what it should and it moves: +-0.8 to +-1.5 m,
changing 1.3 to 2.3 m/s. PAINTER's vertex shader keeps none of it where the picture looks: see For PAINTER.

**API added in P12 (all additive).** `ship.js`: `SHIP_BODY.groundComp`, `groundAir`. `wind.js`: `gustCrossAt`,
`gustCrossFineAt`, `gustCross`, `gustCrossFull`, `WIND.crossWeights`, `crossNorm`, `crossRatio`. `air.js`:
`AirGrid.cross`, `AirGrid.profileAt`, `sample()` fills `o.cross`; `physics.air()` and `here.air` carry `veer`.
`water.js`: `WaterField.runupAt(x, z, slope)`, `fields.water.runup(p, slope)`, GLSL `pcPhysWaterRunup(p, slope)`,
`pcPhysWaterLong(p)`, `WATER.swashSetup`, `swashSwing`. Lab: `rock=`, `rockAt=`, `rockR=`, `lookE=`, `lookN=`.
Film: seven new subjects.

**Cost.** `physics.update` medians at quality 1, load 10 (`p11/prof.mjs`): Mars dust 0.75 ms (0.70 before P12),
blizzard 1.42 (1.50), storm in the forest 0.78 (0.68), Neptune's sea 1.33 (1.10); worst frames 5.5 to 130 ms, the
machine's. The frame-budget test of `loose.test.mjs` failed once in a full run at load 12 (Neptune 1.59 ms against
1.5) and passed alone three times of three.

**Not done, in order.** 1. A gait: the run has no bob (a hip rise of 4 to 5 cm at the stride's frequency, 2 cm at a
walk, handed over in `st.phys`). 2. Trees in a storm read as still in a short window: the branch sway is
centimetres. 3. Leaves do not read (count, or PAINTER's mark). 4. A crouch before a jump. 5. The storm frame was not
re-shot. 6. `shore-earth`, `tree-gust`, `clamber-run`, `clamber-walk-moon` not opened. 7. The sea state is one
state round the focus: a focus standing in shallow water makes the whole sea low. 8. Nothing under one second in
the gust pattern (Kaimal has 10 % of the longitudinal and 22 % of the lateral variance there at 11 m/s).

## Hand-over P11 (eighth PHYSICS agent; read this block first; P10 and older below hold for everything not named here)

**Where things stand.** `node --test src/physics/` 246 tests pass; PILOT's 115 pass on a clean export with my
files. Nothing half-edited, no job running. Scratch: `/home/user/.pc-scratch/physics/p11/` (`ex.sh`: a clean
export of HEAD with the working `src/physics` and `physics-lab.html` laid over it, into `p11/root`;
`series.mjs`: wind and the lean of grass and a trunk at the real spawn, 10 s windows; `spectrum.mjs`: the mast
at 10 m against Kaimal; `rainv.mjs`: rain speeds by height; `land.mjs`: a jump and its landing; `prof.mjs`:
`physics.update` in four weathers, `Q=2` for the top tier; `before/`, `after/`: strips and logs).

**The filmstrip tool (item 1).** `node src/physics/three/film.mjs <subject>[,..] | all | list [--root <export>]
[--out <dir>] [--tag t] [--q "a=b"] [--quality 2]`. Each subject opens the painted lab (the game's kits) with
the clock stopped; `__lab.film({frames, dt, sub, crop, tile, cols, each, probe})` advances the simulation at a
fixed step, draws, copies the crop into one sheet IN THE SAME TASK as the draw, and reads that frame's numbers
from the simulation. Output: `motion-<subject>.jpg` and `.json` (the numbers per frame, the URL, `info()`).
A strip takes 75 to 125 s here. Also new in the painted lab: `lab.ctl` (`wish [e, n]` m/s, `jump`, `jet`,
`yawRate` deg/s, `follow`, `ship 'rest'|'up'|'down'`), `lab.run(seconds, dt, each)` (unseen), `lab.enu(p)`,
`lab.at(e, n, h)`, `ship=fly` (the real gear and flight models through PILOT's sequence and numbers), and the
explorer drawn as a torso on legs of the model's own length (`legs=0`: the old capsule).
The subjects (table in `film.mjs`): look-around, grass-breeze / -gust / -storm / -walker, tree-breeze / -gust /
-storm, explorer-run / -jump / -jump-moon / -jet / -clamber, ship-liftoff / -hover / -land, rain-turn,
snow-blizzard, mars-dust, leaves-gust, sea-neptune.

**What the strips showed and what was done (item 2).** Strips in `docs/shots/physics/motion-*.jpg` with their
numbers in `.json`; all rendered from `p11/root` = a clean export of the head of the moment (`ca8710f`, then
`2c6b25b`) with my working files over it; 640 x 360 viewport, quality 1.
- *Grass, breeze (opened before and after).* Before: twelve identical frames; the lean changed 0.01 degrees
  in 0.8 s (in a 2 m/s breeze the shortest period in the wind was 17 s). After: 2 to 7 degrees, changing 2 to
  3 degrees a second; in the picture the motion is slight, as it should be in light air.
- *Grass, storm (opened after).* Before: three blades a metre apart within 0.6 degrees of each other, the
  meadow one sheet. After: 58, 50 and 30 to 45 degrees at the same instant, a blade swinging 20 degrees in a
  quarter second and back; no popping seen; splash rings grow on the ground.
- *Grass and the walker (opened).* The walker crosses at 1.61 m/s, even spacing; stems under the path go to
  83 degrees (flat 0.98), 1 m to the side 27 to 38 degrees as it passes, 1.4 m behind 55 to 66 degrees; a
  pale ground mark stays behind it. **The parting is not legible in the picture**: the blades are sparse
  strokes and the crop cut the walker at the waist (re-frame it; see For PAINTER).
- *Trees, storm (opened before).* Before: trunks pinned at 12.4 and 14.3 degrees (the limit), nothing moving
  in 1.2 s but branch tips (8 cm). After (numbers; the after strip is stored, not opened): 4.2 falling to
  3.2 and 11.9 to 9.6 degrees in 1.2 s, branch tips 6 to 9 cm.
- *Explorer, run (not opened).* 4.2 m/s walk; the run reaches 6.1 m/s after 1.2 s (never the 7.4 asked in
  that time); stop from 6.1 m/s in 0.75 s and 2.6 m.
- *Explorer, jump (opened after).* Before: landed with straight legs and lost half its forward speed at the
  touch. After: the legs fold 0.31 m and straighten in half a second, speed kept; reads as a landing.
  The Moon strip (`after/motion-explorer-jump-moon.jpg`, before the fix, not stored): 6.5 m high, 5 s.
- *Explorer, jetpack (not opened).* 2.5 s burn to 19.8 m/s, apex 49 m, falls at the 9 m/s of the descent
  assist, lands at 10.3 s: the legs take 5.2 m/s, the rest is a blow (hip -0.37).
- *Explorer, clamber: NOT SEEN.* Walking east from the Moon spawn the legs first reach the end of their
  stroke 711 to 762 m out; a second pass over that place at 3 m/s did not clamber. No strip.
- *Ship (none opened).* Lift-off: wash 13 to 26 m/s as the lift ramps, feet off at lift 0.83, 4 m/s climb,
  overshoots 6 m by 0.5 m; grass under the hull flat 0.99 before, 0.58 after it has gone. Hover in the
  storm (9 to 14 m/s at 6 m): holds within 5 cm and 0.06 m/s; a 9 cm bob at 0.4 Hz is the lab script's
  height hold. Landing: first foot at 0.43 m/s, three feet 0.3 s later, the gear travels 16 cm, then 5 cm
  more as the lift hands the weight over. **The descent stalls for about a second between 1.3 and 1.0 m**
  (0.1 m/s where the script asks 0.6): the flight model will not sink in ground effect; not followed up.
- *Rain while the camera turns (opened).* Streaks keep their slant while the trees slide: in the world.
  Drops 1.44 mm, falling 3.6 to 4.6 m/s, moving 11 to 16.6 m/s across (the wind at their height plus 2.5 to
  3.5 m/s carried from above): 15 to 20 degrees below level in a 13 m/s wind, which is right. Faint and few.
- *Snow, blizzard (opened).* Level strokes, 14 m/s, falling 0.6 m/s; the density swings from nearly empty
  to dense within a second (the bands); 500 skim grains at 5.5 to 5.9 m/s. Nothing wrong seen.
- *Mars dust, leaves (not opened).* Dust 478 marks at 9.5 m/s in an 11 to 14 m/s wind, sand 540 to 672
  grains at 1.8 to 2 m/s; leaves 101 to 115 in the air at 15 m/s, falling 1.5 m/s.
- *Neptune's sea (opened).* **Spray is still not identified in a picture.** 5 drops at the start of the
  strip, 681 two seconds later (the camera was turned toward the first five); level pale dashes cross the
  frame, the sea does not visibly heave in 2 s although Hs is 2.77 m, a foam-rimmed pool in the foreground
  does not change, and a pale rectangle with straight edges stands in the sky (see For PAINTER).

**The wind against masts (item 3; `wind.js`, `air.js`, `wind.test.mjs` "P11 a mast at 10 m").** The pattern
was NOT twice as sharp as masts: at equal intensity its 1 s rate of change was 0.6 of Kaimal's. What was
wrong was the shape: 1 to 5 % of the variance under 4 s where Kaimal has 13 to 22 %, a quarter too much at
15 to 60 s, and gust tops cut by the clamp (gust factor 1.36). Now four octaves (90, 34, 13, 5 m), clamp at
3.3 sigma: TI 0.173 to 0.179 (I = 0.172), G(3 s, 600 s) 1.37 to 1.44, shares by period within 0.07 of
Kaimal from 10 minutes to 1 s, p99 of the 1 s rate 0.78 to 0.93 of Kaimal's. The two fine octaves are a
separate level (`gustFineAt`), added exactly at point queries (`airAt`) and node by node for plants
(`AirGrid.fine`, `sampleWind` o[8]); the grid's fields, which particles ride in, keep the two large ones.

**Flutter and trunks (`flora.js`, `flora.glsl.js`).** `flutterAt` / `pcPhysBend`: three frozen eddy trains
(0.9, 1.7, 3.2 m) carried by the blade-height wind, through the blade's own response, along and across the
load; phases in `uPhysWave.z`, `.w` and `uPhysWavePhase.w` (no new uniform). Trunks: `stiffFlex 0.19,
stiffMax 0.30` (3 degrees at 8 m/s, 5.2 at 11, 12 at 20), `branchGain 1.3`.

**The landing (`explorer.js`).** The feet stop, the hips go on down, the legs take up to 5.2 m/s over their
stroke; no friction impulse unless the stroke is exceeded. `st.phys.impact` unchanged.

**API added (all additive).** `wind.js`: `gustFineAt`, `gustLevelFull`, `WIND.gustLength3`, `gustLength4`,
`gustWeights`, `gustNorm`, `gustMax` (`gustLevelAt` now returns +-`gustMax`, not +-1); `air.js`: `AirGrid.fine`,
`sampleWind` writes o[8] when o has room; `flora.js`: `flutterAt`, `FLUT_D`, `FLUT_PH`, `FLORA.flutter*`,
`FloraField.flutPhase`; `uniforms.uPhysWave[2..3]` and `uPhysWavePhase[3]` are flutter phases (were the
constants 0.45, 0.45 and 0); painted lab: `__lab.film`, `run`, `ctl`, `ex`, `sh`, `enu`, `enuV`, `at`, `yaw`.

**Cost (item 4, `prof.mjs`, load average 9 to 11).** `physics.update` median, quality 1: Mars dust storm 0.79
ms, blizzard 1.50, storm in the forest 0.71, Neptune's sea 0.82. Quality 2: 1.02, 2.21, 1.08, 1.56 ms. Worst
frames 8 to 150 ms in both tiers: the machine's. The storm frame was not re-shot.

**Not done, in order.** 1. Spray in a picture (find the surf line by `P.where('spray')` AFTER the count has
grown, or shoot with `kits=lab`). 2. A clamber strip (needs a place: PILOT's boulder run knows some).
3. The ship's stall in ground effect before the gear takes over. 4. The strips not opened: tree-storm after,
explorer-run, explorer-jet, ship x 3, mars-dust, leaves-gust; grass-gust and tree-gust / -breeze not filmed
after the change. 5. The seam when the near field re-anchors (0.4 m/s in one frame; older than P11;
`index.test.mjs` reports it). 6. Particles ride a wind 2 to 3 m/s faster than `physics.air` gives at their
height near a wood (the wake is applied differently). 7. No cross-wind turbulence: the wind's direction
never wobbles. 8. Sea waves in motion (shore, surf) were not judged.

## Hand-over P10 (seventh PHYSICS agent; read this block first; P9, P8 and P7 below hold for everything not named here)

**Where things stand.** `node --test src/physics/` 244 tests; PILOT's 115 pass on a clean export with my files.
Timing tests fail now and then on this machine (load average 13 to 18 all stage: `loose.test` "every body, every
kind", `index.test` budget, `kits.test` cost): run the file alone before concluding anything. Nothing half-edited.
Scratch: `/home/user/.pc-scratch/physics/p10/` (`verify.sh` both suites; `shoot.sh`, `final.sh`, `overlay.sh` the
painted frames; `gust.mjs real.mjs walk.mjs walk2.mjs` item 1; `prof.mjs` cost of `physics.update` in four
weathers; `legs.mjs` item 3; `spraydbg.js` an `--eval` that says where the spray is on the screen).

**Item 1, the wind near the player (done; `air.js`, `wind.js`, `near.js`, `air.test.mjs`).** Three faults, not one:
1. *The 52 m/s2 frame at 241 s was not the gust pattern.* It was the wake of the stand upwind changing stands in
   one frame (the upwind search is a step function of the wind's direction): at the real spawn 86, 123 and 51 m/s2
   at 2, 10 and 30 m. Shelter and wakes now ease toward what the search finds at the pace the air crosses the
   fetch (`AIR.shelterAdjust` 48 m over the wind speed, 1 to 6 s), take newly sampled ground in over
   `AIR.shelterLearn` 0.4 s, and are scrolled with the grid (they were one cell stale for up to four frames at
   every 16 m hop: 452 m/s2 for a walker in the forest, 407 for a runner on open ground).
2. *The gust pattern did race.* Each copy sat at p - wind x tau, tau up to 48 s: with the storm's wind changing
   at 0.6 m/s2 it slid through the air at up to 30 m/s. The grid now carries each copy by the integral of the wind
   (`AirGrid.gustShift`; `wind.js gustLevelAt`, `gustPhase`; exact in a steady wind). The far field (`airAt`
   outside the grid: nothing in play) carries it by the synoptic wind alone, so it cannot race either, but its
   gusts drift at the planet's wind, not the storm's.
3. *The storm's outflow was taken at the grid's centre alone* and hopped with it (1 m/s every 16 m in the gust
   front). Planet and weather wind now sit on a 3 x 3 lattice fixed to the ground (+8 `weatherWind` a frame, 0.04 ms).
- *Numbers now* (60 Hz, first storm, 150 to 330 s): real spawn 7.2, 10.3, 20.2 m/s2 at 2, 10, 30 m (bounds 16,
  23, 44); open test ground 23, 32, 38 (bounds 40, 55, 65; the wind there is 5 to 46 m/s at 10 m); a walker in
  the forest 13; a runner on open ground 28. The bound: lull-to-gust swing x the wind that carries the gusts /
  `WIND.gustLength2` x 1.5. Seen from the air the pattern changes at 0.052 /s (the cross-fade); the old form 0.63.
- *What is still true and is not a fault of this stage:* a gust carried at the wind's own speed past a fixed
  place still changes the wind fast when the wind is fast (p99 8 m/s2 at 10 m at the spawn, 22 on open ground in a
  26 m/s mean wind): the pattern's small octave (34 m) at full weight. Real 10 m masts show 3 to 10 m/s2 in
  severe gusts; the model is perhaps twice as sharp at its extremes. Softening it changes how gusts cross a
  meadow; not done, not asked.

**Item 2, the marks (done as physics and kits; the picture is half done, see the verdicts).**
- *Found: the painted lab drew every mark twice.* `world.setPhysics` builds the kits itself since PAINTER wired
  them, and the lab built its own on top: every painted frame from P5 to P9 shows both. Now `kits=painter`
  (default): the world's kits, PAINTER's materials, the game's picture; `kits=lab`: the stand-in alone (what the
  physics proposes; dust, sand and leaves as a glaze after the painting, no depth); `kits=0` none.
- *Dust.* Fed as fast as the wind empties the box (190 marks became 470). Six in ten marks are low veils 11:1
  (was one in twenty, 4:1), under 1.1 m high, none nearer than 1.4 m. Per vertex `aPcVeil` -> `vPcData.y`
  opacity (0.75 at the ground to 0.15 from 3 m up, fading in and out with the mark), `.z` softness, `.w` veil01
  (0 puff, 1 streamer). `buf.hag`: height over the ground under each loose particle.
- *Blowing sand and snow.* Grains leave the ground in streamers (`loose.streamAt`: snaking bands, a third of the
  ground, travelling downwind at 0.55 of the wind). Snow on the ground is blown now (it never was): a skim (the
  sand kind, material snow) and powder over it (the dust kind, material snow), `here.blown.snow`. Sand strokes lie
  level (`level: 1`).
- *Leaves.* `aspect 0.33, flip, edge`: 1 in 3 broadside, a line edge-on, turning either way. Torn off with the
  fourth power of the wind, more while it rises: 20 in the air in 4.5 m/s, the whole 260 in 15.6 m/s.
- *Spray.* `loose.sea()`: spume off breaking crests from 9 m/s (full at 24), surf where the water is shallower
  than 1.3 Hs. Spray rides the wind over the sea and is gone when it falls back in. `here.blown.spume`, `.surf`.
- *Snow.* A flake in a wind is a level stroke up to 8 flake sizes long (was 3, beyond which it was taken away),
  and comes in bands carried by the wind (`bands 0.8`).
- *Capacities* (quality 1 / 2): dust 1000 / 2400, sand 1200 / 2800, leaves 260 / 600, spray 800 / 1800.
- *Cost* (`prof.mjs`, median `physics.update`, this loaded machine, before -> after): Mars dust storm 0.81 -> 0.68
  ms, blizzard 1.04 -> 1.30 (1100 skim grains), storm in the forest 0.53 -> 0.91 (257 leaves), Neptune's sea 0.50 ->
  0.67. Worst frames here are the machine's (40 to 90 ms in both).
- *Frames* (all from the clean export of `d66f2ec`, which holds PAINTER's `f1a395e`; 960 x 540, quality 1):
  `painted-mars-dust.jpg`, `painted-snow.jpg`, `painted-storm-forest.jpg`, `painted-neptune-sea.jpg` are the
  GAME's picture (`kits=painter`); `painted-proposal.jpg` is the same four with the stand-in (`kits=lab`).
  `painted-rain-options.jpg` is gone (PAINTER glazes the rain now). Before frames: `p10/before-sheet.jpg`.
  Verdicts under "For PAINTER", P10.

**Item 3, the cost of the legs (measured; nothing changed).** `legs.mjs <root> <body> <hz>`: a run, 8 headings
from the spawn, PILOT's `Sim` on the real ground, load average 14: Moon median 22 us a step, p99 101 us, mean 46
us, 2.36 ground samples a step (most 4), legs working 14 % of steps; Mars median 37 us, p99 146 us, mean 59 us,
2.61 samples, legs working 43 %. The body before the legs on the Moon: median 16 us, p99 62 us, 2.00 samples. The
worst single steps (15 to 90 ms, a few in ten thousand) are there in the old body too and outside
`sampleSurface` as well: the machine, not the legs. **The `Sim` steps the body at a fixed 1/60 s whatever the
frame rate**, so a 20 Hz frame is three body steps (0.07 to 0.11 ms) and my split of long steps is never
reached through it.

**Item 4.** Nothing in the game uses `expand: 'gpu'` (the world builds the kits with the default); only the two
lab pages can switch it on. Marked UNUSED in `kits.js` and `chunks.glsl.js`; not brought level.

**Not done, not verified, in order.**
1. *Spray is not seen in any painted frame.* At the stored Neptune shot 18 to 118 drops were alive and none
   was in view (`spraydbg.js`): the camera looks at a cove from 11 m inland. Shoot over open water or along
   the surf line (`lat= lon=` on the sea, or another `yaw`), and look at whether PAINTER's displaced sea hides
   drops within 0.2 m of the surface.
2. *Motion.* Every verdict is a still: streamers snaking, veils streaming, leaves tumbling, bands travelling are
   tested in Node, not looked at.
3. *The top tier.* Frames are at quality 1 (the lab's default); the look is to be judged at quality 2.
4. The gust pattern's sharpness (item 1, last bullet). 5. The instanced path. 6. P9's left-overs (b) and (c).

## Hand-over P9 (sixth PHYSICS agent; read this block first, then P8 and P7 below, which hold for everything not named here)

**Where things stand.** `node --test src/physics/` 230 pass; PILOT's 114 pass on a clean export with my files
(run at the last commit of P9). Nothing half-edited. The owner has removed every triangle and draw-call budget (COORDINATOR E,
last entry): no count is a reason to thin a kit; `physics.update` is still measured as a worst frame.

**Done in P9, item 1: the legs** (`src/physics/explorer.js`, "LEGS, 1 / 2 / 2b / 3" in the code; four tests at
the end of `explorer.test.mjs`).
- *The model.* `st.p` is the feet; the mass rides at the hips. `phys.hip` is the leg length now less standing
  (-`legFold` 0.45 m folded .. +`legReach` 0.28 m reaching down), `phys.hipV` the hips' vertical speed. The legs
  level the hips over the ground (critically damped, `legTime` 0.12 s) but only push: the hips fall no faster than
  gravity (less v2/r), are raised at most at `legLift` 9 m/s2 and caught at `legCatch` 30. So a feature lower than
  the stroke (0.73 m) passes under the hips at any speed. At the end of the stroke the ground acts: *folded out*
  (ground rising faster than the hips can be lifted) the body is braced against the face and goes on at the pace
  the hips can be raised (never faster than gravity and a hold can stop them within a quarter of the stroke; a
  face higher than `clamber` 1.35 m in one step is a wall and stops the body); *reached out* (ground falling away
  faster than the hips fall) the limbs hold on if there is a hold, pull the hips down (`gripAccel` 10 m/s2), and
  the walker holds the pace at which its feet can follow the ground a `look` (1.2 m) ahead (`phys.paceCap`, braked
  through the hold at `braceAccel` 20 m/s2). With no hold, or a drop beyond a clamber, or more than `braceDv`
  2.5 m/s to take up in one grab, the feet leave the ground with the hips' velocity: a fall, or a bound in low
  gravity, as before. A hold exists where the ground a look ahead lies more than reach + `gripDepth` (0.2 m) below
  the line the hips move on (a convex thing at limb scale: a rock, a ledge, a ridge of radius under about 3.5 m),
  or where the feet stand on something that rose over 0.1 m out of the ground the legs last stood on
  (`phys.base`, carried on at the hill's own rate `phys.trend`); it is kept (`phys.grip`) until the legs are
  back at standing length. With a hold the tilt of the rock under the boot does not count (the feet stand on
  holds); a face too steep to hold by friction but within a clamber is stepped up. Ground steps longer than
  `legStep` 0.15 m are split (at most 4): a run at 60 Hz is one step as before, at 20 Hz three.
- *Why the body slows.* Legs cannot pull on the ground. Past a 1.3 m boulder the hips must come down 0.57 m
  after the stroke is used: by gravity alone that takes 0.34 s on Earth and 0.84 s on the Moon. Staying in contact
  therefore means a clambering pace, lower in low gravity; the grip (hands on the rock) is what makes it a walking
  pace rather than a crawl on the Moon. This is the physics behind PILOT's "clamber at a walking pace".
- *Measured* (scripts in `/home/user/.pc-scratch/physics/p9/`): see the tables in "For PILOT".
- *Kept exactly*: jumps, the jetpack, falls from drops beyond a clamber, bounding over rolling ground in low
  gravity (the old test passes unchanged), every other explorer test (none relaxed). *Changed without a call
  changing*: a run across boulders is slower (it no longer teleports up and down them); a drop of 0.3 to 0.73 m is
  stepped down in contact; a vertical ledge of 0.73 to 1.35 m is dropped off from a crouch; `stickGap`,
  `crestFilter`, `phys.unload`, `phys.vvPrev` are retired (kept, unused).

**Done in P9, item 2: the five tests that ran at Earth's old weather start.** All five run on the game's clock
again (`REGIMES.earth.epoch` 480); nothing uses `epoch0` (the helper stays in `testworld.mjs`). **All five were
stale probes; none hid a fault.**
- `sky.test.mjs`, fresh snow under a clear sky ("cover gained with nothing falling: 0.00011"): the first three
  quarter-seconds of a snow front (0.02 to 0.03 mm/h falling, sky number 0.001 to 0.005) were counted as dry by
  the test's own 0.005 threshold. The test counts any snow as falling now; limits unchanged.
- `sky.test.mjs`, the painter's words ("cloud 0.49"): not the storm search (its first storm has cloud 0.96,
  overcast 0.97, rain 0.90) but the fair-day probe, one fixed place at t = 20, half cloudy on the new clock. Now
  the first place at t = 20 with an open sky, nothing falling and no fog (663 of 800 places qualify).
- `particles.test.mjs`, particle life ("323 low flakes, 7 wrong"): the first heavy snow on the new clock is a
  blizzard (12 m/s, gusty); the test's reference, height over the vertical speed of the moment, is a calm-air
  formula and a fluttering flake's speed of the moment is not its rate of fall. Checked in that blizzard: 98 % of
  landings are still announced to within 0.08 s (the property that matters), so `left` is right and the reference
  was not. The probe is the first heavy snowfall that is not a blizzard.
- `particles.test.mjs`, prints ("no message": it was `assert.equal(depth)` at the end, 0 against 0.052): the
  "calm desert at 30 degrees north" was one fixed longitude that has weather of its own at t = 50 on the new
  clock. Now the first longitude on that latitude with a light wind and nothing falling for the minute.
- `weather.test.mjs`, the snow pack ("no pack of its own: 0.027"): the fixed place has 27 mm of fresh snow at
  t = 100 on the new clock; depth = fresh and standing = 0 still held. Now the first place where nothing has
  fallen lately.

**Not done (items 3 and 4 of the P9 order), in order:**
1. *The gust pattern races when the mean wind changes fast* (52 m/s2 in one frame at 30 m, t = 241 s at the Earth
   spawn): the pattern is advected by `tau x wind` with tau up to 48 s (`wind.js`); advect by the integral of the
   wind (a phase kept as state) or cap the pattern's speed through the air at the gust front's own.
2. *Item 4*: spray off the sea in a gale (only bodies emit spray: `loose.js`); dust walls softer and more
   numerous (no kit cap any more); PAINTER asks (via the coordinator) for **leaves as a long thin mark, aspect 3:1
   or more, turning as it flies** (they read as dark round balls at night: `docs/shots/painter/night-storm.jpg`);
   re-shoot and open the Neptune coast frame in the painted lab; whether anything uses `expand: 'gpu'`.
3. Legs, left open: (a) in PILOT's Sim on Mars at a run the legs are off their standing length (`clamber01` > 0.3)
   40 % of the time on plain ground: the hips float over dips in low gravity, which costs one more ground sample
   on those steps; not profiled inside `Sim`. (b) A vertical ledge between 0.73 and 1.35 m is dropped off, not
   climbed down hand over hand (the feet would have to be on the face). (c) `phys.clamber01`, `phys.brace` are
   there for PILOT's animation and sound; nobody reads them yet.

## Hand-over P8 (fifth PHYSICS agent; still holds for everything P9 does not name)

**Where things stand.** `node --test src/physics/` 226 pass; PILOT's 105 pass on a clean export with my files
(`tests/physics.test.mjs:27` failed once in three full runs under load and passed alone, 9 of 9; my own timing
tests in `loose.test.mjs` and `kits.test.mjs` fail now and then under load and pass alone). Nothing half-edited.

**Done in P8** (commits `d149255`, `1cbbcc6`, P8.4, P8.1, and the last one):
1. *Run in a browser and looked at* (painted lab, clean export, no console error in any): thunderstorm in the
   forest, blizzard, Mars dust storm, Neptune's storm coast. Frames in `docs/shots/physics/` under the old four
   names (`painted-storm-forest.jpg`, `painted-snow.jpg`, `painted-mars-dust.jpg`, `painted-neptune-sea.jpg`).
   Found and fixed: **trees whipped upwind in the gust front** (104 deg/s; aerodynamic damping added,
   `FLORA.aeroDamp`: now 10 deg/s at most, test in `flora.test.mjs`); **the lab drew P4's `broad` rain table,
   not the game's** (`painted-lab.js`: default is `DRAW_PAINTED.rain` now; the Neptune frame was shot before
   that fix and shows the old fanning strokes; a re-shot `p8/p8-neptune-gale2.jpg` exists in scratch, NOT opened).
   Walked in PILOT's `Sim` (`p8/stormwalk.mjs <root> <body> <t> [biome|lat,lon]`): numbers in "For PILOT".
2. *The wind where the player stands*: boundary layer by roughness (`BIOMES.storm_seas` z0 0.3 m, sea by
   Charnock: `wind.js seaRoughness`, `ground.js liquidRoughness`); downwind slower than upwind was a 4.5 m cliff
   14 m downwind of the stand, not the model (test holds downwind >= upwind on level ground).
   `cmd.shelter01` (0..1, default 0): the share of the wind FORCE the suit cancels (PILOT's lever; tested).
3. *First storm in daylight*: `REGIMES.earth.epoch = 480` (Earth's weather clock starts 480 s in; nothing else moved).
4. *Regimes*: home-grown storms where a biome's `moist` > 1.2 (`WEATHER.own*`, `ownStorm01`); dust only from dry
   ground (`lift x (1 - moist)`).

**Not done, in the order I would do it:**
1. **Five tests run at Earth's old weather start** (`testworld.mjs epoch0`: snow filling prints and particle
   life in `particles.test.mjs`; the painter's sky words and fresh snow under a clear sky in `sky.test.mjs`; the
   snow pack in `weather.test.mjs`). With the epoch on they fail: "323 low flakes, 7 wrong"; the first system
   found by `find` is no storm (cloud 0.49); "cover gained with nothing falling: 0.00011"; "no pack of its own:
   0.027". The coordinator asked for each to be looked into (probe moved, or a real fault the old start hid):
   NOT done, I ran out of context. Starting the searches at t = -480 instead breaks other tests (negative time).
2. **A boulder as ground launches the body** (PILOT now folds obstacles up to 1.3 m into `env.sample`).
   `p8/boulder.mjs` (pure body, a smooth bump 1.3 m high and 2.6 m across, flanks up to 57 deg): on Earth a
   walker stalls on it and a runner flies 1.4 m high for 0.7 s; Mars walk 1.6 m, run 2.3 m; **Moon walk 3.2 m
   up and 3.6 s in the air, Moon run 5.9 m and 5.1 s**. The body is a point that leaves the ground when the
   ground curves away faster than gravity; legs that flex over anything lower than a leg are missing. Start in
   `explorer.js` where the ground is met again after the move (a leg-length of reach before `grounded` is lost,
   and the vertical speed a ramp gives absorbed over features shorter than a stride).
3. *Spindrift*: a 30 m/s gale over Neptune's sea emits no spray particles (only bodies do: `loose.js`); the sea
   shows foam but nothing flies. *Dust walls* read as pale blots (4 to 5 in view), not as blowing dust.
   *Flakes near the ground* in a blizzard read as pale pebbles (drawn-out ovals); the frame is a white-out.
4. Item 5 of the order (the `expand: 'gpu'` path, calm-air flake crawl, the silhouette request): not touched.
   The gpu path is only reachable through my lab's `expand=gpu`; I did not check whether PAINTER uses it.
5. The gust pattern is advected by `tau x wind` with tau up to 48 s: when the mean wind changes fast (a storm
   arriving) the pattern races (wind at 30 m changed by up to 52 m/s2 in one frame at 241 s at the spawn).

**Critique of the other two domains (for M4's swap), from where I stand.**
PAINTER: (1) in the storm the ground stays sunlit green under a black sky: `wet` and `overcast` do not darken
the grass enough to read as rain light. (2) Trees are rigid in a still frame at 14 degrees of lean: the crown
does not shear against the trunk, so a gale and a calm look alike unless it moves. (3) The blizzard is a
white-out with no horizon and no figure-ground: flakes are white on white; they need the dark of what is
behind them. (4) Dust walls and kicked dust are pale blots with hard edges, like spilled wash, and Mars' sand
streaks are darker than the dune. (5) Neptune's sea is foam at the shore and flat wash beyond: no swell line
to the horizon, so a hurricane sea looks like a pond.
PILOT: (1) a straight walk through the home forest makes 1.8 to 4.1 m/s depending on heading because the
explorer stalls on trunks (speed falls to 0 in five of eight headings). (2) The ship set down 12 m from where
it hovered at the spawn in calm and storm alike: the descent moves sideways by itself. (3) A hop is carried 25 m
on Neptune and 28 m in a blizzard with nothing telling the player why. (4) Walking speed is 4.20 m/s in every
heading in a 19 m/s wind: the assist erases the weather on foot; lean is the only trace. (5) Low boulders as
ground launch the explorer (item 2 above), worst on the Moon.

## Hand-over (kept current; last written at the end of P7 by the fourth PHYSICS agent)

This file is meant to be enough on its own. Read this section top to bottom once; the code
comments carry the physics (every module starts with what it models and from which source).

**Where things stand.** P1 to P6 are accepted. P7 (tune against the picture; the coordinator's
order of this run, plus the lead's review 4 and 5 items that arrived during it) is done as far
as the list below says. The tree is green at the commit that carries this note:
`node --test src/physics/` **220 pass**; PILOT's `node --test tests/*.test.mjs` 105 pass on a
clean export of HEAD with my files (the shared working tree itself had PILOT's half-edited
`src/core/sim.js` failing one of its own tests while I worked: check PILOT's suite on an
export, see below). Worst `physics.update` frame 0.48 to 1.35 ms (`p5/cost.mjs`). Nothing is
half-edited. PAINTER (its fourth agent) is working from "For PAINTER" right now: **if you
change a uniform, an export or a call named there, say so at the top of that section in the
same commit.**

**How to work here** (all of it learned the hard way):
- Commit only with `tools/commit.sh physics "message"`; own only `src/physics/**`,
  `physics-lab.html`, this file, `docs/shots/physics/**` (at most 12 jpg). The coordinator
  sometimes snapshots the working tree as it is (`[physics] WIP snapshot`): never leave it
  red for longer than one command, and run the whole suite after every multi-file edit (I
  left an undefined name in `index.js` for a minute; every page that loads the physics would
  have failed in that minute).
- **The coordinator snapshots the working tree while you work** (`[physics] WIP snapshot`): my
  first P7 code went in under that name, mid-edit, and the lead ran my tests on it (196 of
  197). Keep every state between two commands green.
- **PILOT's suite on a clean tree with your files**: `tools/export-head.sh <dir>`, then
  `cp -r src/physics/. <dir>/src/physics/`, then run `node --test tests/*.test.mjs` in `<dir>`.
  The shared tree usually has someone's half-written file in it. One of PILOT's tests
  (`tests/physics.test.mjs:27`, walking and running) failed once in four runs under heavy load
  and passed alone: it is the load, not the code.
- **A test world must be the body's own size**: `makeWorld({ R: BODIES[id].radius })`. With
  any other radius the place is hundreds of metres above or below the weather and every sky
  number is constant (I measured "rates" of zero for an hour before I saw it).
- Scratch goes in `/home/user/.pc-scratch/physics/`. New in `p7/`: `crawl.mjs` (the P6 one with
  this stage's kit arithmetic), `rates.mjs` (the fastest any sky number moves, 150 places a
  biome), `paths.mjs` (`physics.here.sky` against `physics.sky(physics.weather())`),
  `stormwind.mjs` (the lead's table: wind at 2, 10, 30 m through each storm), `sea.mjs`
  (wind sea and swell at a liquid biome), `wake.mjs` (the walker's wake against a twin world),
  `nodeplay.mjs` (the P6 one pointed at the export `p7/head`), `fresh2.mjs`. What was there
  before and worth knowing:
  - `p6/crawl.mjs <repo root> <blizzard|dust|storm> <still|pan|walk|orbit>`: the kits'
    marks followed from frame to frame WITHOUT GL (pure `expand.js`), counting what a painting
    may not do: marks that vanish or appear at full size, marks that jump, marks that strobe.
    `p6/base` is an export of the tree before P6 to compare with (`tools/export-head.sh`).
  - `p6/nodeplay.mjs <body>`: the integrated game (PILOT's pure `Sim`, PAINTER's real ground
    and obstacles, my physics) played with scripted keys at exactly 60 Hz in Node: the
    numbers of the tables under "The integrated game, played in P6". Takes a minute a body.
  - `p6/play.mjs <body>` (the first agent's `browserplay.mjs`) and `p6/fly2.mjs <body>`: the
    same in a real browser with real key events (software GL, 1 to 4 frames a second: use
    them to see that it works with keys, not for numbers).
  - `p5/cost.mjs <repo root>`: the worst reproducible frame of `physics.update` in five
    scenes, for any tree, so two commits can be compared under the same load.
  - `p6/curv.mjs`, `p6/bench.mjs`: the two checks behind the curved-ground fix and the cost
    of the dab expander.
- Tests: `node --test src/physics/` runs everything through `all.test.mjs`. Keep the output
  short (`| grep -E '^# (pass|fail)|^not ok|error:' | head`): a red run prints pages.
- The pure core must not import three. Only `src/physics/three/` may (`kits.js`,
  `painted-lab.js`); `three/expand.js` and `three/chunks.glsl.js` are pure and tested in Node.
- Headless pictures: `node tools/shot.mjs "<page>?<query>" out.png --w 960 --h 540 [--eval js]
  --timeout 500000 --shot-timeout 240000`. The painted lab (`physics-lab.html?painted=1&...`)
  takes two to five minutes a page; run two at once in the background and wait on their
  files (`until [ -s out.png ]; do sleep 5; done`). **Any change to `flora.glsl.js` is
  compiled into PAINTER's plants at once: load the painted lab and read "no console errors"
  before committing it.** `expand=gpu` compiles `PARTICLE_GLSL`.
- This machine is shared and slow (load averages of 20 on 4 cores are normal): single timings
  lie, and the browser's read-out of `physics.update` (0.8 to 2.5 ms average, 30 to 95 ms
  "worst") is the load, not the code. Cost is `p5/cost.mjs` in Node.
- Things that bit me in P6: a unit vector eased by interpolation never turns round to the
  opposite direction (turn it by the angle); `physics.warmUp` calls `update` with `dt = 0`
  (anything divided by the step must be guarded); a relative "changed by 35 % in a frame"
  measure fires at the small end of every fade (it is not a pop); the near ground grid is 2 m
  (a kerb is a ramp to it); PAINTER's alpine meadow has 49 degree slopes; a place found by
  "where it snows" may be the open sea.
- Read at every sync: `docs/COORDINATOR.md` section E, `docs/lead/REVIEW.md`,
  `docs/notes/pilot.md`, `docs/notes/painter.md`. Answer MUST FIX items here.

**Done in P7** (details in "For PAINTER" (top block), "For PILOT" (top block), API "Added in P7"):
1. *PAINTER's list.* Rain laid parallel, no stroke over 1.2 m or nearer than 2.4 m, a quarter
   of the strokes; snow at PAINTER's sizes, each flake its own shape and slow turn; dust in a
   storm as a few low walls near the ground; a swell on open seas, the crest as a line, the
   significant height of sea and swell together; five times the splash rings near the focus;
   grass parted two metres wide with a wake that lasts six seconds and a pressed path.
2. *Sky numbers and the ruling on snow.* `sky.fresh` (integrated at the focus as it falls);
   standing snow is the biome's own only; rain or snow closes the sky; a gale has its own sky;
   both paths (`here` and stateless) answer the same large-scale wind and agree within 1 % in
   everything but snow; the melt-water step of 55 % is a ramp.
3. *Storms bring wind* (lead review 5, P1, a MUST FIX): each system adds its own wind (`blow`
   in `KINDS`: storm 16 m/s, dust 20, shower 6, rain 3, ice 4 at 10 m) under its cloud shield.
4. *The game re-flown* with PILOT's five levers in, six worlds, numbers in "For PILOT".

**Not done, each with where to start:**
1. *The lead's review 5, SHOULD FIX P2 to P6* (`docs/lead/REVIEW.md`): P2 the first storm
   crosses the spawn at 640 to 800 s, in the dark (a seed or a time offset: `DEFAULT_SEED` in
   `weather.js`, or start the weather clock some 300 s on); P3 half done (the gale sky and the
   swell are in; "never a storm" on `storm_seas` is the regime table: `REGIMES.neptune`); P4
   dust in the air of Earth's forest (`sky.dust` 0.27 at the spawn before the storm: the gust
   front lifts dust where `dustSource` says there is some; the forest's is not 0: `BIOMES`
   in `ground.js`, or gate the lift by wetness and canopy); P5 answered (fresh snow is
   stateful at the focus and says so; the clock-jump case re-reads the quadrature); **P6 not
   touched: walking downwind in 33 m/s is slower than upwind** (0.6 against 3.5 m/s: start in
   `explorer.js`, the wind load and the lean; and the boundary layer over a sea in `wind.js`
   `heightFactor`: 33 m/s at two metres is too much of a 40 m/s wind).
2. *Thunderstorm gusts are still under the lead's 15 to 30 m/s at 10 m in a wood*: measured
   at the spawn 4 to 11 m/s at 10 m (21 to 25 at 30 m, above the crowns), where it was 1.6 to
   3.7. In the open it is more. Tune `KINDS.storm.blow` and the gust gain against
   `p7/stormwind.mjs`; watch the explorer (PILOT's `R-FOOT-5`).
3. *The weather judged in the integrated game by me*: not done. The lead's weather sheet
   (`docs/lead/evidence/weather.jpg`, at `62d3529`) has P7.1 and P7.2 in it, not the sky
   numbers or the storm wind; I did not open it (out of working context). Re-run
   `node tests/weather.mjs` (PILOT's) on a clean export and judge the twelve frames.
4. *The instanced kit path* (`expand: 'gpu'`, `chunks.glsl.js`) has none of this stage's draw
   options (`parallel`, `maxLen`, `near` for streaks; `tumble`, `aspect`, the walls). PAINTER
   uses the CPU path. Port them before anyone switches.
5. *Rates*: Earth's `haze` and Jupiter's `rain` reach 8.5 % a second at the edge of a passing
   cell (the lead allows 8). The source is how sharp a cell's edge is against its drift speed
   (`gather` in `weather.js`: `x0`, `edgeTime`).
6. *Fresh snow away from the focus* is a 21-point quadrature over the past and wobbles (it can
   rise a little under a clear sky): good enough for a tour's read-out, not for a picture.
   A per-place ring of the rate, filled as time passes, would make it exact.
7. *From P6, still open*: the silhouette agreement test for the flora chunk inside
   `PROP_VERT` (method in the P6 list below, item 1); calm-air crawl of flakes; drifts and
   branches judged as a picture (PAINTER has not wired them); on the Moon the explorer's feet
   never leave the ground at a run.
8. *Sand marks*: 2.3 strokes of saltating sand a second go out whole while walking in Mars'
   storm (`p7/crawl.mjs dust walk`); never looked at.

**The P6 list of what was not done then** (kept for its "where to start"):

1. *A silhouette agreement test for the flora chunk inside `PROP_VERT`.* Not started. The
   painted lab is deterministic with `pre` and `freeze=1`, so: put the camera on a lone tree
   (`world.sampleObstacles` gives root and height), shoot once with `physics.setWindScale`
   at its value and once at 50 times less (calm), find the crown's centroid in both frames
   (it is the dark mass above the trunk; diff the frames), and compare the shift in pixels
   with `fields.flora.plantBendLite` + `plantDisplace` projected through the same camera.
   A one-line hook from PAINTER (a debug flag that writes the displaced body-local position
   to the colour target) would make it exact. Note `setWindScale` takes many seconds to
   show at the focus (I asked for 0.12 and the wind fell from 5.6 to 4.6 m/s in 6 s): use
   two page loads with different `seed`/time instead, or wait a minute of `pre`.
2. *The look-critique items on my own marks*: flakes are still ovals of one tilt (they are
   now drawn out to their travel, so a gale gives strokes; a calm gives near-round specks;
   what is missing is tumble: give each flake its own aspect and a slow turn from `_ph`);
   lone dust tufts against a clear sky read as leaves (a size distribution with a floor on
   the smallest puff, or thin them by `share` where `sky.dust` is low); sand flecks too dark
   and spray's material only says "liquid here" are colour: PAINTER's.
3. *Grass parting judged as a picture*: needs PAINTER's visible blades (its item 5 of this
   run), then `painted=1&biome=alpine_meadow&walk=1.5&circle=3&pre=14&freeze=1&kits=0
   &follow=1&dist=4` with and without `push=0`.
4. *Calm-air crawl of flakes* (sub-pixel motion of small opaque marks through PAINTER's post
   pass): not isolated. The pairs I measured were in 5.6 m/s of wind, where a flake's own
   travel (45 % of its width in 8 ms) is all of the change. Needs a place and time with snow
   and under 1 m/s of wind (`find=` cannot ask for that yet).
5. *Drifts and branches judged as a picture*: both are delivered as numbers and a chunk;
   nothing draws them until PAINTER takes "For PAINTER" A (last bullet) and F.
6. *When PAINTER's weather is in the picture*: re-shoot the storm, the blizzard, the dust
   storm and Neptune's sea in the game itself and tune `DRAW_PAINTED` against them.

## API (current, exact; kept up to date with every commit)

Everything is pure logic: no three, no DOM, plain `{x,y,z}` objects, **body-local** coordinates
(C1, C3), metres, seconds, kelvin, pascal. Wind, weather and every query are functions of
`(seed, body, place, time)`; the near-field simulations are deterministic for the same frames.

```js
import { createPhysics } from './src/physics/index.js';

const physics = createPhysics({ sampleSurface, seed? });  // sampleSurface(bodyId, unitDir): the contract's
                                                          // seed: leave it out (DEFAULT_SEED 18) unless you want other weather
physics.setQuality(0 | 1 | 2);
physics.warmUp({ bodyId, time, focus });   // once while loading: fills ground caches, compiles hot loops (about 20-60 ms)

// once per frame (PILOT in the game, PAINTER in the gallery), BEFORE world.update:
physics.update(dt, {
  bodyId,        // body the camera is on, or null in deep space (the near field then sleeps)
  time,          // seconds on the simulation clock (sim.t). Weather and wind are functions of it.
  focus,         // {x,y,z} body-local point the near field centres on (explorer feet, or the ship)
  sunDir,        // {x,y,z} body-local unit vector toward the sun (optional: day/night temperature, dawn mist)
  eye,           // {x,y,z} body-local position of the camera (optional, new in P6): snow is simulated in an
                 //   8 m box round it (the focus when absent, or when the eye is over 60 m from the focus)
  disturbers,    // [{ kind:'explorer'|'ship'|'jet'|'downwash', p, v, radius, strength, grounded?,
                 //    kick?, impact? (explorer: dust raised by the feet), q?, legContact? (ship: pad prints) }]
});              //   explorer/ship: strength 1; jet/downwash: strength = thrust in newtons
                 //   build them with physics.explorer.disturbers(st, out) / physics.ship.disturbers(st, out):
                 //   those fill every optional field from st.phys
```

### Environment queries (cheap; pass an `out` object to avoid allocation)

```js
// (P18) a fifth argument, recv = { size (m), vx, vy, vz }: what feels the air (sub-second eddies smaller than it average away)
physics.air(bodyId, p, out?, heightAboveGround?, recv?) ->
  { density (kg/m3), wind:{x,y,z} (m/s, body-local), speed, gust01 (0 lull .. 1 gust),
    turbulence (sigma of wind speed, m/s), temperature (K), pressure (Pa), soundSpeed (m/s),
    viscosity (Pa s), altitude (m above base radius), height (m above ground used), near (bool) }

physics.weather(bodyId, p, out?, { time?, surface? }) ->
  { kind: 'clear'|'breeze'|'windy'|'overcast'|'mist'|'fog'|'drizzle'|'rain'|'thunderstorm'|'snow'|
          'blizzard'|'dust haze'|'dust storm'|'haze'|'virga'|'acid drizzle'|'ice fall'|'frost fall'|'vacuum',
    intensity01 (how much weather there is; continuous), kindIntensity01 (strength within the kind; steps),
    precipitation: { type: 'none'|'drizzle'|'rain'|'snow'|'ice'|'acid'|'frost', species (key of data.SPECIES),
                     rate (mm/h water equivalent), intensity01, fallSpeed (m/s, this body's gravity and air),
                     dropSize (m), frozen01, hail01, reachesGround01 (Venus virga),
                     extinction (1/m: the share of a sight line that what is falling hides, per metre) },
    dustExtinction (1/m: the same for the dust in the air),
    wetness01, snowDepth (m),
    visibility (m, real scale), visibility01 (multiply your clear-day fog distance by this),
    cloud01 (0 once you are above the deck), cloudBelow01, storm01,
    fog01, dust01, haze01 (the share of the view each veil takes by itself: with only fog in the air
      visibility01 = 1 - fog01; 0.5 = 5 km of visual range, 0.78 = 1 km, 0.9 = 200 m), dustLoad01,
    front01 (gust front), windFactor, temperature (K),
    lightning: { rate (flashes/min), flash01 (brightness now, 3-4 strokes in 0.25 s), nextIn (s),
                 thunderIn (s; negative = already passed), thunder01,
                 last: { t, x, y, z (unit direction of the strike), distance (m) } } }

physics.ground(bodyId, unitDir, out?, surface?) ->        // pass `surface` if you already sampled it (no call is made)
  { material: 'grass'|'soil'|'litter'|'mud'|'sand'|'dust'|'gravel'|'rock'|'snow'|'ice'|'ash'|'glass'|'crystal'|'moss'|'bed',
    materialId (its place in physics.data.MATERIAL_IDS: the number particles and marks carry),
    friction (static), kinetic, foothold (extra holding traction on slopes), restitution,
    sink (m), drag (walking resistance as a fraction of normal force), repose (rad), dust (0..1),
    z0 (m), imprint (0..1), density, grain, liquidDepth (m), wetness01, snowDepth, temperature,
    canopy01, canopyHeight, moist, fog, dustSource }

// (P18) the sea AT p (the sea map, within 2 km of the focus): significant, whitecapCover, fetch, depth, dir are local; + waveHs, open, nodeDepth
physics.water(bodyId, p, out?) ->                         // the liquid surface and its wind waves
  { present, height (elevation at p now, m), significant (Hs, m), period (s), length (m), speed (m/s),
    steepness, whitecap01 (0..1 how steep the sea is), whitecapCover (share of the surface that is
    breaking, 0..0.15), dir:{x,y,z} (body-local, the way the waves run) }

physics.features.devils // dust devils near the focus: array with .count; each { p (body-local foot), x, z (grid),
                        //   radius (m), height (m), speed (swirl, m/s), up (m/s), spin (+1/-1), strength 0..1, age, life, id }
physics.here            // { bodyId, air, weather, cover, groundHeight, sky } at the focus, refreshed by update(): free to read
physics.here.sky        // the weather as a painter needs it: twelve numbers 0..1 (P7: `fresh` added), continuous (all but flash):
                        //   cloud (cover), overcast (dim and cool the light), haze (MULTIPLY the clear-day fog
                        //   distance by it), fog and dust (what the lost view is lost to: grey water, or dust to
                        //   tint), wet (ground darkening), snow (ALL snow lying: standing and fresh), fresh (cover of
                        //   FRESH snow alone: what recent snowfall laid; lay this over the painted ground), rain
                        //   (liquid falling), snowfall (frozen falling), storm (a storm core, or a hurricane-force gale),
                        //   flash (lightning now). Rain or snow falling means cloud over 0.85 and overcast over 0.5.
physics.sky(weather?, out?)   // the same numbers for any physics.weather() result (default: at the focus)
physics.focus           // {x,y,z} body-local: the focus of the last update (read-only)
physics.particles.system.dripping   // 0..1: how hard the soaked canopy over the focus is dripping (after rain)
physics.setWindScale(bodyId, scale)   // how far a body's real wind is scaled down (data.WINDS[body].scale)
physics.stats           // { ms, msAvg, msMax (worst frame after warm-up), msGround, msAir, msWeather, msFlora,
                        //   msParticles, samples (sampleSurface calls this frame), particles, pushCells, reanchors }
```

### Dynamics (pure step functions; PILOT keeps input mapping and assists on top)

```js
import { stepExplorerBody, EXPLORER_BODY, stepShipBody, stepShipGear, wakeShip, SHIP_BODY } from './src/physics/index.js';
const env = physics.bindEnv(bodyId, env);   // adds env.air, env.ground, env.liquid, env.liquidOf (the liquid at a place:
                                            // lava, cloud froth), env.gravity and env.radius if missing
// BOTH flight step functions and the explorer step move st.p (and st.v) IN PLACE. Do not integrate the
// position again afterwards; if you want to post-process, keep the old position by value first.

stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY)       // == physics.explorer.step
//  st:  { p, v, grounded }  (PILOT's explorer state; st.phys is added on first use)
//  cmd: { wish:{x,y,z} m/s horizontal, jump:bool, jet:0..1, jetMaxRise?: m/s, descentLimit?: m/s,
//         airControl?: 0..1, assistAccel?: m/s2 }
//  env: { sample(unitDir), gravity, air?(p,out,height), ground?(surface,out), liquid? }
//  st.phys: { slip01, scramble01, sink, submerged01, windAccel, lean, support, impact, puff, material, friction,
//             dust, jetThrottle, jetUse, speedGround }

stepShipBody(st, cmd, dt, env, T = SHIP_BODY)               // == physics.ship.step   (flight: translation only)
//  st:  { p, v, q }   cmd: { target:{x,y,z} m/s | null, tau: s, hover?: bool, boost?: bool, carve01?: 0..1,
//                             brake?: 0..1 (ASSIST: the drive field sheds what the retro thrusters cannot,
//                             up to SHIP_BODY.fieldBrake = 160 m/s2, only ever slowing, not felt by the crew) }
//  env: { up | null, gravity, radius, altGround?, air?, time? }
//  st.phys: { thrust, lift01, buffet, buffetAngle:{pitch,roll}, q, airspeed, gLoad, heat01,
//             downwash:{thrust,speed,q,radius}, groundEffect, brake01, fieldBrake (m/s2 being shed now) }

stepShipGear(st, { lift01, hold? }, dt, env, T = SHIP_BODY) // == physics.ship.gear   (rigid body on 3 legs; moves p, v AND q)
//  env: { sample(unitDir), gravity, ground?, air? (for the thruster wash) }
//  st.phys: { contacts, asleep, legLoad[3] (N), legCompress[3] (m), legContact[3], w (rad/s),
//             downwash (lit whenever lift01 > 0: dust and grass blow before the feet leave) }

physics.ship.planSpeedChange(v0, v1, aMax, jMax) -> plan;  sampleSpeedChange(plan, t) -> { a, v, s }
physics.ship.stepPulse(ps = { a, v }, vWant, dt);  pulseBrakeDistance(v)
```

### Fields and buffers (typed arrays; PAINTER wraps them in textures and attributes)

**Added in P17 (all additive; nothing was renamed or removed):**
```js
import { strideBob, bobAt } from './src/physics/explorer.js';
strideBob(v, g, stride, T = EXPLORER_BODY, o = null)  // m: the hips off their standing height at `stride` (0..1: left foot
                                                      //   down at 0, right at 0.5) of a steady stride at v m/s under g,
                                                      //   as stepGait lays it (no easing in or out); o: a gaitOf result to reuse
bobAt(ph, o, gE, T = EXPLORER_BODY)                   // the same at phase ph of a step (0 = a footfall) of stride o (gaitOf)
physics.explorer.bob                                  // = strideBob
// explorer.js EXPLORER_BODY: aheadProbe 0.2, aheadProbeBefore 0.6, aheadProbeAfter 2.6, aheadProbeMargin 0.92,
//   aheadProbeTries 6; st.phys.probe (the feature being tried), .seen, .noTry; st.phys.ahead.tried, .hold
// util.js: fsin(x), fcos(x) (within 6e-8 of Math.sin / Math.cos)
// near.js: TerrainGrid.groundQ(q): q[0] x, q[1] z in; q[2] heightAt(x, z, NaN), q[3] liquidAt(x, z) out
// loose.js: KICK.stepDust 0.05 (no puff at the boot below it)
```

**Added in P16 (all additive; nothing was renamed or removed):**
```js
physics.water(bodyId, p).fetch, .depth   // m: the fetch this sea was raised over (measured; FETCH_DEFAULT 800 away from the
                                         //   focus) and the mean depth along it (Infinity away from the focus)
physics.fields.water.gauge               // FetchGauge: fetch (m, the mean of its radials), depth (m), radial [5] (m), ready,
                                         //   final, samples (this frame), measured (count), kept (cache), update(), reset()
physics.fields.water.waterPoint          // { ok, x, y, z (unit, body-local), depth (m), cap (m: the point's biome fetch) }
physics.fields.water.field.fetch, .depth // what WaterField.update was given this frame
physics.stats.msFetch, .fetchSamples     // the gauge's cost this frame (ms) and its sampleSurface calls
// water.js: FetchGauge, FETCH_GAUGE { radials [-12,-6,0,6,12] deg, step0 16, stepGrow 0.1, sectors 16, cell 48, keep 24,
//   minDepth 1 }; whiteScale(c) (0..1 by phase speed); WATER.whiteSpeed [0.9, 1.5] m/s
// windSea(U, F, g, rhoAir, rhoLiq, depth): depth now limits growth as well (SPM 1984 shallow-water curves, as a ratio)
// wind.js: wakeAt(wk, wkH, z) and WAKE { full 0.5, top 1.5 } (moved from air.js; air.js re-exports wakeAt, AIR.wakeFull
//   and AIR.wakeTop carry the same numbers)
// testworld.mjs: timing(ok, msg): a wall-clock assert only under PC_TIMING=1 (printed otherwise)
// lab: info().seaState.fetch, .depth; SHORE_PROBE columns fetch, fdepth
```

**Added in P10 (all additive; nothing was renamed or removed):**
```js
physics.here.blown            // { sand, snow, spume, surf }, each 0..1, refreshed by update(): what the wind raises near the focus
physics.particles.<kind>.hag  // Float32Array: m above the ground (or the liquid, for spray) under each LOOSE particle; 0 for rain and snow
physics.particles.<kind>.turn // (P15) Float32Array: radians a leaf has turned about its long side (cos < 0: its other side shows); 0 for every other kind
physics.here.blown.leaves, .litter, .leafStock01   // (P15) leaves a second torn off the crowns (inflow included) and lifted off the floor in the box; the loose leaves left on the trees (0..1)
physics.fields.air.gustShift  // Float64Array(6): how far the wind has carried each copy of the gust pattern (m, body-local)
// wind.js
gustLevelAt(bodyId, px, py, pz, ax, ay, az, bx, by, bz, t, seed)   // the gust pattern with the displacement of each copy given
gustPhase(t, out4)                                                 // cycle numbers of the two copies, seconds since the middle of each
// air.js: AIR.shelterAdjust (48 m), AIR.shelterLearn (0.4 s).   near.js: TerrainGrid.known(x, z)
// loose.js
BLOWN                         // constants of the streamers, blowing snow, leaves, spume and surf
loose.streamAt(x, z, time, ue, un, u10) -> 0..1                    // how much a place is in a streamer now
loose.sea(dt, water, near, fx, fz, cwe, cwn, g, airGrid)           // the sea's own spray; update() calls it after water.update
// three/expand.js
expandVeils(buf, D, eye, out)   // 3 floats a vertex: opacity01, soft01, veil01 (kinds whose DRAW entry has `veil`: dust)
// DRAW options: flip, edge (leaves); veil, veilLow, veilHigh, veilTop, veilSoft (dust); bands, bandLong, bandWide (snow);
// level (sand); eye.bandE, bandN, bandWe, bandWn, band01 (the kit sets them).  kits: info.veil, attribute aPcVeil (vec3)
// PARTICLES.capacity: dust [300, 1000, 2400], sand [300, 1200, 2800], leaves [80, 260, 600], spray [200, 800, 1800]
```
Behaviour that changed with no call changing: see "For PILOT", P10 (wind), and the draw table `DRAW_PAINTED`
(dust walls 6 in 10 and 11:1, snow strokes up to 8 sizes and in bands, leaves thin, sand level, spray larger),
which the world passes to the kits as it is.

```js
physics.fields.frame            // LocalFrame: ox,oy,oz (anchor, body-local m); ex.. (east axis); nx.. (north); ax.. (up); version
physics.fields.flora
  .bend   Float32Array(32*32*4)   // RG soft-plant load (east, north), BA stiff-plant load; 8 m cells
  .wind   Float32Array(32*32*4)   // RG wind at 2 m (m/s), B gust01, A turbulence (m/s)
  .push   Float32Array(64*64*4)   // RG push load, B flatten01, A shake01; 0.5 m cells
  .size 32  .cell 8  .nearSize 64  .nearCell 0.5
  .uniforms   // { uPhysAnchor[3], uPhysEast[3], uPhysNorth[3], uPhysUp[3], uPhysWindMap[4], uPhysNearMap[4],
              //   uPhysWave[4], uPhysWavePhase[4], uPhysShape[4] }  plain arrays, refreshed every update
  .version / .pushVersion          // bump when the arrays changed (re-upload)
  .plantBend(p, stiff01, out) -> { e, n (radians), angle, flatten01, shake01, load }   // CPU twin of the shader
  .plantBendLite(p, stiff01, out)                                                       // twin of pcPhysBendLite
  .plantDisplace(h, H, be, bn, out) -> { e, n, up }
physics.glsl.flora              // GLSL (ES 3.00): pcPhysBend(root, stiff01) -> vec4 (3 lookups: wind, waves, push, flatten),
                                //   pcPhysBendLite(root, stiff01) -> vec2 (1 lookup: wind response only),
                                //   pcPhysDisplace(rel, up, H, bend) -> vec3, pcPhysWind(p) -> vec4, pcPhysGrid(p) -> vec2
                                //   `#define PC_PHYS_LINEAR` before it = hardware filtering, 1 fetch a lookup (see PAINTER wiring)

physics.fields.water
  .uniforms   // { uPhysWaterDir[2], uPhysWaterK[4], uPhysWaterAmp[4], uPhysWaterPhase[4], uPhysWaterGroup[4],
              //   uPhysWaterSea[4] (Hs m, the elevation above which the sea is breaking m (1e9: it is not),
              //   the width of that edge m, whitecap cover), uPhysWake Float32Array(64) (16 x: x, z, age s,
              //   amplitude m), uPhysWakeG }, refreshed every update
  .heightAt(p) -> m               // CPU twin of pcPhysWaterHeight (waves, sets and wakes): a floating thing rides the painted sea
  .sample(p, out) -> { height, de, dn (slope along the frame's east and north), ax, az (unit, frame axes: the way
              //   the crests lie there), crest01, foam01 }      the twin of pcPhysWaterD + pcPhysWaterCrest
  .surf01(depth) -> 0..1          // how far this sea's waves have broken where the liquid is `depth` m deep
  .field      // WaterField: height (Hs), period, length, speed, steepness, whitecap01, cover, foamAt, dir, level,
              //   present, addWake(x, z, amplitude), wakeAt(x, z), wakeInto(x, z, o3), surfaceAt(x, z, o)
physics.glsl.water              // pcPhysWater(p) -> vec3(height, dh/deast, dh/dnorth); pcPhysWaterD(p, out vec2 along);
                                //   pcPhysWaterCrest(w) -> vec2(crest01, foam01); pcPhysWaterSurf(depth) -> 0..1;
                                //   pcPhysWaterNormal(w, up) -> vec3 (body-local); pcPhysWaterDir(vec2) -> vec3;
                                //   pcPhysWaterHeight(p); pcPhysWake(grid). Works in a vertex or a fragment stage.
                                //   `#define PC_PHYS_NO_WAKE` leaves the wakes out (far water, or per fragment).
                                //   Shares the frame uniforms with the flora chunk (guarded: include both freely)

// draw kits (the only folder that imports three; optional; see "For PAINTER", C)
import { createPhysicsKits, createWeatherKit, createMarksKit, createWaterKit, DRAW, DRAW_PAINTED, cellFor, INKED, PARTICLE_GLSL, SHAPE_GLSL } from './src/physics/three/index.js';
const kits = createPhysicsKits(physics, { makeMaterial(kind, info), weather?: { draw?, expand?: 'cpu' | 'gpu', kinds?, rings? } | false, marks?, water?: {} (off by default) });
kits.update(bodyRoot, camera, internalHeightPx);   kits.objects;   kits.stats { ms, drawCalls, vertices, triangles };   kits.dispose()
kits.weather.stats.cover   // { rain?, snow?, dust? }: the share of what the physics says the kind hides that its marks paint
kits.weather.stats.size    // { snow, dust, ... }: the size (m) dabs are drawn at now
// DRAW[kind] options (override any through weather.draw): width, exposure, min, size, grow, spin, fadeIn, vary,
//   minPx (floor, thins the kind), maxPx (ceiling), share, exposure + smear (dabs drawn out along their motion),
//   varySize, cell (m: the kind is shown modulo a cell round the eye), sizeMax + fill (dabs sized by the physics),
//   new in P6: fadeOut (s: shrinks to nothing over its last moments, from buf.left), strobe (s, the frame time) +
//   streak (dab sizes): a dab is drawn out at least as far as it travels in a frame and is gone as a hairline,
//   near (m: nothing nearer the eye than 0.4 of it)
// DRAW_PAINTED (new export, was in painted-lab.js): the overrides for PAINTER's pipeline; pass as weather.draw
// cellFor(D, eye, buf): the cell in use (the nearest to D.cell that divides the kind's simulated box)

physics.fields.deform
  .depth  Float32Array(64*64)     // m pressed into the ground, 0.5 m cells (trail trough); .uniforms.uPhysDeformMap
  .marks  { data: Float32Array(256*14), capacity, head, total, origin, stride: 14 (MARK_STRIDE) }
          // per mark: x,y,z (rel. origin), dirx,diry,dirz, length, width, depth, kind, born, life, rim (m, raised edge),
          //   material (what it was pressed into: an index into physics.data.MATERIAL_IDS; 255 = unknown)
          // kind (MARK): 0 left foot, 1 right foot, 2 gear pad, 3 hull, 4 scour (the dish a jet or the thrusters blow)
  .depthAt(x, z)                  // m, at a grid position

physics.particles.rain / .snow / .hail / .dust / .sand / .ash / .spores / .leaves / .spray
  // { count, capacity, pos Float32Array(3n) (relative to .origin, body-local axes), vel (3n), size (n), age (n),
  //   mat Uint8Array(n) (the ground it was raised from: an index into physics.data.MATERIAL_IDS; 255 =
  //   MATERIAL_NONE: rain, falling snow, hail, leaves, spores, ash), origin, species,
  //   left Float32Array(n) (new in P6: seconds until it is gone, where the physics can tell: its life ending, or
  //   its landing foretold from the rate its height over the ground is closing; 1e9 otherwise),
  //   radius (new in P6: half-width in m of the box the kind is simulated in: 24, snow 8) }
  // Positions are on the curved ground (P6 fix): radius r0 + height on the line through the grid point; before,
  // they lay on the tangent plane at the frame's anchor and left the ground by d^2 / 2R (18 m at 380 m on Earth).
  // rain, snow: the weather. hail: storm cores (bounces). dust: kicked up, storms, devils, ambient haze. sand: saltation,
  // kicks, scour. leaves / spores / ash: the biome's own, on the wind. spray: wading, thruster wash over liquid.
  // In vacuum the same kinds fly as clean parabolas (no drag, no drift).
physics.particles.events        // ring: { data Float32Array(256*8), head, total, origin }: x,y,z, kind (0 splash, 1 ripple, 2 settle, 3 bounce), strength, time, size, 0
physics.particles.system.landed // (P21) drops and flakes that have reached the ground or a liquid so far (a splash event is made only where the ground shows one: Decision 55)
```

**Added in P7** (all additive; nothing renamed):
```js
physics.here.sky.fresh                    // 0..1: ground covered by FRESH snow (recent snowfall only); never more than .snow
physics.weather(...).freshSnow            // m of fresh snow (snowDepth = the biome's standing snow + this); .gale01 (0..1: the
                                          //   large-scale wind between 18 and 34 m/s: scud, spray over an open sea)
physics.water(...).swell, .swellLength    // m: the swell on an open sea (0 on lakes); .significant is wind sea and swell together
physics.fields.water.sample(p).line01     // the crest as a line (GLSL: pcPhysWaterCrestLine(w, along))
physics.fields.water.field.swellHeight, .swellLength, .open (0 lake .. 1 open sea), .significant, .slope (rms)
WATER.swellFetch, .swellDecay, .swellTime, .swellCalm, .swellOpen, .lineIn, .lineOut;  new WaterField({ swell: false })
PARTICLES.events 512 (was 256), .ringRate, .ringRadius, .ringFar      // rings laid near the focus in rain
FLORA.pushReach 0.7 (was 0.45), .wakeShare, .wakeSet, .wakeTime, .trampleTime   // the parted wake behind a walker
WEATHER.galeFrom, .galeFull, .galeCloud, .sprayExt;  SKY.overcastGale, .stormGale
// three/: DRAW fields parallel, maxLen, near (streaks); tumble, aspect, wall, wallFrom, wallFull, wallShare, wallHigh,
//   wallNear, wallFade (dabs); makeEye().wall01 (the kit sets it from weather.dustLoad01). CPU expanders only.
```
**Changed behaviour in P7** (same names): standing snow is the biome's own `snowBase` and nothing else (the climate
pack of up to 0.4 m wherever the daily mean is below freezing is gone: the alpine meadow is grass, not snow, to the
feet as well); `physics.sky(physics.weather(p, { time }))` and `physics.here.sky` use the same large-scale wind for
drying and agree within 1 % (they were up to 29 % apart in `wet`); the wetness of melting snow comes in over 1.5 K
(it was a step of 55 %); snow falls up to 2.5 K above melting (was 1.5).

**Added in P6** (all additive):
```js
physics.update(dt, { ..., eye })          // the camera, body-local (optional): snow is simulated in an 8 m box round it
physics.fields.drift                      // drifts of snow or sand: a 64 x 64 grid of 0.5 m cells round the focus (the marks' grid)
  .factor  Float32Array(64*64)            // loose material at the cell in units of what lies on level ground:
                                          //   0 level, +1 twice as deep, -1 blown bare (never over 2.5)
  .level                                  // m lying on level ground here now (the snow depth, or the loose layer of sand: up to 0.12)
  .snow                                   // true: what drifts is snow; false: sand or dust
  .depthAt(p)                             // m above (below) the level deposit at a body-local point
  .uniforms { uPhysDriftMap [cx, cz, 1/size, 64], uPhysDriftLevel [m] }    .version    .size 64    .cell 0.5
physics.ground(bodyId, unitDir).snowDepth // near the focus this is now the depth at that very spot (level + drift)
physics.fields.flora.plantBranch(re, rn, h, H, root, bend, out)   // -> { e, n, up } m: how far its branch moves a point of a crown
  // (re, rn): the point's offset from the trunk (m east, north); h: its height; H: the plant's; root: body-local;
  // bend: what plantBend(root, stiff01) returned. Add it to the point before plantDisplace. GLSL twin: pcPhysBranch.
physics.fields.flora.uniforms.uPhysBranchPhase [4], .uPhysBranch [gustiness 0..1, gain, shaken swing rad, branch length / height]
// the ship body (stepShipBody): cmd.carveAccel (m/s^2, optional): the most sideways acceleration the carve assist gives
//   (absent: unbounded, as before);  st.phys.fieldCarve: m/s^2 the field is pushing sideways now (a glow, a sound, a read-out)
// particle buffers: .left Float32Array(n) (s until the particle is gone, 1e9 when unknown), .radius (m: half-width of its box)
// three/: DRAW_PAINTED (the draw table for PAINTER's pipeline), cellFor(D, eye, buf); DRAW fields fadeOut, strobe, streak, near
```

Reference data and helpers: `physics.data.{ATMOSPHERES, LIQUIDS, WINDS, REGIMES, MATERIALS, MATERIAL_IDS (15 names: a
material's number is its place), MATERIAL_INDEX, MATERIAL_NONE (255), BIOMES, SPECIES}`,
`physics.util.{airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, cellsAt, saltationThreshold,
holdAngle, iceFriction, treeFrequency, stemFrequency, PlantSim, liquidOf, liquidAt(bodyId, surface), BIOME_LIQUID}`;
tuning tables exported from `index.js`: `WEATHER, WIND, AIR, GROUND, FLORA, PARTICLES, LOOSE, KICK, DEVILS, DEFORM,
MARK, MARK_STRIDE, EVENT, WATER, QUALITY, DEFAULT_SEED`, and `windSea(U, fetch, g, rhoAir, rhoLiquid, depth)`.

## Status

INTEGRATION: ready and wired (PILOT `a9c02bc`, PAINTER `1e1801e`). The API is stable; P2 and P3 only added to it,
with one change of type: the water uniforms are vec4 now (four trains; nobody had wired them).
The tree is committed green: `node --test src/physics/` **208 pass** at the commit that carries this note.

**Stage P6** (the third agent; commits `ded1435` (the coordinator's snapshot of my tree), `16d5305`, and the two after):

| P6 job | State | How it was verified |
|---|---|---|
| 1. Crawl of the kits | done: `buf.left` and `fadeOut`, snow in its own 8 m box round the eye and riding the air over slopes, the cell divides the box, dabs drawn out to their travel a frame, hairlines and marks at the lens gone, rain strokes taper | `p6/crawl.mjs` (table below): pops 11.7 to 0.0 a second, jumps 1.3 to 0, strobing 0.2 to 0; painted lab pairs 8 ms apart: 19 to 22 % less change than before, a camera orbiting at 6 deg/s adds no more than the scene's own; 6 new tests and one extended |
| found on the way: curved ground | fixed: particles and splash rings are published at radius r0 + height on the line through the grid point, velocities turned to the local vertical | before: rain 16.4 to 38.1 m over the true ground 380 m from the anchor and splashes at 15 to 20 m; after: 0.00 to 18.00 m and splashes at 0.00 m, at 80, 161, 300 and 380 m (`p6/curv.mjs`); test at 300 m |
| found on the way: rain over deep water | fixed: the weather enters over the surface it meets (ground or liquid), not 18 m over the bed | before: every flake of a blizzard over a 21 m deep sea was 3.6 to 15.6 m UNDER the surface; test over a 40 m sea: 0 drops under it, ripples on it |
| 2. The game played | done: six worlds at 60 Hz in Node and four in the browser with real keys | tables and findings in "The integrated game, played in P6" |
| 3a. Branch rate | done: `pcPhysBranch` in the flora chunk, `plantBranch` its twin, phases on the clock; no new texture, one line for PAINTER | 2 tests (nothing at the trunk, continuous all the way round, tips out of step, 1 to 2.5 Hz, bounded, scales with lean and gustiness); the chunk compiles inside PAINTER's plants (painted lab, no console errors). **Not seen as a picture: PAINTER has not called it.** |
| 3b. Drifts | done: `drift.js`, `physics.fields.drift`, the ground under the explorer and under every print | 8 tests (nothing on standing liquid, level ground none, lee of a bank +0.2 to +0.5 m in 0.2 m of snow, windward face scoured to bare, a kerb's drift under 0.8 of the kerb, a hollow fills from any wind, nothing moves in a calm, melts and deepens with the snow, fixed in the world as the walker moves, behind a landed hull, in the game loop behind a hill); cost under 0.25 ms a frame. **Not seen as a picture.** |
| carve assist bounded | done as an option: `cmd.carveAccel`, `st.phys.fieldCarve` | 1 test; PILOT's 102 tests pass unchanged (the default is as before) |
| 4. Silhouette test in `PROP_VERT` | not done | Hand-over, 1 |
| 5. Look-critique items | not done | Hand-over, 2 |

**Cost after P6** (`p5/cost.mjs`, worst reproducible frame of `physics.update` in Node, ms; before -> after):
running at the Earth spawn 0.33 -> 0.36; thunderstorm 0.45 -> 0.50; **blizzard 0.47 -> 0.75**
(every flake now looks its ground up every step, to ride the air over it and to foretell its
landing; plus the drift field); Mars dust storm 0.41 -> 0.44; Neptune storm with the ship low
over the sea 0.87 -> 1.01. Budget 2 ms. The dab expander: 0.217 -> 0.223 ms for 2800 flakes.

### Crawl, measured (P6)

Method: `p6/crawl.mjs` runs a scene at 60 Hz and expands the kit's quads with the painted
draw table for a camera 6 m behind and 2 m above the focus (50 degree lens, 432 internal
lines). Every mark is followed from frame to frame (a particle's size is its own for life)
and four things are counted, per second, among marks in the picture at least 3 px across:
**popOut** (there in one frame, gone or under half a pixel in the next), **popIn** (the
reverse, for marks old enough to be past their fade-in), **jump** (the centre moved by more
than its velocity relative to the eye explains, by over 4 px and over its own length),
**strobing** (the average number of marks in view that travel more than 1.5 times their
drawn length a frame). Camera: still, panning 3 deg/s, orbiting the focus at 12 deg/s, or
walking with it at 1.5 m/s.

| Scene (in view) | camera | popOut /s | jump /s | strobing | after: popOut | jump | strobing |
|---|---|---|---|---|---|---|---|
| Blizzard, 8 m/s wind, 1698 flakes, on a 49 degree alpine slope (56 -> 65 in view) | still | 11.7 | 1.3 | 0.2 | **0.0** | 0.0 | 0.0 |
| the same | pan | 15.3 | 0.9 | 0.1 | **0.0** | 0.0 | 0.0 |
| the same | orbit | 14.7 | 1.7 | 0.2 | **0.0** | 0.0 | 0.0 |
| the same, the walker kicking powder | walk | 9.3 | 2.5 | 0.1 | **0.5** | 0.0 | 0.0 |
| Mars dust storm, 366 puffs (94 in view) | still | 7.6 (marks 80 to 94 px across) | 0 | 0 | **0.0** | 0 | 0 |
| Thunderstorm 15 mm/h, 1516 drops (107 in view) | still | 85.8 (every stroke, whole, as its head lands) | 0 | 0 | **0.8** | 0 | 0 |

What each was, and what was done:
- *Jumps*: the simulation wraps a flake from one wall of its 48 m box to the other; the kit
  showed flakes modulo an 18 m cell; 48 is not a whole number of 18, so every wrap moved the
  shown flake 6 m in one frame. The cell now divides the box (`cellFor`), and snow has a box
  of its own the size of the cell.
- *Flakes vanishing in mid-air*: a flake was shown up to 24 m from where it was simulated,
  over other ground, and went out when ITS ground came up. Now the snow is simulated where it
  is shown (an 8 m box round the eye: `frame.eye`), each flake carries the time to its landing
  (`buf.left`, from the rate its height over the ground is closing, eased over 0.15 s) and
  shrinks to nothing over its last 0.3 s.
- *A finding inside that one*: carried straight and level by the wind, flakes struck every
  rise and left everything lower than the highest ground in the box bare (half the flakes in
  view gone on a slope; on the same slope, blown downhill, they hung at the height where the
  ground fell away as fast as they fell and never landed). The air over ground flows along
  it. Flakes now ride the air's own rise and fall over sloping ground (through their drag,
  a tenth of a second late): heights over the ground are evenly spread from 0 to 18 m on a
  49 degree slope (263, 342, 277, 310, 286, 216 flakes in six 3 m layers).
- *Dust puffs vanishing at full size* (a 2 m billow, 80 to 94 px, gone between two frames,
  7.6 times a second): `left` is what remains of the grain's life; the mark shrinks over 0.7 s.
- *Rain strokes going out whole*: a 0.9 m stroke vanished when its head reached the ground.
  It now thins to a point over its last 0.08 s (40 cm). Rain and hail also grow in over 0.1 s.
- *Strobing and hairlines*: a flake near the lens in a gale crossed more than its own
  length a frame (a flash somewhere new every frame). A dab is now drawn out at least as far
  as it travels in a frame (`strobe`: driving snow is slanted strokes that overlap from frame
  to frame); one that would be more than `streak` (3) sizes long shrinks away, and nothing
  is drawn nearer the eye than 0.4 of `near` (snow 3 m, dust 2.5 m).
- What is left: about 0.5 pops a second from clods of powder kicked up by the walker's own
  feet in snow (they live a third of a second and die against the slope they were kicked
  at); marks growing over 3 to 5 frames at the inner edge of the `near` band (2 to 6 px wide,
  about 5 a second in a gale: a fade, not a pop, but a quick one).

In PAINTER's real pipeline (painted lab, `stability(8, 6, hideKits, orbit)`: pairs of frames
8 ms apart; mean absolute difference of the picture and the share of pixels changing by more
than 8 %), blizzard 0.8 mm/h in 5.6 m/s of wind, about 1000 flakes:

| | before P6 | after | no kits |
|---|---|---|---|
| still camera, 8 ms | 0.00180, 0.683 % | 0.00148, 0.532 % | 0.00004, 0.003 % |
| still camera, 16.7 ms | 0.00412, 1.548 % | 0.00333, 1.256 % | 0.00004, 0.003 % |
| orbiting 6 deg/s, 8 ms (1700 flakes) | | 0.00371, 0.938 % | 0.00185, 0.205 % |
| still, the same 1700 flakes | | 0.00181, 0.638 % | 0.00003, 0.002 % |

Reading: the flakes cover about 1.6 % of the picture and move 45 % of their own width in
8 ms in that wind, so 0.5 to 0.7 % of the pixels changing IS their travel; a slow camera move
adds only the scene's own change (0.94 - 0.21 = 0.73 % against 0.64 % still). The Mars dust
storm (75 billows of 2.4 m, wind 10.7 m/s): 0.406 % still, 1.026 % orbiting against 0.428 %
for the scene alone. `expand: 'gpu'` renders the same blizzard within a frame pair's
difference of the cpu path (mean difference 0.0015) and compiles without errors.
**Not measured: flakes in still air** (Hand-over, 4).

**Stage P5** (two agents; the second from `95bc128`):

| P5 job | State | How it was verified |
|---|---|---|
| Weather for the sky | done (`sky.js`, `physics.here.sky`) | 3 tests; continuity under 0.1 a second but `flash` |
| Ink on unknown ground | done: `MATERIAL_IDS`, `buf.mat`, mark slot 13, `materialNow`, `vPcMat` in every kit chunk | 5 tests: the twin names the ground as `groundAt` does in 8100 states (over 500 of them not the dry material); kicked dust says sand, dust, gravel, litter on those grounds; a grain keeps its word while the buffer is reshuffled; powder and prints in snow say snow, storm dust says dust, spray says bed; the lab's factory picks its ink from a 16-colour palette by it (Mars dust in the dune's own ochre, `painted-mars-dust.jpg`) |
| The sea for PAINTER's liquid | done: slope, crest direction, crests, whitecaps, surf, normal in the chunk; twin `fields.water.sample(p)` | 5 tests (slope against finite differences 1e-5; the sea drops 2.5 times more across a crest than along it; the foam covers the share the law says within 25 % at 12, 16 and 22 m/s; cover within a factor 1.7 of Monahan and O'Muircheartaigh from 10 to 20 m/s). Chunk against twin in a real GL context, 120 points with two wakes live: height 0.06 mm (on 0.39 m), slope 4e-5, crest01 4e-4, foam01 1e-3, direction 2e-5 (`window.__lab.waterAgreement()`). Not drawn as a sea by anyone: that is PAINTER's material |
| Kits that survive the post pass | done: floor with thinning, ceiling, physical cover, smear, snow cell, dust from the dust in the air | 5 tests (one in f or f^2 drawn at the floor, cover within 20 %, a receding mark changes by under 0.25 px a step and never pops; cell: whole cells, own height, none under the hull). Frames `painted-snow.jpg` (about 75 flakes in view where there were a dozen) and `painted-mars-dust.jpg`, opened and judged below |
| Painted lab on PAINTER's public exports | done (`makePaintUniforms`, chunks from `src/render/index.js`, palette from `looks.js`) | runs with no console errors in cpu and instanced mode |
| Grass parting, judged | **not judged**: nothing to see part | A/B frames, `painted-meadow-wash-ab.jpg` |
| Silhouette test in `PROP_VERT`, branch rate, drifts | **not done** | Hand-over, items 1, 3, 4 |

Cost (`physics.update`, Node, PAINTER's real worlds, quality 1, worst reproducible frame of six
identical runs; before P5 in brackets, measured in the same minute under the same load): running
at the spawn 0.35 ms (0.37); Earth thunderstorm 0.54 (0.48); Earth blizzard, now 1784 flakes,
0.49 (0.46 with 1258); Mars dust storm 0.42 (0.38); ship low over Neptune's sea in a storm 0.95
(0.96). Means 0.24 to 0.78. Kit arithmetic in Node: 2000 flakes with cell, smear and floor 0.13
ms; 1600 rain streaks with floor 0.05 ms. In the painted lab's browser (software GL, loaded
machine): blizzard 0.68 ms cpu, 0.22 ms instanced, 4 draw calls, 3.6 k triangles; dust storm 3
calls, 0.8 to 1.8 k. The wave chunk costs the CPU one uniform update. **Real-GPU cost is
unmeasured**: 16 `sin`/`cos` a vertex or fragment for the four trains, a 16-step loop for the wakes.

Stage P1 to P3: done, accepted. **Stage P4**: the lab runs inside the real painted
pipeline (`?painted=1`), the reference material factory is proven with PAINTER's chunks and both
render targets, six painted frames are judged, rain is prototyped four ways and measured for
crawl; all under Answers, "The lab inside the painted pipeline". Not done in P4: shader
agreement inside `PROP_VERT`, the branch rate, drifts.

Stage P3 (this block; the tables below are still current):

| P3 job | State |
|---|---|
| 1. Draw kits under `src/physics/three/` | done: rain, hail, sand, spray (streaks); snow, dust, ash, spores, leaves (dabs); rings; marks; water patch. CPU quads for any material, or instanced straight from my buffers. They fit PAINTER's material contract (`pcKitPosition()`, two varyings, opaque with `discard`). Shown in the lab (`draw-kits.jpg`), cost measured. "For PAINTER", C. |
| 2. The integrated game in the browser | done on Earth, Mars and Neptune with real key events; findings with numbers under Answers, "The integrated game in the browser". |
| 3a. Rain shelter and drips | done: a closed canopy catches 25 % (soaked) to 75 % (dry) of the rain, the wood drips big slow drops after rain until it has drained, the hull keeps what is under it dry and takes the splashes. Tested. |
| 3b. The sea from the air | done: the spectral peak is two trains (short crests), every train comes in sets that travel at half the phase speed; correlation under 0.6 at each of six ranges from 9 to 83 wavelengths and under 0.35 on average (test). |
| 3c. A wake field on water | done: rings spread from swimmers, waders and thruster wash at the group speed of their own waves; 16 sources; GLSL and JS twins. Tested. |
| 3d. A third (branch) rate in trees | **not done.** It needs a third oscillator and so a fourth field texture; not worth asking a new PAINTER for before the three existing ones are on half-float. |
| 3e. Shader agreement inside `PROP_VERT` | **not done.** Still only measured in my lab's shader (2.5 mm). |

Verified in P3: 175 tests (17 new: kit arithmetic and budget, shelter, drips, hull, sets, wakes);
PILOT's `node --test tests/*.test.mjs` 93 pass on this code; worst reproducible frame of
`physics.update` on the real worlds 0.38 ms running at the spawn, 0.54 ms standing in the forest
through its storm (shelter active), 0.45 ms in an open thunderstorm, 0.92 ms flying low over
Neptune's sea in a storm (wash, spray, wakes); kit cost per frame in the lab's browser: weather
0.10 ms for 1100 drops with rings (0.05 instanced), marks 0.07 ms when one is added, water patch
0.05 ms; in Node 1600 streaks 0.07 ms, 1600 dabs 0.09 ms, 256 marks 0.07 ms, 41 x 41 water 0.04 ms.
Not verified in P3: the kits with PAINTER's real chunks and two render targets (only the same
shape with a flat colour); the new water chunk anywhere but my lab; anything as a picture.

What exists now:

| Part | State | File |
|---|---|---|
| Atmosphere per body, fall speeds, liquids (incl. lava, cloud froth) | real, tested | `atmosphere.js` |
| Wind: bands, eddies, gusts, height profile, terrain shelter, **canopy wakes** | real, tested | `wind.js`, `air.js` |
| Weather: cells, kinds, lightning, gust fronts, wetness, snow, visibility; **every world its own** | real, tested | `weather.js` |
| **Dust devils** (Mars, Earth deserts) | real, tested | `features.js` |
| Ground materials and contact; every biome id of `looks.js` mapped and checked by test | real, tested | `ground.js` |
| Explorer body (**viscous liquids**) | real, tested | `explorer.js` |
| Ship body: flight, gear, pulse profile, **field brake, lift-off on the gear** | real, tested | `ship.js` |
| Flora field + GLSL chunk + CPU twin; **crown coupling, lite lookup** | tested; shader agreement measured | `flora.js`, `flora.glsl.js` |
| Rain, snow, **hail, dust, sand, ash, spores, leaves, spray**; ballistic in vacuum | tested | `particles.js`, `loose.js` |
| Marks: footprints **with rims, snow and sand filling them, gear pads, scour dishes** | tested | `deform.js` |
| **Water: wind waves** (sea state, 3 trains, GLSL + twin), ripples and spray as events | tested | `water.js` |

### Each world's own weather (lab preset `?planet=<name>`, shots `planets-inner.jpg`, `planets-outer.jpg`, `globes.jpg`)

| World | What happens there | Preset |
|---|---|---|
| Mercury, Moon | no air: kicked dust and sand fly in clean parabolas and are down in 1-2 s; nothing drifts, nothing hangs | `mercury`, `moon` |
| Venus | dense slow air (62 kg/m3, under 1 m/s at the ground); sulphuric drizzle that evaporates on the way down (virga) below 160 m and reaches the high mesas; haze | `venus`, `venus-mesa` |
| Mars | dust devils (Rankine vortex, 11-44 m across, 80-570 m tall, drifting with the wind they were born in); dust storms in which sand keeps hopping far below the fluid threshold (impact threshold); CO2 frost only below 200 K | `mars`, `mars-storm` |
| Jupiter | storms born on 11 jets and carried along them, east on one, west on the next; water rain falling fast (2.5 g, thin H2 air), hail, lightning; the Great Red Spot, a permanent anticyclone with circling winds | `jupiter`, `jupiter-globe` |
| Saturn | mist and fine drizzle on 7 broad jets, calm between rare storms; gritty wind over the gravel | `saturn`, `saturn-globe` |
| Uranus | slow methane snow and ice crystals at 91 K, fog banks, ice that grips like rock | `uranus` |
| Neptune | the fastest winds; methane rain (falls at 5.6 m/s), a dark spot racing west, methane seas rougher than water (density ratio) | `neptune`, `neptune-globe` |
| Pluto | nitrogen frost falling at 0.2 m/s out of 84 mg/m3 of air | `pluto` |
| Earth | the full set: cloud, drizzle, rain, showers, thunderstorms with hail and gust fronts, fog banks, radiation mist after rain in still damp air, snow where it is cold | `scene=rain|snow|storm` |

Every fast system is a big one (never smaller than the distance it drifts in 40 s) and its edge
takes about 30 s to pass, so even Neptune's weather arrives rather than switches.

### Verified, and how
- `node --test src/physics/`: **158 tests, 0 failures** (also file by file). New in P2: loose
  particles per kind and per world, saltation thresholds, devils (determinism, drift, wind
  field), virga, jet tracks and spots, marks (rims, fill, pads, scour), canopy wake, crown
  coupling, gust travel lag, wind waves (growth curves, shallow limit, other worlds, continuity
  over a re-anchor against the analytic bound), weather edges (below), biome table against
  `looks.js`, lava and froth, field brake, lift-off hand-over.
- PILOT's suite on my P2 code: `node --test tests/*.test.mjs` **92 pass** (Earth-Mars-Saturn on
  the real worlds with physics on).
- **Cost** (Node 22, PAINTER's real worlds, quality 1; per-frame best of five identical runs,
  then the worst frame of the run): running at the spawn **0.35 ms**, Earth thunderstorm with
  1340 drops **0.48**, Jupiter thunderstorm with 1760 drops and hail **0.50**, Mars dust storm
  **0.29**, ship at 160 m/s **0.49**, standing through the spawn's first storm (200 s) **0.51**.
  Means 0.22-0.37 ms. By section (mean): ground cache 0.01 (0.06-0.13 flying), wind grid 0.11-
  0.19, weather 0.02-0.04, flora 0.10-0.16, particles + loose + marks + water 0.02-0.09 in fair
  weather and 0.19-0.28 in a downpour. What each new system adds: loose kinds 0.01-0.07
  (700 grains), devils under 0.01, marks under 0.01, water under 0.005, canopy wake and crown
  coupling about 0.02 inside the wind and flora numbers.
  Single frames of 5-25 ms do show up in one-off runs here (three busy processes on shared
  cores); they never recur at the same frame, which is how I know they are the machine.
- **Shader against JS, measured** (lab, float readback of 66 displaced tips in a gale, largest
  tip displacement 2.05 m): float32 textures with the chunk's own bilinear **max 2.47 mm, rms
  0.87 mm** (grass max 0.04 mm); half-float textures with the hardware's linear filter and
  `PC_PHYS_LINEAR` **max 2.48 mm, rms 0.87 mm** (grass max 0.10 mm). The 2.5 mm is on 13 m
  trees. Not yet repeated inside PAINTER's `PROP_VERT` (it compiles and moves there; PAINTER
  checked that much).
- **Weather continuity** (a watcher standing still while every live system on every world
  passes, 1 s steps): fog, dust and haze banks change `visibility01` by **at most 5.0 % a
  second** (was 6.2; test); with precipitation the steepest is a methane snow squall on Uranus,
  7.8 %/s, and an Earth snow squall 4.7 %/s; rain on the giants 5-6 %/s. `intensity01` and
  `precipitation.intensity01` at most 6.5 %/s. Found and fixed on the way: where an ice-crystal
  veil overlapped a shower the precipitation type flipped and visibility jumped 0.32 to 0.62 in
  one second; what falls is now three continuous shares (liquid, solid, frost).
- The integrated game, played through PILOT's `Sim` in Node with PAINTER's world and obstacles
  (scripted keys; numbers in "To PILOT: the game as it plays now" below), and looked at once
  in the browser (title sheet up, no console errors, `physics 0.7 ms`).
- Evidence, `docs/shots/physics/` (12 files): `planets-inner.jpg`, `planets-outer.jpg`,
  `globes.jpg`, `water-coast-gale.jpg` (Hs 0.60 m, 2.5 s, 9 m under a 25 m/s gale; the blue
  mesh is the GLSL surface, the red dots the JS twin), `draw-kits.jpg`,
  `painted-meadow-wash-ab.jpg` (P5), and the six `painted-*.jpg` (snow and Mars dust re-shot in P5) (the older debug shots of rain, snow, the jetpack, the
  terrain wind and the ship were retired to stay at twelve files).

### Not done or not verified (current)
- In the game nobody draws my particles, marks, waves or weather yet (PAINTER's M3): they are
  seen only in my two labs. In the painted lab rain, footprints, snowflakes and blowing dust
  read as marks; no storm, blizzard, dust storm or sea reads as a whole (veils, light, ground
  and liquid are PAINTER's: "For PAINTER", E).
- The flora chunk inside `PROP_VERT`: agreement not measured there (2.5 mm in my own shader);
  the push field is seen to move PAINTER's flowers under the ship's wash; grass parting
  round the explorer is seen by nobody (no blades to part).
- A tree has two response rates, not three (`R-WIND-4`: no separate branch rate). No drifts.
- The wave chunk is proven against its twin in GL but drawn as a sea by nobody.
- The snow cell and the thinning are not measured for crawl in the painted pipeline.
- Real-GPU cost of the textures, the wave chunk and the kits is unmeasured (software GL only).
- The integrated game was last played in the browser in P3; PILOT's later changes (pace per
  world, settling on C, gear touchdown) are checked from its code and my models, not flown.
- The cloud seas (a light froth, Decisions 16): nobody has walked into one in the game.

## For PILOT: wiring, in order

### P21, first (nineteenth PHYSICS agent)
- **Nothing to wire.** A run onto rising ground that the read-ahead missed now loses only its speed into it (a crater rim on
  the Moon: 6.95 -> 4.09 m/s, was 6.95 -> 1.95), and between close boulders the hips can be raised for the next one.
- **`tests/boulderrun.mjs`**: replayed in Node (`trace8`) on today's world, thrown up 0.024 m at most; two new times the feet
  leave the ground, each over a rim's crest the run now comes up at speed (heading 180: 0.31 m over ground that fell 0.98 m,
  a boulder 0.44 m tall 0.6 m off; heading 45: 0.15 m). Your rule from P20 lists both as "the ground fell away". The first is
  0.01 m over your limit with the ground falling 0.24 m more than the boulder rule's bound: if the browser run lands on the
  other side of either, that is why.
- **Rain makes no splash events on grass, moss, litter, sand, dust, ash, gravel or snow** (Decision 55): if any sound of yours
  counts splash events for rain on the ground, it will fall silent there (none of `src/` outside physics reads them today).
- **The ship afloat** (your `a0e3fb1`, Sim.stepAfloat on `env.waterLevel` over a 5 x 3 grid of the hull): read; it is what
  the ruling asked, on the drawn sea physics floats the explorer on. As you ask, the gear's floor stays where it is (the gear
  is not stepped afloat). If WATER_VERT's shoal mix changes (PAINTER), `env.waterLevel` follows it and so does your hull.

### P20, first (eighteenth PHYSICS agent)
- **`tests/boulderrun.mjs` counts a flight off a crater wall as a boulder's** (it failed today on three: headings 45, 135,
  180, feet 1.7 to 7.1 m up, each with the ground falling 2.7 to 10.4 m on 37 to 44 degrees and the body rising 0.009 to
  0.017 m; replayed without boulders the same three flights happen: hand-over P20, item 5). Exact change, in your file:
  `const byBoulder = all.filter((a) => a.feetUp > lim && a.boulder && a.boulder.gap < 1.5 && -a.groundLowest < a.boulder.height + lim);`
  and `const offEdge = all.filter((a) => a.feetUp > lim && a.rise <= lim && !byBoulder.includes(a));`. With it the run passes
  (thrown 0.172 m at most; no boulder lifts the feet over 0.1 m) and the rim flights are listed as "the ground fell away".
  Review 6 item 7 (should the rim be held?): my call is no, they are physics (Decision 50); an assist that holds a runner to a
  crater wall would be yours to add, by name, as a force.
- **The floating explorer now heaves with the drawn sea** (`env.waterLevel` from bindEnv, which your explorerEnv already
  calls: nothing to wire). In a gale on Earth its height moves with an sd of 0.29 m at the waves' 4 to 6 s; in Neptune's storm
  more. Your camera follows `ex.p`: if the heave reads as a lurch in first person, smooth the camera's vertical follow while
  `ex.swimming` (yours). `ex.liquidDepth` (yours) is still the depth under the STILL level.
- **The ship landed on water**: the gear (`ship.js` stepShipGear) stands on the liquid's still level while the drawn sea
  heaves past its feet. I can make its floor `env.waterLevel` (one line), but a ship on water would then never be still: does
  your LANDED state or the landing sequence need the gear asleep (`sh.phys.asleep`)? Say so in your notes and I will.
- **On the small worlds the near field re-anchors sooner** (the Moon every 125 m, Pluto 145, Mercury 205; `physics.stats.reanchors`
  counts more): nothing to change; a re-anchor costs what it did.
- `src/physics/three/gamefilm.mjs` films your game by `window.__pc` (hold, step, teleport, setClock): if those change, tell me.

### P19, first (seventeenth PHYSICS agent)
- **Nothing to wire.** Your review 7: finding 1 fixed in `976b954` (and a fourth fault it uncovered in `b5db96b`), findings 2 and
  3 in `40f8f7d`; your two scripts give, on the head after P19, 0 radial, 0 off the line, 0 wrong materials, and 0 steps over
  0.02 m or 2.9 degrees (numbers in the hand-over, P19, and "To the lead's review 7" below). What changes under the same calls:
  (1) `st.phys.material`, `.friction`, `.sink` and `.dust` are the ground where the explorer's step ENDS (a step earlier than
  before at every edge): footsteps, the boot's sink and its dust follow the ground under the feet; (2) a run through a boulder
  field keeps to the ground and to its line anywhere on a world, and no longer crawls at 0.5 m/s toward a boulder that stands
  just beyond another; (3) the explorer's step calls `env.ground` once a step as before, twice in a frame where your obstacle push
  moved the explorer between steps (the step starts on the ground where the last one ended while the body is still exactly there);
  the read-ahead's trials no longer call `env.ground` at all (once a feature).

### P18, first (sixteenth PHYSICS agent)
- **Nothing to wire.** What changes under the same calls: (1) `physics.water(bodyId, p)` reports the sea at p (the sea map):
  a sheltered bay is calmer than the open shore beside it, and `.fetch`, `.depth`, `.significant`, `.whitecapCover`, `.dir`
  are that place's; new `.waveHs`, `.open`, `.nodeDepth`. The floating explorer rides the local sea through bindEnv as before.
  (2) The point air has sub-second gusts (Kaimal at the point's height): `here.air.speed` and `.gust01` move under a second
  now, so wind noise in the audio can follow them; `here.air.turbulence` is a little higher near the ground (it includes them).
  (3) `physics.air(bodyId, p, out, height, recv?)` and `env.air(p, out, height, recv?)` take an optional receiver `{ size, vx,
  vy, vz }`: the explorer and the ship pass their own inside the step functions; if your code asks the air for a body (a
  camera shake, a flag), pass its size and velocity, or leave it out for a point at rest. (4) `physics.stats.fetchSamples` and
  `.msFetch` now count the sea map (its outer level and far rose, within the old gauge's ration).

### P17, first (fifteenth PHYSICS agent)
- **physics.setQuality may follow the render tier** (the hardening review's P13, `physics-quality-never-follows-tier`):
  confirmed. At quality 2 in the heaviest storm a player can stand in (a run into a tall wood at the storm: 5000 leaves)
  physics.update costs 1.9 ms and the weather kit 0.7 ms of main-thread CPU a frame on this 2.1 GHz server core; the other
  storms 0.8 to 1.5 ms and 0.1 to 0.7 ms (the hand-over, P17 item 1). The change is yours: `physics.setQuality(q)` next to each
  `painter.setQuality(q)` in `src/main.js` (main.js:131 and :189 in the review's tree), with the same 0 / 1 / 2.
- **The runner slows for boulders it would clip** (P17 item 2): running over 2.5 m/s, a hump with a top within reading
  (a boulder met square on or at its flank) is read once (20 more `env.sample` calls) and tried with the body itself over
  six body steps; the run then eases to the pace it crosses at with no brace (as P16 does for square faces). One body
  step in each of those six can take up to 0.9 ms (best of 7, the ghost runs of the trials): your sim step sees it once
  per boulder approached at a run. `aheadFrom` set very high in EXPLORER_BODY turns all reading ahead off, as before.
- **No puff at the boot on grass or bare rock** (KICK.stepDust): if any audio or HUD keyed on `here.blown` or the dust
  buffer for footsteps on meadows, it now hears nothing there (it never should have).

### P16, first (fourteenth PHYSICS agent)
- **Nothing to wire.** Three behaviours change under the same calls:
  1. *The explorer reads the way ahead* (`src/physics/explorer.js` `wayAhead`; the coordinator's ruling on the Moon run
     at the boulder): running over 2.5 m/s, two more `env.sample` calls a step (one point as far ahead as the soles need to
     slow, one 1.2 m short of it); a face it must clamber (a rise of more than the legs' 0.73 m stroke within 1.2 m, up to
     a clamber) is remembered (`st.phys.ahead`) and the pace is held (`st.phys.paceAhead`, used like `paceCap`) so that the
     walker arrives at the pace it can cross it at in contact (2.75 m/s for 1 m), braking with its soles and your
     `cmd.assistAccel` within the grip. The face no longer checks the run (Moon, 1 m boulder at 7.4 m/s: before, 5.4 ->
     2.1 m/s in 0.125 s at the face; after, about 1.8 m/s^2 over 2 s before it, nothing at the face, 2.8 m/s over it). The
     feet stay on the ground as before (0.000 m off in my runs). Hills under 60 % are never read as faces (tested). Your
     `tests/boulderrun.mjs` on the Moon should now show a lower pace just before the taller boulders and no check at
     them; the ruled measure (0.3 m) is unchanged. If you want the walker blind to faces (feel), `aheadFrom` in
     `EXPLORER_BODY` set very high turns it off (then the P13 face brace takes the speed, as before).
  2. *The sea near the focus* is raised over the fetch measured upwind and limited by the depth (`physics.water(...).fetch`,
     `.depth` say what it was raised over); lagoons and pools are calm or choppy, not the biome's sea. Audio: the surf and
     spume of `here.blown` follow (Neptune's storm beach: surf 1 -> 0, spume 1 -> 0, `p16` strips' numbers).
  3. `physics.stats.msFetch` and `.fetchSamples` count the gauge (also inside `stats.samples`).
- Your guard on stub fall-backs and my `src/physics/load.test.mjs` (every physics module loads as the entry of a fresh
  process, no import cycle) together cover the incident of 6d5c02a.

### P15, first (thirteenth PHYSICS agent)
- Nothing to wire for the leaves (the kits carry them; `here.blown.leaves`, `.litter`, `.leafStock01` are new numbers if
  audio wants the rustle of a flock).
- `clamber-run-moon`: a run into a 1 m boulder on the Moon still loses 3.3 m/s in 0.125 s at the face (see the P15
  hand-over, item 4). It is the explorer's body, which you are reviewing; I left it alone as told. If it should be taken
  up over a stride, the place is the clamber's face contact in `src/physics/explorer.js` (mine to change on your word).
- The walker's 2 m wind is unchanged by P15's wake change (2 m is under half the height of anything that casts a lee).


### P13, first (tenth PHYSICS agent): the gait, the jump, the hull, the descent

1. **Draw the stride** (one line in `src/core/game.js`, where you pass `hip:` to `explorerModel.animate`): pass
   `hip: sim.ex.phys.ride` in place of `.hip`. `ride` = `hip` + the stride's bob: everything the legs do to the
   hips, in metres off standing (a run rides 5 to 13 cm under standing and moves 6 to 7 cm with every step; a
   stroll 0 to 5.5 cm). Pass also, additively, for PAINTER's figure: `stride: phys.stride` (0 .. 1; LEFT foot down
   at 0, RIGHT at 0.5), `footDown: phys.footDown` (1 left, 2 right, 3 both, 0 neither: a flight of the run),
   `feet: phys.feet` ([left, right] `{ fwd, up, side, down }` in metres: ahead of `st.p` along `phys.heading`, off
   the ground, to the right), `surge: phys.surge` (m the body is ahead of `st.p` within the stride, and over its
   planted feet at a face), `crouch01: phys.crouch01`, `gait: phys.gait` (0 standing, 1 walk, 2 run).
   **The camera should NOT ride `ride`**: keep it on `st.p` (the stride's mean), or take a tenth of the bob if you
   want the view to breathe. `st.grounded` stays true through the flights of a run (they are the gait's own).
2. **Footsteps**: `phys.steps` counts footfalls; when it changes, `phys.footfall` is `{ n, foot (0 left, 1 right,
   2 both: a landing), p (body-local place on the ground), force (N: the stance's peak; 2.5 kN at your walk, 3.3 kN
   at a run on Earth, 1.3 kN on the Moon), speed (m/s the foot meets the ground at) }`. Loudness with force over
   weight (`force / (100 x gravity)`: 1.3 strolling, 2.5 to 3.6 running), the material from `phys.material`. At
   most one footfall in a step at any frame rate down to 20 Hz; `phys.footfalls[n & 3]` keeps the last four.
   Cadence at your paces: 3.0 a second at 4.2 m/s and 3.6 at 7.4 on Earth, 1.85 and 2.2 on the Moon.
3. **The jump is 0.12 s later** (the legs fold first). Your suite passes with it. It is your lever:
   `cmd.jumpCrouch` (s; 0 = at once, as before; unset = `EXPLORER_BODY.jumpCrouch`). For the figure: `crouch01`
   runs 0 to 1 through the fold (arms back, a lean), and `hip` (so `ride`) drops 4.5 cm on Earth, 1.1 cm on the
   Moon in that time (free fall: nothing can pull the hips down faster). Feel is yours: 0.2 s gives 16 cm on Earth.
4. **Your "walk" is a run** by its gait (4.2 m/s, Froude 2.2: three steps a second, a third of the time in the
   air). A walking gait exists only under 2.0 m/s on Earth (1.0 on the Moon). If the relaxed pace should LOOK like
   a walk it must be about 1.6 to 1.9 m/s; that is feel and yours. Nothing to wire.
5. **The hull in a wind**: `buffetAngle` now has `yaw`: add `shObj.rotateY(clamp(buf.yaw, -0.12, 0.12))` beside
   your `rotateX(pitch)` and `rotateZ(roll)` (same convention: the nose is -z). By the hull's mass and areas the
   angles are half a degree in a 6.5 to 10 m/s breeze and 1 to 5 degrees in a storm: real, and in a breeze still
   close to level. If the hull should be seen to breathe in a breeze, that is a gain on the DRAWN attitude and
   yours to name (say `hullSway`, 3 to 4, on all three angles before your clamp); the flight is not touched.
6. **The descent**: the limit is yours (`terminalFall`, `softFallSpeed`, 0.45 per metre) and it is not one speed:
   a 49 m fall is gathered in from 17 m/s at 33 m to 4 m/s over 3.4 s. The 9 m/s the strip showed was my lab's.
   Mine now: the brake eases in from three quarters of your limit (`EXPLORER_BODY.retroBand`). Nothing to wire.
7. **A face**: `st.v` now falls over about 0.1 s at a boulder's face (30 m/s^2) instead of in one step; `st.p` is
   as before; `phys.surge` holds how far the body is over its feet. Nothing to wire; your suite passes.

### P12, first (ninth PHYSICS agent)

1. **The ship's last metre** (`stepShipBody`): a sink near the ground now follows its velocity target (it hung at
   0.05 m/s at 1.1 m with tau 0.5). Your LANDING sequence is unchanged (your `motion.mjs --only landing`: the same
   heights with the old and the new `ship.js`, within 8 mm); the "stalled" clause in `sim.js` (a sink that has not
   come down 0.3 m in 1.5 s lands) should fire less often now. `st.phys.groundEffect` is 1 in a vacuum;
   `downwash.thrust` on the gear is a quarter less. Lever: `SHIP_BODY.groundComp` (0 = the old hang).
2. **The kick off a boulder** is gone: +0.2 to +0.35 m/s and 0.02 m of rise where your trace had +1.06 m/s and
   0.29 m (`explorer.test.mjs`, "P12 legs"). The feet can still be 0.1 to 0.4 s in the air after a step the legs
   cannot reach (hips higher than 0.28 m over the far ground): a fall, as ruled.
3. **`physics.air().veer`** (and `here.air.veer`): the lateral speed over the mean wind, for a vane, a flag or
   the sound's panning. The wind's direction now wobbles 8 degrees rms at 10 m.
4. **Seen in the strips, yours to judge**: the run has no bob (hip +-0.01 m; the figure glides: I owe a gait in
   `st.phys`, not done); the hull in a storm hover is dead level (apply `st.phys.buffetAngle` to the model if you do
   not); the lab's lift-off cuts the wash to zero for 0.75 s at the top of the climb (my lab script's height hold,
   not your sequence); the jetpack descent is 5 s at one speed.
5. A clamber over a 1 m boulder at a run on the Moon is checked from 5.3 to 2.0 m/s within one frame at the face
   (`clamber-run-moon`). In the game you measured 5.7 to 6.6 m/s over low boulders; over one a metre high this is
   what the legs do.


**P11, at the top (behaviour that changed without a call changing, and what the strips showed).**
1. *A landing no longer brakes the walker.* The feet stop, the hips go on down and the legs fold (up to
   5.2 m/s over 0.45 m); `st.phys.hip` runs negative for half a second after a landing; the forward speed
   is kept (it was halved). `st.phys.impact` is still the full normal speed. Draw the crouch from `hip`.
2. *`physics.air()` now carries eddies of 10 to 30 m* (a mast's spectrum): at a point the wind changes up to
   three times as fast as before (p99 of the 1 s rate 3 m/s2 in an 11 m/s wind; single 60 Hz frames up to
   46 m/s2 at 2 m at the spawn in the storm). `gust01` follows it. If wind audio reads `here.air.speed`
   raw, ease it over 0.2 s or it will flutter at 2 to 9 Hz.
3. *Seen, yours to judge:* the walk is 4.2 m/s and the run asks 7.4 m/s (a person walks at 1.4 and jogs at
   3; the body reaches 6.1 m/s 1.2 s into a run); a jump has no crouch before it; the jetpack's descent
   assist lands at 9 m/s (a 4 m fall); in my lab the ship's descent stalls for a second between 1.3 and
   1.0 m before the gear takes it (ground effect; check `tests/motion.mjs` for the same); the hover holds
   within 5 cm in a 9 to 14 m/s gusting wind.
4. *The filmstrip tool is yours to use too:* `node src/physics/three/film.mjs list`.


**P10, for PILOT (read first). Nothing to wire; four things to know.**
- *The wind near the player no longer steps.* Shelter behind trees, the storm's outflow and the per-node fields
  used to jump when the wind veered or the wind grid hopped a cell (every 16 m of travel): up to 450 m/s2 in one
  frame at the player. Now 13 m/s2 for a walker in the forest in the first storm. Behaviour that changes without
  a call changing: the lee of a wood takes 1 to 6 s to follow a veering wind; gusts ride at the wind's own
  speed (they slid through the air at up to 30 m/s more when the storm's wind was changing).
- *The body step costs* 0.02 to 0.04 ms (median), 0.10 to 0.15 ms (p99) in your `Sim` on the Moon and Mars on
  this loaded machine; 2.4 to 2.6 ground samples a step against 2.0 before the legs. Your `Sim` steps it at a
  fixed 1/60 s, so a 20 Hz frame is three steps.
- *`physics.update` costs more in three weathers* (medians on this machine, before -> after): blizzard 1.04 ->
  1.30 ms, storm in a forest 0.53 -> 0.91, Neptune's sea 0.50 -> 0.67; a Mars dust storm 0.81 -> 0.68. The 2 ms
  aim holds at quality 1 here; at quality 2 the loose kinds hold 2.3 times as many particles and I have not
  measured a blizzard there.
- *For sound*: `physics.here.blown = { sand, snow, spume, surf }`, each 0..1: sand hissing in streamers, a ground
  blizzard, spume off the sea, surf on a shore within 24 m.

**P9, for PILOT (read first): the explorer has legs.**
- *Nothing to wire.* `physics.explorer.step` is the same call. Keep "low boulders are ground" exactly as
  `scrambleSample` has it: **the radius raised, the normal left that of the ground underneath**. That is the
  profile the legs are tested on; a vertical face is climbed too (up to 1.35 m), but a smooth dome is what keeps
  the feet down. You do not need a clamber speed limit of your own any more: the body holds its own pace over a
  feature (`phys.paceCap`), lower in low gravity. If you keep one, it only needs to be the walking pace.
- *New in `st.phys`* (additive): `hip` (m, -0.45 folded .. +0.28 reaching), `hipV` (m/s), `clamber01` (0 striding
  .. 1 legs at the end of their stroke), `grip` (1 while the limbs hold a feature), `paceCap` (m/s, 1e9 when
  free), `brace` (m/s of forward speed lost this frame against a face or to a hold: a thump for sound or camera).
  For the figure: draw the feet at `st.p` and the hips at standing height + `hip`.
- *Behaviour that changed without a call changing*: a run across boulders is slower (the old body went up and
  down them at full speed in one frame each way); a step down of up to 0.73 m is taken in contact; a wall higher
  than 1.35 m met in a single step stops the body where the old one was lifted onto it.
- *Tables.* The pure body over P8's bump (1.3 m high, 2.6 m across, flanks to 57 degrees, its own normals),
  highest the feet come off the ground / time off the ground / slowest pace:

  | | before (P8) | P9 |
  | --- | --- | --- |
  | Earth walk 4.2 | stalls on it | 0.00 m, 0 s, 1.7 m/s |
  | Earth run 7.4 | 1.4 m, 0.7 s | 0.00 m, 0 s, 1.7 m/s |
  | Mars walk | 1.6 m | 0.00 m, 0 s, 1.4 m/s |
  | Mars run | 2.3 m | 0.00 m, 0 s, 1.4 m/s |
  | Moon walk | 3.2 m, 3.6 s | 0.00 m, 0 s, 1.3 m/s |
  | Moon run | 5.9 m, 5.1 s | 0.00 m, 0 s, 1.35 m/s |

  Through your `stepExplorer` + `scrambleSample` + `collideObstacles` over 62 boulders in 165 m (radius 0.3 to
  1.3 m, height 0.3 to 1.3 m; `p9/field.mjs`), feet highest / time off the ground / mean speed:

  | | before, 60 Hz | before, 30 Hz | P9, 60 Hz | P9, 30 Hz | P9, 20 Hz |
  | --- | --- | --- | --- | --- | --- |
  | Earth walk | 0 m, 4.18 m/s | 0 m | 0 m, 4.00 m/s | 0 m | 0 m |
  | Earth run | 0 m, 7.28 m/s | 1.14 m, 2.0 s | 0 m, 4.09 m/s | 0 m | 0 m |
  | Mars walk | 0 m, 4.16 m/s | 0 m | 0 m, 2.71 m/s | 0 m | 0 m |
  | Mars run | 0 m, 7.16 m/s | 1.13 m, 3.7 s | 0 m, 2.75 m/s | 0 m | 0 m |
  | Moon walk | 0 m, 4.13 m/s | 0 m | 0.21 m, 0.4 s, 1.90 m/s | 0.20 m | 0.26 m |
  | Moon run | 0 m, 7.04 m/s | 1.08 m, 4.3 s | 0.21 m, 0.4 s, 1.90 m/s | 0.20 m | 0.24 m |

  (Before, at 60 Hz, the body never left the ground on your profile only because one frame's drop stayed under
  its 0.28 m reach: it was lifted and dropped 1.3 m in a sixth of a second at full speed, and flew at 30 Hz.)
  In your `Sim` on the real ground, 8 headings of 25 s from each spawn (`p9/simrun.mjs`), feet highest / time
  off the ground of 200 s / made good: Moon walk 0.92 m, 2.6 s, 3.14 m/s before; 0.26 m, 0.6 s, 3.11 m/s now.
  Moon run 0.92 m, 2.6 s, 4.57 before; 0.26 m, 1.1 s, 4.42 now. Mars run 0.11 m, 3.8 s, 5.39 before; 0.03 m,
  0.2 s, 5.29 now. Mars walk and Earth: 0 before and now, same speed made good.

**P8, for PILOT (read first).**
- *New storm times (Earth only; every Earth weather time of before is 480 s earlier; no other body moved).* At
  the spawn: fair 0 to 120 s, first drops 140 s, thunderstorm 160 to 320 s (12:04 to 14:37 of the first day;
  20 mm/h and more from 200 to 260 s; gust front about 176 to 195 s), clear from 340 s. For `tests/weather.mjs`:
  before 60, storm 240, flash 244, after 390. Blizzards on land: lat 62.20 lon 20.58 from 10 to 110 s; lat
  62.41 lon 49.46 from 120 to 220 s (5.2 mm/h at 170 s). The alpine meadow stand has one only from 0 to 30 s.
  Mars' dust at 840 s and Neptune's coast are where they were; Neptune's coast is now in a thunderstorm at 0 to
  90, 780 to 2010, 2820 to 4590 and from 4980 s (a storm sky about 70 % of two hours).
- *`cmd.shelter01`* (0..1, default 0, additive): the share of the wind's force on the explorer the suit
  cancels (the body is given wind x sqrt(1 - shelter01); its drag in still air is untouched). Tested.
- *The wind on Neptune's coast* (`p8/stormwalk.mjs`, your Sim, level ground at lat -4.277 lon -159.326, t 60):

  | | wind at the walker | walk made good, 8 headings | lean | 2.5 s hop carried | ship: hover drift 10 s, landing |
  | --- | --- | --- | --- | --- | --- |
  | before P8 | 24 to 26 m/s (max 29) | 4.19 to 4.20 m/s | 9 to 19 deg | 37.9 m | 1.9 m; down at 0.97 m/s |
  | P8 | 13 to 15 m/s (max 19) | 4.19 to 4.20 m/s | 1 to 6 deg | 25.1 m | 3.8 m; down at 0.99 m/s, 0.7 m off |

  At the biome's stand itself the downwind heading still makes 1.1 m/s, with or without wind: a 4.5 m cliff
  14 m away (`p8/profile.mjs`). Wind at 2 / 10 / 30 m there: 21.8 / 39.8 / 51.5 m/s (was 36.2 / 42.5 / 46.6):
  the rough shore is gustier aloft, and the ship's hover sees up to 57 m/s (drift 5.9 m in 10 s, lands).
- *The storm at the Earth spawn* (t 240, in the wood): wind at the walker 1 to 6 m/s; walk made good 1.8 to
  4.1 m/s by heading (the low ones are trunks); stand 15 s: 0 m; hop carried 6.1 m; ship hover drift 0.7 m,
  lands in 6 s at 1.08 m/s. Blizzard (old clock 414 s, alpine meadow, 19 m/s at 2 m): 4.20 m/s in every
  heading, lean to 11 deg, hop carried 27.9 m, ship lands at 0.98 m/s.
- *Boulders as ground*: the body minds. See the hand-over, "Not done" 2, for the numbers.

**P7, for PILOT and the lead (read this block first; nothing below it changed).**

*Nothing to wire.* Everything of P7 arrives through what you already call. What you will
notice: `physics.here.sky` has a twelfth number `fresh`; the read-out's sky line and
`__pc.info().weather` can show it. `physics.here.weather` has `freshSnow` and `gale01`.

*Answers to review 5.*
- **P1 (MUST FIX, storms bring no wind): done.** Each system adds a wind of its own under its
  cloud shield (so it rises before the rain), along what is blowing: storm 16 m/s at 10 m,
  dust storm 20, shower 6, rain 3, ice fall 4 (`KINDS[...].blow` in `weather.js`). Measured at
  the game's own places with `physics.air` (`p7/stormwind.mjs`), wind at 2 / 10 / 30 m:
  the thunderstorm at the Earth spawn, 600 to 780 s every 20 s: 4.3/6.2/12.1 (mist), 3.6/5.1/
  10.0 (drizzle), **7.5/10.7/20.9** (first rain), 3.0/4.3/8.4, 6.2/9.0/21.4, 4.4/6.2/14.9,
  7.2/10.4/24.5, 6.2/9.0/21.1, 1.5/2.2/5.2, 4.1/5.8/14.0 (it was 1.6 to 3.7 at 10 m: gusts and
  lulls now, the wood shelters the two-metre level); a snow storm over the coast: 5.7 at 10 m
  before it, 10.3 to 14.3 in it; Mars' dust storm: 7.5 to 14.2 at 10 m (it was 2.8 to 4.2).
  Still under your `R-STORM-5` (15 to 30 m/s) at 10 m in a wood: see the hand-over, item 2.
  **Not verified: the explorer and the ship in these winds in the game** (your unit tests pass
  on an export with it; nobody has walked through the storm at the spawn since).
- **P2** (the first storm falls in the dark): not done. **P3** (Neptune's `storm_seas`):
  half: where the large-scale wind is 18 to 34 m/s the sky closes (cloud to 0.9, overcast
  +0.25, `storm` to 0.8) and over the open sea spray takes the view (haze to 0.28); the sea
  has a swell (0.8 m and 30 m long in its ordinary wind, 1.7 m and 59 m in 34 m/s). It still
  never storms by its regime. **P4** (dust in the forest's air): not done. **P5** (the two
  paths): `physics.sky(physics.weather(p, { time }))` and `physics.here.sky` now agree within
  1 % in every number but `snow` and `fresh` (they were 29 % apart in `wet`, 38 % in `fog`,
  because the stateful weather answered the gusty wind at the focus and the stateless one the
  prevailing wind: both answer the large-scale wind now, and fog no longer comes and goes
  with a gust); the 55 % step in `wet` (melt water switching on) is a ramp. Fresh snow at the
  focus is integrated as it falls, so there `physics.here` is the authority and says so in the
  API; a clock jump of over 5 s re-reads the quadrature. **P6** (downwind slower than upwind in
  33 m/s): not done; it is the first thing I would do next.
- `R-WX-1`: measured through the stateless path, 150 places and 12 moments a biome, 11 s each,
  at ground level (`p7/rates.mjs`): the fastest any number but `flash` moves in a second is
  8.5 % on Earth (`haze`, a snow front arriving), 8.5 % on Jupiter (`rain`), 6.2 % Uranus,
  7.3 % Neptune, 4.1 % Saturn, 2.0 % Mars and Venus. Half a point over your 8 % on Earth and
  Jupiter at the worst moment; not fixed.

*The game re-flown with your five levers in* (`p7/nodeplay.mjs`: your `Sim`, PAINTER's ground
and obstacles, my physics, scripted keys at 60 Hz, on a clean export of `6b047dc`):

| World | walk: to 90 %, stop | run: to 90 %, stop | jump: apex, aloft | jetpack fall ends at | cruise, 90 % after | turn at cruise | brake (X) | C to the ground |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Earth | 0.40 s; 0.53 s, 0.82 m | 0.82 s; 0.83 s, 2.6 m | 1.23 m, 1.05 s | 4.0 m/s | 46.7 m/s, 3.0 s | 42.0 deg/s, 69 m (37 m/s2, field 21) | from 47: 3.8 s, 97 m | lands at 1.09 m/s |
| Mars | 0.75 s; 0.82 s, 1.58 m | 1.35 s; 1.55 s, 5.7 m | 2.84 m, 2.25 s | 4.0 | 143.1, 6.3 s | 28.9 deg/s, 260 m (66, field 40) | from 110: 4.2 s, 248 m (field 24) | lands at 0.98 (sink up to 64 m/s) |
| Moon | 1.25 s; 1.18 s, 2.41 m | 2.30 s; 2.07 s, 7.5 m | 6.43 m, 4.90 s | 4.0 | 143.5, 6.3 s | 25.6 deg/s, 208 m (42, field 40) | from 74: 3.2 s, 131 m (field 24) | **hovers at 4.1 m, never lands** |
| Venus | 0.42 s; 0.47 s, 0.63 m | pace 5.3 m/s; 0.52 s, 0.92 m | 1.08 m, 1.00 s | 4.0 | 34.9, 3.2 s | 39.6 deg/s, 30 m (14, field 3) | from 34: 2.4 s, 43 m | lands at 0.99 |
| Jupiter | (walk 1.4 m/s here, see below) | 0.85 s; 0.87 s, 2.8 m | 0.88 m, 0.77 s | 4.0 | 69.3, 4.9 s | 42.6 deg/s, 103 m (57, field 40) | from 70: 5.4 s, 201 m | lands at 1.16 |
| Neptune | 0.42 s; 0.53 s, 0.82 m | 0.90 s; 0.82 s, 2.5 m | 1.04 m, 0.90 s | 4.1 | 50.3, 3.0 s | 42.8 deg/s, 70 m (39, field 23) | from 51: 4.1 s, 112 m | lands at 1.06 |

What the numbers say:
- **The worlds now differ, on foot and in flight, as intended.** Getting up to a walk takes
  0.4 s on Earth, 0.75 s on Mars, 1.25 s on the Moon, and stopping from a run 2.6, 5.7 and
  7.5 m: low gravity is felt in the feet. Cruise is 35 (Venus), 47, 50, 69 (Jupiter) and 143
  m/s (Mars, the Moon); in P6 it was 34 to 84. Thin-air worlds turn wide (26 to 29 deg/s),
  thick-air worlds at 40 to 43. Every jetpack fall ends at 4 m/s.
- **Forgiving? Three things to look at.** (1) *Mars and the Moon at cruise*: 143 m/s with a
  turn radius of 208 to 260 m and 131 to 248 m to stop, with the field brake already giving
  24 m/s2. In a Martian canyon that is a wall met before the nose comes round. The physics is
  right for thin air; the forgiveness would be a slower pace near the ground (a cap on
  `speedScale` below some height, or the density power 0.4 made 0.3: 100 m/s, radius 130 m).
  Your call. (2) *Jupiter's brake*: 201 m from cruise, no field share (the air is thick enough
  for the rule that gives none), 25 % longer than in P6 because the pace is up. (3) *Sideways
  load*: Mars 66 m/s2 in a held turn (6.7 g), Jupiter 57: the field's 40 is bounded as you
  set it, the thrusters and the air add the rest. Nothing says so to the player.
- **On the Moon the ship did not land**: after the cruise, the turn and the brake of this
  script it came down over `crater_fields` (slope 0.21, one obstacle within 12 m), sank at up
  to 35 m/s, and then hovered at 4.1 m with C held for 90 s, state `ATMOSPHERE`, lift 1, no
  contacts. The same with the physics of P6 (`b146000`) under your levers, so it is not this
  stage's doing; with the tree before the levers it landed (elsewhere: the flight was
  different). It looks like the landing logic holding off over a boulder. The player is not
  trapped (they can move aside), but nothing tells them why.
- *Jupiter's walk at 1.4 m/s* in this run is the spot (it was odd in P6's table too: a slope
  or a plant in the way of the scripted walk); the run reaches 7.4 m/s. Not looked into.
- *Feet*: on every world the feet are down 100 % of the time, at a run on the Moon too. Still
  open from P6 (the body model has no flight phase in a stride).

1. **Create and update.** In `Sim` (pure, so tests keep working):
   ```js
   this.physics = createPhysics({ sampleSurface });          // same sampleSurface the Sim already has
   // while loading, once the world can be sampled:
   this.physics.warmUp({ bodyId: this.bodyId, time: this.t, focus: this.ex.p });
   // every frame, before world.update (once per frame, not per sim step):
   const d = this._dist; d.length = 0;
   if (onFoot) this.physics.explorer.disturbers(this.ex, d); else this.physics.ship.disturbers(this.sh, d);
   this.physics.update(simDt, { bodyId, time: this.t, focus: onFoot ? this.ex.p : this.sh.p, sunDir, disturbers: d });
   world.setPhysics(this.physics);                           // once
   ```
   `bodyId` is the body whose ground frame the focus is in, else `null`. `sunDir` is the unit
   vector from the body toward the sun in that body's local (rotating) frame.
   **New in P6, one field, optional: `eye`**, the camera's position in the same body-local
   frame (`{ x, y, z }`): `this.physics.update(simDt, { ..., eye })`. Snow is simulated in a box
   16 m across round it, so the flakes are where the lens is and each lands on the ground it
   is over. Without it the box is round the focus and the kit wraps it round the camera (it
   works, but a flake shown a box away from where it is melts over the wrong ground). An eye
   over 60 m from the focus (the map, a free camera) is ignored.
2. **env.** `physics.bindEnv(bodyId, env)` adds `air`, `ground`, `liquid`, and `gravity` /
   `radius` when missing. Your explorer env (`sample`, `gravity`) needs nothing more. Your ship
   env (`up`, `altitude`, `spaceAlt`, `hasBody`, `sample`) needs one more field for ground effect
   and downwash: `env.altGround = st.altGround`. In deep space pass `bindEnv(null, env)` (or
   skip it): `up: null` means no gravity and no air.
3. **Explorer.** Inside `stepExplorer` keep everything up to the wish direction and `maxSpeed`
   (walk, run, swim speed are commands), the look-ahead wall check if you like it, fuel rules,
   facing and the animation mode. Replace the block from "horizontal velocity" to "integrate
   and collide" with:
   ```js
   const alt = r - Math.max(groundR, liquidR);
   stepExplorerBody(st, {
     wish: scale(wish, maxSpeed),
     jump: input.jump,
     jet: input.jet && jetArmed && st.fuel > 0 ? 1 : 0,
     jetMaxRise: T.jetMaxRise,
     descentLimit: alt < T.softFallHeight ? T.softFallSpeed : T.terminalFall,
   }, dt, env);
   st.fuel -= dt * st.phys.jetUse / T.jetFuelSeconds;        // or by time, your call
   st.jetting = st.phys.jetThrottle > 0.05; st.landedHard = st.phys.impact || st.landedHard;
   st.swimming = !st.grounded && st.phys.submerged01 > 0.3;
   ```
4. **Ship in flight.** Keep all of `stepFlight`'s steering and the target velocity; replace
   `v = add(st.v, scale(sub(target, st.v), damp(1 / tau, dt)))` and the integration with
   `stepShipBody(st, { target, tau, carve01: 1, boost: !env.hasBody || env.altitude > env.spaceAlt }, dt, env)`.
   Apply your cushion, pull-up and flare to `target` (raise its vertical part) instead of
   clamping `v`: a clamp on velocity is an infinite force, and it shows as a kink. Add
   `st.phys.buffetAngle.pitch / roll` to the drawn attitude and to the chase camera.
5. **Lift-off and landing.** Lift-off, exactly (tested in `ship.test.mjs`, "lift-off on the
   gear", on Earth, the Moon and Jupiter):
   ```js
   wakeShip(st); let lift01 = 0;
   // every frame while st.phys.contacts > 0 (or until the first frame it reads 0):
   lift01 = Math.min(1, lift01 + dt / 1.2);
   stepShipGear(st, { lift01, hold: scale(up, climb * lift01) }, dt, env);   // climb: your rise speed, e.g. 2.5-4.8 m/s
   // the first frame st.phys.contacts === 0: hand over, same target, nothing else to do
   stepShipBody(st, { target: scale(up, climb), tau, hover: true }, dt, env);
   ```
   The legs stretch as the weight comes off (the hull rises 2 cm on the Moon, 10 on Earth, 26
   on Jupiter before anything leaves the ground), the thruster wash is lit from the first frame
   (`st.phys.downwash`: 10.6 kN and 27 m/s on Earth, so `physics.ship.disturbers` blows dust and
   grass before the feet leave), the feet leave after 0.7 s (Moon) to 1.2 s (Jupiter), and
   `st.phys.lift01` carries over to the hand-over so nothing sags (worst drop in any frame
   under 4 mm). Landing: your assist flies `target` down to about 1 m at 1-1.5 m/s,
   then `stepShipGear(st, { lift01: 1, hold: up * -0.6 }, ...)` until `st.phys.contacts > 0`,
   then fade `lift01` to 0 over 1.5 s; touchdown is `contacts === 3 && lift01 === 0`; in LANDED
   keep calling `stepShipGear` (it returns at once when `st.phys.asleep`). The lab's ship scene
   does exactly this (`driveShip` in `physics-lab.html`).
6. **Landing sites.** Replace `landMaxSlope` with friction: a site holds the ship when
   `Math.tan(slope) < 0.8 * physics.ground(bodyId, dir, out, surface).friction`. On warm ice
   that is 3 degrees; on rock 34.
7. **Braking in vacuum**: pass `brake: 1` (X, or throttling far down) and drop your special
   case. From 750 m/s: 6.3 s and 1.9 km instead of 53.7 s and 20.4 km (test "field brake"). It never speeds the ship up
   and adds nothing to `gLoad`. `st.phys.fieldBrake` (m/s2) is there for a glow or a sound.
8. **Seed** (done in your `af6ea97`: `main.js` passes none now). The default (18) is chosen
   for the real spawn; seed 1 gave an empty sky there for forty minutes. With it: fair for
   two minutes, cloud building to overcast by four, a thunderstorm from 10:40 to 13:20 (22 mm/h,
   hail, lightning 4 a minute), clear by 14:00, mist in the still wet wood after (pinned by a test).
9. Add `node --test src/physics/` to "every check". `src/physics/package.json` is a dev-only
   file that makes that exact command run every test file (Node 22 runs a directory argument as
   one module); the game never loads it.

### Open on your side, as the coordinator relays it (each recipe is complete here)
- **New in P6 (flown this time; numbers and reasons in "The integrated game, played in
  P6"). Five levers, each one line, each yours to take or leave:**
  1. `eye` in `physics.update` (step 1 above): the camera's body-local position, so that the
     snow is where the lens is.
  2. `carveAccel: 30` in the command to `stepShipBody` (next to `carve01`): Earth, Venus and
     Neptune fly as today; Mars and the airless worlds run wide of the nose (29 deg/s, 150 m
     at cruise instead of 42 deg/s). `st.phys.fieldCarve` (m/s2) is there for a glow or a hum.
  3. `speedScale = clamp((1.225 / rho0)^0.4, 0.75, 3)`: the giants spread over 16 m/s (Neptune
     50, Saturn 52, Uranus 58, Jupiter 62), Mars and the airless worlds at 138 m/s; with it
     `brake: 0.15` in thin air (X stops from 138 m/s in 4 s) and `carveAccel: 40`.
  4. `assistAccel = 4 * clamp(g / 9, 0.45, 1)`: the Moon and Mars let you slide a little.
  5. `softFallSpeed` 4 m/s instead of 7: a hop ends on bent knees, not on a 2.7 m drop.
- **Touchdown on the legs.** Step 5 above is the whole recipe: your assist flies `target`
  down to about 1 m at 1 to 1.5 m/s, then `stepShipGear(st, { lift01: 1, hold: up * -0.6 },
  dt, env)` every frame until `st.phys.contacts > 0`, then fade `lift01` to 0 over 1.5 s;
  landed is `contacts === 3 && lift01 === 0`; keep calling `stepShipGear` while parked (it
  returns at once when `st.phys.asleep`). The legs take the last metre: 9 cm of sag on Earth,
  asleep 0.6 s after settling; `st.phys.legCompress[3]` and `legLoad[3]` are there to draw
  and to sound. Tested in `ship.test.mjs` on Earth, the Moon and Jupiter.
- **Rain audio.** How hard it rains: `physics.here.sky.rain` (0..1, continuous; `snowfall`
  for snow, silent). What it falls on: `physics.here.cover.canopy01` (leaves overhead: the
  hiss of rain on a wood) and `physics.water(bodyId, p).present`; under the hull nothing
  lands (the hull takes the splashes: `physics.particles.events` kind 0 at the hull's
  height); after the rain `physics.particles.system.dripping` (0..1) is the wood dripping.
  Thunder: `physics.here.weather.lightning.thunderIn` (s, negative at the bang) and `thunder01`.
- **The pulse drive on my planner.** `const plan = physics.ship.planSpeedChange(v0, v1,
  aMax, jMax)` then each frame `physics.ship.sampleSpeedChange(plan, t)` -> `{ a, v, s }`
  (jerk-limited: the acceleration ramps, so the start and the stop have no kink);
  `physics.ship.pulseBrakeDistance(v)` is how far out to begin braking;
  `physics.ship.stepPulse(ps = { a, v }, vWant, dt)` is the same as a step function.
- **Your flight pace per world** (`env.speedScale = clamp((1.225 / rho0)^0.25, 0.75, 1.6)`;
  computed against my models, not flown this run): cruise near the ground comes out 74 m/s
  on Mars and the airless bodies, 56 Jupiter, 53 Uranus, 50 Saturn, 49 Neptune, 46 Earth, 35
  Venus. The order is the physics' (drag goes with density) and every value is under what the
  engines and the air allow (thrust meets drag at 251 m/s on Earth, 367 Jupiter, 332 Uranus,
  291 Saturn, 279 Neptune, 1960 Mars) except Venus, where the air stops the ship at 34 m/s
  whatever is commanded: there the model decides, as it should. Physically sensible, and
  cautious: the real ceiling goes as density to the power -1/2, yours as -1/4 and clamped, so
  the four giants and Earth all cruise within 10 m/s of each other and only Venus (slow and
  heavy) and Mars and the airless bodies (1.6 times faster) will be felt as different. If the
  giants should differ too, the honest lever is their wind, which is already there (a hover
  on Neptune is pushed 1.8 m in 4 s), not the envelope.

### Which of your numbers each of mine replaces

Explorer (`src/player/explorer.js` EXPLORER -> `EXPLORER_BODY`, override any field by passing your own `T`):

| Yours | Fate | Mine | Assist you keep on top |
|---|---|---|---|
| `walkSpeed` 4.2, `runSpeed` 7.4, `swimSpeed` 2.6 | keep: they are commands | `cmd.wish` | none; the body may deliver less (see table below) |
| `groundAccel` 26 | replaced | `legAccel` 9 m/s2, `legPower` 1600 W, `response` 0.11 s, friction from `ground()` | `cmd.assistAccel` (suit thrusters, not traction-limited): 4 gives 0.38 s to 90 % of walking speed and a 0.8 m stop |
| `airAccel` 6 | replaced | `rcsAccel` 4, `rcsTime` 0.5 (small thrusters) | `cmd.airControl` 0..1 |
| `jetAirAccel` 11 | replaced | `jetVector` 0.6 x thrust = 10.2 m/s2, `jetSteerTime` 0.35 | |
| `jumpSpeed` 4.8 | kept as the Earth value | `jumpSpeed` 4.8 at `jumpG0` 9.0, `jumpPush` 0.4: 1.28 m on Earth, 6.5 m on the Moon, 0.91 m on Jupiter | |
| `jetThrust` 17 | same force | `jetThrust` 1700 N on `mass` 100 kg, `jetSpool` 0.08 s | |
| `jetMaxRise` 8.5 | keep as assist | governor inside the step | `cmd.jetMaxRise` |
| `jetFuelSeconds`, recharge numbers, `jetStartDelay` | keep, yours | `st.phys.jetUse` tells you the thrust actually used | |
| `terminalFall` 24 | replaced by drag | `cdaFall` 0.6 m2: 49 m/s on Earth, 6.6 on Venus, none in vacuum | `cmd.descentLimit = 24` (retro thrust up to `retroAccel` 45) |
| `softFallHeight` 3, `softFallSpeed` 7 | keep as assist | same retro thrust | `cmd.descentLimit = 7` below 3 m |
| `maxSlope` 0.80, `slideSlope` 0.96, `slideSpeed` 5 | replaced | hold while tan(slope) <= friction + foothold (grass 43 deg, rock 51, sand 33, warm ice 5); beyond it a slide on `max(kinetic, arrest x hold)` | none needed |
| `stepDown` 0.5 | replaced | `stickGap` 0.28, `crestLaunch`, `crestFilter` 0.15 s | set `crestLaunch: false` to stay planted in low gravity |
| `wadeSlowDepth`, `wadeSlowFactor` | replaced | liquid drag on `wadeWidth` 0.32 m x depth, buoyancy | |
| `swimDepth` 1.25 | same | `floatDepth` 1.25, `floatAssist`, `swimForce` 400 N | |
| `turnRate` 11, `height`, `eyeHeight` | keep, yours | | |

What the body then does with a 4.2 m/s walk and a 7.4 m/s run (Earth, measured by the tests' model):

| Ground | to 90 % of walk | stop from walk | run top speed | stop from run |
|---|---|---|---|---|
| grass | 0.58 s | 0.8 s, 1.2 m | 7.4 | 1.3 s, 4.1 m |
| dry rock | 0.55 s | 0.7 s, 0.9 m | 7.4 | 1.1 s, 3.3 m |
| wet rock | 0.70 s | 1.0 s, 1.7 m | 7.4 | 1.7 s, 5.8 m |
| sand | 1.2 s | 0.8 s, 1.1 m | 5.5 | 1.0 s, 1.9 m |
| deep snow (40 cm) | 3.2 s | 0.7 s, 0.9 m | 3.9 | 0.7 s, 0.9 m |
| ice at 271 K | never (tops at 3.3 after 4 s) | 3.6 s, 5.7 m | 3.3 | 3.6 s, 5.7 m |

Uphill run: 3 % slower at 10 degrees, 37 % at 20, 55 % at 30. Wading at walk command: 0.75 x
at 0.3 m, 0.62 x at 0.5 m, 0.36 x at 1 m; floating from 1.25 m. Venus air: 3.8 m/s run.

Ship (`src/ship/flight.js` SHIP -> `SHIP_BODY`):

| Yours | Fate | Mine | Assist you keep on top |
|---|---|---|---|
| `speedGround` 46, `speedAtmoTop` 160, `speedSpace` 750, `liftSpeed`, `liftSpeedSpace`, `throttleRate`, `reverseMax` | keep: the flight computer's commanded velocity | `cmd.target` | your speed governor. Physics adds a true ceiling where thrust meets drag: 250 m/s at Earth's ground, **34 m/s at Venus' ground** |
| `tauAtmo` 1.0, `tauSpace` 1.7, `brakeFactor` | keep as the computer's gain | `cmd.tau`; the achieved acceleration is limited to `accelMain` 22, `accelReverse` 14, `accelSide` 18, `accelLift` 14 m/s2 (`accelSpace` 60 with `boost`) through `spoolUp` 0.45 / `spoolDown` 0.30 s | `cmd.carve01` (the field turns the velocity toward the nose without changing speed): 1 = today's steering feel |
| steering, banking, pitch limit, levelling (10 numbers) | keep, yours | attitude is not touched in flight | add `st.phys.buffetAngle` to the drawn attitude |
| `cushionHeight`, `minClearance`, `lookAhead`, `flare*` | keep as assists | physics adds ground effect (up to +33 % thruster lift under 1 m) | apply them to `target`, not to `v` |
| `bounceRestitution` 0.35 | keep (hull bounce assist) | `ground().restitution` if you want it per material | |
| `hoverHeight` 9, `liftoffSeconds` 2.8 | keep as the sequence | drive it through `stepShipGear` then `stepShipBody` (step 5) | |
| `landGlideSpeed`, `landMaxDescent`, `landMinDescent` 1.1 | keep as the assist | the last metre is `stepShipGear`: 1.6 Hz legs at 0.65 damping, 9 cm of sag on Earth, asleep 0.6 s after settling | |
| `landMaxSlope` 0.62 | replaced | friction of the ground (step 6) | |
| no gravity, no drag, no wind | new | weight carried by `lift01` (0.35 s spool); drag areas 2.4 / 14 / 30 m2 nose / side / belly; wind drift; turbulence | hover is `cmd.hover` (default true) |

Measured through the body with your target law and `carve01: 1`: ground to space in 12.9 s on
Earth at 55 degrees (peak 3.2 g felt), 21.7 s on Venus (drag-limited to 78 m/s), 11.0 s on Mars.

## The integrated game, played in P6 (for PILOT; numbers from `p6/nodeplay.mjs` unless said)

Played two ways: PILOT's pure `Sim` with PAINTER's real ground and obstacles and my physics,
scripted keys, exactly 60 Hz, in Node (every number below); and the game itself in headless
Chromium with real key events on Earth, Mars, the Moon, Venus, Jupiter and Neptune
(`p6/play.mjs`, `p6/fly2.mjs`; software GL at 1 to 4 frames a second: it confirms that keys
reach the bodies and that nothing errors, and its numbers agree with Node's to within what
half-second frames allow: cruise 46 / 77 / 84 / 34 / 56 / 49 m/s, a 360 degree turn in 8.2 s
on every world). The bodies do what the models say everywhere: jumps are ballistic to the
centimetre, the jetpack's first push is 17 m/s2 less gravity, thrust is 22 m/s2.
What follows is what a physicist would object to, and it is all in the assists.

**On foot** (walk 4.2, run 7.4 m/s on every world; `assistAccel` 4 m/s2; g in m/s2):

| World | g | walk: to 90 % | stop from a walk | friction alone would take | jump: take-off, apex, aloft | jetpack 3 s: climb, top, down at |
|---|---|---|---|---|---|---|
| Earth | 9.0 | 0.40 s | 0.53 s, 0.82 m | 0.52 s | 4.65 m/s, 1.23 m, 1.03 s | 8.4 m/s, 27 m, 7.0 m/s |
| Mars | 4.6 | 0.55 s | 0.67 s, 1.18 m | 1.01 s | 5.08 m/s, 2.84 m, 2.22 s | 11.9 m/s, 49 m, 7.1 m/s |
| Moon | 2.2 | 0.73 s | 0.80 s, 1.49 m | 2.07 s | 5.30 m/s, 6.43 m, 4.83 s | 17.0 m/s, 113 m, 7.1 m/s |
| Venus | 8.6 | (run tops out at 5.4 m/s: the air) | 0.53 s | 0.54 s | 4.63 m/s, 1.08 m (drag), 1.00 s | 6.7 m/s, 20 m, 6.9 m/s (its terminal fall is 7) |
| Jupiter | 11.5 | 0.4 s | 0.85 s from a run | 0.80 s | 4.39 m/s, 0.88 m, 0.77 s | 8.5 m/s, 24 m, 7.1 m/s |

1. **The feet never leave the ground while running, on any world** ("feet down 100 % of the
   time" at 7.4 m/s on the Moon). At 2.2 m/s2 a runner is in the air most of each stride; the
   body is a capsule that only goes ballistic over a crest. What sells low gravity today is
   the jump (6.4 m, 4.8 s) and nothing else. The honest gait is PAINTER's animation and a
   bounce in the camera, not a force: the stride is already longer (`(g0 / g)^0.25`, in the
   prints). Offer: `st.phys.stride01` (the phase of the stride, with a flight share that grows
   as g falls) if PILOT or PAINTER want to bob the body by it.
2. **On the Moon 70 % of the grip is the suit's thrusters.** Friction and footholds give 2.0
   m/s2 there; `assistAccel` adds 4 on every world. So the Moon stops you from a walk in
   0.80 s where the ground alone would take 2.07 s, and nobody ever slides. The model is
   right; the assist is the same size on every world. Honest and still forgiving: scale it
   with gravity, `assistAccel = 4 * clamp(g / 9, 0.45, 1)` (Moon 1.8: stop from a walk in
   1.1 s over 2.3 m, from a run in 1.9 s; Mars 2.0; Earth unchanged).
3. **Every fall ends at 7 m/s.** The descent brake (`descentLimit`, `softFallSpeed`) lets the
   explorer hit the ground at 7.0 m/s after any jetpack hop on any world. That is a 2.7 m
   drop on Earth onto straight legs: a parachutist lands at 4 to 5. With 45 m/s2 of retro
   authority the brake can afford 4 m/s; it costs 15 cm more braking height.
4. **The Moon hop is a rocket flight**: 3 s of jetpack reach 17 m/s and 113 m, and coming
   down takes 19 s. (The first agent said this of Mars at 50 m.) The rise limiter
   (`jetMaxRise`) is scaled up as gravity falls; held constant at 8.4 m/s the Moon hop would
   top out near 45 m and the world would still feel light.
5. Mars: the spawn stands in a boulder field; a run of 4 s stalls at 1.3 to 1.9 m/s against
   the stones in two runs out of two (obstacle collision, not traction: `slip01` stays 0).

**The ship** (4200 kg, 22 m/s2 of main thrust, 14 retro, 18 sideways from thrusters and lift;
`speedScale = clamp((1.225 / rho0)^0.25, 0.75, 1.6)`):

| World | air kg/m3 | cruise | 90 % after | q at cruise | turn at cruise | sideways, of which the field | thrusters and lift alone | brake (X) |
|---|---|---|---|---|---|---|---|---|
| Earth | 1.14 | 46.7 m/s | 3.0 s | 1083 Pa | 42.0 deg/s, 69 m | 37, 21 m/s2 | 20.4 deg/s, 141 m | 3.78 s, 97 m |
| Mars | 0.0154 | 77.6 | 3.9 s | 43 Pa | 42.5 deg/s, 120 m | 66, 53 m/s2 | 11.6 deg/s, 441 m (thrusters only: no air to bank on) | 6.07 s, 253 m |
| Moon | 0 | 78 to 84 | 3.8 s | 0 | 42.6 deg/s, 128 m | 71, 57 m/s2 | 10.8 deg/s, 505 m | 6.45 s, 287 m |
| Venus | 59 | 34.9 | 3.2 s | 30 800 Pa | 39.6 deg/s, 30 m, and it slows to 21 m/s | 14, 3 m/s2 | 49 deg/s, 24 m | 2.43 s, 43 m |
| Jupiter | 0.443 | 61.7 (at 60 m) | 4.6 s | 957 Pa | 43.2 deg/s, 90 m | 51, 36 m/s2 | 15.2 deg/s, 255 m | 4.87 s, 162 m |
| Neptune | 0.963 | 48.6 | 3.0 s | 607 Pa | 42.5 deg/s, 68 m | 38, 21 m/s2 | 20.3 deg/s, 144 m | 3.98 s, 106 m |

6. **Every world turns at 42 degrees a second, whatever the speed and whatever the air.**
   That is the carve assist (`carve01`, mine), and it was unbounded: on the Moon the drive
   field pushes the ship sideways at 57 m/s2, 5.8 g, with nothing said, and a 360 degree turn
   costs no speed. Thrusters and lift alone would give 11 deg/s and a 500 m radius there. So
   the worlds that fly "fast and loose" (flight.js's own words) are fast and not loose. New
   in P6: **`cmd.carveAccel`** (m/s2: the most the field gives; absent = as today) and
   `st.phys.fieldCarve` (what it gives now). With `carveAccel: 30` Earth and Neptune are
   unchanged (they ask for 21), Jupiter runs a little wide (asks 36), and Mars and the Moon
   turn at 29 deg/s with a 150 m radius at cruise: the nose comes round at once and the path
   follows, which is what thin air is. Venus is already itself (the air does the turning and
   takes 40 % of the speed for it).
7. **The pace.** The coordinator's question: Earth 46, Neptune 49, Saturn 50, Uranus 53,
   Jupiter 56 m/s near the ground; what would be honest? An airframe is limited by dynamic
   pressure, not speed, so the honest governor holds q (speed as `rho^-0.5`):

   | World | deck air kg/m3 | now | same q as Earth's cruise | full thrust against drag | proposal |
   |---|---|---|---|---|---|
   | Venus | 65 | 35 | 6 | 34 | 34 (the air sets it) |
   | Earth | 1.23 | 46 | 46 | 251 | 46 |
   | Neptune | 0.99 | 49 | 51 | 279 | 50 |
   | Saturn | 0.91 | 50 | 53 | 291 | 52 |
   | Uranus | 0.70 | 53 | 61 | 332 | 58 |
   | Jupiter | 0.57 | 56 | 67 | 368 | 62 |
   | Mars | 0.020 | 74 | 360 | 1962 | 138 |
   | Moon, Mercury, Pluto | none | 74 | any | any | 138 |

   So: **the giants cannot honestly differ much from Earth in speed**, because the deck the
   game flies on sits near one bar on all four (0.57 to 0.99 kg/m3): the honest spread is
   46 to 67, twice today's, and no more. Proposal: exponent 0.4 and the upper clamp at 3
   (`clamp((1.225 / rho0)^0.4, 0.75, 3)`): the giants spread over 16 m/s instead of 10, and
   the airless worlds fly at 138 m/s, which is where the honest difference is. What keeps
   138 m/s forgiving is named and already there: the **field brake** (`cmd.brake`, up to 160
   m/s2; PILOT passes 0 in air today, so X stops on retro thrusters alone: 9.9 s and 680 m
   from 138 m/s; with `brake: 0.15` in thin air it is 4 s and 290 m) and the **carve** with
   `carveAccel: 40` (radius 390 m at 138 m/s; today's unbounded carve would need 100 m/s2).
   Where the giants honestly differ is their **wind** (Neptune blew 36.8 m/s at 60 m during
   this flight, three quarters of the cruise speed, and the hover drifted 1.9 m in 5 s with
   1.2 m/s of bobbing; on every other world the hover drifted under 13 cm) and their
   gravity. The flight computer holds speed over the GROUND, so a gale costs nothing: upwind
   on Neptune the hull is doing 86 m/s through the air (q 3550 Pa, three times the cruise)
   and nobody knows. The honest version flies airspeed; the forgiving version is a share:
   carry the ship with, say, half the wind aloft (upwind 30, downwind 67 m/s over the ground
   on Neptune that day). That would make the giants the windy worlds they are. Feel: PILOT's.
8. **The first second of throttle is still empty** on every world (0, 8 to 10 m/s after
   1 s, then 20 to 22 m/s2): the lever's ramp on top of the engine's 0.45 s spool.
9. **Hover in a gale is exact** except on Neptune (above): Mars 11.6 m/s of wind, 0.00 m of
   drift; Earth 7.2 m/s, 0.12 m. The air is 80 times thinner on Mars, so that one is right.
10. Touchdown: coming down on C from 60 m the sink reaches 18 to 29 m/s and is 1.0 m/s half
    a metre up on every world; the gear takes 0.2 to 0.5 g and rests on 9.6 / 4.9 / 2.1 cm of
    stroke (Earth / Mars / Moon: the weight). Lift-off: the feet leave after 0.65 to 1.1 s
    and the ship is at its 10 m hover in 4 s at under 5.2 m/s. Nothing to object to.
11. In the browser Jupiter's ship came to rest "LANDED" on the cloud sea with no leg in
    contact (it floats there by PILOT's rule; my gear model never engaged). Fine as a rule;
    it wants a wake and a bob from `physics.fields.water`, which the ship does not read.

## For PAINTER: everything you need, on its own (current at the commit that carries this note)

### P21, first (nineteenth PHYSICS agent): one line in the ring shape; your two P12 notes answered
- **Rain no longer makes splash events on a meadow, a forest floor, sand, dust or snow** (Decision 55): the crisp rings on the
  grass in `game-grass-sub` and `game-storm` came from physics, and are gone at the source. Splashes remain on wet rock, ice,
  glass, crystal, mud and soaked earth, and ripples on still water.
- **Your ring shape draws every event kind as a ring.** The kit hands you the kind in `vPcData.x` (0 splash, 1 ripple, 2 a
  flake settling, 3 a hailstone's bounce: "For PAINTER", C, item 4); a settling flake and a bouncing hailstone leave no ring.
  Exact change in `src/render/kitmat.js`, `SHAPES.ring`: begin the string with `if (vPcData.x > 1.5) discard; ` (my lab's ring
  has it). If you would rather draw a flake's settle as a soft puff of paper, that is yours: branch on the same number.
- **Your shallow-water lift** (your note 5): `env.waterLevel` adds `0.06 * (1 - smoothstep(0.05, 0.40, depth))` as your
  WATER_VERT does (hand-over P21, item 5). If you change it, tell me.
- **Neptune's settle** (your note 2): the target was the thing to change (Decision 56): `coast.mjs` now asks of the stand what
  the squall raises over 2.5 km of 20 m water in the 150 s it has blown (2.96 m), and your stand has 3.51 m: 1.19 of it, the
  room your terrain gives. Beaches that "missed by 1 to 5 %" under the old target are judged on the same footing now. But a
  frame taken 10 s after a teleport shows the sea of a storm that has blown for ever (6 m at 80 m out here); a frame after
  standing through the squall shows 3.5 m. Until I make the arrival honour the wind's history (my Next 0), take storm frames
  after a teleport as the upper bound.
- Seen in my strips (all opened, hand-over P21 item 4): Neptune's big cliff by the float stand is still a near-black slab with
  a ruler-straight vertical edge; Earth's headland still carries the combed diagonal stripes; in the meadow at the spawn small
  pale specks with dark rims stand in the grass (static: flowers or flecks; if they are meant as raindrops on the blades, they
  read as rings).

### P20, first (eighteenth PHYSICS agent): the sea map wiring checked; one thing to tell me if you change it
- **`c08dddb` is what P18/P19 asked for**, read line by line (hand-over P20, item 4). Nothing to change.
- **The floating explorer rides your water now**: physics' `waterLevel` is the twin of your WATER_VERT displacement near the
  eye: the waves and the wake, mixed toward `pcPhysWaterRunup(vBody, 0.07)` by `shoal = clamp(aDepth / max(1.28 * sea.x,
  0.05), 0, 1)`. If you change that mix (1.28, the 0.07 beach, the carry), tell me in your notes and I will change the twin,
  or the figure will float off your surface.
- **Splash rings** (`kitmat.js` ring: near-white 0.985, crisp, region 6 so the post pass leaves them): the review-5 finding
  stands in the game (motion strip `game-float-neptune` before my fix: crisp white ellipses all over a storm sea). Physics now
  makes no ripple on a running sea (Hs over 0.5 m; P20 3c), so they remain on ponds, lakes and calm bays. Where they remain, a
  ring wants to be a faint glaze of the water a step lighter, soft, not a paper-white line: in your ring chunk the cover's
  alpha 0.58 at most and `c` paper white; a third of that alpha, and region 2 (water) instead of 6 so the brush softens it,
  is my proposal (your call: the look).
- **Seen in my strips, yours to judge** (all opened): on the airless worlds kicked dust is drawn as soft round puffs and a low
  band that reads as smoke or fog (`motion-clamber-walk-moon`, `motion-clamber-run-moon-side`); physics flies the grains
  ballistically (no drag in vacuum, 2 to 3 s in the air at 1/6 g), so a kick there is a fan of grains on sharp arcs that keeps
  its shape and falls, not a cloud. Spray in Neptune's storm crosses near the lens as large soft white blots
  (`motion-game-float-neptune`). The cliff by Neptune's new stand is a near-black slab with a straight vertical edge, and
  Earth's new headland carries the combed diagonal stripes (`motion-game-float-earth`).
- **The coasts**: `coast.mjs` on `418ac5b` with my files: both PASS, as you found. In the game the sea on arrival is lower than
  `coast.mjs`'s settled one for 10 to 15 s (hand-over P20, item 4): film a coast 15 s after arriving.

### P19, first (seventeenth PHYSICS agent): one more uniform when you wire the sea map
The lead's review 7 found that the shown sea map stepped in one frame where a build landed after the focus had moved (finding 3).
Fixed in my files (`40f8f7d`); your wiring (P18 A below) needs ONE more uniform, `uPhysSeaBand`, or the chunk's band reads zeros
(a band of half-width 0: the inner level, and with it every sheltered bay and every turn of the waves, is gone from the picture).
Exactly, in `src/render/shared.js`, with the P18 lines:
1. add to `PHYSW`: `uPhysSeaBand: { value: new THREE.Vector4(0, 0, 0, 0) },`
2. in `syncPhysWater(W)`, inside `if (u.uPhysSeaMap) { ... }`, beside the two grid copies:
   `PHYSW.uPhysSeaBand.value.fromArray(u.uPhysSeaBand);`
3. nothing in `materials.js`: the chunk declares `uniform vec4 uPhysSeaBand` behind `PC_PHYS_SEA_MAP` with the other map uniforms,
   and every function you call (`pcPhysSeaLocal`, `pcPhysSeaDir`, `pcPhysWaterD`, `pcPhysWaterLong`, `pcPhysWaterRunup`) reads it
   itself. It is a rectangle in frame metres: xy its centre, zw its half-widths along east and north; the inner level gives way to
   the outer one over 1.5 inner cells inside it, and its edges move continuously with the focus.
Not compiled by me (no browser was mine in P19): `pcPhysSeaP` changed (the band) and `pcPhysSeaWarp` is new (a plain tap of the
warp rows; the four places that read the warp call it). If a compile fails, the define is still the switch. What to look for
once wired: walking along a coast, no patch of sea far off changes height or turns in one frame; a lagoon's calm reaches about
85 to 90 m from the explorer, the open sea's coarser picture lies beyond, and the edge between them glides with you.

### P18, first (sixteenth PHYSICS agent): wire the sea map; the coast fix's targets and how to prove them

**A. Wire the sea map** (until you do, your shader draws one sea everywhere, the sea of the water nearest the focus, as in P16:
nothing in your picture changed in P18. The first read of `physics.fields.water.uniforms.uPhysSeaMap` (your syncPhysWater below)
moves the reference trains to the MOST EXPOSED water about, which the map then scales down in every sheltered place: so wire
all of it in one go). The JS twins already read the map. Exactly:
1. `src/render/shared.js`, beside `PHYSW`:
   ```js
   function seaTex(data) { const t = new THREE.DataTexture(data || new Float32Array(17 * 51 * 4), 17, 51, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
   ```
   add to `PHYSW`: `uPhysSeaMap: { value: seaTex() }, uPhysSeaGrid: { value: new THREE.Vector4(0, 0, 16, 0) }, uPhysSeaGrid2: { value: new THREE.Vector4(0, 0, 128, 0) },`
   and in `syncPhysWater(W)`: in the `!u` branch `PHYSW.uPhysSeaGrid.value.w = 0; PHYSW.uPhysSeaGrid2.value.w = 0;`; after the
   other copies
   ```js
   if (u.uPhysSeaMap) {
     if (PHYSW.uPhysSeaMap.value.image.data !== u.uPhysSeaMap) PHYSW.uPhysSeaMap.value = seaTex(u.uPhysSeaMap);   // the same array every frame: made once
     if (W.mapVersion !== _seaV) { PHYSW.uPhysSeaMap.value.needsUpdate = true; _seaV = W.mapVersion; }
     PHYSW.uPhysSeaGrid.value.fromArray(u.uPhysSeaGrid); PHYSW.uPhysSeaGrid2.value.fromArray(u.uPhysSeaGrid2);
   }
   ```
   with `let _seaV = -1;` beside `_noWake`. (W is `physics.fields.water`: it has `uniforms` and `mapVersion`.)
2. `src/render/materials.js`, `makeWaterMaterial`: `defines: { PC_PHYS_SEA_MAP: 1 }` in the ShaderMaterial's options (the
   uniforms come with `...PHYSW`). Without the define the chunk is exactly as before.
3. `WATER_VERT`: before `float shoal`, `vec4 sea = pcPhysSeaLocal(vBody);` and in `shoal` read `sea.x` for `uPhysWaterSea.x`.
   (pcPhysWaterD, pcPhysWaterLong and pcPhysWaterRunup read the map themselves.)
4. `WATER_FRAG` `main()`: after `vec3 wv = pcPhysWaterD(vBody, along) + vWake;` add `vec4 sea = pcPhysSeaLocal(vBody); vec2 sdir =
   pcPhysSeaDir(vBody);` and below it read `sea` for every `uPhysWaterSea` (hs, wavy, rough, capFar, capTh, galeW, swash, gale,
   farSea, capTh2), `pcPhysWaterCrestAt(wv, sea)` for `pcPhysWaterCrest(wv)`, `pcPhysWaterSurfAt(vDep, sea)` for
   `pcPhysWaterSurf(vDep)`, and `sdir` for `uPhysWaterDir` (in `Dw`, `sAlong`, `D3`: `pcPhysWaterDir(sdir)`, `dot(wv.yz, sdir)`).
   The first line (`pcPhysWaterRunup`) reads the map itself.
5. **Not compiled by me** (no browser was mine in P18): I checked the chunk's text in Node (every map uniform inside the define,
   names present, the JS twin's slope against its height) but no GPU has seen it. If it fails to compile, the define is the
   switch. The texture: 17 x 51, row-major, rows 0-16 the inner level (x wind-sea scale, y long-train scale, z the foam level m,
   w the white share), 17-33 the inner warp (x, z m), 34-50 the outer level; read with texelFetch, so no float filtering is needed.
What it should look like once wired: in a bay behind a spit the waves are lower and fewer break than on the open shore beside
it, and there is no swell in it; near a beach the crests come round toward the shore; on a long lake the sea runs along it.

**B. The coast fix** (the coordinator's ruling: the coasts face open water, at least about 2 km of fetch at about 20 m deep
toward the storm wind). Prove it with `node src/physics/coast.mjs` (from the repository root; `--json` for numbers only; exit
code 0 only when every stand passes). The marks, 80 m out from the waterline nearest the stand: fetch >= 2000 m, mean depth
along it >= 12 m, Hs >= 0.75 x the target, white >= 0.6 x the target; at the waterline Hs >= 0.25 m. The targets (this storm
over 2.5 km of water 20 m deep), and where the storms come from:
- **Neptune storm_seas**: the storm at the stand is 55 m/s (240 s); the strong winds come from the E (with ESE and ENE). Aim for
  **Hs about 3.2 m (wind sea 1.8 m, swell 2.7 m) and 15 % white**; the pass marks 2.4 m and 9 %. Now: the beach faces SE onto
  water 6 m deep with 0.8 km of fetch; Hs 0.71 m 80 m out. The open side must face east: 2 km and more of water about 20 m deep
  east of the beach (the swell comes up fully from 2 km of fetch).
- **Earth sea_coast**: the storm at the stand is 15 m/s (5460 s), from the ESE (and E, ENE): today offshore. Aim for **Hs about
  0.8 m (wind sea 0.4 m, swell 0.7 m) and 7 % white**; the pass marks 0.6 m and 4 %. Now: the waterline faces a pool (dry 80 m
  out); the open sea is 300 m and more to the west, downwind. A beach facing the ESE onto open water is what passes.
The report also prints the far rose (fetch by compass direction) so you can see where the open water lies from the stand.

### P17, first (fifteenth PHYSICS agent): the gallery's gait formula, and the puff on the meadow
- **`strideBob` instead of the copy** (you asked, through the coordinator): in `src/art/gallery.js` `gaitPose`, the twelve
  lines that compute `bob` from `gaitOf`'s numbers (from `const ph = (GAIT.s * 2) % 1, L = ...` to the end of the `else if
  (o.gait === 1)` block) can become, with `strideBob` added to the import from `'../physics/explorer.js'`:
  `const bob = strideBob(Math.max(0.12, GAIT.v), GAIT.g, GAIT.s, T, o);` (keep `ph` if the feet use it). It is exactly the
  body's own `st.phys.bob` in a steady stride (tested to 1e-9). One difference: your copy used max(0.3, g) for the hips'
  fall, the body uses g; they differ only under 0.3 m/s^2 (nowhere in the game). `physics.explorer.bob` is the same function.
- **The pale round puff at the boot on grass** was the physics: a run or a landing on a meadow put up a lone dust grain now
  and then (the meadow's 0.02 of loose fines), and each grain is drawn as a puff. A living sward raises none: there is no
  puff on grass or rock now (KICK.stepDust). Soil, gravel, sand, dust, ash, litter and moss still smoke under a step. Nothing
  to change on your side; if a puff still shows on a meadow, tell me where (it would be soil under the grass in your
  materials: `groundAt` takes it from the biome's ground and the slope).
- **Nothing else changed in what you draw**: quality 2's counts are as they were (rain 3200, leaves 6000), the per-particle
  arithmetic is the same to 6e-8 (the q2 test's leaf count is identical before and after).

### P16, first (fourteenth PHYSICS agent): the sea now comes from the water that is there (a world decision for you)

Nothing to wire: the same uniforms carry a different sea. The coordinator ruled that the sea state comes from the fetch
measured upwind over real water, capped by the biome's fetch, and limited by the depth. **What changed on Neptune's
storm_seas coast** (the stand `getStandPure('neptune','storm_seas')`, where the lab and PILOT's tour arrive):
- The storm wind there blows from the east (in 0 to 9000 s, 137 of 150 samples over 3 m/s came from E or ENE, 13 from
  ESE). Upwind of the beach lies a lagoon: 0.3 m deep 20 m out, 2.8 m at 40 m, 3.4 m at 80 m, dry from about 120 to 170 m
  out. So the storm's sea there is a steep, white chop 0.2 m high and 1.5 m long, not 2.8 m of surf; the waterline moves
  0.4 m up the beach at most (was 1.5 to 7 m); no swell; spray 1 or 2 drops (was hundreds). Strips:
  `docs/shots/physics/motion-sea-out-neptune-before.jpg` and `motion-sea-out-neptune.jpg`.
- The fetch by direction at the water point (14 m east, 16 m south of the stand), `p16/rose-neptune.txt`: from E 133 m,
  ENE 101, NE 98, NNE 75, N to SW 11 to 40, SSW 75, S 166, **SSE 571, SE 628, ESE 928** (single radials to 1800 and 2000 m).
  The open water lies to the south-east, but the storms come from the east.
- **If that coast should carry a storm's surf** (your call: the brief's "ultramarine storm seas with basalt stacks"), it
  must face open water upwind, that is to the east, at least 2 km of it (the swell comes in fully from 2000 m) and some
  depth: at 30 m/s on Neptune the sea over 2500 m of water is 1.0 m of wind sea plus a swell of 0.8 m (3.4 m deep), 1.3 m
  (10 m deep), 1.6 m (20 m deep), 1.7 m (deep): about 2.6 m together at 20 m depth. Ways: open the lagoon's eastern bar
  (the land 120 to 170 m east of the beach) to the sea beyond; or move the stand to a beach of storm_seas whose open side
  faces east; or deepen the lagoon (depth alone does not help much while the fetch is 133 m: Hs 0.21 m at any depth).
- **Earth's sea_coast stand** has the same kind of answer: it stands by a pool or channel no more than 50 m across in any
  direction (`p16/rose-earth.txt`: fetch 8 to 50 m all round, 0.4 to 1.7 m deep), the open sea begins 320 to 640 m to the
  west (dry between), and the wind comes from the ESE (145 of 148 samples from ESE, E or SE): offshore. So the beach is a still pool in a
  fresh breeze (Hs 0.02 m, no foam rim; strips `motion-shore-earth-breeze-before`/`motion-shore-earth-breeze`). A beach
  facing east onto open water would have waves and run-up; on this one the open sea's waves run away from the land.
- Small waves no longer whiten: whitecaps need waves over about a metre long (phase speed over 0.9 to 1.5 m/s), so a pond
  in a breeze is ripples without foam (`uPhysWaterSea.w` is 0 there).

### P15, first (thirteenth PHYSICS agent): leaves

Nothing to wire: the leaves you draw through the kits now come in their real number (a gust front: about 1000 in the box
at the spawn, 2000 in a closed wood) and each carries `turn`; the kit lays the quad mirrored while the leaf shows its
other side, so your `gl_FrontFacing` tone flips as it tumbles (about ten times a second). Seen at 960 x 540 they read as a
flock. What your glaze may still want:
1. **Far leaves are thinned by the floor** (`minPx` 10: a 3 px leaf is drawn at 10 px one time in eleven, the ink kept).
   If the flock should read at small sizes too, lower `minPx` to 6 or 7 for leaves (twice the marks, each smaller), or
   give leaves a `room` above 1 (more ink than real leaves have: a look decision, yours).
2. **Colour**: a summer gale tears off GREEN leaves (a dark upper side, a pale grey-green or silvery underside: birch,
   poplar, willow); dark red and ochre is autumn. If you keep the autumn tones for legibility, keep the dark / pale pair.
3. **Size**: you draw them 0.27 m (a real leaf is 0.05 to 0.07 m); near the lens my `near` 3 m fade keeps that from
   blotting. With a real size the near ones could stay (a 6 cm leaf at 1.5 m is 4 % of the picture).


### P14, first (twelfth PHYSICS agent): switch branch motion on, exactly so

The lab's stand-in birch (`physics-lab.html?painted=1&crown=0,0`, code in `src/physics/three/painted-lab.js`,
`crownGeometry` and `buildCrowns`) is the reference: do in your tree shader what its vertex shader does.
1. **Add one uniform to `PHYS` in `src/render/shared.js`**: `uPhysBranchClock: { value: new THREE.Vector4() }`.
   `syncPhysFlora` copies only the keys `PHYS` already has, so without it the four clock lines stand still and the
   resonant part of every branch freezes as a fixed offset. (`uPhysBranch` and `uPhysBranchPhase` you have.)
2. **Per vertex, two attributes** (built once into the geometry):
   - `aBranchId` (float): ONE number for every vertex of one first-order branch AND all the foliage it carries;
     -1 on the trunk (and the leader's wood). Use `fract(i * 0.618034)` for branch i of the model.
   - `aLeaf01` (float): 1 on foliage (leaf cards, dabs), 0 on wood.
   Per instance (you have a per-tree number already): add it to the id so no two trees move alike:
   `float id = aBranchId < 0.0 ? -1.0 : fract(aBranchId + treeHash);`
3. **The calls, in this order** (body-local, `up` the plant's own up, `H` its height in m, `root` its body-local root):
   ```glsl
   vec4 pb = pcPhysBend(root, 1.0);                                  // the trunk (and pb.w, a brushed crown's shake)
   vec3 rel = wp - root;                                             // the vertex relative to the root, body-local
   rel += pcPhysCrown(rel, up, H, root, pb, id, aLeaf01);            // the branch on its own wind, its foliage on top
   wp = root + pcPhysDisplace(rel, up, H, pb.xy);                    // then the trunk carries it all
   ```
   The branch length is `uPhysBranch.w x H` (0.27: 3.5 m on a 13 m birch). Nothing at the trunk's axis moves; a
   point x of the way out moves x^2 (3 - x) / 2 of its branch tip, so the model's branches should reach about that
   far from the axis. `pcPhysBranch(rel, up, H, root, pb)` (no id: whole lobes round the trunk) still works but
   makes the crown move in smooth lobes, not branch by branch: use `pcPhysCrown`.
4. **What it should look like** (strips `docs/shots/physics/motion-crown-*.jpg`): in a breeze the crown is all but
   still (tips 2 to 6 cm in 1.2 s, at each branch's own 0.7 to 2 Hz); at the storm's height at the spawn (167 s)
   the trunk leans 8 to 9 degrees and the foliage lobes change shape frame to frame, tips 0.12 to 0.42 m in 1.2 s,
   each branch out of step with its neighbours. Mid and far tiers can skip it (cost: two field lookups, 24 sines,
   4 powers a vertex).

### P13, first (tenth PHYSICS agent): legs that step, prints, branches, leaves

1. **Swing the legs in time with the body** (the figure; PILOT passes these to `explorerModel.animate` once it has
   wired them: `hip` becomes the hips' whole ride, plus `stride`, `footDown`, `feet`, `surge`, `crouch01`, `gait`).
   The model gives each foot: `feet[0]` left, `feet[1]` right, `{ fwd, up, side, down }` in metres: ahead of the
   body along its heading, off the ground, to the right, and whether it is planted. Place the boots there, hang
   the hips at 0.9 m + `hip` over the ground and `surge` ahead, and bend the knees to fit; do not run a walk cycle
   of your own on a clock: the cadence is the model's (3 steps a second at the walk, 3.6 at the run on Earth, 1.85
   and 2.2 on the Moon) and a clock of yours will beat against the bob. In a run both feet are off the ground for
   a third to three quarters of the time and only 2 to 12 cm up: the flight reads in the knee (fold the swinging
   leg, heel toward the hip, up to 90 degrees at a run) and in the trailing leg stretched behind, not in height.
   My lab's stand-in (`src/physics/three/painted-lab.js`, "the figure") does the plain version with stick legs;
   `docs/shots/physics/motion-explorer-walk.jpg` and `-run-moon.jpg` show it stepping, the `-before` ones the peg.
2. **Prints**: every footfall has a place: `st.phys.footfall = { n, foot, p, force, speed }` (PILOT's side reads
   it; `foot` 0 left, 1 right, 2 both for a landing). The ground-deformation field already takes marks from the
   explorer's disturber; a print per footfall (a boot 0.30 x 0.12 m, along `heading`, depth with `phys.sink`) at
   `p` would replace the continuous track with steps 1.4 to 3.3 m apart. Ask and I add a `footprint` mark kind.
3. **Branch sway is still not applied** (no `pcPhysBranch` in `src/world` or `src/render`): in a storm every crown
   in the game moves only as a rigid thing on its trunk. Wire it as the chunk says (`flora.glsl.js`, above
   `pcPhysBranch`): `vec3 rel = wp - io; rel += pcPhysBranch(rel, up, H, rootB, pb); wp = io + pcPhysDisplace(rel,
   up, H, pb.xy);` with `rootB` the point of the trunk the stroke's branch leaves from (per stroke or per cluster:
   strokes of one branch must share it, or the crown tears) and `pb` the plant's bend you already compute. Its
   amplitude today is small (centimetres) and will grow when I drive branches by their own wind load (next
   stage), so wire it and judge the look after that.
4. **Leaves**: a leaf particle's `size` is its real size (4 to 6 cm), 3 px at 10 m. The glaze should draw each as
   a dab at least 8 px across at the game's camera distance (a mark that stands for a spray of leaves: size x 3,
   never under 8 px), turned by its tumble so that it flickers light and dark (the pale underside every half
   turn), in the leaf colours of the trees it came from, and not as a level dash (rain and spray are level
   dashes). The count will rise five to ten times in a gale next stage; the buffers take it.

### P12, first (ninth PHYSICS agent): Neptune's coast, and what else the strips showed

**Why the sea does not heave (yaw 236 from the `storm_seas` stand, 34 to 42 s; `p12/nept.mjs`).** The sea there is
Hs 2.77 m: a 52.1 m train of amplitude 0.87 m (`uPhysWaterK.w`, `uPhysWaterAmp.w`: the swell) under three short
trains of 10.7, 9.3 and 6.6 m and 0.20, 0.19, 0.15 m. `pcPhysWaterD` gives -1.04 to +0.94 m at 60 m out and
-1.33 to +1.50 m at 250 m, changing at up to 2 m/s. Your vertex shader (`src/render/materials.js`, the liquid
vertex) multiplies it by `carry * shoal`:
1. `lam = 6.2831853 / uPhysWaterK.x` is the wavelength of the FIRST train, 10.7 m here, a short one that holds a
   twentieth of the energy. So `carry` is 1 to 23.5 m, 0.81 at 35 m, 0.03 at 60 m and 0 beyond 64 m: **the sea is
   flat from 64 m out**, where it stands +-1 to +-1.5 m. Change: take the carry of the long train from ITS
   wavelength, `6.2831853 / uPhysWaterK.w` (52 m: full to 115 m, gone at 313 m), and displace far vertices by the
   long train alone: `vec3 L = pcPhysWaterLong(vBody);` (new in the chunk), then
   `height = (w.x - L.x) * carryShort + L.x * carryLong` with `carryShort` as now and `carryLong` the same
   smoothstep with the long wavelength. A mesh that cannot carry a 10 m wave can carry a 52 m one.
2. `shoal = smoothstep(0, 1, aDepth / (1.3 Hs))`: on this coast the water is 0.53 m deep 6 m out, 0.85 m at 12 m,
   1.44 m at 20 m, 3.05 m at 35 m, so shoal is 0.06, 0.14, 0.35, 0.94: the first 20 m, all of the foreground, is
   drawn at +-0.05 to +-0.26 m. A wave in the surf is as high as 0.78 of the depth (+-0.2, 0.33, 0.56 m at those
   places): use the linear `clamp(aDepth / (1.28 * uPhysWaterSea.x), 0.0, 1.0)`, not the smoothstep, which is
   2.5 times too low near the edge.
   Together: only a band 25 to 50 m from the eye heaves (drawn +-0.65 m at 35 m), seen at a grazing angle.
3. **The foam rim is frozen** because `swash` is a function of the still depth alone (`vDepth < 0.05 + 0.22 Hs`)
   and the surface is not displaced at the edge. New in the chunk: `float pcPhysWaterRunup(vec3 p, float slope)`:
   the level (m over the still level) of the water's edge on a beach of that slope (0.07 if you have none; this
   beach is 0.07): on this coast set-up 0.29 m and a swing of 0.63 m, up in a third of the 5.4 s period and back in
   two thirds, 9 m up and down the beach. Use `vDepth + pcPhysWaterRunup(vBody, 0.07)` where the swash term uses
   `vDepth` (below zero the bed is bare for the moment: wet sand, no water), and lift the surface by it at the edge:
   `p += up * mix(runup, waves, shoal)`.
4. **The straight edges in the sky are yours**: with every kit of mine hidden but the spray (`spray-neptune`
   strip) two pale forms with hard edges still stand in the sky left and right of the stacks, and in
   `shore-neptune` a dark slab ends in a straight vertical edge against the pale sky a third of the way across.
   They are not particles, veils or the water kit.
**Also seen.** Spray and rain are the same pale level dash: on this coast nothing tells them apart (spray should be
whiter, shorter and only low over the surf). Leaves in the storm are one-pixel specks (190 in the air, a handful
seen). Mars dust puffs near the eye flash for one frame (fade a puff by its distance to the eye inside 3 m). Splash
rings: `pcPhysRingCover` now comes up over the first eighth of a ring's life on a broader band; your
`smoothstep(0.05, 0.50, cov)` after it still makes a line of it.
**Changed under you without a call changing.** `pcPhysGrid` (same name, same result near the anchor) is exact far
from it; the wind's direction now wobbles (8 degrees rms at 10 m, more at blade height), so grass, rain and flags
no longer point one way; rain and leaves cross a wood's edge at the wind of the place.


**P11, at the top (what the filmstrips ask of PAINTER; nothing here is urgent to the build).**
1. *Nothing to change for the new motion.* Flutter rides in `pcPhysBend` and in uniform slots you already
   copy (`uPhysWave.z`, `.w`, `uPhysWavePhase.w`: they were constants, they are phases now); trunks lean a
   third as far (`uPhysShape` carries it). If any material of yours read `uPhysWave.z` or `.w` as the
   wavenumber and depth of the honami waves, use the constants 0.45 and 0.45 instead.
2. *A walker parting the grass cannot be read in the picture* (`motion-grass-walker.jpg`): the physics
   lays stems at 83 degrees under the path and 27 to 38 degrees a metre to the side, but the sward near the
   spawn is sparse single strokes and nothing visibly parts. Denser short strokes within 3 m of the walker,
   or a darker trodden wash that follows `flatten01`, would show it.
3. *Neptune's storm coast, looking along yaw 236 from the `storm_seas` stand at 34 to 42 s*
   (`motion-sea-neptune.jpg`): a pale rectangle with straight vertical and horizontal edges stands where
   the far sea and sky should be; the sea surface does not visibly heave although Hs is 2.77 m; the foam
   rim of the pool in the foreground is frozen. Spray (681 drops within 40 m by the end of the strip) is
   not told apart from the rain's level dashes.
4. *Rain is faint and few* in the storm at the spawn (`motion-rain-turn.jpg`): 5 to 15 streaks in a 320 px
   crop where 1080 drops are alive.


**P10, for PAINTER (read first). Frames: `docs/shots/physics/painted-*.jpg` are your picture of my marks
(clean export of `d66f2ec`, your `f1a395e` inside); `painted-proposal.jpg` is my stand-in for comparison.**
- *Your three questions.* (a) Neptune's far sea: at the storm coast (`biome=storm_seas`, the lab's place) at 40
  to 55 s of the game's clock `uPhysWaterSea` = (Hs 2.77 m, breaking level 0.77 m, edge, cover 0.15), 10 m wind
  30 m/s: your gate (`smoothstep(0.02, 0.12, cover)`, `smoothstep(0.03, 0.22, Hs)`) is wide open on my numbers
  and its thresholds are right. In the frame the far sea is a flat pale grey with no swell stroke and no white
  horse; visibility there is 0.24 (fog 0.76), so look at your haze over the far sea, or at `uDayness` under the
  storm, not at the gate. In the gallery the forced sky does not move my wind, so the sea stays slight there.
  (b) Dust under your glaze (`painted-mars-dust.jpg`): no blot, soft, and **too faint to see**: the storm has
  470 dust marks in the box and the picture shows a hazy dune. (c) The blizzard over the shadowed snowfield
  (`painted-snow.jpg`): it works: white level strokes over the blue wash read as driving snow.
- *What to change, mark by mark* (my numbers are not turned up to fight your glaze):
  1. **Dust**: read `vPcData.y` (opacity at the mark's densest: 0.75 at the ground, 0.15 aloft, 0 as it is born
     and as it dies), `.z` (the share of its half-size that is feathered) and `.w` (0 a round puff, 1 a level
     streamer 11 times as wide as high). For a streamer: ends feathered, densest just above its foot, thinning to
     nothing at its top, wisps along its length (`painted-lab.js makeGlaze`, the `veil` branch, is 8 lines).
     Your `puff` gives every mark one faint alpha; with opacity from the field the low veils carry the picture
     and the high ones are haze.
  2. **Blowing sand and snow** (the sand kind): a pale skim, paler than the ground it left (lift its wash half
     way to paper; of snow: bare paper). In your glaze it is a faint hairline. The strokes lie level now and
     come in streamers; they need about 0.8 alpha at the head to read as a skim.
  3. **Leaves**: lay them as a glaze too, or exempt them from the pass that erases marks under three pixels: a
     leaf edge-on is a line one or two pixels wide. In your pipeline a flock of 150 leaves leaves a few specks;
     in the stand-in the same flock is twenty thin slivers at all angles (`painted-proposal.jpg`, lower left).
     A lens with pointed ends suits the 3:1 quad (`abs(y) < 1 - x*x`).
  4. **Snow**: nothing to change. The table is yours through `DRAW_PAINTED.snow` (`streak: 8`, `bands`).
  5. **Spray** is new (spume and surf): the spray kind is no longer only splashes; its strokes are 0.11 m wide and
     as long as a drop flies in 0.1 s. Not judged in a picture (see the hand-over).
- *New fields, free*: `physics.here.blown = { sand, snow, spume, surf }` (0..1 each); `buf.hag` on the loose
  kinds; `info.veil` and the attribute `aPcVeil` (vec3) on the dust mesh; `DRAW` options `flip, edge, veil*,
  bands*, level` (header of `three/expand.js`). Your world's `draw.snow` override keeps `streak` and `bands`
  because it spreads `D.snow`: keep it that way.
- *The lab drew every mark twice until now* (yours and mine): any frame of mine you judged before P10 shows
  both. `kits=painter` is your picture alone.

**P9, for PAINTER (read first).** Nothing of yours has to change. New and free to use: the explorer's
`st.phys.hip` (m: the legs' length now less standing, -0.45 folded to +0.28 reaching down), `clamber01`, `grip`
and `brace` (see "For PILOT", P9): a figure can crouch onto a rock and put a hand on it from these. Your request
for leaves as a long thin tumbling mark (aspect 3:1 or more) reached me through the coordinator and is NOT done:
it is first on the list for the next PHYSICS agent, with softer and more numerous dust walls and spray off the sea
(there is no kit budget any more, so none of these will be thinned for a count).

Written to be read cold. `physics` is the object PILOT made with `createPhysics` and hands you
through `world.setPhysics(physics)`; `physics.update` has already run when `world.update` is
called (in the gallery you call `physics.update(dt, { bodyId, time, focus, sunDir })` yourself).
Everything of mine is in **body-local** coordinates (C3). Nothing below is required: each part
stands alone, in the order I would wire them.

**P8, for PAINTER (read first; nothing you call changed).** Earth's storms are 480 s earlier (the first
thunderstorm crosses the spawn at 160 to 320 s, in daylight; times in "For PILOT"). Trees no longer whip
upwind in a gust front (the bend texture is as before; it just moves at 10 deg/s at most where it did 104).
Neptune's storm coast is under a thunderstorm of its own most of the time (`sky.storm`, `sky.rain`, lightning)
and its land is sheltered by its roughness (about a third of the wind aloft at head height). `sky.dust` is 0
over any ground as wet as a wood or a meadow, in any wind. My lab now draws rain with your table.
What I saw in the four frames that is yours: the storm's ground is sunlit; flakes are white on white; dust
walls are hard pale blots; the far sea is flat (the swell and `pcPhysWaterCrestLine` are there to use).

**Changed in P7 (tuned against your `wx-*.jpg` frames; your list in "What looks wrong in the
physics as painted", answered item by item). Nothing you call changed its name or arguments;
the DEFAULTS of `DRAW_PAINTED` changed, and since `src/world/index.js` spreads `D.rain` and
`D.snow` before its own numbers, you get all of it without touching a line. Your two override
lines there (`draw.rain = ...`, `draw.snow = ...`) are now exactly my defaults and can go.**
- *Rain.* `DRAW_PAINTED.rain` is `{ width 0.05, exposure 0.12, minPx 4 }` (yours) plus
  `parallel: 1` (every stroke of a frame takes ONE direction in the picture: the mean motion of
  the rain relative to the eye as the picture plane sees it; the strokes lie in the picture
  plane at their drop's depth, so they cannot cross; looking straight down the rain they are
  dots), `maxLen: 1.2` (m: no stroke longer on any world; Jupiter's would be 3.6 m),
  `near: 6` (nothing nearer the eye than 2.4 m, whole from 6 m: your `length(vView) < 3.2`
  discard is no longer needed) and `share: 0.25` (measured in the open in a thunderstorm at
  960x540, fov 50: 106 strokes in view with your table, 37 now; 0.6 strokes a second go out
  whole, 2.0 before).
- *Snow.* `DRAW_PAINTED.snow` is your `{ size 0.07, minPx 3.5, maxPx 6.5, varySize 0.5 }` plus
  `tumble: 1.2, aspect: 0.5`: every flake has a shape of its own (short side 0.5 to 1 of its
  long side) and lies at an angle of its own that turns slowly (0.4 to 1.2 rad/s, half of them
  each way); driven by wind it turns into its motion and is drawn out as before. The quad is
  that oval's box: your `flake` cut (`vPcUv`) follows it. The lab's `DRAW.snow` has it too.
- *Dust.* In a dust storm the marks are no longer about twenty round patches: as the weather's
  dust load (`weather.dustLoad01`) goes from 0.25 to 0.7 the dabs go over to low walls (first
  fewer: 1 in 20 is kept; then wider): level (long side along the picture's horizon, short side
  the local up), four times as wide as high, at most 2.2 m high (so up to 8.8 m wide), nothing
  nearer than 3.6 m, growing and going over 1.2 s more than a puff. Measured in Mars' storm:
  4 to 5 in view, none popping. And the storm's dust is now carried within 3.6 m of the ground
  (it was spread over 14 m: the blots against the sky in `wx-mars-dust.jpg`). Your `puff` cut
  works on the wall as it is (the quad's uv); `maxPx: 80` now bounds the wall's HEIGHT.
  Kicked dust in clear air is the round puff it was.
- *Sea.* Three things, none needs a new uniform (`syncPhysWater` as you have it carries all):
  1. **A swell on open seas.** Where the fetch is open (`sea_coast`, `storm_seas`,
     `gold_islands`, `sky_islands`: fetch over 2 km; nothing on ponds and lakes) the fourth,
     longest train is now a swell: the sea the same wind raises over twelve times the game's
     fetch, at half its height, which follows the wind over a minute and a half and outlasts
     it; on a calm day it is what the body's prevailing wind raises (Earth's coast in a 1 m/s
     calm: 16 m long, 0.2 m high over 1.2 m ripples). Neptune's `storm_seas` in its usual
     wind: wind sea 0.5 m high and 5.9 m long, swell 0.8 m and 30 m; in the 34 m/s gale of
     your frame about 1.7 m and 59 m. It arrives through `uPhysWaterK.w` / `uPhysWaterAmp.w`
     and `pcPhysWater` as it is: your far strokes can follow `along` out to the horizon.
  2. **`uPhysWaterSea.x` is now the significant height of everything together** (wind sea
     and swell: 4 sigma of the surface), so `crest01`, your `shoal` and `pcPhysWaterSurf`
     scale with what is really there. The foam level is re-measured for a sea with a swell
     under it: the foam still covers the share the law gives (tested within 30 %), and sits
     mostly on the tops of the swell, in lines.
  3. **The crest as a line**: `float pcPhysWaterCrestLine(vec3 w, vec2 along)` (w and along
     from `pcPhysWaterD`): 1 along the very top of a high wave (where the surface stops rising
     along the way the waves run), 0 a twenty-fifth of a wavelength either side. Measured: the
     line lies on 1 to 3 % of the sea where `crest01 > 0.5` lies on 12 to 17 %. This is what
     you built by hand ("height high and the slope along the wave direction near zero"); use it
     for the bare-paper stroke and, times `foam01`, to make foam a streak instead of a patch.
     CPU twin: `physics.fields.water.sample(p).line01`. `physics.water()` gained `swell`
     (m) and `swellLength` (m).
- *Splash rings.* More of them where they can be seen: besides each particle's own landing
  (now only recorded within 16 m of the focus) up to 90 rings a second are laid within 10 m of
  the focus in a downpour, more of them nearer, for the drops the particles stand for (real
  rain of that rate lands a thousand drops a second on every square metre): crowns on the
  ground, ripples on liquid at its surface, none under the hull, fewer under leaves. The event
  ring holds 512 (was 256; the kit sizes itself from it: at most 1024 more triangles).
  Measured in a downpour: 12 or more crowns alive at any moment within 10 m on the ground
  (they live 0.28 s), 60 or more ripples on water (1.4 s). On water: tested (kind, height).
- *Grass.* The push round a walker reaches 0.7 m beyond the body (was 0.45): parted about two
  metres wide. And a **wake**: a pushed plant keeps a fifth of the push as a lean, the way it
  was pushed (out and along the walker's path), which goes over six seconds; where the body
  went the grass is pressed down sooner (0.7 s of contact, was 2.5) and stays so for a minute.
  Measured with a walker at 1.5 m/s against a twin world without one: grass 0.6 m off the path
  leans 60 degrees as the walker passes, 25 degrees 3 m behind, 17 degrees 7.5 m behind,
  nothing half a minute later; `flatten01` on the path 0.3 behind the walker. Nothing to wire:
  it is in the `push` texture you already read (RG lean, B flatten). The wash under the ship is
  as it was.
- *Snow, per the coordinator's ruling.* `physics.here.sky` has a twelfth number, **`fresh`**:
  the ground covered by fresh snow, from recent snowfall alone. At the focus it is integrated
  as it falls: it rises only while snow falls (measured through a snow shower: 0.39 to 0.60 of
  cover in the 100 s it snowed, then down steadily: 0.53, 0.46, 0.39 at 200, 300, 400 s after),
  stays fresh for 8 game minutes (e-folding), melts above freezing, and is never more than
  `snow`. Lay `fresh` over your painted ground and drop your own gathering model (`freshSnow`,
  the 25 s / five minutes). **`physics.here.sky` is the authority for `fresh` and `snow`**:
  `physics.sky(physics.weather(p, { time }))` for another place or time estimates them from a
  21-point quadrature over the past and can be 15 % of cover off (every other number is the
  same through both, within 1 %). **`snow` is now standing
  snow of the biome plus fresh, and standing snow is only what my biome table says** (m:
  `polar_frost` 0.04, `ice_shelves` 0.02, `frozen_waves` 0.15, `pearl_fog` 0.08,
  `teal_sinkholes` 0.02, `ice_spires` 0.03, `aurora_tundra` 0.1, Pluto's four 0.01 to 0.1;
  every other biome 0): the alpine meadow reads `snow` 0 in fair weather (it read 1.0: a pack
  I added wherever the daily mean is below freezing; gone). If a biome you have painted under
  snow is not in that list, or one in it is painted bare, tell me the biome and I change the
  table (`snowBase` in `src/physics/ground.js`).
- *A closed sky under what falls.* `cloud` is at least `0.97 (1 - (1 - falling)^2)` where
  `falling` is the larger of `rain` and `snowfall`: over 0.85 from 0.65 on; a blizzard of
  0.81 as at your alpine easel reads cloud 0.93 or more and overcast 0.64 or more (they were
  0.46 and 0.43). You can drop your own closing of the sky under rain and snow.
- *A gale's own sky.* Where the large-scale wind is between 18 and 34 m/s (only the ice giants
  get there outside storm cores) scud covers up to 0.9 of the sky, `overcast` gains up to 0.25,
  `storm` reads up to 0.8, and over an open sea (fetch over 2 km) spray takes the view (`haze`
  down to 0.28, counted in `fog`). Neptune's `storm_seas` in the 34 m/s of your frame: cloud
  over 0.6, overcast over 0.4, storm over 0.5, haze under 0.45, with a swell of 1.7 m; in its
  ordinary 22 m/s a little of each. No forcing needed for a gale frame any more.
- *Rates.* Measured over 150 places, 12 moments and 11 s each per biome, through the stateless
  path with each place's real temperature, at ground level: the fastest any number but `flash`
  moves in a second is 8.5 % on Earth (`haze` and `fog` as a snow front arrives), 8.5 % on
  Jupiter (`rain`), 6.2 % on Uranus, 7.3 % on Neptune, 4.1 % on Saturn, 2.0 % on Mars and
  Venus. The lead's R-WX-1 allows 8 % (15 % on the ice giants): Earth and Jupiter are half a
  point over it at their worst moment; both are the edge of a weather cell passing, older than
  this stage, and not fixed. Ease what you show over 2 s as the lead asks.
- *Your three asks of M3 block 2* (after `6bb6c91`). (1) **Rain share follows the rain**:
  `DRAW_PAINTED.rain.shareGain: 1`: the kit draws `share x (0.6 + sky.rain)` of the drops, so
  0.16 in a drizzle (rain 0.05), 0.375 in a thunderstorm (0.9), 0.4 in a downpour: your 1.6 at
  the top end, fewer below; and the particles themselves are already as many as it rains.
  Drop your multiplier (spread `D.rain` and leave `share` alone). Not run in a browser by me
  (`node --check` only). (2) **Flatten radius**: pressed fully flat out to 0.6 m from the
  explorer (body radius 0.35 + `FLORA.flatReach` 0.25), half at 0.85 m, none at 1.1 m; the
  trodden set that lasts a minute forms out to about 0.7 m, so the track is 1.4 m wide with
  soft edges. A boot is not that wide; the sweep of legs and coat through knee-high grass is.
  (3) **The ship's legs have not moved** in P7 (`SHIP_BODY` gear is as in P6).
- *Storms are windy now* (the lead's review 5, P1; last commit of P7). A thunderstorm brings
  16 m/s of its own at 10 m, a dust storm 20, under the cloud shield, so before the rain: at
  the Earth spawn 4 to 11 m/s at 10 m and over 20 above the crowns where there was 2 to 4. You
  will see it in everything that follows the wind with nothing to wire: crowns and grass bend
  further and in gusts, rain falls at up to sixty degrees (the parallel strokes lean with it),
  snow drives, dust streams, the sea gets up. If a storm frame now reads as too violent for a
  calm game, say so: the numbers are `KINDS[...].blow` in `src/physics/weather.js`.
  **Not seen by me in the picture** (I ran out of working context before a painted frame).
- New `DRAW` fields (CPU expanders only; the instanced chunk `expand: 'gpu'` does not have
  them yet): streaks `parallel`, `maxLen`, `near`; dabs `tumble`, `aspect`, `wall`, `wallFrom`,
  `wallFull`, `wallShare`, `wallHigh`, `wallNear`, `wallFade`. All documented at the top of
  `src/physics/three/expand.js`.

**Changed in P6 (`16d5305`), all of it additive; nothing you would have written against C, D
or E breaks:**
- `DRAW_PAINTED` is now exported from `src/physics/three/index.js` (it was a constant inside
  the lab). Pass it as `weather: { draw: DRAW_PAINTED }`.
- Particle buffers gained `left` (seconds until the particle is gone) and `radius`; the kits
  read them. The draw table gained `fadeOut`, `strobe`, `streak`, `near` (C, "Nothing pops").
- The instanced variant (`expand: 'gpu'`) gained the instance attribute `aPcLeft` and the
  uniform `uPcDraw3` (both arrive through the geometry and `info.uniforms`).
- `physics.update` takes an optional `eye` (the camera, body-local): pass it in the gallery.
- No uniform, chunk or call of A, B, D or E changed. `makeKitMaterial` in the lab is unchanged.
- **Branches (second P6 commit).** The flora chunk gained `pcPhysBranch` and two uniforms
  (`uPhysBranchPhase`, `uPhysBranch`, both in `physics.fields.flora.uniforms`, copy them with
  the rest). Nothing changes until you call it: one line, A below.
- **Drifts (second P6 commit).** `physics.fields.drift`: F below. Nothing changes until you read it.
- Two fixes you will see: rain, snow, dust and splash rings now lie on the curved ground far
  from where the session started (they floated up to 18 m over it), and it rains over deep
  water (the weather entered 18 m over the sea BED, so over a sea deeper than that it fell
  under the surface and nothing showed).

### A. Plants in the wind (wired by your predecessor in `1e1801e`; one cheap improvement open)
- Three fields, `physics.fields.flora`: `.bend` (32x32 RGBA: RG soft-plant load east/north, BA
  stiff-plant load; 8 m cells), `.wind` (32x32: RG wind at 2 m in m/s, B gust 0..1, A turbulence
  m/s), `.push` (64x64, 0.5 m cells: RG push load, B flattened 0..1, A shaken 0..1). Re-upload
  bend and wind when `.version` changes (every frame), push when `.pushVersion` changes.
  `.uniforms` holds plain arrays for `uPhysAnchor, uPhysEast, uPhysNorth, uPhysUp, uPhysWindMap,
  uPhysNearMap, uPhysWave, uPhysWavePhase, uPhysShape`: copy them each frame.
- Shader: `physics.glsl.flora` above `main()`; per plant ROOT (body-local): `vec4 pb =
  pcPhysBend(rootB, uStiff);` then `wp = io + pcPhysDisplace(wp - io, normalize(rootB),
  heightInMetres, pb.xy);`. `uStiff` 0 grass, ferns, flowers; 0.35 bushes; 1 trees.
  `pcPhysBendLite(rootB, uStiff)` (returns the vec2 bend) is the one-lookup version: wind
  response only, for mid and far tiers. `pb.z` flattened, `pb.w` shaken (for leaf flutter).
- **Open, cheap: fewer fetches.** Today the chunk blends four texels by hand: 12 fetches a
  vertex (4 for Lite). Upload the three fields as `THREE.HalfFloatType` (convert with
  `THREE.DataUtils.toHalfFloat` on upload: 12 k values a frame) with `LinearFilter` and
  `ClampToEdgeWrapping`, and put `#define PC_PHYS_LINEAR` in front of the chunk: **3 fetches a
  vertex, 1 for Lite**. 16-bit float textures filter in every WebGL2. `physics-lab.html?linear=1`
  does exactly this (functions `tex` and `upload`); measured against the JS model it is as
  exact as float32 (2.5 mm on a tip displaced 2 m).
- Still unseen by anyone in the game: grass parting round the explorer and under the ship's
  wash. The push field is live (370 cells pushed on a short walk in the browser).
- **New in P6, one line: crowns that do not sway as one piece.** A tree's branches swing two
  to four times faster than its trunk and out of step with each other. For trees and tall
  shrubs near the eye, between `pcPhysBend` and `pcPhysDisplace`:
  ```glsl
  vec3 rel = wp - io;
  rel += pcPhysBranch(rel, up, heightInMetres, rootB, pb);   // pb: the vec4 pcPhysBend returned
  wp = io + pcPhysDisplace(rel, up, heightInMetres, pb.xy);
  ```
  and copy two more uniforms from `physics.fields.flora.uniforms` each frame:
  `uPhysBranchPhase` (vec4) and `uPhysBranch` (vec4). No new texture, four sines and an atan
  a vertex. Nothing moves at the trunk, the tips most (a 3.5 m branch: about 10 cm in a
  fresh breeze, half a metre in a storm, at 1 to 2.5 Hz); the motion is continuous all the
  way round the trunk (whole lobes), so a crown mesh is never torn; each tree has its own
  phase. A crown that the explorer brushes or the ship's wash hits shivers (`pb.w`). The
  chunk compiles inside your plants today (painted lab); nobody has seen it move.

### B. Weather for the sky and the sheet: `physics.here.sky` (numbers) and `physics.here.weather` (detail), every frame, free
- **Start here: `physics.here.sky`**, eleven numbers 0..1, continuous in time, no meteorology
  in them: `cloud` (paint cloud over the blue), `overcast` (dim and cool the light, soften
  shadows), `haze` (multiply your clear-day fog distance by it), `fog` and `dust` (what the
  lost view is lost to: grey water, or dust to tint with the ground's colour), `wet` (darker
  ground washes), `snow` (leave the paper white), `rain` and `snowfall` (how much is falling,
  liquid and frozen), `storm`, `flash` (lightning now: bare paper). PILOT may hand the same
  object to `setMood`. At the spawn with the default seed they run: fair `cloud 0.15`,
  minute five `cloud 0.83, overcast 0.38`, the storm `overcast 0.95, rain 0.92, haze 0.36,
  wet 1.0`, after it `cloud 0.13, haze 0.47 (mist), wet 0.93`. The rest of this section is
  the detail behind them.
- `cloud01` (cover; 0 once the camera is above the deck), `cloudBelow01`, `storm01`,
  `front01` (a gust front passing).
- `visibility01`: multiply your clear-day fog distance by it. May fall by up to 5 %/s at a
  fog bank and 8 %/s at a snow squall; low-pass it in the sky if that reads as a pop.
- `fog01`, `dust01`, `haze01`: **the share of the view each veil takes by itself** (with only
  fog in the air, `visibility01 = 1 - fog01`; 0.5 is 5 km of visual range, 0.78 is 1 km, 0.9
  is 200 m). Use them to tint, not to set distance (that is `visibility01`).
- `wetness01` (darker, wetter ground washes; lingers after rain, dries faster in sun and
  wind), `snowDepth` (m), `temperature` (K).
- `precipitation`: `type` (`none | drizzle | rain | snow | ice | acid | frost`),
  `intensity01` (continuous), `rate` (mm/h), `hail01`, `reachesGround01` (Venus: under 1
  means the streaks evaporate overhead).
- `lightning.flash01`: brightness now, 3-4 strokes inside a quarter second (bare paper
  showing through); `lightning.last` is where it struck (unit direction, distance).
- `kind` is a word for a read-out (`thunderstorm`, `mist`, `dust storm`, ...); `intensity01`
  is how much weather there is, continuous. Do not drive paint from `kind`.
- Far storms: `physics.util.cellsAt(bodyId)` -> `[{ x, y, z (unit centre), r (m), w
  (strength), kindId }]`: paint the dark ones where it rains. Wind for cloud drift:
  `physics.air(bodyId, p, out, heightAboveGround).wind` (faster aloft; `physics.here.air.wind`
  at the focus).

### C. Rain, snow, dust, marks: the draw kits (`src/physics/three/`)
They follow your material contract (your notes, "For PHYSICS: what a draw kit's material must
do"): one opaque pass, no blending, holes by `discard`. Each kit hands your factory a
**vertex chunk that defines `vec3 pcKitPosition()`** plus three varyings.

```js
import { createPhysicsKits, SHAPE_GLSL, DRAW_PAINTED } from '../physics/three/index.js';   // the only folder of mine that imports three
const kits = createPhysicsKits(physics, { makeMaterial, weather: { draw: DRAW_PAINTED } });   // once
// every frame, after physics.update and after PILOT has placed the body roots:
kits.update(bodyRootOf(physics.here.bodyId), camera, painter.info.internalHeight);   // INTERNAL pixels: the floor is yours
```
`makeMaterial(kind, info)` is yours. This one is **proven in your real pipeline** with your
public exports only (`makePaintUniforms`, the three chunks from `src/render/index.js`, both
render targets, your post pass; `physics-lab.html?painted=1`, source
`src/physics/three/painted-lab.js`, function `makeKitMaterial`). Lift it as it stands:
```js
import { makePaintUniforms, bindBodyUniforms, VERT_PARS, VERT_END, FRAG_PARS } from '../render/index.js';
import { SHAPE_GLSL } from '../physics/three/index.js';
function makeKitMaterial(kind, info) {
  const m = new THREE.ShaderMaterial({
    // everything FRAG_PARS declares, lit and hazed like the body, plus the kit's own uniforms
    uniforms: makePaintUniforms(world.bodyUniforms(bodyId) || undefined, {
      uColor: { value: INK[kind] },            // Vector3: the kind's own ink (rain, snow, leaves ...)
      uPcInk: { value: palette },              // 16 x Vector3: your ink for each ground material, by its number
      ...info.uniforms }),
    vertexShader: `${VERT_PARS}\n${info.vertexChunk}\nvarying vec3 vView;
      void main() { vec4 mv = modelViewMatrix * vec4(pcKitPosition(), 1.0); vView = mv.xyz;
        gl_Position = projectionMatrix * mv; ${VERT_END} }`,
    fragmentShader: `${FRAG_PARS}\n${SHAPE_GLSL}\nuniform vec3 uColor; uniform vec3 uPcInk[16];
      varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView; varying float vPcMat;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)] : uColor;   // the ground it came from, or its own
        ${FRAG[kind] || FRAG[info.shape]}      // cuts the hole (discard), sets vec3 c (from ink) and float w
        c = pcAtmos(pcTone(c, 2.0), pcFogAmount(length(vView)));
        pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${info.region.toFixed(1)});
      }`,
    side: THREE.DoubleSide, polygonOffset: info.shape === 'mark' || info.shape === 'ring',
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  return m;                 // if the body's uniforms were not there yet: bindBodyUniforms(m, world.bodyUniforms(bodyId)) once they are
}
```
`FRAG` is one line of GLSL a shape (the lab's are in `painted-lab.js`: a tapering stroke, a
round dab, a flake with a ragged edge, a ragged dry-brush puff cut from `uNoise3D` at two
scales, a ring, a print thinned through `uNoise3D`).

**Ink (new in P5).** Every loose particle and every mark says what ground it came from:
`vPcMat` is an index into `physics.data.MATERIAL_IDS` (`grass, soil, litter, mud, sand, dust,
gravel, rock, snow, ice, ash, glass, crystal, moss, bed`, numbers 0 to 14), or 255 for what
did not come from the ground. Kicked dust, blown sand, scour, spray (it says `bed`: tint it
with your liquid) and every footprint, pad print and scour dish carry it; snow and mud are
named as the weather makes them (a print in 4 cm of fresh snow says snow). Storm dust says
`dust`: the world's own. Make a palette of 16 colours a biome (the lab takes the biome's
three `ground` washes from `looks.js`, leaves snow and ice near paper and deepens mud) and
the brown blot on the forest floor is gone: dust is the colour of what it was kicked from,
a print is "this ground, darker" (`ink * 0.66`), its rim the same ground diluted.

**What survives your post pass (new in P5).** The kits do this themselves now; you only say
how large the least mark is (`minPx`, in your internal pixels: 3 or more):
- A mark that the floor makes f times larger than it is stands for f (streak) or f^2 (dab)
  of its kind, and only that share is drawn: far air holds fewer, larger marks (art bible 4).
  Which ones is a number each particle keeps for life; a mark shrinks smoothly to nothing as
  its turn passes (measured: under 0.25 px a 5 cm step), so nothing pops or twinkles.
- The physics says how much of a sight line each kind hides (`precipitation.extinction`,
  `dustExtinction`, per metre). The floor thins a kind only where its marks would hide more
  than that. `kits.weather.stats.cover.<kind>` is the share the marks paint: storm rain
  0.66, a blizzard's flakes 0.03 to 0.55, storm dust 1. **What is missing from 1 is veil, and
  the veil is yours** (E below).
- Snow (changed in P6). Single flakes only read near the lens, so the physics simulates the
  2000 it carries in a box 16 m across round the EYE (PILOT passes the camera as `frame.eye`
  to `physics.update`; in the gallery pass it yourself: `eye: cameraPositionBodyLocal`; without
  it the box is round the focus). Each flake lands on the ground it is over, is caught by the
  crowns it is under and stopped by the hull, and rides the air up and down slopes. The kit
  shows the box modulo itself round the camera it is given, so nothing changes for you; `cell`
  in the draw table is rounded to a size that divides the box (9 becomes 8). Flakes are drawn
  out along their motion (`exposure`, `smear`), differ in size (`varySize`), and are never
  larger than `maxPx`.
- **Nothing pops or strobes (new in P6; measured, numbers under Status).** Every particle
  carries `left`, the seconds until it is gone, and the kits shrink a mark to nothing over its
  kind's `fadeOut` (dust 0.7 s: a 2 m billow no longer vanishes between two frames; snow 0.3 s;
  rain 0.08 s: a stroke thins to a point over its last 40 cm). A dab is drawn out at least as
  far as it travels in a frame (`strobe`, the frame time, 20 ms), so driving snow is slanted
  strokes that overlap from frame to frame; one that would have to be more than `streak` (3)
  sizes long is a hairline and shrinks away (gone at 4.8). Nothing is drawn nearer the eye than
  0.4 of `near` (snow 3 m, dust 2.5 m). You need do nothing: the defaults are in `DRAW`, and
  `DRAW_PAINTED` inherits them.
- Dust in a storm is sized from the dust in the air (up to `sizeMax`; say what share of its
  quad your puff inks with `fill`): 2 m billows where there were 0.5 m blots.
- The set for your pipeline (`DRAW_PAINTED`, exported from `src/physics/three/index.js` since
  P6; it was a constant inside `painted-lab.js`): rain 7 cm wide, 140 ms
  exposure, floor 3 px; snow 10 cm, floor 4 px, ceiling 10 px, exposure 40 ms, smear 1.2,
  varySize 0.4, cell 9; dust 0.5 m growing 0.35 m/s, floor 8 px, ceiling 80 px, sizeMax 2.6,
  fill 0.3, exposure 120 ms; hail 5 cm; sand 3.5 cm; spray 4 cm; ash 9 cm; spores 5 cm;
  leaves 10 cm.

The rest of the contract:
- `pcKitPosition()` returns the vertex in the mesh's own coordinates: body-local axes, metres,
  relative to the mesh, which the kit parents under the body root you pass and places at a
  body-local point (C3). Multiply by `modelViewMatrix` as for any mesh.
- `vPcUv`: 0..1 across the quad. `vPcData`: per kind, below (also in `info.data`). `vPcMat`:
  above (declare it in the fragment only if you read it). `info.inked` says whether the kind
  can carry a material at all.
- `info.region`: my suggestion for your region id (2.x rain, hail, spray, snow, rings; 1.x
  marks, dust, sand, ash; 4.x leaves, spores). Yours to change.
- Nothing needs blending: particles are born small, grow in, shrink to nothing at the edge of
  the simulated volume (24 m) or of their cell and over their last moments; shapes inside a
  quad are cut with `discard`.
- Budget (PILOT's conditions): at most 12 draw calls for all kits (one per kind that has
  anything in the air, rings, marks) and, with every buffer full at the highest quality, 31 k
  triangles; typical: a downpour 3 to 5 calls and 3 k triangles, a blizzard 4 and 3.6 k, fair
  weather 0 to 2. The kits set no `renderOrder`: draw order is yours. Meshes are not
  frustum-culled. CPU per frame in Node: a downpour 0.07 ms, 2000 flakes 0.13 ms, marks 0.06
  ms only when one is added; `expand: 'gpu'` (instanced straight from my buffers) a third of that.

The kinds, and what `vPcUv` / `vPcData` mean:
1. **Streaks: `rain`, `hail`, `sand`, `spray`**. A quad per particle; `vPcUv.x` across,
   `vPcUv.y` 0 at the head (where the drop is) to 1 at the tail (where it was one exposure
   ago *relative to the camera*: run and the rain slants at you). `vPcData.x` a shade
   1 - vary .. 1 that stays with the particle. A stroke: `if (abs(vPcUv.x - 0.5) * 2.0 >
   1.0 - 0.75 * vPcUv.y) discard;`.
2. **Dabs: `snow`, `dust`, `ash`, `spores`, `leaves`**. Quads facing the picture plane; a
   round dab is `if (length(vPcUv - 0.5) > 0.5) discard;`. Dust grows with age (a puff
   spreads), leaves and ash turn, snow and dust are drawn out along `vPcUv.x` by their motion.
3. **Instanced variant** (`weather: { expand: 'gpu' }`): one quad, instanced; the instance
   attributes are my arrays themselves (no copy). Same `pcKitPosition()`, same varyings, with
   `vPcData` = (shade, age s, grain size m, speed m/s); needs `info.uniforms` in the material
   (the kit keeps them current; P6 added `uPcDraw3` there and the instance attribute `aPcLeft`
   in the geometry: nothing to do if you spread `info.uniforms` as the example does). Take
   this one for the final weather; take the cpu one today.
4. **`ring`**: the splash of a drop, the ripple it leaves on liquid, the puff where a flake
   settles, a hailstone's bounce: flat on the ground, growing with age. `vPcData` = (kind 0
   splash / 1 ripple / 2 settle / 3 bounce, strength 0..1, age 0..1, drop size m).
   `SHAPE_GLSL`: `pcPhysRingCover(vPcUv, vPcData.z)`; `discard` under about 0.2. (Erased by
   your post pass at any distance I tried; they want a region id that is kept crisp.)
5. **`mark`** (`kits.marks`): footprints, the ship's three gear pads, scour dishes: a quad
   laid on the ground (follows the slope near the focus), 15 mm above it: give the material
   `polygonOffset`. `vPcUv.x` across, `.y` along the direction of travel; `vPcData` = (depth
   m, rim height m, kind 0/1 feet, 2 pad, 4 scour dish, fade 1..0 over its life); `vPcMat` the
   ground it was pressed into. `SHAPE_GLSL`: `pcPhysMarkCover(vPcUv, vPcData.z)` (a boot's
   outline or a disc) and `pcPhysMarkRim(...)` (the raised edge on sand, snow and dust).
   Fade without blending: `discard` against your noise (the lab does; fixed in the mark).

What the kits do not draw: the sea (D), lightning (B), dust devils as columns
(`physics.features.devils`: foot `p`, `radius`, `height`, `strength`; their dust and sand
are in the particle kits), the sky and every veil (E).

### D. The sea: waves, crests, foam and wakes in your own liquid material
There is no kit for the sea any more (the patch is off by default: a second surface laid
over yours fights it; frame `painted-neptune-sea.jpg`). The delivery is a chunk for
`makeWaterMaterial`, usable in the vertex stage, the fragment stage or both:
```glsl
${physics.glsl.water}                                   // paste above main(); shares uPhysAnchor/East/North/Up with the flora chunk (guarded)
// vertex: lift the surface and keep the body-local point for the fragment stage
vec2 along; vec3 w = pcPhysWaterD(bodyLocalPos, along);  // w = (height m, dh/deast, dh/dnorth)
bodyLocalPos += normalize(bodyLocalPos) * w.x;
// fragment (#define PC_PHYS_NO_WAKE before the chunk if the 16-step wake loop is too dear there):
vec2 along; vec3 w = pcPhysWaterD(vBody, along);
vec3 n = pcPhysWaterNormal(w, normalize(vBody));          // body-local unit normal
vec3 strokeDir = pcPhysWaterDir(along);                   // body-local: the way the crests lie here: run your strokes along it
vec2 cf = pcPhysWaterCrest(w);                            // x crest01: the tops of the higher waves (leave the paper bare)
                                                          // y foam01: the sea is breaking here (whitecaps: paper, ragged)
float surf = pcPhysWaterSurf(yourDepthUnderTheSurface);   // 0..1: the waves break in the shallows (the white line at a shore)
```
- Uniforms, from `physics.fields.water.uniforms` every frame: `uPhysWaterDir` vec2,
  `uPhysWaterK`, `uPhysWaterAmp`, `uPhysWaterPhase`, `uPhysWaterGroup` vec4, **`uPhysWaterSea`
  vec4 (new)**, `uPhysWake` vec4[16] (a Float32Array(64): give it to three as it is),
  `uPhysWakeG` float; plus the frame uniforms `uPhysAnchor, uPhysEast, uPhysNorth, uPhysUp`
  (`physics.fields.flora.uniforms` has them).
- What you get: a wind sea whose height, length and direction follow the wind, the fetch of
  the biome and the world's gravity and air (Neptune's methane runs higher than water); short
  crests in sets (no ruled lines from the air); rings behind a swimmer and under the ship's
  thrusters (on calm water a ring's crest reads as `crest01` = 1: a broken ring of paper).
  Crests: `crest01` is over a half on about a seventh of the sea. Foam: the share of the
  surface that is white follows the wind as measured at sea (1.6 % at 10 m/s, 5 % at 15, 9 %
  at 20; none in a breeze) and sits on the highest crests, in patches that travel with the
  sets. A wave breaks where the liquid is shallower than 1.28 wave heights: `pcPhysWaterSurf`.
- The chunk and its JS twin agree to 0.06 mm in a real GL context (Status). The explorer
  floats on `physics.fields.water.heightAt(p)`: the same surface.
- Liquids by place: lava in `lava_rivers` (barely any waves: 2.6 times water's density),
  cloud froth in `gold_islands` and `sky_islands` (billows high and slow).
- Cost: nothing on the CPU but the uniform update. On the GPU 16 `sin`/`cos` a call for the
  four trains (not measured on a real GPU); the wakes are a 16-step loop: leave them out of
  the fragment stage and of far water.

### E. What each weather still needs from you, by number (`physics.here.sky`, or `setMood.sky`)
The kits paint the near marks. Everything below is a wash, a veil or the light, and no kit
can paint it (an opaque pass cannot glaze). Each line names the number that drives it.
| Weather | What the kit paints | What is yours, and the number |
|---|---|---|
| Rain | broad slanted strokes (`cover.rain` about 0.66 in a storm), splashes on the hull | `overcast` (dim and cool the light, soften the shadows: the storm is sunlit today), `cloud` (the sky wash), `wet` (darker, wetter ground washes; lingers after), `haze` (far layers close in), `rain` (wet-in-wet softening of the far layers) |
| Snow | paper-white flakes near the lens (`cover.snow` 0.03 to 0.55) | **`snow`** (the ground left white: at 1 the meadow is still green today), `haze` (0.18 to 0.25 in a blizzard: the far hill should be gone), `snowfall` (the veil between: the missing share of `cover.snow`), `overcast` |
| Dust storm | ragged billows in the dune's own ink (`cover.dust` 1) | **`dust`** (0.84 to 0.9: tint the haze with the ground's colour), `haze` (0.10 to 0.16: beyond the billows the sky and the far dunes are clear today) |
| Fog, mist | nothing | `fog`, `haze` |
| Lightning | nothing | `flash` (bare paper for one to three frames), `storm` |
| The sea | nothing | D above: `uPhysWaterSea` and the chunk; `physics.water(bodyId, p).whitecapCover` for far water |
| Prints | prints, pads, scour rings in the ground's ink | nothing needed; a region id that is kept crisp would bring the rain rings back |

### F. Drifts: where the snow lies deep and where the wind has swept the ground bare (new in P6)
Wind does not leave loose snow or sand lying level: it piles in the lee of every rise, in
hollows and behind a landed hull, and is scoured from windward faces and crests. The physics
keeps this on the grid of the ground marks (64 x 64 cells of 0.5 m round the focus):
- `physics.fields.drift.factor` (Float32Array(4096), one channel; re-upload when `.version`
  changes: a few times a second in a gale, never in a calm): how much loose material lies at
  the cell in units of what lies on level ground here. 0 level, +1 twice as deep (up to
  +2.5), -1 blown bare.
- `.level`: that level depth now in metres (the snow depth of `physics.here.weather`, or on
  bare sand and dust a loose layer of up to 0.12 m); `.snow`: true when what drifts is snow.
  `.uniforms.uPhysDriftMap` (centre east, centre north, 1 / size, 64: the same layout as
  `uPhysDeformMap`) and `.uPhysDriftLevel`.
- What to paint with it: with `sky.snow` at s, a ground wash whose snow cover is
  `s * (1 + factor)` clamped: bare ground showing on windward faces and crests, white filling
  the hollows and tailing off behind rocks, which is how a snowy hillside is drawn. On sand:
  a paler, smoother wash where `factor > 0` (the tail), the darker bed where it is negative.
- It is where it was when the walker comes back (it is a function of the ground and the wind
  that last moved material), it melts with the snow and deepens with the next fall, and the
  explorer sinks deeper in it (his prints say so). On level ground it is zero; over standing
  liquid (a pool on a terrace, the sea, a cloud sea) it is -1: nothing lies on water.

## For PILOT: what audio can read (all in `physics.here`, refreshed every frame, free)

- Rain: `weather.precipitation.intensity01` (continuous), `.type`, `.rate` (mm/h), `.hail01`;
  what it falls on: `cover.canopy01` (leaves overhead) and `physics.water(...).present`.
- Wind: `air.speed`, `air.gust01` (0 lull .. 1 gust, travelling), `air.turbulence`; in the
  crowns: `physics.air(bodyId, p, out, canopyHeight).speed`.
- Thunder: `weather.lightning.thunderIn` counts down in seconds and goes negative at the bang
  (the delay is distance over that air's speed of sound); `thunder01` is its loudness from
  then on (decays over 6 s, quieter with distance); `last.distance` (m), `last.t`; `flash01`.
- The ground underfoot: `st.phys.material`, `speedGround`, `slip01`, `sink`, `impact`
  (landing speed), `submerged01`; the ship: `st.phys.downwash.thrust`, `gLoad`, `fieldBrake`,
  `legLoad`, `buffet`.
- The sea: `physics.fields.water.field.height` (significant wave height), `period`, `whitecap01`.
- No air, no sound: `air.density` is 0 on Mercury and the Moon, and `air.soundSpeed` is there
  for pitch (1210 m/s in Jupiter's hydrogen).

## Lab: `physics-lab.html` URL parameters

(P13) `descent=<m/s>`: the explorer's descent held to one speed (default: PILOT's law, as the game commands it). The stand-in figure has two legs and boots placed by `st.phys.feet` under hips at `st.phys.ride`; `legs=0` is the one-piece capsule.

**Painted lab, P10:** `kits=painter` (default: the world's own kits and PAINTER's materials, the game's picture)
| `kits=lab` (this page's stand-in materials alone) | `kits=0`; with `kits=lab`: `glaze=0` (dust, sand and
leaves back in the painting as cut marks), `figure=<0..1>` (flakes in a shadow tone over fresh snow).
`info()` also returns `seaState { Hs, cover, breaking, length }`, `u10`, `blown`, `kitMode`.

`scene=` `flora` (default) | `wind` | `rain` | `snow` | `storm` | `explorer` | `ship` | `globe`;
`body=` any body id; `world=` `flat` | `hills` | `slope` (`&slope=14` degrees) | `stub` (PILOT's) |
`real` (PAINTER's); `ground=` a biome id for the synthetic worlds; `find=` `gale` | `calm` |
`rain` | `snow` | `thunderstorm` | `dust` | any `weather().kind`; `t=` start time (s); `speed=`;
`seed=`; `quality=`; `fixed=1` (advance 1/30 s per rendered frame) with `fast=N` (N of those
per frame); `jet=0`, `walk=0` or `walk=<m/s>`, `explorer=0`, `flora=0|1`, `trees=<density>`,
`arrows=0`, `grass=<height m>`, `sea=<depth m>`, `wind=<m/s>` (steady wind on the bodies only);
`alt=<m>` raises the synthetic ground (Venus mesas); `find=devil`; `linear=1` (half-float
textures + hardware filter + `PC_PHYS_LINEAR`); **`planet=`** `mercury` | `moon` | `venus` |
`venus-mesa` | `mars` | `mars-storm` | `jupiter` | `jupiter-globe` | `saturn` | `saturn-globe` |
`uranus` | `neptune` | `neptune-globe` | `pluto` (a preset per world; any other parameter in
the URL wins over it); camera `yaw=`, `pitch=` (degrees), `dist=`. `window.__lab.info()` and
`window.__lab.shaderAgreement()` return state for `--eval`. With `sea=` the liquid surface is
drawn by the wave chunk (blue) with the JS twin as red dots.
Example: `node tools/shot.mjs "/physics-lab.html?scene=ship&fixed=1&fast=3" out.png --w 960 --h 540 --shots 7 --every 2600`.

## Decisions

1. **Real values, game scale, stated once each.** Gas properties, friction, fall speeds are
   real. Three things are scaled for a 4 km planet and each lives in one named place: the
   vertical scale of the atmosphere (`SCALE_HEIGHTS` 2.5 per atmosphere height), the giants'
   winds (`WINDS[body].scale`), and weather time (`WEATHER.timeScale` 60: a real hour of
   drying or snowfall takes a game minute, matching the 25-minute day).
2. **The giants' surfaces sit at real pressure levels**: Jupiter 6 bar / 290 K (under the
   water clouds, so its storms rain water), Saturn 10 bar, Uranus 2 bar / 90 K (methane snow),
   Neptune 3 bar / 95 K (methane is liquid: its seas and its rain).
3. **Forces, never velocity clamps.** Every limit is a force with a name (friction circle,
   leg power, thrust, drag, retro thrust). Assists are forces too (`descentLimit`,
   `jetMaxRise`, `assistAccel`, `carve01`) and are off unless PILOT commands them.
4. **Stiff things are integrated exactly or implicitly** (oscillators in closed form,
   quadratic drag as v / (1 + k v dt)), so 20 Hz and a 0.25 s hitch are as stable as 60 Hz.
5. **One wind.** A 17 x 17 grid (16 m) around the focus is rebuilt every frame; flora,
   particles, the explorer's wind load and the ship's buffeting all read it.
6. **Weather has no stored state.** Cells, lightning, wetness and snow are functions of time
   (wetness and snow as integrals over the past 47 minutes of that function), so any place can
   be asked about any time and a teleport needs no catching up.
7. **A walker does not spin their feet.** The legs push only as hard as the ground holds
   (traction control); `slip01` is for real slides, `scramble01` for wanting more grip.
8. **Sliding bodies dig in** (`arrest` 0.85 of holding traction), so a 55 degree slope is slid
   at a few m/s for the first seconds instead of in free acceleration.
9. **The suit floats in any liquid** (`floatAssist`), because a person sinks in Neptune's
   methane (450 kg/m3). The trim only engages near float depth, so wading keeps its traction.
10. **Ice friction depends on temperature** (0.06 at 272 K, 0.55 below 200 K): Earth's
    glaciers are treacherous, Uranus' 90 K ice grips like rock.
11. **The near field re-anchors without dropping anything**: every 384 m the frame moves to
    a point of the shared 16 m lattice and all grids are renumbered in place.
12. **sampleSurface is rationed**: 8 calls a frame at quality 1 (4 / 12 at 0 / 2), three times
    that while a cache is mostly empty, and never more than 0.35 ms per grid.
13. **Default seed 18**, chosen at PAINTER's real spawn: fair for the first minutes, then
    weather you can see coming and that comes (wiring step 8 for PILOT; a test pins it). The
    old 14 gave drizzle at twelve minutes at best.
14. **What falls is three continuous shares** (liquid, solid, frost), never a type switch, and
    a cold system snows 35 % of the water it would rain (cold air holds less vapour).
15. **A bank of fog or dust thickens so that the visual range closes in steadily** on the way
    in, and a system's edge is as wide as the distance it drifts in 30 s (turbulent mixing
    smears a travelling edge). Both are choices about the shape of a bank; the extinction law
    (Koschmieder) is untouched.
16. **Liquids belong to places**: lava in `lava_rivers` (2600 kg/m3, 100 Pa s: you float high
    and wade at under 1 m/s, the jetpack lifts you out), and the cloud seas of `gold_islands`
    and `sky_islands` are a froth of 120 kg/m3 that carries the trimmed suit and barely drags.
    A real cloud carries nobody; PAINTER declared them liquids, PILOT's ship treats the deck as
    a floor, and an explorer who fell through to a bed a hundred metres under their ship would
    be trapped in all but name. So: froth, by name, in one table (`BIOME_LIQUID`).
17. **The sea is already running when you arrive** (it follows the wind within 1.5 s for the
    first moments at a new place, then with a 25 s time constant), and when the waves lengthen
    or turn the pattern pivots about the watcher, not about the field's origin.
19. **What a snow squall front really does, and why I leave it at up to 8 % a second.** A
    squall is a narrow band of heavy snow on a sharp wind shift. What defines it for a
    forecaster (the US snow squall warning) is visibility dropping to a quarter of a mile or
    less, and what makes it dangerous is how fast: from kilometres to a few hundred metres
    in about a minute or two as the band crosses at 10-15 m/s. In `visibility01` (the square
    root of range) that is a fall of 0.5 or more in 60-120 s, about 0.5-1 % a second on
    average and several times that at the leading edge. Mine on Earth peaks at 4.7 %/s: the
    hard end of real, not beyond it. Uranus' 7.8 % is the same band carried at 14.5 m/s
    instead of 9; the giants' weather is quicker than Earth's because their winds are, and
    that is their character. If the lead's 5 % is to hold on every world, the knobs are
    `WEATHER.passTime` and `WEATHER.edgeTime` together (40 and 30 s): 64 and 48 make every
    fast system 1.6 times larger and its edge 1.6 times slower, which by the scaling of the
    edge puts Uranus at about 4.9 % (computed from the scaling, not yet run).
20. **A material's number is its place in `MATERIAL_IDS`**, and what a particle or a mark
    carries is the ground as the weather has made it (snow once 3 cm lie, mud when soaked,
    ice when glazed), named by the same rules as `groundAt` (`materialNow`, held to it by a
    test). Dust carried in by a storm is the world's dust, not the ground's.
21. **Whitecaps follow the steepness of the sea, not the wind directly**, so the law holds on
    other worlds: cover = 0.15 whitecap01^1.8, which over the game's fetches is within a
    factor 1.7 of Monahan and O'Muircheartaigh's 3.84e-6 U^3.41 from 10 to 20 m/s. The sea
    breaks where it stands highest: the foam is the surface above the level that leaves that
    share above it (a quantile of the four trains in sets, measured once while loading; the
    surface is not Gaussian, its tails are shorter). No foam is left behind a crest: a
    painter may smear it against `along`.
22. **The cover of the marks is what the physics says the kind hides, never more.** The
    weather gives each kind an extinction per metre; a kit may enlarge marks to survive the
    post pass until they would hide more than that, and thins them beyond. Where the marks
    hide less (snow: 3 to 55 %), the rest is veil, and the kit says how much.
23. **Snow is shown modulo a cell round the eye.** A snowfall is the same everywhere within
    48 m, so which periodic image of a simulated flake is drawn is a choice of sample, as is
    the simulation's own wrapping of its box round the focus. Every flake still falls, drifts
    and flutters on its own simulated path. Not done for rain: a drop's fate under leaves is
    decided where it really is.
18. **PAINTER's `phys: { ground }` is a family, my table keeps the finer word**: rock may stay
    glass or crystal. A test compares every override; two disagreements are on record (below).

24. **(P6) A mark never ends between two frames.** Every particle carries `left`, the seconds
    until it is gone (its life, or its landing foretold from the rate at which its height
    over the ground is closing, never slower than it is falling), and the kits shrink it
    over its kind's `fadeOut`. The estimate is eased over 0.15 s because the ground is rough.
25. **(P6) Snow is simulated where it is seen** (replaces 23's reasoning, keeps its display):
    in a box 16 m across round the eye (`frame.eye`; the focus when none is given), so every
    flake lands on the ground it is over. The kit still shows the box modulo itself round
    its own camera, which is the identity when the two eyes agree. The cell always divides
    the box. Powder kicked from lying snow is never wrapped (it is where the foot is).
26. **(P6) Flakes ride the air over the ground.** The air's vertical speed where a flake is
    equals the rate the ground changes along its path, at every height of the 18 m it falls
    through (the box wraps, so a slope across it is a slope without end, and over that the
    air runs parallel to the ground). The flake follows through its drag. Rain does not: it
    falls six times faster and its box is 48 m.
27. **(P6) Particles live on the curved ground.** The simulation's coordinates are (grid x,
    height over the sphere of the anchor's radius, grid z); published positions are at that
    radius on the line through the grid point, velocities turned to the local vertical to
    first order. A plane was wrong by d^2 / 2R.
28. **(P6) Dabs are drawn out to their travel a frame, and no further than three sizes.**
    Strobing (a mark that crosses more than its length a frame) reads as flicker; a hairline
    is not a flake. Between them is the slanted stroke of driving snow.
29. **(P6) Branches are a spectrum, not a field.** Four oscillators on the clock (1.3 Hz x
    1, 1.37, 0.71, 1.93), their phase turning round the trunk in whole lobes and from tree to
    tree; the swing follows the trunk's own lean (which carries the local wind, the shelter
    and the gusts) times how gusty the air is, plus the shake of the push field. No new
    texture and nothing integrated per tree: at branch scale what matters to the eye is that
    parts of a crown are out of step and faster than the trunk, and both are exact here.
30. **(P6) Drifts are an equilibrium, not a simulation.** The factor field relaxes toward a
    function of the ground, the hull and the last wind that moved material: deposition by
    Winstral's upwind shelter Sx, scour by the ground's rise into the wind. Not conserved
    (what is scoured is not what is deposited); in return it is the same when the walker
    comes back, costs a quarter of a millisecond, and cannot run away.
31. **(P6) The carve assist is a force and has a size.** It reports the sideways
    acceleration the field gives and can be bounded by the caller. The default stays
    unbounded: the feel of a turn is PILOT's.
32. **(P6) The weather enters over the surface it meets**: the ground, or the liquid standing
    over it at the focus.
33. **(P16) The sea is raised over the water that is there** (the coordinator's ruling): the fetch measured upwind
    from a water point over the world's liquid (the mean of five radials over 24 degrees, SPM 1984), capped by the
    biome's fetch, and the waves limited by the mean depth along it. The biome's fetch is only how far the open water
    runs beyond what is measured.
34. **(P16) No import cycles in the physics** (held by `load.test.mjs`): a module that reads another's export at load
    time inside a cycle breaks for some entry orders, and the browser's order is not the tests'.
35. **(P16) A face the explorer must clamber is seen coming.** Within the 0.3 m measure the pace over it is bounded by
    the hips (about 2.75 m/s for 1 m on any world), so the run's speed above that is shed by the soles, within the grip,
    before the face, not by the face. A bound that kept the run's pace (the energy of the climb only) would break the
    measure: the coordinator's to allow, not mine.
36. **(P17) What the runner must brake for is tried, not guessed.** A hump with a top is read along the path once and the
    body's own step function is run over it (a ghost) at trial paces; the fastest clean crossing less 8 % is the pace to
    meet it at. A fitted law cannot follow every section of every boulder; the body is the law. Rising ground that does
    not come down (hills, ledges) keeps P16's reading. The trials cost up to 0.9 ms in a body step, six steps per feature.
37. **(P17) The hot loops stay optimisable.** Per-particle work lives in methods of one loop (`_move`, `_fall`), calls in
    it pass no numbers (`groundQ` through a scratch array), no `Math.hypot` or `% 1` inside it, and fields that Math.round
    writes start as -0. V8's own tools found each of these (`--trace-deopt`, `%GetOptimizationStatus`, a heap profile
    that keeps collected objects); keep checking them after a change to a loop: the tests measure time only under
    PC_TIMING, and a lost optimisation shows first as garbage and deopts, not as a failed test.
38. **(P17) A step raises no puff from a living sward** (KICK.stepDust 0.05): grass and bare rock give none; the puff is
    the visible part of loose fines, and a meadow has too few to show.
39. **(P18) The sea is raised where it is.** Every node of two levels round the focus (16 m and 128 m apart) has its own fetch
    (eleven radials over the liquid, carried on by a far rose) and depth, and its own wind sea, whitecaps and share of the
    swell. The trains stay one set of waves, those of the most exposed node, scaled per node: a sheltered bay keeps the open
    sea's wavelengths at its own lower height (calm, if not short). Per-node wavelengths would need per-node phases, which a
    continuous surface cannot have without a warp of its own.
40. **(P18) Waves run where they grow most.** The wind sea's heading is the one (up to 60 degrees off the wind) that makes the
    most of U cos(phi) over the fetch that way (slanting fetch); in shallow water it refracts by Snell over the local contours
    and shoals (Ks, Kr); the four trains share one way, the wind sea's and the swell's by their energy.
41. **(P18) A turn of the sea is a warp of where the trains are read**, the least-squares fit of grad(warp) = R(-alpha) - I,
    so that crests stay continuous lines; turns die out at the inner level's edge, and a new warp keeps the crests where they
    were on average. Smoothing a turn that changes within two cells is the price.
42. **(P18) The sub-second eddies live at a point, not on the grid**: Kaimal's spectrum at the point's height, of sigma_u = I
    U10, felt by a receiver of a given size and speed (admittance, encounter frequency). Tests of the grid and the pattern ask
    the air as a receiver larger than every eddy, so they keep testing what they were written for.
43. **(P18) Hot paths hand numbers through arrays** (gustNodes, noise3q, groundQ, nearKnownQ), and a change for speed is
    proved bit for bit by a checksum over a whole run before and after (with a world that is not NaN: check the fields).
44. **(P19) A step's scratch is an argument, not a module's.** Anything a body step writes and reads back belongs to a scratch
    set handed down to every function it calls; a step run from inside another (the ghost) has its own set and never calls the
    outer step's env. A save-and-restore would have fixed review 7's finding 1 too, but only for the two objects it named; the
    next object added to the step would have been shared again.
45. **(P19) What the body reports about its ground is the ground where the step ends**: the step's own forces use the ground
    where it began (an explicit step), the material, friction, sink and dust handed out describe where the body now stands.
46. **(P19) A trial runs from the ground the feature rises from.** The ghost starts on the valley floor before a rise (when the
    profile falls into it first) and on the profile's own height there; the descent before the valley is the last feature's.
47. **(P19) What is shown never steps when a build lands.** Each edge of the band between the sea map's levels moves
    continuously, lying inside every grid that holds what it shows now or in the frame a build lands (the shown one, the one
    being built, any one a build could start on); new nodes start from what was shown at their place and ease; a field read
    across a band is pulled in at the nodes, not at the place, so a fixed place keeps reading its own cell.
48. **(P20) A re-anchor moves nothing that is a point, and moves the grids no more on a small world than on Earth.** Points
    (particles, events, wakes) are carried through the ray of their own ground; the distance is set so that D (D + 30) / R^2
    stays at Earth's 384 m level on every world; the anchor keeps its radius within 2 % of the world's radius. A grid cannot
    follow a projective map by whole cells, so its share is bounded, not removed: 0.3 m 30 m out at a re-anchor.
49. **(P20) What floats rides the sea that is drawn.** The liquid's surface for a body is the water shader's own displacement
    near the eye (the waves, the wake, the swash in the shallows, with the shader's local Hs), and the body's drag in the
    liquid is against the water's own heave (heightAt's time derivative), so a floating body follows the waves as a damped
    body near its heave period does, neither pinned to the still level nor glued to the surface.
50. **(P20) A flight off a crater wall is physics; the 0.3 m rule is about boulders.** A run cannot hold a convex edge
    sharper than v^2 / (g cos theta) (on the Moon about 29 m of radius at 6 m/s on 40 degrees): it leaves the ground, and is
    not thrown up (the body rose 0.009 to 0.017 m in the game's three). With the boulders taken away the same flights happen.
    What a boulder may do is measured with the boulder: 0.172 m thrown at most in the game.
51. **(P20) The sea is there before anyone arrives.** On arrival the sea follows its target quickly until it has been measured
    (a map built with the far rose finished), then slowly (growTime): only a change of wind raises a sea over minutes, never
    the observer.
52. **(P20) Rain rings only where the water is still enough to show them** (the local Hs under 0.1 m all, over 0.5 m none).
53. **(P21) A face pushes along its own normal.** Where the legs cannot fold onto rising ground, they take up only the speed
    into it (legCatch at most); the push across the path is held by the soles within the grip the push gives them (and on a
    hold by the limbs), the speed along the face is kept, up it as fast as the hips may rise and be stopped within the reach
    over the lowest ground ahead, the rest taken by the legs too. Over level ground a run onto a slope keeps v cos^2 of it.
    The whole speed taken at legCatch (P13) was a brace against a wall, at every slope.
54. **(P21) The ground the hips' reach is counted from is never below the ground the feet have stood on.** Carried on at the
    rate the ground was rising when the legs began to work, it may rise with a slope; a descent's rate stops at the floor.
55. **(P21) A raindrop leaves a crown and a ring only in a film of water**: on liquid, on hard ground once it is wet, on earth
    once it is soaked; never on a sward, a forest floor, loose grains or snow. By the material of the ground where it lands,
    as it is now.
56. **(P21) A sea is judged against what its storm can raise in the time it blows.** The coast report's target is the same
    wind history over the reference water by the game's own growth, not the equilibrium of the peak wind; a short squall
    raises no water's full sea. (Decision 51's arrival, which settles to the equilibrium of the wind now, is to follow it.)


## Needs from the others

**P21 (nineteenth agent), current needs.** From PAINTER: one line in your ring shape (`kitmat.js`, "For PAINTER", P21) so that
a snowflake's settle and a hailstone's bounce are not drawn as rings. From PILOT: nothing (the ship afloat is done, `a0e3fb1`, on
`env.waterLevel`: read, and the gear's floor left as you asked).

**P20 (eighteenth agent), current needs.** From PILOT: (1) the classification in `tests/boulderrun.mjs` ("For PILOT", P20: two lines); (2) an answer on the ship landed on water (may its gear heave with the drawn sea?). From PAINTER: nothing new to wire; tell me if WATER_VERT's shoal mix changes (the floating explorer's twin); your look on the splash rings and
the dust of the airless worlds ("For PAINTER", P20). The coast fix (P18 B) is in: both stands pass `coast.mjs`.

**P19 (seventeenth agent), current needs.** From PAINTER: when you wire the sea map (P18 A), copy `uPhysSeaBand` too ("For
PAINTER", P19: two lines in `src/render/shared.js`); without it the chunk's band is empty and the inner level is not drawn. From
PILOT: nothing.

**P14 (twelfth agent), current needs.** From PAINTER: switch branch motion on as "For PAINTER", P14 says: add
`uPhysBranchClock` to `PHYS` in `src/render/shared.js`; give the tree geometry `aBranchId` (one number per branch and its
foliage, -1 on the trunk) and `aLeaf01`; call `pcPhysCrown(rel, up, H, root, pcPhysBend(root, 1.0), fract(aBranchId +
treeHash), aLeaf01)` before `pcPhysDisplace`. From PILOT: nothing new.

**P13 (tenth agent), current needs.** From PILOT (all in "For PILOT", P13): (1) pass `phys.ride` as `hip` and
`stride`, `footDown`, `feet`, `surge`, `crouch01`, `gait` to the figure; (2) footsteps from `phys.steps` /
`phys.footfall`; (3) `rotateY(buf.yaw)` on the drawn hull, and a named gain if it should read in a breeze; (4) a
decision on `cmd.jumpCrouch` (0.12 s now) and on whether the relaxed pace should be a walk by its gait (under
2 m/s). From PAINTER (all in "For PAINTER", P13): (1) legs placed by `feet`, hips by `hip`, no clock of its own;
(2) `pcPhysBranch` wired; (3) leaves as dabs of at least 8 px that flicker; (4) a knee in the swing.

**P12 (ninth agent), current needs.** From PAINTER, on Neptune's coast and any sea (all in "For PAINTER", P12):
(1) the carry distance from the long train's wavelength (`uPhysWaterK.w`) and far vertices displaced by
`pcPhysWaterLong`; (2) a linear shoal factor; (3) the swash from `pcPhysWaterRunup` in the foam mask and at the
water's edge; (4) the hard-edged forms in the storm sky; (5) spray told apart from rain; leaves that can be seen; a
near fade for dust puffs. From PILOT: nothing blocking; see "For PILOT", P12, items 1 and 4.

### From PAINTER

**P10 (details under "For PAINTER", P10):** (1) the dust glaze reads `vPcData.y, .z, .w` (opacity, softness,
veil01) instead of one faint alpha: it is too faint to see now; (2) leaves laid as a glaze or exempt from the
pass that erases thin marks; (3) the skim of blowing sand and snow lifted toward paper and given weight; (4) a
look at why Neptune's far sea shows no swell stroke or white horse at the storm coast when my numbers open the
gate fully (haze, dayness); (5) nothing for snow.
0. In this order ("For PAINTER", E): the sky, the haze and the ground wash reading
   `setMood.sky` (`overcast`, `haze`, `wet`, `snow`, `dust`); the wave chunk in your liquid
   material (D); the kits with the reference factory and a palette by material (C); blades
   of grass that can be seen near the eye. A region id the post pass keeps crisp (rings).
1. Draw them: rain, snow, hail, the loose kinds, marks, the waves, lightning, `visibility01`,
   `cloud01`, `wetness01`, `snowDepth`. Until then two thirds of this role cannot be judged.
2. Two ground words where I keep mine and say why (test `ground.test.mjs`): `ochre_basins`
   you call rock, I keep **dust** (every airless world wears fine regolith, and ballistic
   dust is Mercury's one piece of weather; if you paint bare slabs there, paint them dusty);
   `nitrogen_dunes` you call ice, I keep **snow** (dunes are loose grains by definition and
   take prints). The other five I changed to yours (`rust_canyons` rock, `frozen_waves`,
   `pearl_fog`, `lilac_mountains`, `long_shadow_plain` ice).
3. The cloud seas: tell me if you would rather they did not carry the explorer (Decisions 16).
4. Under the cloud deck and under lava your terrain goes on; the explorer floats above it, so
   it should never be seen. Say if it can be.

### From PILOT

**P10:** nothing has to be wired. Offered: `physics.here.blown` for sound (sand, snow, spume, surf).
0. The three items the coordinator relays as open on your side have their recipes under "For
   PILOT: Open on your side": touchdown on the legs, rain audio, the pulse planner.
(Corrected in P4: I had reported `seed: 1` and the gear lift-off as open after you had done
both in `af6ea97`. Checked in the code and by playing it: the feet leave at 0.93 s after the
hull has risen 11 cm on its legs, 8.5 kN of wash while they are down, 5.2 m/s at most on
the way to the hover. Both are closed.)
1. `st.phys.buffetAngle` on the drawn attitude and the chase camera, if it is not there yet:
   in a 3 m/s breeze the hover holds within 1 cm and nothing shows that the air moves.

## Answers to the others

### To the lead's review 7 (code; one MUST FIX, two SHOULD FIX)
1. *MUST FIX, the ghost overwrites the walker's `_dir` and `_gnd`*: **fixed in `976b954`**, structurally (the step's scratch is an
   argument; the ghost has its own set, asks the walker's env nothing during a trial, lays no stride and makes no garbage), with
   your regression test (the row off the x-z plane, Earth and Moon). Your `ghostfield.mjs` on the head after P19: radial 0, off the
   line 0, wrong materials 0 (also the 11 in the plane you put down to the script's timing: the reported ground is now where the
   step ends), steps in the air 0. Your proposed four lines gave the same walker path to the last digit in all 12 cases (your
   `fixed2`), so the two fixes agree. The ghost's worst frame (your ghostcost2 field, physics' own ground): 0.75 -> 0.15 ms at
   60 Hz, 0.32 -> 0.16 ms at 30 Hz 7.4 m/s (medians of 20 runs). Proving it showed the row's run crawling at 0.5 m/s (before and
   after, in the plane too): the ghost was set down in the air; **fixed in `b5db96b`** (hand-over, 1b).
2. *SHOULD FIX, SeaMap.rebase leaves the target in the old frame*: **fixed in `40f8f7d`** as you gave it; `seamap-seams.mjs` B:
   14.59 / 17.10 -> 2.44 / 2.34 m alone, 2.21 / 1.95 m with item 3 (typical 2.36).
3. *SHOULD FIX, the shown map steps when a build lands*: **fixed in `40f8f7d`**, the three causes as you proposed, with two
   differences: the band is a rectangle whose edges each move continuously (a square about the focus, your proposal, needed an
   inset for the worst lag and its trailing edge swept at twice the walking speed), and the warp is pulled into the band at the
   nodes as the texture is written, not per place (pulling the read point in made it cross cell lines as the band moved: 2.1
   degree steps). `seamap-seams.mjs` A: 9 -> 0 steps over the marks, 0 on build frames; the largest build-frame step 60 m out
   0.0048 m against 0.0047 on other frames. PAINTER must copy one more uniform (`uPhysSeaBand`; "For PAINTER", P19).

### To the lead's review 1 (PHYSICS section; no MUST FIX)
1. *Worst-case frame 6.8 ms.* Found and fixed in `59e8ad7`. It was the first frames (engine
   compile plus a 24-sample burst), then re-anchors (every field dropped and re-sampled) and
   grid scrolling (a per-cell copy loop, up to 1.2 ms). Now: `physics.warmUp()` for loading;
   re-anchoring carries every field over; scrolling is row-wise native moves; surface sampling
   is rationed by time as well as count. After `warmUp()` the worst reproducible frame in the
   first 5 s is 0.22 ms (Status says how that is measured, and which scheduler spikes it
   leaves out). `physics.stats.msMax` reports the worst frame of a session for you to police;
   `stats.msGround / msAir / msWeather / msFlora / msParticles` say where a slow frame went.
   If you still see a frame over 2 ms after calling `warmUp()`, send me its `stats`.
2. *Which of my numbers each of yours replaces.* The two tables above.
3. *No lab page, no evidence.* `physics-lab.html` and 12 shots in `docs/shots/physics/` (`a811a43`).
4. *Giants' winds in one named constant.* `physics.data.WINDS[body].scale` (with `.real`, the
   real speed, beside it) and `physics.setWindScale(bodyId, scale)` (`59e8ad7`).

### On `docs/lead/REFERENCES.md`: where a check is unphysical and I keep the real behaviour
- **R-FOOT-1** (90 % of walking speed in 0.15-0.4 s; stop in under 0.4 s and 0.8 m). At a
  real walking pace (1.4 m/s) the body does this. At the game's 4.2 m/s "walk" (a jog) it
  takes 0.58 s and 1.2 m, because boots on grass give at most 0.95 g. `assistAccel: 4` meets
  the check (0.38 s, 0.8 m) with a named thruster force. Kept real; assist offered.
- **R-FOOT-3** (20 degree uphill 15-35 % slower): mine is 37 %, from leg power; 30 degrees
  is 55 %. Slides above the hold angle start at 3-6 m/s and keep accelerating on a long
  slope (gravity does not stop at 6 m/s).
- **R-FOOT-4** "braking distance at least 1.5 x longer on loose sand": wrong for sand. Sand
  stops you in half the distance (1.9 m against 4.1 m from a run); what sand costs is top
  speed (25 % lower) and starting. Wet rock (1.4 x) and ice (many times) do lengthen braking.
- **R-FOOT-5** (15 m/s wind changes walking speed 5-15 %; assist). A fit body leans 7 degrees
  and walks on at full speed; only above about 25 m/s does leg power run out (2.9 m/s into a
  25 m/s wind) and at 45 m/s the wind wins. `st.phys.lean` and `windAccel` are there to show
  the effort. "Never wins" in a Neptune storm is yours to assist.
- **R-JET-1** (Moon at least 2.5 x Earth): impossible with a climb cap. With `jetMaxRise` 8.5
  both worlds climb at 8.5 m/s for the burn and differ only in the coast. Drop or raise the cap
  on light worlds.
- **R-SHIP-2** (a 90 degree turn straightens in 3 s at cruise). With thrusters and hull lift
  (18 m/s2) that is 2.6 s at 46 m/s but 9 s at 160 m/s and 40 s at 750; your steering asks for
  26 g at 160 m/s. Hence `carve01`: steering stays arcade, speed changes keep their mass.
- **R-PART-4** ("gone above about 40 m"). A jet keeps its momentum as it spreads: 11 kN from
  40 m is still 20 Pa on the ground, a stiff breeze in the grass. It is gone by about 100 m.
  If you want less, raise `antigravShare` (0.9 leaves 7 Pa at 40 m).
- **R-PLANET-1** ("about 50 times harder on Venus than on Mars"). Drag goes with density:
  3250 times Venus to Mars, 53 times Venus to Earth, 61 times Earth to Mars.
- **R-WATER-1** (0.75 x knee-deep, 0.5 x waist-deep). True of a real walking pace. At a 4.2
  m/s command water drag (which grows with v squared) gives 0.62 x and 0.36 x.
- **R-SNOW-1** ("each flake wanders sideways by about its fall speed"). Real flakes side-slip
  at 10-30 % of their fall speed; mine flutter at 0.28 m/s. In wind they do travel at 70+ degrees.
- **R-WX-1** (no field changes by more than 5 % of its range per second). Measured over 100
  minutes at three places: rain intensity 0.8 %/s, cloud 2.8 %/s, wind factor 1.5 %/s, but
  `visibility01` up to 6.2 %/s at the edge of a fog bank or dust storm. A bank that drifts
  at 6 m/s does arrive that fast; low-pass it in the sky if it reads as a pop.
- **R-WIND-2** (a gust band crosses grass at the wind speed, within 30 %). It crosses at the
  wind speed at 10 m, which is twice the wind at blade height: gusts are carried by the faster
  air above. Coherent over the 34 m and 90 m gust scales.
- Measured and met: R-RAIN-1 (rain 6.3 m/s, drizzle 1.5 m/s), R-RAIN-3 (wetness 0.87 after 60 s
  and 0.99 after 90 s of an arriving storm; dry again in 4 to 10 minutes), R-STORM-2 (wind
  picks up 70 s before the rain reaches half its peak, for a 740 m cell moving at 6 m/s),
  R-STORM-3, R-WX-2, R-WX-4, R-WIND-3 (0.7 cm tip motion at 1 m/s, 35 degrees at 8 m/s, crowns
  14 degrees at 20 m/s), R-WIND-6, R-PART-1 (57 degrees at 0.6 m after 0.1 s), R-PART-2 (back
  within 10 % in 0.9 s, damping ratio 0.55), R-PART-5, R-PART-6, R-PART-7 (the push field is
  carried over a re-anchor), R-SHIP-4 (14 m/s2 beyond the weight on every body), R-SHIP-5
  (gear), R-SHIP-9, R-JET-3, R-JET-5, R-PLANET-4, R-DEF-1.
- By construction, not separately measured: R-WIND-1 (one grid feeds everything), R-SHIP-8
  (`buffetAngle` up to 3 degrees pitch and 4.6 roll).
- Met in P2: R-DEF-2 (rims), R-DEF-3 (snow and sand filling prints), R-DEF-4 (pad prints and
  the scour dish), R-PLANET-2's ballistic dust, R-PLANET-3 (each world its own weather, table
  in Status), R-WATER wave parameters and ripples.
- Still not: R-RAIN-4 (puddles), R-RAIN-5 (shelter under canopy and hull), R-WIND-4 (a third,
  branch rate), a wake field on water.

### To PILOT ("From PHYSICS" in your notes)
1. `brake` in `stepShipBody`: done (API; wiring step 7). 2. Lift-off through the gear: the
exact calls and what happens are in wiring step 5, with a test. 3. The step functions move
`st.p` in place: said in the API block now. Earlier: table above, worst frame above, `bindEnv`
needs nothing your explorer env lacks; for the ship add `altGround`.

### To PILOT: review of your wiring at `0467427` (run through your own `Sim` in Node)
What I ran: `node --test tests/physics.test.mjs` (5 pass); a scripted flight through `Sim`
with and without physics; the weather at PAINTER's spawn for your seed.
1. **`warmUp` is not called.** Through `Sim` I measured `physicsMs` 0.74 average and a worst
   frame of 4.5 ms in the first seconds (engine compile and the first burst of surface
   samples). Call `physics.warmUp({ bodyId, time, focus })` once while loading (after
   `spawnOn`, and again after a load-from-save on another body); it takes 10-20 ms and the
   first played frame is then 0.2-0.3 ms.
2. **`seed: 1`** (main.js and your tests). Fine: at PAINTER's spawn seed 1 is a dry breeze for
   at least the first 15 minutes. The default (omit `seed`) is 14, which is the one my test
   pins: fair for 7 minutes, cloud at 12, the first shower at 12.5. Your choice; just keep one.
3. **Steering without `carve01`.** You pass `{ target, tau, hover, boost }`, so turning is
   thrusters and hull lift only. Measured: a 90 degree turn at 52 m/s leaves the velocity
   up to 70 degrees off the nose and takes 3.3 s to come within 10 (your kinematic ship: 53
   degrees, 2.7 s). Near the ground that slide reads as weight and I would keep it. At 160
   m/s it will take about 9 s and feel like ice. Suggestion: `carve01: smoothstep(40, 120,
   speed)`, so the low-speed ship keeps its mass and the fast ship stays on its nose.
4. **Lift-off and landing are still position curves** (`st.liftoff` bypasses the body; the
   landing ends in a snap). `stepShipGear` is unused. Step 5 of "For PILOT" above is the
   recipe; the lab's ship scene (`driveShip` in `physics-lab.html`) is a working example.
5. **`st.p = p0` after the body step** is fine (you integrate once). `shapeTarget(st, v, ...)`
   applied to the velocity AFTER the body step is the one remaining velocity clamp; it only
   bites when the target shaping was not enough, so it is a fair backstop.
6. **The field brake in vacuum** is a good, honestly named assist. Note `accelReverse` is now
   14 m/s2 (your comment says 10).
7. **Explorer**: the wiring is exactly right, including `jetUse` for fuel and the altitude-
   dependent `descentLimit`. You do not use `assistAccel`; your own test passes without it
   (walking pace in under 0.8 s), so leave it at 0 unless it feels heavy in the hand.

### To the lead's review 3 (no MUST FIX)
- *Tree red during the restart recovery.* Understood: I commit green, and the Status line
  says which count is green at which commit. The seven failures were the mid-edit state the
  coordinator's snapshot caught (new default seed and the fog measure, half applied).
- *Worst frame about 5 ms in the browser under load.* Measured where it can be repeated: the
  same deterministic run five times, each frame's best, then the worst frame: 0.29-0.51 ms on
  the real worlds, storms included (Status, Cost). The browser number is the machine.
- `brake`, the lift-off and the `st.p` line: in the API and in wiring steps 5 and 7.

### To PILOT: the game as it plays now (your `Sim`, PAINTER's world and obstacles, my physics, scripted keys)
Measured at `dc5a4d9`, default seed:
- On foot at the spawn (dry litter, mu 0.60): walk reaches 90 % of 4.2 m/s in 0.40 s and
  stops in 0.52 s over 0.80 m; run reaches 7.4 m/s in 0.85 s; running jump 0.95 m, 0.93 s.
  Right. In the storm at 12 minutes (wet litter, mu 0.36) the run still reaches 7.4 m/s and
  stops in 0.95 s over 3.1 m: that is the weather being felt, and about as far as it should go.
- Jetpack held 3 s: top 22 m, climb 8.4 m/s, then a fall at up to **16.2 m/s** before the
  brake catches it near the ground. 16 m/s is a five-storey fall; for a calm game I would cap
  the sink at 9-10 with `descentLimit` all the way down, not only near the ground.
- Lift-off: yours, kinematic: 4.8 m/s peak, to hover in 2.8 s, no leg, no wash. Step 5.
- Throttle: 0.6 m/s after the first second, 25 after the second, 46 after five. The first
  second is the spool (0.45 s) plus your throttle rate stacked: it reads as a dead stick.
  Either ramp the throttle faster or accept the spool as the only lag, not both.
- Letting go of W does nothing (46.1 to 46.3 m/s in 4 s): fine if the throttle is a lever, but
  then the screen has to show a lever.
- A 90 degree turn at 46 m/s takes 3.2 s and ends at 29 m/s. That is the thrusters killing
  the old velocity (`carve01` is 0.02 at that speed by your smoothstep 40-120): honest, but the
  turn eats 37 % of the speed and cruise sits right at the bottom of your carve range. Start
  the carve at 25, not 40.
- X from 29 m/s: 2.6 s, 40 m. Good. Hover in a 3 m/s breeze: 1 cm of drift in 5 s, 1 cm/s of
  vertical motion: too good; nothing tells you there is air (Needs 3).
- Landing from 70 m: 13 m/s down, flare from 10 m, touch at about 1 m/s, 9.7 cm of leg
  stroke, asleep 1.5 s later. Good, and it is the gear model doing the last metre.
- A wart of mine found here and fixed: after lift-off `st.phys.contacts` kept its parked
  value, so pad prints could be stamped under a flying ship. Cleared in flight now, and a
  foot more than 25 cm up never prints.
- `physics.update` in this loop: 0.25-0.32 ms mean on foot, 0.60 flying.

### The integrated game in the browser (P3, job 2)

Played in headless Chromium (software WebGL2, 480x270, `dynres=0&pointerlock=0&scale=0.5&
quality=0&stats=1&card=0&fresh=1&save=0`) with real key events, on Earth, Mars and Neptune:
walk, stop, run, running jump, a 3 s jetpack hop; then `__pc.teleport({ body, ship: true })`
and W for 8 s, X to a stop, C/E to land, Space to lift off. State was read from `window.__pc`,
never written (script and screenshots: `/home/user/.pc-scratch/physics/browserplay.mjs`,
`play/`). No console errors on any world. 3-8 frames a second, so game time advances in
steps of up to 0.25 s: the bodies behave the same as at 60 Hz (the Node numbers above), which
is the first thing this run shows.

| | Earth (forest, litter) | Mars (gravel, 0.018 kg/m3) | Neptune (moss, ice fall, 10-19 m/s wind) |
|---|---|---|---|
| walk; stop | 4.20 m/s; 0.72 s, 0.84 m | 4.20; 0.77 s, 1.11 m | 4.20; 0.68 s, 0.78 m |
| running jump | 0.97 m, 0.77 s | 2.33 m, 1.90 s | 0.58 m, 0.57 s |
| jetpack 3 s: top, climb, fastest sink | 27.9 m, 8.4, 13.4 m/s | 50.0 m, 11.9, 16.1 m/s | 24.5 m, 8.4, 12.6 m/s |
| hover 4 s: drift, vertical speed | 0.07 m, 0.02 m/s (5 m/s wind) | 0.00 m (5 m/s, thin air) | 1.83 m, 1.32 m/s (19 m/s) |
| throttle, speed each second | 10 35 45 46 | 12 34 45 46 | 10 31 43 45 46 |
| X from 46 m/s | 3.77 s, 93 m | 3.87 s, 94 m | 3.70 s, 89 m |
| landing: leg stroke; at rest | 10.8 cm; 9.3/8.2/8.2 | 4.9 cm; 4.9/4.3/4.3 | 10.9 cm; 10.9/9.7/9.6 |
| `physics.update` on the read-out | 0.76 ms avg | 0.73 | 0.80 |

What behaves wrong, or does not show:
1. **The three worlds fly the same until the wind blows.** Speed each second, cruise and
   braking are identical to a few percent. That is honest for a 4.2 t craft with 2.2 g of
   engine at 46 m/s (drag is 5 % of the thrust on Earth and nothing on Mars), and PILOT's
   speed envelope caps cruise at the same 46 m/s everywhere near the ground. The worlds differ
   where the physics has something to say: jump (0.58 m on Neptune, 2.33 on Mars), leg stroke
   on landing (4.9 against 10.9 cm), and the hover: rock steady on Mars, pushed 1.8 m and
   bobbing at 1.3 m/s in Neptune's 19 m/s wind. If the ship should feel each world at low
   speed too, the lever is the envelope (let cruise near the ground be what the engines and
   the air give at sea level: 251 m/s on Earth, 35 on Venus, 279 on Neptune, 1960 on Mars),
   not the body model. Venus already shows it (through your `Sim` in Node, not flown in the
   browser): its air holds the ship to 38 m/s and stops it from there in 2.6 s, against 46
   and 3.7 on Earth and Mars. It is the one world where the air decides below your cap.
2. **The jetpack hop on Mars** climbs at 11.9 m/s (8.4 elsewhere) to 50 m and comes down at
   16 m/s; on Earth 13.4 m/s. The catch near the ground works on all three (touchdown about
   7 m/s) but the fall before it is long and fast for a calm game.
3. **Coming down on C takes 14-16 s from 18 m** (about 1.2 m/s): the cushion turns the last
   stretch into a wait. E, where the prompt offers it, is quicker.
4. (Withdrawn. I read `altGround` staying at 0.0 for 2-3 s as a position curve; it is the
   gear lift-off of your `af6ea97` seen through the canopy-aware floor. Measured since: the
   hull rises 11 cm on its legs, the feet leave at 0.93 s, wash 8.5 kN while they are down.)
5. **`physics.update` reads 0.7-0.8 ms on average in the browser** against 0.25-0.35 in Node,
   with single frames of 6-29 ms: three renderers share the cores here and the game itself
   runs at 130-350 ms a frame. Not a number about physics; it wants a quiet machine.
6. **Nothing of the weather, the marks or the waves is in the picture** (as expected: the
   kits are not wired yet). The push field is live around the explorer (370-385 cells
   pushed, 11-16 marks after a short walk), but at this resolution I cannot see grass part.
   Neptune's spawn is so dark at that hour that nothing at all can be judged there.
7. On Mars the explorer spawned standing on top of a boulder. Harmless, odd.

### The lab inside the painted pipeline (P4, job 1): `physics-lab.html?painted=1`

Builds your (PAINTER's) world and painter from public exports only (`createPainter`,
`RENDERER_OPTIONS`, `makeWashMaterial`, `bindBodyUniforms`; `createWorld` and the world's
methods; the three chunks your contract names in `src/render/chunks.js`), runs the physics on
it and adds the kits with the factory above. No PAINTER file is touched or reached into.
Parameters: `body=`, `biome=` (via `world.findBiome`) or `lat=&lon=`, `hour=`, `t=` or
`find=rain|thunderstorm|snow|dust|fog|<kind>` (the time at that place when the weather is
there, else the nearest place), `pre=<s>` (simulate that long unseen before the page is
ready: software GL draws a frame or two a second), `walk=<m/s>&circle=<m>` (an explorer on my
body model, drawn as a plain painted capsule), `ship=hover|land` (`shipAlt`, `shipAway`,
`shipDrift`), camera `yaw pitch dist up follow=1`, `rain=thin|broad|cover|blend`, `water=1`
(my patch, reference only; `waterLift`, `waterN`, `waterStep`), `expand=gpu`, `kits=0`,
`quality`, `scale`, `hud=1`, `freeze=1`, `push=0` (the bodies disturb nothing: with the same
`pre` and `freeze=1` the frame differs from the pushed one only by the push field),
`snowSize snowMin snowMax snowCell dustSize dustMax` (the draw table). `window.__lab`:
`info()` (now with `kits.cover`, `kits.size`, `sky`, `hides`: the share of a 24 m sight line
that what is falling and the dust hide), `stability(dtMs, pairs, hideKits)`, `setRain(mode)`.
The debug lab has `window.__lab.waterAgreement()` (the wave chunk against its twin, in GL)
and `patch=1` (the CPU water patch).
Example: `node tools/shot.mjs "/physics-lab.html?painted=1&body=earth&find=thunderstorm&walk=2&pre=12" out.png --w 960 --h 540 --timeout 400000 --shot-timeout 240000`.

**Frames at 960x540 (768x432 internal), quality 1, each opened and judged against the art bible:**

| Frame | What is in it | Verdict |
|---|---|---|
| `painted-storm-forest.jpg` | Earth forest, thunderstorm 17.5 mm/h, 1370 drops, broad strokes | **Reads as rain**, as pale slanted strokes among the trees; thin on the open grass (pale on pale); sheltered under the crowns as it should be. The sun is out and the ground is dry in the picture: the sky and the wash know nothing of the storm. No splash rings (erased by the post pass). |
| `painted-rain-options.jpg` | the four ways to draw rain, same storm | thin: **invisible** (1270 drops, none survive the post pass). cover: invisible. broad: visible, reads. blend (own pass after the painting): faint hairlines, and it draws over the paper border. |
| `painted-snow.jpg` (re-shot in P5) | Earth alpine meadow at 13 h, blizzard 2.2 mm/h in a 9.5 m/s wind, 1690 flakes shown modulo a 9 m cell, 10 cm, drawn out along the wind | **The kit part reads now**: about 75 bare-paper flakes of different sizes all over the picture, larger near the lens, slanted with the wind; visible against meadow, hill and trees, lost against the sky (white on pale, as it must be). It reads as a snow flurry on a sunny green meadow. **As a blizzard the frame still fails, and nothing more can come from a kit**: no snow lies (`sky.snow` is 1), the far hill is sharp (`sky.haze` 0.25), the sun is out (`sky.overcast` 0.51). The flakes are a little alike (ovals of one tilt). |
| `painted-mars-dust.jpg` (re-shot in P5) | Mars dunes, dust storm, visibility 0.16, 269 puffs sized 2.0 m from the dust in the air, ragged at two scales, drawn out along the wind, in the dune's own ochre by material | **The kit part reads as blowing dust**: a broken dry-brush band streaming across the middle distance, tufts thinning upward. Not blots any more. **As a storm it still fails**: the sky and the far dunes behind it are clear (`sky.dust` 0.84, `sky.haze` 0.16 are yours); lone tufts against the clear sky look like leaves. The sand grains show as small dark flecks (too dark: ochre times a shade). |
| `painted-marks.jpg` | Earth desert, a walked circle, the ship landed and left | **Footprints read**: small dark dabs, right size, stable. Pad prints are small dark ovals, acceptable. Scour dishes had to be reduced to a faint ring: dozens overlap and an opaque kit piles them into a dark patch. Kicked dust shows as ochre patches: tolerable here, a brown blot on forest litter. |
| `painted-neptune-sea.jpg` | Neptune's sea, Hs 0.75 m, my patch lifted 0.8 m over your liquid, a hull hovering | **Fails as a sea.** A flat wash; the waves show only as the wavy far edge of the patch; spray under the hull reads. My patch fights your flat liquid surface (where it dips below yours you see yours), and my three-tone shading did not survive. This needs the wave chunk in your water material, not a second surface. |
| `painted-meadow-wash-ab.jpg` (P5) | alpine meadow, the ship hovering 5 m up just out of frame; top: its downwash on (2957 push cells live), bottom: the same frame to the pixel with `push=0` | **The push field reaches your plants**: the poppies under the wash are flattened outward by 10 to 20 px (0.66 % of the pixels differ, all of them plants). **Grass parting cannot be judged**: the meadow is a wash with no blades to be seen at 4 or at 11 m, so there is nothing to part. Round the walking explorer in the wetland (three ferns in view, none within a metre of the path) the two frames are identical to the pixel. |

**Rain after P5** (checked, frame not kept): the same wood in a thunderstorm of 8.6 mm/h, 981
drops, the kits as they are now: about 15 pale slanted strokes in view, as thin as the 25 of
the kept frame at twice the rate; `cover.rain` 0.755. That thinness is the physics: rain of
that rate hides 1.6 % of a 24 m sight line. Rain reads in a painting through the dark sky, the
wet ground and the softened distance (`overcast`, `wet`, `rain`, `haze`), not through more strokes.

**Rain, measured for crawl** (pairs of frames 8 ms apart, five pairs, same storm, 1270-1390
drops; mean absolute difference of the picture, and the share of pixels changing by more
than 8 %): no kits 0.00035, 0.03 %; thin 0.00050, 0.06 %; cover 0.00038, 0.05 %; blend
0.00024, 0.05 %; **broad 0.00175, 0.40 %**. Thin and cover add change without adding
anything you can see: that is shimmer with no rain in it, the worst of both. Broad changes
most because it is the only one that is there; its strokes move 5 cm in 8 ms along their
own length (90 cm), which is travel, not crawl. Blend is the calmest and the least like the
painting. My reading: broad strokes in your opaque pass, more of them over open ground, with
the wet darkening done by your wash from `wetness01` rather than by the strokes.

**Cost in the real pipeline** (kit CPU per frame, draw calls, triangles; limit 12 calls and
60 k triangles for all kits): thunderstorm 0.10-0.21 ms, 4-5 calls, 3.2 k; blizzard 0.14 ms,
4 calls, 3.0 k; Mars dust storm 0.12 ms, 3 calls, 1.5 k; marks and dust in the desert 0.07-0.4
ms, 2-3 calls, 0.5-1.0 k; the sea with a 65 x 65 patch and wakes 1.1-1.5 ms, 4 calls, 8.7 k
(too dear on the CPU at that size: the default 41 x 41 is 0.05 ms without wakes; another
reason to use the chunk instead). `physics.update` read 0.5-1.4 ms in this page under
software GL (0.3-0.5 in Node).

**Missing in the contract or the exports** (I worked round none of these by reaching in):
1. (Closed by your `ebd9b4d`: `makePaintUniforms`. The lab uses it.)
2. (Closed by your `ebd9b4d`: the chunks are exported from `src/render/index.js`. The lab uses them.)
3. **An opaque pass cannot glaze.** Rain as a darker veil, dust as haze, a print as "the
   ground, darker", a wet patch: all want to tint what is already there. A kit can only lay
   its own ink over it, and the ink is wrong wherever the ground is not what the ink assumed.
   What would fix it: the local ground wash available to a kit's fragment (a function in
   `FRAG_PARS`, or a uniform colour per biome), or one multiplying pass after the scene pass.
   (Half answered from my side in P5: every particle and mark now carries its ground
   material, so a palette of 16 colours a biome gives each its ground's ink. Veils and wet
   patches still need you.)
4. The post pass erases marks under about 3 px, with no way to ask it not to: no splash
   rings, no fine rain, no snowflakes. Say what the least mark is, or give a region id that
   is kept crisp.
5. No way to move your liquid surface: `makeWaterMaterial` is not public and the world takes
   no wave chunk. A second surface over yours cannot work (frame above). The chunk is ready
   for it ("For PAINTER", D).
6. Nothing in the sky or the haze reads the weather: storms under the sun. PILOT now hands
   you `setMood.sky` every frame; "For PAINTER", E names the number for each wash.
7. (New) No blades of grass are visible in a meadow at any distance, so plants parting round
   the explorer, the first thing the owner asked this role for, has nothing to show on.

**Shader agreement inside `PROP_VERT`: not measured.** From outside your files I cannot read
a displaced vertex back: the scene targets are internal and the prop material is not public.
What I can do without reaching in is a silhouette test (drive my own field arrays to a known
steady load, render, and compare where a lone crown lands on screen with the JS prediction,
using `world.sampleObstacles` for the tree's root and height): accurate to about a pixel,
2-3 cm at 20 m. Not done in P4. A one-line hook from you would make it exact: a debug
material flag that writes the displaced body-local position to the colour target.

## Ideas and critique

Blunt, as asked. All of it is about motion and behaviour; none of it is about look or structure.
(The P1 list about the kinematic explorer and ship is answered: both run on bodies now.)

- (to PILOT, ship) The first second of throttle does nothing (your throttle rate on top of my
  engine spool); a 90 degree turn at cruise costs 37 % of the speed because cruise sits at the
  foot of your carve ramp; the hover is so exact that the air might as well be absent.
  Numbers in "the game as it plays now". (The seed and the lift-off, which stood here, are
  done on your side.)
- (to PILOT, explorer) Falling 22 m from a jetpack hop at 16 m/s and being caught at the last
  moment is a stunt, not a stroll. Cap the sink all the way down.
- (to PILOT) `physics.here.weather.lightning.thunderIn` and `.last.distance` are there for the
  thunder; a storm without sound is half a storm, and the delay is the cheapest sense of scale
  in the game (340 m/s on Earth, 1210 on Jupiter, never on the Moon).
- (to PAINTER) Nothing of the weather is painted. The sky does not darken with `cloud01`, the
  far washes do not close in with `visibility01`, the ground does not darken with `wetness01`,
  no drop falls. The thunderstorm that crosses the spawn at eleven minutes, 22 mm/h with hail
  and four flashes a minute, is at the moment a number in a read-out. This is now the largest
  gap between what the game computes and what it shows.
- (to PAINTER) Under the home forest the wind at 2 m is 1-3 m/s even in that storm, because a
  closed canopy really does that. So on the ground the storm is rain and noise, and the drama
  is in the crowns (the stiff response reads the wind at canopy height) and in the glades. If
  the crowns do not visibly heave, the storm will look tame however hard it rains.
- (to PAINTER) Clouds still drift on fixed axes with `uTime`. `physics.air(bodyId, p, out,
  cloudHeight)` gives the wind up there (faster aloft; twelve times faster on Venus), and
  `physics.util.cellsAt` gives where the systems are: paint the dark ones where it rains.
- (to PAINTER) Grass leans 47 degrees in a 5 m/s breeze and 65 in 8 m/s. A single blade is that
  limp, but if a whole meadow reads as flattened at the spawn, the knob is `FLORA.softFlex`
  (3); tell me what you see at 960x540 before I touch it.
- (to both) Cloud seas and lava are liquids only because the look table says so. I gave them
  densities and a viscosity; someone should walk into each on purpose before M3 is called done.
- (to PAINTER, new) The contract asks for one opaque pass with holes by `discard`. That suits
  marks and dabs; it will make rain hard: a streak 1.2 px wide with no blending is an
  aliased hairline that crawls. Either rain gets a blended pass of its own after the scene
  pass, or it wants supersampling; decide before tuning anything else about it.
- (to PILOT) Every world cruises at the same 46 m/s near the ground because your envelope
  says so; only Venus, where the air stops the ship at 38, is itself. The worlds would
  differ more if the cap were the engines' and the air's (table in "The integrated game in
  the browser").
- (P5, to PAINTER) The game computes a thunderstorm, a blizzard and a dust storm and paints a
  fine day in all three. With `setMood.sky` arriving every frame this is now one afternoon of
  work on your side for the largest gain left in the game: dim the light with `overcast`,
  pull the far washes in with `haze`, leave the ground white with `snow`, darken it with
  `wet`, tint the haze with `dust`. My flakes and billows are accents on a veil that is not there.
- (P5, to PAINTER) A meadow without blades. Wind in grass and grass parting round the body
  were the first things the owner asked of this role; the field is live, measured, wired,
  and there is nothing on the sheet for it to move but poppies.
- (P5, to PILOT) Rain on a wood, rain on water, drips after rain, thunder late by the right
  number of seconds: every number is in `physics.here` and none of it sounds yet.
- (P5, self) Two of the four "then" items of this stage are not done (silhouette agreement
  in `PROP_VERT`, branch rate) and drifts not started; the integrated game was not played in
  the browser this run. The flakes are ovals of one tilt; a painter would vary them more.
  The dust reads as blowing dust only against a darker ground; lone tufts against the sky
  read as leaves. Spray says `bed`, which only tells PAINTER "liquid here".
- (P5, self) Thinning by a number per particle is right for marks that move little; a flake
  blown across the cell's wall still shrinks and regrows 18 m away. In a gale that is many
  flakes a second, each over about a quarter of a second. I have not measured it as crawl.
- (P6, self) Three stages of rain were photographed standing where the session began. Walk
  400 m and the rain ended 18 m over your head; swim out and it stopped raining. Both bugs
  were found by a script that looked at where the particles were, not by a picture, and both
  had passing tests round them. Tests that only look near the anchor prove little: every
  field of mine should be tested 300 m from it and over deep water.
- (P6, self) The snow has now been simulated three ways in three stages (a 48 m box, the same
  shown modulo a cell, a small box round the eye). The third is the first that is honest
  about what a flake lands on. I should have asked "where is it seen from" in P1.
- (P6, self) Branches and drifts are numbers and a chunk. Until PAINTER calls one line and
  reads one texture they do not exist for the owner, like the grass parting before them.
  This role's output is now well ahead of what the picture shows: weather, waves, marks,
  the push field, branches and drifts are all computed and none of them is painted.
- (P6, to PILOT) The game flies the same on every world but Venus: one turn rate, one feel,
  five cruise speeds within 10 m/s and three more at 74 to 84. Venus is the only world
  whose air you can feel, and it is the best flight in the game for it. The assists
  (carve unbounded, ground-speed hold, grip from thrusters on foot) iron every other world
  flat. Each has a number now; turn one down and a world appears.
- (P6, to PILOT) On foot the Moon is Earth with a long jump. Nothing slides, nothing bounds,
  and a jetpack hop goes to 113 m.
- (P6, to PAINTER) Mars's spawn puts the walker in a boulder field: two runs out of two
  stalled against the stones within three seconds.
- (self) I wrote the first kits before PAINTER's contract existed and had to turn them round
  in the same stage. Ask for the contract first next time.
- (self) The lab draws dots and lines. I can prove a drop falls at the right speed and cannot
  tell whether rain reads as rain. Every particle system here is unjudged as a picture.
- (self) The three-wave sea is honest about height, period and direction and has no groups, no
  breaking, no wake field. From a ship at 100 m it will tile. It needs a fourth, long train
  and a per-train phase noise before anyone flies low over Neptune.
- (self) Snow squalls still close the view at up to 8 % a second; I softened banks and left
  squalls, because that is what a squall is.
- (idea) Rain shelter: `canopy01` at the focus could thin the drops under a closed wood and
  under the hull for almost nothing; drips after the rain (the canopy empties over a minute)
  would sell the wet forest better than the rain itself.
- (idea) `st.phys.lean` for the explorer model, `legCompress` for the ship's legs, `fieldBrake`
  for a glow: animation data that cost nothing.

## Next stage
P7, in my order: (1) when PAINTER's weather is in the picture (it is on it now), re-shoot the
storm, the blizzard, the dust storm and Neptune's sea in the game itself and tune
`DRAW_PAINTED` against the frames; ask to see branches and drifts drawn; (2) the silhouette
test in `PROP_VERT`; (3) flakes that tumble and differ in shape, dust tufts that do not read
as leaves; (4) flakes in still air measured for crawl; (5) with PILOT, whichever of the five
levers of "The integrated game, played in P6" it takes: fly them again with `p6/nodeplay.mjs`
and report the same tables; (6) the ship on liquid (a wake, a bob, the gear never engages on
Jupiter's cloud sea); (7) wind carried by the ship (`windShare`), if PILOT wants the giants
windy. See the Hand-over at the top for where each begins.
