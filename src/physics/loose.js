// Painted Cosmos physics: loose particles: dust, sand, ash, spores, leaves, spray, hail.
// OWNER: PHYSICS. Pure (no three, no DOM). Works on the buffers made in particles.js.
//
// Each particle is a point mass with weight and quadratic drag toward the moving air, scaled to
// its own terminal speed for this planet's gravity and air (the same law as the rain):
//   dv/dt = g - (g / vt^2) |v - w| (v - w)
// In a vacuum vt is infinite and the drag term vanishes: kicked dust then flies in clean
// parabolas and lands within a second or two, with no cloud left hanging (the Moon, Mercury).
// In air a 30 micron dust grain falls at 5 cm/s, so it is carried off by the wind and hangs.
//
// Where they come from:
//   feet        dust and sand kicked up behind a walker, in proportion to speed, slip and how
//               loose the ground is (ground().dust); a puff on landing; powder from snow
//   jets        the jetpack plume and the ship's downwash scour loose ground into a radial sheet
//               (spray over liquid), at a speed set by the dynamic pressure of the jet
//   the wind    saltation: above the threshold wind, sand grains hop along the ground in low
//               arcs, each impact launching the next (streamers); fine dust is lifted and hangs
//   the weather dust storms; hail in a storm core
//   the biome   falling leaves, spores, ash
//   dust devils a rising helix of dust (features.js)
import { SPECIES, terminalVelocity, meanFreePath, ATMOSPHERES } from './atmosphere.js';
import { saltationThreshold } from './weather.js';
import { MATERIAL_IDS, MATERIAL_INDEX, MATERIAL_NONE, materialNow } from './ground.js';
import { BODIES } from '../data/bodies.js';
import { PARTICLES, EVENT, publish } from './particles.js';
import { clamp01, smoothstep, noise3, fsin, fcos } from './util.js';
import { snowTransport01 } from './drift.js';
import { powerWind, KIND, WINDPOWER } from './powers.js';

// species: row of atmosphere.SPECIES for the fall speed.  life: [min, max] seconds.
// puff: seconds for which a kicked or blown grain is carried by the parcel of air thrown up with
// it. A 30 micron grain alone stops within millimetres; a puff of dust rises because the foot or
// the jet moves the air, and the dust rides that air until it mixes away.
// flutter: sideways tumbling speed as a fraction of the fall speed (capped at 1 m/s).
// turb: how much of the air's turbulence the particle follows.
// ground: what happens on touching the ground: 0 dies, 1 hops on (saltation), 2 bounces (hail).
// lands: it falls steadily enough for its landing to be foretold (buf.left: the time to the
// ground at its fall speed). Dust is not: it hangs, and its vertical speed is the turbulence's.
export const LOOSE = Object.freeze({
  dust: { species: 'dust', life: [3, 8], flutter: 0, turb: 1.0, ground: 0, rest: 0, puff: 0.45 },
  sand: { species: 'sand', life: [1.5, 4], flutter: 0, turb: 0.25, ground: 1, rest: 0.5 },
  ash: { species: 'ash', life: [8, 16], flutter: 0.3, turb: 0.7, ground: 0, rest: 0, puff: 0.3, lands: true },
  spores: { species: 'spore', life: [8, 16], flutter: 0.5, turb: 0.9, ground: 0, rest: 0, puff: 0.3, lands: true },
  // (P15) leaves: turb 0.5 -> 0.9 (a leaf answers the air within vt / g, 0.15 s: it rides every eddy longer than a
  // second, the gusts' updraughts included, which is what keeps a flock aloft); tumble: the share that tumble end over
  // end (the rest flutter to and fro without turning over: Field, Klaus, Moore and Nori 1997, Andersen, Pesavento and
  // Wang 2005), see BLOWN.leafRo
  leaves: { species: 'leaf', life: [6, 14], flutter: 0.6, turb: 0.9, ground: 0, rest: 0, lands: true, tumble: 0.75 },
  spray: { species: 'spray', life: [0.5, 1.4], flutter: 0, turb: 0.1, ground: 0, rest: 0 },
  hail: { species: 'hail', life: [3, 6], flutter: 0, turb: 0, ground: 2, rest: 0.45 },
});
export const LOOSE_KINDS = Object.keys(LOOSE);

// (P26) WADING. Legs driven through a liquid throw it: their drag there is 0.5 rho Cd A v^3 of power (A: their width times
// the depth they are in), and the spray carries a share of it off as drops thrown at about the legs' own speed. So the
// drops thrown for each metre waded go with v^2 and with the depth, as far as the knee; and they fly as high as that
// speed throws them (a walk ruffles the water, a run throws sheets of it knee high and more). Until P26: 6 a metre at any
// pace and depth (18 a second at a 3 m/s run: a thin sprinkle), thrown at one speed.
export const WADE = Object.freeze({
  perMetre: 6,          // drops thrown per metre waded at a crawl, knee-deep
  perV2: 4,             // ... and this many more for each (m/s)^2 of the pace (10 a metre at 1 m/s, 22 at 2, 42 at 3)
  depthFull: 0.3,       // m of liquid from which the legs throw all of that (ankle-deep: a third)
  out: 0.3, outV: 0.35, // m/s the drops leave sideways: out + outV x pace
  up: 0.4, upV: 0.5,    // m/s upward: (up + upV x pace) x 0.6 .. 1.4 (0.9 to 2.6 m/s at 3 m/s: a third of a metre high on Earth)
  // (M4) THE WATER TAKES A MARK (PAINTER's critique of PHYSICS, item 4: "wading in at 2.5 m/s and swimming at 2 m/s leave
  // the sea untouched: no ring, no wake, no white at the legs or the shoulders"). What was there: a wader laid one ring
  // for every half metre, of strength pace / 3, and on a sea over 0.1 m high the rings were taken away (a rain drop's
  // ring is lost in a chop: P20; at Earth's coast, Hs 0.14 to 0.46 m, nearly all of them); a swimmer laid none and
  // threw nothing. Now a body in liquid leaves RINGS of its own, that a chop does not take (ownCalm of them at least):
  // a wader two for every ringEvery metres, one at each leg; a swimmer three for every ringEvery metres swum or every
  // treadEvery seconds treading, at the shoulders and behind: laid along its path they are its wake. And a swimmer has
  // a COLLAR: swimSpray drops a metre (collarRate a second at least), thrown low and slow where the body meets the
  // surface (PAINTER's spray is a pale blot half a metre wide: together a wisp of white round the shoulders).
  ringEvery: 0.45,      // m
  treadEvery: 0.7,      // s
  ringSide: 0.3,        // m to either side of the body
  ownCalm: 0.6,         // a body's own rings keep at least this share of their strength on a rough sea
  swimSpray: 12, collarRate: 8,    // drops a metre swum; a second at least
  collarOut: 0.5, collarUp: 1.2,   // m/s: sideways and upward (x 0.6 .. 1.4: a hand's breadth over the water)
});
export const KICK = Object.freeze({
  perMetre: 5,          // dust grains raised per metre walked on the loosest ground
  landing: 10,          // grains per m/s of landing speed
  up: 1.1,              // m/s: typical upward speed of a kicked grain
  // (P17) a step raises a puff only from ground with loose fines at its surface: dry bare soil (0.15), gravel (0.2), sand,
  // dust, ash, and a little from dry litter (0.06) and moss (0.08). A living sward (grass 0.02: the roots bind the soil
  // and the blades cover it) and rock (0.03) give none: no puff at the boot. (Before, a run or a landing on a meadow put
  // up a lone puff now and then: each grain is drawn as a puff, and the meadow's 0.02 was a chance of one a step.)
  stepDust: 0.05,
  jetRate: 90,          // grains per second per unit of jet load on the loosest ground
  jetSpeedMax: 14,      // m/s: fastest a grain leaves a jet's footprint
  // Once sand is hopping, each impact keeps it going at a lower wind than was needed to start
  // it: the impact threshold. On Earth it is 0.8 of the fluid threshold; on Mars about a tenth
  // (Kok 2010), which is why Martian storms keep saltating in winds that could not start it.
  impactRatio: { earth: 0.8, mars: 0.12, venus: 0.8, default: 0.8 },
});

// What the wind alone raises (P10).
export const BLOWN = Object.freeze({
  // Streamers: blowing sand and blowing snow do not leave the ground evenly but in sinuous bands a
  // metre or so wide and tens of metres long that travel downwind and snake from side to side (the
  // sweeps of the gusts near the ground; "snow snakes" on a road). The share of the ground in a
  // band is about a third; grains are launched there and nowhere else.
  streamLength: 16,       // m along the wind
  streamWidth: 1.3,       // m across it
  streamSnake: 2.2,       // m: how far a band wanders from side to side over streamWave m
  streamWave: 28,
  streamSpeed: 0.55,      // x the 10 m wind: how fast the bands travel downwind
  // Blowing snow: dry snow on the ground is moved like sand, lower and slower (drift.js
  // snowTransport01 says how hard); a ground blizzard is knee deep, a skim in a moderate wind.
  snowRate: 0.6,          // of the sand capacity per 1.6 s at full transport
  // Leaves: in a breeze a tree lets go of one now and then; the load on a leaf stalk goes with the
  // square of the wind and the share of stalks that fail rises as steeply again with the load, so
  // what is torn off goes with the fourth power of the wind; a gust front (the wind rising) strips
  // what the lull left: a flock.
  // (P15) In units of `torn` (below), which multiplies leafFlux; until P15 they were shares of the capacity a second, so a
  // capacity that was raised to show more leaves tore more off: the count is now what the wood sheds, not the buffer.
  leafCalm: 0.03,         // torn in still air where the biome's leaves (ground.js AIRBORNE) are 1: an autumn wood lets go of
                          // its leaves by itself (2000 a m2 over a month: 2 to 3 a second in the box); a summer wood (0.25) a
                          // quarter of that. (Until P15: 0.002 of the capacity a second, any wood.)
  leafWind: 11,           // m/s (10 m, in the open): the wind at which torn is 1
  leafGust: 2.5,          // x more while a gust is arriving (the wind rising at 1 m/s2)
  // (P15) How many: a wood in leaf holds some 2000 leaves over each m2 of its floor (leaf area index 5, a leaf 25 cm2). A
  // summer gale strips one or two in a hundred of them in its first minutes (green litterfall in storms: 0.1 to 0.3 a m2 a
  // second) and a gust front the weak ones first: leafFlux leaves a second off each m2 of closed canopy at torn 1, at most
  // leafTornMax times that (0.24), out of a stock of leafStock a m2 held loosely enough to go (2 in 100), which the gale
  // drains (in about 170 s at full) and a calm restores over leafRecover s. Under the crowns a torn leaf comes down at its
  // fall speed vs, so the air there holds flux / vs leaves a m3: at the gust front in a closed wood 0.24 / 1.5 = 0.16, in
  // an open one (canopy 0.3) a third of that. Each comes off where the crowns are (cover canopy01 and leaves there) and
  // where the gust is (the wind at that place, to the fourth power): they come in bursts and streams, not evenly.
  // A canopy in leaf sheds in a gale whatever its season: the biome's leaves count in full from 0.25 (a summer wood) up;
  // an autumn wood (1) holds leafAutumn times the stock loosely.
  leafFlux: 0.04,
  leafTornMax: 6,
  leafStock: 40,
  leafAutumn: 9,
  // (P15) A leaf torn off a crown 20 m up falls for ten seconds or more and goes a hundred metres downwind meanwhile: most
  // of the leaves crossing the box near the ground were shed upwind of it. Those come in through its upwind side (inflow:
  // each shed over the fetch upwind where it is still in the air when it gets there, at the height it has come down to),
  // so the box holds what a wood that goes on upwind would put in it, low leaves included; until P15 it held only what
  // its own crowns let go, high up, and they left it downwind before they came down: none passed the walker's eye.
  leafFetch: 300,         // m: the farthest upwind a shed leaf is followed from
  leafRecover: 1200,
  // (P15) Litter: what lies on the floor of a wood (last year's leaves, twigs, bits of bark) is lifted where the gust
  // sweeps reach it: a dry leaf on the ground slides at 3 to 4 m/s of wind at a metre and is thrown up at a few more;
  // the gusts' sweeps carry it head high in the streamers along the wind. leafLitter leaves a second off each m2 of
  // littered floor when the wind at 1 m is litterFull, none below litterFrom; wet litter lies (wet01).
  leafLitter: 0.04,
  litterFrom: 3,          // m/s at 1 m (the gusts' sweeps in it)
  litterFull: 9,
  // (P15) A tumbling plate turns at Omega = 2 Ro |v - w| / c (Ro, its rotation number, 0.2 to 0.4 for a thin plate
  // tumbling free: Lugt 1983, Iversen 1979, Mahadevan, Ryu and Samuel 1999), c its chord (0.6 of the leaf's length): a 5 cm
  // leaf, 3 cm across, slipping through the air at 1.5 m/s turns some 5 times a second, so a two-toned leaf shows its other
  // side about ten times a second. A flutterer rocks through +-leafRock radians at half that rate and never turns over.
  leafRo: [0.2, 0.4],
  // (M4; PAINTER's critique of PHYSICS, item 8: "a tumbling leaf changes colour from one frame to the next") ... which
  // thirty frames a second cannot show: a leaf drawn with two faces flickers. The turn that is handed over (buf.turn)
  // goes no faster than leafTurnMax: a turn and a half a second, each face seen for a third of a second.
  leafTurnMax: 9.42,    // rad/s
  leafRock: [0.9, 1.35],
  // Spume and surf (the sea's own spray; before P10 only bodies raised spray).
  // Spume: where a crest is breaking and the wind is over spumeFrom the wind tears the top off it:
  // drops leave at the crest's speed plus a share of the wind, a little upward, and stream downwind
  // within a metre or two of the water (Beaufort 8: "foam is blown in well-marked streaks", 9: "spray
  // may affect visibility"; Anguelova et al. 1999 for the onset near 9 m/s of friction-scaled wind).
  spumeFrom: 9,           // m/s at 10 m: no spume below this
  spumeFull: 24,          // m/s: the whole capacity in the air
  spumeLife: 2.2,         // x the life of a splash drop
  // Surf: where the water is shallower than the waves are high the wave breaks whatever the wind:
  // spray is thrown up and shoreward at about the speed of the breaker's lip, sqrt(g H).
  surfDepth: 1.3,         // x the significant height: breaking starts where the water is shallower
  surfShare: 0.5,         // of the spray capacity per second on a beach in a full sea
});

