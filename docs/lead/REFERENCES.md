# REFERENCES: what good looks like

Owner: PILOT as lead developer. Read by PAINTER and PHYSICS at every sync.

How to use this file. Each system lists existing games (and a few published techniques) that
are widely held to do it well, the behaviour you can actually observe in them, and the checks
our game must pass. The checks have ids (`R-FOOT-1`); `docs/lead/REVIEW.md` cites them.

Ground rules.
- References are for **behaviour and technique only**. Nothing is copied from any game: no
  names, characters, ships, creatures, art, music, levels, UI, or look. The look is judged
  against the art bible (a watercolour on cold-press paper), never against another game.
- Honesty about sources: the behaviours and magnitudes below are written from the lead's own
  knowledge of these games and of the physics, not measured here. Physical constants (terminal
  velocities, the speed of sound) are standard values. Treat game timings as targets to aim
  for and argue with, not as citations. If PHYSICS has a better-founded number, it wins.
- Checks are written so they can be run: a unit test, a number from `window.__pc.info()`, or a
  pair of screenshots.
- Where realism would make the player fight the controls, the realistic model stays and an
  assist goes on top (coordinator ruling, section F). Checks marked **(assist)** are Pilot's.
- Coordinator ruling of 2026-11-11: where a check here contradicted real physics, the model
  stays. Those checks are marked "(revised)" and now state either the real behaviour, with
  PHYSICS' measured numbers, or a named assist target. Three limits hold whatever the physics
  says: the player is never trapped, never floored for good, and the ship is never
  uncontrollable.

Game scale to keep in mind: planets are 1.4 to 5 km in radius, a day lasts 15 to 60 minutes,
the atmosphere is 0.1 to 1.4 km deep. Real magnitudes for wind, rain and falling bodies still
apply at human scale; only the planetary scale is compressed.

---

## 1. On-foot movement and running

References: *The Legend of Zelda: Breath of the Wild* (responsive start and stop, slopes that
matter, sliding on steep ground); *Death Stranding* (footing depends on slope, load and ground:
the reference for terrain that is felt through the feet); *Journey* (weightless, unhurried,
sliding down dunes as a pleasure); *A Short Hike* (generous, never punishing).

What makes it good: the body reaches walking speed in a fraction of a second and stops without
skating; it turns to face its direction of travel in about a fifth of a second; feet plant
where the stride lands (no foot sliding); uphill costs speed in proportion to the grade and
downhill gives it back; loose or wet ground lowers traction, so starts are softer and stops
longer there; steep ground is slid down, not stuck to; nothing ever hurts you.

Checks
- `R-FOOT-1` (revised 2026-11-11: real body plus a named assist) The explorer is a 100 kg body
  on boots: at the game's pace of 4.2 m/s (a jog, not a walk) grass gives 0.58 s to 90% of
  speed and a 1.2 m stop. The assist target, met with PHYSICS' `assistAccel` (suit thrusters,
  4 m/s2): **90% of pace within 0.5 s and a stop within 1 s and 1.3 m on firm ground**
  (`tests/physics.test.mjs`). On ice or mud it is allowed, and expected, to be worse.
