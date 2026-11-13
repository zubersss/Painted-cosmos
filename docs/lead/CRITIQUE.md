# CRITIQUE: M4's critique swap (PILOT's file)

The brief's M4: "Each session plays the whole game and writes a blunt critique of the other's
domain." This file holds PILOT's two sections only (the coordinator's rule: PHYSICS writes
`docs/lead/CRITIQUE-PHYSICS.md`, PAINTER `docs/lead/CRITIQUE-PAINTER.md`).

Begun by the eleventh PILOT agent, 2026-11-12 (cut off after three items on PHYSICS); finished by
the twelfth, 2026-11-13. Items run worst first; the top five of each domain are marked **FIX FOR
SHIP** (the owner of the domain decides; the ranking guides the fix round). Each item: what a
player sees or feels, where, the evidence I opened or ran, why it fails, a suggestion.

**What was played, and on what.** The eleventh agent: a clean export of the head `8809fff`
(PAINTER 14's work in progress as the coordinator's snapshot, PHYSICS P24 `c4d2242`), with its
landing-camera work over it (it changes nothing either section judges); the top-tier tour of
Earth, Mercury, Venus, the Moon and Mars (spawn, first vista, orbit: fifteen frames, every one
settled, no console error; `/home/user/.pc-scratch/pilot/run11/tour-top/`), feel in Node
(`docs/lead/evidence/pilot11/`). The twelfth: a clean export of the head `ca0b3db` (PAINTER
`76d8182`, PILOT `904b6fe`, PHYSICS `2f924cd`; PAINTER's files differ from `8809fff` in four
places: Neptune's cloud streaks, Venus' lava plain, the stream's glint, a wetland pebble), one
browser at a time, other roles rendering beside it. (Being filled in as the runs end.) Scratch:
`/home/user/.pc-scratch/pilot/m4/`; the frames and sheets cited are copied to
`docs/lead/evidence/pilot12/`, with the Node instruments and their output (each takes the tree's
root as its first argument).

## PILOT on PAINTER

(In progress, twelfth agent, 2026-11-13: the top-tier frames of Uranus, Neptune and Pluto, of the
first ten minutes, night, the storm and the sea are being taken on a clean export of `ca0b3db`.)

## PILOT on PHYSICS

What holds, first, because it is most of the game: on Earth the walk and the run are crisp and
even (4.2 and 7.4 m/s, 90 % of pace in 0.4 and 0.8 s, a stop in 0.5 and 0.8 s); every world has
its own weight under the feet and the jetpack (a hop 1.2 m on Earth, 0.9 on Jupiter, 2.8 on Mars,
6.4 on the Moon, 10.4 on Pluto); the ship's legs take every landing softly (0.76 to 0.79 m/s at
touchdown on five worlds, 4.3 s from a 25 m hover); the knife-edge ruling is in and nobody is
thrown up off a rim. Measured in `feel.txt`, `shipfeel.txt`, `jet.mjs` (evidence folder above).
From the twelfth agent's play: every world's air shows in the flight (the same half throttle is
17 m/s on Venus, 23 on Earth, 25 on Neptune, 40 on Mars; `pilot12/shipair.txt`); a parked ship
stays parked in a 100 m/s wind (0.3 m in 20 s); a walker in Neptune's 81 m/s squall keeps its
feet and makes 1.6 to 3.1 m/s (`pilot12/stormwalk.txt`); a swimmer rides Earth's chop without
ever going under (`pilot12/afloat.txt`).

Items 1, 3 and 7 are the eleventh agent's (kept as written, renumbered); 2, 4, 5, 6 and 8 are the
twelfth's, from the storm, the sea, low flight and the ship's handling.

1. **FIX FOR SHIP. The explorer runs up cliffs.** Hold Shift+W into a sea cliff or a canyon wall on
   Earth and the figure goes straight up the face, feet on it the whole way, at 5.6 to 6.0 m/s
   vertical: from Earth's `sea_coast` stand 49 to 50 m up 70 to 79 degree faces in three of eight
   headings (0, 270, 315); from `desert_canyon` 24 to 31 m up 72 to 81 degree walls (headings 225,
   270). On Earth's gravity that is 5.7 kW from a 100 kg walker, and in third person it is a
   figure jogging up a cliff like a fly on a window: the one thing on foot that looks broken rather
   than unpolished. Evidence: `docs/lead/evidence/pilot11/wallrun.mjs` and `wallrun.txt` (Node, the
   real worlds, 12 s from a stand), `slowwhy.mjs <root> earth desert_canyon 225` (every half second:
   slope 67 to 74 degrees, the ground 9 to 10 m higher 3 m on, the body 28 m higher in 5 s, `gait`
   0). **It is a regression, bisected**: with PHYSICS as of `3cd06dc` (P21) and before, the same run
   at the sea cliff climbs 0.8 m/s and stops (0.3 m gained on ground over 50 degrees); with
   `e20f900` (P22 part 1, "the way, seen") and every commit since, 49.9 m. Suggestion: find what
   P22 changed for a face that is too steep to hold by friction and higher than a clamber (the
   "a face ... low ... is a step: legs and hands" rule at `explorer.js` :999 looks only one look
   ahead; something in P22's way-reading lets the limbs' hold carry the body up a high face); such a
   face stops the walker at its foot (it may slide back), as P21 did. Add a test: a 70 degree face
   10 m high on Earth and on Mars, Shift+W for 10 s at 30 and 60 Hz: less than a clamber gained.
   On the head `ca0b3db` (PHYSICS `2f924cd`) the instrument gives the same numbers: 49.9, 49.0 and 49.7 m at Earth's sea cliff.