// WHAT A FIRE LOOKS LIKE IN THE AIR (2026-11-18; the elemental powers, fire: fire.js, docs/POWERS-FIRE.md).
// The fire itself is a short list of small burning patches: where each one burns, how wide it is, how hot it is and
// how old. It draws nothing at all. THIS is what is drawn, and it is made the way the explorer's wind is made --
// which is already in the game and proven (see _wisps, far below): grains of the LEAF kind, each handed a ground
// material's ink, which makes PAINTER's leaf kit lay it as a RIBBON ALONG ITS OWN FLIGHT instead of a leaf
// (physics/three/expand.js, its `wisp` option). So no mesh, no material and no draw call is added by any of this,
// and nothing is worked out for a pixel.
//   FLAME   short tongues thrown up out of the hottest patches, leaning downwind, each one gone in half a second,
//           so a fire is a moving crowd of small marks and never one shape.
//   SMOKE   slower and paler, sprinkled all the way up a leaning column that widens as it rises. A smoke grain does
//           NOT climb that column: nothing here could carry one ten metres up (a grain answers the air it is in
//           within a tenth of a second, and then it only sinks). It is BORN somewhere up the column, moving the way
//           the smoke moves there, and is gone in a moment; the crowd of them is the plume. That is the same trick
//           that draws the whirlwind's column (_wisps, KIND.vortex), and it is the only one that works here.
//   EMBERS  a few heavy bright specks thrown up fast out of the fire; being heavy they hold their flight, arc over
//           downwind and fall out, which is what makes a fire look alive.
// THE WIND. They drift with the weather and with the player's own gusts for nothing, because every grain of the leaf
// kind is carried by the air in the motion loop below, which already asks the wind grid and the powers. The lean
// each one is GIVEN AT BIRTH is the wind at its own patch, which fire.js has already asked the air for (the dust
// devils and the player's wind are folded into that), so a gust that fans a fire also bends its flames and lays its
// smoke over, and a stilled place lets them stand up straight.
// HOW MANY, AND WHOSE ROOM IT TAKES. So many grains a second for each square metre of fire, so that one campfire is
// a campfire; and under a hard ceiling for the whole fire however big it grows -- flameShare, smokeShare and
// emberShare of the leaf buffer, an eighth of it between them. On top of that nothing at all is made once the
// buffer is more than `share` full, so the leaves of a gale and the wind's own strokes can never be crowded out by a
// fire. The dust, the sand and the spray have their own buffers and a fire never touches them.
// WITH NOTHING BURNING all of this costs ONE COMPARISON a frame (see update: `if (P.fires)`), because the game hands
// the fire list over only while something is actually alight.
// WHAT IT COST, measured on the build machine (the tests beside this file print all three): with nothing burning,
// nothing that can be told from nought -- the whole physics frame is the same to within a microsecond or two of its
// own noise, run both ways. One campfire: 0.03 ms on a 0.45 ms frame, about seventy more grains in the air. A forest
// fire at the cap: 0.10 ms, about 280 more grains. Of that the making of them is 0.007 ms; all the rest is the motion
// loop below carrying them, at the same price a leaf in a gale costs. If the owner finds a big fire thin, raise
// flamePerM2 and flameShare; if it is dear on the phone, lower them. Those are the only two numbers that matter.
// WHAT IS NOT HERE. No light: a fire lights the ground round it, and that is PAINTER's to add, not ours. And no
// difference of SIZE between the three -- PAINTER draws every grain of the leaf kind the same width and no stroke
// shorter than 0.8 m (world/index.js, draw.leaves), so flame, smoke and embers are told apart by their colour, by
// where they are born, by how fast and which way they fly (which is what sets each stroke's length and lean) and by
// how long they live. An ember cannot be made a small bright POINT from here; that is a change to the leaf kit.
export const FLAME = Object.freeze({
  share: 0.92,           // of the leaf buffer: over this, a fire makes nothing at all and waits.
                         // (2026-11-18, FOUND BY LOOKING: a fire lit in the owner's own autumn wood drew NOTHING -
                         //  no flame, no smoke, no ember - while it burned, and this was why. At 0.5 the fire holds
                         //  its hand whenever the leaf buffer is half full, and an autumn wood in leaf-fall beside a
                         //  river is exactly where it never is: the one scene the owner looks at most was the one
                         //  scene a fire could not be seen in. The three ceilings below already bound a fire to an
                         //  eighth of the buffer however big it grows, so the leaves of a gale were never in danger
                         //  from it; this backstop only needs to stop a fire taking the LAST of the buffer.)
  edge: 8,               // m: patches further than this outside the simulated box are ignored, so the budget is
                         // spent on fire that can be seen rather than on fire over the hill

  // FLAME. A tongue is born just off the ground (the painter's ribbon is drawn BACKWARDS from the grain along its
  // flight, so a rising grain stands rooted in the fire) and thrown up fast. It is heavy for its kind on purpose:
  // a light grain is pulled into the air's own motion within a few hundredths of a second and the tongue collapses,
  // while a heavy one holds the flight it was given for about as long as it lives, which is what makes a tongue.
  // (2026-11-22, the owner: "change up the fire animation it doesnt feel violent enough". More tongues, thrown
  //  harder and higher, and -- the thing that matters most -- IN SURGES: see flameSurge below.)
  flamePerM2: 26,        // tongues a second for each square metre of fire at full heat (a campfire of one patch, 4
                         // square metres, makes 104 a second: 42 in the air at once; it was 15)
  flameShare: 0.11,      // ... and never more of the leaf buffer than this, however big the fire (a forest fire 45 m
                         // across asks for many times the ceiling, so it sits on it; it was 0.06)
  flameLife: 0.40,       // s (each one 0.6 to 1.4 times this: see emit)
  flameUp: 6.2,          // m/s thrown up (x 0.45 .. 1.25, and less from a patch that is not yet hot; it was 4.5:
                         // the ribbon is drawn backwards along the flight, so this IS how tall a tongue stands)
  flameHigh: 1.35,       // m: how high over the fire a tongue may start
  flameLean: 0.55,       // of the wind at the patch, carried sideways at birth: the flame leans, it is not blown flat
  flameSize: 4.5,        // x a leaf: heavy, see above -- AND WIDE, which is what the painter draws the stroke at.
                         // (SEEN, 2026-11-22: at 1.5 a fire was a scatter of thin stubs standing on a brightly lit
                         //  bank -- the light read as a fire and the flames did not. A tongue has to be fat enough
                         //  that a crowd of them is a MASS with gaps torn in it, not a row of straws. 2.2 was
                         //  tried and SEEN, by painting the tongues magenta to be sure which marks they were: a
                         //  tongue a fifth of a metre across and the painter's shortest stroke, 0.8 m, long is a
                         //  BLADE OF GRASS. At 4.5 it is half a metre across, which is a flame's own proportion.)

  // SMOKE. Thicker the hotter the fire, and it outlives the flame that made it: a burnt-out patch goes on smoking
  // for smokeAfter seconds at smokeAsh of its old strength, so the ground behind a fire front still smokes.
  smokePerM2: 12,        // puffs a second for each square metre of fire (a campfire: 48 a second, 38 in the air)
  smokeShare: 0.045,     // ... and never more of the leaf buffer than this. (It was 0.06, and with the flame's own
                         // share raised the smoke could outnumber the fire in the air: counted in the gallery, 181
                         // puffs against 310 tongues, and a fire should not be mostly smoke at its foot.)
  smokeLife: 0.8,        // s
  smokeTop: 10,          // m: how far up the column reaches at full heat
  smokeRise: 2.6,        // m/s at its foot, falling to half that at the top
  smokeSpread: 0.22,     // m of width for each m of height
  smokeFoot: 0.6,        // m: the column starts this far up, clear of the sloping ground under the patch
  smokeSize: 0.7,        // x a leaf
  smokeAfter: 8,         // s a burnt-out patch goes on smoking (its ash is kept 11 s: fire.js FIRE.ashLife)
  smokeAsh: 0.55,        // how much of a flaming patch's smoke a burnt-out one makes

  // EMBERS. Few, fast and heavy: they arc.
  emberPerM2: 1.9,       // embers a second for each square metre of fire (a campfire: eight a second; it was 1.6.
                         // 2.4 was tried and SEEN: with the spark drawn as its whole flight they filled the picture)
  emberShare: 0.012,     // ... and never more of the leaf buffer than this (it was 0.008)
  emberLife: 1.6,        // s
  emberUp: 7.6,          // m/s (x 0.55 .. 1.45; it was 6.5: a fire that spits)
  emberOut: 1.2,         // m/s sideways, so they leave the fire as a spray and not a jet
  emberLean: 1.0,        // of the wind at the patch: an ember is carried off downwind
  emberSize: 2.2,        // x a leaf: heavy enough to keep its arc for a second or two

  // IT SURGES. A fire does not burn evenly: it gathers and leaps, and that is most of what makes one look violent
  // rather than decorative. Each patch has its OWN beat, from three rates that do not divide into each other with
  // the patch's own number for a phase, so a wide fire BOILS all over instead of breathing in and out as one lamp.
  // It multiplies how many tongues a patch throws, how hard it throws them and how high they start, all together,
  // which is what a leap is. 1 on average, so a fire is no bigger than it was -- only far less even.
  surgeA: 0.30, surgeB: 0.22, surgeC: 0.14,       // how much of each beat
  surgeRa: 6.1, surgeRb: 2.7, surgeRc: 13.7,      // and how fast, in radians a second
  surgeLow: 0.30, surgeHigh: 1.70,                // held between these
});
// How hard one patch is leaping now (see the surge dials above). `t` is the physics' own clock in seconds.
export function flameSurge(s, t) {
  const F = FLAME, p = ((s.id || 1) % 977) * 0.618;
  const k = 1 + F.surgeA * Math.sin(t * F.surgeRa + p * 12.9) + F.surgeB * Math.sin(t * F.surgeRb + p * 7.3)
    + F.surgeC * Math.sin(t * F.surgeRc + p * 3.1);
  return k < F.surgeLow ? F.surgeLow : k > F.surgeHigh ? F.surgeHigh : k;
}
// How much of a fire's smoke one patch is making now: while it burns, as fiercely as it burns; and for a while after
// it has burnt out, because a black patch goes on smoking after its flame has gone (fire.js keeps it as ash).
const smokeOf = (s) => (s.ash ? (s.ashAge < FLAME.smokeAfter ? FLAME.smokeAsh * (1 - s.ashAge / FLAME.smokeAfter) : 0) : s.heat);