- `R-FOOT-2` No skating: the animation's stride length times its step rate equals ground speed
  within 10% at walk and at run (Painter's `animate` reads `speed`).
- `R-FOOT-3` (revised: the real numbers) Leg power sets the cost of a hill: a run is about 3%
  slower up 10 degrees, 37% up 20, 55% up 30. The ground holds you while tan(slope) is below
  its friction plus foothold (grass about 43 degrees, rock 51, sand 33, warm ice 5); beyond
  that you slide, starting at 3 to 6 m/s and gathering speed on a long slope. Hard limit that
  stays: the player is never trapped (the jetpack always works).
- `R-FOOT-4` (revised: the real behaviour) Ground changes the walk, each material in its own
  way: wet rock lengthens braking by about 1.4 x and ice many times over; loose sand
  *shortens* braking (about half) but costs a quarter of the top speed and a slow start; deep
  snow halves the top speed. All of it comes from `physics.ground()`, none from multipliers.
- `R-FOOT-5` (revised: real body, assist named) Up to about 25 m/s of wind a fit body leans
  into it and walks on (the lean is visible: `st.phys.lean`); above that leg power runs out.
  Hard limit that stays, as Pilot's assist: no wind in the game stops the explorer for good or
  knocks them down; where a planet's storms exceed what legs can do, `assistAccel` and
  `physics.setWindScale` are tuned until walking into the wind is slow but possible. **(assist)**
- `R-FOOT-6` Frame-rate independence: distance covered in 4 s of walking differs by less than
  3% between 20 fps and 144 fps (exists: `tests/loop.test.mjs`).

## 2. Jetpack

References: *No Man's Sky* (a short burn from a tank that refills on the ground: the loop we
want); *Outer Wilds* (thrust is a real force: in low gravity the same pack carries you much
higher, and momentum is kept); *Tribes* (momentum is never thrown away in the air).

What makes it good: thrust comes on within a tenth of a second and feels like a force, not a
velocity; gravity decides how far it takes you (the same burn is a hop on a heavy world and a
long float on a light one); horizontal speed gained in the air is kept until the ground or
drag takes it; the tank is short enough to matter and refills fast enough to never annoy.

Checks
- `R-JET-1` (revised) A full tank lifts the explorer 20 to 40 m on Earth gravity and at least
  2.5 x that on the Moon. The thrust is the same force everywhere; the climb governor is an
  assist that is raised in light gravity (`jetRiseCap`: 8.5 m/s on Earth, up to 17 m/s).
- `R-JET-2` Fuel: 3.5 to 5 s of burn; full refill in under 3 s standing; no meaningful refill
  while burning. The gauge is visible only when the tank is not full.
- `R-JET-3` Releasing the keys in mid-air does not brake: horizontal speed after 1 s of free
  fall is at least 80% of what it was (air drag only, from PHYSICS' density).
- `R-JET-4` No fall can end badly: touchdown after a fall from any height is at 8 m/s or less in
  the last metre (the pack's automatic cushion). **(assist)**
- `R-JET-5` The plume disturbs the world: grass, dust, snow or water within about 2 m under a
  burning pack reacts within 0.1 s (see section 6).

## 3. Ship flight and landing

References: *Elite Dangerous* (the best model for us: a real thrust-and-mass ship with a
flight computer on top that cancels drift, so it flies like an arcade craft while every motion
is still a force); *Outer Wilds* (honest Newtonian flight made friendly by a match-velocity
assist and a landing camera); *No Man's Sky* (one button to land, a short vertical lift-off,
never a crash: the generosity we want).

What makes it good: the nose leads and the velocity follows about a second behind, so turns
have weight; letting go never punishes (the computer brings the ship to rest relative to the
nearest ground or body); top speed is not a magic cap but where thrust meets drag, so the ship
is slow in thick low air and fast high up; landing is a decision, not a skill test: one press,
a visible descent, a soft settle on the gear with a little spring.

Physics note for PHYSICS (a suggestion, your call): Pilot's current speed envelope (46 m/s at
the ground, 160 m/s at the top of the atmosphere, 750 m/s in space) falls out of constant
thrust against drag proportional to air density times speed squared, if density falls
exponentially with a scale height of about 0.4 x the atmosphere height. A real model with
that property replaces the envelope table without changing the feel.

Checks
- `R-SHIP-1` Hands off, the ship comes to rest relative to the ground within 4 s in the
  atmosphere, and within 10 s in space near a body, and then does not drift or sink. **(assist)**
