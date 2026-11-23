// Painted Cosmos physics: THE ANIMALS' OWN LIVES -- what lives where, what it is doing, and who is hunting whom.
// OWNER: PHYSICS. Pure (no three, no page, no DOM): Node loads it in the tests beside it.
//
// THE OWNER'S WORDS that asked for this (2026-11-23): at least 25 animals in every biome, "animated, with
// routines, hunting and hunted, fish and birds".
//
// WHAT THIS FILE IS. The world's life in two layers, and nothing else:
//
//   THE LEDGER -- the whole planet, as counts. The sphere is cut into 1,536 cells (level-4 cube-sphere, 393 m
//   across on Earth, 15.4 ha each) and each cell holds, PER GUILD and never per animal, two numbers: how many
//   there are and how well fed they are. Eight guilds (GUILD below) carry every species there will ever be. The
//   numbers grow, are eaten, and recover, on a slow tick -- about eight cells a second anywhere in the world --
//   and ANY cell can be brought up to date in one step at any moment, because the growth is solved in closed
//   form (grow(), decayTo()) and not stepped. So the wood goes on living while the player is on another
//   continent, and nothing has to be caught up when they come back.
//
//   THE NEAR BAND -- real individuals, inside FAUNA.band metres of the player. The ledger's counts are unfolded
//   into animals that walk, feed, drink, sleep, take fright and hunt. They are flat typed arrays, stepped in one
//   loop with no allocation at all, in the manner of the loose grains (loose.js _move). Beyond the band there is
//   nothing to step and nothing to remember: the ledger already knows how many are there.
//
// WHAT THIS FILE DOES NOT DO. It draws nothing and knows nothing about three: the bodies are world/beastkit.js
// and world/beasts.js and the paint is render/beastmat.js. It holds no species: the rows are handed in
// (makeFauna({ rows })), because the animals of a world are data (src/data/fauna/*). It does not read the saved
// game and does not write it.
//
// WHAT THE WORLD HAS TO TELL IT -- one function, in the shape fire.js already uses:
//
//   ctx.groundAt(bodyId, px, py, pz, o)
//     "What is at this place?" (px,py,pz) is a direction from the body's centre -- the length is ignored, the
//     answer is about the ground under it. The world fills `o` and nothing else is read:
//       o.r       the radius of the GROUND there, metres from the body's centre (so the height is o.r, not o.r - R)
//       o.lq      the radius of the liquid surface there, or NOLIQ where there is none (surface.js's own NOLQ)
//       o.trees   0..1 how wooded          o.under  0..1 how much undergrowth
//       o.glade   0..1 how open            o.canopy 0..1 how closed over
//       o.rock    0..1 how bare
//     In the game that is one call to the surface (world/surface.js sample), measured at 2.28 microseconds. It is
//     EXPENSIVE and it is budgeted here: FAUNA.samples a frame, hard, and an animal asks only when it has moved
//     FAUNA.resample metres. Between asks it carries the ground forward on the slope it measured last time, so it
//     does not bob. If the budget is spent the animal simply keeps the ground it had: nothing stalls, nothing hitches.
//
//   ctx.eye        where the player is, body-local {x,y,z}, or null (no player: only the ledger runs)
//   ctx.bodyId     which world. A different one empties the band and reseeds the ledger (see resetBody).
//   ctx.R          the body's radius (m)          ctx.g    gravity (m/s^2)
//   ctx.t          seconds of play (the same clock the drawing is given as `now`)
//   ctx.day01      0..1 through the local day, 0 = midnight. The day is one cosine per species and nothing more.
//   ctx.day        seconds in that day (Earth's is 1500: data/bodies.js)
//
// WHAT IT TELLS THE GAME BACK.
//   F.agents  the near band as a struct of arrays, written in place every frame, read by world/beasts.js. The
//             fields, their units and their order are set out at `publish` below. Nothing in it is allocated
//             after the first frame.
//   F.kills   an array of rows the caller reads and clears (clearKills), exactly as fire.js hands back F.burns:
//             one row per animal killed, which is what a carcass, the crows and the saved record are made from.
//             Each row: { bodyId, x, y, z, sp (the quarry's row, -1 if it was never an individual), guild, by
//             (the hunter's row), t (F.time), meat 0..1, id }. Rows stop being added at FAUNA.killsMax and
//             F.lostKills counts what was missed, so a reader that falls behind is loud about it.
//   F.alarms  the short list of frights. ONE COMPARISON when it is empty, which is nearly always.
//   F.prof    what the frame cost and what happened in it. thinks / scans / spawns / kills / asks are for THIS
//             frame; `events` is a RUNNING TOTAL of watchable things within FAUNA.eventR of the player (a head
//             coming up, a head going down, a stalk, a rush, a call, a kill), so the read-out differences it to
//             get the design's "is the wood alive" number. MEASURED in a wood of 58: about 6 a minute.
//
// THE WHOLE OF WHAT A CALLER CALLS.
//   makeFauna({ rows, cap, herds, seed })   once. `rows` is the species data (faunaRow fills in the rest).
//   stepFauna(F, dt, ctx)                   once a frame, before the drawing.
//   clearKills(F)                           after reading F.kills, every frame.
//   scare(F, x, y, z, radius, strength, hop, guild)   the game's own frights: the fire, a power, a tree going
//                                           over. `guild` -1 for them; it is there so that what an animal eats
//                                           crying out is not a fright to it.
//   placeBeast(F, row, x, y, z, ctx)        put one animal where you want it (a tool, a test, a set piece).
//   ledgerAt(F, x, y, z, guild, ctx)        how many of a guild live at a place, brought up to date on the spot.
//   herdPlaceOf(F, cell, out) / waterPlaceOf(F, cell, out)   where a cell's herd is and where its water is, as
//                                           unit directions: what the FAR band is drawn from, with nothing stepped.
//   cellOf(x, y, z), cellSize(R), faunaBytes(F), activity(row, day01)
//
// THE SWITCHES, read once from the address so the owner can be shown A and B of the same still:
//   ?lifedens=0.5   how many animals there are (0 = none, 1 = the rows' own density, 3 = a zoo)
//   ?lifehunt=0     no hunting at all: the same wood with nothing chasing anything
//   ?lifeband=120   how far out animals are real, in metres
//   ?lifecalm=1     an animal's fright does not pass to its neighbours (the alarm contagion off)
import { clamp, clamp01, mix, hash3, eastNorth } from './util.js';
import { gaitOf, EXPLORER_BODY } from './explorer.js';

// surface.js's own "there is no liquid here". Kept as a number so PHYSICS does not import PAINTER's folder.
export const NOLIQ = -1e9;

// ---- the guilds -------------------------------------------------------------------------------------------
// EIGHT is the whole bestiary, for ever. A species is a row of numbers that belongs to one of these; the ledger
// only ever counts guilds, so adding a twenty-sixth animal to a wood costs the world's book-keeping nothing.
export const GUILD = Object.freeze({
  grazer: 0,        // deer, boar: eats the undergrowth and the glades
  ground: 1,        // hare, vole, hedgehog: small, on the ground
  climber: 2,       // squirrel, marten: in the trees
  hunter: 3,        // fox, wolf, badger: hunts on the ground
  crow: 4,          // crow, magpie: finds what is already dead
  bird: 5,          // tits, finches, pigeons: small birds
  raptor: 6,        // buzzard, sparrowhawk, heron: hunts from the air or the water's edge
  fish: 7,
});
export const NGUILD = 8;

// What a guild is doing. THE FIRST EIGHT ARE THE DRAWING'S OWN CODES (world/beastkit.js STATE) and must keep
// that order: `publish` hands them straight to the instance buffer. The four after them are the lives' own and
// are mapped down to one of the eight by DRAW_STATE when they are published.
export const FSTATE = Object.freeze({
  STAND: 0, WALK: 1, TROT: 2, GRAZE: 3, ALERT: 4, FLEE: 5, HUNT: 6, REST: 7,
  DRINK: 8, SLEEP: 9, STALK: 10, FEED: 11,
});
// drink and feed are a head down where it stands (GRAZE); sleep is REST; a stalk is the beginning of a HUNT.
const DRAW_STATE = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 3, 7, 6, 3]);
const NSTATE = 12;

// ---- the numbers ------------------------------------------------------------------------------------------
const Q = (typeof location !== 'undefined' && location && location.search) ? new URLSearchParams(location.search) : null;
// (Q.get of a key that is not there is null, and +null is 0 -- which for a dial whose range INCLUDES 0 reads as
//  'the owner asked for none'. MEASURED 2026-11-23, wiring stage one: with no ?lifedens= in the address FAUNA.dens
//  came out 0 and stock() returned at its second line, so not one animal was ever made on any world. `has` first.)
const qnum = (k, d, lo, hi) => { const v = Q && Q.has(k) ? +Q.get(k) : NaN; return Number.isFinite(v) && v >= lo && v <= hi ? v : d; };

export const FAUNA = Object.freeze({
  // THE BAND. 220 m because one band is almost exactly one ledger cell (15.21 ha against 15.42), so folding a
  // place up and unfolding it again is reading and writing one row. Past it a deer is 3.6 px and an individual
  // is a lie: the far herds are marks drawn from the ledger (world/beasts.js), not animals stepped here.
  band: qnum('lifeband', 220, 20, 600),
  cap: 192,                 // individuals at once. 164 is the design's full autumn wood; this leaves room to spill.
  herds: 24,                // herds at once (one record each, NOT one per animal)
  dens: qnum('lifedens', 1, 0, 4),
  hunt: !(Q && Q.get('lifehunt') === '0'),
  calm: !!(Q && Q.get('lifecalm') === '1'),

  // THE CLOCKS. Nothing here runs every frame except the moving.
  thinkEvery: 0.25,         // s: an animal decides four times a second, staggered by its hash so they never bunch
  huntThink: 0.1,           // s: ... ten times a second while it is hunting, which is the part you watch
  stockEvery: 0.5,          // s: who should be in the band
  sweepEvery: 0.125,        // s: one ledger cell a tick = 8 cells a second, the design's own rate
  // HOW LONG ONE LEDGER STEP MAY BE, and HOW MANY a cell may ever take at once. The growth itself is exact at
  // any length (grow() is the closed-form logistic); only the PRESSURE between the guilds is held constant
  // across a step. MEASURED against one-second steps over an hour of play: in 24 steps of 150 s the worst
  // guild is 1.9 per cent out, in 8 steps of 450 s it is 2.1, in 4 steps of 900 s it is 4.1. The floor is
  // about two per cent whatever is done, so there is nothing to buy past this.
  // THE CAP is what decides the only hitch this file can cause: coming back to country nobody has visited for
  // hours makes `stock` catch up nine cells in ONE frame. At the first setting (150 s, 32 steps) that was 58
  // microseconds a cell -- half a millisecond here and perhaps three on the phone. At 450 and 16 the very
  // worst a cell can cost is 29 microseconds, and the ordinary case (away for minutes) is a single step.
  ledgerStep: 450,          // s of play: a little over half of Earth's 1,500 s day
  ledgerSteps: 16,

  // THE GROUND, which is the only real cost. Measured 2.28 us a sample (the design's own measurement of
  // world/surface.js here), so 192 animals asking every frame would be 0.44 ms -- a twentieth of the phone's
  // whole script for something nobody can see. Hence: a hard budget a frame, and only when it has moved.
  samples: 6,               // ground samples a frame, hard
  resample: 1.5,            // m an animal moves before it asks again
  groundEase: 10,           // per second: how fast the drawn height takes up the error when a new sample lands
  spawns: 4,                // animals made real a frame (each costs one sample), so walking into country never hitches

  // THE NEEDS. They only rise; nothing has to think to keep them.
  hungerTime: 240,          // s to go from fed to starving: a sixth of Earth's 1,500 s day
  thirstTime: 420,
  tireTime: 900,
  feedRate: 0.35,           // hunger lost a second with its head down in good food
  drinkRate: 0.5,
  restRate: 0.4,            // tiredness lost a second asleep

  // FEAR. The one rule that earns the most is that it passes between animals -- but it has to be stopped from
  // running away with the whole wood, so an alarm may hop twice and no further, and each animal may raise one
  // only once every `callAgain` seconds.
  fearHalf: 12,             // s: the half-life of fright
  alertFear: 0.25,          // above this it stops and looks
  fleeFear: 0.55,           // above this it runs
  callFear: 0.80,           // above this it calls, and its neighbours hear
  callAgain: 4,             // s before the same animal may call again
  alarms: 16,               // frights in the air at once
  alarmLife: 2.5,           // s a fright is in the air (the fear it caused lasts far longer: fearHalf)
  alarmHops: 2,             // how far a fright may pass from animal to animal
  callR: 45,                // m an animal's own alarm carries
  eyeStill: 0.4,            // m/s: below this the player counts as standing still and is half as frightening

  // THE HUNT.
  huntHunger: 0.55,         // a hunter that is fuller than this is not hunting
  huntRange: 70,            // m it will look for something to eat
  huntScan: 1.5,            // s between looks (the scan is the only O(n) thing in the file)
  rushRange: 12,            // m: the stalk ends and the rush begins
  catchR: 1.2,              // m: inside this it has it
  stalkSpeed: 0.55,         // of its walk, body low
  feedTime: 50,             // s it stands over a kill
  giveUp: 25,               // s before a hunter that failed tries again
  strikeEvery: 55,          // s between a stander's strikes (a heron)
  wade: 0.5,                // m: how deep a shore animal will stand. Deeper than this it stays on the bank.
  killsMax: 16,             // kill rows kept if the caller is slow to read them (then F.lostKills counts)

  // MOVING.
  turn: 2.2,                // rad/s a walking animal turns; it turns faster the faster it goes (turnRun)
  turnRun: 3.4,
  accel: 0.6,               // s to come up to speed ... and to stop. Nothing starts or stops instantly: that is
  decel: 0.3,               // the first of the five things that decide whether this reads as an animal or a toy.
  // EXCEPT A BOLT. A startled animal does not start like a walking one: it bunches and goes. Without this a
  // hare standing at 8 m is always caught, however fast it is -- MEASURED: a hare that runs at 12.5 m/s was
  // taken by a fox that runs at 11, because it spent 0.85 s getting going while the fox was already at speed.
  bolt: 0.22,               // s to full speed when it is running for its life
  arrive: 2.5,              // m: near enough to its goal
  wander: 18,               // m: how far ahead a goal is set when it is just walking
  grazeDown: [4, 8],        // s head down ...
  grazeUp: [1.2, 2.6],      // ... then up and two steps. The stillness is what makes the movement land.
  eventR: 60,               // m: the radius the "is the wood alive" count is taken in
});