const _gp = { dust: 0, repose: 0, liquid: 0, h: 0, mat: MATERIAL_NONE };
const _pwl = new Float64Array(4), _covL = {};
const _sf = {}, _sp = new Float64Array(2), _aw = new Float64Array(2);
const _wl = {};
const _gq = new Float64Array(4);     // (P17) x, z in; ground height, liquid level out (near.js TerrainGrid.groundQ)
const I_DUST = MATERIAL_INDEX.dust, I_SNOW = MATERIAL_INDEX.snow;
const I_WOOD = MATERIAL_INDEX.mud != null ? MATERIAL_INDEX.mud : MATERIAL_INDEX.soil;
// (a cast made bigger throws about more in proportion to the ground it covers, not to its radius: powers.js sizeOf)
const sizeRate = (s) => (s.size > 1 ? Math.min(6, s.size * s.size * 0.65 + 0.35) : 1);      // (a snapped branch's ink: the darkest brown the ground has)
const I_ICE = MATERIAL_INDEX.ice != null ? MATERIAL_INDEX.ice : MATERIAL_INDEX.snow;      // (the wisps of the explorer's wind: powers.js)
// (fire) THE FLAME'S AND THE EMBERS' OWN INK. PAINTER's table of ground inks has sixteen slots and the ground is made
// of fifteen things, so the spare slot is given to fire: nothing the ground is made of is the colour of a flame.
// Until PAINTER fills that slot a tongue comes out in the ground's own brown -- wrong to look at, but nothing breaks,
// and the one-line patch for it is in this session's report.
const I_FLAME = MATERIAL_IDS.length < 16 ? MATERIAL_IDS.length : MATERIAL_INDEX.ash;
const I_SMOKE = MATERIAL_INDEX.ash;      // (smoke: the grey-brown the table already holds for ash)
// (fire) AND THE EMBERS' OWN INK, the slot after the flame's. The painter paints a spark as a different MARK from a
// tongue - tiny, very bright, with a short tail that cools behind it - and from inside the painter nothing else about
// a grain can tell the two apart: it is handed a grain's ink and nothing else, not its size, not its speed, not even
// its age. The painter's table has the slot (render/kitmat.js: the world's blend never touches it).
const I_EMBER = I_FLAME + 1;

export class Loose {
  constructor(particles) {
    this.P = particles;
    this.rng = particles.rng;
    this.vt = {};                        // base terminal speed per kind for the current air
    this._vtKey = '';
    for (const k of LOOSE_KINDS) {
      const b = particles.buffers[k];
      b._life = new Float32Array(b.capacity);
      b._e = LOOSE[k].puff ? new Float32Array(b.capacity * 3) : null;      // velocity of the air parcel it left with
      b.species = LOOSE[k].species;
      this.vt[k] = 1;
    }
    this._carry = new Float64Array(16);  // fractional emissions carried between frames (13, 14, 15: a fire's flame, smoke and embers)
    this.blowingSnow01 = 0;              // 0..1: how hard the wind is moving snow along the ground at the focus (a ground blizzard)
    this.spume01 = 0;                    // 0..1: how much spume the wind is tearing off the sea near the focus
    this.surf01 = 0;                     // 0..1: how hard the sea is breaking on a shore near the focus
    this._gustPrev = 0; this._gustRise = 0;
    this.leafStock01 = 1;                // (P15) 0..1: the share of the loosely held leaves still on the trees round the focus
    this.leafRate = 0;                   // (P15) leaves a second torn off the crowns in the box, and lifted off the floor, last frame
    this.litterRate = 0;
    this._cov = {}; this._crownTop = 0;
    this._shore = new Float32Array(96).fill(1e9); this._shoreN = 0; this._shoreI = 0;   // places found shallow (surf)
    this._seaLevel = -1e9;               // the still level of the liquid near the focus (from sea()), for the spray
    this.saltation01 = 0;                // 0..1: how hard sand is blowing at the focus right now
    this._wade = 0;
    this._T = 288;                       // K: air temperature at the focus (frozen ground glazes, warm ground muds)
  }

  _terminal(bodyId, rho, T) {
    const key = bodyId + ':' + Math.round(rho * 500) + ':' + Math.round(T / 5);
    if (key === this._vtKey) return;
    this._vtKey = key;
    const atm = ATMOSPHERES[bodyId], g = BODIES[bodyId].gravity, mfp = meanFreePath(bodyId, rho, T);
    for (const k of LOOSE_KINDS) {
      let v = terminalVelocity(SPECIES[LOOSE[k].species], g, rho, atm.mu, mfp);
      if (!(v < 1e5)) v = 1e5;            // vacuum: no drag at all
      if (v < 0.004) v = 0.004;           // floats (a leaf in Venus air): drifts with the air
      this.vt[k] = v;
      this.P.buffers[k].fallSpeed = v;
    }
  }

  // Add one particle (frame coordinates: east, up, north). Returns false when the kind is full.
  // mat: the ground it is raised from (index into MATERIAL_IDS), MATERIAL_NONE when it is not.
  emit(kind, x, y, z, vx, vy, vz, sizeMul = 1, lifeMul = 1, mat = MATERIAL_NONE) {
    const b = this.P.buffers[kind], K = LOOSE[kind];
    const cap = PARTICLES.capacity[kind][this.P.quality];
    if (b._n >= cap) return false;
    const i = b._n++, o = i * 3, r = this.rng;
    b.hag[i] = 0;
    b._p[o] = x; b._p[o + 1] = y; b._p[o + 2] = z;
    b._v[o] = vx; b._v[o + 1] = vy; b._v[o + 2] = vz;
    if (b._e) { b._e[o] = vx; b._e[o + 1] = vy; b._e[o + 2] = vz; }
    const s = (0.6 + r() * 0.9) * sizeMul;
    b.size[i] = SPECIES[K.species].d * s;
    // a bigger grain falls faster: vt ~ d in the drag-dominated regime, d^2 in Stokes'; use d^1.2
    b._vt[i] = this.vt[kind] * Math.pow(s, 1.2);
    b._ph[i] = r() * 6.2831853;
    b.turn[i] = 0; b._tp[i] = r() * 6.2831853;
    b._life[i] = (K.life[0] + r() * (K.life[1] - K.life[0])) * lifeMul;
    b.age[i] = 0; b.mat[i] = mat; b.left[i] = b._life[i]; b._alt[i] = 1e9;
    return true;
  }

  // Ground under grid position (x, z) from the near cache: fills _gp { dust, repose, liquid, h,
  // mat (what the ground there is now: an index into MATERIAL_IDS, snow and mud included) }.
  _ground(near, x, z, groundY, wet01, snowDepth) {
    const n = near ? near.nearest(x, z) : -1;
    if (n < 0) { _gp.dust = 0; _gp.repose = 0; _gp.liquid = 0; _gp.h = groundY; _gp.mat = MATERIAL_NONE; return _gp; }
    const c = near.cover, a = n * near.CW;
    _gp.dust = c[a + 2] * (1 - smoothstep(0.05, 0.4, wet01));
    _gp.repose = c[a + 3]; _gp.liquid = c[a + 7];
    _gp.h = near.heightAt(x, z, near.h[n]);
    _gp.mat = near.CW > 9 ? (snowDepth > 0.03 ? I_SNOW : materialNow(c[a + 8], c[a + 9], Math.atan(Math.hypot(near.gx[n], near.gz[n])), wet01, snowDepth, this._T)) : MATERIAL_NONE;
    if (snowDepth > 0.03) { _gp.dust = 0; }
    return _gp;
  }

