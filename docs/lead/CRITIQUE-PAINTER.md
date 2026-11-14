# CRITIQUE (M4): PAINTER on PILOT and on PHYSICS

PAINTER 15 (the critic after PAINTER 14's block), 2026-11-13. The whole game played on a clean export of `16bb0d7`
(its code is `ca0b3db`: PILOT `904b6fe`, PHYSICS `2f924cd`, PAINTER `76d8182`; `16bb0d7` adds only notes and a sheet).
PHYSICS `ee39533` (the cliff run) and PILOT `cf7711c` landed while I played: not in these frames.

**How.** The real game (index.html, one browser of mine, software WebGL), the top tier pinned (quality 2, 960 x 540,
`dynres=0`), real key presses and mouse drags, the game's clock held and stepped (`__pc.hold`, `__pc.step`: 1/30 s where
motion is judged, 0.1 to 0.25 s on the long legs). To fit a machine that draws a top-tier frame in 8 s, the frames I did
not keep were simulated but not drawn (my harness swaps `painter.render` for a stand-in that only advances the shader
clock, as the real one does); every kept frame was drawn by the real painter. Three sittings, none with a console error,
a warning, a game error or a fall-back (`journey-log.txt`, `stations-log.txt`, `dusk-log.txt`; one frame, `pilot-43`, is
from a first try at the journey on the same export that my own harness stalled, not the game):
- **the journey** (from the loading sheet, no teleport): the title card, the first view, standing, looking round, walking,
  running, the first page of the sketchbook, the jetpack to 27 m and the fall, the help card, the sketchbook (three
  pages), first person, the walk to the ship, boarding, the cockpit, the map on the ground, lift-off, low flight over the
  wood, the climb to space, the map, Mars chosen with the arrow keys, aiming, the pulse drive (67 s), the arrival, the
  descent, "Land here", the landing, stepping out, walking and the jetpack on Mars, the book again;
- **the stations** (placed by the debug teleport and clock, then played with keys): the spawn in its fair breeze; the
  first thunderstorm at the spawn (the clock's 200 s: a new player's fourth minute), a forced lightning flash; the evening,
  the night (walking to the ship, the book, first person, boarding, lift-off, the climb) and the dawn as the clock runs;
  Earth's first view (walked up to, found, the slip, the book); Earth's coast (the sea, wading, swimming, then its storm);
  setting down in the wood by the spawn and stepping out; a blizzard on the alpine meadow; Neptune's storm coast in its
  squall on foot and in the hovering ship; a dust storm on Mars' dunes; Saturn's crystal reeds in a 24 m/s wind;
- **the dusk** again in the game's own framing.

Evidence: `docs/shots/painter/critique/` (`pilot-NN-*.jpg`, `physics-NN-*.jpg`, `numbers.txt`: how much each strip changes
from frame to frame; `scripts/`: the harness and the three runs). **Every file named below was opened by me at full
size.** Ranked worst first in each section; the first five of each are marked **FIX FOR SHIP**.

**Four things in my frames that are not the game a player gets** (so that nobody chases them):
1. Bare-paper frames at 0.25 s steps in the fast ship (leaving Earth at 350 m/s, arriving over Mars at 726 m/s): that is
   PAINTER's own arrival veil (`src/world/index.js`: a leap of the eye of more than 60 m in a frame holds the picture as
   paper). Mine to fix (see "Own side" in my notes): at under 15 frames a second an arrival at 900 m/s trips it for real.
2. Leaves and grass tufts hanging still in the air after a teleport (`physics-23`, `physics-24`: the sky does not change
   by 0.1 L* in 2.5 s): marks of the last place (a forest floor) left round the new one (a beach). Debug only; whose
   they are I did not establish (PHYSICS item 10).
3. The sketch slip stays up in many frames: its five real seconds were stretched (a frame takes longer than that here).
4. The hint says "hold the left mouse button and drag" because the headless browser has no pointer lock.

## PAINTER on PILOT

What PILOT built is, piece by piece, the most carefully painted interface I have seen in a game of this size: torn
slips, a hand that is drawn stroke by stroke, pencil rings round the keys, a brush stroke for "click to begin". None
of that is criticised here. What follows is where the pieces sit, what they cover, and what the cameras and the clock
make of the painting.

