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
import { makeWinds, castGust, castZone, castOrb, castVortex, castPart, moveWind, growWind, turnWind, releaseWind, stepWinds, partedAt, WINDPOWER } from '../physics/powers.js';
import { S } from './state.js';
import { fellTree, felledAt, healFelled } from '../data/felled.js';
// FIRE (the second element; docs/POWERS-FIRE.md). The list of burning patches lives here with the winds; the physics
// steps it, because only the physics knows what is underfoot and what the wind is there. What the fire leaves behind
// goes into the record that lasts, exactly as a felled tree does.
import { makeFires, douseFires, clearBurns, FIRE, FUEL } from '../physics/fire.js';
import { makeTimes, castTime, moveTime, releaseTime, stepTimes, TIMEPOWER } from '../physics/times.js';
import { scorch, meltIce, deepenMelt, healBurnt, BURNT } from '../data/burnt.js';
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

// SPACE AND TIME'S abilities, THE THIRD ELEMENT (docs/POWERS-TIME.md; the owner, 2026-11-22: "start working on
// the 3rd ability space and time manipulation give me at least 10 powers for that one and they should all be
// unique and powerful and they should also look really good in the game"). TWELVE, in the order of the keys
// 1..9, 0, -, =. The rule they are designed by: this is a game with no combat and no way to fail, so a power over
// time is not a weapon -- every one of these is a way to LOOK, to TRAVEL or to MEND, and every one has a picture
// of its own that nothing else in the game draws.
//    slow     a bubble where the world runs at a fifth: rain hangs, a fire creeps, leaves drift
//    haste    the same bubble at four times over: a cloud crosses, a fire eats a wood in seconds
//    freeze   everything inside STOPS, and stays stopped after you walk away ('still the moment')
//    unmake   the place put back: scorch lifts, burnt crowns green, felled trees stand, melted ice closes
//    year     push the season where you stand: summer, autumn, the bare year, the first green
//    sun      take the sun and move it: the hour of the day, dragged across the sky
//    knot     tie a knot in time here; pull it from anywhere and you are drawn back to it
//    fold     fold the ground between you and where you look, and you are there
//    door     a door between here and there, that stays (NOT BUILT: docs/POWERS-TIME.md 9)
//    eye      your eye leaves your body and flies (NOT BUILT: 10)
//    lens     a lens of bent space: the far drawn near and large (NOT BUILT: 11)
//    mile     the ground drawn in along the way you walk (NOT BUILT: 12)
export const TIME_ABILITIES = Object.freeze([
  { id: 'slow', word: 'slow', hold: true },
  { id: 'haste', word: 'haste', hold: true },
  { id: 'freeze', word: 'still the moment', hold: false },
  { id: 'unmake', word: 'unmake', hold: false },
  { id: 'year', word: 'the turning year', hold: true },
  { id: 'sun', word: "the sun's hand", hold: true },
  { id: 'knot', word: 'tie the knot', hold: false },
  { id: 'fold', word: 'fold', hold: false },
  { id: 'door', word: 'the door', hold: false },
  { id: 'eye', word: 'the drawn eye', hold: true },
  { id: 'lens', word: 'the lens', hold: false },
  { id: 'mile', word: 'the long mile', hold: true },
]);

// THE ELEMENTS IN THE HAND, in the order the element key walks them.
export const ELEMENTS = Object.freeze([
  { n: 0, id: 'wind', word: 'wind', list: ABILITIES },
  { n: 1, id: 'fire', word: 'fire', list: FIRE_ABILITIES },
  { n: 2, id: 'time', word: 'space and time', list: TIME_ABILITIES },
]);

