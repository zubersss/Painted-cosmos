// Painted Cosmos physics: the explorer as a body with mass. OWNER: PHYSICS. Pure (no three).
//
// PILOT's stepExplorer turns keys into a COMMAND (a wished velocity, jump, jetpack throttle and
// its assists). This file decides what the body then actually does:
//   - legs push through friction: the force they can put into the ground is limited by the
//     friction circle (mu N), by leg strength, and by leg power (which is what slows you uphill,
//     in sand, in snow, wading, and in the thick air of Venus);
//   - slopes: gravity pulls along the slope; you hold while tan(slope) <= mu + foothold and
//     slide with kinetic friction beyond it;
//   - air: drag on the velocity relative to the wind, so wind leans on you and a fall has the
//     terminal speed of that planet's air (Earth 55 m/s, Venus 7 m/s, none on the Moon);
//   - liquid: buoyancy and drag from the submerged part; you float when buoyancy carries you;
//   - jetpack: a thrust in newtons, vectored toward where you want to go;
//   - contact: an inelastic landing with a Coulomb friction impulse (you skid on ice).
// Every integrator here is implicit or exact where it is stiff (quadratic drag, buoyancy), so the
// step is stable at 60 Hz and at 20 Hz, and a body at rest stays exactly at rest.
//
// Frame: body-local. st.p is the feet, st.v the velocity. Allocation-free.
import { clamp, clamp01, smoothstep } from './util.js';

export const EXPLORER_BODY = Object.freeze({
  mass: 100,              // kg: a 72 kg person in 28 kg of suit and pack
  height: 1.8,            // m
  radius: 0.35,           // m: half-width, for pushing plants aside
  bodyDensity: 1010,      // kg/m^3 of the suited body (used when the float assist is off)
  // air
  cdaUpright: 0.85,       // m^2: drag area standing or walking (Cd 1.2 x 0.7 m^2; pedestrians measure 0.8-0.9)
  cdaFall: 0.60,          // m^2: falling with the pack (a skydiver belly-down is 0.45-0.5 without one)
  // (P23) THE GALE. Where the wind's push on the body nears what the soles can hold, a walker gets low: a crouch, then down
  // on hands and knees (hunker01), side-on to it. Its drag area falls toward cdaLow, it meets the wind nearer the ground,
  // where the wind is slower (the air is read hunkerHeight up, not a metre), and hands and knees add to the soles' hold. What
  // the soles still cannot hold, beyond braceShare of their grip, the suit braces against with its thrusters (windBrace, up
  // to braceForce: the jetpack's thrust), so a gust leans the body over and staggers it, and never carries it off: Neptune's
  // squall at the storm stand blows 60-70 m/s at a metre with gusts to 175, a push of three to nine times the grip on a
  // body standing (it was blown 19 m and up the cliff behind the beach in 15 s; PAINTER 13).
  cdaLow: 0.30,           // m^2: down on hands and knees, side-on (a crouch is 0.4-0.5, lying flat 0.2-0.25)
  hunkerHeight: 0.4,      // m above the ground the wind is read at, down low (1 m standing)
  hunkerFrom: 0.5,        // the wind's push on the body upright, over g, at which the walker begins to get low (it can lean
  hunkerFull: 1.0,        // ... no further than about 30 degrees into it) and at which it is right down
  hunkerDown: 0.25,       // s: time constant getting down
  hunkerUp: 1.5,          // s: and getting up again as the wind falls
  hunkerGrip: 0.3,        // added to the soles' hold, right down (hands and knees, toes dug in)
  hunkerPace: 1.2,        // m/s: the pace right down (a crawl into the storm, or with it)
  windBrace: true,        // the suit braces against the wind the soles cannot hold (cmd.windBrace false: off) ...
  braceFrom: 0.5,         // ... where the wind's push on the body upright is over this share of g (a wind that would carry a
                          // body off any ground: a 20 m/s wind on Earth's ice still blows a walker along)
  braceShare: 0.6,        // ... all of it beyond this share of the grip (the rest is the legs' to walk with)
  braceForce: 1700,       // N: at most (the jetpack's thrust)
  // legs
  legAccel: 9.0,          // m/s^2: the hardest the legs push off firm ground (a sprint start is 8-10)
  legPower: 1600,         // W of external work the legs sustain: an athlete's sprint peak (1500-2000 W),
                          // held by the suit. It sets the speed uphill, in sand, snow, water and dense air.
  response: 0.11,         // s: time constant with which the legs cancel a velocity error
  runFoothold: 4.5,       // m/s: above this speed footholds no longer help
  arrest: 0.85,           // sliding out of control, the body digs in heels and hands: friction is this
                          // fraction of the holding traction (never less than the kinetic coefficient)
  // LEGS (P9). st.p is the feet; the mass rides at the hips, one leg above them. The legs are a
  // suspension with a stroke: they fold and reach so the feet follow the ground while the hips
  // take a smoother path. Over a feature lower than the stroke (legFold + legReach = 0.73 m) the
  // hips do not move at all, at any speed. Over one up to `clamber` high the hips must rise and
  // fall, and the limbs keep the body attached: they hold the rock (grip), and the walker holds
  // its pace to what gravity and that grip can follow. See "legs" in stepExplorerBody.
  legLength: 0.9,         // m: hip height standing (documentation: the dynamics need only the stroke)
  legFold: 0.45,          // m the legs shorten: a deep crouch, the foot placed up on something
  legReach: 0.28,         // m the feet reach below the standing stance to keep contact (a step down)
  stickGap: 0.28,         // (the name of legReach before P9; kept, unused)
  legTime: 0.12,          // s: time constant with which the legs level the hips (critically damped)
  legLift: 9.0,           // m/s^2: the hardest the legs raise the hips (the same legs as legAccel)
  trendTime: 0.3,         // s over which the rise of the ground counts as the slope of a hill, not a feature
  trendSlip: 0.6,         // (P22) m/s: ground rising faster or slower than the hips by more than this is not read as the hill's slope
  legCatch: 30,           // m/s^2: the hardest they take up a descending body (eccentric: 3 g)
  clamber: 1.35,          // m: a leg and a half. A rise or a drop within it is clambered in contact,
                          // hands on the rock; a drop beyond it is a fall
  gripAccel: 10,          // m/s^2 the limbs holding a feature pull the body toward it (1 kN). Only a
                          // convex feature gives a hold; open ground does not (see gripDepth)
  gripDepth: 0.2,         // m: there is a hold when the ground `look` ahead lies this far (beyond the
                          // reach) below the line the hips are moving on: a rock, a ledge, a sharp
                          // ridge (crest radius under about 3.5 m), not a rolling crest
  legStep: 0.15,          // m: the longest step over the ground the legs take in one piece (longer frames are split, 4 at most)
  look: 1.2,              // m ahead the walker looks while its legs are working (one more sample)
  braceAccel: 20,         // m/s^2 the limbs on a hold brake the body with (2 kN), not limited by the soles' grip
  braceDv: 2.5,           // m/s of forward speed the limbs take up in one hold on the way down;
                          // more than that tears the grip off and the body flies
  // (P21) THE BRACE AGAINST A FACE. Where the ground ahead rises faster than the hips can follow (the legs at the end of
  // their fold), the ground pushes the body along its own normal: the legs take up the velocity INTO the face (legCatch at
  // most, the body coming on over its planted feet meanwhile), the velocity along it carries on: across the face whole,
  // up it as fast as the hips may honestly rise (no faster than gravity and a hold can stop them within the reach over
  // the ground ahead), the rest taken by the legs too. Until P21 the legs took up the whole velocity at legCatch: a run
  // on the Moon onto a 29 degree slope was held at 3.7 m/s, and at a 43 degree crater rim checked 6.7 -> 2.2 m/s.
  braceSide: 0.2,         // m either side of the step's end the face's tilt across the path is read at
  crestFilter: 0.15,      // (retired in P9: the stroke of the legs does this now; kept, unused)
  crestLaunch: true,      // leave the ground when it falls away faster than gravity (low-g bounding)
  // THE WAY AHEAD (P16). A face the hips must climb (its top more than the legs' stroke over the ground here, within a
  // clamber) is crossed in contact only at the pace the hips can be raised onto it and brought down beyond it: within the
  // 0.3 m measure (never thrown up, the feet never off the far side) about aheadPace / (rise - legFold)^aheadExp (m): on
  // PILOT's profile (a 1.3 m dome) the fastest pace that needs no brace at the face is 4, 3 and 2.25 to 2.5 m/s for 0.8,
  // 1.0 and 1.2 m, the same on the Moon, Mars and Earth (the hold's pull, not gravity, sets it): 1.9 / x^0.75 within 5 %,
  // and the law is taken 8 % under that. A runner sees it coming and sheds the rest with its soles (and the
  // suit's assist), within the grip it has, from as far as that takes. Until P16 the face itself took it: a run on the
  // Moon was checked from 5.4 to 2.1 m/s in 0.125 s, by contact. Two samples a step while running (aheadFrom).
  aheadFrom: 2.5,         // m/s over the ground from which the walker reads the way ahead
  aheadMax: 12,           // m: the farthest it reads
  aheadSpan: 1.2,         // m: a face is a rise of more than the stroke within this run (a hill under 60 % is not)
  aheadMargin: 0.8,       // share of the grip (and the assist) the walker plans to brake with
  aheadPace: 1.75,        // m/s at a rise of a metre over the fold, in that law (3.85, 2.75, 2.15 m/s for 0.8, 1.0, 1.2 m)
  aheadExp: 0.75,
  // (P17) THE WAY AHEAD, TRIED. The law above was fitted to faces met square on; the flank of a boulder at the edge of the
  // path is a lower, narrower hump (0.67 of its height 0.5 m off the middle of a 1.3 m dome) that the law did not count
  // as a face (its rise is under the stroke), and the body met it as before: braced at the face (two steps of 0.5 m/s)
  // and held back over the top (6 -> 2.9 m/s in 0.25 s on the Moon). Now anything the legs must work on (a rise of more
  // than their fold within aheadSpan) is read along the path once, aheadProbe apart from aheadProbeBefore short of the
  // far point to aheadProbeAfter beyond it, and the body itself is run over that profile (a ghost: the same step
  // function, no world samples) at trial paces, one a step: the fastest that crosses with no brace, no hold checking
  // it and the feet never off the ground, less aheadProbeMargin, is the pace to meet it at. The law stands in while
  // the trials run (six steps at most) for faces over the stroke.
  aheadProbe: 0.2,        // m between the samples of a feature's profile
  aheadProbeBefore: 0.6,  // m read short of the far point (and the span)
  aheadProbeAfter: 2.6,   // m read beyond it (a 1.3 m dome seen at its foot lies within that)
  aheadProbeMargin: 0.92, // the pace planned, as a share of the fastest trial that crossed clean (and the pace is tried that much faster)
  aheadProbeTries: 6,     // trials at most (a bisection between 0.5 m/s and the pace: about a sixth of a metre a second)
  // (P22) THE WAY, SEEN. A runner looks where the feet will go: the ground along the path is kept as a row of samples
  // (`way`, wayStep apart, out to the read of the way ahead), sampled once as it comes into view and again each wayFresh
  // metres nearer (what stands on the ground near the walker is known only near it: PILOT's boulders are listed within
  // 9 m). Over the first wayTime of travel it gives the legs THE TUBE (wayUpdate): the hips rise no slower than clears the
  // fold of the ground ahead and above them, no faster than keeps the reach of what is ahead, a line to a far sample past a
  // nearer one's stroke not counted (LEGS, 3). So the hips are raised in time for a rock the stroke can take, only as far as
  // its top asks (before P22 they were heaved up its face at the ground's own rate and overshot its top, and the limbs then
  // checked the run so the feet could follow the far side down: the game's Moon boulder, 7.15 -> 2.52 m/s on top), and are
  // folded before a crest. Over the whole of it the crests are read (wayCrest, crestMargin).
  wayStep: 0.3,           // m between the samples of the way
  wayLat: 0.35,           // m off the line of the run at which a sample is no longer on the way
  wayFresh: 3,            // m nearer than where it was last read, a sample is read again
  wayFill: 2,             // samples read in a step to fill the way (refreshes: as many again); the whole of it when empty
  wayMax: 14,             // m: the farthest the way is kept
  wayMargin: 0.02,        // m kept from the ends of the stroke when the hips are set in time (what the step's own lag carries)
  // (P22) A CREST seen on the way (wayCrest) is met at the pace at which the hips, coming up its near side, can be turned
  // down its far side within the stroke (gravity and the limbs on the edge pulling them: a run up a 43 degree crater rim on
  // the Moon left its crest at 6.5 m/s and the feet flew 2 m; the body measured keeps contact to 4.1 m/s over a 43 / 10
  // degree crest, 6 m/s over 29 / 10, 3 m/s over 54 / 7, on the Moon, Mars and Earth alike within 5 % of the law);
  // a runner who sees it coming shortens the stride and sheds the rest with the soles.
  crestMargin: 0.92,      // the pace planned, as a share of that law
  // (P26) A WALL. On hands and feet (a scramble) the walker goes up ground its soles alone do not hold: any ground up to
  // scrambleSlope (toes kicked in, hands down), and ground that grips as far as the soles' hold with the hands' pull
  // added, friction + foothold + scramblePull / g (the hands hold a force, not a share of the weight: 100 N is a tenth of
  // the body's weight on Earth and most of it on the Moon: dry rock is scrambled to 53 degrees on Earth, 57 on Mars, 62
  // on the Moon; turf, regolith and ice to 47 on Earth, regolith to 53 on the Moon, the game's Pluto's ice to 52). A face
  // steeper than that which rises on more than a clamber within two looks has no top for the hands and nothing for the
  // feet: a WALL.
  //   - It is no step and gives no hold: a body on one is carried by its facet, where gravity pulls it back and friction
  //     is what it is, and the suit's start-and-stop thrusters (cmd.assistAccel) have no part up its fall line (on the
  //     Moon they are stronger than gravity: the lift is the jetpack's, with its fuel).
  //   - A walker does not put a foot on one. Where a step would end on a wall, the wall takes the velocity into it (along
  //     its normal: the mass rides at the hips). If what is left along it would lift the body no more than the legs
  //     reach (w^2 / 2 g within legReach), the legs take that too and the feet stay: the walker stands at its foot, or goes
  //     along it with the speed it has along it (as round a trunk). More than that is momentum: the body rides up the
  //     wall on it, sliding, and comes back down (in low gravity a run carries further: a 7.4 m/s run met by a 70 degree
  //     wall with no room to slow rises 0.16 m on Earth, 1.0 m on Mars, 1.2 m on the Moon).
  //   - A runner who sees one on the way (a rise of more than a clamber, steeper along the path and by its own facet
  //     than its own ground is scrambled) sheds its pace with its soles and stops at its foot (paceWall).
  // Until P26 any rising ground gave the limbs a hold once the legs were at work, and since P22 they are at work at the
  // foot of every rise (the tube raises the hips in time): a walker carried on its limbs feels no gravity along the
  // face, and Earth's sea cliffs (70 to 79 degrees) were run up 50 m at 6 m/s (PILOT's critique, item 1).
  scrambleSlope: 1.08,    // m/m (47 degrees): the steepest ground scrambled whatever it is made of
  scramblePull: 1.0,      // m/s^2 (100 N): what the hands add to the soles' hold, over g
  wallGap: 0.2,           // m short of its foot the pace read for a wall comes to nothing
  // wayTime (s): legTime x 3 + the time to fall through the reach (sqrt(2 reach / g)): 0.6 s on Earth, 0.95 s on the Moon
  // GAIT (P13). The stride-averaged body above (st.p, st.v: the path, the pace, the stops) is carried by
  // legs that step. Within the stride the hips ride the mechanics of a legged walker:
  //   a WALK is an inverted pendulum: the hips vault over the stance foot on a leg that rolls over the
  //     foot (a rocker of gaitRocker x the leg), lowest when both feet are down, highest over the foot,
  //     slowest at the top (potential and kinetic energy change places);
  //   a RUN is a spring-mass: a ballistic flight under the planet's own gravity between contacts in
  //     which the leg, a spring, turns the body round (half a sine of force whose impulse carries the
  //     weight over the whole step), lowest at mid-stance, highest in flight, braked in the first half
  //     of the contact and driven in the second.
  // How long the steps are follows dynamic similarity (Alexander): the same Froude number v^2 / g L
  // gives the same gait and the same step in leg lengths, on any planet. See gaitOf().
  gaitFr: 0.5,            // the walk becomes a run at this Froude number (2.0 m/s on Earth with a 0.9 m leg; people
                          // change at 0.5 in normal and in reduced gravity: Kram, Domingo and Ferris 1997)
  walkStep: 1.10,         // step / leg in a walk = walkStep Fr^walkStepExp: 0.72 m at 1.4 m/s on Earth, and the
  walkStepExp: 0.21,      //   step grows as v^0.42 (Grieve 1968)
  walkDuty: 0.65,         // share of the stride a foot is down in a walk: walkDuty - walkDutyFr Fr (0.6 at 1.4 m/s)
  walkDutyFr: 0.2,
  runStep: 1.20,          // step / leg in a run = runStep Fr^runStepExp (the form of Alexander and Jayes 1983):
  runStepExp: 0.34,       //   1.1 m at 3 m/s, 1.5 m at 5 m/s, 2.0 m at 7.4 m/s on Earth
  gaitSweep: 0.52,        // rad: half the angle the stance leg sweeps in a run (the body travels 2 L sin = 0.9 m in contact)
  runDutyMax: 0.43,       // the largest share of the stride a foot is down in a run (a jog just above the change)
  gaitRocker: 0.3,        // the foot's roll-over radius over the leg length (McGeer; Gard and Childress: 0.3)
  recovery: 0.65,         // share of the walk's rise and fall that comes back as speed (pendular recovery, 0.6-0.7)
  stepWidth: 0.16,        // m between the lines of the two feet
  // A jump has an anticipation: the legs fold before they push. For jumpCrouch seconds after the command
  // the hips fall (no faster than gravity: nothing can pull them down) toward jumpPush below standing,
  // then the push comes, with the take-off speed below. 0 = the push at once (as before P13). PILOT's
  // lever: cmd.jumpCrouch overrides it.
  jumpCrouch: 0.12,       // s
  // jumping: the legs do the same work on any planet, so the take-off speed depends on gravity:
  //   v^2 = jumpSpeed^2 + 2 jumpPush (jumpG0 - g)
  jumpSpeed: 4.8,         // m/s at jumpG0 (PILOT's tuning: a suit-assisted hop of 1.3 m on Earth)
  jumpPush: 0.4,          // m: how far the legs extend during the push
  jumpG0: 9.0,            // m/s^2 that jumpSpeed is quoted at
  // jetpack
  jetThrust: 1700,        // N (17 m/s^2 on 100 kg: PILOT's jetThrust)
  jetSpool: 0.08,         // s: thrust rise time
  jetVector: 0.6,         // sideways share of the thrust available for steering (about 31 deg of tilt)
  jetSteerTime: 0.35,     // s: how quickly vectoring closes a sideways velocity error
  rcsAccel: 4.0,          // m/s^2: steering from the suit's small thrusters while falling without the jet
  rcsTime: 0.5,           // s
  retroAccel: 45,         // m/s^2: strongest push of the automatic descent brake (an assist PILOT commands)
  retroBand: 0.25,        // the brake lights this share of the limit before the limit (0 = at the limit, at full: before P13)
  // liquid
  floatAssist: true,      // the suit trims its buoyancy so it floats floatDepth deep in ANY liquid
  floatDepth: 1.25,       // m of the body under the surface when floating (PILOT's swimDepth)
  floatTrimStart: 0.8,    // the trim only comes on as the liquid nears float depth (this fraction of
                          // it): wading in the shallows the suit is as heavy as a person, and grips
  wadeWidth: 0.32,        // m: width of the legs and trunk pushing through liquid (drag area = width x depth)
  swimCda: 0.12,          // m^2: drag area swimming (a good swimmer is 0.05-0.1)
  swimForce: 400,         // N: stroke plus suit thrusters (a strong swimmer makes 100-150 N)
  swimTime: 0.4,          // s
  sinkCdaV: 0.25,         // m^2: drag area moving vertically through liquid
});