// HOW MANY A CELL HOLDS at the best habitat it could have, per guild, per 15.4 ha cell. These are the design's
// own numbers for Earth's autumn woodland and they are DELIBERATELY HIGH against the real world: this planet is
// 201 km2 in all, and a realistic density is an empty wood. 9 grazers a cell is 59 a km2; 40 small birds is 260.
const KCELL = Object.freeze([9, 24, 14, 0, 0, 40, 0, 30]);
// ... and for the three that live on the others, capacity is a share of what there is to eat, not of the ground.
// These are read against the prey AS THEY ACTUALLY ARE (about three fifths of what the ground could hold), so
// 0.025 of 52 prey is 1.3 ground hunters a cell = 8 a km2, against the design's 13; 0.030 gives 1.4 air
// hunters, against its 2; 0.25 gives 5 scavengers, against its 8. Raise them and a wood becomes a zoo of
// hunters, which is the commoner mistake: a hunter you see twice a day is worth more than one in every glade.
const KPREY = Object.freeze([0, 0, 0, 0.025, 0.25, 0, 0.030, 0]);
// What each guild eats, as a bit per guild. A hunter takes grazers, small ground, climbers and small birds; the
// air hunter takes the small and the fish; the crow finds grazers and small ground already dead.
const MENU = Object.freeze([0, 0, 0,
  (1 << 0) | (1 << 1) | (1 << 2) | (1 << 5),
  (1 << 0) | (1 << 1), 0,
  (1 << 1) | (1 << 2) | (1 << 5) | (1 << 7), 0]);
// How fast a guild's numbers come back, per game-day. A small bird refills a wood in days; a deer takes a season.
const GROW = Object.freeze([0.30, 0.55, 0.45, 0.22, 0.25, 0.70, 0.18, 0.80]);
// How hard the hunters above press on it, per game-day, with the hunters at their own full numbers.
// EVERY ONE OF THESE IS 0.4 OF THE GROWTH ABOVE IT, and that is the whole stability of the ledger: the prey
// settles where its own growth matches the pressure, which is at 1 - 0.4 = 0.6 of what the ground could hold.
// Set any of them ABOVE its growth rate and that guild falls to the floor and stays there -- a wood with no
// deer in it, which is the design's own named risk. The test beside this file runs a hundred game-days and
// measures where each guild actually settles.
const PRESS = Object.freeze([0.12, 0.22, 0.18, 0, 0, 0.28, 0, 0.32]);
// How many guilds eat each one. PRESS above is the TOTAL a guild feels with all of its hunters at their own
// full numbers, so it is shared out among them -- otherwise a prey with two hunters feels twice the pressure
// and settles at a fifth of what the ground could hold instead of three fifths. (MEASURED, before this was
// shared: the grazers of a wood came to rest at 1.7 a cell, which is 11 a km2, against the design's 59.)
const NPRED = (() => {
  const a = new Float32Array(NGUILD);
  for (let g = 0; g < NGUILD; g++) { let n = 0; for (let q = 0; q < NGUILD; q++) if (MENU[q] & (1 << g)) n++; a[g] = n || 1; }
  return a;
})();
// What a cell's own ground is worth to each guild: trees, undergrowth, glade, water.
const HABW = Object.freeze([
  0.20, 0.90, 0.80, 0.00,    // grazer
  0.50, 1.00, 0.50, 0.00,    // small ground
  1.20, 0.20, 0.00, 0.00,    // climber
  0.00, 0.00, 0.00, 0.00,    // hunter (from its prey)
  0.00, 0.00, 0.00, 0.00,    // crow   (from its prey)
  0.90, 0.60, 0.30, 0.00,    // small bird
  0.00, 0.00, 0.00, 0.00,    // air hunter (from its prey)
  0.00, 0.00, 0.00, 2.50,    // fish
]);
// NOTHING EVER GOES EXTINCT: a cell is never left below this share of what it could hold, because its
// neighbours walk back into it. That floor IS the immigration -- in closed form, with no cell adjacency to
// get wrong across the seams of a cube.
const FLOOR = 0.08;
const CEIL = 1.6;           // ... and never above this, whatever the arithmetic says

// ---- the sphere, cut into cells ---------------------------------------------------------------------------
// The SAME partition as world/cubesphere.js at level 4, written out here so PHYSICS keeps no dependency on
// PAINTER's folder. It is six rows of numbers and two formulas; the test beside this file checks it against
// the real one on a thousand directions, so the copy cannot drift.
const FN = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
const FU = [0, 0, -1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0];
const FV = [0, 1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0, 1, 0, 0, 1, 0];
const QP = Math.PI / 4;
export const LGRID = 16;                      // cells a face side: 6 * 16 * 16 = 1,536 cells on any world
export const NCELL = 6 * LGRID * LGRID;

const _fv = { face: 0, u: 0, v: 0 };
function faceOf(x, y, z, o) {
  const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y, az = z < 0 ? -z : z;
  let f;
  if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1;
  else if (ay >= az) f = y > 0 ? 2 : 3;
  else f = z > 0 ? 4 : 5;
  const i = f * 3;
  const d = x * FN[i] + y * FN[i + 1] + z * FN[i + 2];
  o.face = f;
  o.u = Math.atan((x * FU[i] + y * FU[i + 1] + z * FU[i + 2]) / d) / QP;
  o.v = Math.atan((x * FV[i] + y * FV[i + 1] + z * FV[i + 2]) / d) / QP;
  return o;
}
// (face, u, v in -1..1) -> unit direction into o[0..2]
function faceDir(f, u, v, o) {
  const i = f * 3, a = Math.tan(u * QP), b = Math.tan(v * QP);
  const x = FN[i] + a * FU[i] + b * FV[i];
  const y = FN[i + 1] + a * FU[i + 1] + b * FV[i + 1];
  const z = FN[i + 2] + a * FU[i + 2] + b * FV[i + 2];
  const il = 1 / Math.sqrt(x * x + y * y + z * z);
  o[0] = x * il; o[1] = y * il; o[2] = z * il;
  return o;
}
// which cell a body-local point is in (the length is ignored: it is a direction)
export function cellOf(x, y, z) {
  faceOf(x, y, z, _fv);
  let ix = (((_fv.u + 1) * 0.5 * LGRID) | 0), iy = (((_fv.v + 1) * 0.5 * LGRID) | 0);
  if (ix < 0) ix = 0; else if (ix >= LGRID) ix = LGRID - 1;
  if (iy < 0) iy = 0; else if (iy >= LGRID) iy = LGRID - 1;
  return _fv.face * (LGRID * LGRID) + iy * LGRID + ix;
}
// a point inside a cell: a, b in 0..1 across it. Writes a unit direction into o[0..2].
export function cellPoint(cell, a, b, o) {
  const f = (cell / (LGRID * LGRID)) | 0, r = cell - f * LGRID * LGRID;
  const iy = (r / LGRID) | 0, ix = r - iy * LGRID, s = 2 / LGRID;
  return faceDir(f, -1 + (ix + a) * s, -1 + (iy + b) * s, o);
}
// how wide a cell is, in metres, on a world of radius R (world/cubesphere.js nodeSize at level 4)
export const cellSize = (R) => (Math.PI * 0.5 * R) / LGRID;

// ---- the species rows -------------------------------------------------------------------------------------
// A row is DATA (src/data/fauna/*) and is handed in. This fills in whatever it leaves out, and works out the
// things the lives need and the drawing does not: the Froude speeds, the stride, the menu.
// The one hard rule on the rows: THE ORDER IS THE CONTRACT. agents.sp is the index into this array, and
// world/beasts.js must be built from the same array in the same order, or a fox is drawn as a deer.
export function faunaRow(r, i) {
  const g = (r.guild | 0) % NGUILD;
  const o = {
    id: r.id || ('beast' + i), sp: i, guild: g,
    high: +r.high || 1.0,                               // m to the shoulder (the drawing's SHAPES.high)
    legF: r.legF != null ? +r.legF : 0.55,              // the share of that height that is leg
    mass: +r.mass || 25,                                // kg: only the chase uses it
    // speeds in m/s ON EARTH. Left out, they come from the Froude number the engine already uses for the
    // explorer's gait (explorer.js gaitOf): a stroll at Fr 0.09, the change of gait at Fr 0.5, flat out at 2.5.
    // They are scaled to the world's own gravity at makeFauna, so one row is right on every planet.
    walk: r.walk != null ? +r.walk : 0, trot: r.trot != null ? +r.trot : 0, run: r.run != null ? +r.run : 0,
    group: r.group || null,                             // [least, most] that stand together; null = alone
    peak: r.peak != null ? +r.peak : 0.30,              // when in the day it is most awake (0 = midnight)
    amp: r.amp != null ? +r.amp : 0.45,                 // how hard the day drives it (0 = the same all day)
    base: r.base != null ? +r.base : 0.55,
    hab: r.hab || null,                                 // [trees, under, glade, water] 0..1, where it belongs
    eats: r.eats != null ? (r.eats | 0) : MENU[g],      // a bit per guild it hunts
    flee: r.flee != null ? +r.flee : 26,                // m: how near the player may come before it goes
    shy: r.shy != null ? +r.shy : 0.7,                  // 0..1 how readily it takes fright
    strike: !!r.strike,                                 // it stands and strikes (a heron) instead of chasing
    sprint: r.sprint != null ? +r.sprint : 0,           // s it can run flat out (0 = from its mass and menu, below)
    dens: r.dens != null ? +r.dens : 1,                 // its share of its guild where it belongs
    size: r.size || null,                               // [least, most] an individual's size against the row
    callR: r.callR != null ? +r.callR : FAUNA.callR,    // m its own alarm carries (a jay's is far)
    water: !!r.water,                                   // it lives in the water (a fish): placed on the liquid
    // it belongs at the water's EDGE (a heron, an otter, a kingfisher): laid down in the wet quarter of its
    // cell rather than anywhere in it. Without this a heron is laid in a wood 200 m from the nearest water
    // and spends its whole life walking there at half a metre a second.
    shore: r.shore != null ? !!r.shore : !!r.strike,
  };
  // How long it can run flat out. A hare is spent in half a minute, a wolf can keep it up: big animals and
  // hunters last longer (the chase is decided by this and by the gap, never by a dice roll).
  if (!(o.sprint > 0)) o.sprint = o.eats ? 22 + 14 * Math.min(1, o.mass / 40) : 14 + 16 * Math.min(1, o.mass / 60);
  // HOW LONG IT TAKES TO GET HUNGRY, in seconds of play. A grazer is at it nearly all day, so the default is
  // FAUNA.hungerTime (240 s, a sixth of Earth's 1,500 s day). A HUNTER IS NOT: a fox eats once or twice a day,
  // and giving it the grazer's appetite is what decides whether a wood is a wood or a zoo. MEASURED with the
  // grazer's: two foxes in a band of 58 killed something every two minutes. At 1,200 s it is every eight to
  // ten, and only some of those are where the player can see them -- which is the design's own aim.
  o.hungry = r.hungry != null ? +r.hungry : 0;
  // WHICH OF THEM ACTUALLY CHASES SOMETHING IN THE BAND. The ledger lets a crow "eat" grazers, because a crow
  // does live off dead deer -- but a crow must not be seen running one down. Only the two hunting guilds chase,
  // and a stander (a heron) waits instead.
  o.chase = (g === GUILD.hunter || g === GUILD.raptor) && !o.strike && !!o.eats;
  if (!(o.hungry > 0)) o.hungry = (o.chase || o.strike) ? 1200 : FAUNA.hungerTime;
  // the gait laws, the explorer's own, with this animal's leg
  o.T = Object.freeze(Object.assign({}, EXPLORER_BODY, { legLength: Math.max(0.08, o.high * o.legF) }));
  return o;
}
export function faunaRows(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) out.push(faunaRow(rows[i], i));
  return out;
}