1. **FIX FOR SHIP. Stepping out: the first picture of every landing is your own wing.**
   - *Seen:* E in the landed ship. Under a second later the view is from above the hull: the wing, an engine nacelle and
     the canopy fill the lower right third of the frame, and the explorer stands behind the wing, visible from the chest
     up. It stays so until the player walks away. The same composition on Mars (the first step on a new world) and in
     Earth's wood. About two and a half seconds later the game keeps the frame then on screen as the sketch of the place: the sketchbook's
     page for Mars' Polar Frost Fields is a picture of the wing and the nacelle.
   - *Where:* `pilot-27-stepped-out-mars.jpg`, `pilot-26-stepout-mars-sheet.jpg` (frames out1 to out7),
     `pilot-30-stepped-out-earth.jpg`, `pilot-29-woodland-landing-stepout-sheet.jpg` (out1 to steppedout),
     `pilot-28-book-mars.jpg` (the sketch).
   - *Why it fails:* this is the game's hero frame (fly to a world, land, step out) and the one frame PAINTER composed
     nothing for, because every arrival I painted was shot from the spawn's own framing. `sim.js beginExit` turns the
     view along the hull until the boom is free of the hull's spheres; free of them, the lens sits over the wing with
     the hull between it and the figure. A camera that looks past the subject's own vehicle at the subject's hat is a
     bug report, not a painting.
   - *Suggestion:* choose the step-out view for the picture, not for the boom: the explorer in the lower third on the
     side away from the ship, the ship behind or beside them at the frame's edge (never between lens and figure, never
     over more than a sixth of the frame), the open land ahead. Test candidates by what the hull covers in the frame
     (project its spheres), not only by boom length; walk the explorer two or three steps clear of the wing during the
     transition; and hold the sketch until the ship is out of the middle of the frame.

2. **FIX FOR SHIP. The sketchbook keeps screenshots, and the book is a ledger of empty boxes.**
   - *Seen:* a "new page" is the game frame shrunk to 192 x 108 and shown at 130 x 73 in a ruled frame: a colour
     thumbnail with the explorer's back in the middle (or the wing, item 1). The book itself opens on fourteen identical
     rectangles, thirteen of them reading "not yet walked" or "a view to find", ten tabs each with a fraction
     ("0/11"), a tally ("1 of 114 pages drawn"), and every landscape and view of every world named before it is seen.
     Turning from Earth's page to the Moon's rescales the whole sheet (the word "sketchbook" is 115 px wide on
     Earth's page and 137 on the Moon's).
   - *Where:* `pilot-04-sketch-slip.jpg`, `pilot-07-book-earth.jpg`, `pilot-08-book-moon.jpg`, `pilot-28-book-mars.jpg`,
     `pilot-34-book-vista.jpg`.
   - *Why it fails:* the brief's one reward object. A sketch is not a small copy of the finished picture, and a
     sketchbook is not a completion table. A stamp-sized photograph on a slip is the single most digital thing on the
     screen; 113 empty boxes tell a player in a game with "no fail state" how much they have not done; and the names
     spoil every discovery ("Crater Fields II"). The rescale is `--pc-fit` taken from each page's own height.
   - *Suggestion:* (a) make the sketch a sketch: draw the kept frame through a small sketch treatment on the 2D canvas
     before it is stored (desaturate toward sepia and graphite, lift to paper at a ragged vignette, two or three flat
     washes, no hard rectangle), at twice the size on the page; hide the explorer for the frame that is kept. I will
     supply the treatment if PILOT wants it (PAINTER's note). (b) Show what has been drawn, large and loosely laid, a
     page per world; for what has not, bare paper and one pencilled line ("five more landscapes on Earth"); no names
     until found, no fractions on the tabs, the tally only at the foot. (c) One scale for the whole book.

3. **FIX FOR SHIP. The slips lie on the subject and on each other.**
   - *Seen:* (a) with the nose on a target the target's label ("Mars 457.6 km 75 s") sits exactly on the ship: for the
     whole pulse drive, a minute, the player's ship is a paper label with two red wing tips showing. (b) In space the
     names of the worlds are stacked four deep on one another ("Pluto" over three unreadable slips), and a marker's
     label lies across the notice and the prompt. (c) "a place to land" lies on the throttle gauge. (d) On foot a notice
     ("A view for the sketchbook: Temperate Forest") lies across the explorer from the hips down. (e) A long name runs
     off its slip and off the screen ("Alpine Meadow and Snow Peal").
   - *Where:* (a) `pilot-20-aimed-label-over-ship.jpg`, `pilot-22-pulse-label-over-ship.jpg`, `pilot-21-pulse-sheet.jpg`
     (in0 to pulse08); (b) `pilot-19-space-markers.jpg`, `pilot-18-slips-pile.jpg`; (c) `pilot-25-mars-land-prompt.jpg`,
     `pilot-24-descent-landing-sheet.jpg` (descent0, descent1); (d) `pilot-32-vista-found.jpg`; (e)
     `pilot-42-slip-title-cut.jpg`.
   - *Why it fails:* a label that hides the thing the picture is of. `game.js updateMarks` writes a target's label
     above its ring only in the cockpit; in the chase view it goes under the ring, where the ship is. Marker labels know
     nothing of each other or of the prompt, the notice and the gauges. `.pc-foot3 .pc-notice` sits at 17 % from the
     bottom; the figure's legs are there. The sketch slip is 172 px wide and lettering does not wrap.
   - *Suggestion:* one small layout pass each frame: the ship's (or the figure's) screen box is a keep-out; a target's
     label goes above its ring whenever the ring is within the keep-out; labels that overlap are pushed apart along the
     screen's edge or only the nearest to the nose is named (the rest keep their ring); "a place to land" and the
     edge arrow keep clear of the bottom band; the notice on foot goes to the top (where the hint is) or under the feet
     with the prompt; wrap the slip's title as the book's captions already are (`wrap()` in `book.js`).

