// Save and load. Pure (no three, no DOM): storage is passed in, and every touch of it is inside
// try/catch, so a full, blocked or missing localStorage can never break the game.
//
// What is kept: where the explorer and the ship are (only ever written while on foot or
// landed, so a save is always a safe place to stand), the clock and each body's spin, the
// chosen target, and the sketchbook (bodies and biomes visited). Worlds are not saved: they
// are the same on every visit by construction.
import { BODIES } from '../data/bodies.js';
import { S } from './state.js';
import { bodyFrame } from './frames.js';
import { createExplorerState, EXPLORER } from '../player/explorer.js';
import { createFootCamera, createShipCamera } from '../player/camera.js';
import { createShipState } from '../ship/flight.js';
import { norm, len, tangent, qNorm, qRotate, V } from './vec.js';

export const SAVE_KEY = 'painted-cosmos.save';
export const SAVE_VERSION = 1;

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const vec = (v) => !!v && num(v.x) && num(v.y) && num(v.z);
const quat = (q) => vec(q) && num(q.w);

// A snapshot of the simulation, or null when this is not a moment that can be saved.
export function snapshot(sim) {
  const st = sim.sm.state;
  if (st !== S.ON_FOOT && st !== S.LANDED) return null;
  if (sim.shFrame.kind !== 'body' || !sim.shFrame.rotating) return null;
  const r3 = (v) => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) });
  return {
    version: SAVE_VERSION,
    t: +sim.t.toFixed(2),
    spinPhase: { ...sim.eph.spinPhase },
    orbitShift: { ...(sim.eph.orbitShift || {}) },
    state: st,
    bodyId: sim.bodyId,
    explorer: { p: r3(sim.ex.p), fwd: r3(sim.ex.fwd), fuel: +sim.ex.fuel.toFixed(3) },
    view: { fwd: r3(sim.footCam.viewFwd), pitch: +sim.footCam.pitch.toFixed(3), boom: sim.footCam.boom, firstPerson: !!sim.footCam.firstPerson },
    ship: { bodyId: sim.shFrame.id, p: r3(sim.sh.p), q: qOf(sim.sh.float ? sim.sh.float.q0 : sim.sh.q) },     // (afloat: its still attitude, not this moment's pitch)
    target: sim.target, targetLocked: !!sim.targetLocked,
    visited: Object.fromEntries(Object.entries(sim.visited).map(([k, v]) => [k, Object.keys(v.biomes)])),
    vistas: Object.fromEntries(Object.entries(sim.vistas || {}).map(([k, v]) => [k, Object.keys(v)])),
  };
}

// Is this object a save we can trust? Returns a reason string when it is not, else null.
export function validate(d) {
  if (!d || typeof d !== 'object') return 'not an object';
  if (d.version !== SAVE_VERSION) return 'version ' + d.version;
  if (!num(d.t) || d.t < 0) return 'time';
  if (d.state !== S.ON_FOOT && d.state !== S.LANDED) return 'state';
  if (!BODIES[d.bodyId]) return 'body';
  if (!d.ship || !BODIES[d.ship.bodyId] || !vec(d.ship.p) || !quat(d.ship.q)) return 'ship';
  if (!d.explorer || !vec(d.explorer.p) || !vec(d.explorer.fwd)) return 'explorer';
  for (const [id, body] of [[d.bodyId, d.explorer.p], [d.ship.bodyId, d.ship.p]]) {
    const r = len(body), R = BODIES[id].radius;
    if (!(r > R * 0.8 && r < R * 1.5)) return 'position off the body';
  }
  if (d.state === S.LANDED && d.ship.bodyId !== d.bodyId) return 'landed elsewhere';
  return null;
}

// Put a validated save into the simulation. `sample(bodyId)` is the sim's sampler factory; the
// explorer and the ship are set back on the ground as it is NOW (so a changed terrain function
// cannot leave anyone buried or floating).
const qOf = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });

