// Painted Cosmos: the elemental powers, the player's side. OWNER: PILOT.
// Only wind exists (docs/POWERS.md). Loaded by main.js when the address says ?powers=1, and not otherwise: without
// the flag there is no `sim.powers`, and sim.js makes one comparison a frame.
//
// What this does each frame (Powers.update, called by sim.updatePhysics before the physics steps):
//   reads the hands on the power (a key, the right mouse button, a bumper, the touch button of ui/powers.js),
//   works out the aim (where the view looks, along the ground from the explorer),
//   casts or holds the chosen ability by adding a shape of moving air to the list (physics/powers.js),
//   and ages the list. The physics takes the list from sim (f.winds) and everything that reads the air answers.
// Nothing here draws, and nothing here moves a leaf: the world's own systems do.
import { makeWinds, castGust, castZone, castOrb, castVortex, castPart, castRip, KIND, moveWind, growWind, turnWind, releaseWind, stepWinds, partedAt, WINDPOWER } from '../physics/powers.js';
import { S } from './state.js';
import { fellTree, felledAt, healFelled } from '../data/felled.js';
// FIRE (the second element; docs/POWERS-FIRE.md). The list of burning patches lives here with the winds; the physics
// steps it, because only the physics knows what is underfoot and what the wind is there. What the fire leaves behind
// goes into the record that lasts, exactly as a felled tree does.
import { makeFires, douseFires, clearBurns, FIRE, FUEL } from '../physics/fire.js';
import { makeTimes, castTime, stepTimes, TIMEPOWER } from '../physics/times.js';
import { scorch, meltIce, deepenMelt, healBurnt } from '../data/burnt.js';
import { SEASON } from '../data/season.js';
import { stripStep } from '../data/stripped.js';

// WHY A FIRE WOULD NOT TAKE, in the words the player sees. The key is what the world handed back
// (src/physics/index.js fuelAt, `why`); anything not listed falls back to the old catch-all.
const FIRE_WHY = {
  water: 'the water will not take it',
  'too far: nobody has looked at the ground there': 'too far away to light',
  'burnt already': 'this ground has burned already',
  'bare ground': 'nothing here will burn',
  'the ground there has no height': 'nothing here will burn',
  'off-world': 'nothing here will burn',
};
// THE ONE REFUSAL THAT IS ABOUT DISTANCE and not about the ground, in the world's own words
// (src/physics/index.js fuelAt): outside the air grid's own +/-128 m nobody has looked at the ground at all, so no
// fire may be lit there. The aim reaches 300 m now (_aim below) and the fire does not, so a fire ability that
// lights nothing must say THAT and not 'nothing here will burn', which sends the player looking for better ground
// when the ground was never the matter.
const FIRE_TOO_FAR = 'too far: nobody has looked at the ground there';

// THE AIM'S OWN SWITCH (?aimray=0), so the owner can be shown A and B of the same still and can turn it off.
// Off: the aim is exactly the pitch rule of every version up to v32 -- 6 m looking steeply down, 30 m level -- and
// no power ever lands further than thirty metres away. On (the default): the view is marched against the real land
// out to POWERS.aimMax, and the aim, the ring and the fold go to what it meets.
const AIM_RAY = (() => {
  try { const q = new URLSearchParams(location.search).get('aimray'); return q == null ? true : q !== '0'; }
  catch { return true; }                                   // (no address to read: Node, the tests, the gallery)
})();

// THE FOLD'S OWN SWITCH (?foldair=0), the second half of the same day's work and separate from the aim's, so the
// owner can be shown either on its own. Off: the v32 fold exactly -- one gust cast at the far end whose front
// crawls out at 26 m/s while the explorer travels at 180, a landing that may be on the face of a lake, and a dead
// stop on arrival. On (the default): the air is carried with the player, the fold stops short of deep water, and
// you land running (see _fold, _dryStop, _stepFold).
const FOLD_AIR = (() => {
  try { const q = new URLSearchParams(location.search).get('foldair'); return q == null ? true : q !== '0'; }
  catch { return true; }
})();

// The abilities of wind, in the order of the keys 1 .. 7 and of the touch fan. hold: it lasts while the hand is down.
export const ABILITIES = Object.freeze([
  { id: 'gust', word: 'gust', hold: false },
  { id: 'gather', word: 'gather', hold: true },
  { id: 'quicken', word: 'quicken', hold: false },
  { id: 'still', word: 'still', hold: false },
  { id: 'whirl', word: 'whirl', hold: false },
  { id: 'part', word: 'part', hold: true },
  { id: 'knife', word: 'knife', hold: false },
]);

// FIRE'S abilities, the second element (docs/POWERS-FIRE.md part 1). A SEPARATE frozen list, not more of the wind's:
// tests/powers.test.mjs holds ABILITIES above to exactly the wind's seven, and the fan of words, the keys and the
// element button all read whichever list is current. Only `kindle` is built; melt, embers and snuff are named there.
// (2026-11-19, the owner: "give it 5 new abilities that are fire based ... also make it so that putting on a fire
//  speeds up the fire and also fire tornados can be a thing".) Six now, in the order of the keys 1..6:
//    kindle   set a fire where you look
//    ember    throw a spark FURTHER, over water, over a gap, over a road -- it does not fall short
//    bellows  put air on a fire: a hard short gust at the aim, which the fire's own wind reading picks up and
//             which therefore fans it, speeds its spread and makes it eat its fuel faster. This is the owner's
//             "putting on a fire speeds up the fire", and it is done the honest way -- by making real wind, not
//             by a number that says "this fire is faster now".
//    wall     lay a line of fire across the view: a burning barrier, or a backfire to starve a front
//    snuff    put out everything burning near the aim: the power that can start a forest fire can stop one
//    whirl    raise a fire whirl where a fire is already big enough to make its own column (physics F.whirl)
//    meteor   (2026-11-22) a burning stone falls where you look: a ring of fire lit at once and a blast of air
//             out of it, so the wood bends away from it and the leaves fly
//    lance    a line of fire thrown ALONG the aim, from your feet to as far as you can see -- where the wall is
//             laid ACROSS the view, this is laid down it
//    cinders  a cloud of sparks let go downwind: they land where the wind takes them and light what they land on
export const FIRE_ABILITIES = Object.freeze([
  { id: 'kindle', word: 'kindle', hold: false },
  { id: 'ember', word: 'ember', hold: false },
  { id: 'bellows', word: 'bellows', hold: false },
  { id: 'wall', word: 'wall of fire', hold: false },
  { id: 'snuff', word: 'snuff', hold: false },
  { id: 'firewhirl', word: 'fire whirl', hold: false },
  { id: 'meteor', word: 'meteor', hold: false },
  { id: 'lance', word: 'lance of fire', hold: false },
  { id: 'cinders', word: 'cinders', hold: false },
]);

// SPACE AND TIME'S abilities, THE THIRD ELEMENT. FOUR of them, in the order of the keys 1 to 4.
//
// THERE WERE TWELVE (2026-11-22, the first design: docs/POWERS-TIME.md). THE OWNER CUT THEM THE SAME DAY:
// "to many space and time abilities cut them down ... the 4 should be overly powerful abilities like a rip in
// space time that sucks everything in a long ways in". So: four, and each one the biggest of its kind. A short
// list of powers that each feel enormous beats a long list of small ones -- which is now a rule for every
// element, not only this one.
//    fold   FOLDING SPACE, and the owner's own word for how it must feel: not a step to where you look, but
//           THE WORLD PULLED TOWARDS YOU -- the ground and the trees rush at you and settle, and you are there
//    rip    A RIP IN SPACE-TIME (the owner's own idea): a tear torn open where you look that draws everything
//           in from a long way off -- the air, the leaves, the dust, the spray, and the trees themselves
//    freeze EVERYTHING INSIDE STOPS, and stays stopped after you walk away ('still the moment'), over a sphere
//           that now holds a wood and not a bush
//    year   THE TURNING YEAR: push the season of the whole world where you stand -- summer, autumn, the bare
//           year, the first green
// CUT, with their code, at the owner's word (they are in the history at v31 and any of them can come back in a
// line): slow, haste, unmake, the sun's hand, the knot, and the four that were never built (the door, the drawn
// eye, the lens, the long mile).
export const TIME_ABILITIES = Object.freeze([
  { id: 'fold', word: 'fold space', hold: false },
  { id: 'rip', word: 'the rip', hold: false },
  { id: 'freeze', word: 'still the moment', hold: false },
  { id: 'year', word: 'the turning year', hold: true },
]);

// THE ELEMENTS IN THE HAND, in the order the element key walks them.
export const ELEMENTS = Object.freeze([
  { n: 0, id: 'wind', word: 'wind', list: ABILITIES },
  { n: 1, id: 'fire', word: 'fire', list: FIRE_ABILITIES },
  { n: 2, id: 'time', word: 'space and time', list: TIME_ABILITIES },
]);

// What the twelve are worth, in one place so the owner can see and change them.
export const TIMEPOWERS = Object.freeze({
  // THE FOLD. It is theatrical now (the owner, 2026-11-22): the world is drawn past you for foldTime seconds and
  // then you are standing where you looked. Nothing teleports in one frame any more.
  foldReach: 3.4,         // times the ordinary aim: how far a fold carries you (about a hundred metres level)
  foldTime: 0.55,         // s the world takes to rush past: long enough to see, short enough not to wait
  foldEase: 2.6,          // how hard the rush eases out at the end (1 is linear; higher arrives softer)
  // (2026-11-22) THE AIM REACHES THE REAL LAND NOW (_aim), so a fold goes to WHERE YOU LOOKED when that is
  // further than the old hundred metres. These five numbers keep that honest and bounded.
  foldMax: 560,           // m: the furthest a fold may carry you. It is what a fold HELD TO THE FULL already
                          // carried you before the aim could see past thirty metres (30 x foldReach x the hold's
                          // own 5), so the cap shortens nothing that exists; it is here because the ground you
                          // land on has to be made while you travel, and because the aim can now say 300 m.
  foldSpeed: 185,         // m/s: the pace of the rush. A hundred metres in 0.55 s is 180 m/s and the owner saw
                          // that and asked for nothing faster, so a LONGER fold now takes longer instead of
                          // going faster: life = distance / this (and the old 0.55 s is its floor).
  foldLifeMax: 1.2,       // s: ... and never longer than this, so the longest fold is a fast one again
  foldLand: 6.5,          // m/s left along the travel when you arrive. Under the body's own run (7.4 m/s,
                          // player/explorer.js runSpeed), so no pace limit of the explorer's has to fight it and
                          // with the hands off the stick it bleeds away in a stride.
  foldAirTail: 0.8,       // s the carried air takes to ease out once the rush is over. Its own gustLife is 3.8 s,
                          // which left a 57 m/s gale standing where you landed for three seconds.
  // THE RIP. A tear held open where you look, which draws everything in from a long way off.
  ripReach: 55,           // m: how far out it takes hold
  ripUlt: 120,            // m: ... and held to the full
  ripLife: 6.5,           // s it stays open
  ripFell: 0.5,           // of its reach: trees within this of the middle are pulled over INWARD
  // STILL THE MOMENT: one of the four big ones now, so the sphere holds a wood and not a bush (physics/times.js
  // TIMEPOWER.radius is 14 m, and this multiplies the size the cast is made at).
  stillSize: 1.9,
  // THE TURNING YEAR
  yearRate: 0.35,         // of a whole turn of the year a second while the hand is down (under three seconds
                          // from high summer to deep autumn: data/season.js)
});