4. **FIX FOR SHIP. A view is a spot, not a view.**
   - *Seen:* nothing in the painting or on the HUD says where a view is: at 34 m from Earth's first one the frame shows
     birches. Walk within 14 m, from any side, facing anywhere, and a notice appears; half a second later the frame on
     the screen is kept. The picture the easel was composed for (its heading and pitch) is never shown: the
     camera stays wherever the walk in left it. The only help is a line at the foot of the sketchbook: "the nearest
     view not yet drawn: Misty Wetland, 2.3 km ahead to the right". Earth's own first view is 2418 m from the spawn:
     nine minutes at the lope, with no mark to walk to.
   - *Where:* `pilot-31-vista-34m.jpg`, `pilot-32-vista-found.jpg`, `pilot-33-vista-first-person.jpg` (the view, with
     the notice across it), `pilot-07-book-earth.jpg` (the foot line), `stations-log.txt` (`vista placed ...
     "metresFromSpawn":2418`).
   - *Why it fails:* the vistas are the game's light goal and the places where PAINTER composed a picture on purpose. As
     played they are invisible proximity triggers 2 km apart whose reward is a thumbnail of wherever the camera
     happened to point. Half of this is mine: the easels' places and a mark in the world are PAINTER's (my notes).
   - *Suggestion:* PILOT: on finding a view, offer it ("E: stand at the easel"); ease the camera over two seconds to the
     easel's place, heading and pitch, hold it there while the sketch is taken, give the controls back on any key. Within
     150 m of an unfound view show one quiet mark (a small ring with "a view", as "a place to land" already is).
     PAINTER: a painted easel or cairn at each view, and a first view within 150 m of each spawn.

5. **FIX FOR SHIP. The clock: eleven minutes of every twenty-five are one blue, and the picture drops into it in forty
   seconds.**
   - *Seen:* Earth's day is 1500 s and a new game starts at 9.5 h, so night falls 9.6 minutes into a first sitting and
     lasts until 5.3 h: 10.6 hours, 11 minutes, 44 % of all play on Earth (Jupiter's day is 900 s). The evening holds a
     warm ochre from about 17 h to 18.3 h, then goes from that to a single dark blue between 18.3 h and 18.8 h (about
     35 s). Dawn is the same in reverse: nothing changes from 4.1 h to 5.2 h, then night to a rose morning between
     5.2 h and 5.7 h (30 s). In the night key the ship, the trees and the figure sink into one value (in
     `pilot-40` the ship 15 m ahead is one shade off the wood behind it).
   - *Where:* `pilot-35-dusk-sheet.jpg` (17.58 to 18.82 h, a frame every 10 s of play), `pilot-36-dusk-from-above-sheet.jpg`
     (16.8 to 19.1 h; the camera looks down because of a slip of my script: read it for the timing only),
     `pilot-37-dawn-sheet.jpg` (4.08 to 5.91 h), `pilot-38-night-sheet.jpg`, `pilot-39-night-prompt.jpg`,
     `pilot-40-night-seated.jpg`.
   - *Why it fails:* "the reward is wandering through paintings", and for 44 % of the time on the showcase world there
     is one painting, the hardest to read. The two hours the art bible names (rose dawn, gold dusk) are the shortest;
     the change between keys is quick enough to read as a switch. The night key itself is PAINTER's and too flat (my
     notes); how long the player sits in it, and how fast it arrives, is the clock (`bodies.js dayLength`, `orbits.js`).
   - *Suggestion:* an uneven clock: the sun moves at a quarter speed within 8 degrees of the horizon and at three times
     speed below it (dawn and dusk about three minutes each, night about four, the day as now), or a longer day with
     the same ratio. Start a new game at 8 h rather than 9.5 so that the first sitting ends in the gold, not the dark.

