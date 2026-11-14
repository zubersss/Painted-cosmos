# CRITIQUE (M4): PHYSICS on PILOT and on PAINTER

PHYSICS 23 (hand-over P25), 2026-11-12. The whole game played on a clean export of `8809fff` (PILOT's `b0e9aba`, the
landing camera kept out of crowns, landed after I played; noted where it bears): in the real game (index.html,
one browser, software WebGL, quality 1, 640 x 360, the game's clock held and stepped by fixed steps, 1/30 s where motion
is filmed (what a player at 30 frames a second gets) and 0.1 to 1 s on the long legs; real key presses and mouse drags;
no teleport from the title card to Mars), and the
same journey replayed with keys and mouse in PILOT's own Sim in Node on the real world, PHYSICS and obstacles (60 Hz), where
a step-by-step trace gives the numbers. Every sheet named below was opened. Evidence is in `docs/shots/physics/critique/`
(`play-*.jpg` with `.json`: sheets from the game, the numbers of each frame beside them; `*.txt`: Node traces).

What I played: the title card, the spawn; walking, running, a stop; the jetpack to 34 m and the fall; walking to the ship
and boarding; lift-off; full throttle; low flight over the wood; a hard turn; the brake; a landing in the wood; lift-off
again, the climb to space, the map, Mars chosen, aimed, the pulse drive, the arrival, the descent and a landing on Mars,
stepping out, running and the jetpack on Mars (the browser run); swimming off Earth's coast in its storm, Mars' dunes in a
dust storm, Saturn's crystal reeds in a 24 m/s wind, Earth's spawn in its first storm (a second browser run, placed by the
debug teleport); the ship hovering in Neptune's squall and Earth's storm (Node).

Ranked worst first in each domain; the top five of each are marked **FIX FOR SHIP**. The Node traces of PILOT's items 1
and 2 (`camlift.mjs`, `landfast.mjs`) were re-run on `b0e9aba`: the same to the digit.

## PHYSICS on PILOT