// ---- the state --------------------------------------------------------------------------------------------
function mkKill() { return { bodyId: null, x: 0, y: 0, z: 0, sp: -1, guild: 0, by: -1, t: 0, meat: 1, id: 0 }; }
// `g` is the guild of whatever raised it, or -1 for the game's own frights (a fire, a power, a tree coming
// down). It is here for one rule: WHAT YOU EAT CALLING OUT IS NOT A FRIGHT TO YOU.
function mkAlarm() { return { x: 0, y: 0, z: 0, r: 0, s: 0, age: 0, hop: 0, g: -1 }; }

export function makeFauna(opt) {
  const o = opt || {};
  const rows = o.rows ? (o.rows[0] && o.rows[0].T ? o.rows : faunaRows(o.rows)) : [];
  const cap = Math.max(8, o.cap || FAUNA.cap), H = Math.max(2, o.herds || FAUNA.herds);
  const NG = NCELL * NGUILD;
  const F = {
    rows, cap, H, bodyId: null, R: 1, g: 9.81, day: 1500, time: 0, seed: (o.seed | 0) || 1,
    // --- the ledger. 1,536 cells x 8 guilds.
    n: new Float32Array(NG),          // how many
    fed: new Uint8Array(NG),          // 0..255 = 0..1, how well fed (slow; a byte is finer than anything visible)
    hab: new Uint8Array(NCELL * 4),   // the cell's own ground: trees, under, glade, water
    larder: new Uint8Array(NCELL),    // which quarter of the cell has the most food (0..3), the herd's own goal
    seen: new Uint8Array(NCELL),      // 0 = never looked at
    ct: new Float32Array(NCELL),      // when the cell was last brought up to date
    sweepAt: 0, sweepI: 0, stockAt: 0,
    // --- the near band, all of it flat and written in place
    n0: 0,                            // how many individuals are alive
    pw: new Float64Array(cap * 3),    // where it is, body-local metres. DOUBLE: a millimetre step at 4 km is at
                                      // the edge of a float's digits, and the error would accumulate every frame.
    goal: new Float64Array(cap * 3),
    gs: new Float32Array(cap),        // the ground radius at its last sample
    gr: new Float32Array(cap),        // ... and the one it is actually standing on (eased, so nothing steps)
    slp: new Float32Array(cap),       // the slope measured between its last two samples (m of radius a metre run)
    moved: new Float32Array(cap),     // m since that sample
    food: new Float32Array(cap),      // what its last sample was worth to it: the run-and-tumble's memory
    foodWas: new Float32Array(cap),   // ... and what it was worth at the last decision, which is the comparison
    lq: new Float32Array(cap),        // the liquid radius there, or NOLIQ
    deye: new Float32Array(cap),      // distance SQUARED to the player, kept so the event count is honest
    scanAt: new Float32Array(cap),    // when a hunter may next look round for something to eat
    hunger: new Float32Array(cap), thirst: new Float32Array(cap), tired: new Float32Array(cap),
    fear: new Float32Array(cap), stam: new Float32Array(cap),
    think: new Float32Array(cap), cool: new Float32Array(cap), called: new Float32Array(cap),
    want: new Float32Array(cap),      // the speed it is trying to go
    stride: new Float32Array(cap),    // m of ground in one stride (two steps), from gaitOf
    strideV: new Float32Array(cap),   // the speed the stride was worked out at (it is redone when that is stale)
    st: new Uint8Array(cap),          // FSTATE, the lives' own twelve
    row: new Uint8Array(cap),
    herd: new Int16Array(cap),        // which herd, or -1
    tgt: new Int16Array(cap),         // what it is hunting, or -1
    cell: new Uint16Array(cap),       // the cell it is standing in NOW (the ledger's business)
    home: new Uint16Array(cap),       // ... and the one it was laid down in, which never changes (the stocking's)
    ord: new Uint8Array(cap),         // which of its home cell's and row's animals it is: the same number lays it
                                      // in the same place every time the player walks back into that country
    oa: new Float32Array(cap), ob: new Float32Array(cap),   // its own place in its herd (m east, m north)
    // --- the herds. ONE RECORD each, not one per animal: the record walks and the members are springs on it.
    hn: 0,
    hp: new Float64Array(H * 3), hf: new Float32Array(H * 3),
    hrow: new Uint8Array(H), hcount: new Uint8Array(H), hspread: new Float32Array(H),
    hthink: new Float32Array(H), hgr: new Float32Array(H), hst: new Uint8Array(H), hv: new Float32Array(H),
    hfood: new Float32Array(H), hcell: new Uint16Array(H), hlive: new Uint8Array(H),
    // --- what the game reads
    agents: null, kills: [], alarms: [], lostKills: 0,
    prof: { ms: 0, asks: 0, thinks: 0, spawns: 0, events: 0, kills: 0, scans: 0, near: 0, ledger: 0 },
    // --- scratch, made once
    _g: { r: 0, lq: NOLIQ, trees: 0, under: 0, glade: 0, canopy: 0, rock: 0 },
    _gait: {}, _d: [0, 0, 0], _en: new Float64Array(6), _cells: new Int32Array(16), _nc: 0,
    _have: new Int16Array(16 * 32), _bits: new Uint32Array(16 * 32),
    _spd: new Float32Array(0), _share: new Float32Array(0),
    _K: new Float64Array(NGUILD), _eye: new Float64Array(3), _eyeV: 0, _eyeOk: false, _asks: 0, _killId: 0,
  };
  F.agents = {
    n: 0,
    pos: new Float32Array(cap * 3), fwd: new Float32Array(cap * 3),
    phase: new Float32Array(cap), speed: new Float32Array(cap), state: new Uint8Array(cap),
    head: new Float32Array(cap), alert: new Float32Array(cap), sp: new Uint8Array(cap),
    size: new Float32Array(cap), seed: new Float32Array(cap), born: new Float32Array(cap),
    shade: new Float32Array(cap),
  };
  for (let i = 0; i < FAUNA.killsMax; i++) F.kills.push(mkKill());
  F.kills.count = 0;
  for (let i = 0; i < FAUNA.alarms; i++) F.alarms.push(mkAlarm());
  F.alarms.count = 0;
  F._spd = new Float32Array(Math.max(1, rows.length) * 3);
  F._share = new Float32Array(Math.max(1, rows.length));
  return F;
}

// how much memory the whole system holds (the tests print it; nothing here grows after this)
export function faunaBytes(F) {
  let b = 0;
  for (const k of Object.keys(F)) { const v = F[k]; if (v && v.BYTES_PER_ELEMENT) b += v.byteLength; }
  const a = F.agents;
  for (const k of Object.keys(a)) { const v = a[k]; if (v && v.BYTES_PER_ELEMENT) b += v.byteLength; }
  return b;
}

// ---- the world changed under us ----------------------------------------------------------------------------
// A ledger is kept for ONE world: ten worlds of 1,536 cells would be three quarters of a megabyte for places
// nobody is standing in. Leaving a world forgets its numbers, which is honest -- the design already says the
// deer you saw yesterday is not the deer you see today -- and the one thing that IS remembered across a
// journey is a kill, which the caller keeps (F.kills).
function resetBody(F, ctx) {
  F.bodyId = ctx.bodyId; F.R = ctx.R || 1; F.g = ctx.g > 0.05 ? ctx.g : 9.81; F.day = ctx.day > 1 ? ctx.day : 1500;
  F.n.fill(0); F.fed.fill(0); F.hab.fill(0); F.larder.fill(0); F.seen.fill(0); F.ct.fill(F.time);
  F.n0 = 0; F.hn = 0; F.hlive.fill(0); F.agents.n = 0; F.sweepI = 0;
  F.alarms.count = 0; F._eyeOk = false;
  // the speeds, scaled to this world's gravity: dynamic similarity, so one row of numbers is right everywhere
  const k = Math.sqrt(F.g / 9.81);
  for (let i = 0; i < F.rows.length; i++) {
    const r = F.rows[i], L = r.T.legLength, gE = F.g > 0.3 ? F.g : 0.3;
    F._spd[i * 3] = r.walk > 0 ? r.walk * k : Math.sqrt(0.09 * gE * L);
    F._spd[i * 3 + 1] = r.trot > 0 ? r.trot * k : Math.sqrt(0.50 * gE * L);
    F._spd[i * 3 + 2] = r.run > 0 ? r.run * k : Math.sqrt(2.50 * gE * L);
  }
}

// ---- the ledger --------------------------------------------------------------------------------------------
// The closed-form logistic: where a population of `n` toward `K` at rate `r` is after `dt`, EXACTLY. Not a step:
// one call is right for a frame or for an hour, which is what lets a cell nobody has visited be brought up to
// date in one go instead of being caught up tick by tick. It cannot overshoot and it cannot explode.
function grow(n, K, r, dt) {
  if (!(K > 1e-6)) return n * Math.exp(-r * dt);
  const e = Math.exp(r * dt);
  return (K * n * e) / (K + n * (e - 1));
}
// what a cell can hold of a guild, from its own ground (and, for the hunters, from what there is to eat)
function capacity(F, cell, g) {
  const h = cell * 4, i = g * 4;
  const tr = F.hab[h] / 255, un = F.hab[h + 1] / 255, gl = F.hab[h + 2] / 255, wa = F.hab[h + 3] / 255;
  let K = KCELL[g] * (HABW[i] * tr + HABW[i + 1] * un + HABW[i + 2] * gl + HABW[i + 3] * wa);
  if (KPREY[g] > 0) {
    const m = MENU[g], b = cell * NGUILD;
    let prey = 0;
    for (let p = 0; p < NGUILD; p++) if (m & (1 << p)) prey += F.n[b + p];
    K = KPREY[g] * prey;
  }
  return K * FAUNA.dens;
}
// Look at a cell's ground, ONCE, and remember it: the mean of its four quarters, and which quarter is richest.
// Four samples (9 us measured here) buys both a better mean than one sample and the herd's own destination.
function lookAt(F, cell, ctx) {
  const d = F._d, o = F._g;
  let tr = 0, un = 0, gl = 0, wa = 0, best = 0, bestV = -1, wet = 0, wetV = -1;
  for (let q = 0; q < 4; q++) {
    cellPoint(cell, q & 1 ? 0.72 : 0.28, q & 2 ? 0.72 : 0.28, d);
    o.lq = NOLIQ;
    ctx.groundAt(F.bodyId, d[0] * F.R, d[1] * F.R, d[2] * F.R, o);
    F._asks++;
    tr += o.trees; un += o.under; gl += o.glade;
    const deep = o.lq - o.r;
    if (deep > 0) wa += 1;
    if (deep > wetV) { wetV = deep; wet = q; }
    const v = o.under * 0.7 + o.glade * 0.3;
    if (v > bestV) { bestV = v; best = q; }
  }
  const h = cell * 4;
  F.hab[h] = clamp01(tr * 0.25) * 255; F.hab[h + 1] = clamp01(un * 0.25) * 255;
  F.hab[h + 2] = clamp01(gl * 0.25) * 255; F.hab[h + 3] = clamp01(wa * 0.25) * 255;
  // ONE BYTE HOLDS BOTH ERRANDS: the quarter of the cell with the most to eat, and the wettest. That is all
  // the inside of a cell is ever known in, and it is enough for a herd to drift toward food and an animal to
  // walk toward water -- for four ground samples, once, in the whole life of that cell.
  F.larder[cell] = best | (wet << 2);
  F.seen[cell] = 1;
  F.ct[cell] = F.time;
  // Seed it: what it could hold, give or take a third, so a world is not uniform the first time it is looked
  // at. The hunters go second because their own capacity is a share of the prey that has just been laid down.
  const b = cell * NGUILD;
  for (let g = 0; g < NGUILD; g++) if (!(KPREY[g] > 0)) F.n[b + g] = capacity(F, cell, g) * (0.65 + 0.5 * hash3(cell, g, 7, F.seed));
  for (let g = 0; g < NGUILD; g++) if (KPREY[g] > 0) F.n[b + g] = capacity(F, cell, g) * (0.65 + 0.5 * hash3(cell, g, 7, F.seed));
  for (let g = 0; g < NGUILD; g++) F.fed[b + g] = 170;
}