export function restore(sim, d) {
  const why = validate(d);
  if (why) return false;
  sim.t = d.t;
  for (const id of Object.keys(d.spinPhase || {})) if (BODIES[id] && num(d.spinPhase[id])) sim.eph.spinPhase[id] = d.spinPhase[id];
  for (const id of Object.keys(d.orbitShift || {})) if (BODIES[id] && num(d.orbitShift[id])) sim.eph.orbitShift[id] = d.orbitShift[id];
  const onGround = (bodyId, p) => {
    const dir = norm(p);
    const s = sim.sampler(bodyId)(dir);
    const floor = Math.max(s.radius, s.liquidRadius || 0);
    return { dir, radius: s.radius, floor };
  };
  // Ship first (the explorer may be inside it).
  const sg = onGround(d.ship.bodyId, d.ship.p);
  const q = qNorm(d.ship.q);
  sim.sh = createShipState({ x: sg.dir.x * sg.floor, y: sg.dir.y * sg.floor, z: sg.dir.z * sg.floor }, q);
  sim.sh.restQ = q;
  sim.sh.onLiquid = sg.floor > sg.radius;          // a ship saved afloat floats again (Sim.stepAfloat)
  sim.shFrame = bodyFrame(d.ship.bodyId, true);
  sim.shipCam = createShipCamera();
  sim.bodyId = d.bodyId;
  const eg = onGround(d.bodyId, d.explorer.p);
  // In liquid deeper than the swimming depth the explorer floats, feet that far under the
  // surface: a game saved while swimming comes back swimming, not standing on the bed.
  const deep = eg.floor - eg.radius > EXPLORER.swimDepth;
  const rFeet = deep ? eg.floor - EXPLORER.swimDepth : eg.radius;
  const feet = { x: eg.dir.x * rFeet, y: eg.dir.y * rFeet, z: eg.dir.z * rFeet };
  sim.ex = createExplorerState(feet, tangent(d.explorer.fwd, eg.dir, qRotate(q, V(0, 0, -1))));
  if (deep) { sim.ex.grounded = false; sim.ex.swimming = true; }
  if (num(d.explorer.fuel)) sim.ex.fuel = Math.min(1, Math.max(0, d.explorer.fuel));
  const view = d.view || {};
  sim.footCam = createFootCamera(vec(view.fwd) ? view.fwd : sim.ex.fwd, eg.dir);
  if (num(view.pitch)) sim.footCam.pitch = Math.max(-1.1, Math.min(1.2, view.pitch));
  if (num(view.boom)) sim.footCam.boom = Math.max(2.2, Math.min(14, view.boom));
  sim.footCam.firstPerson = !!view.firstPerson;
  sim.target = d.target && BODIES[d.target] ? d.target : null;
  sim.targetLocked = !!sim.target && !!d.targetLocked;
  sim.visited = {};
  for (const [id, list] of Object.entries(d.visited || {})) {
    if (!BODIES[id] || !Array.isArray(list)) continue;
    sim.visited[id] = { biomes: Object.fromEntries(list.filter((b) => typeof b === 'string').map((b) => [b, true])) };
  }
  sim.vistas = {};
  for (const [id, list] of Object.entries(d.vistas || {})) {
    if (!BODIES[id] || !Array.isArray(list)) continue;
    sim.vistas[id] = Object.fromEntries(list.filter((b) => typeof b === 'string').map((b) => [b, true]));
  }
  sim.transition = null;
  sim.pulse = null;
  sim.sm.force(d.state);
  return true;
}

// ---- storage (all of it guarded) ---------------------------------------------------------------
export function writeSave(storage, data, key = SAVE_KEY) {
  if (!data) return false;
  try { storage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
}

export function readSave(storage, key = SAVE_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return validate(d) ? null : d;
  } catch { return null; }
}

export function clearSave(storage, key = SAVE_KEY) {
  try { storage.removeItem(key); return true; } catch { return false; }
}

// Decides when to write: on landing and stepping out, and every `every` seconds on foot.
export class AutoSave {
  constructor(storage, every = 20) {
    this.storage = storage; this.every = every; this.last = -1e9; this.lastState = null; this.writes = 0; this.ok = true;
  }
  update(sim) {
    const st = sim.sm.state;
    const changed = st !== this.lastState;
    this.lastState = st;
    if (st !== S.ON_FOOT && st !== S.LANDED) return false;
    // Something for the sketchbook (a view found, a new landscape) is written down at once.
    let pages = 0;
    for (const k in sim.vistas) pages += Object.keys(sim.vistas[k]).length;
    for (const k in sim.visited) pages += Object.keys(sim.visited[k].biomes).length;
    const news = pages !== this.pages;
    if (!changed && !news && sim.t - this.last < this.every) return false;
    if (st === S.ON_FOOT && !sim.ex.grounded && !sim.ex.swimming) return false;      // not in mid-air
    this.last = sim.t;
    this.pages = pages;
    this.ok = writeSave(this.storage, snapshot(sim));
    if (this.ok) this.writes++;
    return this.ok;
  }
}