// What the five new ones are worth, all in one place so the owner can see and change them.
export const FIREPOWER = Object.freeze({
  emberFar: 2.1,          // times the ordinary aim: how much further a thrown spark reaches
  bellowsPower: 1.6,      // the gust bellows makes, against an ordinary gust
  bellowsSize: 3,         // and at what size
  wallSpan: 9,            // m: how wide a wall of fire is laid
  wallStep: 2.6,          // m between the patches it is laid in
  snuffR: 7,              // m: how far out a snuff reaches
  snuffUlt: 16,           // m: and held to the full
  whirlR: 10,             // m: a fire whirl must find its fire within this of the aim
  // (2026-11-22, the owner: "Give it cooler abilities as well the fire")
  meteorR: 7,             // m: the ring of fire a meteor lights round where it falls
  meteorN: 9,             // ... and in how many places round that ring
  meteorBlast: 2.4,       // the gust it throws out, against an ordinary one: the wood bends AWAY from it
  meteorUlt: 13,          // m: the ring, held to the full
  lanceStep: 3.4,         // m between the fires a lance lays
  lanceN: 9,              // ... and how many of them, from your feet outward
  cinderN: 7,             // sparks a cloud of cinders lets go
  cinderFar: 16,          // m: how far downwind they may land
  cinderWide: 7,          // m: and how far to either side
});

export const POWERS = Object.freeze({
  hands: 1.15,            // m above the feet: where a gust leaves
  ahead: 0.9,             // m ahead of the explorer: where a gust leaves
  aimNear: 6, aimFar: 30, // m: how far out the aim lies, looking steeply down .. level -- the PITCH rule, which
                          // is now only the floor and the fallback (see _aim and AIM_LADDER)
  aimMax: 300,            // m: how far out the view is marched against the land. The owner, 2026-11-22: "fully
                          // rendered even from 300 yards away" -- 300 yards is 275 m, so the aim must reach past
                          // it or the thing they are looking at can never be the thing a power acts on.
  eye: 1.62,              // m above the feet: where the view's ray leaves. The same eye the first-person camera
                          // uses (player/camera.js, 1.62), because the ray must be the one the player sees along.
  orbAhead: 2.4,          // m ahead of the explorer: where a gathered ball is held at first
  orbSpeed: 13,           // m/s: how fast a held ball follows the aim
  orbReach: 18,           // m: how far out a ball can be carried
  gustEvery: 0.28,        // s: the least time between two gusts (a hand's stroke)
  castPose: 0.5,          // s: how long the explorer's cast shows (figure state: sim.ex.casting, 1 .. 0)
  knifeReach: 18,         // m: how far the wind knife cuts
  knifeWidth: 1.2,        // m: a trunk this near the aim's line (and its own radius more) is cut
  knifeSide: 0.7,         // rad: how far to its own side of the aim a cut tree falls (0: straight away from the explorer)
  meltPerHeat: 0.25,      // m of ice gone for each second of full flame on it (fire.js reports the heat; how deep
                          // that goes is the game's own judgement, and this number is a guess for the owner to see)
});

const add = (a, b, k) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
// How wide what an ability does is at the aim (m, its radius on the ground `dist` metres out): the ring of the aim mark.
const AIM_SIZE = {
  gust: (d) => WINDPOWER.gustRadius + WINDPOWER.gustSpread * d, gather: () => WINDPOWER.orbCore * 1.4, quicken: () => WINDPOWER.zoneRadius,
  still: () => WINDPOWER.zoneRadius, whirl: () => WINDPOWER.vortexRadius, part: () => WINDPOWER.partHalf, knife: () => 0.7,
  // fire: the ring shows the first patch the fire is set down in (physics/fire.js FIRE.litRadius, which is
  // 1.4 m for a tap and 3.8 m held to the full; the size below multiplies this)
  kindle: () => FIRE.litRadius * 0.5,
  // (the five of 2026-11-19) the ember's ring is the spark itself; bellows shows the gust it makes; the wall shows
  // its own span; snuff shows how far it reaches; the whirl shows the ground a turning column would take.
  ember: () => FIRE.litRadius * 0.5,
  bellows: (d) => WINDPOWER.gustRadius + WINDPOWER.gustSpread * d,
  wall: () => FIREPOWER.wallSpan * 0.5,
  snuff: () => FIREPOWER.snuffR,
  firewhirl: () => WINDPOWER.vortexRadius,
  // (the three of 2026-11-22) the ring of fire a meteor lights, the length of the line a lance lays, and how wide
  // a cloud of cinders falls.
  meteor: () => FIREPOWER.meteorR,
  lance: () => FIREPOWER.lanceStep * FIREPOWER.lanceN * 0.5,
  cinders: () => FIREPOWER.cinderWide,
  // SPACE AND TIME (2026-11-22), the four: the rip shows the ground it will take hold of, the stopped sphere its
  // own radius, the fold where you will be standing, and the turning year a small ring (it takes the whole world,
  // so there is no place on the ground to draw).
  rip: () => TIMEPOWERS.ripReach * 0.5,
  freeze: () => TIMEPOWER.radius * TIMEPOWERS.stillSize,
  fold: () => 1.8,
  year: () => 1.6,
};
const unit = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

// THE LADDER THE VIEW IS MARCHED DOWN, in metres from the eye (see _march). Nine rungs: close together near the
// explorer, where a metre of the answer matters, and far apart out at the end, where it does not. The crossing is
// then found by one straight line through the two heights that bracket it, so the aim never sits ON a rung -- a
// plain halving would have left it a quarter of the last gap, which is twenty metres, out at three hundred.
const AIM_LADDER = Object.freeze([6, 12, 22, 40, 70, 110, 160, 220, 300]);
// and how much of it is walked on a frame when nothing is pressed: the whole ladder is walked on the press and on
// the lift, which are the two frames the number is really spent on. Four or five frames to a sweep, so the ring is
// at most 70 ms stale while the player is only looking about, which cannot be seen on a ring.
const AIM_RUNGS = 2;

// HOW FAR OUT AN ABILITY CAN REALLY ACT (m), for the few whose work does NOT happen at the aim: a gust is a pulse
// that leaves the hands and is spent at WINDPOWER.gustReach; the gathered ball is carried on the end of an arm;
// the channel is a length of wind along the ground; the knife is a blade; the lance lays its fires from the feet
// outward. With the aim reaching 300 m their ring would otherwise be drawn on a far ridge where nothing of the
// cast will ever arrive, which is a worse lie than the short aim was.
// An ability NOT in here acts AT the aim and reaches as far as the eye does: wind control, the whirl, the rip, the
// stopped sphere, the fold, and every fire (the fire has a wall of its own at 128 m, which the world itself says).
// A missing entry is a cap of none and never a throw -- the freeze of 2026-11-22 came out of a table with holes.
const AIM_REACH = {
  gust: WINDPOWER.gustReach * 2.5,                    // castGust: reach x (0.5 + 0.5 size), and sizeMax is 4
  bellows: WINDPOWER.gustReach * 2.5,                 // (bellows is a gust from the hands too)
  gather: POWERS.orbReach,
  part: WINDPOWER.partReach * 1.9,                    // castPart: reach x (0.7 + 0.3 size)
  knife: POWERS.knifeReach * 1.9,                     // _knife: reach x (0.7 + 0.3 size)
  lance: FIREPOWER.lanceStep * FIREPOWER.lanceN,
};