// Bring one cell up to date. `dt` is seconds of play; it may be one frame or an hour.
export function stepCell(F, cell, ctx, now) {
  if (!F.seen[cell]) { if (ctx) lookAt(F, cell, ctx); else return; }
  const t = now == null ? F.time : now;
  const gap = t - F.ct[cell];
  if (!(gap > 0)) return;
  F.ct[cell] = t;
  let steps = Math.ceil(gap / FAUNA.ledgerStep);
  if (steps < 1) steps = 1; else if (steps > FAUNA.ledgerSteps) steps = FAUNA.ledgerSteps;
  const h = gap / steps;
  for (let s = 0; s < steps; s++) stepCellOnce(F, cell, h);
}
// one step of the two rules. `dt` is seconds of play.
function stepCellOnce(F, cell, dt) {
  const day = dt / F.day;                      // the rates are per game-day: a wood recovers in days, not frames
  const b = cell * NGUILD, K = F._K;
  // WHAT THE CELL COULD HOLD, WORKED OUT ONCE. It was worked out inside the loops, and a hunter's capacity is
  // itself a loop over its menu, so one cell cost about four hundred multiplies instead of sixty: MEASURED, a
  // full sweep of the world was 10.3 ms and catching one cell up after an hour away was 73 microseconds --
  // which, nine cells at a time when the player walks into fresh country, is half a frame on the phone.
  for (let g = 0; g < NGUILD; g++) K[g] = capacity(F, cell, g);
  // the prey first: it grows toward what the ground can hold, and is eaten in proportion to how many hunters
  // there are against how many it could hold of them (a ratio, not a product: a product oscillates, and the
  // design's own risk note is a wood the owner finds with no deer in it).
  for (let g = 0; g < NGUILD; g++) {
    if (KPREY[g] > 0) continue;
    const Kg = K[g];
    let n = grow(F.n[b + g], Kg, GROW[g], day);
    let press = 0;
    for (let q = 0; q < NGUILD; q++) {
      if (!(MENU[q] & (1 << g))) continue;
      if (K[q] > 1e-6) press += (PRESS[g] / NPRED[g]) * clamp01(F.n[b + q] / K[q]);
    }
    if (press > 0) n *= Math.exp(-press * day);
    const lo = Kg * FLOOR, hi = Kg * CEIL;
    F.n[b + g] = n < lo ? lo : n > hi ? hi : n;
    F.fed[b + g] = clamp01(Kg > 1e-6 ? 1 - 0.8 * (F.n[b + g] / Kg) : 0) * 255;
  }
  // then the hunters, whose own capacity is a share of what there was to eat
  for (let g = 0; g < NGUILD; g++) {
    if (!(KPREY[g] > 0)) continue;
    const Kg = K[g], n = grow(F.n[b + g], Kg, GROW[g], day);
    const lo = Kg * FLOOR, hi = Kg * CEIL;
    F.n[b + g] = n < lo ? lo : n > hi ? hi : n;
    F.fed[b + g] = clamp01(Kg > 1e-6 ? F.n[b + g] / Kg : 0) * 255;
  }
}

// How many of a guild live in the cell under a body-local point, brought up to date on the spot.
export function ledgerAt(F, x, y, z, guild, ctx) {
  const c = cellOf(x, y, z);
  stepCell(F, c, ctx);
  return F.n[c * NGUILD + guild];
}
// (for the far herds the drawing asks for: where a cell's herd is standing, as a unit direction into out)
export function herdPlaceOf(F, cell, out) {
  const q = F.larder[cell] & 3;
  return cellPoint(cell, q & 1 ? 0.7 : 0.3, q & 2 ? 0.7 : 0.3, out);
}
// ... and the wettest quarter of it: where an animal goes to drink and where a heron stands.
export function waterPlaceOf(F, cell, out) {
  const q = (F.larder[cell] >> 2) & 3;
  return cellPoint(cell, q & 1 ? 0.7 : 0.3, q & 2 ? 0.7 : 0.3, out);
}

// THE SLOW TICK: one cell a tick, round and round the whole world, eight cells a second.
// MEASURED here: one cell's two rules are 1.4 microseconds, so a full sweep of all 1,536 is 2.1 ms and the
// eight a second cost 0.00018 ms a frame. (The design's own stand-in put a full sweep at 0.127 ms -- sixteen
// times less. The difference is that this really computes each guild's capacity from the cell's own ground
// and each prey's pressure from every hunter that eats it. It makes no odds: a fiftieth of a thousandth of a
// frame is a fiftieth of a thousandth of a frame.)
// And the sweep is not what keeps the world honest -- the closed-form catch-up is. The sweep only keeps the
// numbers warm and moves the herd's own clock on; a cell nobody has swept for an hour is right the instant
// anyone asks about it.
function sweep(F, ctx) {
  F.sweepAt = F.time + FAUNA.sweepEvery;
  // only a cell that has already been looked at is swept; looking costs four ground samples and is done when
  // somebody actually asks about the place (stock, ledgerAt), not here, where it would walk the whole world.
  for (let tries = 0; tries < 8; tries++) {
    const c = F.sweepI; F.sweepI = (F.sweepI + 1) % NCELL;
    if (F.seen[c]) { stepCell(F, c, null); F.prof.ledger++; return; }
  }
}

// ---- frights -------------------------------------------------------------------------------------------------
// The game's own frights come in here: the fire (fire.js F.burns), a power being cast (core/powers.js), a tree
// coming down, the ship landing. One call, and it is the same list an animal's own alarm goes into.
export function scare(F, x, y, z, r, s, hop, guild) {
  const L = F.alarms;
  let i = L.count;
  if (i >= FAUNA.alarms) {                       // full: the oldest goes
    let old = 0;
    for (let j = 1; j < L.count; j++) if (L[j].age > L[old].age) old = j;
    i = old;
  } else L.count++;
  const a = L[i];
  a.x = x; a.y = y; a.z = z; a.r = r; a.s = clamp01(s); a.age = 0; a.hop = hop | 0;
  a.g = guild == null ? -1 : guild | 0;
  return a;
}
function ageAlarms(F, dt) {
  const L = F.alarms;
  for (let i = L.count - 1; i >= 0; i--) {
    const a = L[i];
    a.age += dt;
    // the records are reused, so a dead one is swapped to the end of the list and kept, never thrown away
    if (a.age > FAUNA.alarmLife) { const j = --L.count; if (i !== j) { L[i] = L[j]; L[j] = a; } }
  }
}
export function clearKills(F) { F.kills.count = 0; }

// ---- the near band: making one real and putting it down again ------------------------------------------------
function removeAt(F, k) {
  const last = --F.n0;
  const h = F.herd[k];
  if (h >= 0 && F.hcount[h] > 0 && --F.hcount[h] === 0) F.hlive[h] = 0;
  if (k !== last) {
    F.pw[k * 3] = F.pw[last * 3]; F.pw[k * 3 + 1] = F.pw[last * 3 + 1]; F.pw[k * 3 + 2] = F.pw[last * 3 + 2];
    F.goal[k * 3] = F.goal[last * 3]; F.goal[k * 3 + 1] = F.goal[last * 3 + 1]; F.goal[k * 3 + 2] = F.goal[last * 3 + 2];
    const A = F.agents;
    A.fwd[k * 3] = A.fwd[last * 3]; A.fwd[k * 3 + 1] = A.fwd[last * 3 + 1]; A.fwd[k * 3 + 2] = A.fwd[last * 3 + 2];
    A.phase[k] = A.phase[last]; A.speed[k] = A.speed[last]; A.state[k] = A.state[last];
    A.head[k] = A.head[last]; A.alert[k] = A.alert[last]; A.sp[k] = A.sp[last];
    A.size[k] = A.size[last]; A.seed[k] = A.seed[last]; A.born[k] = A.born[last]; A.shade[k] = A.shade[last];
    F.gs[k] = F.gs[last]; F.gr[k] = F.gr[last]; F.slp[k] = F.slp[last]; F.moved[k] = F.moved[last];
    F.food[k] = F.food[last]; F.foodWas[k] = F.foodWas[last]; F.lq[k] = F.lq[last];
    F.deye[k] = F.deye[last]; F.scanAt[k] = F.scanAt[last];
    F.hunger[k] = F.hunger[last]; F.thirst[k] = F.thirst[last]; F.tired[k] = F.tired[last];
    F.fear[k] = F.fear[last]; F.stam[k] = F.stam[last];
    F.think[k] = F.think[last]; F.cool[k] = F.cool[last]; F.called[k] = F.called[last];
    F.want[k] = F.want[last]; F.stride[k] = F.stride[last]; F.strideV[k] = F.strideV[last];
    F.st[k] = F.st[last]; F.row[k] = F.row[last]; F.herd[k] = F.herd[last]; F.tgt[k] = F.tgt[last];
    F.cell[k] = F.cell[last]; F.home[k] = F.home[last]; F.ord[k] = F.ord[last];
    F.oa[k] = F.oa[last]; F.ob[k] = F.ob[last];
  }
  // a hunter's quarry is held as an index, so the two that moved have to be mended. Removals are a few a
  // minute; this pass is cheaper than keeping a name for every animal and searching for it.
  for (let i = 0; i < F.n0; i++) {
    const g = F.tgt[i];
    if (g === last) F.tgt[i] = k; else if (g === k) F.tgt[i] = -1;
  }
}

// Make one animal of row `ri` real, somewhere in `cell`. Costs ONE ground sample; the caller budgets them.
// `ord` is WHICH animal of that row in that cell it is (0, 1, 2 ...), not a running total, so walking out of a
// place and back into it lays the same animals in the same places -- the flora's own habit (floraplace.js).
// THE PLACE IS FIXED FOR EVER and does not drift with the clock. It was tried with a ten-minute slot, so that
// a wood would not be a diorama; the result is that the ordinals outside the band slowly move inside it, and
// since the ones already standing there keep their slots, the band GROWS. MEASURED: 40 animals at half a
// minute, 69 after twenty-odd. What makes a place different on the next visit is the ledger's own numbers and
// where the herd has walked to, not where animal number 5 was laid down.
function spawn(F, cell, ri, ctx, hi, ord, eye) {
  if (F.n0 >= F.cap) return -1;
  const k = F.n0, A = F.agents, r = F.rows[ri], d = F._d, o = F._g;
  const key = ri * 64 + (ord | 0);
  const s1 = hash3(cell, key, 0, F.seed);
  const s2 = hash3(cell, key + 2039, 0, F.seed + 7);
  const s3 = hash3(cell, key + 4099, 0, F.seed + 13);
  if (r.water || r.shore) {
    // in, or beside, the wettest quarter of the cell, and nowhere else
    const q = (F.larder[cell] >> 2) & 3;
    cellPoint(cell, (q & 1 ? 0.7 : 0.3) + (s1 - 0.5) * 0.24, (q & 2 ? 0.7 : 0.3) + (s2 - 0.5) * 0.24, d);
  } else cellPoint(cell, s1, s2, d);
  // ITS PLACE IS SETTLED BEFORE THE GROUND IS ASKED ABOUT. A cell is 393 m across and the band is 220, so
  // most of a cell's animals are outside it; working the place out first means the frame's ground budget is
  // never spent on an animal that is about to be thrown away. -2 means "not here", not "could not".
  if (eye) {
    const dx = d[0] * F.R - eye.x, dy = d[1] * F.R - eye.y, dz = d[2] * F.R - eye.z;
    const band = FAUNA.band;
    if (dx * dx + dy * dy + dz * dz > band * band) return -2;
  }
  o.lq = NOLIQ;
  ctx.groundAt(F.bodyId, d[0] * F.R, d[1] * F.R, d[2] * F.R, o);
  F._asks++;
  // A FISH BELONGS IN THE WATER AND NOWHERE ELSE, and a land animal will not stand in it -- except a wader,
  // which stands in it up to FAUNA.wade and is on the bank beyond that.
  const deep = o.lq - o.r, wet = deep > 0;
  if (r.water) { if (!wet) return -1; } else if (wet && !(r.shore && deep <= FAUNA.wade)) return -1;
  const gr = r.water ? o.lq - 0.25 : o.r;
  return spawnAt(F, cell, ri, d, gr, o, s1, s2, s3, ord, hi);
}

