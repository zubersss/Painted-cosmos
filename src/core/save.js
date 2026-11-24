// Save and load. Pure (no three, no DOM): storage is passed in, and every touch of it is inside
// try/catch, so a full, blocked or missing localStorage can never break the game.
//
// What is kept: where the explorer and the ship are (only ever written while on foot or
// landed, so a save is always a safe place to stand), the clock and each body's spin, the
// chosen target, and the sketchbook (bodies and biomes visited). Worlds are not saved: they
// are the same on every visit by construction. (One thing of a world is kept: the trees the explorer's
// wind has felled, data/felled.js; the field is written only when there are any.)
import { BODIES } from '../data/bodies.js';
import { S } from './state.js';
import { bodyFrame } from './frames.js';
import { createExplorerState, EXPLORER } from '../player/explorer.js';
import { createFootCamera, createShipCamera, VIEW_PITCH } from '../player/camera.js';
import { createShipState } from '../ship/flight.js';
import { norm, len, tangent, qNorm, qRotate, V } from './vec.js';
import { FELLED, felledRows, felledLoad } from '../data/felled.js';
// (2026-11-18, found by an independent reader who burned a wood and reloaded: the fire's lasting record was written
//  by the game and SAVED BY NOTHING, so a burnt wood came back green while a tree the wind knife felled in the same
//  minute was still lying where it fell. The owner asked for exactly this to last. It is kept the way felled is.)
import { BURNT, burntRows, burntLoad } from '../data/burnt.js';

export const SAVE_KEY = 'painted-cosmos.save';
export const SAVE_VERSION = 1;

// (2026-11-18, found by an independent reader) A BODY ID IS A KEY OF BODIES, NOT ANYTHING ITS PROTOTYPE ANSWERS TO.
// BODIES is a plain object, so BODIES['__proto__'] is Object.prototype and reads as true. A save holding
// "visited": {"__proto__": [...]} passed every check, and restoring it REPLACED the prototype of sim.visited; the
// first autosave after that threw, every frame, above everything that lifts the loading sheet -- so the game sat
// loading for ever and the only way out, ?fresh=1, destroys the save. (Measured on a hand-made save. 17,194
// truncated and digit-corrupted saves found no other way in, so only a hand-edited file gets here -- but it is one
// line to close and the failure is as bad as failures get.)
const known = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(BODIES, id);

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
    view: { fwd: r3(sim.footCam.viewFwd), pitch: +Math.max(VIEW_PITCH[0], Math.min(VIEW_PITCH[1], sim.footCam.pitch)).toFixed(3), boom: sim.footCam.boom, firstPerson: !!sim.footCam.firstPerson },
    ship: { bodyId: sim.shFrame.id, p: r3(sim.sh.p), q: qOf(sim.sh.float ? sim.sh.float.q0 : sim.sh.q) },     // (afloat: its still attitude, not this moment's pitch)
    target: sim.target, targetLocked: sim.targetLocked === true,
    visited: Object.fromEntries(Object.entries(sim.visited).map(([k, v]) => [k, Object.keys(v.biomes)])),
    vistas: Object.fromEntries(Object.entries(sim.vistas || {}).map(([k, v]) => [k, Object.keys(v)])),
    ...(FELLED.size ? { felled: felledRows() } : null),
    ...(BURNT.size ? { burnt: burntRows() } : null),      // (the scorched ground, the burnt crowns and the melted ice)
  };
}

// Is this object a save we can trust? Returns a reason string when it is not, else null.
export function validate(d) {
  if (!d || typeof d !== 'object') return 'not an object';
  if (d.version !== SAVE_VERSION) return 'version ' + d.version;
  if (!num(d.t) || d.t < 0) return 'time';
  if (d.state !== S.ON_FOOT && d.state !== S.LANDED) return 'state';
  if (!known(d.bodyId)) return 'body';
  if (!d.ship || !known(d.ship.bodyId) || !vec(d.ship.p) || !quat(d.ship.q)) return 'ship';
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
  for (const id of Object.keys(d.spinPhase || {})) if (known(id) && num(d.spinPhase[id])) sim.eph.spinPhase[id] = d.spinPhase[id];
  for (const id of Object.keys(d.orbitShift || {})) if (known(id) && num(d.orbitShift[id])) sim.eph.orbitShift[id] = d.orbitShift[id];
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
  let eg = onGround(d.bodyId, d.explorer.p);
  // (A place saved on dry ground may be under shallow water NOW: the water's parts moved the oil look's rivers, 24 Nov --
  //  11 of 800 places along the landing's old brook stand in water up to 0.56 m deep. Such a place comes back on the nearest
  //  dry ground within 12 m, so a loaded game does not open with the explorer standing in a stream; one saved swimming, in
  //  water deeper than the swimming depth, still comes back swimming.)
  const wet0 = eg.floor - eg.radius;
  if (wet0 > 0.05 && wet0 <= EXPLORER.swimDepth) {
    const u = eg.dir, a = Math.abs(u.y) < 0.9 ? V(-u.z, 0, u.x) : V(0, u.z, -u.y), al = len(a) || 1;
    const t1 = V(a.x / al, a.y / al, a.z / al), t2 = V(u.y * t1.z - u.z * t1.y, u.z * t1.x - u.x * t1.z, u.x * t1.y - u.y * t1.x);
    const Rb = BODIES[d.bodyId].radius;
    search: for (let r = 1.5; r <= 12; r += 1.5) {
      for (let k = 0; k < 16; k++) {
        const th = k * Math.PI / 8, c = Math.cos(th) * r / Rb, sn = Math.sin(th) * r / Rb;
        const g = onGround(d.bodyId, V(u.x + t1.x * c + t2.x * sn, u.y + t1.y * c + t2.y * sn, u.z + t1.z * c + t2.z * sn));
        if (g.floor - g.radius <= 0.01) { eg = g; break search; }
      }
    }
  }
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
  // The first view of a new session looks out over the land: a view saved looking near straight
  // up or down (M4's blind play-test: a pointer lock gone wrong had thrown it straight up, and
  // after a reload first person showed only sky) comes back eased into VIEW_PITCH.
  if (num(view.pitch)) sim.footCam.pitch = Math.max(VIEW_PITCH[0], Math.min(VIEW_PITCH[1], view.pitch));
  if (num(view.boom)) sim.footCam.boom = Math.max(2.2, Math.min(14, view.boom));
  sim.footCam.firstPerson = !!view.firstPerson;
  sim.target = known(d.target) ? d.target : null;
  sim.targetLocked = !!sim.target && !!d.targetLocked;
  sim.visited = {};
  for (const [id, list] of Object.entries(d.visited || {})) {
    if (!known(id) || !Array.isArray(list)) continue;
    sim.visited[id] = { biomes: Object.fromEntries(list.filter((b) => typeof b === 'string').map((b) => [b, true])) };
  }
  sim.vistas = {};
  for (const [id, list] of Object.entries(d.vistas || {})) {
    if (!known(id) || !Array.isArray(list)) continue;
    sim.vistas[id] = Object.fromEntries(list.filter((b) => typeof b === 'string').map((b) => [b, true]));
  }
  felledLoad(d.felled);               // (the trees felled by the explorer's wind: none in a save without the field)
  burntLoad(d.burnt);                 // (and what the fire left: unconditional, so a save with no field clears it)
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