export class Powers {
  constructor() {
    this.winds = makeWinds();
    this.ability = 0;
    this.down = false;          // a hand is on the power now (set by the inputs below, or by a test)
    this._was = false;
    this._wait = 0;
    this.orb = null;            // the gathered ball, while held
    this.part = null;           // the parted channel (move water), while held
    // (dist: the one number every ability and the ring read. pitchDist: what the old pitch rule alone would have
    //  said, which is dist's floor and the fold's own reach; ray: what the march of the view against the land
    //  found, 0 for a view that meets nothing. Both are kept here and not added later, because the aim is read
    //  thousands of times and a shape that grows after it is made is a shape that is re-made.)
    this.aim = { ok: false, p: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 1 }, dist: 0, pitchDist: 0, ray: 0, from: { x: 0, y: 0, z: 0 }, size: 0 };
    this.casts = 0;             // how many casts so far (for tests and the read-out)
    // HOLD TO GROW IT (the owner, 2026-11-17): while the power is held the circle grows from 1 to WINDPOWER.sizeMax
    // over chargeTime seconds, and letting go casts it at that size. A tap is the smallest and casts at once.
    this.charge = 0;            // 0 .. 1 while the hand is down
    this.size = 1;              // 1 .. sizeMax: what the next cast (or the ball being held) is made to
    // (2026-11-18, the owner: "make a ultimate abilities for all of them where when you hold it down it does a
    //  super version".) THE SECOND CHARGE. Once the circle is full, keeping the hand down fills this one over
    //  WINDPOWER.ultTime, and letting go then casts the ultimate instead. Nothing new to press.
    this.ult = 0;               // 0 .. 1, and only after charge has reached 1
    this.ultReady = false;      // the hand may now let go on an ultimate (the ring and the word say so)
    this.ults = 0;              // how many have been cast (for the log and the tests)
    this._armed = null;         // the ability the hand went down on (it is cast when the hand lifts)
    this._wasTap = false;       // the press came from the touch button's tap: the smallest cast, whatever the frame
    this.note = '';             // one word for the HUD when something cannot be done here
    this._noteT = 0;
    this.active = false;        // the powers can be used now (on foot, on a world)
    this.keys = { cast: false, pad: false, mouse: false, touch: false };
    this.onCast = null;         // called with the ability's id when one is cast (the sound)
    this.tapOnce = false;       // set by the touch button: one press, seen by the next frame however long that frame is
    this.fells = 0;             // trees felled so far by the wind knife (for tests and the read-out)
    // THE FIRE (docs/POWERS-FIRE.md). sim.js hands this list to the physics on the frame, beside the winds.
    this.fires = makeFires();
    this.fireCasts = 0;         // how many fires have been lit (for tests and the read-out)
    this._fireBody = null;      // the world its patches are burning on
    // SPACE AND TIME (docs/POWERS-TIME.md). The list of places where the world runs at another pace lives here
    // with the winds and the fires, and sim.js hands all three to the physics on the frame.
    this.times = makeTimes();
    this.fold = null;           // the fold being drawn now: { p0, p1, t, life } while the world rushes past
    this._rips = [];            // the open rips, handed to the painter each frame (world/timefx.js)
    this.timeCasts = 0;         // how many of the third element have been cast (for tests and the read-out)
    this.list = ABILITIES;      // the element in the hand: ABILITIES (wind), FIRE_ABILITIES or TIME_ABILITIES
    this.element = 0;           // 0 wind, 1 fire, 2 space and time (setElement below)
    // THE AIM'S MARCH, carried between frames (_march): which rung of AIM_LADDER is next, the ray the sweep began
    // on, the bracket's near end, and the last whole sweep's answer. They are declared HERE and not made on the
    // first march, because this runs every frame of a game and an object whose shape grows after it is built is
    // an object the engine has to build again.
    this._mi = 0; this._mDist = 0; this._mBody = null;
    this._mox = 0; this._moy = 0; this._moz = 0;
    this._mdx = 0; this._mdy = 0; this._mdz = 1;
    this._mcos = 1; this._mL = 0; this._mGap = 0;
    this._md = { x: 0, y: 0, z: 1 };
    this._farAim = false;       // the last kindling's aim was beyond what the world has looked at (_fireSpot)
  }

  // WHAT THE FIRE BURNED IN THE FRAME JUST GONE, written into the record that lasts (data/burnt.js), the way the
  // knife writes down a felled tree. The physics fills these rows while it steps the fire, so they are read one
  // frame later, which nothing can see. If they were not read they would pile up and the fire would say so (F.lost).
  // WHAT THE PLAYER BROKE, GROWING BACK (the owner, 2026-11-18: "make sure that felled woods or burnt areas
  // eventually do return to normal so it isn't taking up memory"). All three lasting records of damage are the
  // powers' own doing, so they are healed here and nowhere else: without ?powers=1 none of this is even loaded, and
  // with it, on nearly every frame of a game, these three calls walk an empty record and return at once. A felled
  // tree stands again, a scorch greens, a burnt crown comes back into leaf, melted ice fills in, and a crown the
  // wind tore bare refills -- each out of the player's sight, or after twice as long if they stay to watch. The
  // record is dropped the moment it is clean, so every one of them is bounded by TIME as well as by count, which is
  // the owner's own reason for asking.
  // (stripStep was written with the stripping record and called by NOTHING until now, so a bare crown stayed bare
  //  for ever: found while wiring this.)
  // MEASURED in Node on the build machine (not on a device), the burnt and felled records FULL -- 600 scorches, 400
  // burnt crowns, 400 felled trees, none of them yet old enough to heal, which is the dearest case there is:
  // 22.2 MICROSECONDS a frame, against a phone's 33,000. With the records empty, which is every frame of an
  // ordinary game, 38.5 ns. Nothing is allocated a frame: the list of what is whole again is kept between calls.
  _heal(dt, sim) {
    const p = sim && sim.ex ? sim.ex.p : null;
    healFelled(dt, p);
    healBurnt(dt, p);
    stripStep(dt);
  }

  _keepBurns() {
    const B = this.fires.burns;
    if (!B.count) return;
    for (let i = 0; i < B.count; i++) {
      const b = B[i];
      if (b.kind === FUEL.ice) {
        // the row says how much heat has gone into this place IN ALL, and only ever grows, so the depth we want is
        // that heat turned into metres; the mark's own depth says how much of it is already down there
        const m = meltIce(b.bodyId, b.px, b.py, b.pz, b.radius, b.floor == null ? -1 : b.floor);
        if (m) deepenMelt(m, b.heat * POWERS.meltPerHeat - m.d);
      } else {
        scorch(b.bodyId, b.px, b.py, b.pz, b.radius, b.burnt);
      }
    }
    clearBurns(this.fires);
  }

  // (2026-11-18, found by an independent reader) CHANGING ABILITY MID-HOLD ABANDONS THE HOLD. It used to leave the
  // charge, the ultimate and the armed ability standing: hold for four seconds on the gust until the screen says
  // "ULTIMATE ready - let go", flick to the whirl, let go -- and nothing at all happened, no sound, no word, while
  // the screen went on promising the ultimate for another 1.8 s. (Wander away and back to the same ability and it
  // survived, which is worse: the same gesture did two different things.) This is the very gesture the ring picker
  // was built for, one thumb on the power and one on the chip, so it has to be honest: the ring now visibly
  // collapses and the player can see what they spent.
  pick(i) { if (i >= 0 && i < this.list.length && i !== this.ability) { this.cancelHold(); this.ability = i; } }
  // (2026-11-18) THE ELEMENT IN THE HAND: 0 the wind's seven, 1 the fire's. Without this the fire is wired to
  // everything and reachable by nobody, which is what it was for an hour after the wiring went in. Whatever is
  // being held is dropped first, so swapping element never leaves a ball or a channel alive with nothing holding it.
  // (2026-11-22) THREE elements now, not two: wind, fire, and space and time. The lists are kept in one table so
  // that adding a fourth is a line and not a rewrite, and so that nothing can be reachable by one key and not by
  // another (the fire was wired to everything and reachable by nobody for an hour on 18 Nov).
  setElement(n) {
    const k = ELEMENTS[((n | 0) % ELEMENTS.length + ELEMENTS.length) % ELEMENTS.length];
    if (k.list === this.list) return;
    this._drop(); this._close(); this.cancelHold();
    this.list = k.list; this.ability = 0; this.element = k.n;
    this._say(k.word);
  }
  nextElement() { this.setElement(this.element + 1); }
  next() { this.pick((this.ability + 1) % this.list.length); }

  // the gathered ball is let go where it is (thrown along the aim if it holds anything worth throwing)
  _drop(sim) {
    if (!this.orb) return;
    const o = this.orb; this.orb = null;
    releaseWind(o);
    if (sim && this.aim.ok) castGust(this.winds, sim.bodyId, { x: o.px, y: o.py, z: o.pz }, this.aim.fwd, 0.8);
  }

  // A word for the screen when an ability could do nothing here (ui/powers.js shows it beside the ability's name for a
  // moment): the note and how long it still stands.
  _say(word) { this.note = word; this._noteT = 1.8; }
  // the parted channel is let go: it closes from its far end inward (physics/powers.js stepWinds)
  _close() { if (this.part) { releaseWind(this.part); this.part = null; } }
  // (2026-11-18) THE HAND IS GONE, not lifted: the page lost focus, or the system took the touch away. A hold that is
  // taken away is ABANDONED, not cast. Found by a reader driving the touch screen: without this, a hold that had
  // charged all the way to the ultimate and was never lifted made the NEXT QUICK TAP come out as the ultimate - a tap
  // that flattened 28 trees. `_was` goes too, or the next press is not seen as a new press at all and casts nothing.
  // A HOLD IS ABANDONED, not finished (the page lost focus, the system took the touch away, the player swapped the
  // element with the cast key still down). `_was` is deliberately LEFT AS IT IS: clearing it made the very next frame
  // read a hand that had never lifted as a FRESH PRESS, which re-armed on the new element's first ability and cast it
  // on release. Measured 2026-11-18 by an independent reader driving the real keys: press Q, charge a gust, press G to
  // go and look at the fire, lift Q -- and a fire was lit in the wood, with permanent scorch marks, from one cast key
  // and one element key, neither of which asked for a cast. `_was` needs no clearing here: update() sets it from the
  // hands every frame, and `if (!down)` clears everything the moment they are really up.
  cancelHold() { this._armed = null; this.charge = 0; this.ult = 0; this.ultReady = false; this._wasTap = false; this._drop(); this._close(); if (this.note === 'ULTIMATE ready - let go') { this.note = ''; this._noteT = 0; } }
  // Is the water parted at the place d (a unit vector from the body's centre) where its face is at radius r?
  // (sim.js asks, for the explorer's ground: on the channel's floor there is no water to wade or swim in)
  dry(bodyId, d, r) { return this.winds.count > 0 && partedAt(this.winds, bodyId, d.x * r, d.y * r, d.z * r) > 0.5; }

  // The wind knife: a thin straight gust, and the first tree it meets along the aim is felled (data/felled.js: the
  // world lays it down and takes its trunk out of the way; the saved game keeps it). It falls away from the explorer,
  // when the blade reaches it. With no tree in reach it is only the gust.
  _knife(sim, size = 1) {
    const A = this.aim, p = sim.ex.p, up = unit(p), f = A.fwd;
    const blade = castGust(this.winds, sim.bodyId, A.from, f, 0.9, size);
    blade.radius = 0.45 * size; blade.spread = 0.03; blade.curl = 0; blade.height = 1.8 * size;
    const reach = POWERS.knifeReach * (0.7 + 0.3 * size), wide = POWERS.knifeWidth * size;
    let best = null, bd = 1e9;
    if (sim.sampleObstacles) {
      // (two small discs along the aim: asked for one wide disc the world's list misses things, sim.js)
      for (const k of [0.28, 0.75]) {
        let list = null;
        try { list = sim.sampleObstacles(sim.bodyId, unit(add(p, f, reach * k)), reach * 0.5); } catch { list = null; }
        for (const ob of list || []) {
          if (ob.kind !== 'tree' || !ob.p) continue;
          const rx = ob.p.x - p.x, ry = ob.p.y - p.y, rz = ob.p.z - p.z, a = rx * f.x + ry * f.y + rz * f.z;
          if (a < 1 || a > reach || a >= bd) continue;
          const h = rx * up.x + ry * up.y + rz * up.z;
          if (Math.hypot(rx - f.x * a - up.x * h, ry - f.y * a - up.y * h, rz - f.z * a - up.z * h) > wide + (ob.radius || 0)) continue;
          best = ob; bd = a;
        }
      }
    }
    if (!best) this._say('no tree in reach');
    if (best) {
      // it goes over away from the explorer and to its own side of the aim (straight away, the fall is hidden behind
      // the tree itself from where the explorer stands: seen in the stills of 2026-11-17)
      const rx = best.p.x - p.x, ry = best.p.y - p.y, rz = best.p.z - p.z;
      const sx = f.y * up.z - f.z * up.y, sy = f.z * up.x - f.x * up.z, sz = f.x * up.y - f.y * up.x;      // the aim's right
      let side = rx * sx + ry * sy + rz * sz;
      side = Math.abs(side) > 0.12 ? Math.sign(side) : ((Math.abs(best.p.x) * 7.31) % 1 > 0.5 ? 1 : -1);
      const c = Math.cos(POWERS.knifeSide), n = Math.sin(POWERS.knifeSide) * side;
      if (fellTree(sim.bodyId, best.p.x, best.p.y, best.p.z, f.x * c + sx * n, f.y * c + sy * n, f.z * c + sz * n, bd / WINDPOWER.gustFront)) this.fells++;
    }
    return best;
  }

  // (2026-11-18, the owner: an ultimate that "cuts down multiple trees in a large area", "rips tens of trees in the
  // air", or "knocks a whole section of forest down".) EVERY TREE WITHIN `radius` OF A PLACE GOES OVER: 'away' from
  // the explorer, 'out' from the middle of the ring, or 'in' toward it. The far ones go over a little later -
  // WINDPOWER.ultWave metres a second - so a wood falls as a wave travelling outward instead of all in one frame,
  // which is both truer to look at and kinder to the frame, since every felling is work for the trees' renderer.
  _fellArea(sim, c, radius, how) {
    if (!sim.sampleObstacles || !sim.bodyId || !c) return 0;
    const W = WINDPOWER, p = sim.ex.p, up = unit(p), f = this.aim.fwd;
    const s3 = unit({ x: f.y * up.z - f.z * up.y, y: f.z * up.x - f.x * up.z, z: f.x * up.y - f.y * up.x });   // the aim's right
    // (several looks across the area: asked for one wide disc the world's list misses things - the knife found that)
    const picks = [[0, 0]];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2831853; picks.push([Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62]); }
    const seen = new Set(), found = [];
    for (const [a, b] of picks) {
      const q = add(add(c, f, a), s3, b);
      let list = null;
      try { list = sim.sampleObstacles(sim.bodyId, unit(q), radius * 0.6); } catch { list = null; }
      for (const ob of list || []) {
        if (ob.kind !== 'tree' || !ob.p) continue;
        const dx = ob.p.x - c.x, dy = ob.p.y - c.y, dz = ob.p.z - c.z, d = Math.hypot(dx, dy, dz);
        if (!(d <= radius)) continue;
        const key = ((ob.p.x * 100) | 0) + '|' + ((ob.p.y * 100) | 0) + '|' + ((ob.p.z * 100) | 0);
        if (seen.has(key)) continue;
        seen.add(key);
        if (felledAt(sim.bodyId, ob.p.x, ob.p.y, ob.p.z)) continue;     // already lying: it is not felled twice, and not counted twice
        found.push({ ob, d, dx, dy, dz });
      }
    }
    found.sort((A2, B2) => A2.d - B2.d);          // the near ones go first, so the wave travels outward
    let n = 0;
    for (const t of found) {
      if (n >= W.ultFellMax) break;
      let vx, vy, vz;
      if (how === 'in') { vx = -t.dx; vy = -t.dy; vz = -t.dz; }
      else if (how === 'out') { vx = t.dx; vy = t.dy; vz = t.dz; }
      else { vx = t.ob.p.x - p.x; vy = t.ob.p.y - p.y; vz = t.ob.p.z - p.z; }
      if (!(Math.hypot(vx, vy, vz) > 1e-3)) { vx = f.x; vy = f.y; vz = f.z; }
      if (fellTree(sim.bodyId, t.ob.p.x, t.ob.p.y, t.ob.p.z, vx, vy, vz, t.d / W.ultWave)) { n++; this.fells++; }
    }
    return n;
  }

  // THE ULTIMATE of each ability: the super version, cast by letting go once the second charge is full. Every one of
  // the seven has one, as the owner asked; the three they named by name are the gust, the whirl and the knife.
  // WHICH ABILITIES HAVE AN ULTIMATE OF THEIR OWN. The rest are cast in the ordinary way at the greatest size
  // instead (see update below) -- which is what they did BEFORE 2026-11-22, when holding any of the nine newest
  // ones past "ULTIMATE ready" said "held to its utmost" and then cast NOTHING AT ALL: the hand came up, the sound
  // played, and the world was untouched. (Found while mending the freeze, by holding every ability of all three
  // elements to the full in tests/powers.test.mjs.)
  static hasUlt(id) {
    return id === 'gust' || id === 'whirl' || id === 'knife' || id === 'quicken' || id === 'still'
      || id === 'kindle' || id === 'ember' || id === 'bellows' || id === 'wall' || id === 'snuff' || id === 'firewhirl';
  }

  _ultimate(sim, id) {
    const W = WINDPOWER, A = this.aim, K = W.ultSize;
    this.ults++;
    let felled = 0;
    if (id === 'gust') {
      castGust(this.winds, sim.bodyId, A.from, A.fwd, 1, K, true);
      felled = this._fellArea(sim, add(sim.ex.p, A.fwd, W.ultGustLen * 0.5), W.ultGustR, 'away');
      this._say(felled ? 'the blast flattens ' + felled + ' trees' : 'the blast tears through');
    } else if (id === 'whirl') {
      castVortex(this.winds, sim.bodyId, A.p, this.casts % 2 ? -1 : 1, K);
      felled = this._fellArea(sim, A.p, W.ultWhirlR, 'out');
      this._say(felled ? 'the tornado takes ' + felled + ' trees' : 'the tornado roars');
    } else if (id === 'knife') {
      this._knife(sim, W.sizeMax);
      felled = this._fellArea(sim, add(sim.ex.p, A.fwd, W.ultKnifeR * 0.6), W.ultKnifeR, 'away');
      this._say(felled ? 'the blade cuts ' + felled + ' trees' : 'no tree in reach');
    } else if (id === 'quicken' || id === 'still') {
      castZone(this.winds, sim.bodyId, A.p, A.fwd, id === 'still' ? 'calm' : 'quicken', K);
      this._say(id === 'still' ? 'a great hush' : 'a great quickening');
    } else if (id === 'kindle') {
      // (2026-11-18, found by an independent reader who HELD THE BUTTON: fire was the headline of this version, kindle
      //  is its one ability, and a 4.1 s hold -- after the screen had promised "ULTIMATE ready - let go" -- lit
      //  NOTHING AT ALL. The sound played, the explorer threw the cast, the cooldown was set, and no fire existed.
      //  Holding the button is the first thing anyone does after reading that message.)
      const f = this._kindle(sim, K);
      if (f && f.kind !== FUEL.none) this._say('a great fire is set');
    } else if (id === 'ember') {
      // held to the full: a handful of sparks thrown out along the view, not one
      let lit = 0;
      for (let i = 0; i < 5; i++) if (this._ember(sim, K, 0.55 + i * 0.18)) lit++;
      this._say(lit ? 'a shower of sparks: ' + lit + ' caught' : 'the sparks find nothing');
    } else if (id === 'bellows') {
      this._bellows(sim, W.sizeMax, 2.2);
      this._say('the air roars into it');
    } else if (id === 'wall') {
      const n = this._wall(sim, K, 2);
      this._say(n ? 'a wall of fire, ' + n + ' long' : 'nothing here will carry a wall');
    } else if (id === 'snuff') {
      const n = this._snuff(sim, FIREPOWER.snuffUlt);
      this._say(n ? 'the fires go out: ' + n : 'nothing was burning');
    } else if (id === 'firewhirl') {
      this._fireWhirl(sim, W.sizeMax, true);
    } else {
      // gather and part are HELD, not let go: their ultimate is that they go on growing past every ordinary limit
      // while the hand stays down (see growWind above). Nothing is cast here.
      this._say('held to its utmost');
    }
    return felled;
  }

  // Where the power acts: from the explorer along the view, and as far out as the view really meets the land.
  //
  // UNTIL v32 THIS WAS A FUNCTION OF THE PITCH ALONE: six metres looking steeply down, thirty level, and the
  // ground was never asked. So every power landed at most thirty metres away whatever the player was looking at --
  // aim at the wood on the far ridge, hold, let go, and the grass at your feet went over while the ridge never
  // moved. (The owner, 2026-11-22: the world must read as real at three hundred yards, which is 275 m.) The real
  // view ray is MARCHED against the land now, out to POWERS.aimMax, and the aim goes to the first place the ground
  // stands above it.
  //
  // THE PITCH RULE IS KEPT AS A FLOOR, not thrown away: the aim is whichever of the two is FURTHER. So a look at
  // the sky (which the march never meets), a look at flat ground inside thirty metres, a world that cannot be
  // sampled, and ?aimray=0 are all exactly what they were, and nothing the owner already likes about a cast at
  // their own feet changes. The march can only ever send the aim further out.
  //
  // `full`: walk the whole ladder in this one call (the press and the lift). Otherwise two rungs of it, carried on
  // across frames -- see _march.
  _aim(sim, full = false) {
    const A = this.aim, cam = sim.footCam, ex = sim.ex;
    A.ok = false;
    if (!cam || !ex || !sim.bodyId) return A;
    const p = ex.p, up = unit(p);
    // the view's direction, level at the explorer. (cam.viewFwd is ALREADY the levelled yaw and the pitch is kept
    // beside it: player/camera.js builds the real look from the two, and so does _march. This levelling is
    // therefore a no-op that is left in because nothing promises viewFwd stays exactly tangent as the sphere turns
    // under the explorer.)
    let f = cam.viewFwd; const k = f.x * up.x + f.y * up.y + f.z * up.z;
    f = unit({ x: f.x - up.x * k, y: f.y - up.y * k, z: f.z - up.z * k });
    const t = Math.min(1, Math.max(0, (cam.pitch + 0.9) / 0.9));
    A.pitchDist = POWERS.aimNear + (POWERS.aimFar - POWERS.aimNear) * t;
    A.dist = A.pitchDist;
    A.fwd = f;
    A.from = add(add(p, f, POWERS.ahead), up, POWERS.hands);
    A.ray = AIM_RAY ? this._march(sim, p, up, f, cam.pitch, full) : 0;
    if (A.ray > A.dist) A.dist = A.ray;
    // and no further than this ability's own work can travel (AIM_REACH: a gust is spent at 85 m however far the
    // eye sees, and a ring drawn past that would promise what the cast cannot do)
    const cap = AIM_REACH[this.list[this.ability].id];
    if (cap > 0 && A.dist > cap) A.dist = cap;
    // the place on the ground out there (the land's own height, or the water's face)
    const q = add(p, f, A.dist), d = unit(q);
    let r = Math.hypot(p.x, p.y, p.z);
    try { const s = sim.sampleSurface(sim.bodyId, d); if (s) r = Math.max(s.radius || 0, s.liquidRadius || 0) || r; } catch { /* the explorer's own height */ }
    A.p = { x: d.x * r, y: d.y * r, z: d.z * r };
    A.ok = true;
    return A;
  }

  // THE VIEW MARCHED AGAINST THE LAND. Returns the distance ALONG THE GROUND to the first place the land (or the
  // face of the water) stands above the view ray, or 0 for a view that meets nothing inside POWERS.aimMax -- the
  // sky, or a world that will not answer.
  //
  // IT IS AMORTISED, because this is nine samples of the world and the owner's phone is at its sixty-a-second cap.
  // With nothing pressed only AIM_RUNGS rungs are walked a frame and the sweep is committed when it finishes, so
  // the ring lags by four or five frames and nothing else does: the press and the lift each walk the whole ladder
  // in one call, and those are the only two frames the number is spent on. The ray is taken ONCE when a sweep
  // begins and the rest of the sweep is marched down that same ray, or a turning view would leave a bracket with
  // one end on one ray and the other on another.
  //
  // MEASURED on the build machine (Node, no graphics card): sampleSurface is 5.6 microseconds a call, so two rungs
  // a frame is 11 us of a 16,700 us frame and the whole ladder on a press is 51 us. Nothing is allocated: one
  // scratch direction, reused, and the bracket's near end at the eye needs no sample at all (the ground there is
  // POWERS.eye below it, exactly).
  _march(sim, p, up, f, pitch, full) {
    const raw = sim.sampleSurface;
    if (!raw) return 0;
    if (this._mBody !== sim.bodyId) { this._mBody = sim.bodyId; this._mi = 0; this._mDist = 0; }   // another world: begin again
    const d = this._md;
    if (full) this._mi = 0;
    let n = full ? AIM_LADDER.length : AIM_RUNGS;
    while (n-- > 0) {
      if (!this._mi) {
        // a new sweep: the ray as it is this instant, from the eye, and the near end of the first bracket
        const c = Math.cos(pitch), s = Math.sin(pitch);
        this._mox = p.x + up.x * POWERS.eye; this._moy = p.y + up.y * POWERS.eye; this._moz = p.z + up.z * POWERS.eye;
        this._mdx = f.x * c + up.x * s; this._mdy = f.y * c + up.y * s; this._mdz = f.z * c + up.z * s;
        this._mcos = c > 0.02 ? c : 0.02;              // along the ray -> along the ground (a near-vertical view: a floor, not a division by nothing)
        this._mL = 0; this._mGap = -POWERS.eye;
        this._mi = 0;
      }
      const L = AIM_LADDER[this._mi];
      const qx = this._mox + this._mdx * L, qy = this._moy + this._mdy * L, qz = this._moz + this._mdz * L;
      const rr = Math.hypot(qx, qy, qz);
      let rs = 0;
      if (rr > 1e-6) {
        const il = 1 / rr; d.x = qx * il; d.y = qy * il; d.z = qz * il;
        try { const g = raw(sim.bodyId, d); if (g) rs = Math.max(g.radius || 0, g.liquidRadius || 0); } catch { rs = 0; }
      }
      if (!(rs > 0)) { this._mDist = 0; this._mi = 0; break; }        // the world cannot say: the pitch rule stands
      const gap = rs - rr;                                            // + : the land is above the ray here
      if (gap >= 0) {
        // the crossing, by one straight line through the two heights that bracket it. (_mGap is below the land and
        // so negative, gap is above it and so positive, which is why the span is written this way round: the first
        // version of this line had the two the other way about, the span came out negative, every refine fell back
        // to u = 0 and the aim always landed exactly ON the rung before the hit -- 22 m where the ground really
        // crossed the ray at 24.8. Caught in Node against a known slope before any still was made.)
        const span = gap - this._mGap;
        let u = span > 1e-6 ? -this._mGap / span : 0;
        if (!(u > 0)) u = 0; else if (u > 1) u = 1;
        const hit = (this._mL + (L - this._mL) * u) * this._mcos;
        this._mDist = hit > POWERS.aimMax ? POWERS.aimMax : hit;
        this._mi = 0;
        break;
      }
      this._mL = L; this._mGap = gap;
      if (++this._mi >= AIM_LADDER.length) { this._mDist = 0; this._mi = 0; break; }   // it meets nothing: the sky
    }
    return this._mDist > 0 ? this._mDist : 0;
  }

  // Once a frame. sim: the Sim (state, explorer, camera, sampleSurface).
  update(dt, sim) {
    const W = this.winds;
    if (this.pollPad) this.pollPad();
    this._keepBurns();
    this._heal(dt, sim);
    // A fire is left burning when the explorer walks away: it is the world's now. A fire on a world they have LEFT
    // is put out, because nothing of a live fire is saved and its patches would otherwise burn on where nobody can
    // see them. What it had already burned is written down first (douseFires reports it).
    if (this.fires.count > 0 && sim.bodyId && this._fireBody && sim.bodyId !== this._fireBody) douseFires(this.fires);
    if (sim.bodyId) this._fireBody = sim.bodyId;
    this.active = sim.sm.state === S.ON_FOOT && !!sim.bodyId && !sim.easel;
    // A FOLD IN FLIGHT: the world is drawn past the explorer for half a second (see _fold). It is stepped here,
    // before anything else reads where the explorer is standing, and whether or not the hand is still down.
    if (this.fold) this._stepFold(sim, dt);
    const tap = this.tapOnce; this.tapOnce = false;
    const down = this.active && (this.down || this.keys.cast || this.keys.pad || this.keys.mouse || this.keys.touch || tap);
    const pressed = down && !this._was, released = !down && this._was;
    this._was = down;
    if (this._wait > 0) this._wait -= dt;
    if (this._noteT > 0) { this._noteT -= dt; if (!(this._noteT > 0)) this.note = ''; }
    if (sim.ex && sim.ex.casting > 0) sim.ex.casting = Math.max(0, sim.ex.casting - dt / POWERS.castPose);
    // (the aim is worked out every frame the powers can be used, cast or not: the mark on the screen shows where a
    // power will act before it is cast, ui/powers.js. One sample of the ground a frame.)
    // the circle grows while the hand is down, and goes back to the smallest when it lifts. A TAP (the touch button's
    // one-frame press) is always the smallest, however long that frame was.
    if (tap) this._wasTap = true;
    if (down && !this._wasTap) {
      this.charge = Math.min(1, this.charge + dt / WINDPOWER.chargeTime);
      if (this.charge >= 1) this.ult = Math.min(1, this.ult + dt / WINDPOWER.ultTime);
    }
    this.size = 1 + this.charge * (WINDPOWER.sizeMax - 1);
    const wasReady = this.ultReady;
    this.ultReady = this.ult >= 1;
    if (this.ultReady && !wasReady) this._say('ULTIMATE ready - let go');
    if (this.active) {
      // THE FREEZE THE OWNER FOUND (2026-11-22: "The spacetime powers freeze the game everytime I open it").
      // This line used to read AIM_SIZE[id](A.dist) with no guard, and NINE of the abilities had no entry in that
      // table: the fire's meteor, lance and cinders, and all twelve of space and time. Picking any of them threw a
      // TypeError here -- inside powers.update, inside sim.frame, inside game.frame -- so the frame stopped dead
      // before the world was stepped or anything was painted. The loop asks for the next frame before it runs this
      // one (main.js tick), so the game did not fall over with an error on the screen: it simply stopped, every
      // frame, for ever, with the last complete picture still up. That is a freeze with no way out of it.
      // Two things now stand in its way: every ability has a ring above, and an unknown one shows an ordinary ring
      // instead of throwing. tests/powers.test.mjs walks every ability of every element through this line.
      // (the aim's march walks its WHOLE ladder on the press and on the lift -- the two frames the number is
      //  really spent on, and the lift is the cast itself -- and two rungs of it on every other frame: _march)
      const A = this._aim(sim, pressed || released), id = this.list[this.ability].id, ring = AIM_SIZE[id];
      const base = ring ? ring(A.dist) : 2;
      A.size = A.ok ? base * (id === 'gust' || id === 'knife' ? 1 + (this.size - 1) * 0.6 : this.size) : 0;
    }
    else this.aim.ok = false;
    if (this.active && (down || released || this.orb || this.part)) {
      const A = this.aim, ab = this.list[this.ability];
      if (A.ok) {
        if (ab.id === 'gather') {
          if (pressed && !this.orb) { this.orb = castOrb(W, sim.bodyId, this._orbAt(sim, POWERS.orbAhead), this.size); this._cast(sim); }
          if (this.orb && down) {
            // the ball follows the aim, no faster than a hand could carry it
            const to = this._orbAt(sim, Math.min(A.dist, POWERS.orbReach)), o = this.orb;
            const dx = to.x - o.px, dy = to.y - o.py, dz = to.z - o.pz, l = Math.hypot(dx, dy, dz), m = Math.min(1, POWERS.orbSpeed * dt / (l || 1));
            moveWind(o, { x: o.px + dx * m, y: o.py + dy * m, z: o.pz + dz * m });
            growWind(o, this.ultReady ? WINDPOWER.ultSize : this.size);   // (held: the ball grows in the hand, and past every ordinary limit once the second charge is full: the gather's own ultimate)
          }
        } else if (ab.id === 'part') {
          // the channel begins just behind the explorer and lies along the aim: it goes where they go and look
          if (pressed && !this.part) {
            this.part = castPart(W, sim.bodyId, this._orbAt(sim, -WINDPOWER.partBack), A.fwd, this.size); this._cast(sim);
            // (no water within the channel's reach: it is only a wind along the ground, and says so)
            let wet = false;
            for (const k of [2, 6, 11]) { try { const g = sim.sampleSurface(sim.bodyId, unit(add(sim.ex.p, A.fwd, k))); if (g && g.liquidRadius > g.radius) wet = true; } catch { /* unknown: say nothing */ wet = true; } }
            if (!wet) this._say('no water here');
          }
          if (this.part && down) { moveWind(this.part, this._orbAt(sim, -WINDPOWER.partBack)); turnWind(this.part, A.fwd); growWind(this.part, this.ultReady ? WINDPOWER.ultSize : this.size); }   // (the channel's ultimate is the same: held past full, it opens far wider)
        } else if (ab.id === 'year') {
          // (space and time) the one of the four that is HELD: the year turns while the hand is down
          if (pressed) this._cast(sim);
          this._year(dt, down);
        } else {
          // the hand goes down on it and the circle grows; it is cast when the hand lifts (a tap: the smallest, at once)
          if (pressed) this._armed = ab.id;
          if (released && this._armed === ab.id && this._wait <= 0) {
            // held past full: the ones with an ultimate of their own do that, and every other is cast in the
            // ordinary way at the greatest size (never nothing at all: Powers.hasUlt above)
            const k = this._wasTap ? 1 : this.ultReady ? WINDPOWER.ultSize : this.size;
            if (this.ultReady && Powers.hasUlt(ab.id)) this._ultimate(sim, ab.id);
            else if (ab.id === 'gust') castGust(W, sim.bodyId, A.from, A.fwd, 1, k, true);   // (true: THE one ability that lays trees over, owner 2026-11-18)
            else if (ab.id === 'quicken') castZone(W, sim.bodyId, A.p, A.fwd, 'quicken', k);
            else if (ab.id === 'still') castZone(W, sim.bodyId, A.p, A.fwd, 'calm', k);
            else if (ab.id === 'whirl') castVortex(W, sim.bodyId, A.p, this.casts % 2 ? -1 : 1, k);
            else if (ab.id === 'knife') this._knife(sim, k);
            else if (ab.id === 'kindle') this._kindle(sim, k);
            else if (ab.id === 'ember') this._ember(sim, k);
            else if (ab.id === 'bellows') this._bellows(sim, k);
            else if (ab.id === 'wall') this._wall(sim, k);
            else if (ab.id === 'snuff') this._snuff(sim, FIREPOWER.snuffR);
            else if (ab.id === 'firewhirl') this._fireWhirl(sim, k);
            else if (ab.id === 'meteor') this._meteor(sim, k);
            else if (ab.id === 'lance') this._lance(sim, k);
            else if (ab.id === 'cinders') this._cinders(sim, k);
            else if (ab.id === 'freeze') this._freeze(sim, k);
            else if (ab.id === 'fold') this._fold(sim, k);
            else if (ab.id === 'rip') this._rip(sim, k);
            this._wait = POWERS.gustEvery;
            this._cast(sim);
          }
          if (released) this._armed = null;
        }
      }
    }
    if (this.orb && (released || !this.active)) this._drop(this.active ? sim : null);
    if (this.part && (released || !this.active)) this._close();
    if (!down) { this.charge = 0; this.ult = 0; this.ultReady = false; this._armed = null; this._wasTap = false; }
    if (W.count > 0) stepWinds(W, dt);
    // THE RIPS, FOR THE PAINTER. A rip IS a wind source (physics/powers.js KIND.rip) and the painter is never
    // handed the wind list; it is handed the time list, beside the fires. So the open rips ride over on that, in
    // an array kept here and refilled in place -- there is never more than one or two, and nothing is allocated.
    const R = this._rips; R.length = 0;
    for (let i = 0; i < W.count; i++) { const s = W[i]; if (s.kind === KIND.rip && s.strength > 0.004) R.push(s); }
    this.times.rips = R;
    if (this.times.count > 0) stepTimes(this.times, dt);      // (space and time: the bubbles open, hold and close)
    if (this.onFrame) this.onFrame(this);          // (the touch button and the word on the screen: ui/powers.js)
  }

  // KINDLE: fire is set down where the view looks, and spreads through whatever will burn (the owner's "spawn").
  // The physics lights it, because only the physics can say what is underfoot at that place.
  _kindle(sim, size = 1) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire) return null;
    // WHERE THE SPARK LANDS. The aim is where the view looks, and at the owner's own riverside spawn that is as
    // often the water as the bank (2026-11-18: six casts there, every one refused). A thrown spark is not a
    // surveyor: if the exact place will not take, it falls short, along the same line, and the first ground within
    // the aim that will burn takes it. The world is asked, it is not guessed at (physics.fuelAt), and nothing is
    // lit twice: this is a handful of lookups on one key press, not per frame.
    const p = this._fireSpot(sim, this.aim.p);
    const f = ph.lightFire(this.fires, sim.bodyId, p, size);
    if (!f) { this._say('no room for another fire'); return null; }
    this.fireCasts++;
    // (2026-11-18, after looking: a fire lit at the owner's own riverside spawn lit, burned one patch and went out,
    //  and the screen said nothing at all, so there was no way to tell a broken fire from a damp wood. It says now.)
    // (2026-11-18, measured: the spawn's own wood DOES take a fire -- 64 patches in forty seconds. What refused it
    //  was the river the spawn stands on, and the word on the screen said neither. The world now hands back the
    //  reason in plain words (physics/index.js fuelAt, `why`) and this says that instead of guessing.)
    // (2026-11-19: on ice it said "too little here to carry it", because ice has no fuel. It is not a failure --
    //  ice is the one ground that answers a flame by MELTING -- and on the three ice worlds that wrong word was
    //  the only thing the player ever heard. It says what is happening instead.)
    if (f.kind === FUEL.ice) this._say('the ice melts');
    else if (f.kind === FUEL.none) this._say(FIRE_WHY[f.why] || 'nothing here will burn');
    else if (f.wet >= FIRE.wetStop * 0.8) this._say('too damp to catch');
    else if (!(f.fuel > 0.25)) this._say('too little here to carry it');
    else if (this._farAim) this._say('too far: it falls short');
    return f;
  }

  // ---- THE FIVE NEW FIRE ABILITIES (the owner, 2026-11-19) -------------------------------------------------

  // EMBER: a spark thrown FURTHER than a kindling and, unlike one, it does not fall short. A kindling that cannot
  // find ground steps back toward you until it does; a thrown spark goes where it is thrown, over the water, over
  // the road, over the gap. That is the whole difference between them and it is the reason to have both.
  // `far`: where along the throw it lands, 1 being the full reach (the ultimate throws a handful at different reaches).
  _ember(sim, size = 1, far = 1) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire || !this.aim.ok) return null;
    const A = this.aim, from = A.from;
    const dx = A.p.x - from.x, dy = A.p.y - from.y, dz = A.p.z - from.z;
    const k = FIREPOWER.emberFar * far;
    const p = { x: from.x + dx * k, y: from.y + dy * k, z: from.z + dz * k };
    const f = ph.lightFire(this.fires, sim.bodyId, p, size);
    if (!f) { this._say('no room for another fire'); return null; }
    this.fireCasts++;
    if (far === 1) {
      if (f.kind === FUEL.none) this._say(FIRE_WHY[f.why] || 'the spark finds nothing to burn');
      else if (f.wet >= FIRE.wetStop * 0.8) this._say('the spark hisses out');
    }
    return f.kind !== FUEL.none ? f : null;
  }

  // BELLOWS: THE OWNER'S "putting on a fire speeds up the fire", done honestly. It makes a hard short gust at the
  // aim through the ordinary wind machinery -- so the air it makes is the same air the fire already reads through
  // physics/fire.js ctx.windAt, and the fire is fanned, leans downwind, spreads faster that way and eats its fuel
  // sooner, all by the rules that were already there. Nothing anywhere says "this fire is now faster".
  // It is a wind, so it works on a fire someone else lit, on a wood, and on nothing at all.
  _bellows(sim, size = 1, power = 1) {
    if (!this.aim.ok) return;
    const A = this.aim;
    castGust(this.winds, sim.bodyId, A.from, A.fwd, FIREPOWER.bellowsPower * power, Math.max(size, FIREPOWER.bellowsSize), false);
    this.casts++;
  }

  // WALL OF FIRE: a line of kindlings laid ACROSS the view rather than one at the aim -- a barrier to put between
  // yourself and something, or a backfire laid in front of a front to starve it. `grow` widens it (the ultimate).
  // Returns how many of them caught.
  // METEOR (the owner, 2026-11-22: "Give it cooler abilities as well the fire"). A burning stone falls where you
  // look. It lights a RING of fire all at once -- not a patch that then spreads, which is what every other fire
  // ability does -- and throws a hard blast of air out of the middle of it, so the wood bends AWAY from the fire
  // instead of into it and the leaves and the dust go up. It is the loudest thing the element can do.
  _meteor(sim, size = 1, great = false) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire || !this.aim.ok) { this._say('nowhere for it to fall'); return 0; }
    const A = this.aim, up = unit(A.p), f = A.fwd;
    // east and north about the place it falls, so the ring is laid on the ground and not through it
    let ex = up.y * f.z - up.z * f.y, ey = up.z * f.x - up.x * f.z, ez = up.x * f.y - up.y * f.x;
    const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
    const nx = up.y * ez - up.z * ey, ny = up.z * ex - up.x * ez, nz = up.x * ey - up.y * ex;
    const R = (great ? FIREPOWER.meteorUlt : FIREPOWER.meteorR) * (0.7 + 0.3 * size);
    let lit = 0, bad = null;              // bad: the first patch the world refused, so the word can be its own reason
    // the middle first, then the ring: a stone leaves a hole with fire round it
    const mid = ph.lightFire(this.fires, sim.bodyId, A.p, size + 1);
    if (mid && mid.kind !== FUEL.none) lit++; else bad = mid;
    for (let i = 0; i < FIREPOWER.meteorN; i++) {
      const a = (i / FIREPOWER.meteorN) * 6.2831853 + (this.casts % 7) * 0.21;
      const c = Math.cos(a) * R, d = Math.sin(a) * R;
      const q = ph.lightFire(this.fires, sim.bodyId, { x: A.p.x + ex * c + nx * d, y: A.p.y + ey * c + ny * d, z: A.p.z + ez * c + nz * d }, size);
      if (!q) break;                                    // the list is full: the ring is as wide as it could be
      if (q.kind !== FUEL.none) lit++; else if (!bad) bad = q;
    }
    // and the blast: a gust out of the middle, which the trees, the leaves, the dust and the fire itself all read
    castVortex(this.winds, sim.bodyId, A.p, this.casts % 2 ? -1 : 1, great ? WINDPOWER.ultSize : FIREPOWER.meteorBlast * size);
    this.casts++; this.fireCasts++;
    this._say(lit ? (great ? 'a falling star' : 'a meteor falls') : this._fireNone(bad, 'it falls on nothing that will burn'));
    return lit;
  }

  // LANCE OF FIRE: where the wall is laid ACROSS the view, this is laid DOWN it -- a line of fire from your own
  // feet out to as far as the aim reaches, which is how you set a wood alight along a path and not across one.
  _lance(sim, size = 1, grow = 1) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire || !this.aim.ok) return 0;
    const A = this.aim, f = A.fwd, p0 = sim.ex.p;
    const n = Math.max(2, Math.round(FIREPOWER.lanceN * grow)), step = FIREPOWER.lanceStep;
    let lit = 0, bad = null;
    for (let i = 1; i <= n; i++) {
      const k = i * step;
      const q = ph.lightFire(this.fires, sim.bodyId, { x: p0.x + f.x * k, y: p0.y + f.y * k, z: p0.z + f.z * k }, size);
      if (!q) break;
      if (q.kind !== FUEL.none) lit++; else if (!bad) bad = q;
    }
    this.fireCasts++;
    this._say(lit ? 'a lance of fire' : this._fireNone(bad, 'nothing along there will burn'));
    return lit;
  }

  // CINDERS: a handful of sparks let go into the wind. They land where the wind takes them -- scattered downwind
  // of the aim, wide -- and light what they land on. The one fire ability whose shape the WEATHER decides.
  _cinders(sim, size = 1, grow = 1) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire || !this.aim.ok) return 0;
    const A = this.aim, up = unit(A.p);
    // the wind at the aim, level: the physics knows it (the fire asks the same question)
    let we = 0, wn = 0, hx = A.fwd.x, hy = A.fwd.y, hz = A.fwd.z;
    try {
      const w = ph.windAt ? ph.windAt(sim.bodyId, A.p) : null;
      if (w) {
        const d = w.x * up.x + w.y * up.y + w.z * up.z;
        let lx = w.x - up.x * d, ly = w.y - up.y * d, lz = w.z - up.z * d;
        const ll = Math.hypot(lx, ly, lz);
        if (ll > 0.4) { hx = lx / ll; hy = ly / ll; hz = lz / ll; }
      }
    } catch { /* no wind to be had: they go the way you are looking */ }
    let sx = up.y * hz - up.z * hy, sy = up.z * hx - up.x * hz, sz = up.x * hy - up.y * hx;
    const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const n = Math.max(3, Math.round(FIREPOWER.cinderN * grow));
    let lit = 0, bad = null;
    for (let i = 0; i < n; i++) {
      const r = (i + 0.5) / n;                                       // along the wind, spread out
      const a = r * FIREPOWER.cinderFar * grow;
      const b = ((((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * FIREPOWER.cinderWide * grow;
      const q = ph.lightFire(this.fires, sim.bodyId, { x: A.p.x + hx * a + sx * b, y: A.p.y + hy * a + sy * b, z: A.p.z + hz * a + sz * b }, Math.max(1, size - 1));
      if (!q) break;
      if (q.kind !== FUEL.none) lit++; else if (!bad) bad = q;
    }
    this.fireCasts++;
    this._say(lit ? (lit === 1 ? 'one cinder catches' : lit + ' cinders catch') : this._fireNone(bad, 'the cinders find nothing'));
    return lit;
  }

  _wall(sim, size = 1, grow = 1) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire || !this.aim.ok) return 0;
    const A = this.aim;
    // across the view, level: the aim's forward turned a quarter turn about the explorer's own up
    const up = unit(sim.ex.p), f = A.fwd;
    let sx = up.y * f.z - up.z * f.y, sy = up.z * f.x - up.x * f.z, sz = up.x * f.y - up.y * f.x;
    const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const span = FIREPOWER.wallSpan * grow, step = FIREPOWER.wallStep;
    const n = Math.max(2, Math.round(span / step));
    let lit = 0, bad = null;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * span;
      const p = { x: A.p.x + sx * t, y: A.p.y + sy * t, z: A.p.z + sz * t };
      const q = ph.lightFire(this.fires, sim.bodyId, p, size);
      if (!q) break;                                  // the list is full: the wall is as long as it could be
      if (q.kind !== FUEL.none) lit++; else if (!bad) bad = q;
    }
    this.fireCasts++;
    if (grow === 1) this._say(lit ? 'a wall of fire' : this._fireNone(bad, 'nothing here will carry a wall'));
    return lit;
  }

  // SNUFF: put out everything burning within `r` of the aim. The counterweight to all of the above: a power that
  // can set a wood alight needs one that can stop it, and without this the fire is only a way of spoiling a world.
  // ---- SPACE AND TIME, THE THIRD ELEMENT (docs/POWERS-TIME.md; the owner, 2026-11-22) ---------------------
  // Eight of the twelve are built. Each one moves the world's own machinery -- the same rule the wind and the
  // fire are built by: a gust makes real wind, a bellows makes real wind, and a slowed place really slows every
  // grain and every patch of fire inside it (physics/times.js timeAt, read by loose.js and fire.js).

  // STILL THE MOMENT. Cast and left: it outlives the hand -- you walk away, come back, and the rain is still
  // hanging where it was. One of the four big ones now, so the sphere holds a WOOD and not a bush
  // (TIMEPOWERS.stillSize over physics/times.js TIMEPOWER.radius, which is 14 m).
  _freeze(sim, size = 1) {
    if (!this.aim.ok) { this._say('nothing there to hold'); return null; }
    const z = castTime(this.times, sim.bodyId, this.aim.p, TIMEPOWER.stillRate, size * TIMEPOWERS.stillSize,
      TIMEPOWER.stillLife, false);
    this.timeCasts++;
    this._say('the moment is held');
    return z;
  }

  // THE TURNING YEAR: a dial the whole picture is built on, put in the player's hand. It is held: the year turns
  // while the hand is down and stays where it is let go.
  _year(dt, down) {
    if (!down) return SEASON.t;
    SEASON.held = true;                                  // held where the player puts it, not running on by itself
    if (this._yearBack == null) this._yearBack = false;
    const k = TIMEPOWERS.yearRate * dt * (this._yearBack ? -1 : 1);
    let t = SEASON.t + k;
    // at either end of the year it turns round, so one key walks the whole turn and back
    if (t > 1) { t = 1; this._yearBack = true; } else if (t < 0) { t = 0; this._yearBack = false; }
    SEASON.t = t;
    SEASON._u = t;
    return SEASON.t;
  }

  // THE RIP IN SPACE-TIME (the owner's own idea, 2026-11-22: "a rip in space time that sucks everything in a long
  // ways in"). A tear torn open where you look. It is a WIND SOURCE of its own kind (physics/powers.js KIND.rip),
  // so everything in the world that already answers the wind answers it with nothing added: the leaves off the
  // crowns, the dust, the spray off the water, the rain, the grass, the cloak. And it takes the trees as well --
  // not thrown outward as a gust throws them, but pulled INWARD, over towards the tear.
  _rip(sim, size = 1) {
    if (!this.aim.ok) { this._say('nothing there to tear'); return null; }
    const T = TIMEPOWERS;
    const reach = Math.min(T.ripUlt, T.ripReach * (size > 1 ? size : 1));
    const s = castRip(this.winds, sim.bodyId, this.aim.p, reach, T.ripLife);
    this.timeCasts++;
    const felled = this._fellArea(sim, this.aim.p, reach * T.ripFell, 'in');
    this._say(felled ? 'the rip takes ' + felled + (felled === 1 ? ' tree' : ' trees') : 'a rip in the world');
    return s;
  }

  // FOLDING SPACE. THE OWNER'S OWN WORDS for how it must feel (2026-11-22): "make it a bit more theatrical like
  // the world is getting pulled towards you". So it is not a step to where you look any more -- nothing jumps in
  // one frame. The ground, the trees and the sky are DRAWN PAST YOU over half a second, fast at the first instant
  // and settling at the end, while the air itself pours inward along the way (a gust cast from where you looked
  // back towards your own feet, so the leaves and the dust stream at you and not away). Then you are standing
  // there. The rush is the camera's own: the explorer is carried a hundred metres in 0.55 s, which is 180 m/s,
  // and everything near enough to see goes by.
  // (It is also kinder to the world: the ground you are going to has half a second to be made before you arrive,
  // where a jump gave it none.)
  _fold(sim, size = 1) {
    if (!this.aim.ok) { this._say('nowhere to fold to'); return false; }
    const A = this.aim, T = TIMEPOWERS;
    // HOW FAR IT CARRIES YOU. Until v32 this was the aim times foldReach, and the aim was never more than thirty
    // metres, so every fold was about a hundred. The aim reaches the real land now (_aim), so a fold goes to WHERE
    // YOU LOOKED when that is further -- which is the design's own word for it, "you are there" -- and is never
    // shorter than it was, because the two are taken whichever is the greater. foldMax bounds the whole thing.
    const grow = size > 1 ? 1 + (size - 1) * 0.5 : 1;
    // (?aimray=0: the v32 fold exactly -- the pitch rule's aim times foldReach, uncapped, over foldTime)
    let want = (AIM_RAY ? Math.max(A.dist, A.pitchDist * T.foldReach) : A.dist * T.foldReach) * grow;
    if (AIM_RAY && want > T.foldMax) want = T.foldMax;
    const p0 = { x: sim.ex.p.x, y: sim.ex.p.y, z: sim.ex.p.z }, up0 = unit(p0);
    // DO NOT STAND THEM ON THE FACE OF A LAKE: the fold stops at the last dry ground short of the water.
    let stopped = false;
    if (FOLD_AIR) {
      const stop = this._dryStop(sim, p0, A.fwd, want);
      if (stop >= 0) {
        // the water is at their feet and there is nowhere dry to go: it says so and is not spent
        if (stop < 2) { this._say('the water is in the way'); return false; }
        want = stop; stopped = true;
      }
    }
    const far = add(p0, A.fwd, want);
    // and the rush takes as long as the distance asks at the pace the owner already saw, between the old half
    // second and foldLifeMax: a fold three times as long is not three times as fast
    const life = AIM_RAY ? Math.min(T.foldLifeMax, Math.max(T.foldTime, want / T.foldSpeed)) : T.foldTime;
    const back = { x: -A.fwd.x, y: -A.fwd.y, z: -A.fwd.z };
    this.fold = { bodyId: sim.bodyId, p0, p1: far, t: 0, life, back, air: null };
    // THE AIR AT THE FOLD'S OWN SPEED. Until v32 ONE gust was cast at the FAR END pointing back at the feet -- and
    // a gust's front runs out at WINDPOWER.gustFront, 26 m/s, while the fold carries the explorer at about 180. So
    // the air the owner asked for ("the world is getting pulled towards you") was left a hundred metres behind in
    // the first frame and the eye went through still air the whole way. ONE source is cast instead, AT THE HANDS,
    // pointing back along the travel, and _stepFold CARRIES IT with them for the whole rush: the air at the eye is
    // at the gust's full speed from the first frame and eases to about a third of it by the end, which is the
    // pulse running out behind them. It is never cast per frame -- there are six slots in all
    // (physics/powers.js WINDPOWER.max) and a gust a frame would fill them in a tenth of a second and leave
    // nothing for the next ability.
    if (FOLD_AIR) this.fold.air = castGust(this.winds, sim.bodyId, add(p0, up0, POWERS.hands), back, 1.35, WINDPOWER.sizeMax, false);
    else castGust(this.winds, sim.bodyId, far, back, 1.35, WINDPOWER.sizeMax, false);     // (?foldair=0: the v32 gust, at the far end, left there)
    this.timeCasts++;
    this._say(stopped ? 'the fold stops at the water' : 'space folds');
    return true;
  }

  // HOW FAR ALONG THE WAY THE GROUND IS STILL DRY (m), or -1 for "go the whole way" (the owner's fold used to set
  // them down standing on the face of a lake for a frame). Thirteen samples along the fold's line, which is 47 m
  // apart on the longest fold the cap allows and 8 m on an ordinary hundred-metre one: a brook can be folded over
  // and a lake cannot. It fails SAFE in every direction -- a sample that cannot be had, and a start already in the
  // water (they are swimming, and a fold out of a lake must still work), both give -1, because a wet landing is
  // better than a power that refuses for a bad sample.
  _dryStop(sim, p0, f, len) {
    if (!sim.sampleSurface || !(len > 0)) return -1;
    const N = 12, deep = 0.35;        // m of standing water that is more than a boot (explorer.js: wading slows at 1.0, floats at 1.25)
    let dry = 0;
    for (let i = 0; i <= N; i++) {
      const L = len * i / N;
      let g = null;
      try { g = sim.sampleSurface(sim.bodyId, unit(add(p0, f, L))); } catch { return -1; }
      if (!g || !(g.radius > 0)) return -1;
      if ((g.liquidRadius || 0) - g.radius > deep) return i ? dry : -1;
      dry = L;
    }
    return -1;                        // dry the whole way
  }

  // One frame of a fold: the world drawn past, eased out at the end. Called from update while this.fold lives.
  _stepFold(sim, dt) {
    const f = this.fold;
    if (!f) return false;
    if (f.bodyId !== sim.bodyId) { this.fold = null; return false; }
    f.t += dt;
    const x = f.t >= f.life ? 1 : f.t / f.life;
    // fast at the first instant, settling at the end: 1 - (1 - x)^ease
    const u = 1 - Math.pow(1 - x, TIMEPOWERS.foldEase);
    const p = { x: f.p0.x + (f.p1.x - f.p0.x) * u, y: f.p0.y + (f.p1.y - f.p0.y) * u, z: f.p0.z + (f.p1.z - f.p0.z) * u };
    // LAND THEM RUNNING. Until v32 the speed was zeroed on every frame of the rush INCLUDING the last, so a
    // hundred-metre fold ended in a dead stop and the gait and the camera started again from nothing. The last
    // frame keeps TIMEPOWERS.foldLand along the travel, levelled where they arrive; every frame before it is still
    // zeroed, because the position is written outright there and a kept speed would only let gravity pile up a
    // fall to be paid for on arrival.
    let v = null;
    if (x >= 1 && FOLD_AIR) {
      const uq = unit(p);
      let vx = f.p1.x - f.p0.x, vy = f.p1.y - f.p0.y, vz = f.p1.z - f.p0.z;
      const kk = vx * uq.x + vy * uq.y + vz * uq.z;
      vx -= uq.x * kk; vy -= uq.y * kk; vz -= uq.z * kk;
      const ll = Math.hypot(vx, vy, vz);
      if (ll > 1e-3) { const s = TIMEPOWERS.foldLand / ll; v = { x: vx * s, y: vy * s, z: vz * s }; }
    }
    const ok = this._step(sim, p, v);
    // THE AIR CARRIED WITH THEM: the same source, moved and turned, never cast again. A slot that has been taken
    // for another cast since is let go instead of being dragged about -- a recycled slot is YOUNGER than the fold,
    // because take() wipes the age (physics/powers.js), and the two ages run together to within a frame otherwise.
    const a = f.air;
    if (a) {
      if (a.kind === KIND.jet && a.bodyId === f.bodyId && a.age + 1e-3 >= f.t) {
        const q = sim.ex.p, uq2 = unit(q);
        moveWind(a, add(q, uq2, POWERS.hands));
        turnWind(a, f.back);
        // the rush is over: the air eases out over foldAirTail instead of standing at the arrival for three seconds
        if (x >= 1) { const end = a.age + TIMEPOWERS.foldAirTail; if (end < a.life) a.life = end; }
      } else f.air = null;
    }
    if (x >= 1 || !ok) { this.fold = null; return ok; }
    return true;
  }

  // Put the explorer on the ground at a place in this world's own axes. (sim.teleport respawns the whole world,
  // which is right for crossing a solar system and wrong for a fold of a hundred metres: the sim moves the
  // explorer by writing ex.p itself, and so does this.)
  // `v`: what to leave their speed at (body-local, m/s), or nothing to zero it.
  _step(sim, p, v = null) {
    if (!p || !sim.ex || !sim.sampleSurface) return false;
    try {
      const d = unit(p);
      const g = sim.sampleSurface(sim.bodyId, d);
      const r = Math.max(g.radius, g.liquidRadius || 0) + 0.05;
      sim.ex.p = { x: d.x * r, y: d.y * r, z: d.z * r };
      if (sim.ex.v) { sim.ex.v.x = v ? v.x : 0; sim.ex.v.y = v ? v.y : 0; sim.ex.v.z = v ? v.z : 0; }
      return true;
    } catch { return false; }
  }

  _snuff(sim, r) {
    const ph = sim.physics;
    if (!ph || !ph.douseNear || !this.aim.ok) return 0;
    const n = ph.douseNear(this.fires, sim.bodyId, this.aim.p, r);
    this.fireCasts++;
    this._say(n ? (n === 1 ? 'the fire is out' : n + ' fires are out') : 'nothing burning here');
    return n;
  }

  // FIRE WHIRL (the owner: "fire tornados can be a thing"). The physics says when a fire has gathered enough of
  // itself in one place, in air still enough, to raise a turning column (physics/fire.js whirlCheck -> F.whirl).
  // This ability takes that column and makes it real: a vortex in the wind at the fire's own middle, which then
  // throws the fire outward the way a real one does -- because the vortex IS wind, and the fire reads the wind.
  // Without a fire big enough it says so and nothing happens: it is a thing you earn by building a fire first.
  _fireWhirl(sim, size = 1, great = false) {
    const ph = sim.physics;
    if (!ph || !ph.fireWhirl) return null;
    const w = ph.fireWhirl(this.fires);
    if (!w || w.bodyId !== sim.bodyId) { this._say('no fire great enough to turn'); return null; }
    if (this.aim.ok) {
      const dx = w.px - this.aim.p.x, dy = w.py - this.aim.p.y, dz = w.pz - this.aim.p.z;
      if (dx * dx + dy * dy + dz * dz > FIREPOWER.whirlR * FIREPOWER.whirlR) { this._say('the fire is too far to turn'); return null; }
    }
    castVortex(this.winds, sim.bodyId, { x: w.px, y: w.py, z: w.pz }, this.casts % 2 ? -1 : 1, great ? WINDPOWER.sizeMax : size);
    this.casts++;
    this._say(great ? 'a tower of fire' : 'the fire turns');
    return w;
  }

  // THE WORD FOR A FIRE THAT LIT NOTHING: the world's own reason where it gave one -- chiefly 'too far away to
  // light', now that the aim reaches three hundred metres and the fire reaches a hundred and twenty-eight -- and
  // the ability's own words otherwise. Without this a cast at the far ridge said 'nothing here will burn' and sent
  // the player looking for drier ground when the ground was never the matter.
  _fireNone(q, word) { return (q && q.kind === FUEL.none && FIRE_WHY[q.why]) || word; }

  // The place a kindling really starts: the aim if it will burn, else the nearest ground short of it (and a step to
  // each side) that will. Returns the aim itself when nothing near it burns, so the ability's own flame still shows
  // and the word on the screen can say why.
  // (_farAim: the aim ITSELF was refused for being beyond what the world has looked at. The kindling then falls
  //  short along the same line and lights where the ground is known, which is the right thing to do and was until
  //  now done in silence -- the fire simply appeared a hundred metres nearer than the ring with no word at all.)
  _fireSpot(sim, aim) {
    const ph = sim.physics;
    this._farAim = false;
    if (!ph.fuelAt || !this.aim.ok) return aim;
    const o = this._fuel || (this._fuel = {});
    if (ph.fuelAt(sim.bodyId, aim, o).kind !== FUEL.none) return aim;
    this._farAim = o.why === FIRE_TOO_FAR;
    const from = this.aim.from, dx = aim.x - from.x, dy = aim.y - from.y, dz = aim.z - from.z;
    const up = unit(sim.ex.p);
    // the aim's right, for the two steps aside (the river runs along the view as often as across it)
    let rx = dy * up.z - dz * up.y, ry = dz * up.x - dx * up.z, rz = dx * up.y - dy * up.x;
    const rl = Math.hypot(rx, ry, rz); if (rl > 1e-6) { rx /= rl; ry /= rl; rz /= rl; }
    const q = this._spot || (this._spot = { x: 0, y: 0, z: 0 });
    for (const k of [0.8, 0.6, 0.45, 0.3, 0.2]) {
      for (const side of [0, 2.5, -2.5]) {
        q.x = from.x + dx * k + rx * side; q.y = from.y + dy * k + ry * side; q.z = from.z + dz * k + rz * side;
        if (ph.fuelAt(sim.bodyId, q, o).kind !== FUEL.none) return q;
      }
    }
    return aim;
  }

  _orbAt(sim, ahead) {
    const A = this.aim, p = sim.ex.p, up = unit(p), q = add(p, A.fwd, ahead), d = unit(q);
    let r = Math.hypot(p.x, p.y, p.z);
    try { const s = sim.sampleSurface(sim.bodyId, d); if (s) r = Math.max(s.radius || 0, s.liquidRadius || 0) || r; } catch { /* level with the explorer */ }
    return { x: d.x * r, y: d.y * r, z: d.z * r };
  }
  _cast(sim) { this.casts++; if (sim.ex) sim.ex.casting = 1; if (this.onCast) this.onCast(this.list[this.ability].id); }   // (onCast: the sound, main.js)
}