export const EXPLORER_BODY_STATE = () => ({
  jetThrottle: 0,         // smoothed 0..1
  jetUse: 0,              // thrust fraction actually used this step (for PILOT's fuel)
  slip01: 0,              // 0 gripping .. 1 sliding freely (the ground cannot hold you)
  scramble01: 0,          // 0 easy .. 1 the legs want far more traction than there is (ice, mud)
  sink: 0,                // m the feet are pressed into the ground (for drawing and footprints)
  submerged01: 0,         // fraction of the body under liquid
  windAccel: 0,           // m/s^2 the wind is pushing with
  lean: 0,                // rad the body must lean into the wind to balance it: atan(windAccel / g)
  unload: 0,              // (retired in P9, always 0)
  vvPrev: 0,
  hip: 0,                 // m: leg length now minus standing (-legFold folded .. +legReach reaching down)
  hipV: 0,                // m/s: vertical speed of the hips
  hunker01: 0,            // (P23) 0 upright .. 1 down on hands and knees in a gale (see EXPLORER_BODY.cdaLow); ride folds with it
  windBrace: 0,           // (P23) N the suit is bracing against the wind with (on the ground; see EXPLORER_BODY.windBrace)
  trend: 0,               // m/s: the rate the ground has been rising under the feet (filtered over trendTime)
  base: 0,                // radius of the ground where the legs last stood at their standing length, carried on at `trend`
  baseLo: 0,              // (P21) the lowest ground radius the feet have stood on since then (base is never carried below it)
  clamber01: 0,           // 0 striding .. 1 legs at the end of their stroke (clambering over something)
  clamberT: 0,            // s left of looking ahead after the legs last worked
  grip: 0,                // 1 while the limbs hold a feature (taken at a convex edge, kept until standing again)
  paceCap: 1e9,           // m/s: the pace the walker holds so its feet can follow the ground ahead
  paceAhead: 1e9,         // (P16) m/s: the pace it holds now to meet a face it has seen ahead at the pace it can climb it
  paceCrest: 1e9,         // (P22) m/s: the pace it holds now to meet the crests it has seen at the pace it can follow them
  paceWall: 1e9,          // (P26) m/s: the pace it holds now to stop at the foot of a wall it has seen (see EXPLORER_BODY.scrambleSlope)
  wall: 0,                // (P26) 1 on a step whose feet a wall stopped (the speed into it taken), 2 on one that rode up a wall on its momentum, else 0
  wallAt: null,           // (P26) the last two places on the way that looked like a wall, and whether each is one (see wayWall)
  ahead: null,            // (P16) that face: { x, y, z (unit), rise (m), vc (m/s) } or null
  probe: null,            // (P17) a feature being tried (see EXPLORER_BODY.aheadProbe): its profile, the trials so far
  seen: null,             // (P17) the end of the way ahead known (a feature tried): { x, y, z (unit), d (m along) } or null
  noTry: null,            // (P17) the end of ground read and found to go on rising (not tried: P16's reading holds there)
  readTo: null,           // (P22) the far point the way ahead was last read at (unit direction): the next read is no more than a span past it
  way: null,              // (P22) the way seen (see EXPLORER_BODY.wayStep): { n, x, y, z (unit), h (radius), dS (m away when read), d (m along now) }
  brace: 0,               // m/s of forward speed lost this step against a face or to a hold
  support: 0,             // m/s^2 of normal support from the ground (0 when floating or airborne)
  impact: 0,              // m/s of the last landing (normal speed), set on the landing step
  puff: 0,                // the same, held and decaying over 0.1 s (for dust and sound, read once a frame)
  material: 'soil',
  friction: 0.7,
  dust: 0,                // 0..1 fines raised by the feet right now
  speedGround: 0,         // m/s along the ground
  // (P13) the jump's anticipation
  jumpT: 0, jumpT0: 0,    // s left of the crouch before the push, and its whole length
  crouch01: 0,            // 0 .. 1 through the crouch before a jump (0 at any other time)
  // (P13) the gait. st.p and st.v are the stride's mean; these are the stride within it.
  gait: 0,                // 0 standing (or not stepping: in the air, sliding), 1 walk, 2 run
  stride: 0.25,           // phase of the stride, 0 .. 1: the LEFT foot lands at 0, the RIGHT at 0.5
  stepPhase: 0,           // phase of the step, 0 .. 1 since the last footfall
  cadence: 0,             // steps a second
  stepLength: 0,          // m
  duty: 1,                // share of the stride each foot is down (over 0.5 a walk, under it a run)
  footDown: 3,            // which feet are down: 1 left, 2 right, 3 both, 0 neither (a flight of the run; st.grounded stays true)
  flight: 0,              // 1 in a flight phase of the run
  bob: 0,                 // m: the hips off their standing height because of the stride (below: negative)
  bobV: 0,                // m/s
  ride: 0,                // m: hip + bob: everything the legs do, one number for a figure's hips
  pulse: 0,               // m/s: the forward speed within the stride less its mean (st.v)
  surge: 0,               // m: the body ahead of (+) or behind st.p within the stride (the integral of pulse)
  load: 1,                // the legs' vertical force over the weight right now (0 in a flight, 2 to 4 at a run's mid-stance)
  steps: 0,               // footfalls so far (compare with your own count to catch each one)
  footfall: null,         // the last footfall: { n, foot (0 left, 1 right, 2 both: a landing), p: {x,y,z} body-local, force (N, the stance's peak), speed (m/s the foot meets the ground at) }
  footfalls: null,        // the last four (a ring: footfalls[n & 3])
  feet: null,             // [left, right]: { fwd (m ahead of st.p along heading), up (m off the ground), side (m to the right), down (0 | 1) }
  heading: null,          // unit vector the body is travelling along (kept when it stops)
  gaitAmp: 0, gaitK: 1, gaitV: 0, bobFix: 0, bobMean: 0,
});

// (P19) THE STEP'S SCRATCH. Every object a body step writes and reads back between its own lines (the unit direction it
// sampled last, the ground under the feet, the air, a point read ahead, the gait's numbers) belongs to one set, handed
// down as an argument to each function the step calls; no step reaches for another's. The walker's steps have one set,
// the ghost's (ghostCrosses: the body's own step run over a feature from INSIDE the walker's step) another. Until P19
// both wrote one module-level set, and every trial left the walker's up (`_dir`, which lays the velocity along the
// ground while clambering) and its ground (`_gnd`: material, friction, sink, dust) those of the ghost's run: off the
// x-z plane a run through boulders gained up to 1.1 m/s of radial speed with its feet on level ground (review 7,
// finding 1).
function stepScratch(ghost = false) {
  return {
    ghost,                                  // the ghost's steps lay no stride: the gait is output only (P13), never read by a step
    dir: { x: 0, y: 0, z: 0 },              // the unit direction sampled last: the body's up at its new place, once sampled
    dir2: { x: 0, y: 0, z: 0 },             // a point read ahead (groundAhead, probeStart, the next footfall)
    gnd: {},                                // env.ground's out
    gw: {},                                 // (P26) env.ground's out for the ground where a step would end on a steep face (a wall?)
    G: null, gEnv: null, gx: 0, gy: 0, gz: 0,   // the ground where the last step ended (env.ground's answer), and where
    air: { density: 1.225, wind: { x: 0, y: 0, z: 0 } },
    // (P18) what feels the air: a body half a metre across moving at its own velocity (the sub-second eddies, wind.js gustSubAt)
    recv: { size: 0.5, vx: 0, vy: 0, vz: 0 },
    gt: {},                                 // gaitOf's out
    wr: [0],                                // (P20) env.waterLevel's rate: how fast the drawn sea rises at the body (m/s)
    bf: { sx: 0, sy: 0, sz: 0, w1: 0, c1: 0, lam: 1, px: 0, py: 0, pz: 0, brace: 0, surge: 0 },   // (P21) braceFace's out
  };
}
const _walkS = stepScratch(), _ghostS = stepScratch(true);
const DEFAULT_GROUND = { material: 'soil', friction: 0.7, kinetic: 0.55, foothold: 0.3, restitution: 0.1, sink: 0.015, drag: 0.03, dust: 0.1 };
const DEFAULT_LIQUID = { density: 999, viscosity: 1.14e-3 };

// Take-off speed of a jump under gravity g (see EXPLORER_BODY.jumpSpeed).
export function jumpSpeedFor(g, T = EXPLORER_BODY) {
  return Math.sqrt(Math.max(0.6, T.jumpSpeed * T.jumpSpeed + 2 * T.jumpPush * (T.jumpG0 - g)));
}

// Terminal fall speed of the explorer in air of density rho under gravity g.
export function explorerTerminal(g, rho, T = EXPLORER_BODY) {
  return rho > 0 ? Math.sqrt(2 * T.mass * g / (rho * T.cdaFall)) : Infinity;
}

// The ground `dist` metres ahead of (px,py,pz) along (hx,hy,hz): its radius (one sample; its unit direction is left in
// D2, the step's scratch.dir2). NaN when not moving.
function groundAhead(env, D2, px, py, pz, hx, hy, hz, dist) {
  const l = Math.hypot(hx, hy, hz);
  if (!(l > 1e-9)) return NaN;
  const k = dist / l, x = px + hx * k, y = py + hy * k, z = pz + hz * k, r = Math.hypot(x, y, z) || 1;
  D2.x = x / r; D2.y = y / r; D2.z = z / r;
  return env.sample(D2).radius;
}
// (P26) The steepest ground (rise per metre) the limbs scramble on ground G under gravity g (see EXPLORER_BODY.scrambleSlope)
function scrambleHold(G, g, T) { return Math.max(T.scrambleSlope, G.friction + G.foothold + T.scramblePull / Math.max(0.3, g)); }
// (P26) Does the ground go on up from (px, py, pz) (radius h) along (hx, hy, hz): more than a clamber over h within a look
// or two? (the second half of what makes a steep face a WALL: see EXPLORER_BODY.scrambleSlope)
function risesOn(env, D2, px, py, pz, h, hx, hy, hz, T) {
  return groundAhead(env, D2, px, py, pz, hx, hy, hz, T.look) - h > T.clamber || groundAhead(env, D2, px, py, pz, hx, hy, hz, 2 * T.look) - h > T.clamber;
}
// (P16) THE WAY AHEAD. Running, read the ground `d` ahead along the path (and aheadSpan short of it), d far enough for the
// soles to brake from this pace; a face the hips must climb (a rise of more than the stroke within aheadSpan, and more
// than the stroke over the line of the ground being run on, within a clamber) is remembered; the pace held is what still
// meets it at the pace it can be crossed in contact. aB: the braking the grip and the assist can give (m/s^2).
// (P17) Anything the legs must work on (a rise of more than their fold) is tried: see EXPLORER_BODY.aheadProbe. vw: the
// pace wished for (a feature is tried at the faster of it and the pace now). S: the step's scratch (see stepScratch).
function wayAhead(B, env, S, px, py, pz, h1, sx, sy, sz, vh, gE, aB, T, vw = vh) {
  const stroke = T.legFold + T.legReach, ab = Math.max(0.3, T.aheadMargin * aB);
  const r = Math.hypot(px, py, pz) || 1, ux = px / r, uy = py / r, uz = pz / r;
  let hx = sx, hy = sy, hz = sz; const hu = hx * ux + hy * uy + hz * uz; hx -= hu * ux; hy -= hu * uy; hz -= hu * uz;
  const hl = Math.hypot(hx, hy, hz);
  if (!(hl > 1e-9) || !(gE > 0)) { B.paceAhead = 1e9; B.ahead = null; if (B.probe) B.probe.active = false; B.seen = null; B.noTry = null; return; }
  hx /= hl; hy /= hl; hz /= hl;
  // the face remembered: still ahead and on the path?
  let A = B.ahead;
  if (A) { A.d = alongWay(A, ux, uy, uz, hx, hy, hz, r, A.hold || 0.5); if (A.d < -1e8) A = B.ahead = null; }
  // (P17) the way known up to here (a feature tried: clear, or its face remembered), and the feature being tried
  if (B.seen) { B.seen.d = alongWay(B.seen, ux, uy, uz, hx, hy, hz, r); if (B.seen.d < -1e8) B.seen = null; }
  if (B.noTry) { B.noTry.d = alongWay(B.noTry, ux, uy, uz, hx, hy, hz, r); if (B.noTry.d < -1e8) B.noTry = null; }
  const Q = B.probe;
  if (Q && Q.active) { Q.d = alongWay(Q, ux, uy, uz, hx, hy, hz, r); if (Q.d < -1e8) Q.active = false; }
  // read the way: the far point, and aheadSpan short of it
  // (read only while running; a face already seen is kept, slow or not, until it is passed or off the path)
  const d = Math.min(T.aheadMax, vh * vh / (2 * ab)) + T.look;
  if (vh > T.aheadFrom && d > T.aheadSpan + 0.5) {
    if (Q && Q.active) {
      // (P17) one trial a step; when the trials are done the feature is a face to meet at its pace, or clear
      if (probeTrial(Q, env, T)) {
        Q.active = false;
        B.seen = { x: Q.end.x, y: Q.end.y, z: Q.end.z, d: Q.end.d };
        if (Q.vc < 1e8) {
          // (a face tried is held to until the body is back on its feet beyond its top, as in the trials: hold, m past its point)
          const N = { x: Q.x, y: Q.y, z: Q.z, rise: Q.rise, vc: Q.vc, d: Q.d, tried: true, hold: Math.max(0.5, Q.xTop - Q.xFar + T.look + 0.3) };
          // (the law's stand-in for this feature gives way to what was tried; another face: the dearer)
          if (A && !A.tried && Math.abs(N.d - A.d) < T.aheadSpan + T.aheadProbeAfter) { A.x = N.x; A.y = N.y; A.z = N.z; A.d = N.d; A.vc = N.vc; A.rise = N.rise; A.tried = true; A.hold = N.hold; }
          else if (!A || paceCost(N, ab, T) < paceCost(A, ab, T)) A = B.ahead = N;
        } else if (A && !A.tried && Math.abs(Q.d - A.d) < T.aheadSpan + T.aheadProbeAfter) A = B.ahead = null;   // tried: no slowing
      }
    } else {
      // (P22) ... no further on than a span past what has been read: as the pace and the far point grew, the read jumped
      // forward and left ground unread between (the field of boulders on the Moon: a 0.9 m boulder 4 m past the end of
      // what was known was never read, and met braced at 7.4 m/s)
      // (from here, when nothing read lies ahead on the path)
      const rt = B.readTo ? alongWay(B.readTo, ux, uy, uz, hx, hy, hz, r) : -1e9;
      const base = Math.max(rt > -1e8 ? rt : 0, B.seen ? B.seen.d : -1e9);
      const dR = Math.max(T.aheadSpan + 0.5, Math.min(d, base + T.aheadSpan));
      const D2 = S.dir2, hN = groundAhead(env, D2, px, py, pz, hx, hy, hz, dR - T.aheadSpan), hF = groundAhead(env, D2, px, py, pz, hx, hy, hz, dR);   // (D2: the far point)
      const RT = B.readTo || (B.readTo = { x: 0, y: 0, z: 0 }); RT.x = D2.x; RT.y = D2.y; RT.z = D2.z;
      // (the rise over the line of the ground being run on, or over the ground just short of it when that is lower: (P22)
      // climbing the flank of one boulder, its slope carried on 8 m put the line over the next one, which was never read)
      const slope = B.trend > 0 ? B.trend / vh : 0, rise = hF - Math.min(h1 + slope * dR, hN);
      const known = B.seen && dR <= B.seen.d;
      if (!known && hF - hN > T.legFold && rise > T.legFold && hF - h1 <= T.clamber) {
        const fx = D2.x, fy = D2.y, fz = D2.z;
        // the law stands in while it is tried (faces over the stroke, as in P16)
        if (hF - hN > stroke && rise > stroke) {
          const vc = Math.max(0.5, T.aheadPace / Math.pow(Math.max(0.05, rise - T.legFold), T.aheadExp));
          const N = { x: fx, y: fy, z: fz, rise, vc, d: dR, tried: false };
          // (the same face read again a little further on: it is as high as its highest reading; another face: the dearer)
          if (A && Math.abs(N.d - A.d) < T.aheadSpan) { if (N.vc < A.vc && !A.tried) { A.vc = N.vc; A.rise = N.rise; } }
          else if (!A || paceCost(N, ab, T) < paceCost(A, ab, T)) A = B.ahead = N;
        }
        if (!(A && A.tried && Math.abs(dR - A.d) < T.aheadSpan) && !(B.noTry && dR <= B.noTry.d)) {
          const P = probeStart(B, env, D2, px, py, pz, h1, hx, hy, hz, r, dR, rise, Math.max(vh, Math.min(vw, vh + 2)), fx, fy, fz, T);
          // ((P22) a hill: no face, the stand-in goes)
          if (P.hill && A && !A.tried && Math.abs(A.d - dR) < T.aheadSpan) A = B.ahead = null;
        }
        // ((P22) a reading within a hill already found is the hill's)
        else if (B.noTry && dR <= B.noTry.d && B.probe && B.probe.hill && A && !A.tried && Math.abs(A.d - dR) < T.aheadSpan) A = B.ahead = null;
      }
    }
  }
  B.paceAhead = A ? Math.sqrt(A.vc * A.vc + 2 * ab * Math.max(0, A.d - T.look)) : 1e9;
}