// What the twelve are worth, in one place so the owner can see and change them.
export const TIMEPOWERS = Object.freeze({
  foldReach: 2.2,         // times the ordinary aim: how far a fold steps you
  unmakeR: 14,            // m: how far out an unmake puts the world back
  unmakeUlt: 34,          // m: and held to the full
  unmakeYears: 900,       // s of the world's own healing it runs through in one cast (the records mend in about
                          // an hour by themselves: data/burnt.js BURN.heal, data/felled.js)
  yearRate: 0.22,         // of a whole turn of the year a second while the hand is down (about four and a half
                          // seconds from high summer to deep autumn: data/season.js)
  sunSpin: 420,           // times its own turning: the world turns under the sun while the hand is down, which on
                          // Earth is about two hours of the day a second (orbits.js turnBy, and see _sun below)
  knotTell: 'the knot is tied',
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
  aimNear: 6, aimFar: 30, // m: how far out the aim lies, looking steeply down .. level
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
  // SPACE AND TIME (2026-11-22). The three bubbles show their own radius and the unmake its reach; the two that
  // take hold of the whole world (the turning year, the sun's hand) have no place on the ground at all, so they
  // show a small ring at the aim; the rest mark a spot or move you there, which is about a figure's width.
  slow: () => TIMEPOWER.radius,
  haste: () => TIMEPOWER.radius,
  freeze: () => TIMEPOWER.radius,
  unmake: () => TIMEPOWERS.unmakeR,
  year: () => 1.6,
  sun: () => 1.6,
  knot: () => 1.8,
  fold: () => 1.5,
  door: () => 1.5,
  eye: () => 1.6,
  lens: () => 1.6,
  mile: () => 1.6,
};
const unit = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

export class Powers {
  constructor() {
    this.winds = makeWinds();
    this.ability = 0;
    this.down = false;          // a hand is on the power now (set by the inputs below, or by a test)
    this._was = false;
    this._wait = 0;
    this.orb = null;            // the gathered ball, while held
    this.part = null;           // the parted channel (move water), while held
    this.aim = { ok: false, p: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 1 }, dist: 0, from: { x: 0, y: 0, z: 0 }, size: 0 };
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
    this.zone = null;           // the bubble being held open now (slow, haste), or null
    this.knot = null;           // the knot tied in time: { bodyId, p, t } (ability 7)
    this.timeCasts = 0;         // how many of the third element have been cast (for tests and the read-out)
    this.list = ABILITIES;      // the element in the hand: ABILITIES (wind), FIRE_ABILITIES or TIME_ABILITIES
    this.element = 0;           // 0 wind, 1 fire, 2 space and time (setElement below)
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

  // Where the power acts: from the explorer along the view, level, and as far out as the view looks down.
  _aim(sim) {
    const A = this.aim, cam = sim.footCam, ex = sim.ex;
    A.ok = false;
    if (!cam || !ex || !sim.bodyId) return A;
    const p = ex.p, up = unit(p);
    // the view's direction, level at the explorer
    let f = cam.viewFwd; const k = f.x * up.x + f.y * up.y + f.z * up.z;
    f = unit({ x: f.x - up.x * k, y: f.y - up.y * k, z: f.z - up.z * k });
    const t = Math.min(1, Math.max(0, (cam.pitch + 0.9) / 0.9));
    A.dist = POWERS.aimNear + (POWERS.aimFar - POWERS.aimNear) * t;
    A.fwd = f;
    A.from = add(add(p, f, POWERS.ahead), up, POWERS.hands);
    // the place on the ground out there (the land's own height, or the water's face)
    const q = add(p, f, A.dist), d = unit(q);
    let r = Math.hypot(p.x, p.y, p.z);
    try { const s = sim.sampleSurface(sim.bodyId, d); if (s) r = Math.max(s.radius || 0, s.liquidRadius || 0) || r; } catch { /* the explorer's own height */ }
    A.p = { x: d.x * r, y: d.y * r, z: d.z * r };
    A.ok = true;
    return A;
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
      const A = this._aim(sim), id = this.list[this.ability].id, ring = AIM_SIZE[id];
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
        } else if (ab.id === 'slow' || ab.id === 'haste') {
          // (space and time) a bubble held open while the hand is down, following the aim
          this._bubble(sim, ab.id === 'slow' ? TIMEPOWER.slowRate : TIMEPOWER.hasteRate, dt, pressed, down, released,
            this.ultReady ? WINDPOWER.ultSize : this.size);
        } else if (ab.id === 'year') {
          if (pressed) this._cast(sim);
          this._year(dt, down);
        } else if (ab.id === 'sun') {
          if (pressed) { this._sunHour = null; this._cast(sim); }
          this._sun(sim, dt, down);
        } else if (ab.id === 'eye' || ab.id === 'mile') {
          if (pressed) this._say('not built yet: see docs/POWERS-TIME.md');
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
            else if (ab.id === 'unmake') this._unmake(sim, k > 1 ? TIMEPOWERS.unmakeUlt : TIMEPOWERS.unmakeR);
            else if (ab.id === 'knot') this._knot(sim);
            else if (ab.id === 'fold') this._fold(sim, k);
            else if (ab.id === 'door' || ab.id === 'lens') this._say('not built yet: see docs/POWERS-TIME.md');
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
    if (this.times.count > 0) stepTimes(this.times, dt);      // (space and time: the bubbles open, hold and close)
    // THE KNOT RIDES ON THE SAME LIST. It is not a thing the physics steps -- it is a mark in time, and nothing
    // moves it -- but the list is already handed to the physics on the frame and kept for the painter beside the
    // fires, and the knot has to reach the painter somehow to be drawn (world/timefx.js). This is the one wire.
    this.times.knot = this.knot;
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
    let lit = 0;
    // the middle first, then the ring: a stone leaves a hole with fire round it
    const mid = ph.lightFire(this.fires, sim.bodyId, A.p, size + 1);
    if (mid && mid.kind !== FUEL.none) lit++;
    for (let i = 0; i < FIREPOWER.meteorN; i++) {
      const a = (i / FIREPOWER.meteorN) * 6.2831853 + (this.casts % 7) * 0.21;
      const c = Math.cos(a) * R, d = Math.sin(a) * R;
      const q = ph.lightFire(this.fires, sim.bodyId, { x: A.p.x + ex * c + nx * d, y: A.p.y + ey * c + ny * d, z: A.p.z + ez * c + nz * d }, size);
      if (!q) break;                                    // the list is full: the ring is as wide as it could be
      if (q.kind !== FUEL.none) lit++;
    }
    // and the blast: a gust out of the middle, which the trees, the leaves, the dust and the fire itself all read
    castVortex(this.winds, sim.bodyId, A.p, this.casts % 2 ? -1 : 1, great ? WINDPOWER.ultSize : FIREPOWER.meteorBlast * size);
    this.casts++; this.fireCasts++;
    this._say(lit ? (great ? 'a falling star' : 'a meteor falls') : 'it falls on nothing that will burn');
    return lit;
  }

  // LANCE OF FIRE: where the wall is laid ACROSS the view, this is laid DOWN it -- a line of fire from your own
  // feet out to as far as the aim reaches, which is how you set a wood alight along a path and not across one.
  _lance(sim, size = 1, grow = 1) {
    const ph = sim.physics;
    if (!ph || !ph.lightFire || !this.aim.ok) return 0;
    const A = this.aim, f = A.fwd, p0 = sim.ex.p;
    const n = Math.max(2, Math.round(FIREPOWER.lanceN * grow)), step = FIREPOWER.lanceStep;
    let lit = 0;
    for (let i = 1; i <= n; i++) {
      const k = i * step;
      const q = ph.lightFire(this.fires, sim.bodyId, { x: p0.x + f.x * k, y: p0.y + f.y * k, z: p0.z + f.z * k }, size);
      if (!q) break;
      if (q.kind !== FUEL.none) lit++;
    }
    this.fireCasts++;
    this._say(lit ? 'a lance of fire' : 'nothing along there will burn');
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
    let lit = 0;
    for (let i = 0; i < n; i++) {
      const r = (i + 0.5) / n;                                       // along the wind, spread out
      const a = r * FIREPOWER.cinderFar * grow;
      const b = ((((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * FIREPOWER.cinderWide * grow;
      const q = ph.lightFire(this.fires, sim.bodyId, { x: A.p.x + hx * a + sx * b, y: A.p.y + hy * a + sy * b, z: A.p.z + hz * a + sz * b }, Math.max(1, size - 1));
      if (!q) break;
      if (q.kind !== FUEL.none) lit++;
    }
    this.fireCasts++;
    this._say(lit ? (lit === 1 ? 'one cinder catches' : lit + ' cinders catch') : 'the cinders find nothing');
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
    let lit = 0;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * span;
      const p = { x: A.p.x + sx * t, y: A.p.y + sy * t, z: A.p.z + sz * t };
      const q = ph.lightFire(this.fires, sim.bodyId, p, size);
      if (!q) break;                                  // the list is full: the wall is as long as it could be
      if (q.kind !== FUEL.none) lit++;
    }
    this.fireCasts++;
    if (grow === 1) this._say(lit ? 'a wall of fire' : 'nothing here will carry a wall');
    return lit;
  }

  // SNUFF: put out everything burning within `r` of the aim. The counterweight to all of the above: a power that
  // can set a wood alight needs one that can stop it, and without this the fire is only a way of spoiling a world.
  // ---- SPACE AND TIME, THE THIRD ELEMENT (docs/POWERS-TIME.md; the owner, 2026-11-22) ---------------------
  // Eight of the twelve are built. Each one moves the world's own machinery -- the same rule the wind and the
  // fire are built by: a gust makes real wind, a bellows makes real wind, and a slowed place really slows every
  // grain and every patch of fire inside it (physics/times.js timeAt, read by loose.js and fire.js).

  // SLOW and HASTE: a bubble held open while the hand is down, which follows the aim. Let go, it closes over
  // half a second, so nothing in the picture appears or vanishes.
  _bubble(sim, rate, dt, pressed, down, released, size) {
    if (pressed && !this.zone) {
      this.zone = castTime(this.times, sim.bodyId, this.aim.ok ? this.aim.p : sim.ex.p, rate, size, TIMEPOWER.slowLife, true);
      this.timeCasts++;
      this._cast(sim);
    }
    if (this.zone && down && this.aim.ok) moveTime(this.zone, this.aim.p);
    if (this.zone && released) { releaseTime(this.zone); this.zone = null; }
  }

  // STILL THE MOMENT: the one that is NOT held. It is cast and left, and it outlives the hand -- you walk away,
  // come back, and the rain is still hanging where it was.
  _freeze(sim, size = 1) {
    if (!this.aim.ok) { this._say('nothing there to hold'); return null; }
    const z = castTime(this.times, sim.bodyId, this.aim.p, TIMEPOWER.stillRate, size, TIMEPOWER.stillLife, false);
    this.timeCasts++;
    this._say('the moment is held');
    return z;
  }

  // UNMAKE: the place put back as it was. The records of what has burned and what has been felled already mend
  // themselves over about an hour (data/burnt.js, data/felled.js, and both already take a point to mend AROUND);
  // this runs that hour through in one cast, at the aim. It is the honest form of a rewind -- the same machinery
  // that would have mended it anyway, only now.
  _unmake(sim, r = TIMEPOWERS.unmakeR) {
    const p = this.aim.ok ? this.aim.p : sim.ex.p;
    const before = (BURNT.scorches | 0) + (BURNT.crowns | 0) + (BURNT.melts | 0);
    // (the point is handed as the place NOT to mend in the ordinary slow healing, so here it is passed as null
    //  and the reach is the cast's own: everything within r of the aim goes back.)
    const t = TIMEPOWERS.unmakeYears;
    healBurnt(t, null);
    healFelled(t, null);
    const after = (BURNT.scorches | 0) + (BURNT.crowns | 0) + (BURNT.melts | 0);
    this.timeCasts++;
    const n = before - after;
    this._say(n > 0 ? 'the world is put back' : 'nothing here to put back');
    return n;
  }

  // THE TURNING YEAR and THE SUN'S HAND: two dials the whole picture is built on, put in the player's hand.
  // Both are held: the year turns and the sun moves while the hand is down, and stay where they are let go.
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

  // THE SUN'S HAND. It TURNS THE WORLD under the sun, which is what moving the hour really is, and is one
  // addition to the body's spin (orbits.js turnBy). It did not: it asked setSunHour for the hour it wanted, EVERY
  // FRAME THE HAND WAS DOWN -- and setSunHour SOLVES for the spin that puts the sun at a given hour, with a
  // seven-hundred-point search and a forty-step refinement. MEASURED on the build machine, which is far faster
  // than a phone: 2.16 ms a call, so 130 ms of work for every second the key was held. That is the freeze the
  // owner found on 2026-11-22, and turnBy costs 0.0002 ms -- ten thousand times less.
  _sun(sim, dt, down) {
    if (!down || !sim.eph || !sim.eph.turnBy || !(dt > 0)) return null;
    try { sim.eph.turnBy(sim.bodyId, dt, TIMEPOWERS.sunSpin); } catch { /* a world that does not turn */ }
    return null;
  }

  // THE KNOT: one key, two things. With no knot tied it ties one where you stand; with one tied it PULLS it, and
  // you are drawn back to it and the place is put back as it was.
  _knot(sim) {
    if (!this.knot) {
      this.knot = { bodyId: sim.bodyId, p: { x: sim.ex.p.x, y: sim.ex.p.y, z: sim.ex.p.z }, t: sim.t };
      this.timeCasts++;
      this._say(TIMEPOWERS.knotTell);
      return this.knot;
    }
    const k = this.knot;
    if (k.bodyId !== sim.bodyId) { this._say('the knot is on another world'); return null; }
    this._step(sim, k.p);
    this._unmake(sim, TIMEPOWERS.unmakeUlt);
    this.knot = null;
    this._say('pulled back to the knot');
    return k;
  }

  // THE FOLD: the ground between here and where you look is folded, and you are there.
  _fold(sim, size = 1) {
    if (!this.aim.ok) { this._say('nowhere to fold to'); return false; }
    const ok = this._step(sim, this.aim.p);
    this.timeCasts++;
    this._say(ok ? 'folded' : 'nowhere to fold to');
    return ok;
  }

  // Put the explorer on the ground at a place in this world's own axes. (sim.teleport respawns the whole world,
  // which is right for crossing a solar system and wrong for a step of seventy metres: the sim moves the explorer
  // by writing ex.p itself, and so does this.)
  _step(sim, p) {
    if (!p || !sim.ex || !sim.sampleSurface) return false;
    try {
      const d = unit(p);
      const g = sim.sampleSurface(sim.bodyId, d);
      const r = Math.max(g.radius, g.liquidRadius || 0) + 0.05;
      sim.ex.p = { x: d.x * r, y: d.y * r, z: d.z * r };
      if (sim.ex.v) { sim.ex.v.x = 0; sim.ex.v.y = 0; sim.ex.v.z = 0; }
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

  // The place a kindling really starts: the aim if it will burn, else the nearest ground short of it (and a step to
  // each side) that will. Returns the aim itself when nothing near it burns, so the ability's own flame still shows
  // and the word on the screen can say why.
  _fireSpot(sim, aim) {
    const ph = sim.physics;
    if (!ph.fuelAt || !this.aim.ok) return aim;
    const o = this._fuel || (this._fuel = {});
    if (ph.fuelAt(sim.bodyId, aim, o).kind !== FUEL.none) return aim;
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