1. **FIX FOR SHIP. The ship teleports 16 m upward at the end of every lift-off under trees** (the first lift-off of the game
   is one).
   - *Seen:* the ship rises off its gear among the birches at the spawn to 8.5 m; one frame later it is 24.8 m up, on top of the
     crowns, and the chase camera jumps with it (camera over the ground 12.0 m -> 28.3 m).
   - *Where:* `critique/play-10-liftoff.jpg`, frames 6 -> 7 (32.3 -> 32.8 s, frames 0.5 s apart; its JSON: camera over the
     ground 11.92 -> 29.11 m): among the tree tops, then over the canopy with the horizon. `critique/camlift-head.txt`
     lines 107-108 (PILOT's Sim, 30 Hz): ship over the ground 8.46 m -> 24.80 m in one step.
   - *Why it fails:* `src/ship/flight.js` ends the lift-off at `hoverHeight` over the bare ground (`g0 = floorAt(env.sample,
     ...)`); the next step free flight's floor is the canopy floor (`env.floor`: 23 m crowns), and the clearance clamp
     `p = scale(up2, g2.floor + T.minClearance)` puts the hull on the crowns at once: a position clamp, not a force. A 4.2 t
     hull does not move 16 m in a frame.
   - *Suggestion:* end the lift-off on the floor free flight uses (rise to `hoverHeight` over `env.floor`, or keep the
     sequence running until the hull is over it, through PHYSICS' body as its second half already is), and make the
     `minClearance` clamp a bounded push (toward floor + clearance at no more than the hull's lift, about accelLift + g =
     24 m/s^2), so that no change of state can move the hull by metres in one frame.

2. **FIX FOR SHIP. The landing assist slams the brakes, lurches, then plunges into the wood.**
   - *Felt:* "Land here" is offered at full speed (46 m/s, 15 m over the crowns; the game showed it at 44.6 m/s in
     `play-11-throttle.json`). E there brakes the hull from 46 to 14 m/s in 0.4 s: 18 g on the first frame (179 m/s^2),
     still 5 g after 0.4 s. E over the wood at 1.8 m/s: the first 0.2 s throws the hull sideways and down at 4.4 g (aH 43-46
     m/s^2, aUp -41 to -44); then either way it drops at up to 12.8-17 m/s from 29-38 m and brakes at about 0.8 g to touch at
     0.7 m/s. In the game, E at 15 m/s and 25 m over the crowns (HUD "25 m up"): the assist picked ground 26 m away and dropped
     the hull at 13 m/s for 2 s from 46 m into a clearing, the chase camera diving through the crowns with it (on
     `8809fff`; PILOT's `b0e9aba`, committed while I wrote, keeps the landing's chase camera out of crowns: not seen by me).
   - *Where:* `critique/landfast-head.txt` (E at 46 m/s), `critique/land-head.txt` (E at 1.8 m/s, from 30.90 s); 60 Hz.
     The game: `critique/play-15-prompt-land.jpg` (the HUD before E), `critique/play-16-landing.jpg` (frames 0-11, 0.4 s
     apart: vertical speed -9.6, -12.2, then -13.0 m/s held to 16 m; frames 6-8 the lens in the crowns and a branch).
   - *Why it fails:* `stepLanding` drives the hull kinematically, not through PHYSICS' body: it takes the velocity to its glide
     at once whatever the hull is doing; `landMaxDescent` 13 m/s; the prompt does not wait for a speed the hull can shed.
   - *Suggestion:* offer "Land here" only under a speed the brake sheds in a second or two (about 12 m/s), or say "slow down
     to land" as the stall case already does; start the glide and the descent from the hull's own velocity, ramped over
     about 0.6 s at no more than the hull's own decelerations (PHYSICS: 14 m/s^2 reverse, 18 sideways); cap the descent near
     6 m/s; or hand the glide to PHYSICS' body with the landing target, as the lift-off's second half already does.

3. **FIX FOR SHIP. The ground assist overrides the hull's mass: one-frame jolts and rocket climbs.**
   - *Felt:* skimming the wood at 46 m/s, the descent stops dead, -5.6 -> +0.2 m/s in one frame (35 g), each time a crown or a
     rise enters the look-ahead; at the foot of a 60 degree slope the ship is shot upward from 3 to 71 m/s in 0.5 s (22 g
     sustained) with its nose still 12 degrees down, overshoots 35 m above the ridge and comes down at 5 g; hovering 20 m up
     in Neptune's squall with no input, the hull sinks to 4 m and one frame flips it from -3.5 to 0 m/s (19 g), then it is
     lifted back at 7 m/s. The chase camera is fixed to the hull's position (`updateShipCamera`: only its turn lags), so every
     snap is a jump of the whole picture.
   - *Where:* `critique/low-head.txt` (60 Hz, low flight from the spawn with the nose 12 degrees down: single-step snaps at
     26.27 s, 34.57 s and 41.22 s of 5.8 to 8.5 m/s; 41.5 to 43.2 s the climb to 71 m/s); `critique/nepship-head.txt`
     (225.30 s and 226.68 s); `critique/journey-head.txt` (20 s of low flight: vertical acceleration -52 to +485 m/s^2,
     |jerk| up to 29 000 m/s^3); in the game, `critique/play-12-low.jpg` (see its JSON: the height over the crowns and the
     vertical speed frame by frame).
   - *Why it fails:* after PHYSICS' body has moved the hull, `stepFlight` rewrites the velocity with `shapeTarget` ("the ground
     is never a wall") with no limit on the change in a step, and the pull-up's look-ahead is a fixed 0.8 s: 37 m at 46 m/s,
     inside which a 60 degree slope rises 64 m, so it is seen late and the climb asked is need / 0.4 s. The hull can lift
     14 m/s^2 beyond its weight.
   - *Suggestion:* keep the assist on the body's target (it already shortens tau to 0.22 s there) and clamp the direct
     override to what the hull can do, |dv| <= (accelLift + g) dt (more only within the last 2 m); stretch the look-ahead
     with speed (lookAhead x max(1, v / 20 m/s)) so a slope is met with a gradual climb; let the nose rise with the climb
     (the flare already pitches it the other way); give the chase camera a little positional lag (a spring of 0.15-0.25 s)
     so a hop of the hull is not a jump of the world.

4. **FIX FOR SHIP. The cameras go through the crowns.**
   - *Seen:* jetting up from the spawn and falling back, the foot camera passes through crowns: flat green slabs and a branch
     fill a third to half of the frame; after the landing the "Board ship" prompt shows while a crown hides the ship; the
     landing chase camera dives through crowns (item 2) and sits in them as the ship sets down.
   - *Where:* `critique/play-05-jet.jpg` frames 1-3, `critique/play-06-fall.jpg` frames 10-11,
     `critique/play-07-prompt-board.jpg`, `critique/play-16-landing.jpg` frames 6-8; PILOT's own
     `docs/lead/evidence/motion-landing.jpg` (372 pops, first frame).
   - *Why it fails:* the cameras keep clear of the ground and of trunks (`cameraSolids`), not of crowns; seen from inside, a
     crown is flat polygons (PAINTER, below).
   - *Suggestion:* treat the canopy as space the camera avoids (`sampleSurface` canopyHeight and canopy01, a trunk's crown
     radius from `sampleObstacles`): shorten the boom or lift the camera through a crown, eased as the foot boom is; on a
     jetpack climb lead the camera above the figure. (While I wrote this PILOT 11 committed `b0e9aba`: the landing's chase
     camera keeps out of crowns, `crownDistance`; I have not filmed it. The foot camera needs the same, on the way up and
     on the way down, and after a landing.)

5. **FIX FOR SHIP. Swimming is wading.**
   - *Seen:* off Earth's coast, 6 m over the seabed, the explorer floats upright and glides at 2.05 m/s with no stroke, drawn
     in its wading pose; a jump from the water rises at 1.8-2.3 m/s.
   - *Where:* `critique/swim-head.txt` (Node: the walk into the sea in the storm and in calm, mode each 0.5 s);
     `critique/play-42-sea-swim.jpg` and `play-43-sea-swim.jpg` (the game); `docs/shots/physics/motion-game-float-earth.jpg`.
   - *Why it fails:* `src/player/explorer.js` sets mode `'wade'` whenever `st.swimming` (lines 240 and 336), and the figure has
     no other pose for it. A body afloat that moves at 2 m/s is doing something; nothing shows what.
   - *Suggestion:* a `'swim'` mode (PILOT) drawn as a swimmer (PAINTER: the body near level, a stroke every 1.5-2 m of
     travel, a slow tread at rest); PHYSICS already reports `submerged01` and the pace.

6. **Stepping out puts the camera behind the hull; it then pops to the shoulder.** On Mars, E to step out: the foot camera
   starts behind the ship, the wing filling the lower half of the frame and the explorer beyond it (`critique/play-28-mars-out.jpg`);
   running away, the camera follows behind the wing for a second and then in one frame jumps forward to a metre behind the
   explorer's head (`critique/play-29-mars-run.jpg`, frames 16 -> 17, 1/15 s apart; camera height 2.71 -> 2.07 m). Start the
   foot camera on the explorer's side of the hull, behind the figure; when the hull comes between, ease the boom in as it
   eases out.

7. **The board transition hides the walk.** E 8.5 m from the ship: the camera swings about 130 degrees in 1.3 s and the
   explorer is out of the frame after 0.2 s; it is never seen walking to the hatch (`critique/play-08-board.jpg`). Carry the
   figure to the hatch at a walking pace (2-3 s from 8.5 m) with the camera behind it, or show the prompt within 4 m.

8. **The jetpack refills in the air** (after 0.9 s, a tank in 10 s): falling from 55 m on Earth the gauge climbs to 0.47 before
    the feet touch; on Mars, from a jet to 45 m, it is full again (0.65 -> 1.00) before the top of the arc is 4 s behind
    (`critique/play-31-mars-fall.json`), so on the light worlds the explorer can stay up as long as the player likes, burn
    and coast. The README says "it refills on the ground". If the air refill is wanted, say so in the README; if not,
    refill only on the ground or in water.

9. **Hard turns pull 6.5 g and lose half the speed.** Mouse hard right at 60 m/s: the velocity turns 142 degrees in 4 s at
   up to 64 m/s^2 sideways and the speed falls to 30 m/s (`critique/turn-head.txt`, `critique/journey-head.txt`). The
   hull's own side thrust is 18 m/s^2 and its bank at most 35 degrees; `carve01` (0.75 at 53 m/s) turns the rest of the
   velocity by fiat. Either bank harder to sell it (a 6.5 g coordinated turn is 81 degrees of bank) or cap the turn rate
   near 2 g (0.37 rad/s at 53 m/s). Low impact in a calm game.

10. **The ship kicks off at 2.2 g.** Full throttle from a hover: 0 -> 20 m/s in 1.6 s, 40 in 2.7 s (`critique/journey-head.txt`):
   PHYSICS' engines at their limit because `tauAtmo` 1.0 s asks for 46 m/s^2 on the first press. Snappy, not "unhurried,
   weightless". A tau of 1.6-2 s near the ground, or a throttle slew, would read heavier and calmer.

11. **HUD at a small window.** At 640 x 360 long notices run off the right edge ("M opens the map: choose a world, point the
   nose at its mark, pres", `critique/play-19-space.jpg`; "Thin air on Mars: ... Hold X to slo", `play-26-mars-prompt.jpg`);
   aimed at Mars, the target's label sits on the ship and hides all but a wingtip (`play-22-aimed.jpg`); the edge arrow
   "a place to land 2.7 km" overlaps the throttle gauge (`play-26-mars-prompt.jpg`); on the title card the frame read-out's
   key cap reads as empty (the backquote is a speck in the handwritten face, `play-00-title.jpg`). Wrap notices to the
   window; keep the aimed label below the hull; keep edge markers clear of the gauges; write the backquote as a word.
   (The picture behind those two shots is bare paper only because my held clock moved the eye more than 60 m between
   frames, which PAINTER's arrival veil holds as paper while the land is laid: not a fault at a real frame rate.)

## PHYSICS on PAINTER

1. **FIX FOR SHIP. The figure ignores the wind: no lean, and the coat and scarf hang as in a calm.**
   - *Seen:* in Earth's thunderstorm at the spawn (9-13 m/s at 2 m, gusting) the explorer stands bolt upright, the scarf
     hanging straight down its back and the coat still, while leaves stream past; in Neptune's squall (47-80 m/s at 2 m)
     PHYSICS has the body leaning 23-33 degrees into the wind and down at 0.6-0.9 of a crouch; the figure crouches (the hips
     ride PHYSICS' fold) and its torso tips with the crouch toward wherever it faces, never toward the wind (in that strip
     it faces the wind, so it half reads; side-on or back to a gale it would lean the wrong way), and its cloth is still.
   - *Where:* `critique/play-49-storm-trees.jpg` (and `play-50-storm-trees.jpg`, 12 frames at 15 a second);
     `docs/shots/physics/motion-game-gale-neptune.jpg` with its `.json` (`lean` 23.2, 24.3, 32.8 degrees at 0.6, 1.6, 2.1 s).
   - *Why it fails:* `src/art/models.js` streams the scarf and flares the coat only with the walk or in the air, and nothing
     leans the torso into a wind; `src/player/figure.js` (PILOT) does not hand over `phys.lean` or the wind. The body PHYSICS
     moves is leaning on the air; the one drawn is not.
   - *Suggestion:* PILOT: pass `lean` (`st.phys.lean`, rad, atan(windAccel / g)) and the wind at the figure in the figure's
     own frame (`physics.here.air.wind` less the walk); PAINTER: tip the torso toward the wind by `lean` (less while
     walking into it, as the hips already fold), stream the scarf downwind at an angle growing with the wind's square
     (flat out by 15 m/s on Earth), and let the coat's hem flap with `gust01`.

2. **FIX FOR SHIP. There is no swimmer.** Floating 6 m over the seabed and moving at 2.05 m/s, the explorer is drawn wading:
   upright, shoulders out of the water, arms held out at its sides, no stroke, gliding (`critique/play-41-sea-walkin.jpg`
   frames 25-29, `play-42-sea-swim.jpg`, `play-43-sea-swim.jpg`; `docs/shots/physics/motion-game-float-earth.jpg`). With
   PILOT's `'swim'` mode (PILOT item 5): the body near level in the water, a stroke every 1.5-2 m of travel from PHYSICS'
   pace, a slow tread and a bob at rest (PHYSICS' heave is already in the body's height).

3. **FIX FOR SHIP. Crowns seen from inside are flat green slabs.** Whenever a camera is in a crown (the jetpack climb and
   fall at the spawn, the landing's dive into a clearing, standing by a trunk after landing), the foliage is drawn as large
   flat hard-edged polygons and a black branch bar filling a third to half of the frame (`critique/play-05-jet.jpg` frames
   1-3, `play-06-fall.jpg` frames 10-11, `play-07-prompt-board.jpg`, `play-16-landing.jpg` frames 6-8). PILOT should keep
   cameras out of crowns (PILOT item 4), but a crown a metre from the lens will still happen: dissolve foliage within about
   3 m of the camera (fade and break its silhouette into dabs, as the near grass is) instead of drawing it as one wash.

4. **FIX FOR SHIP. The storm sea reads calm (at quality 1).**
   - *Seen:* Earth's coast in its storm (13-16 m/s, drizzle then rain): a smooth blue-grey band with two white specks in the
     whole frame and no white water at the beach, where PHYSICS has a sea of Hs 0.47 m breaking at the waterline (0.62 m
     at the reference) and 4.8 % of its surface white; Neptune's squall: an indigo band, a thin surf line, no spume in the
     air, under 47-80 m/s of wind over a sea PHYSICS raises to Hs 3.6-3.9 m with 12 % white.
   - *Where:* `critique/play-40-sea-start.jpg`, `critique/play-41-sea-walkin.jpg` frames 0-10, `play-43-sea-swim.jpg`;
     `docs/shots/physics/motion-game-gale-neptune.jpg`; `coast.mjs` on this tree (both stands PASS: the sea map is right).
   - *Why it fails:* what moves (a breaking sea, white water at a beach, spray off the crests in a gale) is not what shows: at
     640 x 360 and quality 1 the white horses and the surf are below what reads. Part is mine: PHYSICS' white cover is
     capped at 15 % (`WATER.foamMax`, fitted to Monahan's law between 10 and 20 m/s), where a real sea under a
     hurricane-force wind is streaked white all over (hand-over P25, Next).
   - *Suggestion:* a surf line wherever PHYSICS' surf is breaking (`here.blown.surf`, the sea map's waterline Hs), and white
     horses at PHYSICS' fraction at every quality; above about 20 m/s, spume streaks laid along the wind on the water.

5. **FIX FOR SHIP. The "fall" pose is a skydiver, and it is worn on the way up.** Every moment off the ground that is not
   a burn draws the arms spread at about 110 degrees and the legs bent back: rising at 10 m/s after a jet on Mars
   (`critique/play-31-mars-fall.jpg` frames 0-4, vertical speed +10.4 to +1.2 m/s), coming down at 4 m/s onto the spawn
   (`play-06-fall.jpg`), and the frame after landing (`play-07-prompt-board.jpg`). A body coasting up an arc or dropping a
   few metres does not flare; spread the arms only in a long fall (descending faster than about 8 m/s, or after a second
   of falling), and arms forward and legs ready for the last metre before a landing.

6. **What I checked that agrees** (so it is not lost in the list): the gait is PHYSICS' own (the boots where its feet
   are; walking, running and the Mars run read, `play-02-walk.jpg`, `play-03-run.jpg`, `play-29-mars-run.jpg`); Mars'
   dunes in their dust storm carry blowing sand streaks and kicked flecks with the wind (`play-45-dunes-stand.jpg`,
   `play-46-dunes-run.jpg`); the wood in Earth's thunderstorm sheds leaves into the wind and its crowns sway by a few
   pixels as P20 measured (`play-50-storm-trees.jpg`); the ship's shadow closes under it as it sets down on Mars and the
   downwash raises pale wisps round it on landing (`play-27-mars-landing.jpg`, `play-17-landed.jpg`). The pale puff at the
   boot on the spawn meadow (`play-02-walk.jpg` frames 5-11) was PHYSICS' ground, not your drawing: fixed in P25
   (`bb2a427`; the same walk and run on the fix, `play3-p25-02-walk.jpg`, `play3-p25-03-run.jpg`: no puff, dust count 0).

## Method notes and what this critique could not see

- Software WebGL, quality 1, 640 x 360, one browser; the game's clock held and stepped. Where the eye moved more than 60 m
  between my steps (0.25 s and 1 s steps in the climb, the pulse and the descent) PAINTER's arrival veil held the picture as
  bare paper (`play-19`, `play-20`, `play-24`, `play-26`, the last frame of `play-23`, the first of `play-25`): an effect
  of the stepping, not a fault, and not counted above.
- Not judged: anything at quality 2 or at 1080p; frame rate; sound; a real mouse, pad or pointer lock; the other worlds'
  seas and weather beyond Earth, Mars, Saturn and Neptune; the Moon's knife edges and the small rim's brink hold (PHYSICS'
  own, open since P24).