// ---- (P22) the way, seen (see EXPLORER_BODY.wayStep) ----------------------------------------------------
const WAY_N = 52;
function wayRing() {
  const f = () => new Float64Array(WAY_N);
  return { n: 0, x: f(), y: f(), z: f(), h: f(), dS: f(), d: f(), ok: false, lo: 0, hi: 0 };
}
export function wayTime(gE, T = EXPLORER_BODY) { return 3 * T.legTime + Math.sqrt(2 * T.legReach / Math.max(0.3, gE)); }
// Keep the way along (hx, hy, hz) (unit, level) from the feet at (px, py, pz) out to `far` m, and the tube for the hips
// (radius c, the pace vh) over the first `near` m: W.lo and W.hi, the slowest and the fastest they may rise (m/s; see
// LEGS, 3). D2: the step's scratch direction.
function wayUpdate(B, env, D2, px, py, pz, h1, c, vh, hx, hy, hz, near, far, T) {
  const W = B.way || (B.way = wayRing());
  const r = Math.hypot(px, py, pz) || 1, ux = px / r, uy = py / r, uz = pz / r, lat2 = T.wayLat * T.wayLat;
  // where each sample lies now; off the way or behind, it goes
  let m = 0;
  for (let i = 0; i < W.n; i++) {
    const dx = W.x[i] - ux, dy = W.y[i] - uy, dz = W.z[i] - uz, d = (dx * hx + dy * hy + dz * hz) * r;
    const ex = dx * r - d * hx, ey = dy * r - d * hy, ez = dz * r - d * hz;
    if (d < -0.5 || d > far + 1 || ex * ex + ey * ey + ez * ez > lat2) continue;
    W.x[m] = W.x[i]; W.y[m] = W.y[i]; W.z[m] = W.z[i]; W.h[m] = W.h[i]; W.dS[m] = W.dS[i]; W.d[m] = d; m++;
  }
  W.n = m;
  // nearest first (they come in nearly in order)
  for (let i = 1; i < W.n; i++) {
    let j = i; const d = W.d[i];
    if (W.d[j - 1] <= d) continue;
    const x = W.x[i], y = W.y[i], z = W.z[i], h = W.h[i], s = W.dS[i];
    while (j > 0 && W.d[j - 1] > d) { W.x[j] = W.x[j - 1]; W.y[j] = W.y[j - 1]; W.z[j] = W.z[j - 1]; W.h[j] = W.h[j - 1]; W.dS[j] = W.dS[j - 1]; W.d[j] = W.d[j - 1]; j--; }
    W.x[j] = x; W.y[j] = y; W.z[j] = z; W.h[j] = h; W.dS[j] = s; W.d[j] = d;
  }
  // read again what has come wayFresh nearer since it was read (nearest first)
  let k = T.wayFill;
  for (let i = 0; i < W.n && k > 0; i++) if (W.dS[i] - W.d[i] > T.wayFresh && W.d[i] > 0) { D2.x = W.x[i]; D2.y = W.y[i]; D2.z = W.z[i]; W.h[i] = env.sample(D2).radius; W.dS[i] = W.d[i]; k--; }
  // fill the gaps, nearest first (all of it when the way is empty)
  k = W.n ? T.wayFill : WAY_N;
  const ds = T.wayStep;
  let prev = 0, i = 0;
  while (k > 0 && W.n < WAY_N) {
    while (i < W.n && W.d[i] <= prev + 1.6 * ds) { if (W.d[i] > prev) prev = W.d[i]; i++; }
    const s = prev + ds;
    if (s > far) break;
    const x = px + hx * s, y = py + hy * s, z = pz + hz * s, l = Math.hypot(x, y, z) || 1;
    D2.x = x / l; D2.y = y / l; D2.z = z / l;
    const h = env.sample(D2).radius;
    // (insert at i, keeping the order)
    for (let j = W.n; j > i; j--) { W.x[j] = W.x[j - 1]; W.y[j] = W.y[j - 1]; W.z[j] = W.z[j - 1]; W.h[j] = W.h[j - 1]; W.dS[j] = W.dS[j - 1]; W.d[j] = W.d[j - 1]; }
    W.x[i] = D2.x; W.y[i] = D2.y; W.z[i] = D2.z; W.h[i] = h; W.dS[i] = s; W.d[i] = s; W.n++;
    prev = s; i++; k--;
  }
  // the tube over the first `near` metres: the vertical speeds (m/s at the pace vh) that carry the hips (radius c) straight
  // on to the fold of the ground (L) at each sample and to its reach (U). The hips must rise no slower than to clear the
  // fold of what is ahead and above them (lo), no faster than keeps the reach of what is ahead (hi); but a line on to a
  // far sample that would leave the stroke of a nearer one is not their path (a rock taller than the stroke: they rise
  // as far as the ground before it lets them, no faster than on to the fold of its top, and its top and far side are the
  // legs' to take, as before): a fold beyond a nearer reach is not counted, and a reach beyond a nearer fold asks no
  // more than that fold. So lo <= hi.
  let lo = -1e9, hi = 1e9, maxL = -1e9, minU = 1e9;
  const d0 = Math.max(0.25, T.wayStep * 0.8), deep = h1 - T.clamber;
  for (let j = 0; j < W.n && W.d[j] <= near; j++) {
    const d = W.d[j];
    if (d < d0) continue;
    // (a rise counts only above the hips: ground below them they come down to as the legs level them, and stop over it;
    // a drop only within a clamber of the feet: beyond it is a fall, not ground to follow)
    const L = W.h[j] - T.legFold + T.wayMargin, sL = vh * (L - c) / d, okU = W.h[j] > deep, sU = vh * (W.h[j] + T.legReach - T.wayMargin - c) / d;
    if (L > c && sL <= minU && sL > lo) lo = sL;
    if (okU) { const b = Math.max(sU, maxL); if (b < hi) hi = b; if (sU < minU) minU = sU; }
    if (sL > maxL) maxL = sL;
  }
  W.ok = hi < 1e8; W.lo = lo; W.hi = hi;
  return W;
}

// (P22) THE CREST (see EXPLORER_BODY.crestPace). The way's ground at d m along (interpolated; NaN beyond what is known).
function wayAt(W, d) {
  if (!(W.n > 1) || d < W.d[0] || d > W.d[W.n - 1]) return NaN;
  let lo = 0, hi = W.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (W.d[m] < d) lo = m; else hi = m; }
  const i = hi, a = W.d[i - 1], b = W.d[i];
  return b > a ? W.h[i - 1] + (W.h[i] - W.h[i - 1]) * (d - a) / (b - a) : W.h[i];
}
// The pace to hold now so that every crest along the way known is met at the pace the hips can follow over it, braking at
// ab: a crest rising at s1 and falling at s2 (over a look either side) is followed in contact up to
// sqrt(2 (g + gripAccel) stroke) / (s1 + s2) (the hips, coming up it at v s1, are turned to v s2 down within the stroke,
// pulled by gravity and the limbs on the edge), x crestMargin. The near side counts only where it rises more than a
// clamber (a rim, a hill's brow) or the run is already climbing it; an edge falling away from level ground counts with
// s1 = 0, unless it falls more than a clamber in a look (a fall).
// (P24, the coordinator's ruling on knife edges) At a KNIFE EDGE (the top of a climb whose far side falls more than a clamber
// in a look: a crater's inner wall) the far side is a fall, not ground to follow, and the law is only: DON'T THROW THE RUNNER
// UP. The hips, rising at v s1, are turned to level within the legs' fold by gravity alone (nothing beyond the edge to hold):
// v <= sqrt(2 g legFold) / s1, x crestMargin (on the Moon 4.5 m/s at a 14 degree rise, 6.3 at 10, 0.64 up a 60 degree
// ridge; on Earth 11 at 14 degrees). Past the edge the body may leave the ground where the ground falls away (the
// crater-wall ruling; Decision 50): low-gravity physics, as a runner off a crater wall on the Moon. Until P24 the knife edge
// was read as a crest followed down its far side at its steepest followable slope (sqrt(2 g stroke) / (s1 + clamber /
// look)): 1.1-1.4 m/s for 2-3 s on the gentle rise to a crater's inner wall (PILOT's verdict: too heavy). Rounded crests and
// rims whose far side falls within a clamber in a look are read as before.
function wayCrest(W, h0, vh, gE, ab, ts, T) {
  if (!W || !(W.n > 2)) return 1e9;
  const L = T.look, st = (T.legFold + T.legReach) * 2, k = Math.sqrt(Math.max(0.1, gE + T.gripAccel) * st) * T.crestMargin, kn = Math.sqrt(2 * Math.max(0.1, gE) * T.legFold) * T.crestMargin;
  let pace = 1e9;
  // (at each sample and half way to the next)
  for (let j = 0; j < 2 * W.n - 1; j++) {
    const d = j & 1 ? 0.5 * (W.d[j >> 1] + W.d[(j >> 1) + 1]) : W.d[j >> 1];
    if (d < 0.3) continue;
    // (the crest's own height: the highest within a half spacing, so that a corner between evaluations is not cut)
    let hc = j & 1 ? wayAt(W, d) : W.h[j >> 1];
    { const q = 0.5 * T.wayStep, a = wayAt(W, d - q), b = wayAt(W, d + q); if (a > hc) hc = a; if (b > hc) hc = b; }
    // (short of what is kept, the ground under the feet (h0), and behind them the slope the run is on: ts)
    const db = d - L, hb = db >= W.d[0] ? wayAt(W, db) : db >= 0 ? h0 + (W.h[0] - h0) * db / W.d[0] : h0 + ts * db, ha = wayAt(W, d + L);
    if (!(hb === hb) || !(ha === ha)) continue;
    const sn = (hc - hb) / L, drop = hc - ha;
    // (what cannot hold the run back now, at the most the near side could count, is not read further: the walker gains
    // less than a metre a second in a step)
    { const sm = Math.max(sn, Math.min(ts, 2 * sn), 0); if (!((drop > T.clamber ? kn / Math.max(0.05, sm) : k / Math.max(0.05, sm + Math.min(drop, T.clamber) / L)) < vh + 1)) continue; }
    // (the hips ride the near side only where it rises more than a clamber: a rock or a mound lower than that is crossed
    // within the stroke, the hips raised in time (the tube), and its face is read and tried (P16, P17); only its fall counts)
    let lo3 = Math.min(hc, hb); for (let i = (j >> 1); i >= 0 && W.d[i] >= d - 3 * L; i--) if (W.h[i] < lo3) lo3 = W.h[i];
    if (d - 3 * L < W.d[0] && h0 < lo3) lo3 = h0;
    // (or where the run is already on it, climbing at its slope: ts, the rise of the hips (or the ground's trend) per metre)
    const s1 = hc - lo3 > T.clamber || ts > 0.5 * sn ? Math.max(sn, Math.min(ts, 2 * sn)) : 0;
    // (a drop deeper than a clamber in a look is a fall, not ground to follow: from level ground it is not slowed for; at
    // the top of a climb it is a knife edge, and the climb is: the hips must be turned from it within the fold, whatever
    // is beyond (a 60 degree ridge on the Moon, climbed at 2 m/s, threw the body 0.5 m up off its crest))
    if (drop > T.clamber && !(s1 > 0)) continue;
    const sig = s1 + Math.min(drop, T.clamber) / L;
    if (!(sig > 0.05)) continue;
    // (beyond a knife edge there is nothing within reach to hold: gravity alone turns the hips, and only their rise counts:
    // P24, don't throw the runner up)
    const vc = drop > T.clamber ? kn / Math.max(0.05, s1) : k / sig;
    const p = Math.sqrt(vc * vc + 2 * ab * Math.max(0, d - L));
    if (p < pace) pace = p;
  }
  return pace;
}

// (P26) THE WALL SEEN (see EXPLORER_BODY.scrambleSlope). The pace to hold now so that the soles, braking at ab, bring the
// walker to a stop wallGap short of the nearest wall on the way known: the first of its samples from which the way goes
// on up steeper than `slope` (a first look: 0.75 of what the ground under the feet is scrambled to) and rises more than
// a clamber within a look or two, and whose own facet is steeper than its own ground is scrambled under gravity g: the
// facet a step would be stopped at (LEGS, 3), seen from as far as the soles need. The facet and its ground are asked of
// the world once for each such sample and kept (the last two: B.wallAt; G: the ground where the world tells nothing of
// it); what only looks like a wall from here (a band of steps in a slope, a ridge whose top is within a clamber) is passed
// over.
function wayWall(B, env, S, W, ab, slope, G, g, T) {
  if (!W || !(W.n > 1)) return 1e9;
  let asked = 0;
  for (let m = 0; m < W.n - 1; m++) {
    const d = W.d[m], h = W.h[m];
    if (!((W.h[m + 1] - h) > slope * (W.d[m + 1] - d))) continue;
    if (!(wayAt(W, d + T.look) - h > T.clamber || wayAt(W, d + 2 * T.look) - h > T.clamber)) continue;
    // a wall by its own facet and ground?
    const C = B.wallAt || (B.wallAt = [{ x: 0, y: 0, z: 0, is: false, ok: false, env: null, k: 0 }, { x: 0, y: 0, z: 0, is: false, ok: false, env: null, k: 0 }]);
    let c = C[0].ok && C[0].env === env && C[0].x === W.x[m] && C[0].y === W.y[m] && C[0].z === W.z[m] ? C[0] : C[1].ok && C[1].env === env && C[1].x === W.x[m] && C[1].y === W.y[m] && C[1].z === W.z[m] ? C[1] : null;
    if (!c) {
      if (asked++) return 1e9;                                                   // (one new place a step)
      c = C[C[0].k = 1 - C[0].k];
      const D2 = S.dir2; D2.x = W.x[m]; D2.y = W.y[m]; D2.z = W.z[m];
      const sm = env.sample(D2), nm = sm.normal, nl = nm ? Math.hypot(nm.x, nm.y, nm.z) : 0, cn = nl > 1e-9 ? (nm.x * D2.x + nm.y * D2.y + nm.z * D2.z) / nl : 1;
      const tn = cn > 0.05 ? Math.sqrt(Math.max(0, 1 - cn * cn)) / cn : 1e9;
      c.x = D2.x; c.y = D2.y; c.z = D2.z; c.ok = true; c.env = env;
      c.is = tn > scrambleHold(env.ground ? env.ground(sm, S.gw) : G, g, T);
    }
    if (c.is) return Math.sqrt(2 * ab * Math.max(0, d - T.wallGap));
  }
  return 1e9;
}