6. **Paper-white slips on indigo: at night and in space the interface is the light source.**
   - *Seen:* the slips keep their daylight paper whatever the painting's key. At night the prompt and the read-out are
     the only bright things on the screen; in space five or six slips out-shine the sun and the stars, three of them
     (read-out, prompt, throttle) all the time.
   - *Where:* `pilot-39-night-prompt.jpg`, `pilot-40-night-seated.jpg`, `pilot-38-night-sheet.jpg`,
     `pilot-19-space-markers.jpg`, `pilot-35-dusk-sheet.jpg` (the hint slip in frames 09 to 11).
   - *Why it fails:* art bible 1: paper is the light, so the brightest shape on the sheet is where the eye goes, and
     here that is always a label. By day the slips sit within the picture's range; by night they are stickers on it.
   - *Suggestion:* let the slips take the sheet's key: a CSS variable set from the mood each frame (the night grade and
     `inSpace01`), paper multiplied toward about (0.62, 0.68, 0.86) at full night; in space write the worlds' names in
     paper-white ink straight on the wash (masking-fluid lettering, no slip) and keep slips for the prompt alone.

7. **The title card is the manual, and it covers the painting.**
   - *Seen:* the first screen is a sheet 58 % of the picture's width and nearly all of its height carrying 21 rows of
     keys under two headings; the first view shows as two strips either side of it. The same sheet is the help card.
   - *Where:* `pilot-01-loading.jpg`, `pilot-02-title.jpg`, `pilot-06-help.jpg`.
   - *Why it fails:* "a watercolour to walk into" is introduced by a table. The best frame of the game (the spawn) is
     behind it, and the one moment a title could be lettered with a brush is given to a list.
   - *Suggestion:* the title alone on a small slip in the upper third (the name, the line under it, the stroke that
     says "click to begin"), the painting open under it; the keys on H, and the three a newcomer needs (walk, look, E)
     as prompts in the first minute, which the game already half does.

8. **Boarding is a whip pan and a vanishing; stepping out is a cut.**
   - *Seen:* E at the ship: the explorer takes two steps, and between 0.4 and 0.6 s is gone (no climbing in); in the same
     0.6 s the camera swings a quarter turn through the birches to the chase view; the whole thing is over in under a second and a half.
     Stepping out reaches the foot view (item 1) inside 0.8 s.
   - *Where:* `pilot-11-boarding-sheet.jpg` (board0 to board7, 0.2 s apart), `pilot-26-stepout-mars-sheet.jpg` (out0, out1).
   - *Why it fails:* art bible 7: moving should feel like the painting calmly repainting itself. Three unrelated
     pictures in six tenths of a second is the opposite, in the game's most repeated ritual.
   - *Suggestion:* two and a half seconds, eased; keep the explorer in frame until the canopy closes over them (walk to
     the hatch, a step up, the canopy down: PAINTER will pose it if PILOT gives the phase); or let the old picture go to
     paper and the new one come up out of it (PAINTER's `SHEET.laid` already does this for arrivals).

9. **The cockpit: a third of the frame is cowl, a dark hoop runs corner to corner, and the prompts sit on the view.**
   - *Seen:* from the seat the lower third is the cowl, a hoop as dark as anything in the game crosses the whole picture,
     and the prompt slips are placed in the middle of what is left.
   - *Where:* `pilot-12-cockpit-landed.jpg`, `pilot-47-cockpit-flight.jpg`.
   - *Why it fails:* the model is mine and I will lighten the hoop and paint the cowl (my notes). The eye point and the
     slips are PILOT's: the seat is low and far back, and `.pc-cockpit .pc-prompt` at 39 % from the bottom puts the
     paper on the horizon.
   - *Suggestion:* raise the eye 0.25 m and move it 0.3 m forward (the cowl to a fifth of the frame); pin the prompt and
     the notice to the cowl, where a painter would tuck a note.

10. **The foot camera goes through crowns and puts trunks on the lens.**
    - *Seen:* on the jetpack the lens passes through a crown on the way up (0.5 to 1 s) and again on the way down: flat
      green slabs over half the frame. Walking in the wood, a birch a metre from the lens covers the left fifth of the
      frame as a white slab.
    - *Where:* `pilot-05-jetpack-sheet.jpg` (jet0, jet1, fall6, fall7, landed), `pilot-43-trunk-at-the-lens.jpg`,
      `pilot-04-sketch-slip.jpg` (the right edge).
    - *Why it fails:* a crown from inside is not a painting (PHYSICS said so of my crowns: mine too); the boom tests
      the ground and the hull only. The landing's chase camera now keeps out of crowns (`b0e9aba`: in my woodland
      landing, `pilot-29`, no crown reaches the lens), so the means exist.
    - *Suggestion:* give the foot boom the same crown and trunk test as the ship's (`crownDistance`): shorten for a
      crown, slide sideways round a trunk nearer than 1.5 m.