- `R-SHIP-2` (revised: assist named) Steering is the one place the ship is deliberately not a
  plain rigid body: turning 90 degrees at 160 m/s with thrusters alone would take 9 s. The
  velocity is turned onto the nose by the drive field (PHYSICS' `carve01: 1`) with a time
  constant of 0.8 to 1.5 s in air and 1.5 to 2.5 s in space, without changing the speed; every
  change of *speed* keeps its mass (22 m/s2 forward, 14 in reverse, 60 in vacuum cruise).
  In vacuum the same field is the brake: X or throttling down stops the ship within 10 s.
- `R-SHIP-3` Top speed rises smoothly with altitude (no step larger than 10% between adjacent
  50 m bands) and is set by thrust against drag, not by a clamp.
- `R-SHIP-4` Vertical acceleration available: at least 0.5 g net upward at the ground on every
  body (so lift-off from Jupiter does not feel stuck), at most about 2 g (so it never snaps).
- `R-SHIP-5` Landing assist: from the prompt (below 90 m, below 75 m/s) to wheels down takes 5
  to 14 s; touchdown is at 1.5 m/s or less; the gear compresses and settles in under 1 s with
  at most one visible rebound. **(assist + PHYSICS gear springs)**
- `R-SHIP-6` Lift-off: straight up to hover in 2 to 3.5 s with the gear retracting, no drift.
- `R-SHIP-7` The ground is never a wall: ten minutes of careless flying never puts the hull
  closer than 1.5 m to terrain (exists: `tests/flight.test.mjs`); any contact is a bounce that
  keeps at least half the tangential speed and causes nothing worse than a sound. **(assist)**
- `R-SHIP-8` Wind and turbulence move the ship visibly in storms (attitude disturbances of 1 to
  5 degrees) and the computer absorbs them within about 1 s; the player never has to correct.
- `R-SHIP-9` Downwash: hovering below about 40 m disturbs grass, dust, snow and water in a ring
  under the ship whose strength falls with height (see section 6).

## 4. Ground-to-space transition

References: *Outer Wilds* (small worlds, a seamless climb, the planet becomes a ball under you
in seconds: our scale exactly); *Elite Dangerous* (a continuous descent from orbit with the
sky filling in and no cut); *Kerbal Space Program* (the sky darkening and the curve of the
horizon growing as the honest signs of altitude); *No Man's Sky* (seamless, and also the
cautionary tale: terrain and props visibly popping in on a fast descent).

What makes it good: nothing steps. Sky colour, haze, star visibility, horizon curvature and
ground detail are all continuous functions of altitude; frame time stays flat through the
climb; on the way down, detail arrives before you can see that it was missing.

Checks
- `R-SPACE-1` No loading screen, no fade to cover a swap, no hitch: during a full-throttle climb
  from the ground to twice the space altitude no frame takes more than 2.5 x the median frame
  time (measured in the browser; software GL counts for relative hitches).
- `R-SPACE-2` Continuity: sampling a frame every 0.5 s through the climb, mean screen colour
  never changes by more than 6% between consecutive samples.
- `R-SPACE-3` Stars and the dark of space fade in between about 0.6 and 1.6 x the space altitude
  (Pilot sends `inSpace01` with exactly that ramp), never as a switch.
- `R-SPACE-4` No pop-in on descent at the ship's top atmospheric speed: terrain refinement
  morphs, flora and props fade in as strokes over at least 0.4 s (art bible point 10).
- `R-SPACE-5` From 1.5 radii up the whole planet reads as one painting: distinct biome colours,
  a soft terminator, an atmosphere rim that fades to paper, and no visible patch seams.
- `R-SPACE-6` A parked ship in orbit stays with its planet, and the planet visibly turns under
  it (exists for the first half: `tests/loop.test.mjs`).

## 5. Wind in foliage

References: *Ghost of Tsushima* (one global wind that everything obeys: grass, leaves,
particles, cloth; gust fronts you can watch crossing a field); *The Legend of Zelda: Breath of
the Wild* (waves running through grass, wind that agrees with the weather); *The Witcher 3*
(trees that really labour in a storm: trunk, branch and leaf move at different rates).
Technique: hierarchical bending as in the Crysis vegetation chapter of *GPU Gems 3* (whole
plant sway plus per-branch and per-leaf detail with phase variation), driven by a wind field
sampled in world space so neighbours move together.