// The hands: a key, the right mouse button, a gamepad's bumpers. (The touch button is ui/powers.js, which sets
// powers.keys.touch and calls pick().) Returns a function that takes the listeners away again.
export function attachPowerInputs(powers, target = window) {
  const kd = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyQ') powers.keys.cast = true;
    else if (e.code === 'KeyG') powers.nextElement();       // (G: the element in the hand: wind, fire, space and time)
    // 1..9 then 0, - and =, because space and time has TWELVE and nine keys cannot reach them (2026-11-22)
    else if (/^Digit[1-9]$/.test(e.code)) powers.pick(+e.code.slice(5) - 1);
    else if (e.code === 'Digit0') powers.pick(9);
    else if (e.code === 'Minus') powers.pick(10);
    else if (e.code === 'Equal') powers.pick(11);
  };
  const ku = (e) => { if (e.code === 'KeyQ') powers.keys.cast = false; };
  const md = (e) => { if (e.button === 2) powers.keys.mouse = true; };
  const mu = (e) => { if (e.button === 2) powers.keys.mouse = false; };
  const cm = (e) => { e.preventDefault(); };
  const blur = () => { powers.keys.cast = powers.keys.mouse = powers.keys.pad = powers.keys.touch = false; powers.cancelHold(); };
  target.addEventListener('keydown', kd); target.addEventListener('keyup', ku);
  target.addEventListener('mousedown', md); target.addEventListener('mouseup', mu);
  target.addEventListener('contextmenu', cm); target.addEventListener('blur', blur);
  // the bumpers: right casts or holds, left steps to the next ability (read once a frame by pollPad)
  let lbWas = false;
  powers.pollPad = () => {
    let pad = null;
    try { const all = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of all) if (g && g.connected) { pad = g; break; } } catch { /* no pads */ }
    if (!pad) { powers.keys.pad = false; return; }
    const b = pad.buttons, rb = !!(b[5] && b[5].pressed), lb = !!(b[4] && b[4].pressed);
    powers.keys.pad = rb;
    if (lb && !lbWas) powers.next();
    lbWas = lb;
  };
  return () => {
    target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku);
    target.removeEventListener('mousedown', md); target.removeEventListener('mouseup', mu);
    target.removeEventListener('contextmenu', cm); target.removeEventListener('blur', blur);
  };
}