11. **The figure as PILOT hands it over: no lean, in a run or in a hurricane.**
    - *Seen:* the walk at 4.2 m/s and the run at 7.5 m/s are the same upright figure with quicker legs; in Neptune's
      squall (77 m/s where the explorer stands) the figure stands straight with its arms held out.
    - *Where:* `pilot-44-walk-run-sheet.jpg`, `physics-19-figure-in-the-squall.jpg`.
    - *Why it fails:* `src/player/figure.js figureArgs` passes mode, stride, feet, hips and crouch, and nothing about
      which way and how far the body leans (PHYSICS computes a lean of 23 to 33 degrees there: its own critique, item 1
      on PAINTER) or about the wind on the figure. The scarf and coat that do not answer are mine.
    - *Suggestion:* pass `lean` (pitch and roll, radians), the wind at the figure in its own frame and the body's
      acceleration; I will turn the trunk and fly the scarf from them.

12. **Arriving, the ship lies on its side over the new world.**
    - *Seen:* when the pulse lets go the picture's up is the planet's; the ship keeps its own attitude and is drawn
      rolled about a quarter turn, small, in the middle of the disc.
    - *Where:* `pilot-23-arrival-mars.jpg`, `pilot-21-pulse-sheet.jpg` (pulse10, arr0).
    - *Why it fails:* the second hero frame of every trip (a new world filling the sky) has a toy on its side in it.
    - *Suggestion:* ease `level01` in over three seconds after the drive lets go, and roll the hull level with it.

13. **The map: ten dots.**
    - *Seen:* each world is a flat dab 8 to 14 px across in a tint chosen "only to tell the dots apart" (`map.js TINT`);
      Saturn has no ring; the sheet is mostly blank; "here" is a red tick two letters wide.
    - *Where:* `pilot-13-map.jpg`, `pilot-14-map-mars.jpg`.
    - *Why it fails:* the one place where all ten worlds are on one sheet, in a game whose worlds are each painted from
      orbit, shows none of them. The pencilled orbits and the lettering are good.
    - *Suggestion:* a small wash portrait of each world, 24 to 36 px, from PAINTER's orbit palettes (I will give `map.js`
      two or three pigments, a band or a ring per world in `src/data/looks`); a thin indigo wash round the sheet's edge.

14. **The cursor is a gun sight.** Four ruler-straight bars and a dot (`paint.js cursorUrl`), shown wherever the mouse
    is free (the map, the book, before the first click). `pilot-46-cursor-x10.png`. A calm painting game with a
    crosshair, and the art bible's "silhouettes never ruler-straight". A brush tip or a loose dab of ink.

15. **The place's name never appears where it should.** "Earth" is not shown when a new game begins (the six seconds
    run out behind the title card: `pilot-03-first-view.jpg` has no slip) and is shown when the player sits down in
    the ship (`pilot-12-cockpit-landed.jpg`, `pilot-11-boarding-sheet.jpg` seated). Start the six seconds at the first
    frame after "click to begin" and at stepping out, not at boarding.

16. **Type that is not lettered.** The frame read-out (the backquote key, named on the title card) is five lines of
    monospace on the largest slip in the game (`pilot-41-stats-readout.jpg`); the sentences on the loading sheet
    ("still loading...", "the paper is being redrawn...") are italic Georgia (`theme.css #pc-loading`; read in the
    code, not seen in a frame). Letter them with `ink()` like everything else.