  // Advance. Arguments as Particles.update, plus:
  //   disturbers (frame.disturbers), sigma (turbulence at the focus, m/s), wet01, snowDepth,
  //   dust01 (airborne dust of the weather), sandy01 (how much loose sand the wind can move),
  //   devils: [{ x, z (grid), radius, speed, up, spin, strength, height }] (features.js) or null.
  update(dt, frame, air, near, fx, fy, fz, groundY, wx, rho, cover, bodyId, g, time, disturbers, sigma, wet01, snowDepth, devils, winds) {
    const P = this.P, rng = this.rng, h = dt > 0.1 ? 0.1 : dt;
    const Rr = PARTICLES.radius;
    this._T = wx ? wx.temperature : 288;
    this._terminal(bodyId, rho, this._T);
    const wp = P._wp, wv = P._wv, ht = P._ht, wtx = P._wtx, wtz = P._wtz;
    // reference wind at the focus (10 m) and at knee height
    const cwe = (wp[15] + wp[18] + wp[27] + wp[30]) * 0.25, cwn = (wp[16] + wp[19] + wp[28] + wp[31]) * 0.25;
    const u10 = Math.hypot(cwe, cwn);
    const carry = this._carry;

    // ---- emitters: the weather and the biome --------------------------------------------------
    if (h > 0) {
      // dust storm / dust haze: fine dust carried through the whole box
      const dust01 = wx ? wx.dustLoad01 || 0 : 0;
      const bd = P.buffers.dust, capD = PARTICLES.capacity.dust[P.quality];
      if (dust01 > 0.03 && rho > 0) {
        // (P10: fed as fast as the wind carries it out of the box, so that the air near the player holds what the
        // storm calls for: at 13 m/s a grain crosses the box in two or three seconds, and at the old rate, a fifth
        // of the load a second, a storm that asked for 700 marks held 190)
        const want = capD * (0.25 + 0.6 * dust01);
        carry[0] += want * h * Math.max(0.2, 0.7 * u10 / (Rr + 6));
        while (carry[0] >= 1 && bd._n < want) {
          carry[0] -= 1;
          // (P7) low: what reads as marks in a dust storm is the dense streamers within a few metres of
          // the ground; the dust above head height is haze (sky.dust), and a puff against the sky is a blot
          const y = groundY + 0.4 + rng() * rng() * 3.2;
          this.emit('dust', fx + (rng() * 2 - 1) * Rr, y, fz + (rng() * 2 - 1) * Rr, cwe * 0.6, 0, cwn * 0.6, 1.4, 1.2, I_DUST);   // carried in from afar: the world's dust
        }
        if (carry[0] > 4) carry[0] = 4;
      }
      // saltation: sand hops where the wind is over the threshold and the ground is loose sand
      const gp = this._ground(near, fx, fz, groundY, wet01, snowDepth);
      const loose = gp.repose > 0 ? gp.dust : 0, matHere = gp.mat;
      const ue = u10 > 1e-6 ? cwe / u10 : 1, un = u10 > 1e-6 ? cwn / u10 : 0;
      this.saltation01 = 0;
      if (loose > 0.2 && rho > 0) {
        const ratio = KICK.impactRatio[bodyId] || KICK.impactRatio.default;
        const thr = saltationThreshold(bodyId, rho) * (1 + (ratio - 1) * clamp01(dust01 * 2));
        const excess = u10 / thr - 0.85;
        if (excess > 0) {
          this.saltation01 = clamp01(excess / 0.7) * loose;
          const capS = PARTICLES.capacity.sand[P.quality];
          carry[1] += capS * clamp01(excess / 0.7) * loose * h / 1.6;
          while (carry[1] >= 1) {
            carry[1] -= 1;
            // (P10) in a streamer: the grains leave the ground in snaking bands, not evenly
            this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const x = _sp[0], z = _sp[1];
            const gy = near ? near.heightAt(x, z, groundY) : groundY;
            // launched at 50 degrees or so with a speed of a few threshold friction velocities
            const vu = (0.5 + rng() * 1.1) * Math.sqrt(9 / g) * (0.7 + 0.5 * Math.min(2, excess));
            if (!this.emit('sand', x, gy + 0.01, z, ue * vu * 0.6, vu, un * vu * 0.6, 1, 1, matHere)) break;
          }
          if (carry[1] > 4) carry[1] = 4;
          // and the fines the hopping sand knocks loose are lifted as dust, over the streamers
          carry[2] += capD * 0.25 * clamp01(excess) * loose * h / 4;
          while (carry[2] >= 1) {
            carry[2] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const gy = near ? near.heightAt(_sp[0], _sp[1], groundY) : groundY;
            this.emit('dust', _sp[0], gy + rng() * 0.6, _sp[1], cwe * 0.3, 0.4 + rng(), cwn * 0.3, 1, 1, matHere);
          }
        }
      }
      // blowing snow (P10): dry snow on the ground is moved by the wind as sand is, in the same
      // streamers: a skim of hopping grains (the sand kind, of snow: its ink is snow's) and over it
      // the powder the wind keeps aloft (the dust kind, of snow), knee deep in a ground blizzard
      this.blowingSnow01 = 0;
      if (snowDepth > 0.01 && rho > 0.05) {
        const pr = wx && wx.precipitation;
        const tr = snowTransport01(u10, wet01, pr && pr.frozen01 > 0.5 ? pr.intensity01 || 0 : 0) * smoothstep(275, 271, this._T);
        if (tr > 0.02) {
          this.blowingSnow01 = tr;
          carry[7] += PARTICLES.capacity.sand[P.quality] * BLOWN.snowRate * tr * h / 1.6;
          while (carry[7] >= 1) {
            carry[7] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const gy = near ? near.heightAt(_sp[0], _sp[1], groundY) : groundY;
            // a snow grain hops lower than sand (the bed is soft): centimetres, to knee height in a gale
            const vu = (0.3 + rng() * 0.8) * Math.sqrt(9 / g) * (0.5 + 0.7 * tr);
            if (!this.emit('sand', _sp[0], gy + 0.01, _sp[1], ue * (vu + u10 * 0.15), vu, un * (vu + u10 * 0.15), 1, 1, I_SNOW)) break;
          }
          if (carry[7] > 4) carry[7] = 4;
          carry[8] += capD * 0.35 * tr * tr * h / 4;
          while (carry[8] >= 1) {
            carry[8] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const gy = near ? near.heightAt(_sp[0], _sp[1], groundY) : groundY;
            this.emit('dust', _sp[0], gy + 0.05 + rng() * rng() * 1.1, _sp[1], cwe * 0.5, 0.2 + 0.5 * rng(), cwn * 0.5, 1, 1, I_SNOW);
          }
          if (carry[8] > 4) carry[8] = 4;
        }
      }
      // hail in the core of a strong storm
      const hail01 = wx && wx.precipitation ? wx.precipitation.hail01 || 0 : 0;
      if (hail01 > 0) {
        carry[3] += PARTICLES.capacity.hail[P.quality] * hail01 * h / 1.5;
        while (carry[3] >= 1) { carry[3] -= 1; if (!this.emit('hail', fx + (rng() * 2 - 1) * Rr, groundY + PARTICLES.height * (0.5 + 0.5 * rng()), fz + (rng() * 2 - 1) * Rr, cwe, -this.vt.hail, cwn)) break; }
      }
      // the biome: leaves fall faster in gusts, spores and ash drift all the time
      if (rho > 0.05) {
        // (P10) a few at a time in a breeze, a flock when a gust front comes through: what is torn off
        // goes with the fourth power of the wind where the trees stand (u10 here is the gusty wind at the
        // focus), and more while that wind is rising (it strips what the lull left hanging)
        const rise = Math.max(0, (u10 - this._gustPrev) / h); this._gustPrev = u10;
        this._gustRise += (rise - this._gustRise) * Math.min(1, h / 0.4);
        const wl = u10 / BLOWN.leafWind;
        const tornF = Math.min(BLOWN.leafTornMax, BLOWN.leafCalm * (cover.leaves || 0) + wl * wl * wl * wl * (1 + BLOWN.leafGust * Math.min(1.5, this._gustRise)));
        // (P15) the stock of loose leaves: drained by what the wind tears off, restored in a calm
        const stock = BLOWN.leafStock * (1 + (BLOWN.leafAutumn - 1) * clamp01(((cover.leaves || 0) - 0.25) / 0.75));
        this.leafStock01 += (-BLOWN.leafFlux * tornF * Math.min(1, 4 * (cover.leaves || 0)) * this.leafStock01 / stock + (1 - this.leafStock01) / BLOWN.leafRecover) * h;
        if (this.leafStock01 < 0) this.leafStock01 = 0;
        this.leafRate = 0; this.litterRate = 0;
        {
          // (P15) candidates at the most the box could shed, each kept by what is there: the crowns' closure and leafiness
          // at that place and the wind there (the 4 x 4 patch, gusts and all) against the most it could be
          const A = 4 * Rr * Rr, cov = this._cov;
          carry[4] += BLOWN.leafFlux * BLOWN.leafTornMax * this.leafStock01 * A * h;
          if (carry[4] > 400) carry[4] = 400;
          let kept = 0;
          while (carry[4] >= 1) {
            carry[4] -= 1;
            const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
            if (!air.coverNear(x, z, cov)) continue;
            const lv = cov.leaves || 0, lf = Math.min(1, 4 * lv) * cov.canopy01;
            if (!(lf > 0.005)) continue;
            const ul = this._patchSpeed(wp, x - fx, z - fz) / BLOWN.leafWind, ul4 = ul * ul * ul * ul;
            const torn = Math.min(BLOWN.leafTornMax, BLOWN.leafCalm * lv + ul4 * (1 + BLOWN.leafGust * Math.min(1.5, this._gustRise)));
            if (rng() * BLOWN.leafTornMax >= torn * lf) continue;
            const top = Math.max(3, cov.canopyHeight || 6), gy = near ? near.heightAt(x, z, groundY) : groundY;
            this._crownTop = top;
            kept++;
            if (!this.emit('leaves', x, gy + top * (0.45 + 0.55 * rng()), z, cwe * 0.3, 0, cwn * 0.3)) { carry[4] = 0; break; }
          }
          // (P15) inflow: leaves shed upwind of the box arrive through its upwind side
          const keptBox = kept;
          if (u10 > 0.5) {
            const vs = this.vt.leaves, topR = Math.max(3, cover.canopyHeight || 0, this._crownTop || 0);
            const Uc = Math.max(0.5, this._airAt(fx - ue * Rr, fz - un * Rr, topR * 0.7, _aw));
            const Dmax = Math.min(BLOWN.leafFetch, topR * Uc / Math.max(0.05, vs)), wid = 2 * Rr * (Math.abs(ue) + Math.abs(un));
            carry[12] += BLOWN.leafFlux * BLOWN.leafTornMax * this.leafStock01 * wid * Dmax * h;
            if (carry[12] > 400) carry[12] = 400;
            while (carry[12] >= 1) {
              carry[12] -= 1;
              // a point of the box carried back upwind to its side: the side's points as the wind crosses them
              let x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
              const se = ue > 1e-6 ? (x - fx + Rr) / ue : ue < -1e-6 ? (x - fx - Rr) / ue : 1e9, sn = un > 1e-6 ? (z - fz + Rr) / un : un < -1e-6 ? (z - fz - Rr) / un : 1e9;
              const sb = Math.min(se, sn) - 0.01; x -= ue * sb; z -= un * sb;
              const D = rng() * Dmax;
              // what the ground upwind is like, as far as the grid knows it (else at the side)
              if (!air.coverNear(x - ue * D, z - un * D, cov) && !air.coverNear(x, z, cov)) continue;
              const lv = cov.leaves || 0, lf = Math.min(1, 4 * lv) * cov.canopy01;
              if (!(lf > 0.005)) continue;
              const ul = this._patchSpeed(wp, x - fx, z - fz) / BLOWN.leafWind, ul4 = ul * ul * ul * ul;
              const torn = Math.min(BLOWN.leafTornMax, BLOWN.leafCalm * lv + ul4 * (1 + BLOWN.leafGust * Math.min(1.5, this._gustRise)));
              if (rng() * BLOWN.leafTornMax >= torn * lf) continue;
              // shed at h0 over there; it comes down at its fall speed while the wind at the height it is passing carries it
              const top = Math.max(3, cov.canopyHeight || 6), h0 = top * (0.45 + 0.55 * rng());
              const U0 = Math.max(0.3, this._airAt(x, z, h0 * 0.6, _aw)), hz = h0 - vs * D / U0;
              if (hz < 0.15) continue;
              const gy = near ? near.heightAt(x, z, groundY) : groundY;
              this._airAt(x, z, hz, _aw);
              kept++;
              if (!this.emit('leaves', x, gy + hz, z, _aw[0], 0, _aw[1])) { carry[12] = 0; break; }
            }
          }
          this.leafRate = h > 0 ? kept / h : 0; this._inRate = h > 0 ? (kept - keptBox) / h : 0;
          // (P15) litter off the floor, in the streamers, where the wind at a metre is over litterFrom
          const dry = 1 - smoothstep(0.1, 0.5, wet01);
          if (dry > 0.02 && snowDepth < 0.01) {
            carry[11] += BLOWN.leafLitter * A * dry * h;
            if (carry[11] > 200) carry[11] = 200;
            let lk = 0;
            while (carry[11] >= 1) {
              carry[11] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
              const x = _sp[0], z = _sp[1];
              if (!air.coverNear(x, z, cov)) continue;
              const lf = Math.min(1, 4 * (cov.leaves || 0)) * (0.3 + 0.7 * cov.canopy01);
              const u1 = this._airAt(x, z, 1, _aw) + sigma * (rng() * 2 - 1) * 1.7;   // (the sweeps: sigma is the turbulence at the focus, near the ground)
              const ex = (u1 - BLOWN.litterFrom) / (BLOWN.litterFull - BLOWN.litterFrom);
              if (!(ex > 0) || rng() >= lf * (ex > 1 ? 1 : ex)) continue;
              const gy = near ? near.heightAt(x, z, groundY) : groundY, up = 0.6 + rng() * (1.2 + 1.5 * Math.min(1, ex));
              lk++;
              if (!this.emit('leaves', x, gy + 0.05, z, _aw[0] * 0.5, up, _aw[1] * 0.5, 0.9)) { carry[11] = 0; break; }
            }
            this.litterRate = h > 0 ? lk / h : 0;
          }
        }
        if ((cover.spores || 0) > 0.01) {
          carry[5] += PARTICLES.capacity.spores[P.quality] * cover.spores * h / 12;
          while (carry[5] >= 1) { carry[5] -= 1; if (!this.emit('spores', fx + (rng() * 2 - 1) * Rr, groundY + 0.2 + rng() * rng() * 9, fz + (rng() * 2 - 1) * Rr, cwe * 0.3, 0.1 * rng(), cwn * 0.3)) break; }
        }
        if ((cover.ash || 0) > 0.01) {
          carry[6] += PARTICLES.capacity.ash[P.quality] * cover.ash * h / 12;
          while (carry[6] >= 1) { carry[6] -= 1; if (!this.emit('ash', fx + (rng() * 2 - 1) * Rr, groundY + PARTICLES.height * rng(), fz + (rng() * 2 - 1) * Rr, cwe * 0.5, -0.3, cwn * 0.5)) break; }
        }
      }
      // dust devils: a helix of dust fed at the foot of each column
      if (devils) {
        for (let k = 0; k < devils.count; k++) {
          const D = devils[k];
          if (!(D.strength > 0.05) || Math.abs(D.x - fx) > Rr + 30 || Math.abs(D.z - fz) > Rr + 30) continue;
          let n = 110 * D.strength * h + rng();
          const dm = this._ground(near, D.x, D.z, groundY, wet01, snowDepth).mat;       // what its foot stands on
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, r = D.radius * (0.3 + 0.9 * rng());
            const x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r;
            const gy = near ? near.heightAt(x, z, groundY) : groundY;
            if (!this.emit('dust', x, gy + rng() * 1.5, z, -Math.sin(a) * D.speed * D.spin, D.up * 0.5, Math.cos(a) * D.speed * D.spin, 1.6, 1.5, dm)) break;
          }
        }
      }
      // the wind the explorer makes (powers.js) lifts what lies loose under it
      if (winds && winds.count > 0) this._windLift(winds, h, frame, air, near, fx, fz, groundY, wet01, snowDepth);
      // THE FIRE THE EXPLORER HAS LIT (fire.js): its flame, its smoke and its embers (see FLAME above). The list
      // reaches us the way the explorer's wind reaches the rain -- the game hands it to the physics, the physics puts
      // it on the particle system (index.js: `particles.fires = fires`), and it is there only while something is
      // alight. So with nothing burning anywhere this whole thing is the one comparison on the next line.
      if (P.fires) this._fire(P.fires, h, frame, near, fx, fz, Rr);
    }