What makes it good: coherence. A gust is a travelling front, not noise per plant; tips move
more than bases; big things move slowly (a trunk sways at about 0.3 to 0.6 Hz), small things
quickly (leaves flutter at 3 to 6 Hz with small amplitude); everything in the frame agrees on
the direction; calm really is calm.

Checks
- `R-WIND-1` One wind field (PHYSICS `air().wind`) drives flora, falling particles, cloud drift,
  rain slant and audio; in any frame their directions agree within 20 degrees.
- `R-WIND-2` (revised) Gust fronts travel: a gust band crosses grass at the wind speed at 10 m
  height (about twice the wind at blade height, because gusts are carried by the faster air
  above), coherent over 30 to 90 m.
- `R-WIND-3` Amplitude follows strength: below 1 m/s tips move less than 2 cm; at 8 m/s grass
  leans 15 to 35 degrees with flutter; at 20 m/s (storm) tree crowns bend at least 8 degrees
  and stay bent while it blows.
- `R-WIND-4` Three rates are visible on a tree in the same shot: trunk slow, branches about
  three times faster, leaf masses faster still.
- `R-WIND-5` Art bible point 7 holds while it moves: the stroke textures ride on the plant
  (anchored in body-local space) and nothing shimmers; motion is smooth, only the silhouette
  wobble may boil at 6 to 8 fps.
- `R-WIND-6` Airless bodies (Mercury, the Moon) have no wind sway at all.

## 6. Plants parting around the player and the ship

References: *Ghost of Tsushima* (grass and pampas parted by the body, with a trail that
closes behind you); *The Legend of Zelda: Breath of the Wild* (grass bending away from the
character); *Horizon Zero Dawn* (plants pushed aside on contact and springing back).
Technique: a small top-down disturbance field centred on the player (direction and strength,
decaying over time) that the foliage vertex shader samples, or a short list of disturber
spheres; springs with damping so plants overshoot a little on the way back.

What makes it good: it is immediate, local and it remembers: plants lean away as you arrive,
stay parted where you stand, and close behind you over about a second with a small overshoot.
A heavy thing (the ship) flattens a wide ring and the ring breathes with the engine.

Checks
- `R-PART-1` Walking through grass: blades within 0.6 m lean away by at least 30 degrees at the
  tip, within 0.1 s of contact.
- `R-PART-2` Recovery: after the explorer leaves, plants return within 0.6 to 1.5 s with one
  small overshoot (a damped spring, damping ratio roughly 0.4 to 0.7), never a snap.
- `R-PART-3` A running explorer leaves a visible wake in tall grass at least 1 s long.
- `R-PART-4` (revised: the real reach) Ship downwash: hovering at 9 m flattens grass radially
  out to 8 to 14 m; the effect fades with height but a jet keeps its momentum as it spreads,
  so it is still a stiff breeze in the grass at 40 m and gone by about 100 m; it appears and
  disappears over about 0.5 s.
- `R-PART-5` The jetpack plume pushes a patch about 2 m across directly below, down to bare
  strokes on sand, dust and snow.
- `R-PART-6` Cost: the whole disturbance system stays inside PHYSICS' 2 ms budget at quality 1
  and degrades by range, not by correctness, at quality 0.
- `R-PART-7` The field is anchored in body-local space: when the floating origin moves or the
  planet turns, parted grass does not slide (teleport test: no visible jump).

## 7. Sand and snow deformation

References: *Journey* (sand as the main character: trails, sliding, slopes that slump);
*Red Dead Redemption 2* and *God of War* (2018) (snow that is ploughed by the body, with depth
that slows you); *Rise of the Tomb Raider* (the published deferred snow deformation technique:
a top-down height field around the player, stamped by feet and body, with a raised rim where
the displaced snow goes, and slow refilling). *Death Stranding* (footprints that persist).

