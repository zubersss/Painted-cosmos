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
import { scorch, meltIce, deepenMelt, healBurnt } from '../data/burnt.js';
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
export const FIRE_ABILITIES = Object.freeze([
  { id: 'kindle', word: 'kindle', hold: false },
]);

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
    this.list = ABILITIES;      // the element in the hand: ABILITIES (wind) or FIRE_ABILITIES
    this.element = 0;           // 0 wind, 1 fire (setElement below)
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
        const m = meltIce(b.bodyId, b.px, b.py, b.pz, b.radius);
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
  setElement(n) {
    const want = n ? FIRE_ABILITIES : ABILITIES;
    if (want === this.list) return;
    this._drop(); this._close(); this.cancelHold();
    this.list = want; this.ability = 0; this.element = n ? 1 : 0;
    this._say(n ? 'fire' : 'wind');
  }
  nextElement() { this.setElement(this.element ? 0 : 1); }
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
    if (this.active) { const A = this._aim(sim), id = this.list[this.ability].id; A.size = A.ok ? AIM_SIZE[id](A.dist) * (id === 'gust' || id === 'knife' ? 1 + (this.size - 1) * 0.6 : this.size) : 0; }
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
        } else {
          // the hand goes down on it and the circle grows; it is cast when the hand lifts (a tap: the smallest, at once)
          if (pressed) this._armed = ab.id;
          if (released && this._armed === ab.id && this._wait <= 0) {
            const k = this._wasTap ? 1 : this.size;
            if (this.ultReady) this._ultimate(sim, ab.id);
            else if (ab.id === 'gust') castGust(W, sim.bodyId, A.from, A.fwd, 1, k, true);   // (true: THE one ability that lays trees over, owner 2026-11-18)
            else if (ab.id === 'quicken') castZone(W, sim.bodyId, A.p, A.fwd, 'quicken', k);
            else if (ab.id === 'still') castZone(W, sim.bodyId, A.p, A.fwd, 'calm', k);
            else if (ab.id === 'whirl') castVortex(W, sim.bodyId, A.p, this.casts % 2 ? -1 : 1, k);
            else if (ab.id === 'knife') this._knife(sim, k);
            else if (ab.id === 'kindle') this._kindle(sim, k);
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
    if (f.kind === FUEL.none) this._say(FIRE_WHY[f.why] || 'nothing here will burn');
    else if (f.wet >= FIRE.wetStop * 0.8) this._say('too damp to catch');
    else if (!(f.fuel > 0.25)) this._say('too little here to carry it');
    return f;
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
    else if (e.code === 'KeyG') powers.nextElement();       // (G: the element in the hand, wind or fire)
    else if (/^Digit[1-9]$/.test(e.code)) powers.pick(+e.code.slice(5) - 1);
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