// Where a remembered point (unit direction P) lies on the way from (ux, uy, uz) along (hx, hy, hz): how far along it (m),
// or -1e9 when it is `behind` m behind or more than a metre off the path.
function alongWay(P, ux, uy, uz, hx, hy, hz, r, behind = 0.5) {
  const dx = P.x - ux, dy = P.y - uy, dz = P.z - uz, d = (dx * hx + dy * hy + dz * hz) * r;
  const ex = dx * r - d * hx, ey = dy * r - d * hy, ez = dz * r - d * hz;
  return d < -behind || ex * ex + ey * ey + ez * ez > 1.0 ? -1e9 : d;
}
// The pace to hold now to meet face q at its pace, braking at ab (the dearer of two faces is the one that asks less now).
function paceCost(q, ab, T) { return Math.sqrt(q.vc * q.vc + 2 * ab * Math.max(0, q.d - T.look)); }

// ---- (P17) the way ahead, tried ------------------------------------------------------------------------
// The feature's profile along the path, relative to the ground under the walker, from aheadProbeBefore short of the
// span to aheadProbeAfter beyond the far point at d; the trials then run the body itself over it.
function probeStart(B, env, D2, px, py, pz, h1, hx, hy, hz, r, d, rise, v, fx, fy, fz, T) {
  const n = Math.max(2, Math.min(40, Math.round((T.aheadSpan + T.aheadProbeBefore + T.aheadProbeAfter) / T.aheadProbe) + 1));
  let Q = B.probe;
  if (!Q || Q.prof.length < n) Q = B.probe = { active: false, hill: false, prof: new Float64Array(n), nsl: new Float64Array(n), n: 0, step: T.aheadProbe, x: 0, y: 0, z: 0, d: 0, rise: 0, lo: 0, hi: 0, law: 0, tries: 0, vc: 1e9, surf: null, gnd: {}, G: null, end: { x: 0, y: 0, z: 0, d: 0 }, R: r, g: 0, env: null };
  const s0 = Math.max(0.2, d - T.aheadSpan - T.aheadProbeBefore);
  // (each sample's height, and the slope along the way its own normal gives: the ghost meets the ground with the normals
  // the walker will meet it with, which need not be the profile's own: PILOT's boulders keep the level ground's)
  for (let i = 0; i < n; i++) {
    const k = s0 + i * T.aheadProbe, x = px + hx * k, y = py + hy * k, z = pz + hz * k, rr = Math.hypot(x, y, z) || 1;
    D2.x = x / rr; D2.y = y / rr; D2.z = z / rr;
    const sm = env.sample(D2), nm = sm.normal, nu = nm ? nm.x * D2.x + nm.y * D2.y + nm.z * D2.z : 1;
    Q.prof[i] = sm.radius - h1;
    Q.nsl[i] = nm && nu > 0.05 ? -(nm.x * hx + nm.y * hy + nm.z * hz) / nu : 0;
  }
  Q.end.x = D2.x; Q.end.y = D2.y; Q.end.z = D2.z; Q.end.d = s0 + (n - 1) * T.aheadProbe;
  // the ground there (for its grip): the far point's own surface, kept, and (P19) its contact properties, asked of the
  // walker's env once, here, into the probe's own object: the ghost's steps read them and never call the walker's env
  // (P17 asked env.ground at every ghost step, into the walker's own ground object: most of a trial's cost, and finding 1)
  D2.x = fx; D2.y = fy; D2.z = fz;
  { const s = env.sample(D2); Q.surf = Q.surf || {}; for (const k in s) Q.surf[k] = s[k]; }
  Q.G = env.ground ? env.ground(Q.surf, Q.gnd) : null;
  Q.n = n; Q.step = T.aheadProbe; Q.x = fx; Q.y = fy; Q.z = fz; Q.d = d; Q.rise = rise; Q.R = r; Q.xFar = d - s0;
  // (the ghost runs from a little before the ground starts to rise to where the body is back on its feet past the top.
  // (P19) In a boulder field the profile can begin on the far flank of the boulder the walker is coming off. Then the
  // rise starts at the valley (the lowest ground before the top, when the profile falls into it by more than 5 cm), not
  // at the first sample, and the ghost's run-up lies on the valley's floor, not on the flank before it (that descent is
  // the last feature's, and a ghost run off it at speed leaves the ground). Until P19 the rise was found only partway up
  // the next boulder and the ghost was set down there at the first sample's height, in the air: every trial failed at
  // its first step and the run crawled to that boulder at the least pace, 0.5 m/s.)
  { let it = 0; for (let i = 1; i < n; i++) if (Q.prof[i] > Q.prof[it]) it = i;
    let iv = 0; for (let i = 1; i < it; i++) if (Q.prof[i] < Q.prof[iv]) iv = i;
    if (!(Q.prof[0] - Q.prof[iv] > 0.05)) iv = 0;
    let i0 = iv; while (i0 < n - 1 && Q.prof[i0] - Q.prof[iv] < 0.05) i0++;
    Q.x0 = iv > 0 ? Math.max(iv * Q.step, (i0 - 1) * Q.step - 1.5) : Math.max(0, i0 - 1) * Q.step - 1.5; Q.xTop = it * Q.step; }
  // (the trials run a margin faster than the pace: the body's limits are sharp (a hold that takes over at a few
  // millimetres more rise), and the ghost's ground is the profile, not the ground itself)
  Q.lo = 0.5; Q.hi = v / T.aheadProbeMargin; Q.tries = 0; Q.vc = 1e9; Q.active = true; Q.parent = env;
  // (only what comes down again is tried: a hump, a boulder. Ground that goes on rising (a hill, a ledge) keeps P16's
  // reading: a hill is run at the pace the legs' power allows, a ledge over the stroke is the law's face. The way is
  // known to the profile's end either way, so a long slope is read once in every few metres, not every step.)
  // (P22) ... but a HILL is not a face: ground still rising steeply at the profile's end (over its last two looks, more
  // than aheadSpan's 60 %: the slope that made it a face) has no top to bring the hips down from, and P16's law (the pace at
  // which the hips can be raised onto a top and brought down beyond it) read a 43 degree hill on Mars and Earth as a face
  // and slowed the run to 1.1-1.2 m/s before it. A hill is run onto at the pace the run has: its foot takes the speed into
  // it (P21's brace: v cos^2 of it is kept), and up it the legs' power, the grip, the suit and gravity set the pace.
  // Nothing is held for it (Q.hill: the law's stand-in for this reading is dropped in wayAhead).
  // (and rising more than a clamber over the last two looks: no rock or ledge read as a face does; a row's next boulder,
  // where the profile ends on its face, is not a hill)
  const kL = Math.max(1, Math.round(2 * T.look / Q.step)), hill = n > kL && Q.prof[n - 1] - Q.prof[n - 1 - kL] > Math.max(T.clamber, 1.2 * T.look);
  Q.hill = hill;
  if (hill || Q.prof[n - 1] > Q.prof[Math.round(Q.xTop / Q.step)] - T.legFold) { Q.active = false; B.noTry = { x: Q.end.x, y: Q.end.y, z: Q.end.z, d: Q.end.d }; }
  Q.law = rise > T.legFold + 0.05 ? Math.max(0.5, Math.min(Q.hi, T.aheadPace / Math.pow(rise - T.legFold, T.aheadExp) / T.aheadProbeMargin)) : 0;
  return Q;
}
// One trial: the pace to try is the pace wished for first, then the law's (when it is under that), then the middle of
// what is left. Returns true when the trials are done (Q.vc: the pace to meet it at, 1e9 when no slowing is needed).
function probeTrial(Q, env, T) {
  const v = Q.tries === 0 ? Q.hi : Q.tries === 1 && Q.law > Q.lo && Q.law < Q.hi ? Q.law : 0.5 * (Q.lo + Q.hi);
  const ok = ghostCrosses(Q, v, env, T);
  Q.tries++;
  if (ok) { if (Q.tries === 1) { Q.vc = 1e9; return true; } Q.lo = v; } else Q.hi = v;
  if (Q.tries >= T.aheadProbeTries || Q.hi - Q.lo < 0.15) { Q.vc = Math.max(0.5, Q.lo * T.aheadProbeMargin); return true; }
  return false;
}
// The ghost: the body run at a steady wish of v over Q's profile laid along a great circle of radius Q.R (no world
// samples). It crosses when no step braces, no hold checks it below the pace it holds, and the feet never leave the
// ground, from 1.5 m before the ground starts to rise until it is back on its feet (no hold, the hips within 5 cm of
// standing) a look and 0.3 m past the top (the hold reads the ground a look ahead), or 0.3 m beyond the profile.
const _gq = [0, 1, 2, 3].map(() => ({ radius: 0, normal: { x: 0, y: 1, z: 0 }, liquidRadius: 0, slope: 0, isLiquid: false }));
let _gk = 0, _gQ = null;
const _gst = { p: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 0, z: 0 }, grounded: true, phys: null };
const _gB0 = Object.freeze(EXPLORER_BODY_STATE()), _gB = EXPLORER_BODY_STATE();   // (P19) the ghost's body, set afresh each trial (no garbage)
const _gWay = wayRing();
const _gWallAt = [{ x: 0, y: 0, z: 0, is: false, ok: false, env: null, k: 0 }, { x: 0, y: 0, z: 0, is: false, ok: false, env: null, k: 0 }];   // (P26) the ghost's own (no garbage)
const _gcmd = { wish: { x: 0, y: 0, z: 0 } };
const _gT = new WeakMap();
function ghostSample(dir) {
  const Q = _gQ, x = Math.atan2(dir.x, dir.z) * Q.R, u = x / Q.step, P = Q.prof, n = Q.n;
  let h, sl;
  const S = Q.nsl;
  if (u <= 0) { h = P[0]; sl = S[0]; } else if (u >= n - 1) { h = P[n - 1]; sl = S[n - 1]; }
  else { const i = Math.floor(u), f = u - i; h = P[i] + (P[i + 1] - P[i]) * f; sl = S[i] + (S[i + 1] - S[i]) * f; }
  const o = _gq[_gk = (_gk + 1) & 3], t = x / Q.R, ex = Math.cos(t), ez = -Math.sin(t), l = 1 / Math.sqrt(1 + sl * sl);
  o.radius = Q.R + h; o.normal.x = (dir.x - ex * sl) * l; o.normal.y = dir.y * l; o.normal.z = (dir.z - ez * sl) * l; o.slope = Math.atan(Math.abs(sl));
  return o;
}
// the profile's height at x m along it (relative to the walker's ground; held beyond its ends, as ghostSample)
function profileAt(Q, x) {
  const u = x / Q.step, P = Q.prof, n = Q.n;
  if (u <= 0) return P[0];
  if (u >= n - 1) return P[n - 1];
  const i = Math.floor(u); return P[i] + (P[i + 1] - P[i]) * (u - i);
}
function ghostCrosses(Q, v, env, T) {
  let Tg = _gT.get(T);
  if (!Tg) { Tg = Object.freeze({ ...T, aheadFrom: 1e9 }); _gT.set(T, Tg); }     // (the ghost does not read ahead itself)
  const P = Q.parent;
  // (P19) the ghost's env: its own samples (the profile), the walker's gravity and liquid, and the far point's ground as
  // probeStart asked it (Q.G): nothing in a trial calls the walker's env or touches the walker's scratch (_ghostS below)
  const genv = Q.env || (Q.env = { sample: ghostSample, gravity: 0, ground: undefined, liquid: undefined, groundQ: () => Q.G });
  genv.gravity = P.gravity; genv.liquid = P.liquid; genv.ground = Q.G ? genv.groundQ : undefined;
  _gQ = Q;
  const st = _gst, R = Q.R, end = (Q.n - 1) * Q.step + 0.3;
  // (P19: set down on the profile where it starts, as ghostSample has it there)
  let t = Q.x0 / R, rr = R + profileAt(Q, Q.x0);
  st.p.x = Math.sin(t) * rr; st.p.y = 0; st.p.z = Math.cos(t) * rr;
  st.v.x = Math.cos(t) * v; st.v.y = 0; st.v.z = -Math.sin(t) * v;
  st.grounded = true; st.phys = Object.assign(_gB, _gB0);
  _gB.way = _gWay; _gWay.n = 0; _gWay.ok = false;          // (P22) the ghost's own way (no garbage)
  _gB.wallAt = _gWallAt; _gWallAt[0].ok = false; _gWallAt[1].ok = false;
  for (let k = 0; k < 900; k++) {
    t = Math.atan2(st.p.x, st.p.z);
    _gcmd.wish.x = Math.cos(t) * v; _gcmd.wish.y = 0; _gcmd.wish.z = -Math.sin(t) * v;
    stepBody(st, _gcmd, 1 / 60, genv, Tg, _ghostS);
    const B = st.phys;
    if (!st.grounded || B.brace > 1e-3) return false;
    if (B.grip && B.paceCap < 1e8) { const sp = Math.hypot(st.v.x, st.v.y, st.v.z); if (sp > B.paceCap + 0.02) return false; }
    const x = t * R;
    if (x > end || (x > Q.xTop + T.look + 0.3 && !B.grip && B.hip > -0.05 && B.hip < 0.05)) return true;
  }
  return false;
}

// Is there something for the limbs to hold? Yes when the ground `look` ahead (radius hD) lies well below
// the line the hips are moving on (c: hips less a leg, w: their vertical speed, vh: their speed over the
// ground): a convex feature at the scale of a limb; and when that ground is within a clamber of the feet.
function holdAhead(c, w, vh, feet, hD, T) {
  if (!(hD === hD)) return false;
  const m = vh > 0.3 ? clamp(w / vh, -2, 2) : 0;
  return c + m * T.look - hD > T.legReach + T.gripDepth && feet - hD <= T.clamber;
}

// The ground's radius under the point (x, y, z) (its unit direction left in D2).
function radAt(env, D2, x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  D2.x = x / l; D2.y = y / l; D2.z = z / l;
  return env.sample(D2).radius;
}
// (P21) THE BRACE AGAINST A FACE (see EXPLORER_BODY.braceSide). The legs are folded to their end and the ground where the
// step would end (radius h1, the step being s dt from the feet at radius r) lies higher than the hips can be raised to.
// The face: its rise along the path (gs, the secant from the feet to h1 over the step's run) and across it (gl, the
// ground braceSide either side of the step's end). The mass rides at the hips: its velocity is vh along the path (the
// horizontal part of s) and the hips' vertical speed w. The face pushes along its normal (u - gs e - gl l) / n3: the legs
// take up the speed into it, legCatch dt at most this step; the push across the path (a face tilted to the side) is held
// by the soles, whose grip the push itself presses on (hold x the normal impulse), so the run keeps its line when that is
// enough. The speed along the face is kept: up it as fast as the hips may rise (wOk: stopped by gravity and a hold,
// gE + pull, within the reach over the lowest ground they will be over meanwhile; never less than capB, what the legs
// alone may heave them at), the rest of it taken by the legs too, within what is left of legCatch; met at a slant, the
// face rises less along the path (gs) and takes less. The feet go up it no further than the hips allow (lam); the body
// comes on over them meanwhile (surge), as in P13. Fills S.bf: the horizontal velocity after (sx, sy, sz), the hips'
// speed and radius (w1, c1), where the feet end (px, py, pz), lam, the horizontal speed lost (brace) and surge (m).
function braceFace(env, S, px, py, pz, r, ux, uy, uz, sx, sy, sz, c0, w, h1, dt, gE, pull, hD, capB, hold, T) {
  const o = S.bf, fold = T.legFold, reach = T.legReach, D2 = S.dir2;
  const su = sx * ux + sy * uy + sz * uz;
  const hx = sx - su * ux, hy = sy - su * uy, hz = sz - su * uz;
  const vh = Math.hypot(hx, hy, hz);
  o.surge = 0; o.brace = 0;
  if (!(vh > 1e-6) || !(h1 > r)) {
    // (nothing rises ahead to brace against: the whole step, as before P21)
    o.sx = hx; o.sy = hy; o.sz = hz; o.w1 = w; o.c1 = c0; o.lam = 1; o.px = px + sx * dt; o.py = py + sy * dt; o.pz = pz + sz * dt; return o;
  }
  const ex = hx / vh, ey = hy / vh, ez = hz / vh;                        // along the path
  const lx = uy * ez - uz * ey, ly = uz * ex - ux * ez, lz = ux * ey - uy * ex;   // across it
  const qx = px + sx * dt, qy = py + sy * dt, qz = pz + sz * dt, b = T.braceSide;
  const gs = (h1 - r) / (vh * dt);
  const gl = (radAt(env, D2, qx + lx * b, qy + ly * b, qz + lz * b) - radAt(env, D2, qx - lx * b, qy - ly * b, qz - lz * b)) / (2 * b);
  const n3 = Math.sqrt(1 + gs * gs + gl * gl), budget = T.legCatch * dt;
  // the speed into the face, and what the legs take of it
  const dn = Math.min(Math.max(0, (gs * vh - w) / n3), budget);
  // the push per unit of it: back along the path gs / n3, up 1 / n3, across -gl / n3. The soles hold the push across with
  // a friction along the face across the path ((l + gl u) / sqrt(1 + gl^2): it lifts too), up to hold per unit of push;
  // with a hold on the rock (pull) the limbs hold the rest, braceAccel at most, as they brake (LEGS, 2b)
  const sl = Math.sqrt(1 + gl * gl), sg = gl < 0 ? -1 : 1, pushL = dn * Math.abs(gl) / n3;
  const f = Math.min(pushL * sl, Math.max(0, hold) * dn), limb = pull > 0 ? T.braceAccel * dt : 0;
  const side = -sg * Math.max(0, pushL - f / sl - limb);                    // what is left of the push across the path
  let vq = vh - dn * gs / n3, wq = w + dn / n3 + f * Math.abs(gl) / sl;
  // how fast the hips may rise
  const a = Math.max(0.1, gE + pull);
  if (!(hD === hD)) hD = radAt(env, D2, qx + ex * T.look, qy + ey * T.look, qz + ez * T.look);
  let gmin = Math.min(h1, hD);
  const L = Math.max(0, vq) * Math.max(0, wq) / a;
  if (L > T.look) { const m = Math.min(L, T.aheadMax); gmin = Math.min(gmin, radAt(env, D2, qx + ex * m, qy + ey * m, qz + ez * m)); }
  const wOk = Math.max(capB, Math.sqrt(2 * a * Math.max(0, gmin + reach - c0)));
  if (wq > wOk && gs > 1e-6) {
    // up the face faster than that: the legs take that up too, along the face (its tangent on the path: (e + gs u) / n2)
    const n2 = Math.sqrt(1 + gs * gs), dtg = Math.min((wq - wOk) * n2 / gs, Math.sqrt(Math.max(0, budget * budget - dn * dn)));
    vq -= dtg / n2; wq -= dtg * gs / n2;
  }
  if (vq < 0) vq = 0;
  let w1 = Math.min(wq, wOk), c1 = c0 + w1 * dt;
  const top = Math.max(c0, r + reach);
  if (c1 > top) { c1 = top; w1 = (c1 - c0) / dt; }
  // the feet: up the face no further than the hips allow
  const lam = vq > 1e-9 ? clamp01((c1 + fold - r) / (gs * vq * dt)) : 1;
  o.px = px + ((ex * vq + lx * side) * lam + su * ux) * dt; o.py = py + ((ey * vq + ly * side) * lam + su * uy) * dt; o.pz = pz + ((ez * vq + lz * side) * lam + su * uz) * dt;
  o.surge = (1 - lam) * vq * dt;
  o.brace = Math.max(0, vh - vq);
  o.sx = ex * vq + lx * side; o.sy = ey * vq + ly * side; o.sz = ez * vq + lz * side; o.w1 = w1; o.c1 = c1; o.lam = lam;
  return o;
}