// write one animal's record. Split out of spawn so that placeBeast can put one down by hand without
// repeating forty lines of it; it is the ONE place an animal comes into being.
function spawnAt(F, cell, ri, d, gr, o, s1, s2, s3, ord, hi) {
  if (F.n0 >= F.cap) return -1;
  const k = F.n0, A = F.agents, r = F.rows[ri];
  F.n0++;
  F.pw[k * 3] = d[0] * gr; F.pw[k * 3 + 1] = d[1] * gr; F.pw[k * 3 + 2] = d[2] * gr;
  // facing: any tangent, turned by its own hash
  eastNorth(d[0], d[1], d[2], F._en, 0);
  const a = s3 * 6.283185307, ca = Math.cos(a), sa = Math.sin(a);
  A.fwd[k * 3] = F._en[0] * ca + F._en[3] * sa;
  A.fwd[k * 3 + 1] = F._en[1] * ca + F._en[4] * sa;
  A.fwd[k * 3 + 2] = F._en[2] * ca + F._en[5] * sa;
  F.gs[k] = gr; F.gr[k] = gr; F.slp[k] = 0; F.moved[k] = 0;
  F.food[k] = o.under * 0.7 + o.glade * 0.3; F.foodWas[k] = F.food[k]; F.lq[k] = o.lq;
  F.deye[k] = 1e12; F.scanAt[k] = F.time + FAUNA.huntScan * s1;
  F.hunger[k] = 0.15 + 0.5 * s1; F.thirst[k] = 0.1 + 0.4 * s2; F.tired[k] = 0.2 * s3;
  F.fear[k] = 0; F.stam[k] = 1;
  F.think[k] = F.time + FAUNA.thinkEvery * s1;        // staggered, so a band never thinks on one frame
  F.cool[k] = F.time + 3 * s2; F.called[k] = 0;
  F.want[k] = 0; F.stride[k] = Math.max(0.2, r.T.legLength * 1.8); F.strideV[k] = 0;
  F.st[k] = FSTATE.STAND; F.row[k] = ri; F.tgt[k] = -1;
  F.cell[k] = cell; F.home[k] = cell; F.ord[k] = ord | 0;
  F.herd[k] = hi == null ? -1 : hi;
  if (hi != null && hi >= 0) {
    const sp = F.hspread[hi];
    F.oa[k] = (s2 - 0.5) * 2 * sp; F.ob[k] = (s3 - 0.5) * 2 * sp;
    if (F.hcount[hi] < 255) F.hcount[hi]++;
  } else { F.oa[k] = 0; F.ob[k] = 0; }
  A.phase[k] = s1; A.speed[k] = 0; A.state[k] = FSTATE.STAND;
  A.head[k] = 0; A.alert[k] = 0; A.sp[k] = ri;
  A.size[k] = r.size ? mix(r.size[0], r.size[1], s3) : mix(0.92, 1.08, s3);
  A.seed[k] = s2; A.born[k] = F.time; A.shade[k] = o.canopy;
  F.prof.spawns++;
  return k;
}

// A HERD IS ONE RECORD and the first animal of it stands where the record stands. Its slot is reused once its
// last member has walked out of the band: a wood never runs out of herds because it never keeps an empty one.
function newHerd(F, ri, cell, k) {
  let f = -1;
  for (let i = 0; i < F.hn; i++) if (!F.hlive[i]) { f = i; break; }
  if (f < 0) { if (F.hn >= F.H) return -1; f = F.hn++; }
  const o = f * 3, i3 = k * 3;
  F.hlive[f] = 1; F.hcount[f] = 0; F.hrow[f] = ri; F.hcell[f] = cell;
  F.hp[o] = F.pw[i3]; F.hp[o + 1] = F.pw[i3 + 1]; F.hp[o + 2] = F.pw[i3 + 2];
  F.hf[o] = F.agents.fwd[i3]; F.hf[o + 1] = F.agents.fwd[i3 + 1]; F.hf[o + 2] = F.agents.fwd[i3 + 2];
  F.hspread[f] = 4 + 4 * hash3(cell, ri, f, F.seed);
  F.hthink[f] = F.time; F.hgr[f] = F.gr[k]; F.hst[f] = FSTATE.GRAZE; F.hv[f] = 0; F.hfood[f] = F.food[k];
  return f;
}

// PUT ONE ANIMAL WHERE YOU WANT IT. The ledger lays down the ordinary life of a place; this is for the
// extraordinary -- a tool making a still of one animal, a test driving one hunt, and (later) the game placing
// something a player is meant to find. It costs one ground sample. Returns its index in the band, or -1.
export function placeBeast(F, ri, px, py, pz, ctx) {
  if (!(ri >= 0 && ri < F.rows.length)) return -1;
  if (F.bodyId !== ctx.bodyId) resetBody(F, ctx);
  const il = 1 / (Math.sqrt(px * px + py * py + pz * pz) || 1);
  const cell = cellOf(px, py, pz), d = F._d, o = F._g;
  d[0] = px * il; d[1] = py * il; d[2] = pz * il;
  o.lq = NOLIQ;
  ctx.groundAt(F.bodyId, d[0] * F.R, d[1] * F.R, d[2] * F.R, o);
  F._asks++;
  const r = F.rows[ri], wet = o.lq > o.r, gr = r.water && wet ? o.lq - 0.25 : o.r;
  const h = hash3(cell, ri, (F.time * 11) | 0, F.seed);
  return spawnAt(F, cell, ri, d, gr, o, h, (h * 7.13) % 1, (h * 31.7) % 1, 0, -1);
}

// the cells the band touches: nine points on the tangent plane, the distinct cells among them (the dust
// devils' own trick, features.js, and it needs no cell adjacency across the seams of a cube)
function cellsNear(F, ex, ey, ez) {
  const il = 1 / (Math.sqrt(ex * ex + ey * ey + ez * ez) || 1);
  const ux = ex * il, uy = ey * il, uz = ez * il;
  eastNorth(ux, uy, uz, F._en, 0);
  const b = FAUNA.band / F.R;
  F._nc = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const x = ux + (F._en[0] * i + F._en[3] * j) * b;
    const y = uy + (F._en[1] * i + F._en[4] * j) * b;
    const z = uz + (F._en[2] * i + F._en[5] * j) * b;
    const c = cellOf(x, y, z);
    let had = false;
    for (let q = 0; q < F._nc; q++) if (F._cells[q] === c) { had = true; break; }
    if (!had && F._nc < 16) F._cells[F._nc++] = c;
  }
}

// WHO SHOULD BE HERE. Twice a second: drop whoever has walked out of the band, then make real as many as the
// ledger says belong in the cells the band touches -- FAUNA.spawns a frame, so nothing ever hitches.
function stock(F, ctx) {
  F.stockAt = F.time + FAUNA.stockEvery;
  const eye = ctx.eye;
  if (!eye) { while (F.n0 > 0) removeAt(F, F.n0 - 1); return; }
  const band = FAUNA.band, out2 = (band * 1.18) * (band * 1.18);
  for (let k = F.n0 - 1; k >= 0; k--) {
    const dx = F.pw[k * 3] - eye.x, dy = F.pw[k * 3 + 1] - eye.y, dz = F.pw[k * 3 + 2] - eye.z;
    if (dx * dx + dy * dy + dz * dz > out2) removeAt(F, k);
  }
  if (!F.rows.length || FAUNA.dens <= 0) return;
  cellsNear(F, eye.x, eye.y, eye.z);
  const nr = Math.min(32, F.rows.length), have = F._have, bits = F._bits;
  // WHICH OF A CELL'S ANIMALS ARE ALREADY REAL. Each one keeps the number it was laid down as (its ordinal in
  // its cell and row), so one pass over the band sets a bit per ordinal and the loop below can go straight to
  // the ones that are missing. Without this the ordinals that lie outside the band would be tried over and
  // over, every half second, for ever.
  for (let i = 0; i < F._nc * nr; i++) { have[i] = 0; bits[i] = 0; }
  for (let k = 0; k < F.n0; k++) {
    // IT IS COUNTED AGAINST THE CELL IT WAS LAID IN, not the one it has wandered into. (MEASURED: counting it
    // where it stands lets an animal that crosses a cell edge free its own slot, which is filled again at
    // once -- a band that should have held 42 held 103 after sixteen minutes of standing still, and every one
    // of them is script and triangles nobody asked for.)
    const c = F.home[k];
    for (let q = 0; q < F._nc; q++) if (F._cells[q] === c) {
      const s = q * nr + F.row[k];
      have[s]++; bits[s] |= 1 << (F.ord[k] & 31);
      break;
    }
  }
  let budget = FAUNA.spawns;
  for (let q = 0; q < F._nc && budget > 0; q++) {
    const c = F._cells[q];
    if (!F.seen[c]) { if (F._asks + 4 > FAUNA.samples) continue; lookAt(F, c, ctx); }
    stepCell(F, c, null);
    // the guild's count in this cell, shared out among the species of that guild that suit the ground here
    for (let g = 0; g < NGUILD && budget > 0; g++) {
      const total = F.n[c * NGUILD + g];
      if (!(total > 0.25)) continue;
      let sum = 0;
      for (let i = 0; i < nr; i++) {
        const r = F.rows[i];
        F._share[i] = 0;
        if (r.guild !== g) continue;
        // a thing that lives in the water is not offered a dry cell at all: every attempt costs a ground
        // sample out of the frame's budget, and in a wood (0.2 per cent wet, measured) they would all fail
        if ((r.water || r.shore) && F.hab[c * 4 + 3] < 8) continue;
        let w = r.dens;
        if (r.hab) {
          const h = c * 4;
          w *= 0.15 + 0.85 * clamp01(r.hab[0] * F.hab[h] / 255 + r.hab[1] * F.hab[h + 1] / 255
            + r.hab[2] * F.hab[h + 2] / 255 + r.hab[3] * F.hab[h + 3] / 255);
        }
        F._share[i] = w; sum += w;
      }
      if (!(sum > 0)) continue;
      for (let i = 0; i < nr && budget > 0; i++) {
        if (!(F._share[i] > 0)) continue;
        const s = q * nr + i;
        // ROUNDED BY A HASH, not by Math.round. A cell that holds 1.4 buzzards must hold one in four cells out
        // of ten and two in the rest; rounded the ordinary way it would hold exactly one in every cell for
        // ever, and a wood with 0.4 of a wolf in it would have no wolf anywhere, at any hour, on any world.
        const exact = total * (F._share[i] / sum);
        const want = Math.min(32, Math.floor(exact + hash3(c, i * 7 + 1, 3, F.seed)));
        if (want <= have[s]) continue;
        const r = F.rows[i];
        let hi = -1;
        if (r.group && r.group[1] > 1) {
          for (let j = 0; j < F.hn; j++) if (F.hlive[j] && F.hrow[j] === i && F.hcell[j] === c && F.hcount[j] < r.group[1]) { hi = j; break; }
        }
        for (let ord = 0; ord < want && budget > 0; ord++) {
          if (bits[s] & (1 << ord)) continue;                     // that one is already standing there
          if (F._asks >= FAUNA.samples) return;
          const k = spawn(F, c, i, ctx, hi >= 0 ? hi : undefined, ord, eye);
          if (k === -2) continue;                                 // outside the band: it costs nothing to skip
          budget--;
          if (k < 0) continue;
          F.ord[k] = ord;
          have[s]++; bits[s] |= 1 << ord;
          if (hi < 0 && r.group && r.group[1] > 1) {
            hi = newHerd(F, i, c, k);
            if (hi >= 0) { F.herd[k] = hi; F.hcount[hi] = 1; F.oa[k] = 0; F.ob[k] = 0; }
          }
        }
      }
    }
  }
}

// ---- the day ---------------------------------------------------------------------------------------------
// ONE COSINE per species and nothing else: a nocturnal animal is the same row with its peak shifted, and dusk
// empties the meadow and fills the wood with no script at all.
export function activity(r, day01) {
  return clamp01(r.base + r.amp * Math.cos(6.283185307 * (day01 - r.peak)));
}

// ---- thinking ----------------------------------------------------------------------------------------------
// A think is: take the largest need, pick somewhere to go, set the state. It happens four times a second (ten
// while hunting), never every frame, and it is the only place a decision is made.