17. **Leaving the air: the sky goes from blue to indigo between two frames.** At 110 to 150 m/s the sky is a clear blue
    wash at 490 m and a starred indigo at 640 m, 2.5 s later (`pilot-16-low-and-climb-sheet.jpg`, climb3, climb4). The
    washes are mine; the height over which `inSpace01` runs is PILOT's. Spread it over 400 m more.

Not criticised, and good: the lettering; the torn slips and key dabs by day; the pulse drive's streaks coming up over
1.5 s (`pilot-21`, in0 to in7); low flight over the wood (`pilot-17-low-flight.jpg`); the landing camera in the wood
(`pilot-29`, landing3 to landing9); the first view and the walk to the ship (`pilot-03`, `pilot-10`).

## PAINTER on PHYSICS

First the thing PHYSICS got right for a painter: nothing shimmers. In every strip of consecutive frames (1/30 s apart)
but the dust storm's, 1.3 % of the picture's pixels or fewer move by more than 6 L* (`numbers.txt`: the fair day 0.2 %,
the thunderstorm 0.4 %, the blizzard 1.1 %, the reeds 0.9 %; the dust storm 1.4 to 2.5 %, which is its sand moving), and
0.5 % or fewer flick there and back. Stability, art bible 7, holds in all
weather. The complaints are the other way round: too little that reads, and a few marks that are not a painter's.

1. **FIX FOR SHIP. On a fair day the painting does not move; in the thunderstorm the grass still does not.**
   - *Seen:* at the spawn in its usual breeze (1.6 to 2.3 m/s, a new game's first two minutes) frames half a second
     apart are the same picture: 0.8 % of pixels differ by more than 6 L*, 1.8 % after 3.5 s; looking up into the
     crowns, 1.7 % and 2.8 %. No blade, no crown edge, no leaf can be seen to move; nothing falls, nothing flies. In the
     thunderstorm two minutes later (gusts to 9 m/s) the crowns sway, slowly and well, and leaves fly, but the meadow
     at the explorer's feet is still: 0.6 % per 0.4 s.
   - *Where:* `physics-01-fair-day.jpg`, `physics-02-fair-grass.jpg` (frames 0, 2, 4, 7), `physics-03-fair-crowns.jpg`,
     `physics-08-storm-crowns.jpg`, `physics-09-storm-grass.jpg`, `numbers.txt` (b00-calm-slow, b00-calm-crowns,
     b03-storm-slow).
   - *Why it fails:* art bible 9, "Life: wind through foliage masses", and the freeze-frame test's last words, "Then it
     moves." A birch that leans a fraction of a degree in 2 m/s is correct and reads as a still image; a player's first two minutes
     are spent in a photograph of a painting. For the grass I could not tell from frames which link drops the motion:
     PHYSICS' soft bend and flutter at blade height, or how far my near strokes follow it (`materials.js NEAR_VERT`,
     `flex`). I will measure my side first in the fix round.
   - *Suggestion:* a floor under what the eye is given, separate from the load the physics computes: in any air that
     moves at all, crown edges breathe 3 to 6 cm at 0.3 to 0.5 Hz in slow coherent masses, and a gust front crosses the
     meadow every 8 to 15 s, bending the sward 10 to 15 degrees for a second and a half (the honami PHYSICS already
     models, given a visible amplitude at 2 m/s); a leaf or a seed adrift every few seconds. Calm, large, slow: the
     opposite of flicker.

2. **FIX FOR SHIP. Snow: dabs with no memory, and ruled lines at the lens.**
   - *Seen:* in the blizzard (13 to 14 m/s) each frame shows fifteen to twenty pale dabs in a quarter of the sky, in
     places unrelated to the frame before (a flake travels 0.45 m in 1/30 s): at 30 frames a second that is a sparkle,
     not snowfall. Walking into the wind, the flakes nearest the lens become thin straight lines up to 100 px long,
     fanning from the middle of the picture like the lines of a zoom.
   - *Where:* `physics-10-snow-consecutive.jpg` (three consecutive frames), `physics-11-snow-ruled-lines.jpg`,
     `physics-12-snow-walk-sheet.jpg` (walk2).
   - *Why it fails:* art bible 4: never ruler-straight; and a mark that is somewhere else every thirtieth of a second
     is the sub-second flicker the bible forbids, however few pixels it moves. The veils of falling snow in the sky wash
     (`pilot-42-slip-title-cut.jpg`) carry the blizzard far better than the flakes do, and they are still.
   - *Suggestion:* give me, per flake, where it was a frame ago as well as where it is (or its velocity over the frame),
     and cap what a streak may be: I draw each as one short dry-brush stroke along its path, curved by the gust, no
     longer than about 30 px, fading within 2 m of the lens. Fewer, larger, slower flakes near the eye (a calm game can
     let the near snow fall at 2 m/s whatever the wind) and the veils for the storm's weight.

