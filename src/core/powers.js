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
import { makeWinds, castGust, castZone, castOrb, castVortex, castPart, moveWind, turnWind, releaseWind, stepWinds, partedAt, WINDPOWER } from '../physics/powers.js';
import { S } from './state.js';

// The abilities of wind, in the order of the keys 1 .. 6 and of the touch fan. hold: it lasts while the hand is down.
export const ABILITIES = Object.freeze([
  { id: 'gust', word: 'gust', hold: false },
  { id: 'gather', word: 'gather', hold: true },
  { id: 'quicken', word: 'quicken', hold: false },
  { id: 'still', word: 'still', hold: false },
  { id: 'whirl', word: 'whirl', hold: false },
  { id: 'part', word: 'part', hold: true },
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
});

const add = (a, b, k) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
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
    this.aim = { ok: false, p: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 1 }, dist: 0, from: { x: 0, y: 0, z: 0 } };
    this.casts = 0;             // how many casts so far (for tests and the read-out)
    this.note = '';             // one word for the HUD when something cannot be done here
    this.active = false;        // the powers can be used now (on foot, on a world)
    this.keys = { cast: false, pad: false, mouse: false, touch: false };
    this.onCast = null;         // called with the ability's id when one is cast (the sound)
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

  // the parted channel is let go: it closes from its far end inward (physics/powers.js stepWinds)
  _close() { if (this.part) { releaseWind(this.part); this.part = null; } }
  // Is the water parted at the place d (a unit vector from the body's centre) where its face is at radius r?
  // (sim.js asks, for the explorer's ground: on the channel's floor there is no water to wade or swim in)
  dry(bodyId, d, r) { return this.winds.count > 0 && partedAt(this.winds, bodyId, d.x * r, d.y * r, d.z * r) > 0.5; }

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
    const down = this.active && (this.down || this.keys.cast || this.keys.pad || this.keys.mouse || this.keys.touch);
    const pressed = down && !this._was, released = !down && this._was;
    this._was = down;
    if (this._wait > 0) this._wait -= dt;
    if (sim.ex && sim.ex.casting > 0) sim.ex.casting = Math.max(0, sim.ex.casting - dt / POWERS.castPose);
    if (this.active && (down || this.orb || this.part)) {
      const A = this._aim(sim), ab = ABILITIES[this.ability];
      if (A.ok) {
        if (ab.id === 'gather') {
          if (pressed && !this.orb) { this.orb = castOrb(W, sim.bodyId, this._orbAt(sim, POWERS.orbAhead)); this._cast(sim); }
          if (this.orb && down) {
            // the ball follows the aim, no faster than a hand could carry it
            const to = this._orbAt(sim, Math.min(A.dist, POWERS.orbReach)), o = this.orb;
            const dx = to.x - o.px, dy = to.y - o.py, dz = to.z - o.pz, l = Math.hypot(dx, dy, dz), m = Math.min(1, POWERS.orbSpeed * dt / (l || 1));
            moveWind(o, { x: o.px + dx * m, y: o.py + dy * m, z: o.pz + dz * m });
          }
        } else if (ab.id === 'part') {
          // the channel begins just behind the explorer and lies along the aim: it goes where they go and look
          if (pressed && !this.part) { this.part = castPart(W, sim.bodyId, this._orbAt(sim, -WINDPOWER.partBack), A.fwd); this._cast(sim); }
          if (this.part && down) { moveWind(this.part, this._orbAt(sim, -WINDPOWER.partBack)); turnWind(this.part, A.fwd); }
        } else if (pressed && this._wait <= 0) {
          if (ab.id === 'gust') castGust(W, sim.bodyId, A.from, A.fwd);
          else if (ab.id === 'quicken') castZone(W, sim.bodyId, A.p, A.fwd, 'quicken');
          else if (ab.id === 'still') castZone(W, sim.bodyId, A.p, A.fwd, 'calm');
          else if (ab.id === 'whirl') castVortex(W, sim.bodyId, A.p, this.casts % 2 ? -1 : 1);
          this._wait = POWERS.gustEvery;
          this._cast(sim);
        }
      }
    }
    if (this.orb && (released || !this.active)) this._drop(this.active ? sim : null);
    if (this.part && (released || !this.active)) this._close();
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