// SOMETHING WORTH WATCHING HAPPENED, within FAUNA.eventR of the player: a head coming up, a head going down,
// a flock lifting, a stalk, a kill. One integer, and it is what turns "does the wood feel alive" from an
// argument into a number two builds can be compared on (the design's own ask).
function bumpEvent(F, k) { if (F.deye[k] < FAUNA.eventR * FAUNA.eventR) F.prof.events++; }
function setGoalAhead(F, k, dist, turn) {
  const A = F.agents, i = k * 3;
  const px = F.pw[i], py = F.pw[i + 1], pz = F.pw[i + 2];
  const il = 1 / (Math.sqrt(px * px + py * py + pz * pz) || 1);
  const ux = px * il, uy = py * il, uz = pz * il;
  let fx = A.fwd[i], fy = A.fwd[i + 1], fz = A.fwd[i + 2];
  if (turn !== 0) {
    // turn the heading about the local up by `turn` radians
    eastNorth(ux, uy, uz, F._en, 0);
    const e = fx * F._en[0] + fy * F._en[1] + fz * F._en[2];
    const n = fx * F._en[3] + fy * F._en[4] + fz * F._en[5];
    const c = Math.cos(turn), s = Math.sin(turn);
    const e2 = e * c - n * s, n2 = e * s + n * c;
    fx = F._en[0] * e2 + F._en[3] * n2; fy = F._en[1] * e2 + F._en[4] * n2; fz = F._en[2] * e2 + F._en[5] * n2;
  }
  F.goal[i] = px + fx * dist; F.goal[i + 1] = py + fy * dist; F.goal[i + 2] = pz + fz * dist;
}
function setGoalAt(F, k, x, y, z) { const i = k * 3; F.goal[i] = x; F.goal[i + 1] = y; F.goal[i + 2] = z; }
// turn the heading itself about the local up, now, by `a` radians (the tumble: a goal alone would be steered
// toward at the turn rate, and the point of a tumble is that it is a decision and not a manoeuvre)
function turnBy(F, k, a) {
  const A = F.agents, i = k * 3;
  const px = F.pw[i], py = F.pw[i + 1], pz = F.pw[i + 2];
  const il = 1 / (Math.sqrt(px * px + py * py + pz * pz) || 1);
  eastNorth(px * il, py * il, pz * il, F._en, 0);
  const e = A.fwd[i] * F._en[0] + A.fwd[i + 1] * F._en[1] + A.fwd[i + 2] * F._en[2];
  const n = A.fwd[i] * F._en[3] + A.fwd[i + 1] * F._en[4] + A.fwd[i + 2] * F._en[5];
  const c = Math.cos(a), s = Math.sin(a), e2 = e * c - n * s, n2 = e * s + n * c;
  A.fwd[i] = F._en[0] * e2 + F._en[3] * n2;
  A.fwd[i + 1] = F._en[1] * e2 + F._en[4] * n2;
  A.fwd[i + 2] = F._en[2] * e2 + F._en[5] * n2;
}

// the quarry: the nearest thing on its menu that has NOT noticed it. O(n) and it is the only O(n) thing here,
// so it is behind two gates: the hunter must be hungry, and it may only look every FAUNA.huntScan seconds.
function findPrey(F, k) {
  const r = F.rows[F.row[k]], menu = r.eats;
  if (!menu) return -1;
  const i = k * 3, px = F.pw[i], py = F.pw[i + 1], pz = F.pw[i + 2];
  const R2 = FAUNA.huntRange * FAUNA.huntRange;
  let best = -1, bestScore = 1e18;
  for (let j = 0; j < F.n0; j++) {
    if (j === k) continue;
    const rj = F.rows[F.row[j]];
    if (!(menu & (1 << rj.guild))) continue;
    const o = j * 3, dx = F.pw[o] - px, dy = F.pw[o + 1] - py, dz = F.pw[o + 2] - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > R2) continue;
    // the unwary one, and the near one: a real hunter picks the animal that has not seen it
    const score = d2 * (1 + 4 * F.fear[j]);
    if (score < bestScore) { bestScore = score; best = j; }
  }
  F.prof.scans++;
  return best;
}

function think(F, k, ctx) {
  const A = F.agents, r = F.rows[F.row[k]], i = k * 3, sp = F.row[k] * 3;
  const hunting = F.st[k] === FSTATE.STALK || F.st[k] === FSTATE.HUNT;
  F.think[k] = F.time + (hunting ? FAUNA.huntThink : FAUNA.thinkEvery);
  F.prof.thinks++;
  const was = F.st[k];
  const walk = F._spd[sp], run = F._spd[sp + 2];       // (the trot, _spd[sp+1], is read by publish, not here)

  // 1. FRIGHT comes before everything.
  if (F.fear[k] > FAUNA.fleeFear) {
    F.st[k] = FSTATE.FLEE;
    // IT RUNS AT ITS OWN SPEED. Fear decides WHETHER it runs, never how fast: scaling the speed by the fear
    // as well made a quarry that had got clear slow down as its fright wore off and be caught by a hunter
    // slower than itself -- MEASURED, a hare at 12.5 m/s taken by a fox at 11. What slows it is being spent.
    F.want[k] = run * (0.4 + 0.6 * F.stam[k]);
    F.tgt[k] = -1;
    // away from whatever frightened it most: the nearest fright in the air, else straight on
    let bx = 0, by = 0, bz = 0, bw = 0;
    for (let a = 0; a < F.alarms.count; a++) {
      const al = F.alarms[a];
      const dx = F.pw[i] - al.x, dy = F.pw[i + 1] - al.y, dz = F.pw[i + 2] - al.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      if (d > al.r) continue;
      const w = al.s * (1 - d / al.r) / d;
      bx += dx * w; by += dy * w; bz += dz * w; bw += w;
    }
    if (bw > 0) setGoalAt(F, k, F.pw[i] + bx / bw * 40, F.pw[i + 1] + by / bw * 40, F.pw[i + 2] + bz / bw * 40);
    else setGoalAhead(F, k, 40, 0);
    return;
  }
  if (F.fear[k] > FAUNA.alertFear) {
    F.st[k] = FSTATE.ALERT; F.want[k] = 0; F.tgt[k] = -1;
    if (was !== FSTATE.ALERT) bumpEvent(F, k);          // a head coming up: the thing the owner will watch for
    return;
  }

  // 2. STANDING AND STRIKING (a heron): it does not chase, it waits at the water and strikes.
  if (r.strike && FAUNA.hunt) {
    if (F.st[k] === FSTATE.HUNT) { F.st[k] = FSTATE.STAND; F.want[k] = 0; return; }
    const atWater = F.lq[k] > F.gs[k] - 0.6;
    if (!atWater) {
      // not at the water yet: walk to the wettest quarter of its cell. A heron away from water is not
      // striking at dry ground -- the strike below is only ever made standing in it.
      F.st[k] = FSTATE.WALK; F.want[k] = walk;
      waterPlaceOf(F, F.cell[k], F._d);
      setGoalAt(F, k, F._d[0] * F.gr[k], F._d[1] * F.gr[k], F._d[2] * F.gr[k]);
      return;
    }
    if (F.time >= F.cool[k]) {
      F.cool[k] = F.time + FAUNA.strikeEvery * (0.6 + 0.8 * hash3(k, (F.time | 0), 3, F.seed));
      F.st[k] = FSTATE.HUNT; F.want[k] = 0;
      bumpEvent(F, k);
      // it takes what is in the water under it: the ledger's own fish, against what the place could hold
      const c = F.cell[k], K = capacity(F, c, GUILD.fish);
      const plenty = K > 1e-6 ? clamp01(F.n[c * NGUILD + GUILD.fish] / K) : 0;
      if (hash3(k, (F.time * 7) | 0, 11, F.seed + 5) < plenty * 0.75) {
        F.n[c * NGUILD + GUILD.fish] = Math.max(0, F.n[c * NGUILD + GUILD.fish] - 1);
        F.hunger[k] = 0;
        writeKill(F, F.pw[i], F.pw[i + 1], F.pw[i + 2], -1, GUILD.fish, F.row[k], 0.1);
      }
      return;
    }
    F.st[k] = FSTATE.STAND; F.want[k] = 0;        // standing still between strikes, which costs nothing at all
    return;
  }

  // 3. HUNTING. A hunter that is hungry enough looks for something unwary, stalks it, and rushes.
  if (FAUNA.hunt && r.chase && F.hunger[k] > FAUNA.huntHunger && F.time >= F.cool[k]) {
    if (F.tgt[k] < 0 && F.time >= F.scanAt[k]) {
      F.scanAt[k] = F.time + FAUNA.huntScan;
      F.tgt[k] = findPrey(F, k);
      if (F.tgt[k] >= 0) { F.stam[k] = 1; bumpEvent(F, k); }
    }
    const q = F.tgt[k];
    if (q >= 0 && q < F.n0) {
      const o = q * 3, dx = F.pw[o] - F.pw[i], dy = F.pw[o + 1] - F.pw[i + 1], dz = F.pw[o + 2] - F.pw[i + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > FAUNA.huntRange * 1.3) { F.tgt[k] = -1; F.st[k] = FSTATE.WALK; F.want[k] = walk; return; }
      // it aims a little ahead of where the prey is, which is what makes a chase read as a chase
      const lead = F.st[k] === FSTATE.HUNT ? 0.4 : 0;
      setGoalAt(F, k, F.pw[o] + F.agents.fwd[o] * F.agents.speed[q] * lead,
        F.pw[o + 1] + F.agents.fwd[o + 1] * F.agents.speed[q] * lead,
        F.pw[o + 2] + F.agents.fwd[o + 2] * F.agents.speed[q] * lead);
      if (F.st[k] === FSTATE.HUNT || d < FAUNA.rushRange || F.fear[q] > FAUNA.alertFear) {
        if (F.st[k] !== FSTATE.HUNT) {
          F.st[k] = FSTATE.HUNT; F.stam[k] = 1; bumpEvent(F, k);
          // THE RUSH IS WHAT THE WOOD NOTICES. It goes into the same list every other fright goes into, so the
          // quarry knows which way to run, the herd's heads come up together, and nothing needed a new system.
          scare(F, F.pw[i], F.pw[i + 1], F.pw[i + 2], FAUNA.rushRange * 2.5, 1, 0, r.guild);
        }
        F.want[k] = run * (0.45 + 0.55 * F.stam[k]);     // a tiring hunter falls off the pace, and you can see it
      } else {
        F.st[k] = FSTATE.STALK; F.want[k] = walk * FAUNA.stalkSpeed;
      }
      return;
    }
  }
  F.tgt[k] = -1;

  // 4. THE DAY. Below `sleepy` it is not awake at all; that is the whole of being nocturnal.
  const act = activity(r, ctx.day01 == null ? 0.5 : ctx.day01);
  if (act < 0.3) {
    F.st[k] = F.tired[k] > 0.4 ? FSTATE.SLEEP : FSTATE.REST;
    F.want[k] = 0;
    return;
  }

  // 5. THE LARGEST NEED.
  if (F.thirst[k] > 0.55 && F.thirst[k] > F.hunger[k]) {
    if (F.lq[k] > F.gs[k] - 1.2) { F.st[k] = FSTATE.DRINK; F.want[k] = 0; return; }
    const h = F.cell[k] * 4;
    if (F.hab[h + 3] > 10) {                         // the cell has water somewhere: walk the way it lies
      F.st[k] = FSTATE.WALK; F.want[k] = walk;
      waterPlaceOf(F, F.cell[k], F._d);
      setGoalAt(F, k, F._d[0] * F.gr[k], F._d[1] * F.gr[k], F._d[2] * F.gr[k]);
      return;
    }
  }
  if (F.tired[k] > 0.8) { F.st[k] = FSTATE.REST; F.want[k] = 0; return; }

  // A HUNTER DOES NOT GRAZE. It was allowed to, and then it never got hungry enough to hunt: MEASURED, two
  // foxes in a band of 58 made no kill and did not stalk once in thirty game-minutes, because between 0.2 and
  // 0.55 of hunger they stood with their heads down in the grass losing it again.
  if (F.hunger[k] > 0.2 && !r.chase) {
    // FEEDING IS A RHYTHM, NOT A STATE: head down four to eight seconds, up one or two, two steps, down again.
    // The stillness is what makes the movement land, and it is six lines.
    if (F.time >= F.cool[k]) {
      const u = hash3(k, (F.time * 2) | 0, 5, F.seed);
      if (F.st[k] === FSTATE.GRAZE) {
        F.cool[k] = F.time + mix(FAUNA.grazeUp[0], FAUNA.grazeUp[1], u);
        // two steps, not a stroll: fast enough that the walk covers more than FAUNA.resample metres, so the
        // ground really is asked about again between one mouthful and the next (that is what the turning below
        // is comparing, and with a shorter step it was comparing a sample with itself)
        F.st[k] = FSTATE.WALK; F.want[k] = walk * 0.85;
        setGoalAhead(F, k, 12, (hash3(k, (F.time * 2) | 0, 13, F.seed) - 0.5) * 0.5);
      } else {
        F.cool[k] = F.time + mix(FAUNA.grazeDown[0], FAUNA.grazeDown[1], u);
        F.st[k] = FSTATE.GRAZE; F.want[k] = 0;
        if (was !== FSTATE.GRAZE) bumpEvent(F, k);
      }
    }
    return;
  }

  // 6. nothing wanted: stand with the herd, or wander.
  const hi = F.herd[k];
  if (hi >= 0 && F.hlive[hi]) {
    // the herd's record is the leader: a member does what the herd is doing and walks to its own place in it,
    // which the per-frame pull below already sets. Nothing here searches for a neighbour.
    const moving = F.hst[hi] === FSTATE.WALK;
    F.st[k] = moving ? FSTATE.WALK : FSTATE.STAND;
    F.want[k] = moving ? walk : 0;
    return;
  }
  if (F.st[k] !== FSTATE.WALK || F.time >= F.cool[k]) {
    F.cool[k] = F.time + 4 + 6 * hash3(k, (F.time * 2) | 0, 9, F.seed);
    F.st[k] = FSTATE.WALK; F.want[k] = walk;
    setGoalAhead(F, k, FAUNA.wander, (hash3(k, (F.time * 2) | 0, 17, F.seed) - 0.5) * 1.6);
  }
}