3. **FIX FOR SHIP. The heaviest rain of the storm cannot be seen against the land.**
   - *Seen:* at the thunderstorm's height (rain 0.89 of full, "20 mm/h and more") the view across the meadow shows a
     darker key, mist, flying leaves, and no rain: consecutive frames differ in 0.4 % of their pixels. Looking up, a
     dozen thin pale strokes show against the dark cloud and nowhere else.
   - *Where:* `physics-04-storm.jpg`, `physics-06-storm-no-rain-zoom.jpg` (three consecutive frames, x2),
     `physics-07-storm-looking-up.jpg`, `physics-05-storm-sheet.jpg`.
   - *Why it fails:* the first weather a new player meets (minute three) reads as a filter over the picture. A painter
     does rain as broad slanted strokes dragged across the whole sheet and as veils, dark against light and light
     against dark; a few hairlines visible only on indigo are neither. The drawing is mine (the kits), the number,
     length and grouping of the strokes are what PHYSICS hands me.
   - *Suggestion:* PHYSICS: hand over rain as sheets as well as drops: per gust front a band (direction, slant, density,
     depth) that I lay as a dragged wash over land and sky alike, and three to four times the near strokes at this
     intensity, longer (0.6 to 1 m). PAINTER: strokes a value darker than what is behind them where that is light.

4. **FIX FOR SHIP. The water takes no mark, and a storm does not show on it.**
   - *Seen:* wading in at 2.5 m/s and swimming at 2 m/s leave the sea untouched: no ring, no wake, no white at the legs
     or the shoulders; the only splashes are small white shards along the swash line away from the figure, and at
     the storm's waterline a fan of straight white needles. Earth's coast in its storm (12 to 14 m/s) is a slate wash
     with a few pale streaks and no breaking crest; Neptune's sea in a 75 m/s squall changes 0.1 % of its pixels from
     frame to frame and reads as a slow swell.
   - *Where:* `physics-14-wading.jpg`, `physics-15-swimming.jpg`, `physics-13-wade-swim-sheet.jpg`,
     `physics-16-coast-storm.jpg`, `physics-17-coast-storm-sea.jpg` (frame 4: the needles), `physics-20-neptune-sea-consecutive.jpg`,
     `physics-18-neptune-squall-sheet.jpg`, `numbers.txt` (b53-gale-sea).
   - *Why it fails:* art bible 9: water as horizontal strokes with bare-paper glints; a body in water is drawn by what
     it does to the surface. The swimmer is a hat on a wash. The storm sea is the coordinator's ruling already (lift the
     white cap); I add the painter's half: I will paint whatever white comes as broken foam and streaks, but it has to
     come as shapes (crest lines, streak directions, spray bands), not as one cover number.
     PHYSICS already keeps wakes for a body in liquid (`water.js`: "a swimmer's ripples are a metre long"); none can be
     seen in these frames, so either their height is under what a wash can show or my water does not draw them: I
     will check my side first.
   - *Suggestion:* a wake a painter can see: rings and a short V of a few centimetres' height behind anything moving in
     liquid, and a collar of broken white where the body meets the surface (a mark for me to draw, not only a height);
     splashes as two or three curved drops, not needles; for the sea, crest lines with a breaking fraction and wind
     streaks I can lay as dry-brush.