What makes it good: prints land where the feet land; depth depends on the material and how
hard you hit it; displaced material piles up at the edge instead of vanishing; trails last
long enough to look back at, and weather erases them at a believable rate; loose slopes hold
only up to their angle of repose (about 30 to 35 degrees for dry sand).

Checks
- `R-DEF-1` Footprints appear on the frame the foot plants, spaced by the stride, with depth
  set by PHYSICS `ground().sink` (snow up to about 0.25 m, dry sand about 0.03 to 0.06 m).
- `R-DEF-2` A raised rim of roughly 15 to 25% of the print depth surrounds prints and trails.
- `R-DEF-3` Persistence: prints last at least 60 s in calm weather and fill in within about 20 s
  in heavy snowfall or a sandstorm.
- `R-DEF-4` The ship leaves marks: three pad prints and a scoured ring on landing and lift-off.
- `R-DEF-5` Walking in deep snow is slower (see `R-FOOT-4`) and the body visibly sinks to the
  depth the prints show.
- `R-DEF-6` The deformation window follows the player without popping and is anchored in
  body-local space; returning within its lifetime finds your own trail where you left it.
- `R-DEF-7` In the painting it reads as darker pooled strokes with a paper-light rim, not as
  geometry: no visible facets or stair-steps at the edge of the window.

## 8. Rain

References: *Red Dead Redemption 2* (rain that builds, wets the world over time, slants with
the wind and leaves puddles that outlast it); *Driveclub* (rain intensity as a continuous
quantity with the surface response to match); *The Witcher 3* (rain that changes the whole
mood of a place).

Physics that should be true: raindrops fall at about 2 m/s (drizzle) to 9 m/s (large drops);
the slant angle is the arctangent of wind speed over fall speed; light rain is under 2.5 mm an
hour, heavy rain over 7.6; surfaces wet within tens of seconds and dry over minutes; drops on
water make expanding rings.

Checks
- `R-RAIN-1` Fall speed 5 to 9 m/s for rain, 1.5 to 3 m/s for drizzle; slant equals
  atan(wind / fall speed) within 20%.
- `R-RAIN-2` Rain never switches on or off: intensity changes by no more than 0.05 per second
  on Earth (measured 0.9 %/s), 0.08 at a storm front on Neptune (`R-WX-1`).
- `R-RAIN-3` Wetness: `weather().wetness01` reaches 1 within 30 to 90 s of heavy rain and decays
  to 0 over 3 to 10 minutes after it stops; traction follows it (`R-FOOT-4`).
- `R-RAIN-4` Open water shows rain rings while it rains; puddles appear in hollows after a
  minute of heavy rain and persist after it.
- `R-RAIN-5` Rain does not fall inside the cockpit or through the ship onto the explorer
  standing under it.
- `R-RAIN-6` In the painting: sparse slanted dry-brush strokes and wet-in-wet softening of the
  far layers, darker wet ground; never white lines, never a full-screen overlay that swims.

## 9. Storms and lightning

References: *Sea of Thieves* (a storm is a place you can see from far away, sail into and
out of); *Red Dead Redemption 2* (lightning that lights the cloud from inside, thunder that
arrives late by the right amount); *Microsoft Flight Simulator* (storm cells with real wind
and turbulence around them).

What makes it good: a storm has a location and a life: the wind rises first, the light goes,
then the rain; lightning is a flicker of two to four strokes inside a fifth of a second;
thunder follows at three seconds per kilometre (sound travels at 343 m/s in Earth-like air).

Checks
- `R-STORM-1` Storms are cells with a position and a radius: flying 2 to 3 km away leaves one,
  and it can be seen from outside as a darker wash with its own rain.
- `R-STORM-2` Order of arrival: wind speed rises at least 20 s before the rain reaches half
  intensity; the light dims with the cloud, not with the rain.