// ---- the herds ------------------------------------------------------------------------------------------------
// ONE RECORD walks and the members are springs on it, so a herd of nine costs what a herd of one costs. The
// record is the leader: it decides where to feed and when to go, by the same run-and-tumble its members use.
function stepHerds(F, dt, ctx) {
  for (let h = 0; h < F.hn; h++) {
    if (!F.hlive[h] || F.hcount[h] === 0) continue;
    const i = h * 3, sp = F.hrow[h] * 3;
    if (F.time >= F.hthink[h]) {
      F.hthink[h] = F.time + 2.0;
      // where the ground is better. It asks the world ONCE every two seconds per herd -- 24 herds is 12 asks a
      // second at the very most, and in a wood it is two or three.
      if (F._asks < FAUNA.samples) {
        const o = F._g, il = 1 / (Math.sqrt(F.hp[i] * F.hp[i] + F.hp[i + 1] * F.hp[i + 1] + F.hp[i + 2] * F.hp[i + 2]) || 1);
        o.lq = NOLIQ;
        ctx.groundAt(F.bodyId, F.hp[i] * il * F.R, F.hp[i + 1] * il * F.R, F.hp[i + 2] * il * F.R, o);
        F._asks++;
        F.hgr[h] = o.r;
        const v = o.under * 0.7 + o.glade * 0.3;
        // run and tumble: hold the line while it improves, turn when it does not
        const turn = v + 0.02 < F.hfood[h] ? (hash3(h, (F.time | 0), 23, F.seed) - 0.5) * 2.6 : (hash3(h, (F.time | 0), 29, F.seed) - 0.5) * 0.5;
        F.hfood[h] = v;
        eastNorth(F.hp[i] * il, F.hp[i + 1] * il, F.hp[i + 2] * il, F._en, 0);
        const e = F.hf[i] * F._en[0] + F.hf[i + 1] * F._en[1] + F.hf[i + 2] * F._en[2];
        const n = F.hf[i] * F._en[3] + F.hf[i + 1] * F._en[4] + F.hf[i + 2] * F._en[5];
        const c = Math.cos(turn), s = Math.sin(turn), e2 = e * c - n * s, n2 = e * s + n * c;
        F.hf[i] = F._en[0] * e2 + F._en[3] * n2; F.hf[i + 1] = F._en[1] * e2 + F._en[4] * n2; F.hf[i + 2] = F._en[2] * e2 + F._en[5] * n2;
      }
      // a herd stands still most of the time and moves on now and then: it is grazing, not marching
      const move = hash3(h, (F.time * 0.5) | 0, 31, F.seed) < 0.45;
      F.hv[h] = move ? F._spd[sp] * 0.5 : 0;
      F.hst[h] = move ? FSTATE.WALK : FSTATE.GRAZE;
    }
    if (F.hv[h] > 0) {
      const d = F.hv[h] * dt;
      F.hp[i] += F.hf[i] * d; F.hp[i + 1] += F.hf[i + 1] * d; F.hp[i + 2] += F.hf[i + 2] * d;
      const il = F.hgr[h] / (Math.sqrt(F.hp[i] * F.hp[i] + F.hp[i + 1] * F.hp[i + 1] + F.hp[i + 2] * F.hp[i + 2]) || 1);
      F.hp[i] *= il; F.hp[i + 1] *= il; F.hp[i + 2] *= il;
    }
  }
}

// ---- one frame -------------------------------------------------------------------------------------------------
const _now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export function stepFauna(F, dt, ctx) {
  if (!(dt > 0)) dt = 0;
  if (dt > 0.1) dt = 0.1;                       // a hitch does not teleport a wood
  F.time += dt;
  if (ctx.bodyId !== F.bodyId) resetBody(F, ctx);
  // THE EMPTY WORLD'S WHOLE COST: two comparisons. Nothing near, no tick due -- nothing happens, and the
  // clock is not even read (performance.now() alone is tens of nanoseconds, which would be most of this).
  if (F.n0 === 0 && F.time < F.stockAt && F.time < F.sweepAt) { F.prof.ms = 0; return F; }

  const t0 = _now();
  F._asks = 0;
  F.prof.thinks = 0; F.prof.spawns = 0; F.prof.scans = 0; F.prof.kills = 0;
  if (F.time >= F.sweepAt) sweep(F, ctx);
  if (F.time >= F.stockAt) stock(F, ctx);
  if (F.n0 === 0) { F.agents.n = 0; F.prof.asks = F._asks; F.prof.near = 0; F.prof.ms = _now() - t0; return F; }

  // how fast the player is going, so that STANDING STILL is the thing that lets you see animals
  const eye = ctx.eye;
  if (eye) {
    if (F._eyeOk) {
      const dx = eye.x - F._eye[0], dy = eye.y - F._eye[1], dz = eye.z - F._eye[2];
      F._eyeV = dt > 1e-4 ? Math.sqrt(dx * dx + dy * dy + dz * dz) / dt : 0;
    }
    F._eye[0] = eye.x; F._eye[1] = eye.y; F._eye[2] = eye.z; F._eyeOk = true;
  }

  ageAlarms(F, dt);
  stepHerds(F, dt, ctx);
  stepBand(F, dt, ctx);
  publish(F);
  F.prof.asks = F._asks; F.prof.near = F.n0;
  F.prof.ms = _now() - t0;
  return F;
}

