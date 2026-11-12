# CRITIQUE: M4's critique swap (PILOT's file)

The brief's M4: "Each session plays the whole game and writes a blunt critique of the other's
domain." This file holds PILOT's two sections only (the coordinator's rule: PHYSICS writes
`docs/lead/CRITIQUE-PHYSICS.md`, PAINTER `docs/lead/CRITIQUE-PAINTER.md`).

Written by the eleventh PILOT agent, 2026-11-12. Items run worst first; the top five of each
domain are marked **FIX FOR SHIP** (the owner of the domain decides; the ranking guides the fix
round). Each item: what a player sees or feels, where, the evidence I opened or ran, why it fails,
a suggestion.

**What I played, and on what.** A clean export of the head `8809fff` (PAINTER 14's work in progress
as the coordinator's snapshot, PHYSICS P24 `c4d2242`), with my landing-camera work over it from the
start (it changes nothing either section judges). One browser at a time on this machine (software
WebGL; two other roles rendering beside me). The look at the top tier (quality 2, 960x540); the
play at quality 0 (960x540); feel measured in Node on the same code (PILOT's Sim with PHYSICS at 30
or 60 Hz, the real worlds). Scratch: `/home/user/.pc-scratch/pilot/run11/`; the Node instruments and
their output are copied to `docs/lead/evidence/pilot11/` (each takes the tree's root as its first
argument).

## PILOT on PAINTER

(Being written: the top-tier frames of all ten bodies are still being taken.)

## PILOT on PHYSICS

What holds, first, because it is most of the game: on Earth the walk and the run are crisp and
even (4.2 and 7.4 m/s, 90 % of pace in 0.4 and 0.8 s, a stop in 0.5 and 0.8 s); every world has
its own weight under the feet and the jetpack (a hop 1.2 m on Earth, 0.9 on Jupiter, 2.8 on Mars,
6.4 on the Moon, 10.4 on Pluto); the ship's legs take every landing softly (0.76 to 0.79 m/s at
touchdown on five worlds, 4.3 s from a 25 m hover); the knife-edge ruling is in and nobody is
thrown up off a rim. Measured in `feel.txt`, `shipfeel.txt`, `jet.mjs` (evidence folder above).

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
   A browser frame of it is in the play set (`cliff-run-*`, item list below when taken).
2. **FIX FOR SHIP. The run is still checked hard at some rims and boulder rows** (PHYSICS P24's
   own open items: the descent hold off P22's small rim 3.84 to 1.27 m/s; a knife edge met at about
   3.5 m/s where the law allows 6.3; heading 315 up the 60 degree ridge 2.7 to 3.3 m/s). On the
   arrival ground a player actually runs, from a stand, eight headings, 12 s (`runfield.mjs`,
   `runfield.txt`): the Moon's new near-side `crater_fields` stand is good (7.1 m/s mean, slowest
   second 2.9 m/s), but Pluto's spawn drops to 1.27 m/s for a second (heading 135), Mercury's to 1.58
   (heading 0), Earth's desert canyon to 1.21 (the cliffs of item 1). A sudden check from 7 m/s to
   1.3 reads as hitting an invisible wall, and the player cannot see why. Suggestion: P24's "Next"
   (0) and (1) together (let P21's hold on the way down go where the ground truly falls away; skip
   the point short of a knife edge's top), measured on these stands as well as on boulderrun's site.
3. **Physics nobody has watched move.** Grass parting round the feet, crowns in the gusts, rain
   and snow, the sea's swell, the ship's downwash: every claim is a number from Node or a strip of
   frames, and the one strip I filmed this block shows the downwash's kicked leaves as large flat
   dark-green blobs crossing a trunk a few metres from the lens, changing place by 30 to 50 px a
   frame (`docs/lead/evidence/motion-landing-pilot11.jpg`, frames 48 to 53; the drawing is
   PAINTER's, the flight PHYSICS'). Leaves kicked at the lens of a chase camera fill a tenth of the
   frame each. Suggestion: keep the downwash's kicked leaves and dust out of the 4 m in front of the
   camera (or below a size on screen), and film each of the motion kinds once at the top tier, as
   P23 did for the gale.

(Continued below once the play set is in: the storm, swimming, low flight.)