// ---- (P13) the gait ------------------------------------------------------------------------------------
// The stride of a walker of leg T.legLength moving at v (m/s) under gravity g (m/s^2; in a liquid, what
// buoyancy leaves): which gait, how long a step, how many a second, how long each foot is down, and how
// the hips move. `was` (the gait a moment ago) gives the change a little hysteresis. Fills and returns out:
//   gait 1 walk | 2 run (0 at rest), fr (Froude number), step (m), period (s a step), cadence (steps / s),
//   duty (share of the stride a foot is down), contact (s a foot is down), flight (s in the air a step),
//   drop (m the hips are under standing at a run's touch-down), dip (m they go on down to mid-stance; in a
//   walk: m under standing at double support), rise (m over touch-down at the top of a flight), peak (the
//   stance's largest vertical force over the weight).
export function gaitOf(v, g, T = EXPLORER_BODY, out = {}, was = 0) {
  const L = T.legLength, gE = g > 0.3 ? g : 0.3, fr = v * v / (gE * L), k = (1 - T.gaitRocker) * L;
  out.fr = fr;
  if (!(v > 1e-3)) { out.gait = 0; out.step = 0; out.period = 0; out.cadence = 0; out.duty = 1; out.contact = 0; out.flight = 0; out.drop = 0; out.dip = 0; out.rise = 0; out.peak = 1; out.A = 0; return out; }
  if (fr > T.gaitFr * (was === 2 ? 0.9 : was === 1 ? 1.1 : 1)) {
    const s = L * T.runStep * Math.pow(fr, T.runStepExp), duty = Math.min(T.runDutyMax, L * Math.sin(T.gaitSweep) / s);
    const P = s / v, tc = 2 * duty * P, tf = P - tc;
    out.gait = 2; out.step = s; out.period = P; out.cadence = 1 / P; out.duty = duty; out.contact = tc; out.flight = tf;
    out.A = 0.5 * Math.PI * gE * P / tc;                 // peak of the half sine whose impulse carries the weight over the step
    out.drop = k * (1 - Math.cos(duty * s / L));         // the leg lands slanted: the hips are that much under standing
    out.dip = gE * tc * (P / (2 * Math.PI) - tc / 8); out.rise = gE * tf * tf / 8; out.peak = out.A / gE;
  } else {
    const s = L * T.walkStep * Math.pow(fr, T.walkStepExp), duty = Math.max(0.52, T.walkDuty - T.walkDutyFr * fr), P = s / v;
    out.gait = 1; out.step = s; out.period = P; out.cadence = 1 / P; out.duty = duty; out.contact = 2 * duty * P; out.flight = 0;
    out.A = 0; out.drop = 0; out.dip = k * (1 - Math.cos(0.5 * s / L)); out.rise = 0; out.peak = 1 + fr;
  }
  return out;
}
// The hips off their standing height (m) at phase ph of a step (0 = a footfall) of the stride o (gaitOf).
// (P17) Exported, with strideBob below, for a figure drawn without the body (PAINTER's gallery asked: no copy of the formula).
export function bobAt(ph, o, gE, T = EXPLORER_BODY) {
  if (o.gait === 2) {
    const tc = o.contact, t = ph * o.period;
    if (t < tc) { const a = Math.PI / tc; return -o.drop - 0.5 * gE * o.flight * t + o.A * (t - Math.sin(a * t) / a) / a - 0.5 * gE * t * t; }
    const u = t - tc; return -o.drop + 0.5 * gE * (o.flight - u) * u;
  }
  if (o.gait === 1) {
    // the arc over the leading foot; while both feet are down the weight passes from the arc over the trailing one
    const L = T.legLength, k = (1 - T.gaitRocker) * L, ds = 2 * o.duty - 1, s = o.step;
    const yl = -k * (1 - Math.cos((ph - 0.5 * (1 + ds)) * s / L));
    if (ph >= ds) return yl;
    const yt = -k * (1 - Math.cos((ph + 0.5 * (1 - ds)) * s / L)), w = ph / ds;
    return yt + (yl - yt) * w * w * (3 - 2 * w);
  }
  return 0;
}
// (P17) The hips off their standing height (m) at `stride` (0..1: the left foot lands at 0, the right at 0.5) of a steady
// stride at v m/s over the ground under gravity g (in a liquid, what buoyancy leaves), as stepGait lays them (stepGait
// also eases the stride in and out and smooths a change of gait; a steady stride has neither). o: a gaitOf result for
// this v and g to reuse (optional).
const _gtB = {};
export function strideBob(v, g, stride, T = EXPLORER_BODY, o = null) {
  const s = stride - Math.floor(stride), ph = (s * 2) % 1;
  return bobAt(ph, o || gaitOf(Math.max(v, 0.12), g, T, _gtB), g, T);
}
// The forward speed within the step less its mean (m/s).
function pulseAt(ph, o, gE, v, dy, T) {
  if (o.gait === 2) {
    // the leg's force lies along the leg: it brakes while the foot is ahead of the hips and drives when it is behind
    const tc = o.contact, t = ph * o.period, k = o.A * v / T.legLength, mean = -k * 0.03014 * tc * tc * tc / o.period;
    if (t >= tc) return -mean;
    const a = Math.PI / tc, ca = Math.cos(a * t);
    return -k * (0.5 * tc * (1 - ca) / a + t * ca / a - Math.sin(a * t) / (a * a)) - mean;
  }
  if (o.gait === 1) return v > 0.2 ? clamp(-T.recovery * gE * dy / v, -0.3 * v, 0.3 * v) : 0;
  return 0;
}
const mkFall = () => ({ n: 0, foot: 0, p: { x: 0, y: 0, z: 0 }, force: 0, speed: 0 });
function footfall(B, foot, x, y, z, force, speed) {
  const f = B.footfalls[++B.steps & 3];
  f.n = B.steps; f.foot = foot; f.p.x = x; f.p.y = y; f.p.z = z; f.force = force; f.speed = speed; B.footfall = f;
}
// One step of the stride: called at the end of every body step, after st.p and st.v are set. It reads the
// body and writes only the gait's own numbers: the body's path and pace are not touched by it. S: the step's scratch.
function stepGait(B, st, dt, grounded, gE, env, T, S) {
  if (!B.feet) {
    B.feet = [{ fwd: 0, up: 0, side: -0.5 * T.stepWidth, down: 1 }, { fwd: 0, up: 0, side: 0.5 * T.stepWidth, down: 1 }];
    B.heading = { x: 0, y: 0, z: 0 }; B.footfalls = [mkFall(), mkFall(), mkFall(), mkFall()]; B.footfall = null;
    if (!(B.stride >= 0)) { B.stride = 0.25; B.steps = 0; B.gaitAmp = 0; B.gaitK = 1; B.gaitV = 0; B.bobFix = 0; B.bobMean = 0; B.bob = 0; B.surge = 0; }
  }
  const px = st.p.x, py = st.p.y, pz = st.p.z, r = Math.hypot(px, py, pz) || 1, ux = px / r, uy = py / r, uz = pz / r;
  const v = B.speedGround, H = B.heading;
  if (v > 0.1) { const vv = st.v.x * ux + st.v.y * uy + st.v.z * uz; H.x = (st.v.x - vv * ux) / v; H.y = (st.v.y - vv * uy) / v; H.z = (st.v.z - vv * uz) / v; }
  const stepping = grounded && B.slip01 < 0.5 && B.submerged01 < 0.7;
  if (grounded && B.impact > 0) {
    // a landing is a footfall of both feet, where the body came down
    footfall(B, 2, px, py, pz, T.mass * (gE + Math.min(T.legCatch, B.impact * B.impact / (2 * T.legFold))), B.impact);
  }
  if (stepping) B.gaitV = v;
  const o = gaitOf(Math.max(B.gaitV, 0.12), gE, T, S.gt, B.gaitK);
  // how much of the stride there is: none at rest, in the air or sliding; less while the legs are folded on a clamber
  const ampT = stepping ? smoothstep(0.1, 0.5, v) * (1 - smoothstep(0.3, 0.9, B.clamber01)) : 0;
  B.gaitAmp += (ampT - B.gaitAmp) * (1 - Math.exp(-dt / 0.08));
  if (B.gaitAmp < 1e-4 && ampT === 0) B.gaitAmp = 0;
  const amp = B.gaitAmp;
  let fell = -1;
  if (stepping && v > 0.05) {
    const s0 = B.stride, s1 = s0 + v * dt / (2 * o.step);
    if (s1 >= 1) { B.stride = s1 - Math.floor(s1); fell = 0; } else { B.stride = s1; if (s0 < 0.5 && s1 >= 0.5) fell = 1; }
  }
  const ph = (B.stride * 2) % 1, raw = bobAt(ph, o, gE, T);
  B.bobFix *= Math.exp(-dt / 0.15); if (B.bobFix < 1e-5 && B.bobFix > -1e-5) B.bobFix = 0;
  if (o.gait !== B.gaitK) { B.bobFix = B.bob - raw * amp; B.gaitK = o.gait; }     // a change of gait does not jerk the hips
  const bob = raw * amp + B.bobFix;
  B.bobV = (bob - B.bob) / dt; B.bob = bob;
  B.bobMean += (raw - B.bobMean) * (1 - Math.exp(-dt / Math.max(0.25, o.period)));
  B.pulse = pulseAt(ph, o, gE, B.gaitV, raw - B.bobMean, T) * amp;
  B.surge = (B.surge + B.pulse * dt) * Math.exp(-dt);
  // ((P23) down low in a gale (hunker01) the legs are folded at least that far: a crouch, then on hands and knees)
  B.ride = Math.min(B.hip, -T.legFold * (B.hunker01 || 0)) + bob;
  B.gait = amp > 0.02 ? o.gait : 0; B.stepPhase = ph; B.cadence = stepping && v > 0.05 ? v / o.step : 0; B.stepLength = o.step; B.duty = o.duty;
  // the feet: down for `duty` of the stride, carried back under the hips; then swung forward to the next footfall
  const X = o.duty * o.step * amp, lift = (o.gait === 2 ? 0.12 + 0.1 * Math.min(1, B.gaitV / 7) : 0.07) * amp;
  let down = 0;
  for (let i = 0; i < 2; i++) {
    const F = B.feet[i]; let p = B.stride - 0.5 * i; if (p < 0) p += 1;
    if (p < o.duty || amp < 0.02) { F.fwd = X * (1 - 2 * Math.min(1, p / o.duty)); F.up = 0; F.down = grounded ? 1 : 0; if (grounded) down |= 1 << i; }
    else { const u = (p - o.duty) / (1 - o.duty); F.fwd = X * (2 * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)) - 1); F.up = lift * Math.sin(Math.PI * Math.sqrt(u)); F.down = 0; }
  }
  B.footDown = down; B.flight = grounded && down === 0 ? 1 : 0;
  B.load = !grounded ? 0 : o.gait === 2 && amp > 0.02 ? (ph * o.period < o.contact ? 1 - amp + amp * o.peak * Math.sin(Math.PI * ph * o.period / o.contact) : 1 - amp) : 1;
  if (fell >= 0 && amp > 0.02) {
    // where the foot comes down: ahead of the body by half the stance's travel, to its own side, on the ground there
    const sd = (fell ? 0.5 : -0.5) * T.stepWidth, rx = H.y * uz - H.z * uy, ry = H.z * ux - H.x * uz, rz = H.x * uy - H.y * ux;
    const x = px + H.x * X + rx * sd, y = py + H.y * X + ry * sd, z = pz + H.z * X + rz * sd, l = Math.hypot(x, y, z) || 1, D2 = S.dir2;
    D2.x = x / l; D2.y = y / l; D2.z = z / l;
    const gr = env.sample(D2).radius;
    footfall(B, fell, D2.x * gr, D2.y * gr, D2.z * gr, T.mass * gE * (1 - amp + amp * o.peak), o.gait === 2 ? 0.5 * gE * o.flight : 0.25 * v);
  }
}