- `R-STORM-3` A lightning event is 2 to 4 flashes within 0.25 s; `weather().lightning` carries
  its position so the delay of the thunder is distance / speed of sound, within 10% (the
  speed of sound depends on the body's air; no thunder on airless bodies).
- `R-STORM-4` The flash is bare paper showing through the wash for one to three frames, never
  pure white and never a full-screen strobe.
- `R-STORM-5` (reworded after review 5, the coordinator's ruling) Gusts of 15 to 30 m/s in a
  thunderstorm, **measured in the open at 10 m above the ground**; under trees the canopy's
  shelter is real and the wind at two metres may be a third of that. A blizzard is sustained
  wind of 15 m/s and more at 10 m with `R-SNOW-3`'s visibility; a dust storm on Mars 15 m/s
  and more at 10 m. On foot `R-FOOT-5` still holds, in the ship `R-SHIP-8`. Measured on
  `0de3fb4` (P7.4): 16 to 23 m/s above the canopy at the Earth spawn and 11 at 10 m inside
  the wood; 25 m/s at 10 m in the blizzard on the open meadow; 20 m/s in Mars' dust storm.

## 10. Snow

References: *The Long Dark* (wind-driven snow, visibility as the thing weather takes away);
*Red Dead Redemption 2* and *God of War* (2018) (accumulation you walk through).

Physics that should be true: flakes fall at 0.5 to 1.5 m/s, so even a light wind carries them
nearly sideways; they wander as they fall; snow gathers in the lee of obstacles.

Checks
- `R-SNOW-1` (revised) Fall speed 0.5 to 1.5 m/s; in a 5 m/s wind flakes travel at 70 degrees
  or more from the vertical; each flake side-slips at 10 to 30% of its fall speed.
- `R-SNOW-2` `weather().snowDepth` grows during snowfall at a rate visible within two minutes
  and feeds `R-DEF-1`; it does not grow under the parked ship.
- `R-SNOW-3` A blizzard takes `visibility01` down to 0.3 or less, and the far layers fade to
  paper (not grey).
- `R-SNOW-4` Flakes are specks of bare paper, larger near the eye, with no shimmer.

## 11. Weather transitions

References: *Red Dead Redemption 2* (weather that turns over minutes, in a believable order);
*The Legend of Zelda: Breath of the Wild* (weather you can read in advance).

What makes it good: you can see it coming. Cloud leads rain, wind leads cloud, the ground
stays wet after the sky clears. Nothing about weather is random per visit: it is a function of
place and time.

Checks
- `R-WX-1` (revised again in review 4, from measurements) Weather is continuous, and a moving
  front is allowed to be a front. Measured through `physics.here.sky` at 2 Hz for half an hour
  at twelve places a body: cloud, overcast, storm and wetness change by at most 2 to 6 % of
  their range in a second everywhere; a snow squall front on Earth moves haze by 6.3 %/s and
  snowfall by 5.1 %/s; on Neptune, where the fronts ride the fastest winds in the system, rain
  moves 8 %/s and a fog bank 14.6 %/s. Limits (the coordinator's ruling after P7): **15 %/s on
  the four giants** (Jupiter, Saturn, Uranus, Neptune), **8 %/s on the rocky worlds with one
  point of tolerance** (Earth's 8.5 %/s passes), lightning excepted. The tolerance is there
  because the picture does not pop for it: PAINTER eases what it shows of `sky` with a time
  constant of 2 s or more (`flash` excepted; since M3 block 2 `world.update` does this itself).
- `R-WX-2` Deterministic: the same seed, body, place and time give the same weather (a unit
  test in `src/physics`), in keeping with "the same planet on every visit".
- `R-WX-3` A full change (clear to rain, rain to clear) takes 1 to 4 minutes.
- `R-WX-4` Weather depends on biome and time of day (no rain in the desert canyon without a
  reason; mist in the wetland at dawn).

## 12. Other-planet weather

References: *Outer Wilds* (every world has one or two weather ideas taken to the limit:
cyclones, falling sand, a thin crust: weather as the identity of a place); *No Man's Sky*
(storms that are specific to a planet type and announce themselves).
Real planets, as the source of difference: Mercury and the Moon have no air (no wind, no
sound, dust flies in clean parabolas and does not hang); Mars has thin air (fast winds that
push weakly, dust that stays up for a long time, dust devils); Venus has air about 50 times
denser than Earth's at the ground (slow winds that push hard, everything damped, haze); the
giants have bands of very fast wind and lightning; the ice giants are cold, with the fastest
winds of all; Pluto has a trace of air and frost that comes and goes.

Checks
- `R-PLANET-1` (revised: the real ratios) `air().density` differs by body and the differences
  are felt: drag goes with density, so the same wind pushes about 53 times harder on Venus than
  on Earth and about 61 times harder on Earth than on Mars (clamped for the explorer by
  `R-FOOT-5`). The ship's top speed at the ground is where thrust meets drag: about 250 m/s on
  Earth, about 34 m/s on Venus.
- `R-PLANET-2` Airless bodies: no wind, no falling-leaf drift, no thunder; kicked dust and
  jet plumes fly ballistically and land within a second or two.
- `R-PLANET-3` Each of the eight planets has at least one weather behaviour no other planet
  has (kind of particle, fall speed, wind pattern or visibility), agreed with PAINTER's biomes.
- `R-PLANET-4` Gravity is the body's own everywhere: particle fall, jump height (`R-JET-1`),
  the ship's hover power.

## 13. Water

References: *Sea of Thieves* (water with real waves and real buoyancy); *Red Dead Redemption
2* (wading that slows with depth, wakes, rivers that carry things); *The Legend of Zelda:
Breath of the Wild* (shallow water that simply slows you, deep water you float in).

Checks
- `R-WATER-1` (revised: drag grows with speed squared) Wading at the game's pace: about 0.75 x
  at 0.3 m, 0.62 x at knee depth (0.5 m), 0.36 x at waist depth (1 m); deeper than about
  1.25 m the explorer floats and cannot sink.
- `R-WATER-2` The explorer makes rings and a wake that spread at 0.3 to 1 m/s and die within
  about 3 s; rain makes rings (`R-RAIN-4`); the ship's downwash makes a spray ring.
- `R-WATER-3` Flowing water carries a floating explorer downstream at the flow speed.
- `R-WATER-4` Liquid level is what `sampleSurface().liquidRadius` says, to within 5 cm of where
  it is drawn (the explorer's waterline matches the painted waterline).
- `R-WATER-5` Art bible point 9: horizontal reflected strokes with bare-paper glints; ripples
  are broken rings of paper, not normal-mapped highlights.

## 14. Day and night

References: *Firewatch* (a hand-authored palette per time of day: the proof that stylised
light beats simulated light); *Journey* (colour scripts that carry emotion); *The Legend of
Zelda: Breath of the Wild* (a day short enough to see and long enough to forget).

Checks
- `R-DAY-1` Four keys are distinct paintings of the same view: rose dawn, clear noon, gold
  dusk, indigo night (`world.setTime` at 6, 12, 18, 0 from the same camera).
- `R-DAY-2` Dawn and dusk each last at least 90 s of real time on Earth (day length 25 min).
- `R-DAY-3` Night is a painting too: mean luminance at least 12% of paper, the ground is
  readable, nothing is black (art bible point 1).
- `R-DAY-4` The palette changes below the threshold of notice: no more than 1% of mean colour
  per second outside dawn and dusk, 3% within them.
- `R-DAY-5` The light direction is the real sun: shadows and glazes agree with where the
  painted sun sits in the sky at every hour.

## 15. Stable painterly rendering

References: *Okami* (ink and paper as a complete world that holds together in motion);
*Dordogne* (watercolour as the whole look of a 3D game); *Eastshade* (landscape as the
subject of play); *Sable* (deliberately low animation rates used as style: the model for a
"boil" that reads as a hand, not a glitch); *11-11: Memories Retold* (a painterly filter over
3D: beautiful stills, and the cautionary tale for strokes that crawl when the camera moves).
Published technique: Curtis et al. 1997, "Computer-generated watercolor" (pigment, paper,
edge darkening, backruns); Bousseau et al. 2006, "Interactive watercolor rendering with
temporal coherence and abstraction" (the pigment-density formula the brief quotes, and why
textures must move with the scene); Montesdeoca et al. 2017, "Art-directed watercolor
stylization of 3D animations in real-time" (object-space control of pigment effects);
Kyprianidis et al. 2009 (anisotropic Kuwahara abstraction).

What makes it good: the "shower door" never appears. Paper belongs to the screen; pigment
belongs to the things painted. Still frames pass for scans; moving frames look repainted,
calmly, not filtered.

Checks
- `R-PAINT-1` Freeze-frame test (art bible): a still of the home forest passes for a scan of a
  watercolour. Judged by eye against the ten points; every "digital" tell is listed in REVIEW.
- `R-PAINT-2` Shower-door test: move the camera 2 m sideways; wash variation, granulation
  inside washes and stroke texture stay on their surfaces; only paper grain and the ragged
  border stay fixed to the screen.
- `R-PAINT-3` Flicker test: static camera, wind frozen (`t=0`): mean absolute difference between
  consecutive frames under 0.5% (only the 6 to 8 fps boil is allowed to change anything).
- `R-PAINT-4` Slow pan test: at 10 degrees per second no interior region changes luminance by
  more than 3% between consecutive frames; edges may wobble, areas may not crawl.
- `R-PAINT-5` Range: no pixel brighter than paper (#F4EFE4), none darker than about 6%
  luminance; shadows are cool glazes over local colour, never grey or black.
- `R-PAINT-6` No facets, no texture tiling, no hard specular, no pop-in (art bible 2 and 10).
- `R-PAINT-7` Everything is painted: explorer, ship, HUD, cursor, loading (art bible 8).
- `R-PAINT-8` Cost: the pipeline holds 60 fps at 1080p on an integrated GPU with render scale
  no lower than 0.6 at quality 1. Not measurable in this sandbox: reported as reasoning plus
  software-GL timings until someone runs it on a real GPU.

## 16. Minimal HUD

References: *Journey* (no HUD at all: the standard to deviate from only with a reason);
*Outer Wilds* (information lives in the world and in instruments); *Firewatch* (a paper map
held in the hand); *Shadow of the Colossus* (one or two elements, visible only when needed).

Checks
- `R-HUD-1` Standing on foot with a full tank and nothing to interact with, the screen shows
  the painting and nothing else.
- `R-HUD-2` At most one prompt line at a time; it appears within 0.25 s of becoming possible
  and names the key and the action.
- `R-HUD-3` Gauges show only while relevant (fuel when not full, throttle in flight) and fade.
- `R-HUD-4` Everything sits inside the painted border, is drawn in the painted theme, and is
  readable over both paper-light and indigo backgrounds.
- `R-HUD-5` Markers for planets and vistas are in the world (a brush mark on the horizon), not
  a radar.

## 17. Ambience and audio

References: *Proteus* (the landscape itself as the instrument: sound that follows place and
time); *Journey* (wind as the bed everything else rests on); *Red Dead Redemption 2* (layers
by biome, hour and weather); *Minecraft* (sparse music with long silences: unhurried).

Checks
- `R-AUD-1` The wind bed's loudness follows `air().wind` at the listener within 0.5 s and falls
  to silence in space and on airless bodies.
- `R-AUD-2` Layers: a biome layer, a time-of-day layer and a weather layer, each fading over
  at least 3 s; pads enter and leave over 30 to 90 s with real silences between.
- `R-AUD-3` No clicks (every gain change ramps over at least 20 ms), no audible loop shorter
  than 2 minutes, master peak below -3 dBFS.
- `R-AUD-4` Footsteps follow the stride and the ground material; the ship's voice follows
  thrust; thunder follows `R-STORM-3`.
- `R-AUD-5` All of it is procedural WebAudio; no audio files.