    // ---- emitters: bodies and jets ---------------------------------------------------------------
    if (disturbers && h > 0) {
      for (let k = 0; k < disturbers.length; k++) {
        const D = disturbers[k];
        if (!D || !D.p) continue;
        const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z);
        if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
        const gp = this._ground(near, x, z, groundY, wet01, snowDepth);
        const r = Math.hypot(D.p.x, D.p.y, D.p.z), hgt = r - (frame.r0 + gp.h);
        const vx = D.v ? D.v.x * frame.ex + D.v.y * frame.ey + D.v.z * frame.ez : 0;
        const vz = D.v ? D.v.x * frame.nx + D.v.y * frame.ny + D.v.z * frame.nz : 0;
        const sp = Math.hypot(vx, vz);
        if (D.kind === 'explorer') {
          const grounded = D.grounded != null ? D.grounded : hgt < 0.3;
          if (gp.liquid > 0.05) {
            // wading: droplets thrown up by the legs, and a ring on the water now and then
            if (grounded && sp > 0.6) {
              // ((P26) see WADE: per metre waded, with v^2 and the depth; thrown at about the legs' speed)
              const dk = Math.min(1, Math.max(1 / 3, gp.liquid / WADE.depthFull)), vo = WADE.out + WADE.outV * sp, vu = WADE.up + WADE.upV * sp;
              let n = (WADE.perMetre + WADE.perV2 * sp * sp) * dk * sp * h + rng();
              while (n >= 1) { n -= 1; const a = rng() * 6.2831853; if (!this.emit('spray', x + Math.cos(a) * 0.3, gp.h + gp.liquid + 0.02, z + Math.sin(a) * 0.3, vx * 0.5 + Math.cos(a) * vo, vu * (0.6 + 0.8 * rng()), vz * 0.5 + Math.sin(a) * vo, 1, 1, gp.mat)) break; }
              this._wade += h * sp;
              // ((M4) see WADE.ringEvery: a ring at each leg, the wader's own)
              if (this._wade > WADE.ringEvery) {
                this._wade = 0; const k = WADE.ringSide / sp, st = clamp01(0.45 + sp / 4);
                P._event(frame, x - vz * k, gp.h + gp.liquid, z + vx * k, EVENT.ripple, st, 0.3, WADE.ownCalm);
                P._event(frame, x + vz * k, gp.h + gp.liquid, z - vx * k, EVENT.ripple, st, 0.3, WADE.ownCalm);
              }
            } else if (!grounded && hgt > gp.liquid - 2.5 && hgt < gp.liquid + 0.4) {
              // ((M4) afloat: the swimmer's rings and its collar, see WADE.ringEvery)
              this._wade += h * sp; this._tread = (this._tread || 0) + h;
              if (this._wade > WADE.ringEvery || this._tread > WADE.treadEvery) {
                this._wade = 0; this._tread = 0;
                const st = clamp01(0.5 + sp / 4), dx = sp > 0.2 ? vx / sp : 1, dz = sp > 0.2 ? vz / sp : 0, y = gp.h + gp.liquid;
                P._event(frame, x - dz * WADE.ringSide, y, z + dx * WADE.ringSide, EVENT.ripple, st, 0.3, WADE.ownCalm);
                P._event(frame, x + dz * WADE.ringSide, y, z - dx * WADE.ringSide, EVENT.ripple, st, 0.3, WADE.ownCalm);
                P._event(frame, x - dx * 0.5, y, z - dz * 0.5, EVENT.ripple, st * 0.8, 0.3, WADE.ownCalm);
              }
              let n = Math.max(WADE.collarRate, WADE.swimSpray * sp) * h + rng();
              while (n >= 1) { n -= 1; const a = rng() * 6.2831853; if (!this.emit('spray', x + Math.cos(a) * 0.35, gp.h + gp.liquid + 0.03, z + Math.sin(a) * 0.35, vx * 0.6 + Math.cos(a) * WADE.collarOut, WADE.collarUp * (0.6 + 0.8 * rng()), vz * 0.6 + Math.sin(a) * WADE.collarOut, 1, 1, gp.mat)) break; }
            }
            continue;
          }
          const powder = snowDepth > 0.03;
          const kick = D.kick != null ? D.kick : gp.dust * clamp01(0.15 + sp / 6);
          const dusty = powder ? 0.5 : kick;
          if (!grounded || dusty < 0.02) continue;
          if (!powder && gp.dust < KICK.stepDust) continue;      // (P17) a sward or bare rock: no puff (KICK.stepDust)
          // behind the heels: back along the motion, upward, a little sideways
          let n = KICK.perMetre * dusty * sp * h + KICK.landing * (powder ? 0.5 : gp.dust) * (D.impact || 0) * h / 0.1 + rng() * 0.999;
          const kind = powder ? 'snow' : 'dust';
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, s = rng();
            const ex = -vx * 0.25 + Math.cos(a) * 0.6 * s, ez = -vz * 0.25 + Math.sin(a) * 0.6 * s;
            const eu = KICK.up * (0.4 + rng()) * Math.pow(9 / g, 0.25);
            if (powder) { this._emitSnow(x + Math.cos(a) * 0.2, gp.h + 0.05, z + Math.sin(a) * 0.2, ex * 1.5, eu * 2.4, ez * 1.5); this._emitSnow(x - Math.cos(a) * 0.2, gp.h + 0.05, z - Math.sin(a) * 0.2, -ex, eu * 1.8, -ez); }
            else {
              this.emit(kind, x + Math.cos(a) * 0.2, gp.h + 0.03, z + Math.sin(a) * 0.2, ex, eu, ez, 1, 1, gp.mat);
              // coarse grains too where the ground is granular: they fall straight back
              if (gp.repose > 0 && rng() < 0.5) this.emit('sand', x + Math.cos(a) * 0.15, gp.h + 0.03, z + Math.sin(a) * 0.15, ex * 1.4, eu * 1.3, ez * 1.4, 1, 0.5, gp.mat);
            }
          }
        } else if (D.kind === 'jet' || D.kind === 'downwash') {
          // the jet's footprint on the ground (as in flora.js): thrust over the area it has spread to
          const R0 = D.radius || 0.4, R = R0 + 0.25 * Math.max(0, hgt);
          const q = (D.strength || 0) / (Math.PI * R * R);                // Pa
          if (q < 8) continue;
          const wetGround = gp.liquid > 0.05;
          const loose = wetGround ? 1 : (snowDepth > 0.03 ? 0.6 : gp.dust);
          if (loose < 0.02) continue;
          // grains leave at the speed the jet's air has along the ground; in a vacuum the exhaust
          // is its own medium and the sheet is thrown out fast and flat
          const vj = rho > 0.01 ? Math.min(KICK.jetSpeedMax, Math.sqrt(2 * q / rho)) : KICK.jetSpeedMax * Math.min(1, q / 200 + 0.3);
          let n = KICK.jetRate * loose * clamp01(q / 300) * (D.kind === 'downwash' ? 2.5 : 1) * h + rng() * 0.999;
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, rr = R * (0.5 + 0.7 * rng());
            const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
            const gy = near ? near.heightAt(px, pz, gp.h) : gp.h;
            const s = vj * (0.5 + 0.6 * rng()), el = rho > 0.01 ? 0.25 + 0.5 * rng() : 0.08 + 0.2 * rng();
            if (wetGround) this.emit('spray', px, gy + gp.liquid + 0.02, pz, Math.cos(a) * s, s * (0.5 + el), Math.sin(a) * s, 1, 1, gp.mat);
            else if (snowDepth > 0.03) this._emitSnow(px, gy + 0.05, pz, Math.cos(a) * s, s * el, Math.sin(a) * s);
            else if (gp.repose > 0 && rng() < 0.35) this.emit('sand', px, gy + 0.02, pz, Math.cos(a) * s, s * el, Math.sin(a) * s, 1, 0.6, gp.mat);
            else this.emit('dust', px, gy + 0.03, pz, Math.cos(a) * s, s * el, Math.sin(a) * s, 1, 1, gp.mat);
          }
          if (wetGround) { this._wade += h * 3; if (this._wade > 0.5) { this._wade = 0; P._event(frame, x, gp.h + gp.liquid, z, EVENT.ripple, 1, R); } }
        }
      }
    }

    // ---- motion ---------------------------------------------------------------------------------------
    // (P17) each kind is stepped by its own method (_move). Inside this long update V8 optimised the loops only on the
    // fly (on-stack replacement) and never the whole: per particle, what it called stayed calls, each number handed
    // over in a fresh heap box (half a megabyte of garbage a frame in a blizzard, measured). A method of one loop is
    // optimised whole and its lookups inlined. The arithmetic is the same, line for line.
    const blown = winds && winds.count > 0 ? winds : null;
    for (let kk = 0; kk < LOOSE_KINDS.length; kk++) this._move(LOOSE_KINDS[kk], h, frame, air, near, fx, fz, groundY, g, sigma, devils, blown);
  }

  // One kind's step (see update, "motion").
  _move(name, h, frame, air, near, fx, fz, groundY, g, sigma, devils, winds) {
    const P = this.P, Rr = PARTICLES.radius, wv = P._wv, ht = P._ht, wtx = P._wtx, wtz = P._wtz;
    const K = LOOSE[name], b = P.buffers[name];
    b.origin.x = frame.ox; b.origin.y = frame.oy; b.origin.z = frame.oz;
    let alive = b._n;
    if (alive === 0) { b.count = 0; return; }
    const Pp = b._p, V = b._v, VT = b._vt, PH = b._ph, LF = b._life, AG = b.age, SZ = b.size, EJ = b._e, MT = b.mat, LT = b.left, HG = b.hag;
    const turb = K.turb * sigma, puff = K.puff || 0;
    const TU = K.tumble > 0 ? b.turn : null, TP = b._tp, ro0 = BLOWN.leafRo[0], roD = BLOWN.leafRo[1] - ro0, rk0 = BLOWN.leafRock[0], rkD = BLOWN.leafRock[1] - rk0;
    const seaLevel = this._seaLevel, overSea = name === 'spray' && seaLevel > -1e8;
    for (let i = 0; i < alive; i++) {
      const o = i * 3;
      let x = Pp[o], y = Pp[o + 1], z = Pp[o + 2];
      const age = AG[i] + h;
      let dead = age > LF[i] || Math.abs(x - fx) > Rr + 6 || Math.abs(z - fz) > Rr + 6;
      let vx = V[o], vy = V[o + 1], vz = V[o + 2];
      let left = LF[i] - age;                                   // what is left of its life
      if (!dead) {
        // wind at the particle
        // (P12: between the four grid nodes round it, each with its own profile; see particles.js)
        let u = (x - wtx) * 0.0625, v = (z - wtz) * 0.0625;
        u = u < 0 ? 0 : u > 3.999 ? 3.999 : u; v = v < 0 ? 0 : v > 3.999 ? 3.999 : v;
        const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, pn = iv * 5 + iu;
        let hz = y - groundY;
        // (spray rides the wind over the sea, which may lie below the ground the focus stands on)
        if (overSea && y - seaLevel > hz) hz = y - seaLevel;
        hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
        const ih = hz | 0, fh = hz - ih, t0 = pn * 25 + ih, a0 = pn * 2;
        const h00 = (ht[t0] + (ht[t0 + 1] - ht[t0]) * fh) * (1 - fu) * (1 - fv), h10 = (ht[t0 + 25] + (ht[t0 + 26] - ht[t0 + 25]) * fh) * fu * (1 - fv);
        const h01 = (ht[t0 + 125] + (ht[t0 + 126] - ht[t0 + 125]) * fh) * (1 - fu) * fv, h11 = (ht[t0 + 150] + (ht[t0 + 151] - ht[t0 + 150]) * fh) * fu * fv;
        let we = wv[a0] * h00 + wv[a0 + 2] * h10 + wv[a0 + 10] * h01 + wv[a0 + 12] * h11;
        let wn = wv[a0 + 1] * h00 + wv[a0 + 3] * h10 + wv[a0 + 11] * h01 + wv[a0 + 13] * h11;
        let wu = 0;
        const vt = VT[i], ph = PH[i];
        // (P17: fsin / fcos, util.js: within 6e-8 of Math.sin and 2 to 3 times faster; and sqrt for Math.hypot, which is
        // twenty times slower in V8: the same arithmetic, half the cost of this loop at thousands of leaves)
        if (turb > 0) { const a = ph + age * (1.1 + ph * 0.2); we += fcos(a) * turb; wn += fsin(a * 1.27) * turb; wu += fsin(a * 0.71 + 1.3) * turb * 0.4 * Math.min(1, hz); }
        // the parcel of air it was thrown up with, mixing away
        if (EJ && age < puff * 4) { const k = Math.exp(-age / puff); we += EJ[o] * k; wu += EJ[o + 1] * k; wn += EJ[o + 2] * k; }
        if (K.flutter > 0) { const fl = Math.min(1, K.flutter * vt), a = ph * 3 + age * (2.2 + ph * 0.4); we += fcos(a) * fl; wn += fsin(a * 1.3) * fl; }
        // a dust devil nearby: swirl, inflow and updraught (Rankine vortex)
        if (devils) for (let d = 0; d < devils.count; d++) {
          const D = devils[d];
          const dx = x - D.x, dz = z - D.z, r = Math.hypot(dx, dz);
          if (r > D.radius * 6 || hz > D.height || !(D.strength > 0)) continue;
          const rc = D.radius, f = (r < rc ? r / rc : rc / r) * D.strength, ir = r > 1e-3 ? 1 / r : 0;
          we += (-dz * ir * D.spin - dx * ir * 0.35) * D.speed * f;
          wn += (dx * ir * D.spin - dz * ir * 0.35) * D.speed * f;
          wu += D.up * D.strength * (r < rc * 1.5 ? 1 : rc * 1.5 / r);
        }
        // the wind the explorer makes (powers.js): a gust carries it, a stilled place lets it fall, a gathered ball holds it
        if (winds && powerWind(winds, x, z, hz, _pwl)) { we = we * _pwl[3] + _pwl[0]; wn = wn * _pwl[3] + _pwl[1]; wu = wu * _pwl[3] + _pwl[2]; }
        // weight, then drag toward the air (implicit; no drag at all when vt is "infinite")
        let rx = vx - we, ry = vy - g * h - wu, rz = vz - wn;
        const sl = Math.sqrt(rx * rx + ry * ry + rz * rz), m = vt < 1e4 ? 1 / (1 + g / (vt * vt) * sl * h) : 1;
        rx *= m; ry *= m; rz *= m;
        vx = we + rx; vy = wu + ry; vz = wn + rz;
        x += vx * h; y += vy * h; z += vz * h;
        // (P15) a leaf turns about its long side at its slip through the air (BLOWN.leafRo): end over end, or rocking
        // (P17: own in [0, 1), so `own * k % 1` is own * k less its floor, exactly; the slip is the one just damped)
        if (TU) {
          const own = ph * 0.15915494, f7 = own * 7.31, w0 = 2 * (ro0 + roD * (f7 - Math.floor(f7))) * sl * m / (0.6 * SZ[i]), w = w0 > BLOWN.leafTurnMax ? BLOWN.leafTurnMax : w0;
          const f3 = own * 3.7, f13 = own * 13.1;
          if (f3 - Math.floor(f3) < K.tumble) { let t = TP[i] + (f13 - Math.floor(f13) < 0.5 ? -w : w) * h; t -= 6.2831853 * Math.floor(t / 6.2831853); TP[i] = t; TU[i] = t; }
          else { const f5 = own * 5.3; let t = TP[i] + 0.5 * w * h; t -= 6.2831853 * Math.floor(t / 6.2831853); TP[i] = t; TU[i] = (rk0 + rkD * (f5 - Math.floor(f5))) * fsin(t); }
        }
        // the ground
        HG[i] = y - groundY;
        if (y < groundY + 4) {
          // (P17: TerrainGrid.groundQ, through a scratch array: nothing boxed, nothing to collect)
          const GQ = _gq; GQ[0] = x; GQ[1] = z;
          let gy = NaN, lqN = NaN;
          if (near) { near.groundQ(GQ); gy = GQ[2]; lqN = GQ[3]; }
          if (gy !== gy) { air.terrain.groundQ(GQ); gy = GQ[2] === GQ[2] ? GQ[2] : groundY; }
          HG[i] = y > gy ? y - gy : 0;
          // a drop that falls back into the liquid is gone (it used to sink to the bed, unseen)
          if (overSea && vy < 0 && near) { const lq = lqN; if (lq === lq && lq > gy) { if (y < lq - 0.03) dead = true; else HG[i] = y - lq; } }
          if (y <= gy) {
            if (K.ground === 1 && vy < 0) {
              // saltation: the grain rebounds with about half its speed at a steeper angle,
              // as long as the wind keeps feeding it (otherwise it comes to rest)
              const s = Math.hypot(vx, vy, vz) * K.rest;
              if (s > 0.25 && age < LF[i] - 0.2) { y = gy + 0.005; const hs = Math.hypot(vx, vz) || 1; vx = vx / hs * s * 0.75; vz = vz / hs * s * 0.75; vy = s * 0.65; } else dead = true;
            } else if (K.ground === 2 && vy < 0) {
              if (-vy > 2 && PH[i] < 100) { y = gy + 0.01; vy = -vy * K.rest; vx *= 0.6; vz *= 0.6; PH[i] += 100; P._event(frame, x, gy, z, EVENT.bounce, clamp01(-vy / 8), SZ[i]); } else dead = true;
            } else dead = true;
          } else if (K.lands) {
            // it will land first: its height over the ground, at the rate that has been closing (particles.js)
            const alt = y - gy, a0 = b._alt[i]; b._alt[i] = alt;
            const rate = a0 < 1e8 ? b._rate[i] + ((a0 - alt) / h - b._rate[i]) * (h < 0.15 ? h / 0.15 : 1) : -vy; b._rate[i] = rate;
            if (rate > 0.05) { const tl = alt / rate; if (tl < left) left = tl; }
          }
        }
      }
      if (dead) {
        alive--;
        if (i < alive) {
          const s = alive * 3;
          Pp[o] = Pp[s]; Pp[o + 1] = Pp[s + 1]; Pp[o + 2] = Pp[s + 2]; V[o] = V[s]; V[o + 1] = V[s + 1]; V[o + 2] = V[s + 2];
          VT[i] = VT[alive]; PH[i] = PH[alive]; LF[i] = LF[alive]; AG[i] = AG[alive]; SZ[i] = SZ[alive]; MT[i] = MT[alive]; LT[i] = LT[alive]; HG[i] = HG[alive]; b._alt[i] = b._alt[alive]; b._rate[i] = b._rate[alive]; b.turn[i] = b.turn[alive]; TP[i] = TP[alive];
          if (EJ) { EJ[o] = EJ[s]; EJ[o + 1] = EJ[s + 1]; EJ[o + 2] = EJ[s + 2]; }
          i--;
        }
        continue;
      }
      Pp[o] = x; Pp[o + 1] = y; Pp[o + 2] = z; V[o] = vx; V[o + 1] = vy; V[o + 2] = vz; AG[i] = age; LT[i] = left;
    }
    b._n = alive; b.count = alive;
    publish(b, frame, alive);                       // (on the curved ground: particles.js)
  }

  // (P15) The reference wind's speed (m/s, gusts and the lee of trees in it) at (dx, dz) from the focus, bilinear on the
  // 4 x 4 patch round it (nodes 16 m apart at -24, -8, 8, 24 m: particles.js).
  _patchSpeed(wp, dx, dz) {
    let u = (dx + 24) / 16, v = (dz + 24) / 16;
    u = u < 0 ? 0 : u > 2.999 ? 2.999 : u; v = v < 0 ? 0 : v > 2.999 ? 2.999 : v;
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j, a = (j * 4 + i) * 3, b = a + 12;
    const s00 = Math.hypot(wp[a], wp[a + 1]), s10 = Math.hypot(wp[a + 3], wp[a + 4]), s01 = Math.hypot(wp[b], wp[b + 1]), s11 = Math.hypot(wp[b + 3], wp[b + 4]);
    return (s00 * (1 - fu) + s10 * fu) * (1 - fv) + (s01 * (1 - fu) + s11 * fu) * fv;
  }

  // (P15) The mean wind a particle rides at grid position (x, z), hz m over the ground: the same lookup as the motion's
  // (the 5 x 5 nodes, each with its own profile). Writes we, wn into o; returns the speed.
  _airAt(x, z, hz, o) {
    const P = this.P, wv = P._wv, ht = P._ht;
    let u = (x - P._wtx) * 0.0625, v = (z - P._wtz) * 0.0625;
    u = u < 0 ? 0 : u > 3.999 ? 3.999 : u; v = v < 0 ? 0 : v > 3.999 ? 3.999 : v;
    const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, pn = iv * 5 + iu;
    hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
    const ih = hz | 0, fh = hz - ih, t0 = pn * 25 + ih, a0 = pn * 2;
    const h00 = (ht[t0] + (ht[t0 + 1] - ht[t0]) * fh) * (1 - fu) * (1 - fv), h10 = (ht[t0 + 25] + (ht[t0 + 26] - ht[t0 + 25]) * fh) * fu * (1 - fv);
    const h01 = (ht[t0 + 125] + (ht[t0 + 126] - ht[t0 + 125]) * fh) * (1 - fu) * fv, h11 = (ht[t0 + 150] + (ht[t0 + 151] - ht[t0 + 150]) * fh) * fu * fv;
    o[0] = wv[a0] * h00 + wv[a0 + 2] * h10 + wv[a0 + 10] * h01 + wv[a0 + 12] * h11;
    o[1] = wv[a0 + 1] * h00 + wv[a0 + 3] * h10 + wv[a0 + 11] * h01 + wv[a0 + 13] * h11;
    return Math.hypot(o[0], o[1]);
  }

  // How much grid position (x, z) is in a streamer now: 0 between the bands .. 1 in the middle of one.
  // (ue, un): unit vector of the wind; u10: its speed. The bands lie along the wind, travel with it
  // at BLOWN.streamSpeed of its speed, and snake from side to side.
  streamAt(x, z, time, ue, un, u10) {
    const al = x * ue + z * un - BLOWN.streamSpeed * u10 * time, ac = z * ue - x * un;
    const snake = BLOWN.streamSnake * noise3(al / BLOWN.streamWave, ac / 60, time * 0.03, 911);
    const v = noise3(al / BLOWN.streamLength, (ac + snake) / BLOWN.streamWidth, time * 0.04, 733);     // (a band lasts some ten seconds)
    return smoothstep(0.02, 0.4, v);
  }

  // A place within R of (fx, fz) to launch a grain: in a streamer (up to six tries; the last one stands).
  _streamPoint(fx, fz, R, time, ue, un, u10) {
    const rng = this.rng;
    for (let k = 0; k < 6; k++) {
      _sp[0] = fx + (rng() * 2 - 1) * R; _sp[1] = fz + (rng() * 2 - 1) * R;
      if (this.streamAt(_sp[0], _sp[1], time, ue, un, u10) > rng()) break;
    }
    return _sp;
  }

  // The sea's own spray (P10): spume torn off breaking crests by the wind, and surf on a shore.
  // Call after water.update. water: the Water (water.js); near: the near ground cache (for the
  // depth); (cwe, cwn): the wind at 10 m (frame axes); g: gravity; air: the wind grid (its coarse
  // ground says what is land and what is sea beyond the near cache).
  sea(dt, water, near, fx, fz, cwe, cwn, g, air = null) {
    const h = dt > 0.1 ? 0.1 : dt, P = this.P, rng = this.rng, carry = this._carry;
    this.spume01 = 0; this.surf01 = 0;
    this._seaLevel = water && water.present ? water.level : -1e9;
    if (!(h > 0) || !water || !water.present || !(water.significant > 0.03)) return;
    const Rr = PARTICLES.radius, capY = PARTICLES.capacity.spray[P.quality];
    // (P18) the sea HERE (water.js localAt: the sea map's local sea, the reference's without a map): a sheltered bay
    // breaks less than the open shore beside it
    const L = water.localAt ? water.localAt(fx, fz, _wl) : null;
    const u10 = Math.hypot(cwe, cwn), Hs = L ? L.significant : water.significant, lvl = water.level;
    const dx = L ? L.dirx : water.dir[0], dz = L ? L.dirz : water.dir[1], c = water.speed || 0;
    // spume: the wind over a breaking sea
    // (a sea, not a puddle: nothing is torn off a chop under a hand high)
    const sp = smoothstep(BLOWN.spumeFrom, BLOWN.spumeFull, u10) * ((L ? L.foamAt : water.foamAt) < 1e8 ? 1 : 0) * smoothstep(0.2, 0.6, Hs);
    this.spume01 = sp;
    if (sp > 0) {
      carry[9] += capY * sp * h / 2.2;
      // look for breaking water at up to 64 places a frame; each found sheds a sheet of drops
      for (let k = 0; k < 64 && carry[9] >= 1; k++) {
        const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
        water.surfaceAt(x, z, _sf);
        if (!(_sf.foam01 > 0.25)) continue;
        if (this._depthAt(near, air, x, z) < 0.05) continue;                // dry ground here (or nothing known)
        const y = lvl + _sf.height;
        let n = 3 + Math.floor(rng() * 6 * (0.5 + sp));
        while (n-- > 0 && carry[9] >= 1) {
          carry[9] -= 1;
          // off the top of the crest, at the crest's own speed and a share of the wind, a little upward;
          // fine drops (a third of a splash drop's size: they ride the wind for a second or two)
          const a = 0.25 + 0.3 * rng(), up = (0.8 + 2.6 * rng()) * (0.6 + 0.4 * sp);
          if (!this.emit('spray', x + (rng() - 0.5) * 0.4, y + 0.03 + rng() * 0.15, z + (rng() - 0.5) * 0.4, dx * c * 0.8 + cwe * a, up, dz * c * 0.8 + cwn * a, 0.3 + 0.25 * rng(), BLOWN.spumeLife)) { carry[9] = 0; break; }
        }
      }
      if (carry[9] > 24) carry[9] = 24;
    }
    // surf: the wave breaks where the water is shallower than it is high, whatever the wind
    if (near && Hs > 0.25) {
      // the shore is a line, and a random place in the box is seldom on it: places found shallow are
      // kept (a ring of 48, each checked again when it is used) and the breakers are looked for there
      const SH = this._shore, lim = BLOWN.surfDepth * Hs;
      for (let k = 0; k < 10; k++) {
        const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr, d = this._depthAt(near, air, x, z);
        if (d > 0.02 && d < lim) { const o = (this._shoreI++ % 48) * 2; SH[o] = x; SH[o + 1] = z; if (this._shoreN < 48) this._shoreN++; }
      }
      let live = 0;
      for (let k = 0; k < 12 && this._shoreN > 0; k++) {
        const o = Math.floor(rng() * this._shoreN) * 2, x = SH[o], z = SH[o + 1];
        if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
        const d = this._depthAt(near, air, x, z);
        if (!(d > 0.02) || d > lim) { SH[o] = 1e9; continue; }
        live++;
        water.surfaceAt(x, z, _sf);
        if (!(_sf.crest01 > 0.45)) continue;
        carry[10] += capY * BLOWN.surfShare * clamp01(Hs / 1.5) * h * 0.5;
        const lip = Math.sqrt(g * Math.min(Hs, d + _sf.height > 0.05 ? d + _sf.height : 0.05));
        let n = 2 + Math.floor(rng() * 4);
        while (n-- > 0 && carry[10] >= 1) {
          carry[10] -= 1;
          const a = rng() * 6.2831853, s = lip * (0.3 + 0.7 * rng());
          if (!this.emit('spray', x + Math.cos(a) * 0.5, water.level + Math.max(0, _sf.height) + 0.05, z + Math.sin(a) * 0.5, dx * s * 0.8 + Math.cos(a) * 0.6 + cwe * 0.15, s * (0.6 + 0.6 * rng()), dz * s * 0.8 + Math.sin(a) * 0.6 + cwn * 0.15, 0.5 + 0.5 * rng(), 1.3)) { carry[10] = 0; break; }
        }
      }
      this.surf01 = clamp01(live / 6) * clamp01(Hs / 1.5);
      if (carry[10] > 12) carry[10] = 12;
    }
  }

  // Depth of liquid (m) at grid position (x, z): from the near cache, else from the wind grid's
  // coarse ground; 0 where the ground is dry or nothing is known.
  _depthAt(near, air, x, z) {
    let gy = near ? near.heightAt(x, z, NaN) : NaN, lq = near ? near.liquidAt(x, z) : NaN;
    if (gy !== gy && air) { gy = air.terrain.heightAt(x, z, NaN); lq = air.terrain.liquidAt(x, z); }
    return gy === gy && lq === lq && lq > gy ? lq - gy : 0;
  }

  // Powder kicked up from snow joins the snow buffer (it falls like any other flake).
  // WHAT THE EXPLORER'S WIND LIFTS (powers.js). Under a gust's pulse, round a gathered ball and at a tornado's foot,
  // what lies loose on the ground there is thrown up into the moving air, by what the ground is: spray and a ring off
  // water, powder off snow, leaves off a wood's floor, sand and dust off dry loose ground; off bare rock, wet ground or
  // turf, nothing but a little pale dust (so that the air is seen to move at all). A fixed rate for each source
  // (WINDPOWER.liftGust and its fellows, grains a second), so the cost of a cast is known beforehand.
  _windLift(winds, h, frame, air, near, fx, fz, groundY, wet01, snowDepth) {
    const rng = this.rng, P = this.P, Rr = PARTICLES.radius, W = WINDPOWER, cov = _covL;
    for (let k = 0; k < winds.count; k++) {
      const s = winds[k];
      if (!s.placed || !(s.strength > 0.05)) continue;
      if (Math.abs(s.x - fx) > Rr + 40 || Math.abs(s.z - fz) > Rr + 40) continue;
      if (s.kind === KIND.zone) { this._wisps(s, h, near, fx, fz, groundY, Rr); continue; }
      if (s.kind === KIND.part) {
        // move water: spray thrown off the water along the channel's two walls, and strokes of air along it
        this._wisps(s, h, near, fx, fz, groundY, Rr);
        s.carry += W.partSpray * h;
        let guard = 32;
        while (s.carry >= 1 && guard-- > 0) {
          s.carry -= 1;
          const a = rng() * s.len, side = rng() < 0.5 ? -1 : 1, c = side * (s.radius + 0.1 + 0.4 * rng());
          const x = s.x + s.de * a - s.dn * c, z = s.z + s.dn * a + s.de * c;
          if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
          const gp = this._ground(near, x, z, groundY, wet01, snowDepth);
          if (!(gp.liquid > 0.05)) continue;
          const out = 1.2 + 1.6 * rng();
          this.emit('spray', x, gp.h + gp.liquid + 0.05, z, -s.dn * side * out + s.de * 2.5, 1.6 + 2.2 * rng(), s.de * side * out + s.dn * 2.5, 0.8, 0.9, gp.mat);
          if (rng() < 0.08) P._event(frame, x, gp.h + gp.liquid, z, EVENT.ripple, 0.5 + 0.4 * rng(), 0.3);
        }
        continue;
      }
      const rate = (s.kind === KIND.jet ? W.liftGust : s.kind === KIND.orb ? W.liftOrb * (s.age < 2.5 ? 1 : 0.15) : W.liftVortex) * sizeRate(s);
      s.carry += rate * s.strength * h;
      // the air itself, as pale strokes riding it (WINDPOWER.wisp*); the crowns it goes through, losing leaves and
      // now and then a branch (WINDPOWER.tear*, snap*)
      this._wisps(s, h, near, fx, fz, groundY, Rr);
      this._tear(s, h, frame, air, near, fx, fz, groundY, Rr);
      let guard = 64;
      while (s.carry >= 1 && guard-- > 0) {
        s.carry -= 1;
        let x, z, ve, vn, vu;
        if (s.kind === KIND.jet) {
          // just behind the pulse's front, across its width there
          const f = Math.min(s.front * s.age, s.reach);
          if (f >= s.reach && s.age * s.front > s.reach + s.pulse * 2) { s.carry = 0; break; }
          const a = f - rng() * s.pulse * 0.8, w = s.radius + s.spread * (a > 0 ? a : 0), c = (rng() * 2 - 1) * w * 1.2;
          if (a < 0.5) continue;
          x = s.x + s.de * a - s.dn * c; z = s.z + s.dn * a + s.de * c;
          const U = s.speed * s.strength / (1 + 1.2 * a / s.reach) * Math.exp(-(c / w) * (c / w));
          ve = s.de * U * 0.55; vn = s.dn * U * 0.55; vu = U * (0.10 + 0.22 * rng());
        } else {
          const R = s.kind === KIND.orb ? s.radius * (0.25 + 0.6 * rng()) : s.radius * (0.4 + 1.6 * rng()), a = rng() * 6.2831853;
          x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R;
          const sp = s.kind === KIND.orb ? 2.5 : s.speed * 0.5;
          ve = -Math.sin(a) * sp * s.spin - Math.cos(a) * sp * 0.4; vn = Math.cos(a) * sp * s.spin - Math.sin(a) * sp * 0.4; vu = 1.2 + 2.2 * rng();
        }
        if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
        const gp = this._ground(near, x, z, groundY, wet01, snowDepth), gy = gp.h;
        if (gp.liquid > 0.05) {
          // water: spray off its face, and a ring now and then (the water is ruffled)
          this.emit('spray', x, gy + gp.liquid + 0.03, z, ve * 0.6, vu * 0.9 + 0.6, vn * 0.6, 0.7, 0.8, gp.mat);
          if (rng() < 0.12) P._event(frame, x, gy + gp.liquid, z, EVENT.ripple, 0.55 + 0.4 * rng(), 0.3);
          continue;
        }
        // POWDER OFF SNOW -- AND OFF BARE ICE (the owner, 2026-11-19: "give the ice planets more places to melt or
        // use my abilities"). A gust needs something to pick up or nothing is seen to happen, and on the ice worlds
        // there was almost nothing: of their twelve biomes only four carry snow deeper than this three centimetres
        // (ground.js snowBase: Pluto's glacier 0.02, its mountains and plain 0.01, Uranus' shelves and sinkholes
        // 0.02), so on a glacier or a shelf a cast raised a grey puff of "dust" off ice. Ice itself gives crystals:
        // rime, spindrift, the glitter a wind tears off a frozen surface. So snow underfoot OR ice underfoot.
        if (snowDepth > 0.03 || gp.mat === I_SNOW || gp.mat === I_ICE) { this._emitSnow(x, gy + 0.05, z, ve, vu * 1.3, vn); continue; }
        // a wood's floor: its fallen leaves
        const lf = air.coverNear(x, z, cov) ? Math.min(1, 4 * (cov.leaves || 0)) * (0.3 + 0.7 * cov.canopy01) : 0;
        const q = rng();
        // (a wood's floor gives three grains in four as leaves and the rest as a brown puff: under the old shares a leafy
        // wood raised no dust at all, and the owner asked to see dust fly too. Off any ground, a gust raises a puff.)
        if (q < lf * 0.75 * (1 - smoothstep(0.2, 0.6, wet01))) { this.emit('leaves', x, gy + 0.05, z, ve, vu * 1.5 + 0.8, vn, 0.9); continue; }
        if (gp.repose > 0 && q < 0.8) { this.emit('sand', x, gy + 0.02, z, ve, vu, vn, 1, 0.8, gp.mat); continue; }
        this.emit('dust', x, gy + 0.05 + rng() * 0.3, z, ve, vu, vn, gp.dust > 0.1 ? 1.3 : 0.95, gp.dust > 0.1 ? 1.1 : 0.7, gp.mat);
      }
    }
  }

  // LEAVES TORN FROM THE CROWNS the explorer's wind goes through, and the branch that now and then snaps with them
  // (the owner, 2026-11-17: "fly leaves around and dust around when i use it ... some branches should snap and fall
  // off as well"). Where there is no canopy over the place the wind passes, nothing happens here.
  _tear(s, h, frame, air, near, fx, fz, groundY, Rr) {
    const rng = this.rng, W = WINDPOWER, cov = _covL;
    const rate = s.kind === KIND.jet ? W.tearGust : s.kind === KIND.orb ? W.tearOrb : s.kind === KIND.vortex ? W.tearVortex : s.kind === KIND.part ? W.tearPart : 0;
    if (!(rate > 0)) return;
    s.tear = (s.tear || 0) + rate * sizeRate(s) * s.strength * h;
    let guard = 40;
    while (s.tear >= 1 && guard-- > 0) {
      s.tear -= 1;
      let x, z, ve, vn, vu;
      if (s.kind === KIND.jet) {
        const f = Math.min(s.front * s.age, s.reach);
        if (s.age * s.front > s.reach + s.pulse * 1.5) { s.tear = 0; break; }
        const a = f - rng() * s.pulse, w = s.radius + s.spread * (a > 0 ? a : 0), c = (rng() * 2 - 1) * w * 1.3;
        if (a < 0.5) continue;
        x = s.x + s.de * a - s.dn * c; z = s.z + s.dn * a + s.de * c;
        const U = s.speed * s.strength / (1 + 1.2 * a / s.reach);
        ve = s.de * U * 0.8; vn = s.dn * U * 0.8; vu = 0.5 + 1.5 * rng();
      } else if (s.kind === KIND.vortex) {
        const R = s.radius * (0.5 + 2.2 * rng()), a = rng() * 6.2831853;
        x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R;
        ve = -Math.sin(a) * s.speed * s.spin * 0.8 - Math.cos(a) * 2; vn = Math.cos(a) * s.speed * s.spin * 0.8 - Math.sin(a) * 2; vu = s.up * 0.5;
      } else {
        const R = s.radius * (0.3 + 0.8 * rng()), a = rng() * 6.2831853;
        x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R;
        ve = -Math.sin(a) * 4; vn = Math.cos(a) * 4; vu = 0.4;
      }
      if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
      if (!air.coverNear(x, z, cov)) continue;
      const can = cov.canopy01 || 0, top = cov.canopyHeight || 0;
      if (!(can > 0.05) || !(top > 2)) continue;                       // no crown here
      if (rng() > can) continue;                                        // thin canopy, fewer leaves
      const gy = near ? near.heightAt(x, z, groundY) : groundY;
      const y = gy + top * (0.45 + 0.55 * rng());
      if (!this.emit('leaves', x, y, z, ve, vu, vn, 1.0, 1.0)) { s.tear = 0; break; }
      // a branch: the wind takes one from a crown it is strong in, and it comes down with its own leaves
      if (s.snap > 0 && rng() < W.snapChance * h * 8) {
        s.snap--;
        this._branch(x, gy + top * (0.5 + 0.4 * rng()), z, ve, vn);
      }
    }
  }

  // One branch snapped out of a crown: a few long dark pieces that tumble down and lie, and the leaves that fall with
  // them. The pieces are grains of the leaf kind in the ground's darkest brown, which the painter lays as long strokes
  // (render/three/expand.js, option wisp: only with the powers on).
  _branch(x, y, z, ve, vn) {
    const rng = this.rng, W = WINDPOWER;
    for (let i = 0; i < W.snapPieces; i++) {
      const k = 0.25 + 0.5 * rng();
      this.emit('leaves', x + (rng() - 0.5) * 0.6, y + (rng() - 0.5) * 0.5, z + (rng() - 0.5) * 0.6,
        ve * k + (rng() - 0.5) * 1.5, -1.5 - 2 * rng(), vn * k + (rng() - 0.5) * 1.5, 3.2 + 1.6 * rng(), 1.3, I_WOOD);
    }
    for (let i = 0; i < W.snapLeaves; i++) {
      const a = rng() * 6.2831853, r = rng() * 1.3;
      this.emit('leaves', x + Math.cos(a) * r, y + (rng() - 0.5) * 1.2, z + Math.sin(a) * r, ve * 0.5 + Math.cos(a) * 2, -0.5 + rng(), vn * 0.5 + Math.sin(a) * 2, 1.0, 0.9);
    }
  }

  // Pale strokes of air for one source: grains of the leaf kind (light, tumbling, carried by the air they are in), in
  // the ground-material colours of snow and ice, a second or two of life. They are what is seen of a gust over ground
  // with nothing loose on it, of a gathered ball, and of a whirl's column.
  _wisps(s, h, near, fx, fz, groundY, Rr) {
    const rng = this.rng, W = WINDPOWER;
    const hush = s.kind === KIND.zone && !(s.gain > 1) && s.age < W.hushTime;      // (a place being stilled, in its first moments)
    const rate = s.kind === KIND.jet ? W.wispGust : s.kind === KIND.orb ? W.wispOrb : s.kind === KIND.vortex ? W.wispVortex : s.kind === KIND.part ? W.wispPart : (s.gain > 1 ? W.wispZone : hush ? W.wispHush : 0);
    if (!(rate > 0)) return;
    s.wisp = (s.wisp || 0) + rate * sizeRate(s) * (hush ? 1 : s.strength) * h;
    let guard = 48;
    while (s.wisp >= 1 && guard-- > 0) {
      s.wisp -= 1;
      // (life: a share of a leaf's 6 to 14 s. They are light: a third of a leaf's size falls a quarter as fast, so a
      // stroke rides the air it is in and does not drop out of it; what is drawn does not go by this size.)
      let x, z, y, ve, vn, vu, life = 0.12;
      if (s.kind === KIND.jet) {
        const f = Math.min(s.front * s.age, s.reach);
        if (s.age * s.front > s.reach + s.pulse) { s.wisp = 0; break; }
        const a = f - rng() * s.pulse, w = s.radius + s.spread * (a > 0 ? a : 0), c = (rng() * 2 - 1) * w;
        if (a < 0.3) continue;
        x = s.x + s.de * a - s.dn * c; z = s.z + s.dn * a + s.de * c; y = 0.25 + rng() * 2.0;
        const U = s.speed * s.strength / (1 + 1.2 * a / s.reach);
        ve = s.de * U * 0.85; vn = s.dn * U * 0.85; vu = 0.6 * rng();
        if (s.curl > 0) { const cw = c / w, t = U * s.curl * Math.exp(-cw * cw), hy = (y - s.axis) / w; ve += t * hy * s.dn; vn -= t * hy * s.de; vu += t * cw; }
      } else if (s.kind === KIND.part) {
        // along the parted channel, low between its walls
        const a = rng() * s.len * 0.8, c = (rng() * 2 - 1) * s.radius * 0.7;
        x = s.x + s.de * a - s.dn * c; z = s.z + s.dn * a + s.de * c; y = 0.3 + rng() * 1.6;
        ve = s.de * s.speed; vn = s.dn * s.speed; vu = 0; life = 0.06;
      } else if (s.kind === KIND.orb) {
        // a ball: strokes turning close round its middle, at its own height, each gone in half a second (the air
        // they ride runs in to the middle: older ones would all lie there in a knot)
        const a = rng() * 6.2831853;
        if (rng() < 0.3) {
          // (three in ten begin farther out and low, and are drawn in on a spiral: the ball is seen to gather)
          const R = 2.4 + rng() * 2.8;
          x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R; y = 0.2 + rng() * 1.1;
          ve = -Math.sin(a) * 3 - Math.cos(a) * 5; vn = Math.cos(a) * 3 - Math.sin(a) * 5; vu = 0.4; life = 0.07;
        } else {
          const el = (rng() * 2 - 1) * 1.1, R = (0.7 + rng() * 0.9) * Math.cos(el);
          x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R; y = Math.max(0.15, s.height + Math.sin(el) * 1.3);
          ve = -Math.sin(a) * W.orbSwirl; vn = Math.cos(a) * W.orbSwirl; vu = 0; life = 0.035;
        }
      } else if (s.kind === KIND.vortex) {
        // a column: strokes turning round the core and climbing it, gone before they are flung far
        const R = s.radius * (0.35 + 0.9 * rng()), a = rng() * 6.2831853;
        x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R; y = 0.2 + rng() * rng() * 11;
        ve = -Math.sin(a) * s.speed * s.spin * 0.8; vn = Math.cos(a) * s.speed * s.spin * 0.8; vu = s.up * 0.7; life = 0.085;
      } else if (hush) {
        // a stilled place: strokes round its rim that drift in a little and sink, and are gone: the air is seen to settle
        const R = s.radius * (0.82 + 0.2 * rng()), a = rng() * 6.2831853;
        x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R; y = 0.6 + rng() * 2.6;
        ve = -Math.cos(a) * 1.6; vn = -Math.sin(a) * 1.6; vu = -0.9; life = 0.09;
      } else {
        const R = s.radius * Math.sqrt(rng()), a = rng() * 6.2831853;
        x = s.x + Math.cos(a) * R; z = s.z + Math.sin(a) * R; y = 0.3 + rng() * 3.2;
        ve = s.de * s.push; vn = s.dn * s.push; vu = 0; life = 0.2;
      }
      if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
      const gy = near ? near.heightAt(x, z, groundY) : groundY;
      if (!this.emit('leaves', x, gy + y, z, ve, vu, vn, 0.35, life * (0.7 + 0.6 * rng()), rng() < 0.7 ? I_SNOW : I_ICE)) { s.wisp = 0; break; }
    }
  }

  // THE FLAME, THE SMOKE AND THE EMBERS OF A FIRE (what each of them is and why, in FLAME above). F is the fire list
  // (fire.js), which placeFires has already put in this frame's grid, which is why every patch here has an x, a z and
  // a y. We read it and never write to it: the burning is the fire's business, the picture is ours.
  _fire(F, h, frame, near, fx, fz, Rr) {
    const P = this.P, rng = this.rng, Fl = FLAME, C = this._carry;
    const b = P.buffers.leaves, cap = PARTICLES.capacity.leaves[P.quality], room = cap * Fl.share;
    if (b._n >= room) return;             // the leaves of a gale have the buffer: a fire takes no room from them
    const lim = Rr + Fl.edge;
    // HOW MUCH FIRE IS IN REACH AT ALL, as square metres of flame and of smoke. (A patch's own square metres, not
    // pi r^2: it is only a weight, and every patch is weighed the same way.)
    let wf = 0, ws = 0;
    for (let i = 0; i < F.count; i++) {
      const s = F[i];
      if (!s.placed || Math.abs(s.x - fx) > lim || Math.abs(s.z - fz) > lim) continue;
      const a = s.radius * s.radius;
      wf += s.heat * a; ws += smokeOf(s) * a;
    }
    if (!(wf > 0) && !(ws > 0)) return;
    // (2026-11-18) a patch of no width among smoking ones: there is nothing to share out, and 0/0 would leave the
    // carry not-a-number and the flame and the embers gone for the rest of the session
    if (!(wf > 0)) wf = 1;
    if (!(ws > 0)) ws = 1;
    // THE THREE BUDGETS: so many grains a second for each square metre of fire, and never more than the ceiling,
    // which is a share of the buffer divided by how long one grain lives -- so the ceiling is really a count of
    // grains in the air at once, which is the thing that has to be capped.
    // (the surge below multiplies a patch's rate, so the ceiling is kept as a ceiling of its own and the surge is
    //  held under it: a fire already at its budget leaps in SPEED and HEIGHT and not in how many grains it takes,
    //  which is the one thing it may not do. A campfire, far under the ceiling, surges in all three.)
    const rfRate = Fl.flamePerM2 * wf, rfCap = cap * Fl.flameShare / Fl.flameLife;
    const rf = Math.min(rfRate, rfCap);
    const rs = Math.min(Fl.smokePerM2 * ws, cap * Fl.smokeShare / Fl.smokeLife);
    const re = Math.min(Fl.emberPerM2 * wf, cap * Fl.emberShare / Fl.emberLife);
    for (let i = 0; i < F.count; i++) {
      const s = F[i];
      if (!s.placed || Math.abs(s.x - fx) > lim || Math.abs(s.z - fz) > lim) continue;
      const a = s.radius * s.radius, sm = smokeOf(s), heat = s.heat;
      // the wind at this patch, which fire.js has already asked the air for (the body's own axes), turned into this
      // grid's east and north. The player's gusts and the dust devils are already in it.
      const wE = s.wx * frame.ex + s.wy * frame.ey + s.wz * frame.ez;
      const wN = s.wx * frame.nx + s.wy * frame.ny + s.wz * frame.nz;
      // FLAME: out of the patch, up fast, leaning downwind. Born a finger off the ground, because the painter draws
      // the ribbon backwards from the grain along its flight, so a rising tongue stands rooted in the fire.
      if (heat > 0) {
        const sg = flameSurge(s, F.time || 0);            // how hard THIS patch is leaping now (see FLAME.surge*)
        C[13] += Math.min(rfRate * sg, rfCap) * heat * a / wf * h;
        if (C[13] > 64) C[13] = 64;     // (2026-11-18) NEVER A BACKLOG: the guard below spends 64 a frame at most, and a carry grown past it outlives the fire and over-emits on the next one. Measured by a reader: 39,086 in the carry after three minutes of a wide melt at ten frames a second, and the next campfire then made 3,894 grains a second instead of 114.
        let guard = 64;
        while (C[13] >= 1 && guard-- > 0) {
          C[13] -= 1;
          if (b._n >= room) { C[13] = 0; break; }
          const ang = rng() * 6.2831853, R = s.radius * 0.8 * Math.sqrt(rng());
          const x = s.x + Math.cos(ang) * R, z = s.z + Math.sin(ang) * R;
          if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
          const gy = near ? near.heightAt(x, z, s.y) : s.y;        // the ground under THIS tongue, not under the patch
          const up = Fl.flameUp * (0.45 + 0.8 * rng()) * (0.5 + 0.5 * heat) * (0.70 + 0.40 * sg);
          if (!this.emit('leaves', x, gy + 0.05 + rng() * rng() * Fl.flameHigh * heat * sg, z,
            wE * Fl.flameLean, up, wN * Fl.flameLean, Fl.flameSize, Fl.flameLife * 0.1, I_FLAME)) { C[13] = 0; break; }
        }
      }
      // SMOKE: born somewhere up a leaning, widening column (FLAME, above, says why it is not carried up it). `t` is
      // how far up; the column leans downwind by however long the smoke took to get that high, and spreads as it goes.
      if (sm > 0) {
        C[14] += rs * sm * a / ws * h;
        if (C[14] > 64) C[14] = 64;     // (the same, for the smoke)
        let guard = 64;
        while (C[14] >= 1 && guard-- > 0) {
          C[14] -= 1;
          if (b._n >= room) { C[14] = 0; break; }
          const t = rng(), top = Fl.smokeTop * (0.35 + 0.65 * sm) * (0.8 + 0.2 * s.size);
          const hgt = top * t, rise = Fl.smokeRise * (1 - 0.5 * t), lag = hgt / Fl.smokeRise;
          const wid = s.radius * 0.7 + Fl.smokeSpread * hgt, ang = rng() * 6.2831853, R = wid * Math.sqrt(rng());
          const x = s.x + wE * lag + Math.cos(ang) * R, z = s.z + wN * lag + Math.sin(ang) * R;
          if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
          // over melting ice it is steam, and white: this patch is putting all its heat into the ice (fire.js)
          if (!this.emit('leaves', x, s.y + Fl.smokeFoot + hgt, z, wE, rise, wN, Fl.smokeSize, Fl.smokeLife * 0.1,
            s.melt > 0 ? I_SNOW : I_SMOKE)) { C[14] = 0; break; }
        }
      }
      // EMBERS: a few, thrown up fast and out a little, and heavy, so they hold the arc they are given and the wind
      // takes them downwind as they come down.
      if (heat > 0) {
        C[15] += re * heat * a / wf * h;
        if (C[15] > 16) C[15] = 16;     // (the same, for the embers, whose guard is 16)
        let guard = 16;
        while (C[15] >= 1 && guard-- > 0) {
          C[15] -= 1;
          if (b._n >= room) { C[15] = 0; break; }
          const ang = rng() * 6.2831853, R = s.radius * 0.5 * Math.sqrt(rng());
          const x = s.x + Math.cos(ang) * R, z = s.z + Math.sin(ang) * R;
          if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
          const gy = near ? near.heightAt(x, z, s.y) : s.y;
          const up = Fl.emberUp * (0.55 + 0.9 * rng());
          if (!this.emit('leaves', x, gy + 0.12, z, wE * Fl.emberLean + Math.cos(ang) * Fl.emberOut, up,
            wN * Fl.emberLean + Math.sin(ang) * Fl.emberOut, Fl.emberSize, Fl.emberLife * 0.1, I_EMBER)) { C[15] = 0; break; }
        }
      }
    }
  }

  _emitSnow(x, y, z, vx, vy, vz) {
    const b = this.P.buffers.snow, cap = PARTICLES.capacity.snow[this.P.quality];
    if (b._n >= cap) return false;
    const i = b._n++, o = i * 3;
    b._p[o] = x; b._p[o + 1] = y; b._p[o + 2] = z; b._v[o] = vx; b._v[o + 1] = vy; b._v[o + 2] = vz;
    // a clod of powder is heavier than a flake: it flies a short arc and bursts into flakes on the way
    b._vt[i] = 2.2 + this.rng() * 2.5; b._ph[i] = this.rng() * 6.2831853; b.size[i] = 0.004 + this.rng() * 0.006; b.age[i] = 0; b.mat[i] = I_SNOW; b.left[i] = 1e9; b._lt[i] = -1e9; b._wu[i] = 0;
    return true;
  }
}