// One step of the body.
//   st:  { p:{x,y,z}, v:{x,y,z}, grounded:bool, phys? }  (PILOT's explorer state; st.phys is
//        created on first use and holds EXPLORER_BODY_STATE)
//   cmd: { wish:{x,y,z}   wished velocity, horizontal, m/s (PILOT: wish direction x speed)
//          jump: bool     push off this step
//          jet: 0..1      jetpack throttle
//          jetMaxRise:    m/s, optional governor on the climb speed
//          descentLimit:  m/s, optional automatic descent brake (the soft-landing assist)
//          airControl:    0..1, default 1
//          assistAccel:   m/s^2, optional: extra authority from the suit's thrusters for starting
//                         and stopping on the ground, NOT limited by traction (an assist: 0 is
//                         pure legs; 3 makes a 4 m/s stop take 0.35 s instead of 0.5) }
//   env: { sample(unitDir) -> contract surface,  gravity (m/s^2),
//          air(p, out) -> { density, wind }          optional (default: still Earth air)
//          ground(surface, out) -> contact props     optional (default: firm soil)
//          liquid: { density, viscosity }            optional (default: water)
//          liquidOf(surface) -> { density, viscosity }   optional: the liquid at a place (lava, cloud froth) }
// Returns st. Sets st.grounded, st.p, st.v and st.phys.*; never allocates after the first call.
export function stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY) {
  return stepBody(st, cmd, dt, env, T, _walkS);
}
// (P19) S: the scratch this run of steps writes (the walker's, or the ghost's: see stepScratch)
function stepBody(st, cmd, dt, env, T, S) {
  // On the ground a step is never longer than the legs resolve (legStep): at a low frame rate a run would
  // otherwise cross the flank of a boulder in two samples. At 60 Hz a run is one step, as before.
  if (st.grounded && dt > 0 && st.v) {
    let n = Math.ceil(Math.hypot(st.v.x, st.v.y, st.v.z) * dt / T.legStep);
    if (n > 1) {
      if (!(n <= 4)) n = 4;
      const jump = cmd.jump, h = dt / n;
      let brace = 0;
      for (let i = 0; i < n; i++) { stepOnce(st, cmd, h, env, T, S); brace += st.phys.brace; if (i === 0 && jump) cmd.jump = false; }
      cmd.jump = jump; st.phys.brace = brace;
      return st;
    }
  }
  return stepOnce(st, cmd, dt, env, T, S);
}
function stepOnce(st, cmd, dt, env, T, S) {
  const B = st.phys || (st.phys = EXPLORER_BODY_STATE());
  if (!(dt > 0)) return st;
  let px = st.p.x, py = st.p.y, pz = st.p.z;
  let vx = st.v.x, vy = st.v.y, vz = st.v.z;
  if (!(px === px && py === py && pz === pz)) { px = 0; py = 1; pz = 0; }
  if (!(vx === vx && vy === vy && vz === vz)) { vx = vy = vz = 0; }
  const r = Math.hypot(px, py, pz) || 1;
  const ux = px / r, uy = py / r, uz = pz / r;
  const D = S.dir;
  D.x = ux; D.y = uy; D.z = uz;
  const s0 = env.sample(D);
  const g = env.gravity;
  const groundR = s0.radius;
  let liquidR = (s0.liquidRadius || 0) > groundR ? s0.liquidRadius : 0;
  // (P20) the surface the body floats and wades in is the drawn sea's (env.waterLevel, from bindEnv: the waves over the
  // still level here, as the water shader displaces them), not the still level: until P20 the waves passed through it
  // and the water there rises and falls with that surface (S.wr[0], m/s): the body's drag in it is measured against that
  let wRate = 0;
  if (liquidR && env.waterLevel) { const w = env.waterLevel(st.p, liquidR - groundR, S.wr); if (w === w) liquidR = Math.max(groundR, liquidR + w); wRate = S.wr[0] === S.wr[0] ? S.wr[0] : 0; }
  let nx = s0.normal.x, ny = s0.normal.y, nz = s0.normal.z;
  { const l = Math.hypot(nx, ny, nz); if (l > 1e-9) { nx /= l; ny /= l; nz /= l; } else { nx = ux; ny = uy; nz = uz; } }
  let nu = nx * ux + ny * uy + nz * uz;
  if (nu < 0.05) { nx = ux; ny = uy; nz = uz; nu = 1; }

  // ---- surroundings ------------------------------------------------------------------------
  let rho = 1.225, wx = 0, wy = 0, wz = 0;
  if (env.air) { const rc = S.recv; rc.vx = st.v.x; rc.vy = st.v.y; rc.vz = st.v.z; const a = env.air(st.p, S.air, Math.max(0, r - groundR) + (st.grounded ? 1.0 + (T.hunkerHeight - 1.0) * (B.hunker01 || 0) : 1.0), rc); rho = a.density; wx = a.wind.x; wy = a.wind.y; wz = a.wind.z; }
  // A named assist (PILOT's lever; default 0 = the real wind): cmd.shelter01, 0..1, is the share of the
  // wind's FORCE on the body that the suit cancels. The force goes with the square of the wind, so the
  // body is given wind x sqrt(1 - shelter01); its own drag through still air is untouched.
  if (cmd.shelter01 > 0) { const k = Math.sqrt(1 - clamp01(cmd.shelter01)); wx *= k; wy *= k; wz *= k; }
  // the ground the step is taken on: (P19) where the last step ended, as the report there asked it, while the body is
  // still exactly there (so one env.ground call a step, as before: the report asks the ground where the step ends)
  const G = !env.ground ? DEFAULT_GROUND
    : S.gEnv === env && px === S.gx && py === S.gy && pz === S.gz ? S.G : (S.gEnv = null, S.G = env.ground(s0, S.gnd));
  const liq = env.liquidOf ? env.liquidOf(s0) : env.liquid || DEFAULT_LIQUID;
  // viscous (Stokes) drag: nothing in water, everything in lava. 3 pi mu L v on a body of length L.
  const visc = 3 * Math.PI * (liq.viscosity || 0) / T.mass;
  const depth = liquidR ? Math.max(0, liquidR - r) : 0;
  const sub = clamp01(depth / T.height);
  let rhoBody = T.bodyDensity;
  if (T.floatAssist) {
    const trim = smoothstep(T.floatDepth * T.floatTrimStart, T.floatDepth, depth);
    const floatRho = liq.density * T.floatDepth / T.height;
    rhoBody = floatRho < rhoBody ? rhoBody + (floatRho - rhoBody) * trim : (depth > 0 ? floatRho : rhoBody);
  }
  const buoy = sub * liq.density / rhoBody;            // buoyant force as a fraction of weight
  B.submerged01 = sub;

  // wished velocity, made horizontal
  let qx = 0, qy = 0, qz = 0;
  if (cmd.wish) {
    qx = cmd.wish.x || 0; qy = cmd.wish.y || 0; qz = cmd.wish.z || 0;
    const d = qx * ux + qy * uy + qz * uz;
    qx -= d * ux; qy -= d * uy; qz -= d * uz;
  }
  const qlen = Math.hypot(qx, qy, qz);

  // jetpack throttle with spool
  const jetCmd = clamp01(cmd.jet || 0);
  B.jetThrottle += (jetCmd - B.jetThrottle) * (1 - Math.exp(-dt / T.jetSpool));
  if (B.jetThrottle < 1e-4 && jetCmd === 0) B.jetThrottle = 0;
  let aJet = T.jetThrust / T.mass * B.jetThrottle;      // m/s^2 available

  let grounded = !!st.grounded;
  B.impact = 0;
  // floating: buoyancy carries the whole weight, the feet leave the bottom
  if (grounded && buoy >= 1) grounded = false;
  // jump. (P13) On the ground the legs fold first (see jumpCrouch): the push comes when the crouch is over.
  let jumpNow = false;
  if (cmd.jump && (grounded || sub > 0.3) && !(B.jumpT > 0)) {
    const tcr = cmd.jumpCrouch != null ? cmd.jumpCrouch : T.jumpCrouch;
    if (grounded && tcr > 0) { B.jumpT = tcr; B.jumpT0 = tcr; } else jumpNow = true;
  }
  if (B.jumpT > 0) {
    if (!grounded) B.jumpT = 0;                          // the ground has gone from under the crouch: nothing to push on
    else if ((B.jumpT -= dt) <= 0.5 * dt) { B.jumpT = 0; jumpNow = true; }
  }
  B.crouch01 = B.jumpT > 0 ? 1 - B.jumpT / B.jumpT0 : 0;
  if (jumpNow) {
    const vj = jumpSpeedFor(g, T) * (grounded ? 1 : 0.5);
    const vv = vx * ux + vy * uy + vz * uz;
    const add = Math.max(0, vj - Math.max(0, vv));
    vx += ux * add; vy += uy * add; vz += uz * add;
    grounded = false;
  }
  // a jet stronger than the weight lifts the feet off
  if (grounded && aJet > g * (1 - buoy) + 0.3) grounded = false;

  const hk = B.hunker01 || 0;
  const airK = 0.5 * rho * (grounded ? T.cdaUpright + (T.cdaLow - T.cdaUpright) * hk : T.cdaFall) / T.mass * (1 - sub);   // 1/m
  const onGround = grounded;
  let sF = null, GF = null;                              // (P19) the surface where the step ends in contact, and its ground (see the report)

  if (onGround) {
    // ================= on the ground: dynamics in the plane of the terrain ===================
    // LEGS, 1: what carries the body. On open ground the facet under the boots does (exactly as
    // before). Clambering, with a hold on a feature (B.grip), the feet stand on holds and the body
    // is carried on its limbs, not on the facet: gravity acts along the path of the hips, and the
    // tilt of the rock under the boot does not count.
    // (P26) ... but not on a WALL (see EXPLORER_BODY.scrambleSlope): a facet steeper than the limbs scramble from which the
    // ground goes on up its fall line more than a clamber within two looks is no step and gives no hold: a body set
    // down on one (a landing, a slide) is carried by the facet, where gravity pulls it back
    const steep = nu < 0.995 ? Math.sqrt(1 - nu * nu) / nu : 0;
    const onWall = steep > scrambleHold(G, g, T) && risesOn(env, S.dir2, px, py, pz, r, nu * ux - nx, nu * uy - ny, nu * uz - nz, T);
    if (onWall) B.grip = 0;
    let q = B.grip ? 0 : 1;
    // A face too steep to hold by friction, but low (the ground one look ahead is within a
    // clamber of the feet), is a step: the walker goes up it on its legs and hands.
    if (q > 0 && !onWall && qlen > 1e-6 && steep > G.friction + G.foothold && qx * nx + qy * ny + qz * nz < 0) {
      const hS = groundAhead(env, S.dir2, px, py, pz, qx, qy, qz, T.look);
      if (hS - r <= T.clamber) q = 0;
    }
    if (q < 1) {
      nx = ux + (nx - ux) * q; ny = uy + (ny - uy) * q; nz = uz + (nz - uz) * q;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      nu = nx * ux + ny * uy + nz * uz;
    }
    const support = g * nu * (1 - buoy);               // normal acceleration the ground supplies
    // velocity along the surface
    let d = vx * nx + vy * ny + vz * nz;
    let sx = vx - d * nx, sy = vy - d * ny, sz = vz - d * nz;
    // (P22) ... losing only the speed the BODY has into it (see LEGS, 3, where the velocity is laid along the ground): the
    // mass rides at the hips, and hips already rising with the new slope carry it along it
    if (d < -1e-6 && B.hipV > 0) {
      const vu = vx * ux + vy * uy + vz * uz, dc = Math.min(0, d + (B.hipV - vu) * nu), s2 = vx * vx + vy * vy + vz * vz - dc * dc, s0 = Math.hypot(sx, sy, sz);
      if (dc > d && s0 > 1e-9 && s2 > s0 * s0) { const m = Math.sqrt(s2) / s0; sx *= m; sy *= m; sz *= m; }
    }
    const sp = Math.hypot(sx, sy, sz);
    // gravity along the slope (downhill), less buoyancy
    const gk = -g * (1 - buoy);
    let ex = gk * (ux - nu * nx), ey = gk * (uy - nu * ny), ez = gk * (uz - nu * nz);
    // wind load: drag on the velocity relative to the wind, its part along the surface
    let rx = sx - wx, ry = sy - wy, rz = sz - wz;
    const rl = Math.hypot(rx, ry, rz);
    let ax = -airK * rl * rx, ay = -airK * rl * ry, az = -airK * rl * rz;
    d = ax * nx + ay * ny + az * nz; ax -= d * nx; ay -= d * ny; az -= d * nz;
    B.windAccel = Math.hypot(ax, ay, az);
    B.lean = Math.atan2(B.windAccel, g > 1e-6 ? g : 1e-6);
    // (P23) THE GALE (see EXPLORER_BODY.cdaLow): the wind's own push on the body upright (its speed, not the run's: running
    // through Venus' still air is no gale), over g: the walker gets low over hunkerFrom; and where it is over braceFrom, the
    // suit braces against what is beyond braceShare of the soles' hold here (hands and knees adding to it down low, the
    // slope's pull counted), braceForce at most
    {
      const wn = wx * nx + wy * ny + wz * nz, w2 = Math.max(0, wx * wx + wy * wy + wz * wz - wn * wn), gw = 0.5 * rho * T.cdaUpright / T.mass * (1 - sub) * w2 / Math.max(0.1, g);
      const want = smoothstep(T.hunkerFrom, T.hunkerFull, gw);
      B.hunker01 = hk + (want - hk) * (1 - Math.exp(-dt / (want > hk ? T.hunkerDown : T.hunkerUp)));
      B.windBrace = 0;
      if (T.windBrace && cmd.windBrace !== false && gw > T.braceFrom && B.windAccel > 1e-6) {
        const hold0 = G.friction + G.foothold * (1 - smoothstep(T.runFoothold * 0.4, T.runFoothold, sp)) + T.hunkerGrip * hk, fm = Math.max(1e-6, hold0 * support);
        const lim = T.braceShare * fm, a2 = B.windAccel * B.windAccel, gl2 = ex * ex + ey * ey + ez * ez, ga = ex * ax + ey * ay + ez * az;
        if (gl2 + 2 * ga + a2 > lim * lim) {
          // the wind's share s kept: |g + s a| = lim (the larger root; none of it when the slope alone takes that much)
          const disc = ga * ga - a2 * (gl2 - lim * lim);
          let s = disc > 0 ? (-ga + Math.sqrt(disc)) / a2 : 0;
          s = clamp01(s);
          s = Math.max(s, 1 - T.braceForce / T.mass / B.windAccel);
          if (s < 1) { B.windBrace = (1 - s) * B.windAccel * T.mass; ax *= s; ay *= s; az *= s; }
        }
      }
    }
    ex += ax; ey += ay; ez += az;
    // soft ground: the work of pressing a footprint at every step opposes the motion
    if (sp > 1e-6) {
      const res = G.drag * support * Math.tanh(sp / 0.5) / sp;
      ex -= sx * res; ey -= sy * res; ez -= sz * res;
    }
    // wading: liquid drag on the submerged legs and trunk (implicit below), as a rate
    const liqK = depth > 0 ? 0.5 * liq.density * T.wadeWidth * Math.min(depth, T.height) / T.mass : 0;

    // target velocity along the surface: same heading as the wish, same speed
    let tx = 0, ty = 0, tz = 0;
    if (qlen > 1e-6) {
      const k = (qx * nx + qy * ny + qz * nz) / nu;
      tx = qx - ux * k; ty = qy - uy * k; tz = qz - uz * k;
      const tl = Math.hypot(tx, ty, tz);
      // LEGS, 2: clambering, the walker holds the pace at which its feet can follow the ground ahead
      // ((P23) down low in a gale, a crawl: hunkerPace right down)
      const qh = hk > 0 && qlen > T.hunkerPace ? qlen + (T.hunkerPace - qlen) * hk : qlen;
      if (tl > 1e-9) { const m = Math.min(qh, B.paceCap, B.paceAhead >= 0 ? B.paceAhead : 1e9, B.paceCrest >= 0 ? B.paceCrest : 1e9, B.paceWall >= 0 ? B.paceWall : 1e9) / tl; tx *= m; ty *= m; tz *= m; }
    }
    // what the legs would like to do: close the velocity error and cancel the outside loads
    let fx = (tx - sx) / T.response - ex, fy = (ty - sy) / T.response - ey, fz = (tz - sz) / T.response - ez;
    // ... limited by leg strength when pushing (braking uses the legs as struts)
    let fl = Math.hypot(fx, fy, fz);
    const along = sp > 0.05 ? (fx * sx + fy * sy + fz * sz) / sp : fl;       // + = propulsive
    if (along > 0 && fl > T.legAccel) { const m = T.legAccel / fl; fx *= m; fy *= m; fz *= m; fl = T.legAccel; }
    // ... by leg power: the propulsive part times the speed cannot exceed legPower / mass
    if (sp > 0.3) {
      const al = (fx * sx + fy * sy + fz * sz) / sp;
      // (the legs' power also lifts the hips when they rise faster than the ground carries them)
      const lift = Math.max(0, B.hipV - (sx * ux + sy * uy + sz * uz));
      const pmax = Math.max(0.2 * T.legPower / T.mass, T.legPower / T.mass - g * (1 - buoy) * lift) / sp;
      if (al > pmax) { const cut = (al - pmax) / sp; fx -= sx * cut; fy -= sy * cut; fz -= sz * cut; fl = Math.hypot(fx, fy, fz); }
    }
    // ... and by the friction circle. A walker does not spin their feet: they push only as hard
    // as the ground will hold (traction control), so the force is the holding force (-outside
    // loads) plus as much of the wanted change as fits inside mu N. Only when the holding force
    // alone exceeds mu N does the body really slide, on kinetic friction.
    const hold = G.friction + G.foothold * (1 - smoothstep(T.runFoothold * 0.4, T.runFoothold, sp)) + T.hunkerGrip * hk;   // ((P23) down low, hands and knees too)
    const fmax = Math.max(0, hold * support);
    const hl = Math.hypot(ex, ey, ez);
    if (hl > fmax) {
      // cannot even hold: sliding. Friction is kinetic, or better when the body digs in
      const fk = Math.max(0, Math.max(G.kinetic, T.arrest * hold) * support);
      let kx, ky, kz;
      if (sp > 0.05) { kx = -sx / sp; ky = -sy / sp; kz = -sz / sp; } else { kx = -ex / hl; ky = -ey / hl; kz = -ez / hl; }
      // the legs still steer a little within the kinetic circle
      fx = kx * fk; fy = ky * fk; fz = kz * fk;
      B.slip01 = clamp01(1 - fmax / hl);
      B.scramble01 = 1;
    } else {
      B.slip01 = 0;
      if (fl > fmax) {
        const dx = fx + ex, dy = fy + ey, dz = fz + ez;           // wanted change beyond holding
        const a = dx * dx + dy * dy + dz * dz, b = -(ex * dx + ey * dy + ez * dz), c = hl * hl - fmax * fmax;
        const lam = a > 1e-12 ? clamp01((-b + Math.sqrt(Math.max(0, b * b - a * c))) / a) : 0;
        fx = -ex + dx * lam; fy = -ey + dy * lam; fz = -ez + dz * lam;
        B.scramble01 = clamp01(1 - fmax / fl);
      } else B.scramble01 = 0;
    }
    // the suit's thrusters, if PILOT asks for them: close what is left of the velocity error
    let zx = 0, zy = 0, zz = 0;
    if (cmd.assistAccel > 0) {
      zx = (tx - sx) / T.response - (ex + fx); zy = (ty - sy) / T.response - (ey + fy); zz = (tz - sz) / T.response - (ez + fz);
      const zl = Math.hypot(zx, zy, zz);
      if (zl > cmd.assistAccel) { const m = cmd.assistAccel / zl; zx *= m; zy *= m; zz *= m; }
      // (P26) ... but they do not push the body up a WALL (see EXPLORER_BODY.scrambleSlope): on one their push has no part
      // up its fall line (the lift is the jetpack's, with its fuel): the body slides back as gravity and friction have it
      if (onWall) {
        const ax = ux - nu * nx, ay = uy - nu * ny, az = uz - nu * nz, a2 = ax * ax + ay * ay + az * az;
        const zu = a2 > 1e-18 ? (zx * ax + zy * ay + zz * az) / a2 : 0;
        if (zu > 0) { zx -= ax * zu; zy -= ay * zu; zz -= az * zu; }
      }
    }
    // integrate along the surface
    sx += (ex + fx + zx) * dt; sy += (ey + fy + zy) * dt; sz += (ez + fz + zz) * dt;
    if (liqK > 0) { const m = 1 / (1 + (liqK * Math.hypot(sx, sy, sz) + visc * Math.min(depth, T.height)) * dt); sx *= m; sy *= m; sz *= m; }
    // LEGS, 2b: with a hold on the rock the limbs brace the body back to that pace (braceAccel), whatever the soles grip
    // ((P26) and to the pace held for a wall seen ahead: a scramble up to the foot of a wall ends there, on its holds;
    // it is not carried onto the wall by the pace the hold gave it)
    if (B.grip && (B.paceCap < 1e8 || B.paceWall < 1e8)) {
      const sn = Math.hypot(sx, sy, sz), cap = B.paceWall >= 0 && B.paceWall < B.paceCap ? B.paceWall : B.paceCap;
      if (sn > cap) { const m = Math.max(cap, sn - T.braceAccel * dt) / sn; sx *= m; sy *= m; sz *= m; }
    }
    // snap to rest: never creep
    if (qlen < 1e-6 && B.slip01 === 0 && Math.hypot(sx, sy, sz) < 0.02) { sx = sy = sz = 0; }

    // ---- LEGS, 3: the feet follow the ground, the hips ride above them --------------------------
    // c is the radius of the hips less one leg (c = the ground when standing), B.hip = c - ground,
    // B.hipV the hips' vertical speed. The legs level the hips over the ground (critically damped,
    // legTime) but can only push: the hips fall no faster than gravity, are raised no harder than
    // legLift and caught no harder than legCatch. Between the fold and the reach of the legs the
    // ground may do what it likes under the feet; at the end of the stroke the ground acts:
    //   folded out (the ground rises faster than the hips can be raised): the body is braced
    //     against the face and goes on at the pace its hips can be lifted, never faster than
    //     gravity (and a hold) can stop them again within the stroke;
    //   reached out (the ground falls away faster than the hips fall): with a hold (a convex
    //     feature, holdAhead) the limbs pull the hips down, gripAccel at most, and brace; with
    //     none, or a drop beyond a clamber, the feet leave the ground: a fall, or a bound in low
    //     gravity, with the hips' own velocity.
    const fold = T.legFold, reach = T.legReach;
    const hip0 = B.hip, c0 = r + hip0;
    let su = sx * ux + sy * uy + sz * uz;
    let vh = Math.sqrt(Math.max(0, sx * sx + sy * sy + sz * sz - su * su));
    let p1x = px + sx * dt, p1y = py + sy * dt, p1z = pz + sz * dt;
    let r1 = Math.hypot(p1x, p1y, p1z) || 1;
    D.x = p1x / r1; D.y = p1y / r1; D.z = p1z / r1;
    let s1 = env.sample(D);
    let h1 = s1.radius, n1x = s1.normal.x, n1y = s1.normal.y, n1z = s1.normal.z;
    let dh = h1 - r;
    // (P26) A WALL (see EXPLORER_BODY.scrambleSlope): where the step would end, going up, on a facet steeper than the limbs
    // scramble (by the ground there) from which the ground goes on up along the path more than a clamber within two looks.
    // The wall takes the velocity into it, along its normal (the mass rides at the hips: its velocity is the level part
    // of s and the hips' own rise w). If what is left along it would lift the body no more than the legs reach, the feet
    // do not go onto it: the legs take the rest of the level speed into it and the step is taken along its foot with the
    // speed along it (if that ends on it too, the walker stands). Otherwise the body rides up it on its momentum: feet
    // and hips together along it, carried by its facet from here on (no hold, no step).
    B.wall = 0;
    let wallTook = 0, w = B.hipV;
    for (let pass = 0; pass < 2 && dh > 1e-6 && vh > 1e-6; pass++) {
      const l1 = Math.hypot(n1x, n1y, n1z), c1n = l1 > 1e-9 ? (n1x * D.x + n1y * D.y + n1z * D.z) / l1 : 1;
      const t1 = c1n > 0.05 ? Math.sqrt(Math.max(0, 1 - c1n * c1n)) / c1n : 1e9;
      if (!(t1 > 0.75 * scrambleHold(G, g, T))) break;
      const Gw = env.ground ? env.ground(s1, S.gw) : DEFAULT_GROUND;
      if (!(t1 > scrambleHold(Gw, g, T))) break;
      const hx0 = sx - su * ux, hy0 = sy - su * uy, hz0 = sz - su * uz;       // (the level part of s: vh)
      if (!risesOn(env, S.dir2, p1x, p1y, p1z, h1, hx0, hy0, hz0, T)) break;
      // (the level part of its normal, out of the wall; cu: its upward part)
      const cu = (n1x * ux + n1y * uy + n1z * uz) / l1;
      const ox = n1x / l1 - cu * ux, oy = n1y / l1 - cu * uy, oz = n1z / l1 - cu * uz, ol = Math.hypot(ox, oy, oz);
      // (the body's rise: the hips' own, coming to the wall; on it already, the feet's along it, which gravity is slowing:
      // the hips go with them)
      const wb = onWall ? su : w;
      const vn = hx0 * ox + hy0 * oy + hz0 * oz + wb * cu;                 // (the body's velocity along the wall's normal: negative into it)
      const wUp = vn < 0 ? wb - vn * cu : wb;                               // (its rise once the wall has taken that)
      let lx, ly, lz, sv;                                                   // (the level velocity and the rise that are left)
      const ride = pass === 0 && ol > 1e-9 && wUp > 0 && wUp * wUp > 2 * Math.max(0.05, g * (1 - buoy)) * T.legReach;
      if (ride) {
        // momentum: up the wall with what is left
        const k = vn < 0 ? vn : 0;
        lx = hx0 - k * ox; ly = hy0 - k * oy; lz = hz0 - k * oz; sv = wUp; w = wUp;
        B.wall = 2; B.grip = 0; q = 1;
      } else {
        // the feet stay off it: the level speed into it goes, the speed along its foot stays (the first time round)
        const into = ol > 1e-9 ? -(hx0 * ox + hy0 * oy + hz0 * oz) / ol : vh;
        if (pass === 0 && into > 0 && into < vh * 0.9999) { const m = into / ol; lx = hx0 + ox * m; ly = hy0 + oy * m; lz = hz0 + oz * m; }
        else { lx = 0; ly = 0; lz = 0; }
        // (and of the rise the feet had along their path, the share of the path that is left)
        sv = su * Math.max(0, lx * hx0 + ly * hy0 + lz * hz0) / (vh * vh);
        B.wall = 1;
      }
      sx = lx + sv * ux; sy = ly + sv * uy; sz = lz + sv * uz; su = sv;
      { const v0 = vh; vh = Math.hypot(lx, ly, lz); wallTook += Math.max(0, v0 - vh); }
      p1x = px + sx * dt; p1y = py + sy * dt; p1z = pz + sz * dt;
      r1 = Math.hypot(p1x, p1y, p1z) || 1;
      D.x = p1x / r1; D.y = p1y / r1; D.z = p1z / r1;
      s1 = env.sample(D);
      h1 = s1.radius; n1x = s1.normal.x; n1y = s1.normal.y; n1z = s1.normal.z;
      dh = h1 - r;
      if (ride) break;
    }
    // (the hips' weight in this radial frame: gravity less buoyancy less v^2/r, the round world falling away)
    const gE = g * (1 - buoy) - vh * vh / r;
    const gr = dh / dt;                                  // m/s the ground rises under the feet
    // the walker looks ahead while its legs are working (and for half a second after)
    const working = !(B.jumpT > 0) && (hip0 < -0.06 || hip0 > 0.1);   // (a crouch before a jump is not a clamber)
    let looked = false, feat = false, hD = NaN;
    if ((working || B.clamberT > 0) && vh > 0.2) {
      hD = groundAhead(env, S.dir2, p1x, p1y, p1z, sx, sy, sz, T.look); looked = true;
      // (what stands out of the ground the legs last stood on, B.base, is a feature too: a hold underfoot)
      feat = !onWall && B.wall !== 2 && (holdAhead(c0, w, vh, r, hD, T) || (h1 - B.base > 0.1 && r - hD <= T.clamber));   // ((P26) a wall gives no hold)
      // a hold once taken is kept until the legs are back at their standing length on plain ground
      if (feat) B.grip = 1; else if (B.grip && r - hD <= T.clamber) feat = true;
    } else if (B.grip) feat = true;                      // (standing still on it, the hold is kept)
    B.clamberT = working ? 0.5 : Math.max(0, B.clamberT - dt);
    if (!working && B.clamberT <= 0) B.grip = 0;
    const pull = feat ? T.gripAccel : 0;
    const trend = Math.max(0, B.trend);
    // (a feature the legs are working on is not a hill; (P22) nor ground they are folding or stretching over fast, the hips
    // passing through standing on their way from a rock's run-up, where they were raised in time, to its face: read in
    // those steps as a hill's rise, the face was the slope the body then left the far side at, +0.6 m/s on the Moon)
    if (!working) {
      if (!(Math.abs(w - gr) > T.trendSlip)) B.trend += (clamp(gr, -20, 20) - B.trend) * (1 - Math.exp(-dt / T.trendTime));
      B.base = r; B.baseLo = r;
    }
    else {
      B.base += B.trend * dt;
      // (P21) ... but never below the lowest ground the feet have stood on since: carried down at the rate of a descent
      // the legs were working on, it went on sinking after the feet had reached the floor (a metre under it between two
      // close boulders on the Moon), and the hips, held within the reach over it, could not be raised for the next one
      if (r < B.baseLo) B.baseLo = r;
      if (B.base < B.baseLo) B.base = B.baseLo;
    }
    // level the hips over the ground; about to climb down, stay low instead of standing up on top
    let tgt = h1;
    if (feat && hD < h1) tgt = Math.max(h1 - fold, hD);   // (false when hD is unknown)
    if (B.jumpT > 0) tgt = Math.min(tgt, h1 - Math.min(fold, T.jumpPush));   // (P13) folding before a jump
    const om = 1 / T.legTime, y0 = c0 - (tgt - dh), v0 = w - gr, ee = Math.exp(-om * dt), kk = v0 + om * y0;
    let c1 = tgt + (y0 + kk * dt) * ee, w1 = gr + (v0 - om * kk * dt) * ee;
    // (P22) ... but within the tube the way ahead allows (see EXPLORER_BODY.wayStep): the hips rise no faster than would
    // carry them over the reach of any ground they will be over within wayTime, and no slower than clears the fold of any
    // (straight on from where they are). Until P22 they were levelled over the ground under the feet at its own rate, up
    // the face of a rock as fast as it rose, and overshot its top.
    // (and never out of the stroke over the ground here in this step)
    const W = B.way;
    if (W && W.ok && vh > 0.3) {
      const m = T.wayMargin, up = 2 * (h1 + reach - m - c0) / dt - w, dn = 2 * (h1 - fold + m - c0) / dt - w;
      let wt = clamp(w1, W.lo, W.hi);
      // (raised no faster than gravity, and a hold, can stop them again within the reach: the cap below, which the
      // tube must not get round by asking for the speed in one step)
      if (wt > w1) {
        // (wt^2 = 2 a (room - wt dt): still able to stop within the reach after this step)
        const a = Math.max(0.1, gE + pull), rm = Math.max(0, B.base + reach - m - c0), capU = trend - a * dt + Math.sqrt(a * a * dt * dt + 2 * a * rm);
        wt = Math.max(w1, Math.min(wt, up, capU));
      }
      else if (wt < w1) wt = Math.min(w1, Math.max(wt, dn));
      if (wt !== w1) { w1 = wt; c1 = c0 + 0.5 * (w + w1) * dt; }
    }
    {
      let a = (w1 - w) / dt, cut = false;
      const aMax = w < -0.2 ? T.legCatch : T.legLift, aMin = T.crestLaunch ? -(gE + pull) : -1e9;
      if (a > aMax) { a = aMax; cut = true; } else if (a < aMin) { a = aMin; cut = true; }
      let wn = w + a * dt;
      // the legs do not throw the hips up: beyond the rate the ground has been rising at (B.trend, the
      // slope of the hill being climbed) they raise them no faster than gravity, and a hold, can stop
      // again within the reach that is left
      // (the reach is counted from where the ground was before the legs began to work, B.base, carried on
      // at that rate: what rises under the feet may fall away again as fast)
      if (a > 0 && gE > 0) { const cap = trend + Math.sqrt(Math.max(0, 2 * (gE + pull) * (B.base + reach - c0))); if (wn > cap) { wn = Math.max(w, cap); cut = true; } }
      if (cut) { w1 = wn; c1 = c0 + 0.5 * (w + w1) * dt; }
    }
    let lam = 1, held = true, face = false, capF = 0;
    if (c1 < h1 - fold) {
      // folded out
      const capB = Math.max(w, Math.sqrt(Math.max(0, 0.5 * (gE + pull) * (fold + reach))));   // (a quarter of the stroke: the rest is kept for the far side)
      const cUp = Math.min(c0 + capB * dt, Math.max(c0, r + reach));
      if (h1 - fold <= cUp) { c1 = h1 - fold; w1 = Math.max(w1, Math.min(capB, (c1 - c0) / dt)); }
      else if (dh > T.clamber && vh * dt > 1e-6) { c1 = Math.max(c0, r - fold); w1 = 0; lam = 0; }   // a wall, not a step: it stops the body
      else { c1 = cUp; w1 = Math.min(capB, Math.max(w1, (c1 - c0) / dt)); lam = dh > 1e-9 ? clamp01((c1 + fold - r) / dh) : 1; face = true; capF = capB; }
    } else if (c1 > h1 + reach) {
      // reached out
      if (!looked) { hD = groundAhead(env, S.dir2, p1x, p1y, p1z, sx, sy, sz, T.look); feat = feat || (!onWall && B.wall !== 2 && (holdAhead(c0, w, vh, r, hD, T) || (h1 - B.base > 0.1 && r - hD <= T.clamber))); if (feat) B.grip = 1; }
      held = false;
      if (feat || !T.crestLaunch) {
        const gp = gE + T.gripAccel, cLow = c0 + w * dt - 0.5 * gp * dt * dt;    // the lowest the hold can bring the hips
        if (h1 + reach >= cLow) { c1 = h1 + reach; w1 = Math.max((c1 - c0) / dt, w - gp * dt); held = true; }
        else if (cLow <= r + reach + 1e-6 || !T.crestLaunch) {
          const l2 = dh < -1e-9 ? clamp01((cLow - reach - r) / dh) : 0;
          if ((1 - l2) * vh <= T.braceDv || !T.crestLaunch) { lam = l2; c1 = cLow; w1 = w - gp * dt; held = true; }
        }
      }
    }
    B.brace = wallTook;
    if (held && lam < 1) {
      // braced: the feet take only part of the step, and the rest of the forward speed is lost
      // (P21) against a face, only the speed into it (braceFace; see EXPLORER_BODY.braceSide)
      const fb = face && T.braceSide > 0;
      if (fb) {
        const o = braceFace(env, S, px, py, pz, r, ux, uy, uz, sx, sy, sz, c0, w, h1, dt, gE, pull, hD, capF, hold, T);
        p1x = o.px; p1y = o.py; p1z = o.pz; c1 = o.c1; w1 = o.w1; lam = o.lam;
        sx = o.sx; sy = o.sy; sz = o.sz; B.surge = (B.surge || 0) + o.surge; B.brace = wallTook + o.brace;
      } else { p1x = px + sx * lam * dt; p1y = py + sy * lam * dt; p1z = pz + sz * lam * dt; }
      r1 = Math.hypot(p1x, p1y, p1z) || 1;
      D.x = p1x / r1; D.y = p1y / r1; D.z = p1z / r1;
      s1 = env.sample(D);
      h1 = s1.radius; n1x = s1.normal.x; n1y = s1.normal.y; n1z = s1.normal.z;
      if (c1 < h1 - fold) c1 = h1 - fold;                // (a face the legs cannot fold onto: the hips are heaved up it)
      else if (c1 > h1 + reach) c1 = h1 + reach;
      if (fb) {
        // (the horizontal velocity braceFace leaves, laid in the ground's own plane where the step ends with its horizontal
        // part kept, when the step lays the velocity along that plane below (no hold): it would shorten it a second time.
        // With a hold the velocity is laid level below, as braceFace leaves it.)
        const l = Math.hypot(n1x, n1y, n1z), nu1 = l > 1e-9 ? (n1x * D.x + n1y * D.y + n1z * D.z) / l : 1;
        if (q !== 0 && !B.grip && nu1 > 0.05) { const lm = -(sx * n1x + sy * n1y + sz * n1z) / (l * nu1); sx += lm * D.x; sy += lm * D.y; sz += lm * D.z; }
      } else {
        // (P13) The FEET go no further up a face than the hips can follow (lam). The BODY is not stopped in
        // that sixtieth of a second: it comes on over its planted feet and the legs take its speed up as they
        // take a landing, legCatch at most (a run on the Moon met a 1 m boulder at 5.3 m/s and was at 2.0 m/s
        // one frame later: 200 m/s^2; now 0.11 s, the body 0.15 m over its feet meanwhile: B.surge). A wall
        // (lam 0) and a hold on the way down (its own limit, braceDv) are as they were.
        let m = lam;
        if (lam > 0 && face) {
          const sn = Math.hypot(sx, sy, sz);
          if (sn > 1e-6) { m = Math.max(lam, 1 - T.legCatch * dt / sn); B.surge = (B.surge || 0) + (m - lam) * sn * dt; }
        }
        B.brace = wallTook + (1 - m) * vh;
        sx *= m; sy *= m; sz *= m;
      }
    }
    if (!held) {
      // the feet leave the ground at full stretch, with the hips' velocity
      grounded = false;
      // (P12) ... but not thrown up by its own limbs. Hips that were being heaved up a face (capB above:
      // a speed chosen because the hold can stop it again within the stroke) still had half that speed
      // when the far side fell away in one frame: the step down was taken in contact, legs at full
      // reach, hips still rising at 1.1 m/s, and a frame later the feet left the ground of the far side
      // at +0.9 to +1.5 m/s: 0.3 m of rise and 1.2 s in the air on the Moon (PILOT's trace: +1.06 m/s).
      // The hold that the speed was lent against is the last thing to let go, and it lets go a body
      // that is not rising faster than the ground it has been running on rises (B.trend: a hill still
      // launches a runner at its own slope). Only while the legs are at work on a feature: a runner
      // whose legs are not working has the ground's own velocity and keeps it.
      if (gE > 0 && (working || B.grip) && w1 > Math.max(0, B.trend)) w1 = Math.max(0, B.trend);
      const rr = Math.max(h1, c1 - reach), vv1 = w1 - su;
      px = D.x * rr; py = D.y * rr; pz = D.z * rr;
      vx = sx + vv1 * ux; vy = sy + vv1 * uy; vz = sz + vv1 * uz;
      B.hip = 0; B.hipV = 0; B.trend = 0; B.paceCap = 1e9; B.paceAhead = 1e9; B.paceCrest = 1e9; B.paceWall = 1e9; B.ahead = null; B.clamberT = 0; B.grip = 0;
      if (B.way) B.way.ok = false;
    } else {
      px = D.x * h1; py = D.y * h1; pz = D.z * h1; sF = s1;
      B.hip = clamp(c1 - h1, -fold, reach); B.hipV = w1;
      // the pace the feet can follow: the hips must be down within reach of the ground one look
      // ahead by the time the feet are there
      B.paceCap = 1e9;
      if (feat && hD === hD) {
        const gp = Math.max(0.1, gE + T.gripAccel), Dh = c1 - hD - reach;
        if (Dh > 0) {
          B.paceCap = T.look * gp / (w1 + Math.sqrt(w1 * w1 + 2 * gp * Dh));
          // ... and on the way there the ground must not fall away faster than the hips can be
          // brought down within the reach that is left: v x slope <= -w + sqrt(2 (g + grip) room)
          const slope = Math.max(vh > 0.2 ? -(h1 - r) / (vh * lam * dt + 1e-9) : 0, (h1 - hD) / T.look);
          if (slope > 0.05) { const cap = (-w1 + Math.sqrt(2 * gp * Math.max(0, reach - B.hip))) / slope; if (cap < B.paceCap) B.paceCap = cap; }
          if (B.paceCap < 0.5) B.paceCap = 0.5;
        }
      }
      // (P16) the way ahead (see EXPLORER_BODY.aheadFrom)
      // (P19: the trials it runs step the ghost with the ghost's own scratch: D, the walker's up here, is read just below)
      wayAhead(B, env, S, px, py, pz, h1, sx, sy, sz, vh, gE, Math.max(0, hold * support) + (cmd.assistAccel > 0 ? cmd.assistAccel : 0), T, qlen);
      // (P22) the way, seen (see EXPLORER_BODY.wayStep): kept from here along the run, the tube for the next step
      // and (P22) the crests along it (see EXPLORER_BODY.crestMargin), read as far as the soles need to brake for them
      if (vh > 0.3) {
        const sd = sx * D.x + sy * D.y + sz * D.z, ex = sx - sd * D.x, ey = sy - sd * D.y, ez = sz - sd * D.z, el = Math.hypot(ex, ey, ez);
        const near = Math.max(T.look, vh * wayTime(gE, T)), ab = Math.max(0.3, T.aheadMargin * (Math.max(0, hold * support) + (cmd.assistAccel > 0 ? cmd.assistAccel : 0)));
        const far = Math.min(T.wayMax, Math.max(near + 1, Math.min(T.aheadMax, vh * vh / (2 * ab)) + T.look + T.look));
        if (el > 1e-9) { wayUpdate(B, env, S.dir2, px, py, pz, h1, h1 + B.hip, vh, ex / el, ey / el, ez / el, near, far, T); B.paceCrest = wayCrest(B.way, h1, vh, gE, ab, Math.max(0, B.trend, B.hipV) / vh, T); B.paceWall = wayWall(B, env, S, B.way, ab, 0.75 * scrambleHold(G, g, T), G, g, T); }
      } else { if (B.way) B.way.ok = false; B.paceCrest = 1e9; B.paceWall = 1e9; }
      // the velocity lies along the ground as the legs carry it (see LEGS, 1) at the new place
      { const l = Math.hypot(n1x, n1y, n1z); if (l > 1e-9) { n1x /= l; n1y /= l; n1z /= l; } else { n1x = D.x; n1y = D.y; n1z = D.z; } }
      const q1 = q === 0 || B.grip ? 0 : 1;
      if (q1 < 1) {
        n1x = D.x + (n1x - D.x) * q1; n1y = D.y + (n1y - D.y) * q1; n1z = D.z + (n1z - D.z) * q1;
        const l = Math.hypot(n1x, n1y, n1z); n1x /= l; n1y /= l; n1z /= l;
      }
      const vsep = sx * n1x + sy * n1y + sz * n1z;
      vx = sx - vsep * n1x; vy = sy - vsep * n1y; vz = sz - vsep * n1z;
      // keep the speed when the slope merely changes under the feet
      const a = Math.hypot(sx, sy, sz), b = Math.hypot(vx, vy, vz);
      if (b > 1e-6 && a > b && vsep > 0) { const m = a / b; vx *= m; vy *= m; vz *= m; }
      else if (b > 1e-6 && a > b && vsep < 0) {
        // (P22) ... and onto rising ground only the speed the BODY has into it is lost: the mass rides at the hips, and hips
        // the legs have raised in time already move along the new slope (the tube): a run onto a hill met so loses nothing
        // there. Until P22 the velocity was laid along the new ground whatever the hips did: v cos^2 of a slope, always.
        const nu1 = n1x * D.x + n1y * D.y + n1z * D.z, su1 = sx * D.x + sy * D.y + sz * D.z;
        const vc = Math.min(0, vsep + (B.hipV - su1) * nu1), b2 = Math.sqrt(Math.max(b * b, a * a - vc * vc));
        if (b2 > b) { const m = b2 / b; vx *= m; vy *= m; vz *= m; }
      }
    }
    B.clamber01 = grounded ? clamp01(Math.max(-B.hip / fold, B.hip / reach)) : 0;
    B.support = grounded ? support : 0;
    B.jetUse = 0;
  }

  if (!onGround) {
    // ======================= in the air or afloat =============================================
    let vv = vx * ux + vy * uy + vz * uz;
    let hx = vx - vv * ux, hy = vy - vv * uy, hz = vz - vv * uz;
    // steering: vectored jet thrust, or the suit's small thrusters, or swimming strokes
    let lx = 0, ly = 0, lz = 0, lat = 0;
    const ac = cmd.airControl == null ? 1 : cmd.airControl;
    if (sub > 0.3) {
      const amax = T.swimForce / T.mass;
      lx = (qx - hx) / T.swimTime; ly = (qy - hy) / T.swimTime; lz = (qz - hz) / T.swimTime;
      lat = Math.hypot(lx, ly, lz);
      if (lat > amax) { const m = amax / lat; lx *= m; ly *= m; lz *= m; lat = amax; }
    } else if (qlen > 1e-6 || aJet > 0) {
      const tau = aJet > 0 ? T.jetSteerTime : T.rcsTime;
      const amax = Math.max(aJet * T.jetVector, T.rcsAccel) * ac;
      if (qlen > 1e-6) {
        lx = (qx - hx) / tau; ly = (qy - hy) / tau; lz = (qz - hz) / tau;
        lat = Math.hypot(lx, ly, lz);
        if (lat > amax) { const m = amax / lat; lx *= m; ly *= m; lz *= m; lat = amax; }
      }
    }
    // the jet's sideways share comes out of its lift (thrust is one vector)
    let jetUp = aJet;
    if (aJet > 0 && lat > T.rcsAccel * ac) {
      const side = Math.min(lat - T.rcsAccel * ac, aJet * T.jetVector);
      jetUp = Math.sqrt(Math.max(0, aJet * aJet - side * side));
    }
    // governor: ease the thrust off as the climb reaches its cap
    const gEff = g * (1 - buoy);
    if (aJet > 0 && cmd.jetMaxRise != null && cmd.jetMaxRise < 1e8) {
      const want = gEff + (cmd.jetMaxRise - vv) / 0.25;
      if (jetUp > want) jetUp = Math.max(0, want);
    }
    B.jetUse = aJet > 0 ? clamp01(B.jetThrottle * (0.25 + 0.75 * jetUp / aJet)) : 0;
    // automatic descent brake
    let retro = 0;
    if (cmd.descentLimit != null && cmd.descentLimit < 1e8 && sub < 0.3) {
      const lim = cmd.descentLimit, lo = lim * (1 - T.retroBand);
      if (-vv > lim) retro = clamp((-vv - lim) / 0.12 + gEff, 0, T.retroAccel);
      // (P13) the brake is a throttled jet: it lights before the limit and grows as the fall nears it, so a
      // fall settles toward its descent speed (the weight is carried exactly at the limit) and does not snap to it
      else if (-vv > lo && lim > lo) { const x = (-vv - lo) / (lim - lo); retro = gEff * x * x; }
    }
    vv += (-gEff + jetUp + retro) * dt;
    hx += lx * dt; hy += ly * dt; hz += lz * dt;
    vx = hx + vv * ux; vy = hy + vv * uy; vz = hz + vv * uz;
    // air drag on the velocity relative to the wind (implicit: exact for quadratic drag)
    if (airK > 0) {
      const rx = vx - wx, ry = vy - wy, rz = vz - wz;
      const m = 1 / (1 + airK * Math.hypot(rx, ry, rz) * dt);
      vx = wx + rx * m; vy = wy + ry * m; vz = wz + rz * m;
      B.windAccel = airK * Math.hypot(wx, wy, wz) * Math.hypot(wx, wy, wz);
    } else B.windAccel = 0;
    B.windBrace = 0; if (hk > 0) B.hunker01 = hk * Math.exp(-dt / T.hunkerUp);
    // liquid drag: vertical and horizontal
    if (sub > 0) {
      const kv = 0.5 * liq.density * T.sinkCdaV / T.mass * Math.min(1, sub * 3);
      const kh = 0.5 * liq.density * (T.swimCda + T.wadeWidth * 0.25 * sub) / T.mass;
      vv = vx * ux + vy * uy + vz * uz;
      hx = vx - vv * ux; hy = vy - vv * uy; hz = vz - vv * uz;
      const kvis = visc * sub * T.height;
      // (P20) vertically against the water, which rises and falls with the waves (wRate; 0 in still liquid)
      let vr = vv - wRate;
      vr /= 1 + (kv * Math.abs(vr) + kvis) * dt;
      const hm = 1 / (1 + (kh * Math.hypot(hx, hy, hz) + kvis) * dt);
      // bobbing is damped by wave-making as well as by drag
      vr *= Math.exp(-2.2 * dt * Math.min(1, sub * 3));
      vv = vr + wRate;
      vx = hx * hm + vv * ux; vy = hy * hm + vv * uy; vz = hz * hm + vv * uz;
    }
    px += vx * dt; py += vy * dt; pz += vz * dt;
    // meet the ground
    const r1 = Math.hypot(px, py, pz) || 1;
    D.x = px / r1; D.y = py / r1; D.z = pz / r1;
    const s1 = env.sample(D);
    if (r1 <= s1.radius) {
      let n1x = s1.normal.x, n1y = s1.normal.y, n1z = s1.normal.z;
      { const l = Math.hypot(n1x, n1y, n1z); if (l > 1e-9) { n1x /= l; n1y /= l; n1z /= l; } else { n1x = D.x; n1y = D.y; n1z = D.z; } }
      px = D.x * s1.radius; py = D.y * s1.radius; pz = D.z * s1.radius; sF = s1;
      const vn = vx * n1x + vy * n1y + vz * n1z;
      let hipIn = 0;
      if (vn < 0) {
        // (P11) A LEGGED landing. Until P11 this was the landing of a rigid block: the whole normal speed
        // gone in one step and a Coulomb impulse (kinetic friction x that speed) off the tangential part,
        // so a jump from a walk came down with the legs straight (hip 0 on the landing frame and after)
        // and lost half its forward speed at the touch (4.17 to 2.04 m/s on Earth, 4.13 to 2.19 on the
        // Moon: the filmstrips). A person lands on the legs: the feet stop, the hips go on down and the
        // legs take them up over their stroke (legCatch at most, legFold deep: up to 5.2 m/s), and since
        // no blow is struck there is no friction impulse: the forward speed is kept, as in every stride
        // of a run. Only the part of the normal speed the stroke cannot take is a blow, with its friction.
        const soft = Math.min(-vn, Math.sqrt(2 * T.legCatch * T.legFold)), hard = -vn - soft;
        vx -= vn * n1x; vy -= vn * n1y; vz -= vn * n1z;
        if (hard > 0) {
          const vt = Math.hypot(vx, vy, vz);
          const G1 = env.ground ? (GF = env.ground(s1, S.gnd)) : DEFAULT_GROUND;
          const cut = G1.kinetic * hard;
          const m = vt > 1e-6 ? Math.max(0, 1 - cut / vt) : 0;
          vx *= m; vy *= m; vz *= m;
        }
        B.impact = -vn;
        hipIn = -soft * (n1x * D.x + n1y * D.y + n1z * D.z);
      }
      // touching down only counts when buoyancy does not carry the body there
      let l1 = (s1.liquidRadius || 0) > s1.radius ? s1.liquidRadius - s1.radius : 0;
      if (l1 > 0 && env.waterLevel) { const w = env.waterLevel(st.p, l1); if (w === w) l1 = Math.max(0, l1 + w); }   // (P20) the drawn sea
      if (clamp01(l1 / T.height) * liq.density / rhoBody < 1) { grounded = true; B.hip = 0; B.hipV = vx * D.x + vy * D.y + vz * D.z + hipIn; }
    }
    B.support = 0; B.brace = 0; B.paceCap = 1e9; B.paceAhead = 1e9; B.paceCrest = 1e9; B.paceWall = 1e9; B.wall = 0; B.ahead = null; B.clamber01 = 0; B.clamberT = 0;
    if (B.way) B.way.ok = false;
    if (!grounded) { B.hip = 0; B.hipV = 0; B.trend = 0; B.grip = 0; }
    B.slip01 = grounded ? 0 : B.slip01 * 0.9;
    B.scramble01 = 0;
  }

  // ---- report ------------------------------------------------------------------------------------
  const rF = Math.hypot(px, py, pz) || 1;
  const vvF = (vx * px + vy * py + vz * pz) / rF;
  B.speedGround = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - vvF * vvF));
  // (P19) the ground reported (material, friction, the boot's sink and its dust) is the ground under the feet where the
  // step ENDS: the step that comes down on a boulder's rock from the sand reports rock (until P19 the step's own ground,
  // where it began: one step late at every edge). It is kept, with the place, for the next step to start on.
  let GR = G;
  if (grounded && sF && env.ground) {
    GR = S.G = GF || env.ground(sF, S.gnd); S.gEnv = env; S.gx = px; S.gy = py; S.gz = pz;
  } else S.gEnv = null;
  B.material = GR.material; B.friction = GR.friction;
  B.puff = B.impact > B.puff ? B.impact : B.puff * Math.exp(-dt / 0.1);
  if (B.puff < 0.05) B.puff = 0;
  const sinkT = grounded ? GR.sink * (0.7 + 0.3 * Math.min(1, B.speedGround / 3)) + Math.min(0.1, B.impact * 0.01) : 0;
  B.sink += (sinkT - B.sink) * (1 - Math.exp(-dt / 0.08));
  B.dust = grounded ? clamp01((GR.dust || 0) * (0.15 + B.speedGround / 6 + B.slip01 + B.impact * 0.15)) : 0;
  st.p.x = px; st.p.y = py; st.p.z = pz;
  st.v.x = vx; st.v.y = vy; st.v.z = vz;
  st.grounded = grounded;
  if (!S.ghost) stepGait(B, st, dt, grounded, g * (1 - buoy), env, T, S);
  return st;
}

// The steady speed (m/s) the legs can hold on level ground of contact `G` in air of density rho
// under gravity g, for a wished speed: the smaller of the wish and what power, friction and
// drag allow. For PILOT's HUD or tests; the step function needs none of it.
export function sustainableSpeed(wish, g, rho, G = DEFAULT_GROUND, T = EXPLORER_BODY) {
  const k = 0.5 * rho * T.cdaUpright / T.mass;
  let lo = 0, hi = wish;
  if (!(g > 0)) return 0;
  const ok = (v) => {
    const need = G.drag * g * Math.tanh(v / 0.5) + k * v * v;      // m/s^2 of propulsion needed
    return need <= Math.min(T.legAccel, (G.friction + G.foothold * (1 - smoothstep(T.runFoothold * 0.4, T.runFoothold, v))) * g) && need * v <= T.legPower / T.mass;
  };
  if (ok(hi)) return hi;
  for (let i = 0; i < 30; i++) { const m = 0.5 * (lo + hi); if (ok(m)) lo = m; else hi = m; }
  return lo;
}