2. **FIX FOR SHIP. Rain stops a walk dead on a forest bank, for nine of a new game's first ten
   minutes.** PHYSICS' first thunderstorm reaches the spawn 140 s into every new game (the default
   seed: drizzle at 140 s, 23 mm/h at 230 s, the last drops at 320 s; `pilot12/onset.txt`). From
   then on, W held eastward from the first view (headings 67 and 90, the bank under the wood 20 m
   from the spawn) carries the figure onto 23 to 26 degrees of leaf litter and there it stops:
   0.07 to 0.2 m/s, mode `idle`, for 3.8 to 6 s at a time with the key down; the same bank is
   walked dry at 3 to 4 m/s (`pilot12/wetbank.txt`, the pair, every half second; `wetstall.txt`,
   sixteen headings at five clocks). The litter's friction falls from 0.60 to 0.36 when wet (the
   tangent of 20 degrees) and the ground stays wet long after the rain (0.86 at 440 s): two of
   sixteen headings still stall at 420 s and at 700 s, none at 1200 s. Shift+W gets over it (5.6 m/s
   in the slowest second) and so does the jetpack, but a new player walking has no way to know
   that.  Why it fails: "the player should never fight the controls", and here a
   key is held and nothing happens, on ground that looks like the rest of the forest floor, with no
   slip, no slide back and no sound to say why; and a walker on wet leaves at 25 degrees does not
   stand still either: he goes up on short steps, or slides. Suggestion: between the wet friction
   angle and the dry limit keep a slow climb on short steps (1.5 to 2 m/s; the suit's assist is
   there for this) or let the feet slip back visibly; never a standstill with the key down on
   ground under 30 degrees. Test: Earth's spawn at clocks 240 and 420, W on sixteen headings for
   14 s: no second under 1 m/s on ground under 30 degrees.