function stepBand(F, dt, ctx) {
  const A = F.agents, eye = F._eyeOk ? F._eye : null;
  const fearK = Math.pow(0.5, dt / FAUNA.fearHalf);
  const eyeQuiet = F._eyeV < FAUNA.eyeStill ? 0.45 : 1;
  const nAl = F.alarms.count;

  for (let k = 0; k < F.n0; k++) {
    const i = k * 3, ri = F.row[k], r = F.rows[ri], sp = ri * 3;
    // ---- needs. They only rise; feeding, drinking and sleeping take them down.
    const st = F.st[k];
    F.hunger[k] = clamp01(F.hunger[k] + dt / r.hungry
      - (st === FSTATE.GRAZE || st === FSTATE.FEED ? dt * FAUNA.feedRate * (0.3 + 0.7 * F.food[k]) : 0));
    F.thirst[k] = clamp01(F.thirst[k] + dt / FAUNA.thirstTime - (st === FSTATE.DRINK ? dt * FAUNA.drinkRate : 0));
    F.tired[k] = clamp01(F.tired[k] + dt * (A.speed[k] > F._spd[sp + 1] ? 3 / FAUNA.tireTime : 1 / FAUNA.tireTime)
      - (st === FSTATE.REST || st === FSTATE.SLEEP ? dt * FAUNA.restRate : 0));
    // stamina: it comes back when it is not running
    F.stam[k] = clamp01(F.stam[k] + (A.speed[k] > F._spd[sp + 1] ? -dt / r.sprint : dt / (r.sprint * 2.5)));

    // ---- fright. The list is nearly always empty, and then this is ONE comparison.
    let fear = F.fear[k] * fearK;
    // A COMMITTED HUNTER IS NOT EASILY SPOOKED, and more to the point it must not be frightened by the alarm
    // ITS OWN RUSH raised a moment ago. (MEASURED: it was, and two starving foxes made no kill in five
    // minutes, standing alert three quarters of the time.) The player still frightens it; the wood does not.
    const chasing = st === FSTATE.HUNT || st === FSTATE.STALK;
    if (nAl > 0 && !chasing) {
      for (let a = 0; a < nAl; a++) {
        const al = F.alarms[a];
        // A BLACKBIRD SHOUTING IS NOT A FRIGHT TO A FOX. Without this one comparison every hunter in the wood
        // is held at its alert threshold by the alarm of the very animal it is stalking, and nothing is ever
        // caught: MEASURED, two starving foxes in a band of 62 spent 74 per cent of five minutes standing with
        // their heads up and made no kill at all.
        if (al.g >= 0 && (r.eats & (1 << al.g))) continue;
        const dx = F.pw[i] - al.x, dy = F.pw[i + 1] - al.y, dz = F.pw[i + 2] - al.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > al.r * al.r) continue;
        const f = al.s * (1 - Math.sqrt(d2) / al.r) * r.shy;
        if (f > fear) fear = f;
      }
    }
    // the player. Near and moving: a fright. STANDING STILL IS HALF AS FRIGHTENING, which is the one thing
    // this whole system has to teach the player -- that standing still is how you see anything.
    if (eye) {
      const dx = F.pw[i] - eye[0], dy = F.pw[i + 1] - eye[1], dz = F.pw[i + 2] - eye[2];
      const d2 = dx * dx + dy * dy + dz * dz, fl = r.flee;
      F.deye[k] = d2;
      if (d2 < fl * fl) {
        const f = (1 - Math.sqrt(d2) / fl) * r.shy * eyeQuiet;
        if (f > fear) fear = f;
      }
    }
    // A FRIGHT IS NOT ON A ROTA. Everything else happens on the think's own quarter-second beat, but an
    // animal that has just crossed into running does it NOW -- a quarter of a second of standing there is
    // four metres to a fox. One comparison a frame to buy it.
    if (fear > FAUNA.fleeFear && F.fear[k] <= FAUNA.fleeFear) F.think[k] = 0;
    F.fear[k] = fear;
    // ITS OWN ALARM, and the one rule that has to be held down or the whole wood panics at nothing: an alarm
    // may pass twice and no further, and the same animal may not raise one again for `callAgain` seconds.
    if (!FAUNA.calm && fear > FAUNA.callFear && F.time >= F.called[k] && F.alarms.count < FAUNA.alarms) {
      let hop = 0;
      for (let a = 0; a < nAl; a++) {
        const al = F.alarms[a];
        const dx = F.pw[i] - al.x, dy = F.pw[i + 1] - al.y, dz = F.pw[i + 2] - al.z;
        if (dx * dx + dy * dy + dz * dz < al.r * al.r && al.hop >= hop) hop = al.hop + 1;
      }
      if (hop <= FAUNA.alarmHops) {
        F.called[k] = F.time + FAUNA.callAgain;
        scare(F, F.pw[i], F.pw[i + 1], F.pw[i + 2], r.callR, fear * 0.85, hop, r.guild);
        bumpEvent(F, k);
      }
    }

    // ---- think, on its own beat
    if (F.time >= F.think[k]) think(F, k, ctx);

    // ---- the herd pulls it back. O(1): its own place in the herd, not a search for neighbours.
    const hi = F.herd[k];
    if (hi >= 0 && F.hlive[hi] && F.st[k] !== FSTATE.FLEE && F.st[k] !== FSTATE.HUNT) {
      const o = hi * 3;
      const il = 1 / (Math.sqrt(F.hp[o] * F.hp[o] + F.hp[o + 1] * F.hp[o + 1] + F.hp[o + 2] * F.hp[o + 2]) || 1);
      eastNorth(F.hp[o] * il, F.hp[o + 1] * il, F.hp[o + 2] * il, F._en, 0);
      const gx = F.hp[o] + F._en[0] * F.oa[k] + F._en[3] * F.ob[k];
      const gy = F.hp[o + 1] + F._en[1] * F.oa[k] + F._en[4] * F.ob[k];
      const gz = F.hp[o + 2] + F._en[2] * F.oa[k] + F._en[5] * F.ob[k];
      const dx = gx - F.pw[i], dy = gy - F.pw[i + 1], dz = gz - F.pw[i + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // it only comes back when it has drifted: a herd that marched to its spot would be a parade
      if (d > F.hspread[hi] * 0.6) {
        setGoalAt(F, k, gx, gy, gz);
        if (F.want[k] < F._spd[sp] * 0.6) F.want[k] = F._spd[sp] * (d > F.hspread[hi] * 2 ? 1.4 : 0.7);
        if (F.st[k] === FSTATE.GRAZE || F.st[k] === FSTATE.STAND) F.st[k] = FSTATE.WALK;
      }
    }

    // ---- the chase resolves here, every frame, on the gap and the stamina. No dice roll: the player can see
    // who is going to win, which is the whole of why this is worth watching.
    const q = F.tgt[k];
    if (q >= 0 && q < F.n0 && (F.st[k] === FSTATE.HUNT || F.st[k] === FSTATE.STALK)) {
      const o = q * 3, dx = F.pw[o] - F.pw[i], dy = F.pw[o + 1] - F.pw[i + 1], dz = F.pw[o + 2] - F.pw[i + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (F.st[k] === FSTATE.HUNT) {
        // the quarry knows about it now
        const want = 1 - Math.sqrt(d2) / (FAUNA.rushRange * 2.5);
        if (want > F.fear[q]) F.fear[q] = clamp01(want);
        if (d2 < FAUNA.catchR * FAUNA.catchR) { takeIt(F, k, q); continue; }
        if (F.stam[k] <= 0.02) {               // spent: it gives up, and the one that got away walks off shaking
          F.st[k] = FSTATE.ALERT; F.tgt[k] = -1; F.want[k] = 0;
          F.cool[k] = F.time + FAUNA.giveUp;
          bumpEvent(F, k);
        }
      }
    }

    // ---- steer, and move.
    stepOne(F, k, dt, ctx);
  }
}

// one animal's metre of ground: turn toward the goal, ease the speed, walk, keep to the ground, advance the stride
function stepOne(F, k, dt, ctx) {
  const A = F.agents, i = k * 3, ri = F.row[k], r = F.rows[ri], sp = ri * 3;
  const px = F.pw[i], py = F.pw[i + 1], pz = F.pw[i + 2];
  const il = 1 / (Math.sqrt(px * px + py * py + pz * pz) || 1);
  const ux = px * il, uy = py * il, uz = pz * il;
  // the goal, flattened onto the ground
  let gx = F.goal[i] - px, gy = F.goal[i + 1] - py, gz = F.goal[i + 2] - pz;
  const gd = gx * ux + gy * uy + gz * uz;
  gx -= ux * gd; gy -= uy * gd; gz -= uz * gd;
  const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
  let fx = A.fwd[i], fy = A.fwd[i + 1], fz = A.fwd[i + 2];
  let want = F.want[k];
  if (gl > FAUNA.arrive && want > 0) {
    const k2 = 1 / gl; gx *= k2; gy *= k2; gz *= k2;
    // turn toward it at a rate, never instantly: turning takes room, which is the fourth of the five things
    const rate = (want > F._spd[sp + 1] ? FAUNA.turnRun : FAUNA.turn) * dt;
    const t = rate > 1 ? 1 : rate;
    fx += (gx - fx) * t; fy += (gy - fy) * t; fz += (gz - fz) * t;
  } else if (want > 0 && gl <= FAUNA.arrive) want = 0;
  // keep the heading tangent and unit
  const fd = fx * ux + fy * uy + fz * uz;
  fx -= ux * fd; fy -= uy * fd; fz -= uz * fd;
  let flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
  if (flen < 1e-6) { fx = -uy; fy = ux; fz = 0; flen = Math.sqrt(fx * fx + fy * fy) || 1; }
  const fk = 1 / flen; fx *= fk; fy *= fk; fz *= fk;
  A.fwd[i] = fx; A.fwd[i + 1] = fy; A.fwd[i + 2] = fz;

  // NOTHING STARTS OR STOPS INSTANTLY: up to speed over FAUNA.accel seconds, down over FAUNA.decel.
  const v0 = A.speed[k];
  const tau = want > v0 ? (F.st[k] === FSTATE.FLEE ? FAUNA.bolt : FAUNA.accel) : FAUNA.decel;
  let v = v0 + (want - v0) * Math.min(1, dt / tau);
  if (v < 1e-4) v = 0;
  A.speed[k] = v;

  const ds = v * dt;
  if (ds > 0) {
    F.pw[i] = px + fx * ds; F.pw[i + 1] = py + fy * ds; F.pw[i + 2] = pz + fz * ds;
    F.moved[k] += ds;
    // THE STRIDE IS ADVANCED BY GROUND COVERED, never by time, so a planted foot cannot creep. The stride's
    // length is the engine's own gait law (explorer.js gaitOf) and is worked out only when the speed has
    // really changed -- not every frame, because it costs two pow() calls.
    if (v > 0.05 && (F.strideV[k] <= 0 || Math.abs(v - F.strideV[k]) > 0.22 * F.strideV[k])) {
      gaitOf(v, F.g, r.T, F._gait, 0);
      F.stride[k] = Math.max(0.15, F._gait.step * 2);      // one stride is two steps
      F.strideV[k] = v;
    }
    let ph = A.phase[k] + ds / F.stride[k];
    A.phase[k] = ph - Math.floor(ph);
  }

  // THE GROUND, on its own slow clock. Between asks it is carried forward on the slope measured last time, so
  // it does not bob, and the error at the next ask is taken up over a tenth of a second instead of stepping.
  if (F.moved[k] >= FAUNA.resample && F._asks < FAUNA.samples) {
    const o = F._g, p2 = 1 / (Math.sqrt(F.pw[i] * F.pw[i] + F.pw[i + 1] * F.pw[i + 1] + F.pw[i + 2] * F.pw[i + 2]) || 1);
    o.lq = NOLIQ;
    ctx.groundAt(F.bodyId, F.pw[i] * p2 * F.R, F.pw[i + 1] * p2 * F.R, F.pw[i + 2] * p2 * F.R, o);
    F._asks++;
    const was = F.gs[k];
    F.slp[k] = clamp((o.r - was) / F.moved[k], -1.2, 1.2);
    F.gs[k] = o.r;
    F.moved[k] = 0;
    F.lq[k] = o.lq;
    A.shade[k] = o.canopy;
    const v = o.under * 0.7 + o.glade * 0.3;
    // RUN AND TUMBLE, and it belongs HERE, at the sample, not in the think: the sample IS the measurement. An
    // animal looking for food holds its line while the ground under it is getting better and turns away hard
    // when it is getting worse. That is how a bacterium climbs a gradient without ever knowing which way it
    // runs, it needs no search and no second sample, and it is why a wood's deer end up in the glades.
    // (MEASURED: deciding this on the think's own beat instead compared a sample with itself about half the
    // time, and the food under the grazers FELL from 0.547 to 0.481 over four minutes.)
    const st2 = F.st[k];
    if (F.herd[k] < 0 && F.hunger[k] > 0.2 && (st2 === FSTATE.GRAZE || st2 === FSTATE.WALK)) {
      if (v < F.foodWas[k] - 0.01) {
        const spin = (hash3(k, (F.time * 2) | 0, 13, F.seed) - 0.5) * 3.4;   // a wide turn, either way
        turnBy(F, k, spin);
        setGoalAhead(F, k, 12, 0);
      }
      F.foodWas[k] = v;
    }
    F.food[k] = v;
    F.cell[k] = cellOf(F.pw[i], F.pw[i + 1], F.pw[i + 2]);
  }
  const wet = F.lq[k] > -1e8;                           // NOLIQ (-1e9) means "no liquid here at all"
  const target = (r.water && wet ? F.lq[k] - 0.25 : F.gs[k]) + F.slp[k] * F.moved[k];
  const e = Math.min(1, dt * FAUNA.groundEase);
  F.gr[k] += (target - F.gr[k]) * e;
  const rr = F.gr[k] / (Math.sqrt(F.pw[i] * F.pw[i] + F.pw[i + 1] * F.pw[i + 1] + F.pw[i + 2] * F.pw[i + 2]) || 1);
  F.pw[i] *= rr; F.pw[i + 1] *= rr; F.pw[i + 2] *= rr;

  // the head and the ears, eased: a snap up is 0.15 s, a head going down is slower (models.js' own 9/s ease)
  const st = F.st[k];
  const wantHead = (st === FSTATE.GRAZE || st === FSTATE.DRINK || st === FSTATE.FEED) ? 1
    : st === FSTATE.STALK ? 0.55 : st === FSTATE.HUNT ? 0.3 : 0;
  const hRate = wantHead > A.head[k] ? 3.2 : 9.0;      // down slowly, up at once: that snap IS the animal
  A.head[k] += (wantHead - A.head[k]) * Math.min(1, dt * hRate);
  const wantAlert = st === FSTATE.ALERT ? 1 : st === FSTATE.FLEE ? 0.9 : st === FSTATE.STALK ? 0.8
    : st === FSTATE.HUNT ? 0.7 : F.fear[k];
  A.alert[k] += (wantAlert - A.alert[k]) * Math.min(1, dt * 6);
}

// ---- a kill ------------------------------------------------------------------------------------------------
function writeKill(F, x, y, z, sp, guild, by, meat) {
  const L = F.kills;
  if (L.count >= FAUNA.killsMax) { F.lostKills++; return null; }
  const r = L[L.count++];
  r.bodyId = F.bodyId; r.x = x; r.y = y; r.z = z;
  r.sp = sp; r.guild = guild; r.by = by; r.t = F.time; r.meat = meat; r.id = ++F._killId;
  F.prof.kills++; F.prof.events++;
  return r;
}
function takeIt(F, k, q) {
  const o = q * 3, rq = F.rows[F.row[q]];
  writeKill(F, F.pw[o], F.pw[o + 1], F.pw[o + 2], F.row[q], rq.guild, F.row[k], 1);
  // the ledger loses one where it stood: the wood really is one deer poorer until it grows back
  const c = F.cell[q], b = c * NGUILD + rq.guild;
  F.n[b] = Math.max(0, F.n[b] - 1);
  // everything within earshot heard it
  // the cry is the QUARRY'S, not the hunter's: so the wood hears it and runs, and the hunter standing over it
  // is not frightened by the animal it has just caught
  scare(F, F.pw[o], F.pw[o + 1], F.pw[o + 2], 60, 0.95, 0, rq.guild);
  F.hunger[k] = 0; F.st[k] = FSTATE.FEED; F.want[k] = 0; F.tgt[k] = -1;
  F.cool[k] = F.time + FAUNA.feedTime;
  F.think[k] = F.time + FAUNA.feedTime;
  // The hunter is written BEFORE this, on purpose: if the hunter happens to be the last row, removeAt copies
  // it down into the quarry's slot and everything just written travels with it. The caller's loop then simply
  // runs off the end, which is right -- it has already been stepped this frame.
  removeAt(F, q);
}

// ---- what the drawing reads ----------------------------------------------------------------------------------
// THE CONTRACT WITH world/beasts.js. A struct of arrays; `n` is how many are alive and k runs 0..n-1. Every
// array is written here and read there; none of them is ever reallocated.
//   pos   Float32Array(3n)  where it stands, body-local metres (the planet's centre is the origin)
//   fwd   Float32Array(3n)  the way it faces: a unit vector, already tangent to the ground
//   phase Float32Array(n)   the stride, 0..1, ADVANCED BY GROUND COVERED (two steps to the cycle)
//   speed Float32Array(n)   m/s over the ground
//   state Uint8Array(n)     0 stand 1 walk 2 trot 3 graze 4 alert 5 flee 6 hunt 7 rest (beastkit.js STATE)
//   head  Float32Array(n)   0 head up .. 1 head down to the grass
//   alert Float32Array(n)   0..1 how hard the ears and the tail are working
//   sp    Uint8Array(n)     WHICH ROW of the array makeFauna was given -- the same order beasts.js is built in
//   size  Float32Array(n)   this one's size against its row (a yearling is 0.8)
//   seed  Float32Array(n)   0..1, fixed for its life: its hue, its value, its own clock offset
//   born  Float32Array(n)   ctx.t when it appeared, so it washes in instead of popping
//   shade Float32Array(n)   0..1 how deep under a canopy it stands
// `up` is deliberately NOT published: on a sphere it is the place normalised, which beasts.js already does.
function publish(F) {
  const A = F.agents, n = F.n0;
  for (let k = 0; k < n; k++) {
    const i = k * 3;
    A.pos[i] = F.pw[i]; A.pos[i + 1] = F.pw[i + 1]; A.pos[i + 2] = F.pw[i + 2];
    const st = F.st[k];
    // walk or trot is decided by the speed against the gait change, not by the decision: the animal's legs
    // tell the truth about what it is doing even when its head is somewhere else
    let d = DRAW_STATE[st < NSTATE ? st : 0];
    if (d === FSTATE.WALK && A.speed[k] > F._spd[F.row[k] * 3 + 1]) d = FSTATE.TROT;
    A.state[k] = d;
  }
  A.n = n;
}