5. **FIX FOR SHIP. The gale has no rhythm.**
   - *Seen:* on Neptune's storm coast the wind where the explorer stands reads 77, 61, 52, 69, 25, 12, 24, 15 m/s in
     eight tenths of a second, and 49, 108, 77 a moment later; at the ship 30 m up, 122 to 222 m/s. Nothing in the
     picture follows it: the sea rolls slowly, the rain slants one way, the figure stands. What the player sees of the
     storm's force is the figure shortening by about a tenth (the crouch) and lengthening again.
   - *Where:* `physics-18-neptune-squall-sheet.jpg`, `physics-19-figure-in-the-squall.jpg` (g0 to g7, w5, w6),
     `numbers.txt` (the wind, frame by frame: b51-gale, b52-gale-walk, b54-gale-ship).
   - *Why it fails:* a sixfold change inside half a second is noise, and noise cannot be painted; a gust that paints
     has a front, a second or two of blow, and a lull. The crouch without a lean reads as sinking into the ground
     (the lean is lost in PILOT's `figure.js`: PILOT item 11).
   - *Suggestion:* what is handed to the picture (figure, flora, sea, rain slant, the HUD's wind if ever shown) should
     be the gust envelope, one to three seconds long, not the turbulent sample; keep the sample for the forces if the
     feel needs it. Crouch with the lean, and hold the crouch through the gust.

6. **The walk and the run paint the same.** 4.2 m/s and 7.5 m/s are one upright figure with a still coat; only the legs
   are quicker (`pilot-44-walk-run-sheet.jpg`). If the gait has a forward pitch of the trunk, an arm swing and a
   bounce of the coat's hem, they do not reach the figure; say which numbers carry them and I will draw them.

7. **Crystal reeds sway like rubber.** In 10 to 24 m/s Saturn's 4 m crystals bend 15 to 25 degrees and back in about a
   second and a half, as grass would (`physics-22-reeds-zoom.jpg`, s0 to s5; `numbers.txt` b71-reeds-slow: 6 % of the
   picture per third of a second, 2.3 % there and back). Crystal should stand and tremble: a tenth of the amplitude at
   three times the frequency for anything PAINTER marks as mineral (I will mark them).

8. **A tumbling leaf changes colour from one frame to the next.** In the storm and the blizzard single leaves go orange,
   dark red, near black within 1/30 s as they turn (`physics-06-storm-no-rain-zoom.jpg`, the leaf at the middle;
   `physics-10-snow-consecutive.jpg`, the dark speck). Tiny, but it is flicker. Turn them at 1 to 2 Hz, or hand me the
   face angle smoothed and I will keep one wash on both faces.

9. **The ship is rigid.** What I saw of its motion is clean: lift-off a smooth rise with pale puffs under it
   (`pilot-15-liftoff-sheet.jpg`), the landings smooth (`pilot-24`, `pilot-29`), in Neptune's squall a steady 15 to 20
   degree bank (`physics-18`, ship0 to ship7). But hovering and cruising it is a model on a stick: no breath in the
   hover, no settling on its gear after touchdown. I did not test turns or the brake, and did not see the 16 m jump
   PHYSICS reports at lift-off (my film stops at 8 m). A slow 0.2 Hz heave of a few centimetres in the hover and one
   soft rebound on the gear would give it weight without disturbing the calm.

10. **After a debug teleport, the last place's litter hangs in the air (owner not established).** Teleported from the
    forest to Earth's beach, fallen leaves and grass tufts stand still in the air round the explorer at up to several
    metres, in a 7 m/s wind, and the beach under them is bare; they stay where they are as the explorer walks away
    (`physics-23-litter-hanging-after-teleport.jpg`, `physics-24-litter-zoom.jpg`, `physics-13-wade-swim-sheet.jpg`
    wade00, wade01). No player sees it; every evidence frame taken by teleport can (mine here, a tour, the
    coordinator's visits). I did not find the cause: PHYSICS' particle buffers are emptied when its frame is anchored
    afresh (`particles.js`, `reborn`), so it is either a re-anchor that carries resting leaves, or PAINTER's own near
    layer keeping marks through a leap. I will look at my side first; PHYSICS, please check a leap of 300 to 1200 m.

Good, and to be kept: the dust storm on Mars, whose pale drags of sand across the dunes are the best weather mark in
the game (`physics-21-dust-and-reeds-sheet.jpg`); the slow sway of the birches and the flying leaves in the thunderstorm
(`physics-07-storm-looking-up.jpg`, `physics-08-storm-crowns.jpg`); the rings on the wet shore at the figure's feet on
Neptune (`physics-19`); the foam line of the swash on a fair day (`physics-14-wading.jpg`).

## Not verified

- Nothing at 1920 x 1080, nothing on a real GPU, no sound, no gamepad, no real pointer lock.
- Of the worlds, only Earth and Mars were reached by flying; Neptune, Saturn and the alpine meadow by teleport. Venus,
  Mercury, Jupiter, Uranus, Pluto and the Moon were not visited in this critique.
- The "mixing the colours" line of the loading card (the screenshot came back only when the card already said "click
  to begin").
- Turning, braking and the lift-off's last second in the ship; the landing assist's forces (PHYSICS' items, not judged).
- Which link keeps the grass still in a storm (PHYSICS item 1): not isolated.
- Frames skipped by my harness were never drawn, so anything that only shows between kept frames is unseen.