3. **FIX FOR SHIP. The run is still checked hard at some rims and boulder rows** (PHYSICS P24's
   own open items: the descent hold off P22's small rim 3.84 to 1.27 m/s; a knife edge met at about
   3.5 m/s where the law allows 6.3; heading 315 up the 60 degree ridge 2.7 to 3.3 m/s). On the
   arrival ground a player actually runs, from a stand, eight headings, 12 s (`runfield.mjs`,
   `runfield.txt`): the Moon's new near-side `crater_fields` stand is good (7.1 m/s mean, slowest
   second 2.9 m/s), but Pluto's spawn drops to 1.27 m/s for a second (heading 135), Mercury's to 1.58
   (heading 0), Earth's desert canyon to 1.21 (the cliffs of item 1). A sudden check from 7 m/s to
   1.3 reads as hitting an invisible wall, and the player cannot see why. Suggestion: P24's "Next"
   (0) and (1) together (let P21's hold on the way down go where the ground truly falls away; skip
   the point short of a knife edge's top), measured on these stands as well as on boulderrun's site.
4. **FIX FOR SHIP. Neptune's storm coast throws the ship about like a leaf; Earth's storm does not
   touch it.** Hovering hands off at 30 m over the `storm_seas` stand (the place the sketchbook
   sends the player to) at clocks 205 and 236 of the game's own weather: the wind at the hull runs
   from 36 to 262 m/s within seconds, and where it meets the 50 m sea cliff its upward part is 104
   to 164 m/s. In 30 s the ship is carried 107 to 186 m; its height swings between 7 and 78 m (33 m
   in one second); it is flung up the cliff at 57 to 61 m/s; the hull takes 5 to 12 g for two
   seconds on end, and 25 to 44 g in single frames near the ground (there PILOT's cushion acts
   too: PHYSICS' own item 3 on PILOT); the drawn hull rocks 25 to 31 degrees all the while
   (`pilot12/hovertrace.txt`, every half second; `shipair.txt`). The same hover in Earth's
   thunderstorm, 15 to 36 m/s at the hull and gusting, moves 0.0 m and rocks 0.3 degrees. So the
   ship feels nothing, or it is in a tumble dryer; there is no storm in between. 
   Why it fails: the brief's ship is "forgiving arcade flight" in a game with no fail state, the
   camera is fixed to that hull, and a vertical wind of 160 m/s at a 50 m cliff is not weather on
   any world (P23 gave the walker a cap for exactly this cliff; the ship got none). Suggestion: cap
   what the hull is handed (gusts at about 1.5 times the mean wind, the terrain's upward part at a
   third of the horizontal), let the flight computer hold station inside a stated wind and show a
   storm as drift of a few metres and 5 to 10 degrees of rock, and give Earth's 30 m/s storm 2 to 4
   degrees of it. Test: hands off for 30 s over the stand at clocks 205 and 236: within 15 m, within
   10 m of height, under 1.5 g.
5. **FIX FOR SHIP. The first storm comes two minutes into every new game, and the wood is wet and
   misty for the quarter of an hour after.** At the spawn, by the game's own clock (`onset.txt`,
   `wxflicker.txt`, `pilot12/wxscan.mjs`): a breeze for 130 s, overcast from 0.02 to 0.63 in the 40 s
   after, thunderstorm from 160 to 300 s, then mist from 390 s to 1440 s (and again from 2100 s),
   the ground wet through the first of it. The brief's reference painting is "dappled light and a stream", and a new player
   stands in it for two minutes; minutes three to fifteen are a storm and its fog, which is also
   the time item 2's bank is a wall and the time most players spend learning to walk and finding
   the ship.  Suggestion: PHYSICS' call on the weather, PILOT's on the first ten
   minutes: hold the first front off the spawn until about ten minutes of play (a seed offset, not
   a new law), let it come over a minute or two rather than 40 s, and let the sward dry in three
   or four minutes once the sun is back.
6. **Swimming is a glide at one speed, in a sea that carries nothing.** Off Earth's coast
   (`pilot12/swim.txt`, `afloat.txt`, Node; the game's frames to follow): W gives 2.0 to 2.1 m/s afloat and
   Shift+W gives the same (1.95); letting go stops the body within half a metre; the feet ride
   0.6 m of chop under a sea that is never more than 0.5 m high in the first 100 minutes of the
   game's weather (`seascan.mjs`: significant height 0.14 to 0.46 m, period 1.6 s). In Neptune's
   storm sea (3 to 3.5 m high, 41 to 70 m/s of wind, whitecaps 85 to 100 %) a swimmer who lets go
   rises and falls 3.4 m at up to 0.9 g and is moved half a metre in 12 s: neither the wind nor the
   breaking sea carries a floating body anywhere; swimming there at 2.7 m/s the head is under the
   crest for 5 to 27 % of the time. An upright body in a coat making 2 m/s through water with no
   stroke is a sprint swimmer's pace, and nothing in the pace says how. PHYSICS has already sent the
   pose to PILOT and PAINTER (its items 5 and 2); the body's part: give the pace a stroke (a surge
   and a glide, 1.6 to 2.4 m/s over a stroke of 1.5 to 2 m, so the swimmer PAINTER draws has a beat
   to follow), let Shift be a faster stroke, let a body afloat drift a little downwind and toward
   the shore in surf (0.2 to 0.5 m/s in a gale), and let it heave with the surface so that the head
   stays out.
7. **Physics nobody has watched move.** Grass parting round the feet, crowns in the gusts, rain
   and snow, the sea's swell, the ship's downwash: every claim is a number from Node or a strip of
   frames, and the one strip I filmed this block shows the downwash's kicked leaves as large flat
   dark-green blobs crossing a trunk a few metres from the lens, changing place by 30 to 50 px a
   frame (`docs/lead/evidence/motion-landing-pilot11.jpg`, frames 48 to 53; the drawing is
   PAINTER's, the flight PHYSICS'). Leaves kicked at the lens of a chase camera fill a tenth of the
   frame each. Suggestion: keep the downwash's kicked leaves and dust out of the 4 m in front of the
   camera (or below a size on screen), and film each of the motion kinds once at the top tier, as
   P23 did for the gale.
8. **The weather's names do not match its wind.** Standing ten minutes at Neptune's storm coast
   the weather changes its name twelve times (one every 50 s: thunderstorm, rain, drizzle, mist, ice
   fall, drizzle, rain, thunderstorm ...), and for 348 of those 600 s it is called `mist` while the
   wind there runs from 5 to 41 m/s (`wxflicker.txt`). Mist does not stand in a gale; whatever
   PAINTER and the sound hang on the name (a fog kit, a calm bed) is then wrong for the air it is
   in. Suggestion: above about 12 m/s call it spray or spindrift (or `windy` with its visibility),
   and hold a name for at least a minute.
