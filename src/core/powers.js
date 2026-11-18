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
import { fellTree } from '../data/felled.js';

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
});

const add = (a, b, k) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
// How wide what an ability does is at the aim (m, its radius on the ground `dist` metres out): the ring of the aim mark.
const AIM_SIZE = {
  gust: (d) => WINDPOWER.gustRadius + WINDPOWER.gustSpread * d, gather: () => WINDPOWER.orbCore * 1.4, quicken: () => WINDPOWER.zoneRadius,
  still: () => WINDPOWER.zoneRadius, whirl: () => WINDPOWER.vortexRadius, part: () => WINDPOWER.partHalf, knife: () => 0.7,
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
    this._armed = null;         // the ability the hand went down on (it is cast when the hand lifts)
    this._wasTap = false;       // the press came from the touch button's tap: the smallest cast, whatever the frame
    this.note = '';             // one word for the HUD when something cannot be done here
    this._noteT = 0;
    this.active = false;        // the powers can be used now (on foot, on a world)
    this.keys = { cast: false, pad: false, mouse: false, touch: false };
    this.onCast = null;         // called with the ability's id when one is cast (the sound)
    this.tapOnce = false;       // set by the touch button: one press, seen by the next frame however long that frame is
    this.fells = 0;             // trees felled so far by the wind knife (for tests and the read-out)
  }

  pick(i) { if (i >= 0 && i < ABILITIES.length && i !== this.ability) { this._drop(); this._close(); this.ability = i; } }
  next() { this.pick((this.ability + 1) % ABILITIES.length); }

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
    if (down && !this._wasTap) this.charge = Math.min(1, this.charge + dt / WINDPOWER.chargeTime);
    this.size = 1 + this.charge * (WINDPOWER.sizeMax - 1);
    if (this.active) { const A = this._aim(sim), id = ABILITIES[this.ability].id; A.size = A.ok ? AIM_SIZE[id](A.dist) * (id === 'gust' || id === 'knife' ? 1 + (this.size - 1) * 0.6 : this.size) : 0; }
    else this.aim.ok = false;
    if (this.active && (down || released || this.orb || this.part)) {
      const A = this.aim, ab = ABILITIES[this.ability];
      if (A.ok) {
        if (ab.id === 'gather') {
          if (pressed && !this.orb) { this.orb = castOrb(W, sim.bodyId, this._orbAt(sim, POWERS.orbAhead), this.size); this._cast(sim); }
          if (this.orb && down) {
            // the ball follows the aim, no faster than a hand could carry it
            const to = this._orbAt(sim, Math.min(A.dist, POWERS.orbReach)), o = this.orb;
            const dx = to.x - o.px, dy = to.y - o.py, dz = to.z - o.pz, l = Math.hypot(dx, dy, dz), m = Math.min(1, POWERS.orbSpeed * dt / (l || 1));
            moveWind(o, { x: o.px + dx * m, y: o.py + dy * m, z: o.pz + dz * m });
            growWind(o, this.size);                // (held: the ball grows in the hand)
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
          if (this.part && down) { moveWind(this.part, this._orbAt(sim, -WINDPOWER.partBack)); turnWind(this.part, A.fwd); growWind(this.part, this.size); }
        } else {
          // the hand goes down on it and the circle grows; it is cast when the hand lifts (a tap: the smallest, at once)
          if (pressed) this._armed = ab.id;
          if (released && this._armed === ab.id && this._wait <= 0) {
            const k = this._wasTap ? 1 : this.size;
            if (ab.id === 'gust') castGust(W, sim.bodyId, A.from, A.fwd, 1, k, true);   // (true: THE one ability that lays trees over, owner 2026-11-18)
            else if (ab.id === 'quicken') castZone(W, sim.bodyId, A.p, A.fwd, 'quicken', k);
            else if (ab.id === 'still') castZone(W, sim.bodyId, A.p, A.fwd, 'calm', k);
            else if (ab.id === 'whirl') castVortex(W, sim.bodyId, A.p, this.casts % 2 ? -1 : 1, k);
            else if (ab.id === 'knife') this._knife(sim, k);
            this._wait = POWERS.gustEvery;
            this._cast(sim);
          }
          if (released) this._armed = null;
        }
      }
    }
    if (this.orb && (released || !this.active)) this._drop(this.active ? sim : null);
    if (this.part && (released || !this.active)) this._close();
    if (!down) { this.charge = 0; this._armed = null; this._wasTap = false; }
    if (W.count > 0) stepWinds(W, dt);
    if (this.onFrame) this.onFrame(this);          // (the touch button and the word on the screen: ui/powers.js)
  }

  _orbAt(sim, ahead) {
    const A = this.aim, p = sim.ex.p, up = unit(p), q = add(p, A.fwd, ahead), d = unit(q);
    let r = Math.hypot(p.x, p.y, p.z);
    try { const s = sim.sampleSurface(sim.bodyId, d); if (s) r = Math.max(s.radius || 0, s.liquidRadius || 0) || r; } catch { /* level with the explorer */ }
    return { x: d.x * r, y: d.y * r, z: d.z * r };
  }
  _cast(sim) { this.casts++; if (sim.ex) sim.ex.casting = 1; if (this.onCast) this.onCast(ABILITIES[this.ability].id); }   // (onCast: the sound, main.js)
}

// The hands: a key, the right mouse button, a gamepad's bumpers. (The touch button is ui/powers.js, which sets
// powers.keys.touch and calls pick().) Returns a function that takes the listeners away again.
export function attachPowerInputs(powers, target = window) {
  const kd = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyQ') powers.keys.cast = true;
    else if (/^Digit[1-9]$/.test(e.code)) powers.pick(+e.code.slice(5) - 1);
  };
  const ku = (e) => { if (e.code === 'KeyQ') powers.keys.cast = false; };
  const md = (e) => { if (e.button === 2) powers.keys.mouse = true; };
  const mu = (e) => { if (e.button === 2) powers.keys.mouse = false; };
  const cm = (e) => { e.preventDefault(); };
  const blur = () => { powers.keys.cast = powers.keys.mouse = powers.keys.pad = false; };
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
