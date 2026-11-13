// The simulation: the state machine, the explorer, the ship, the cameras and the solar system,
// with no three and no DOM. src/core/game.js presents it; tests/loop.test.mjs plays the whole
// loop through it in Node.
import { BODIES, SUN } from '../data/bodies.js';
import { LOOKS } from '../data/looks.js';
import { Ephemeris, spaceAltitude } from './orbits.js';
import {
  HELIO, bodyFrame, sameFrame, frameState, posToUniverse, quatToUniverse, quatFromUniverse,
  convertState, chooseFrame, FloatingOrigin, posFromUniverse,
} from './frames.js';
import { StateMachine, S, EV, canBoard, canBeginLanding, promptFor, isInShip, LAND_PROMPT_ALTITUDE, LAND_BEGIN_SPEED } from './state.js';
import {
  V, add, sub, scale, addScaled, dot, len, norm, cross, tangent, lerp, clamp, clamp01, mix, smoothstep,
  qLook, qRotate, qConj, qMul, qFromAxisAngle, qSlerp, qNorm, rotateAround,
} from './vec.js';
import { EXPLORER, createExplorerState, stepExplorer, collideObstacles, scrambleSample } from '../player/explorer.js';
import {
  CAMERA, VIEW_PITCH, createFootCamera, lookFootCamera, updateFootCamera, createShipCamera, updateShipCamera, blendPose, boomRoom, crownDistance, crownShape,
} from '../player/camera.js';
import {
  SHIP, stepFlight, beginLiftoff, beginLanding, stepLanding, stepLanded, restOnSurface, floorAt,
} from '../ship/flight.js';
import { PULSE, arrivalRadius, createPulse, pulseAdvice, stepPulseSpeed, pulseEta, courseDir } from '../ship/pulse.js';

export const FEEL = Object.freeze({
  mouseFoot: 0.0023,         // rad per pixel on foot
  mouseShip: 0.0017,         // rad per pixel in the ship (the nose follows with a little weight)
  boardSeconds: 1.5,         // walking up to the hatch and sitting down, at the least (from right beside it)...
  boardPace: 3.6,            // ...and from further off as long as the walk takes at this pace (m/s), to...
  boardSecondsMax: 3,        // ...this at most (it was 1.25 s from anywhere: 8.5 m at a sprint, the explorer out of the frame in 0.2 s)
  exitSeconds: 1.6,          // down the ladder and three steps clear of the wing (it was 0.95: a cut)
  simStep: 1 / 60,           // fixed physics step (the feel is identical at any frame rate)
  maxFrame: 0.25,            // seconds of real time simulated per frame at most
  startHour: 8,              // the world's hour at the first spawn: a clear morning, a long day ahead (it was 9.5: night fell ten minutes in)
});

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const Y = V(0, 1, 0);
// The ship's berth at an arrival (Sim.spawnOn, surfAt): dry by this much over a liquid's still level
// under all of its hull, or it counts as in the surf.
const BERTH = Object.freeze({ dry: 1.2, reach: 4.5, points: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] });

// Which plant a tall obstacle is (its kit: 'broadleaf', 'kelp', ...), for the crown the cameras keep
// out of (camera.js crownShape). The world's obstacles do not name their plant; they are the look's
// `obs: [footprint, height]` of the plant scaled as one, so the footprint over the height names it
// on its world. (An obstacle that carries `kit` itself is taken at its word: docs/notes/pilot.md
// asks PAINTER for that line.) undefined when it cannot be told: the camera then goes by the footprint.
const KITS = new Map();
function kitsOf(bodyId) {
  let tab = KITS.get(bodyId);
  if (!tab) {
    tab = [];
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 6) return;
      if (typeof o.kit === 'string' && Array.isArray(o.obs) && o.obs[1] > 0) tab.push([o.obs[0] / o.obs[1], o.kit]);
      for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], depth + 1);
    };
    walk(LOOKS[bodyId], 0);
    KITS.set(bodyId, tab);
  }
  return tab;
}
export function plantKit(bodyId, o) {
  if (o.kit) return o.kit;
  if (o.kind && o.kind !== 'tree') return 'stone';
  const q = o.radius / o.height;
  let kit;
  for (const [ratio, k] of kitsOf(bodyId)) if (Math.abs(q - ratio) <= 1e-6 * ratio) { if (kit && kit !== k) return undefined; kit = k; }
  return kit;
}
// The tall things of `list` (the world's obstacles) as the cameras' trees: [{ base, u, h, r, c }].
function crownList(bodyId, list, sample) {
  const out = [];
  for (const o of list) {
    if (o.height < 4) continue;                       // boulders, shrubs, reeds: under the cameras
    out.push({ base: scale(o.unitDir, sample(o.unitDir).radius), u: o.unitDir, h: o.height, r: o.radius, c: crownShape(plantKit(bodyId, o), o.radius) });
  }
  return out;
}
// A ship at rest on water (Sim.stepAfloat): the hull that averages the sea, and how fast it follows.
const FLOAT_ALONG = [-0.5, -0.25, 0, 0.25, 0.5], FLOAT_ACROSS = [-0.5, 0, 0.5];      // the grid, in hull lengths and beams
const FLOAT = Object.freeze({
  length: 8,                 // m, nose to tail (PHYSICS' legs span 5 m of it: ship.js TUNING.legs)
  beam: 4.4,                 // m, across the hull at the legs
  follow: 2.5,               // 1/s: the hull's inertia (a wave of 5 s is taken up almost whole, a slap of a fraction of a second is not)
  tilt: 0.35,                // rad: the most it pitches or rolls
  along: FLOAT_ALONG, across: FLOAT_ACROSS,
  sa2: FLOAT_ALONG.reduce((s, a) => s + a * a, 0) * FLOAT_ACROSS.length,       // sum of a^2 over the grid
  sb2: FLOAT_ACROSS.reduce((s, b) => s + b * b, 0) * FLOAT_ALONG.length,
});
// The world's own arrival (spawnOn with no place asked for): room round the feet and the lens.
const ARRIVAL = Object.freeze({
  clear: 2.5,                // metres from the feet to the nearest boulder's or trunk's edge
  reach: 12,                 // how far from the world's spawn the explorer may be stepped
  slope: 0.3,                // rad: gentle ground only
  lens: 0.6,                 // metres the boom keeps from a boulder or trunk
  turns: [0.45, 0.25, 0.65, 0.05],   // rad from the ship: each keeps it in frame
});
// Touchdown on the legs: where the assist hands the hull to the landing gear (m over the
// ground) and how fast the gear lets it down (m/s; PHYSICS' recipe).
export const LEGS = Object.freeze({ gearAt: 1.0, sink: 0.6 });
export const VISTA_RANGE = 14;      // metres: this close to a vista's spot, on foot, and it is yours
export const VISTA_MARK = 150;      // metres: this near a view not yet drawn, one quiet mark shows where it is
export const SHIP_MARK = 40;        // metres: farther from the ship than this on foot (or with it out of the picture), a mark shows the way back
// A view is a picture, not a spot (PAINTER's critique, M4 item 4): found, it is offered ("E:
// stand at the easel"); the explorer walks to the easel's place and the view comes round to the
// heading and pitch the picture was painted with, is held while the page is drawn, and the
// controls are the player's again.
export const EASEL = Object.freeze({
  pace: 3.4,                 // m/s: the walk to the easel...
  minSeconds: 2,             // ...never quicker than this (the view's turn is eased over it),
  maxSeconds: 4.2,           // nor longer
  hold: 1.8,                 // s the picture is held while the page is drawn
  reach: 3,                  // m beyond VISTA_RANGE the offer stays up once made
  // The walk goes no further than ground fit to walk (Sim.easelWay): it stops a metre short of
  // dry ground steeper than `steep` (rad) or a rise or drop of more than `step` m in `look` m (a
  // cliff, a bank, a ledge), and the picture is composed from there. (The re-fix pass, M4: the
  // walk was laid on the ground point by point and went straight over cliffs: Neptune's
  // 'Ultramarine Storm Seas II', 29.6 m down a 78 degree face in 6 s.)
  steep: 0.7,
  step: 0.25,
  look: 0.25,
});
// The clock of the world the player is on (PAINTER's critique, M4 item 5: of Earth's 25 minutes
// eleven were night, one dark blue, and the gold and the rose went by in half a minute each).
// While the sun is well up the world turns as it does. Within `slowFrom` degrees of the horizon
// it turns at `slow` of that: the hours a painting changes in are the long ones. Under
// `nightBelow` it turns `fast` times as quickly. Measured at Earth's spawn (in its winter, the sun
// 39 degrees up at noon): the sun over 12 degrees for 9.5 minutes as before; from there to the
// horizon 3.8 minutes (it was 1.4), on to 8 degrees under it 2.7 (0.9), the night below that 5.6
// (14.8), the dawn 5.6; a first sitting from 8 h has its sunset 11.2 minutes in and its sunrise at 21.9.
export const CLOCK = Object.freeze({
  easeFrom: 12,              // degrees of the sun over the horizon: from here the turning eases down...
  slowFrom: 8,               // ...to `slow` here...
  slowTo: -8,                // ...and stays so down to here;
  nightBelow: -16,           // under this it is `fast`
  slow: 0.4,
  fast: 3,
  top: 0.6,                  // of the way up to space: from `low` of it on up the clock eases back to the body's own, so
  low: 0.2,                  // that a ship leaving the ground frame leaves a world that turns as the ephemeris says
});
export function clockRate(elevDeg, C = CLOCK) {
  if (elevDeg >= C.easeFrom) return 1;
  if (elevDeg >= C.slowFrom) return mix(C.slow, 1, smoothstep(C.slowFrom, C.easeFrom, elevDeg));
  if (elevDeg >= C.slowTo) return C.slow;
  if (elevDeg >= C.nightBelow) return mix(C.fast, C.slow, smoothstep(C.nightBelow, C.slowTo, elevDeg));
  return C.fast;
}
// Stepping out of the ship (PAINTER's critique, item 1: "the first picture of every landing is
// your own wing"). The explorer walks a few steps clear of the hull while the view comes round, and
// the view is chosen for the picture: the hull never between the lens and the figure, never over
// more than a sixth of the frame, the boom free, open ground ahead, and as near to "straight away
// from the ship" as that allows.
const EXIT = Object.freeze({
  walk: [3.4, 2.6, 1.8, 1.0, 0],       // metres out from the ladder, the first that is fit to stand on
  turns: [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1, 2.5, -2.5],   // rad from straight away
  cover: 1 / 6,                        // the most of the frame the hull may take
  aspect: 16 / 9,
  near: 40,                            // metres from the ship within which a sketch waits while the hull...
                                       // (14 let Venus' first landscape sketch keep the ship: M4's blind play-test)
  middle: 0.7,                         // ...lies in this share of the frame round its middle...
  inPicture: 0.02,                     // ...over more than this share of it
});
// The hull as a picture sees it: spheres [x, y, z, radius] in the ship's own axes (PAINTER's model:
// the body from the bow to the stern, the glass bubble, the fin, the cloth wings and their tips).
const HULL_SHAPE = [[0, 1.3, -3.3, 1.2], [0, 1.45, -1.3, 1.6], [0, 1.3, 1.0, 1.6], [0, 1.6, 3.2, 1.4], [0, 2.5, 4.0, 0.9],
  [-2.4, 1.5, 1.0, 1.0], [2.4, 1.5, 1.0, 1.0], [-3.3, 1.6, 1.25, 0.7], [3.3, 1.6, 1.25, 0.7]];
const VACUUM = { density: 0, wind: V(), speed: 0, gust01: 0, turbulence: 0, temperature: 3, pressure: 0, soundSpeed: 0, viscosity: 0 };
const VACUUM_AIR = (p, out) => (out ? Object.assign(out, VACUUM) : VACUUM);

export class Sim {
  // sampleSurface(bodyId, {x,y,z}) -> contract surface;  getSpawn(bodyId) -> {x,y,z} or null;
  // seat / hatch: ship-local points from the ship model (COORDINATOR.md C10).
  // sampleObstacles(bodyId, {x,y,z}, radius) -> [{ unitDir, radius, height }] (optional).
  // physics (optional): the object from createPhysics (src/physics). Without it the explorer
  // and the ship move by Pilot's own kinematic rules.
  // getVistas(bodyId) -> [{ id, name, unitDir }] (optional): the marked views to find on foot.
  constructor({ sampleSurface, getSpawn, sampleObstacles, getVistas, physics, seat, hatch, body, hour }) {
    this.getVistas = getVistas || null;
    this.vistas = {};              // bodyId -> { vistaId: true } found so far
    this.onVistaFound = null;      // (bodyId, vistaId) -> void, set by the presenter
    this.vistaDrawn = null;        // (bodyId, vistaId) -> bool: has its page a picture (set by the presenter)
    this.stood = {};               // bodyId -> { vistaId: true }: stood at its easel in this sitting
    this.easelOffer = null;        // the found view whose easel is within reach just now
    this.easel = null;             // { id, phase: 'go' | 'hold', t, ... } while the explorer is taken to an easel
    this.unevenClock = true;       // false: every world turns at its own even rate (instruments that hold an hour: ?clock=even)
    this._vistaList = {};
    this.sampleSurface = sampleSurface;
    this.sampleObstacles = sampleObstacles || null;
    this.physics = physics || null;
    this.useGear = !!(physics && physics.ship && physics.ship.gear);
    this.physicsMs = 0;
    this.physicsWorstMs = 0;
    this.nearObstacles = [];
    this.canopy = [];
    this.target = null;            // body id the pulse drive and the markers point at
    this.targetLocked = false;     // chosen on the map: aiming elsewhere does not change it
    this.aimed = null;
    this.pulse = null;
    this.turn = null;              // { dest, t, w }: F with the course off the nose turns the ship onto it first
    this.notice = null;            // { text, until } one line of feedback for the HUD
    this.stroll = false;           // C on foot: walk at a stroll (EXPLORER.strollSpeed) instead of the usual pace
    this.visited = {};             // bodyId -> { biomes: { id: true } }  (the sketchbook's data)
    this._envs = {};
    this._disturbers = [];
    this.getSpawn = getSpawn || (() => null);

    this.eph = new Ephemeris(BODIES);
    this.t = 0;
    this.timeScale = 1;
    this.sm = new StateMachine(S.ON_FOOT);
    this.origin = new FloatingOrigin();
    this.frameCount = 0;
    this.events = [];                       // recent feedback events (bounce, touchdown...) for audio later
    this.transition = null;
    this.camPose = null;
    this.camFrame = HELIO;
    this.viewKind = 'foot';
    this._samplers = {};
    this.mood = { bodyId: 'earth', biomeWeights: {}, timeOfDay: 12, altitude01: 0, inSpace01: 0, speed01: 0, pulse01: 0 };
    this.seat = seat ? V(seat.x, seat.y, seat.z) : V(0, 2.2, -1.2);
    this.hatch = hatch ? V(hatch.x, hatch.y, hatch.z) : V(-2.7, 0, -0.9);
    this.input = { down: () => false, axis: () => 0 };

    this.spawnOn(body && BODIES[body] ? body : 'earth', null, { hour: hour == null ? FEEL.startHour : hour });
  }

  // ---- world access ------------------------------------------------------------------------
  // sampleSurface for one body, as plain numbers (the result is copied at once, so the world
  // may reuse its own scratch objects).
  sampler(bodyId) {
    if (this._samplers[bodyId]) return this._samplers[bodyId];
    const raw = this.sampleSurface;
    const fn = (dir) => {
      const s = raw(bodyId, dir);
      const liquidRadius = s.liquidRadius || 0;
      return {
        radius: s.radius,
        normal: { x: s.normal.x, y: s.normal.y, z: s.normal.z },
        slope: s.slope || 0,
        liquidRadius,
        isLiquid: liquidRadius > s.radius,
        biomeId: s.biomeId,
        biomeWeights: s.biomeWeights,
        canopyHeight: s.canopyHeight || 0,          // additive (Painter): tree-top height above the ground here
      };
    };
    this._samplers[bodyId] = fn;
    return fn;
  }

  // Put the explorer on `bodyId` at `dir` (default: the world's spawn) with the ship beside.
  spawnOn(bodyId, dir, opts = {}) {
    const sample = this.sampler(bodyId);
    let d = dir;
    if (!d) d = this.getSpawn(bodyId) || V(0.3, 0.4, 0.86);
    const face = typeof d.yaw === 'number' ? { yaw: d.yaw, pitch: d.pitch } : null;      // the world's own view of this place
    d = norm(d);
    // The world's own arrival (no place asked for) is stepped off a boulder or trunk: Mercury's and
    // Pluto's first views stood the explorer on one. A place asked for (an easel, a teleport) is kept.
    if (!dir) d = this.clearArrival(bodyId, d);
    if (opts.hour != null) this.eph.setSunHour(bodyId, this.t, d, opts.hour);      // the world's hour: 6 sunrise, 12 the sun highest, 18 sunset, wherever one stands
    const s = sample(d);
    const feet = scale(d, Math.max(s.radius, 0) + (opts.altitude || 0));
    // The ship waits about 16 m away on the flattest dry ground nearby.
    const east = tangent(cross(Y, d), d, V(1, 0, 0));
    const north = cross(d, east);
    let best = null;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.6;
      const off = add(scale(east, Math.cos(a) * 16), scale(north, Math.sin(a) * 16));
      const cd = norm(addScaled(feet, off, 1));
      const g = floorAt(sample, scale(cd, len(feet)));
      const score = g.slope + (g.liquid ? 2 : 0) + Math.abs(g.floor - s.radius) * 0.03 + this.surfAt(sample, cd);
      if (!best || score < best.score) best = { score, dir: cd, off };
    }
    const toShip = tangent(best.off, d);
    this.bodyId = bodyId;
    this.ex = createExplorerState(feet, toShip);
    this.ex.grounded = !(opts.altitude > 0);
    this._swimR = null;
    // Look a little to the side of the ship so both it and the landscape are in frame; at the world's
    // own arrival, to whichever side keeps a boulder or trunk out from between the lens and the explorer.
    this.footCam = createFootCamera(rotateAround(toShip, d, dir ? 0.45 : this.clearView(bodyId, feet, toShip)), d);
    if (face) {
      // PAINTER's request: arrive facing the way the picture was painted (yaw from north toward east).
      const fwd = add(scale(north, Math.cos(face.yaw)), scale(east, Math.sin(face.yaw)));
      this.footCam = createFootCamera(fwd, d);
      if (face.pitch != null) this.footCam.pitch = clamp(face.pitch, CAMERA.pitchMin, CAMERA.pitchMax);
    }
    this.easel = null; this.easelOffer = null;
    this.sh = restOnSurface(sample, best.dir, rotateAround(toShip, d, -1.9));
    this.shFrame = bodyFrame(bodyId, true);
    this.shipCam = createShipCamera();
    this.transition = null;
    this.sm.force(S.ON_FOOT);
  }

  // How far into the surf a ship parked at `d` would stand (0 on dry ground well above the water):
  // PAINTER's sea and PHYSICS' run-up wash over a beach above the still level, so a berth whose hull
  // (the middle and four points BERTH.reach out) stands less than BERTH.dry over a liquid's still
  // level counts against it (PAINTER 12: at a beach 1 m from the water the ship stood in a foam ring).
  surfAt(sample, d) {
    let wet = 0;
    const e = tangent(cross(Y, d), d, V(1, 0, 0)), n = cross(d, e), k = BERTH.reach / Math.max(1, sample(d).radius);
    for (const [x, y] of BERTH.points) {
      const s = sample(norm(add(d, add(scale(e, x * k), scale(n, y * k)))));
      if (s.liquidRadius > 0) wet = Math.max(wet, clamp01((s.liquidRadius + BERTH.dry - s.radius) / BERTH.dry));
    }
    return wet * 2;
  }

  // Where the explorer arrives near the world's spawn `d`: the spawn itself unless a boulder or a
  // trunk stands within ARRIVAL.clear metres of the feet; then the nearest dry, gentle spot of the same
  // biome within ARRIVAL.reach metres that has nothing that close (else the one with the most room).
  clearArrival(bodyId, d) {
    const A = ARRIVAL, sample = this.sampler(bodyId), R = Math.max(1, sample(d).radius);
    // (small queries round each place: world.sampleObstacles misses things when asked for a wide disc)
    const room = (u) => {
      let m = Infinity;
      for (const o of this.obstaclesNear(bodyId, scale(u, R), A.clear + 1.5)) m = Math.min(m, len(sub(o.unitDir, u)) * R - o.radius);
      return m;
    };
    if (!this.sampleObstacles || room(d) >= A.clear) return d;
    const biome = sample(d).biomeId;
    const east = tangent(cross(Y, d), d, V(1, 0, 0)), north = cross(d, east);
    let best = d, bestRoom = room(d);
    for (let ring = 1; ring <= A.reach; ring += 1) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const u = norm(add(d, add(scale(east, (Math.cos(a) * ring) / R), scale(north, (Math.sin(a) * ring) / R))));
        const s = sample(u);
        if (s.isLiquid || s.slope > A.slope || s.biomeId !== biome) continue;
        const r = room(u);
        if (r >= A.clear) return u;
        if (r > bestRoom) { best = u; bestRoom = r; }
      }
    }
    return best;
  }

  // At the world's own arrival the view looks to the side of the ship (0.45 rad); the first of a few
  // turns that keeps the ship in frame and no boulder or trunk on the boom between the lens and the
  // explorer (a stone at the bottom of Mercury's first view hid the figure's feet).
  clearView(bodyId, feet, toShip) {
    const d = norm(feet), R = len(feet);
    if (!this.sampleObstacles) return 0.45;
    for (const turn of ARRIVAL.turns) {
      const back = scale(rotateAround(toShip, d, turn), -1);
      let clear = true;
      for (let k = 1; k <= 6 && clear; k++) {
        const p = norm(addScaled(feet, back, (k / 6) * (CAMERA.boom + 1)));
        for (const o of this.obstaclesNear(bodyId, scale(p, R), 2.5)) if (len(sub(o.unitDir, p)) * R < o.radius + ARRIVAL.lens) { clear = false; break; }
      }
      if (clear) return turn;
    }
    return 0.45;
  }

  // ---- one frame -----------------------------------------------------------------------------
  // input: { down(code), axis(negCode, posCode) };  inp: { edges:Set, dx, dy, wheel } since the
  // last frame. Returns the simulated time. Call view(dt) afterwards for the camera.
  frame(realDt, input, inp) {
    this.input = input;
    const simDt = Math.min(realDt, FEEL.maxFrame) * this.timeScale;
    const steps = Math.max(1, Math.ceil(simDt / FEEL.simStep - 1e-6));
    const h = simDt / steps;
    for (let i = 0; i < steps; i++) this.step(h, inp, i === 0);
    this.stepClock(simDt);
    this.updatePhysics(simDt);
    this.noteVisit();
    this.checkVistas();
    this.frameCount++;
    return simDt;
  }

  // The uneven clock (CLOCK): the world under the player turns slowly while its sun is near the
  // horizon where they stand and quickly while it is night there. Only that world, and only
  // while the player is in its ground frame (on foot, landed, flying in its air): everything in
  // that frame rides with it, so nothing moves in the picture but the light. Higher up the
  // rate eases back to 1, well before the ship leaves the frame.
  stepClock(dt) {
    const st = this.sm.state, eph = this.eph;
    let id = null, p = null, high = 0;
    if (st === S.ON_FOOT || st === S.BOARDING) { id = this.bodyId; p = this.ex.p; }
    else if (this.shFrame.kind === 'body' && this.shFrame.rotating) {
      id = this.shFrame.id; p = this.sh.p;
      high = smoothstep(CLOCK.low, CLOCK.top, (len(p) - BODIES[id].radius) / spaceAltitude(BODIES[id]));
    }
    let rate = 1;
    if (id && this.unevenClock) {
      const elev = Math.asin(clamp(eph.sunElevationSin(id, this.t, norm(p)), -1, 1)) * 180 / Math.PI;
      rate = mix(clockRate(elev), 1, high);
    }
    for (const k in eph.spinRate) if (k !== id && eph.spinRate[k] !== 1) eph.spinRate[k] = 1;
    if (id) eph.turnBy(id, dt, rate);
    this.clockRate = rate;
  }

  // ---- simulation step -----------------------------------------------------------------------
  step(h, inp, first) {
    this._firstStep = first;
    this.t += h;
    this.sm.update(h);
    const I = this.input;
    const pressed = (code) => first && inp.edges.has(code);
    const mdx = first ? inp.dx : 0, mdy = first ? inp.dy : 0;
    const st = this.sm.state;

    if (st === S.ON_FOOT && this.easel) {
      // Taken to an easel: the walk there and the held picture; the hands are off the controls.
      this.stepEasel(h);
      if (this.easel && this.easel.phase === 'hold') stepExplorer(this.ex, { moveX: 0, moveZ: 0, run: false, stroll: false, jump: false, jet: false, viewFwd: this.footCam.viewFwd, faceView: false }, h, this.explorerEnv(this.bodyId));
      if (this.shFrame.kind === 'body' && this.shFrame.rotating) this.stepParked(h);
    } else if (st === S.ON_FOOT) {
      if (first && inp.edges.has('KeyV')) this.footCam.firstPerson = !this.footCam.firstPerson;
      // C: a stroll (a true walking gait) in place of the usual easy lope; Shift still runs.
      if (pressed('KeyC')) {
        this.stroll = !this.stroll;
        this.say(this.stroll ? 'Strolling: C for the usual pace' : 'The usual pace', 2.5);
      }
      if (first && inp.wheel) this.footCam.boom = clamp(this.footCam.boom + inp.wheel * 0.8, CAMERA.boomMin, CAMERA.boomMax);
      lookFootCamera(this.footCam, norm(this.ex.p), mdx * FEEL.mouseFoot, mdy * FEEL.mouseFoot);
      stepExplorer(this.ex, {
        moveX: I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight'),
        moveZ: I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp'),
        run: I.down('ShiftLeft') || I.down('ShiftRight'),
        stroll: !!this.stroll,
        jump: pressed('Space'),
        jet: I.down('Space'),
        viewFwd: this.footCam.viewFwd,
        faceView: this.footCam.firstPerson,
      }, h, this.explorerEnv(this.bodyId));
      // Trunks and boulders: looked up once a frame around the explorer, hit every step.
      // (16 m: PHYSICS 20, the read-ahead of a lunar run looks 12 to 13 m out; checked: a 16 m query
      // lists everything a 9 m one does at 652 places, world.sampleObstacles starts missing beyond 20 m)
      if (first) this.nearObstacles = this.obstaclesNear(this.bodyId, this.ex.p, 16);
      const moving = I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight') !== 0 || I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp') !== 0;
      if (collideObstacles(this.ex, this.nearObstacles, undefined, { moving, dt: h }) && this.ex.grounded) {
        // Pushed sideways on sloping ground: put the feet back on it.
        const d = norm(this.ex.p);
        this.ex.p = scale(d, Math.max(len(this.ex.p), this.explorerEnv(this.bodyId).sample(d).radius));
      }
      if (this.shFrame.kind === 'body' && this.shFrame.rotating) this.stepParked(h);     // the ship waits on its gear
      this.thickWord(h, moving);
      if (pressed('KeyE') && this.boardable()) this.beginBoarding();
      else if (pressed('KeyE') && this.easelOffer) this.beginEasel(this.easelOffer);
    } else if (st === S.BOARDING) {
      this.stepBoarding(h);
    } else if (st === S.LANDED) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      this.stepParked(h);
      this.sh.canopy01 = mix(this.sh.canopy01, 0, 1 - Math.exp(-4 * h));
      if (pressed('Space')) {
        this.sh.gearOn = false;
        this.sh.float = null;
        beginLiftoff(this.sh);
        this.sm.dispatch(EV.liftoff);
        this.emit('liftoff');
      } else if (pressed('KeyE')) this.beginExit();
    } else if (st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      this.stepFlying(h, I, mdx, mdy, pressed);
    } else if (st === S.LANDING) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      // With PHYSICS the last metre belongs to the landing gear: the assist brings the hull to
      // about a metre over the site, then the three sprung legs take it down and take the weight.
      let r;
      if (this.sh.landing && this.sh.landing.gear) r = this.stepLandingGear(h);
      else {
        r = stepLanding(this.sh, h, this.sampler(this.shFrame.id), undefined, this.physics && this.useGear ? LEGS : null);
        if (r === 'gear') { this.beginLandingGear(); r = 'landing'; }
      }
      if (r === 'touchdown') {
        this.bodyId = this.shFrame.id;
        this.sh.float = null;                              // (afloat: the still pose is this one)
        this.sh.gearOn = false; this.sh.lift01 = 1;       // hand the hull to its landing gear
        this.sm.dispatch(EV.touchdown);
        this.emit('touchdown');
      } else if (r === 'blocked') {
        this.sm.dispatch(EV.abortLanding);
        this.say('No level ground here: try a little further on');
        this.emit('too-steep');
      } else if (pressed('Space') || pressed('KeyW')) {
        this.sh.landing = null;
        this.sm.dispatch(EV.abortLanding);
      }
    }
  }

  // The parked ship. With PHYSICS it stands on its landing gear: three sprung legs settle the
  // hull onto the ground it met and then go to sleep. Afloat, or without PHYSICS, it rests
  // where the landing assist put it.
  stepParked(h) {
    const sh = this.sh;
    if (this.physics && this.useGear && !sh.onLiquid && this.shFrame.kind === 'body' && this.shFrame.rotating) {
      if (!sh.gearOn) { sh.gearOn = true; sh.lift01 = sh.lift01 == null ? 0 : sh.lift01; this.physics.ship.wake(sh); }
      sh.lift01 = Math.max(0, sh.lift01 - h / 1.5);             // the anti-gravity lets the weight down
      const cmd = this._gearCmd || (this._gearCmd = { lift01: 0 });
      cmd.lift01 = sh.lift01;
      this.physics.ship.gear(sh, cmd, h, this.explorerEnv(this.shFrame.id));
      sh.speed = len(sh.v);
      sh.throttle = 0; sh.turnRate = 0; sh.altGround = 0;
      sh.gear01 = mix(sh.gear01, 1, 1 - Math.exp(-4 * h));
      sh.throttle01 = mix(sh.throttle01, 0, 1 - Math.exp(-2.5 * h));
    } else if (sh.onLiquid && this.physics && this.shFrame.kind === 'body' && this.shFrame.rotating) this.stepAfloat(h);
    else stepLanded(sh, h);
  }

  // A ship at rest on water floats (the coordinator's ruling, 2026-11-12): it heaves and pitches
  // with the drawn sea (PHYSICS' env.waterLevel, the surface PAINTER's water shader draws), averaged
  // over the hull: the sea's height on a 5 x 3 grid over FLOAT.length x FLOAT.beam gives the mean
  // (heave) and the least-squares slopes along and across the hull (pitch, roll); the hull takes
  // them up at FLOAT.follow, its inertia. Waves shorter than the hull lift it little.
  stepAfloat(h) {
    const sh = this.sh, env = this.explorerEnv(this.shFrame.id);
    stepLanded(sh, h);                                  // spool down, open up, no speed
    if (!env.waterLevel) return;
    let F = sh.float;
    if (!F) {
      const up0 = norm(sh.p), q0 = sh.restQ || sh.q;
      const fwd = tangent(qRotate(q0, V(0, 0, -1)), up0, V(0, 0, -1));
      F = sh.float = { p0: sh.p, q0, up: up0, fwd, right: cross(fwd, up0), z: 0, pitch: 0, roll: 0 };
    }
    const s = this.sampler(this.shFrame.id)(F.up);
    const depth = Math.max(0, s.liquidRadius - s.radius);
    let sum = 0, sa = 0, sb = 0;
    for (const a of FLOAT.along) for (const b of FLOAT.across) {
      const q = addScaled(addScaled(F.p0, F.fwd, a * FLOAT.length), F.right, b * FLOAT.beam);
      const w = +env.waterLevel(q, depth) || 0;
      sum += w; sa += w * a; sb += w * b;
    }
    // least squares over the grid: slope = sum(w x) / sum(x^2), x = a L (and b B across)
    const n = FLOAT.along.length * FLOAT.across.length;
    const heave = sum / n, along = sa / (FLOAT.sa2 * FLOAT.length), across = sb / (FLOAT.sb2 * FLOAT.beam);
    const k = 1 - Math.exp(-FLOAT.follow * h);
    F.z += (heave - F.z) * k;
    F.pitch += (clamp(Math.atan(along), -FLOAT.tilt, FLOAT.tilt) - F.pitch) * k;
    F.roll += (clamp(Math.atan(across), -FLOAT.tilt, FLOAT.tilt) - F.roll) * k;
    sh.p = addScaled(F.p0, F.up, F.z);
    // nose up when the sea is higher at the bow (about the right axis), the starboard side up when it is higher there
    sh.q = qMul(qFromAxisAngle(F.fwd, -F.roll), qMul(qFromAxisAngle(F.right, F.pitch), F.q0));
  }

  // Touchdown on the legs (PHYSICS' recipe): from about a metre up the hull is weightless on its
  // lift and is let down at 0.6 m/s until a foot meets the ground; from then on the lift fades
  // (Sim.stepParked) and the legs take the weight, sag and settle.
  beginLandingGear() {
    const sh = this.sh, sample = this.sampler(this.shFrame.id);
    sh.landing.gear = { t: 0 };
    this.physics.ship.wake(sh);
    // No foot may start inside the ground (a bank under one leg): lift the hull clear first.
    const legs = (this.physics.ship.tuning && this.physics.ship.tuning.legs) || [];
    let low = Infinity;
    for (const L of legs) {
      const f = add(sh.p, qRotate(sh.q, V(L[0], L[1], L[2])));
      const g = floorAt(sample, f);
      low = Math.min(low, g.r - g.floor);
    }
    if (low < 0.25) sh.p = addScaled(sh.p, norm(sh.p), 0.25 - low);
  }

  stepLandingGear(h) {
    const sh = this.sh, G = sh.landing.gear, up = norm(sh.p);
    G.t += h;
    const cmd = this._landCmd || (this._landCmd = { lift01: 1, hold: V() });
    cmd.lift01 = 1;
    cmd.hold.x = up.x * -LEGS.sink; cmd.hold.y = up.y * -LEGS.sink; cmd.hold.z = up.z * -LEGS.sink;
    this.physics.ship.gear(sh, cmd, h, this.explorerEnv(this.shFrame.id));
    sh.speed = len(sh.v);
    const g = floorAt(this.sampler(this.shFrame.id), sh.p);
    sh.altGround = Math.max(0, g.r - g.floor);
    sh.gear01 = 1; sh.throttle = 0; sh.turnRate = 0;
    sh.throttle01 = mix(sh.throttle01, 0.2, 1 - Math.exp(-3 * h));
    if ((sh.phys && sh.phys.contacts > 0) || G.t > 5) {
      sh.landing = null; sh.onLiquid = false; sh.restQ = null; sh.altGround = 0;
      return 'touchdown';
    }
    return 'landing';
  }

  // Obstacles around a body-local point, as plain objects (copied: the world may reuse its own).
  obstaclesNear(bodyId, p, radius) {
    if (!this.sampleObstacles) return [];
    let list;
    try { list = this.sampleObstacles(bodyId, norm(p), radius); } catch { return []; }
    const out = [];
    if (list) for (const o of list) {
      if (!o || !o.unitDir) continue;
      out.push({ unitDir: norm(V(o.unitDir.x, o.unitDir.y, o.unitDir.z)), radius: o.radius || 0.3, height: o.height == null ? 3 : o.height });
    }
    return out;
  }

  // PHYSICS, once per frame, before the world is updated (C14): where the near field is centred
  // and what is disturbing it.
  updatePhysics(dt) {
    const physics = this.physics;
    if (!physics) return;
    const st = this.sm.state;
    const out = this._disturbers;
    out.length = 0;
    let bodyId = null, focus = null;
    const shipOnGroundFrame = this.shFrame.kind === 'body' && this.shFrame.rotating;
    if (st === S.ON_FOOT || st === S.BOARDING) {
      bodyId = this.bodyId; focus = this.ex.p;
      physics.explorer.disturbers(this.ex, out);
      if (shipOnGroundFrame && this.shFrame.id === bodyId && len(sub(this.sh.p, this.ex.p)) < 80) physics.ship.disturbers(this.sh, out);
    } else if (shipOnGroundFrame) {
      bodyId = this.shFrame.id; focus = this.sh.p;
      physics.ship.disturbers(this.sh, out);
    }
    const t0 = now();
    // (eye: where the lens is, body-local, so that falling snow is simulated round the camera.)
    const eye = bodyId && this.camPose && this.camFrame.kind === 'body' && this.camFrame.rotating && this.camFrame.id === bodyId ? this.camPose.p : null;
    physics.update(dt, {
      bodyId, time: this.t, focus, eye,
      sunDir: bodyId ? this.eph.sunDirLocal(bodyId, this.t) : null,
      disturbers: out,
    });
    const ms = now() - t0;
    this.physicsMs += (ms - this.physicsMs) * 0.1;
    if (ms > this.physicsWorstMs || this.frameCount % 600 === 0) this.physicsWorstMs = ms;
  }

  // Vistas of a body as plain objects (cached): [{ id, name, dir }].
  vistasOf(bodyId) {
    if (this._vistaList[bodyId]) return this._vistaList[bodyId];
    let list = [];
    if (this.getVistas) {
      try {
        list = (this.getVistas(bodyId) || []).filter((v) => v && v.unitDir && v.id != null)
          .map((v) => ({ id: String(v.id), name: v.name || 'a view', dir: norm(V(v.unitDir.x, v.unitDir.y, v.unitDir.z)),
            // the way the picture was painted (radians: yaw from local north toward east, pitch up), where the world says
            yaw: Number.isFinite(v.yaw) ? v.yaw : null, pitch: Number.isFinite(v.pitch) ? v.pitch : null }));
      } catch { list = []; }
    }
    this._vistaList[bodyId] = list;
    return list;
  }

  // Walking up to a vista finds it (within VISTA_RANGE metres of its spot, on foot).
  checkVistas() {
    if (this.sm.state !== S.ON_FOOT) { this.easelOffer = null; return; }
    const list = this.vistasOf(this.bodyId);
    if (!list.length) { this.easelOffer = null; return; }
    const found = this.vistas[this.bodyId] || (this.vistas[this.bodyId] = {});
    const r = len(this.ex.p), up = scale(this.ex.p, 1 / r);
    let offer = null;
    for (const v of list) {
      const d = Math.acos(Math.min(1, dot(up, v.dir))) * r;
      if (!found[v.id] && d < VISTA_RANGE) {
        found[v.id] = true;
        this.say('A view for the sketchbook: ' + v.name, 6);
        this.emit('vista');
        if (this.onVistaFound) this.onVistaFound(this.bodyId, v.id);
      }
      // Found and not yet drawn: its easel is offered while it is within reach.
      // (on the ground or afloat: not to a jetpack overhead, nor to an explorer on a face steeper than
      // the easel's walk takes, sliding down it whatever is pressed)
      if (!offer && found[v.id] && !this.easel && (this.ex.altitude < 2.5 || this.ex.swimming) && !(this.ex.grounded && this.ex.slope > EASEL.steep) && d < VISTA_RANGE + (this.easelOffer === v ? EASEL.reach : 0) && this.undrawn(this.bodyId, v)) offer = v;
    }
    this.easelOffer = offer;
  }

  // A view whose page has no picture yet: not stood at in this sitting, and no sketch kept.
  undrawn(bodyId, v) {
    if (this.stood[bodyId] && this.stood[bodyId][v.id]) return false;
    return !(this.vistaDrawn && this.vistaDrawn(bodyId, v.id));
  }

  // The nearest view of this world not yet drawn, within VISTA_MARK metres, for the one quiet mark
  // on foot: { id, name, distance, p (body-local, at eye height over its spot) } or null.
  vistaMark() {
    if (this.sm.state !== S.ON_FOOT || this.easel) return null;
    const r = len(this.ex.p), up = scale(this.ex.p, 1 / r);
    let best = null;
    for (const v of this.vistasOf(this.bodyId)) {
      const d = Math.acos(Math.min(1, dot(up, v.dir))) * r;
      if (d > VISTA_MARK || (best && d >= best.distance) || !this.undrawn(this.bodyId, v)) continue;
      best = { id: v.id, name: v.name, distance: d, dir: v.dir };
    }
    if (!best) return null;
    const g = this.sampler(this.bodyId)(best.dir);
    best.p = scale(best.dir, Math.max(g.radius, g.liquidRadius || 0) + 1.5);
    return best;
  }

  // The way back to the ship on foot (M4's blind play-test: ten minutes hunting for it on Mars at
  // night after walking six seconds away): where it stands (a point over its middle, in the
  // body's ground frame) and how far, or null when it is not parked on this world. `near`: within
  // SHIP_MARK metres, where the mark shows only while the ship is out of the picture.
  shipMark() {
    if (this.sm.state !== S.ON_FOOT || this.easel) return null;
    const f = this.shFrame;
    if (f.kind !== 'body' || !f.rotating || f.id !== this.bodyId) return null;
    const up = norm(this.sh.p);
    const p = addScaled(this.sh.p, up, 2.5);
    const distance = len(sub(this.sh.p, this.ex.p));
    return { p, distance, near: distance <= SHIP_MARK };
  }

  // E at a found view: to its easel. The explorer walks to the spot the picture was painted
  // from; the view turns to the picture's heading and pitch (a view the world gives no heading
  // for keeps the way the player looks), third person, at the usual boom.
  beginEasel(v) {
    if (this.sm.state !== S.ON_FOOT || this.easel) return false;
    const cam = this.footCam, g = this.sampler(this.bodyId)(v.dir);
    const to = this.easelWay(this.ex.p, scale(v.dir, Math.max(g.radius, g.liquidRadius > g.radius ? g.liquidRadius - EXPLORER.swimDepth : 0)));
    let fwd = tangent(cam.viewFwd, v.dir, cam.viewFwd), pitch = cam.pitch;
    if (v.yaw != null) {
      const east = tangent(cross(Y, v.dir), v.dir, V(1, 0, 0)), north = cross(v.dir, east);
      fwd = add(scale(north, Math.cos(v.yaw)), scale(east, Math.sin(v.yaw)));
      pitch = clamp(v.pitch == null ? -0.12 : v.pitch, CAMERA.pitchMin, CAMERA.pitchMax);
    }
    const dist = len(sub(to, this.ex.p));
    this.easel = {
      id: v.id, name: v.name, phase: 'go', t: 0, dur: clamp(dist / EASEL.pace, EASEL.minSeconds, EASEL.maxSeconds), dist,
      fromP: { ...this.ex.p }, toP: to, fromFwd: cam.viewFwd, toFwd: fwd, fromPitch: cam.pitch, toPitch: pitch, fromBoom: cam.boom,
      firstPerson: cam.firstPerson,
    };
    cam.firstPerson = false;
    this.ex.v = V();
    this.easelOffer = null;
    this.notice = null;
    this.emit('easel');
    return true;
  }

  // How far along the straight way from `from` to `to` (body-local points on the ground or the
  // swimming level) the walk to an easel goes: all of it, or to a metre short of the first dry
  // place steeper than EASEL.steep or the first rise or drop of more than EASEL.step in EASEL.look
  // (where it would be under 0.6 m, nowhere: the picture is composed where the explorer stands).
  easelWay(from, to) {
    const sample = this.sampler(this.bodyId), d = Math.acos(clamp(dot(norm(from), norm(to)), -1, 1)) * len(from);    // (along the ground)
    if (d < 0.6) return to;
    const at = (k) => { const u = norm(lerp(from, to, k)), g = sample(u), wet = g.liquidRadius > g.radius; return { u, wet, slope: g.slope || 0, r: Math.max(g.radius, wet ? g.liquidRadius - EXPLORER.swimDepth : 0) }; };
    const n = Math.ceil(d / EASEL.look), most = EASEL.step * (d / n) / EASEL.look;
    let prev = len(from), ok = 0;
    for (let i = 1; i <= n; i++) {
      const q = at(i / n);
      if ((!q.wet && q.slope > EASEL.steep) || Math.abs(q.r - prev) > most) break;
      prev = q.r; ok = i / n;
    }
    if (ok >= 1) return to;
    const k = ok - 1 / d;
    if (k * d < 0.6) return { ...from };
    const q = at(k);
    return scale(q.u, q.r);
  }

  stepEasel(h) {
    const E = this.easel, cam = this.footCam;
    E.t += h;
    if (E.phase === 'go') {
      const k = clamp01(E.t / E.dur), e = smoothstep(0, 1, k), ex = this.ex;
      const q = lerp(E.fromP, E.toP, e), d = norm(q), g = this.sampler(this.bodyId)(d);
      ex.p = scale(d, Math.max(g.radius, g.liquidRadius > g.radius ? g.liquidRadius - EXPLORER.swimDepth : 0));
      const walking = E.dist > 0.6 && e > 0.03 && e < 0.97;
      ex.mode = walking ? 'walk' : 'idle';
      ex.speed = walking ? Math.min(EASEL.pace, 1.5 * E.dist / E.dur) : 0;
      ex.v = V(); ex.grounded = true;
      // The figure faces the way it walks, and at the easel the way the picture looks.
      const way = E.dist > 0.6 ? tangent(sub(E.toP, E.fromP), d, E.toFwd) : tangent(E.toFwd, d, E.toFwd);
      ex.fwd = tangent(lerp(way, tangent(E.toFwd, d, E.toFwd), smoothstep(0.7, 1, k)), d, way);
      // The view comes round the short way to the picture's heading, its pitch and the usual boom.
      const a0 = tangent(E.fromFwd, d, E.toFwd), a1 = tangent(E.toFwd, d, E.toFwd);
      const ang = Math.atan2(dot(cross(a0, a1), d), dot(a0, a1));
      cam.viewFwd = tangent(rotateAround(a0, d, ang * e), d, a1);
      cam.pitch = mix(E.fromPitch, E.toPitch, e);
      cam.boom = mix(E.fromBoom, CAMERA.boom, e);
      if (k >= 1) {
        // There: a fresh stance on the spot (as stepping out of the ship is), the picture held.
        const fuel = ex.fuel;
        this.ex = createExplorerState(E.toP, a1);
        this.ex.fuel = fuel;
        cam.viewFwd = a1; cam.pitch = E.toPitch; cam.boom = CAMERA.boom;
        // (with a presenter, a view is drawn when its page has a picture: if the page could not be
        // drawn while the picture was held, the easel is offered again; without one, standing there is it)
        if (!this.vistaDrawn) (this.stood[this.bodyId] || (this.stood[this.bodyId] = {}))[E.id] = true;
        E.phase = 'hold'; E.t = 0;
      }
    } else if (E.t >= EASEL.hold && (E.t > 8 || !this.vistaDrawn || this.vistaDrawn(this.bodyId, E.id))) {
      // (held until the presenter has the page: the world may still be laying the view)
      if (E.firstPerson) cam.firstPerson = true;
      this.easel = null;
    }
  }

  // The nearest vista not yet found on the current body: { name, distance, bearingDeg (+ right
  // of where the camera looks) } or null.
  nearestVista() {
    const list = this.vistasOf(this.bodyId);
    const found = this.vistas[this.bodyId] || {};
    const r = len(this.ex.p), up = scale(this.ex.p, 1 / r);
    let best = null;
    for (const v of list) {
      if (found[v.id]) continue;
      const d = Math.acos(Math.min(1, dot(up, v.dir))) * r;
      if (!best || d < best.distance) best = { id: v.id, name: v.name, distance: d, dir: v.dir };
    }
    if (!best) return null;
    const to = tangent(sub(best.dir, up), up, this.footCam.viewFwd);
    best.bearingDeg = Math.atan2(dot(cross(this.footCam.viewFwd, to), scale(up, -1)), dot(this.footCam.viewFwd, to)) * 180 / Math.PI;
    return best;
  }

  // Stepping out where no view is near enough for its mark (VISTA_MARK): one word on the way to
  // the nearest one not yet found (M4's blind play-test: landed at "a place to land" on Uranus,
  // the nearest view was 1.5 to 1.8 km off through blank fog, and nothing said where).
  viewWord() {
    if (this.sm.state !== S.ON_FOOT || this.vistaMark()) return;
    const v = this.nearestVista();
    if (!v || v.distance > 6000) return;
    const d = v.distance >= 1000 ? (v.distance / 1000).toFixed(1) + ' km' : Math.round(v.distance / 10) * 10 + ' m';
    const a = v.bearingDeg, way = Math.abs(a) < 25 ? 'ahead' : Math.abs(a) > 155 ? 'behind you' : a > 0 ? (a < 90 ? 'ahead to the right' : 'behind to the right') : (a > -90 ? 'ahead to the left' : 'behind to the left');
    this.say(`A view to find ${d} ${way}: fly nearer, or walk`, 8);
  }

  // What the sketchbook shows: per body, the biomes stood on and the vistas found.
  sketchbook() {
    const out = [];
    for (const id of this.eph.ids) {
      const list = this.vistasOf(id);
      const found = this.vistas[id] || {};
      out.push({
        id, name: BODIES[id].name, visited: !!this.visited[id],
        biomes: this.visited[id] ? Object.keys(this.visited[id].biomes) : [],
        vistasFound: list.filter((v) => found[v.id]).map((v) => v.name), vistasTotal: list.length,
        vistas: list.map((v) => ({ id: v.id, name: v.name, found: !!found[v.id] })),
      });
    }
    return out;
  }

  // The sketchbook's raw data: every body and biome the explorer has stood on.
  noteVisit() {
    if (this.sm.state !== S.ON_FOOT || !this.ex.surface) return;
    const v = this.visited[this.bodyId] || (this.visited[this.bodyId] = { biomes: {} });
    const b = this.ex.surface.biomeId;
    if (b && !v.biomes[b]) { v.biomes[b] = true; this.emit('biome'); }
  }

  emit(type) { this.eventSeq = (this.eventSeq || 0) + 1; this.events.push({ type, t: this.t }); if (this.events.length > 40) this.events.shift(); }

  // ---- boarding and stepping out ---------------------------------------------------------------
  hatchPoint() {
    // Where the explorer stands to board, on the ground beside the ship (body-local).
    const sample = this.sampler(this.shFrame.id);
    const p = add(this.sh.p, qRotate(this.sh.q, this.hatch));
    const d = norm(p);
    const s = sample(d);
    return scale(d, Math.max(s.radius, s.liquidRadius ? s.liquidRadius - EXPLORER.swimDepth : 0));
  }

  boardable() {
    if (this.sm.state !== S.ON_FOOT || this.shFrame.kind !== 'body' || this.shFrame.id !== this.bodyId) return false;
    const dShip = len(sub(this.ex.p, addScaled(this.sh.p, norm(this.sh.p), 1.2)));
    const dHatch = len(sub(this.ex.p, this.hatchPoint()));
    return canBoard(dHatch, dShip);
  }

  beginBoarding() {
    if (!this.sm.dispatch(EV.board)) return;
    const to = this.hatchPoint();
    // (the walk to the hatch is 0.7 of the transition: stepBoarding)
    const dur = clamp(len(sub(to, this.ex.p)) / FEEL.boardPace / 0.7, FEEL.boardSeconds, FEEL.boardSecondsMax);
    this.transition = { t: 0, dur, dir: 'in', from: this.camPose, exFrom: { ...this.ex.p }, exTo: to };
    this.shipCam.q = null;
    this.shipCam.short = null;                        // the chase view starts clear of the crowns here
    this.ex.v = V();
  }

  // The hull's spheres in the frame the ship rests in (body-local when it is parked).
  hullShape() {
    const sh = this.sh;
    return HULL_SHAPE.map((h) => ({ p: add(sh.p, qRotate(sh.q, V(h[0], h[1], h[2]))), radius: h[3] }));
  }

  // How much of a picture the parked hull takes: the share (0..1) of a frame seen from `p` along
  // unit `dir` (vertical field `fovDeg`) that its spheres cover; `mid` (0..1) keeps to that share
  // of the frame round its middle. 0 when the ship is not on this world.
  hullCover(p, dir, fovDeg = CAMERA.fovFoot, mid = 1, shape = null) {
    if (!shape) {
      if (!(this.shFrame.kind === 'body' && this.shFrame.rotating && this.shFrame.id === this.bodyId) || len(sub(this.sh.p, p)) > 60) return 0;
      shape = this.hullShape();
    }
    const up = norm(p), right = norm(cross(dir, up), V(1, 0, 0)), top = cross(right, dir);
    const th = Math.tan((fovDeg * Math.PI) / 360), tw = th * EXIT.aspect;
    const discs = [];
    for (const h of shape) {
      const v = sub(h.p, p), d = dot(v, dir);
      if (d < 0.3) { if (len(v) < h.radius) return 1; continue; }             // the lens inside the hull: all of it
      discs.push({ x: dot(v, right) / d, y: dot(v, top) / d, r: h.radius / d });
    }
    if (!discs.length) return 0;
    const NX = 16, NY = 9;
    let hit = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = ((i + 0.5) / NX * 2 - 1) * tw * mid, y = ((j + 0.5) / NY * 2 - 1) * th * mid;
      for (const c of discs) if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < c.r * c.r) { hit++; break; }
    }
    return hit / (NX * NY);
  }

  // The parked hull in the view on foot now: the share of the middle of the frame it covers
  // (the sketch of a place waits until the ship is out of it).
  hullInView(mid = 0.7) {
    const pose = this.camPose;
    if (this.sm.state !== S.ON_FOOT || !pose || !pose.look) return 0;
    return this.hullCover(pose.p, pose.look, pose.fov || CAMERA.fovFoot, mid);
  }

  // Is the ship the picture just now? On foot within EXIT.near metres of it (the first moments
  // after stepping out, or standing beside it) with the hull over more than EXIT.inPicture of the
  // middle of the frame. A page of the sketchbook is not drawn then: it waits for the land.
  shipInPicture() {
    if (this.sm.state !== S.ON_FOOT || len(sub(this.sh.p, this.ex.p)) > EXIT.near) return false;
    return this.hullInView(EXIT.middle) > EXIT.inPicture;
  }

  // Where the explorer walks to from the ladder: a few steps straight out from the hull, clear of
  // the wing, on ground fit to stand on (not a bank, not a trunk, not deeper water than the ladder's).
  exitSpot(hp, away) {
    const sample = this.sampler(this.shFrame.id), up = norm(hp), r0 = len(hp);
    const near = this.obstaclesNear(this.shFrame.id, hp, 8);
    const s0 = sample(up), wet0 = s0.liquidRadius > s0.radius;
    for (const d of EXIT.walk) {
      if (d === 0) break;
      const u = norm(addScaled(hp, away, d)), g = sample(u);
      const wet = g.liquidRadius > g.radius;
      const r = Math.max(g.radius, wet ? g.liquidRadius - EXPLORER.swimDepth : 0);
      if ((wet && !wet0) || g.slope > 0.5 || Math.abs(r - r0) > 0.3 + d * 0.5) continue;
      // nothing tall on the way or at the spot
      let clear = true;
      for (const o of near) {
        if (o.height <= EXPLORER.scramble) continue;
        const q = sub(scale(o.unitDir, r0), hp), along = clamp(dot(q, away), 0, d);
        if (len(sub(q, scale(away, along))) < o.radius + 0.7) { clear = false; break; }
      }
      if (clear) return scale(u, r);
    }
    return hp;
  }

  beginExit() {
    if (!this.sm.dispatch(EV.exit)) return;
    const hp = this.hatchPoint();
    const up = norm(hp);
    // Step out facing away from the hull, and walk a few steps clear of it.
    const away = tangent(sub(hp, this.sh.p), up, qRotate(this.sh.q, V(-1, 0, 0)));
    const out = this.exitSpot(hp, away);
    this.ex = createExplorerState(hp, away);
    this.ex.fuel = 1;
    this.bodyId = this.shFrame.id;
    this.footCam = createFootCamera(rotateAround(away, norm(out), this.exitView(out, away)), norm(out));
    this.footCam.firstPerson = false;
    this.transition = { t: 0, dur: FEEL.exitSeconds, dir: 'out', from: this.camPose, exFrom: hp, exTo: out };
  }

  // Which way the view faces as the explorer steps out at `feet` (an angle from `away`, the way
  // straight out from the hull): chosen for the picture. Each candidate is the frame the foot
  // camera would settle to; it is marked down for the hull between the lens and the figure, for
  // the hull over more than a sixth of the frame (and a little for any of it), for a boom the
  // hull or a trunk cuts short, for ground that rises in front or a trunk in the way, and for
  // turning far from straight out.
  exitView(feet, away) {
    const up = norm(feet), R = len(feet), sample = this.sampler(this.shFrame.id);
    const solid = this.cameraSolids(feet), shape = this.hullShape();
    const near = this.obstaclesNear(this.shFrame.id, feet, 14);
    const pitch = -0.12, pivot = addScaled(feet, up, CAMERA.pivotHeight), chest = addScaled(feet, up, 1.2);
    const here = sample(up).radius;
    let best = 0, bestScore = Infinity;
    for (const a of EXIT.turns) {
      const f = rotateAround(away, up, a);
      const look = norm(add(scale(f, Math.cos(pitch)), scale(up, Math.sin(pitch))));
      const room = boomRoom(feet, f, pitch, solid);
      const lens = addScaled(pivot, look, -Math.min(room, CAMERA.boom));
      const cover = this.hullCover(lens, look, CAMERA.fovFoot, 1, shape);
      // the hull between the lens and the figure
      let hidden = false;
      const seg = sub(chest, lens), sl = len(seg), sd = scale(seg, 1 / sl);
      for (const h of shape) {
        const q = sub(h.p, lens), t = clamp(dot(q, sd), 0, sl);
        if (len(sub(q, scale(sd, t))) < h.radius) { hidden = true; break; }
      }
      // open ground ahead: no bank rising in front, no trunk in the first metres of the view
      const rise = Math.max(0, sample(norm(addScaled(feet, f, 14))).radius - here) / 14;
      let trunk = 0;
      for (const o of near) {
        if (o.height <= CAMERA.pivotHeight) continue;
        const q = sub(scale(o.unitDir, R), feet), along = dot(q, f);
        if (along > 0.5 && along < 9 && len(sub(q, scale(f, along))) < o.radius + 1.2) trunk = Math.max(trunk, 1 - along / 9);
      }
      const score = (hidden ? 100 : 0) + (cover > EXIT.cover ? 40 + cover * 40 : cover * 4)
        + Math.max(0, CAMERA.boom - room) * 3 + rise * 4 + trunk * 2 + Math.abs(a) * 0.3;
      if (score < bestScore - 1e-9) { bestScore = score; best = a; }
    }
    return best;
  }

  stepBoarding(h) {
    const T = this.transition;
    if (!T) { this.sm.force(this.sm.ctx.boardingDir === 'out' ? S.ON_FOOT : S.LANDED); return; }
    T.t = Math.min(T.dur, T.t + h);
    const k = T.t / T.dur;
    this.stepParked(h);
    if (T.dir === 'in') {
      // The explorer walks to the hatch, the canopy lifts, then closes behind them.
      const e = smoothstep(0, 0.7, k);
      this.ex.p = lerp(T.exFrom, T.exTo, e);
      this.ex.mode = k < 0.7 ? 'walk' : 'idle';
      this.ex.speed = 2.5;
      const toShip = tangent(sub(this.sh.p, this.ex.p), norm(this.ex.p), this.ex.fwd);
      this.ex.fwd = tangent(lerp(this.ex.fwd, toShip, 0.15), norm(this.ex.p), toShip);
      this.sh.canopy01 = Math.sin(Math.PI * clamp01(k * 1.1)) ** 0.7;
      if (k >= 1) { this.transition = null; this.sh.canopy01 = 0; this.sm.dispatch(EV.seated); }
    } else {
      // Down the ladder and a few steps out, clear of the wing, while the view comes round.
      if (T.exTo && T.exFrom) {
        const e = smoothstep(0.12, 0.92, k);
        const q = lerp(T.exFrom, T.exTo, e), d = norm(q), g = this.sampler(this.bodyId)(d);
        const wet = g.liquidRadius > g.radius;
        this.ex.p = scale(d, Math.max(g.radius, wet ? g.liquidRadius - EXPLORER.swimDepth : 0, Math.min(len(T.exFrom), len(T.exTo))));
        const walking = e > 0.02 && e < 0.98 && len(sub(T.exTo, T.exFrom)) > 0.5;
        this.ex.mode = walking ? 'walk' : 'idle';
        this.ex.speed = walking ? 2.5 : 0;
        if (k >= 1) this.ex.p = { ...T.exTo };
      }
      this.sh.canopy01 = Math.sin(Math.PI * clamp01(k)) ** 0.7;
      if (k >= 1) { this.transition = null; this.sh.canopy01 = 0; this.ex.mode = 'idle'; this.ex.speed = 0; this.sm.dispatch(EV.steppedOut); this.viewWord(); }
    }
  }

  // ---- flight ------------------------------------------------------------------------------------
  // Everything the explorer's step needs to know about the world, per body. With PHYSICS wired
  // in this is where air, ground materials and the liquid come through (COORDINATOR.md C14).
  explorerEnv(bodyId) {
    let env = this._envs[bodyId];
    if (!env) {
      // The explorer's ground: the world's, with low boulders as rises to walk over.
      env = { sample: scrambleSample(this.sampler(bodyId), () => this.nearObstacles), gravity: BODIES[bodyId].gravity };
      if (this.physics) {
        this.physics.bindEnv(bodyId, env);
        env.bodyStep = this.physics.explorer.step;
      }
      this._envs[bodyId] = env;
    } else if (this.physics) env.time = this.t;
    return env;
  }

  // The floor under the flying ship: ground or liquid, raised to the tree tops where trees
  // stand (obstacle heights from world.sampleObstacles, refreshed once a frame near the ship).
  shipFloor(bodyId) {
    const sample = this.sampler(bodyId);
    return (p) => {
      const g = floorAt(sample, p);
      const list = this.canopy;
      // Painter's canopy field where the world has one...
      if (g.canopyHeight > 0 && !g.liquid) { g.floor += g.canopyHeight; g.canopy = g.canopyHeight; g.slope = 0; g.normal = scale(p, 1 / g.r); }
      // ...and single trees and boulders from the obstacle list (the only source on worlds without the field).
      if (list.length) {
        // Each tree is a tent: full height over its crown, sloping away to nothing, so the
        // canopy is a surface the ship can follow rather than a field of posts.
        let top = 0;
        const r = g.r;
        const run = 12 + this.sh.speed * 0.8;
        for (let i = 0; i < list.length; i++) {
          const o = list[i];
          const gap = Math.acos(Math.min(1, (p.x * o.unitDir.x + p.y * o.unitDir.y + p.z * o.unitDir.z) / r)) * r;
          const over = gap - o.radius - Math.max(2.5, o.height * 0.22);
          const h = over <= 0 ? o.height : o.height * (1 - over / run);
          if (h > top) top = h;
        }
        const extra = top - (g.canopy || 0);
        if (extra > 0) { g.floor += extra; g.canopy = top; g.slope = 0; g.normal = scale(p, 1 / r); }
      }
      return g;
    };
  }

  flightEnv() {
    const f = this.shFrame;
    if (f.kind !== 'body') {
      return { up: null, universeUp: Y, upWeight: 0, altitude: 1e9, spaceAlt: 1, hasBody: false, sample: null, gravity: 0, air: VACUUM_AIR, time: this.t };
    }
    const body = BODIES[f.id];
    const r = len(this.sh.p);
    const spaceAlt = spaceAltitude(body);
    const altitude = r - body.radius;
    const soiAlt = this.eph.soiRadius(f.id) - body.radius;
    const env = {
      up: scale(this.sh.p, 1 / r),
      universeUp: f.rotating ? qRotate(qConj(this.eph.orientation(f.id, this.t)), Y) : Y,
      // Inside a body's sphere of influence "up" is simply away from the body; it eases to
      // the ecliptic's up only in the outer third, on the way out to open space.
      upWeight: 1 - smoothstep(soiAlt * 0.68, soiAlt, altitude),
      altitude, spaceAlt, hasBody: true,
      sample: f.rotating ? this.sampler(f.id) : null,
      floor: f.rotating ? this.shipFloor(f.id) : null,
      gravity: body.gravity, radius: body.radius, altGround: this.sh.altGround, time: this.t,
    };
    if (this.physics) {
      // The pace of each world (PHYSICS' levers of P6, taken): commanded speeds scale with how
      // thin its air is against Earth's, to the power 0.4: Neptune 50, Saturn 52, Uranus 58,
      // Jupiter 62 m/s near the ground, Mars and the airless worlds 138, Venus 35 (its air decides).
      const A = this.physics.data && this.physics.data.ATMOSPHERES ? this.physics.data.ATMOSPHERES[f.id] : null;
      const rho0 = A ? A.rho0 || 0 : 1.225;
      const full = clamp(Math.pow(1.225 / Math.max(rho0, 0.02), 0.4), 0.75, 3);
      // ...but low over the ground the thin-air worlds keep to a gentler pace (about 78 m/s
      // under 60 m, the full 138 above 400 m): at 143 m/s Mars and the Moon turned on a radius
      // of 208 to 260 m and took 131 to 248 m to stop, the least forgiving flight in the game
      // exactly where there is something to hit (PHYSICS' re-fly). Height buys speed.
      const low = Math.min(full, 1.7), k = clamp((this.sh.altGround - 60) / 340, 0, 1);
      env.speedScale = low + (full - low) * k * k * (3 - 2 * k);
      // The drive field turns the velocity onto the nose with at most this sideways acceleration,
      // so thin-air worlds turn wide at their speed; and where the air cannot stop the ship, X
      // has a little of the field brake (stops from 138 m/s in about 4 s).
      env.carveAccel = 40;
      env.airBrake = rho0 < 0.3 ? 0.15 : 0;
      env.airless = rho0 < 0.01;
      // Air (density, wind, gusts) exists only in the ground frame; above it the ship is in vacuum.
      if (f.rotating) this.physics.bindEnv(f.id, env); else env.air = VACUUM_AIR;
      env.shipBody = this.physics.ship.step;
    }
    return env;
  }

  // Move the ship's state into the right frame for where it is (ground frame in the atmosphere,
  // body-centred in orbit, the sun's frame between worlds). State changes follow the frame.
  reframe() {
    const sh = this.sh;
    const fsOld = frameState(this.eph, this.shFrame, this.t);
    const P = posToUniverse(fsOld, sh.p);
    const next = chooseFrame(this.eph, this.t, P, this.shFrame);
    if (!sameFrame(next, this.shFrame)) {
      const c = convertState(this.eph, this.t, this.shFrame, next, sh);
      sh.p = c.p; sh.v = c.v; sh.q = c.q;
      if (this.shipCam.q) {
        this.shipCam.q = quatFromUniverse(frameState(this.eph, next, this.t), quatToUniverse(fsOld, this.shipCam.q));
      }
      this.shFrame = next;
    }
    const inAtmo = this.shFrame.kind === 'body' && this.shFrame.rotating;
    if (this.sm.state === S.ATMOSPHERE && !inAtmo) {
      this.sm.dispatch(EV.leftAtmosphere); this.emit('space');
      // The first time above the air on a journey that has seen one world only: say how to go
      // on (the title card listed M among sixteen keys, minutes ago).
      if (!this._saidMap && Object.keys(this.visited).length <= 1) this.say('M opens the map: choose a world there, then press F to fly to it', 9);
      this._saidMap = true;
    }
    else if (this.sm.state === S.SPACE && inAtmo) { this.sm.dispatch(EV.enteredAtmosphere); this.emit('entry'); }
  }

  // Centre of a body (or the sun) in the ship's current frame coordinates.
  bodyInShipFrame(id) {
    const fs = frameState(this.eph, this.shFrame, this.t);
    return posFromUniverse(fs, id === 'sun' ? V() : this.eph.position(id, this.t));
  }

  // The body nearest the nose becomes the target, unless one was chosen on the map.
  updateTarget() {
    const f = qRotate(this.sh.q, V(0, 0, -1));
    const here = this.shFrame.kind === 'body' ? this.shFrame.id : null;
    let best = null, bestAng = PULSE.aimCone;
    for (const id of this.eph.ids) {
      if (id === here) continue;
      const d = sub(this.bodyInShipFrame(id), this.sh.p);
      const ang = Math.acos(clamp(dot(norm(d), f), -1, 1));
      if (ang < bestAng) { bestAng = ang; best = id; }
    }
    this.aimed = best;
    if (best && !this.targetLocked) this.target = best;
    if (this.target === here) { this.target = null; this.targetLocked = false; }
  }

  setTarget(id, locked = true) {
    this.target = id && BODIES[id] ? id : null;
    this.targetLocked = !!this.target && locked;
  }

  targetInfo() {
    if (!this.target) return null;
    const d = len(sub(this.bodyInShipFrame(this.target), this.sh.p));
    const hop = Math.max(0, d - arrivalRadius(BODIES[this.target]));
    return { id: this.target, name: BODIES[this.target].name, distance: d, eta: pulseEta(hop) };
  }

  pulseSpheres() {
    const out = [{ id: 'sun', c: this.bodyInShipFrame('sun'), radius: SUN.radius * 2.5 }];
    for (const id of this.eph.ids) out.push({ id, c: this.bodyInShipFrame(id), radius: arrivalRadius(BODIES[id]) });
    return out;
  }

  say(text, seconds = 3.5) { this.notice = { text, until: this.t + seconds }; }

  // The view on foot taken back to looking out over the land (save.js VIEW_PITCH): after a
  // pointer lock that threw it about, and for a new session's first view.
  levelView() { this.footCam.pitch = clamp(this.footCam.pitch, VIEW_PITCH[0], VIEW_PITCH[1]); }

  // The course to the target from where the ship is: { dir, around } (pulse.js courseDir), or null.
  course(f = qRotate(this.sh.q, V(0, 0, -1)), spheres = this.pulseSpheres(), dest = this.target) {
    return dest ? courseDir(this.sh.p, f, dest, spheres) : null;
  }

  // F in space. With a course (a world chosen on the map, or the one last aimed at, which the
  // prompt names: "Pulse to Saturn"), F takes the ship to that world whether or not its mark is
  // on the screen: a nose far off the course is first turned onto it, in plain sight, and the
  // drive starts when it is on (it used to fire straight along the nose, away from the world,
  // while the prompt still said "Pulse to Saturn": M4's blind play-test lost minutes to it three
  // times). Without a course F pulses along the nose, as before.
  pressF() {
    if (this.sm.state !== S.SPACE) return false;
    if (this.turn) { this.turn = null; this.say('Turn stopped: F turns onto the course again', 3); return false; }
    if (!this.target) return this.tryPulse();
    this.targetLocked = true;                     // the course holds while the nose swings past other worlds
    const f = qRotate(this.sh.q, V(0, 0, -1));
    const spheres = this.pulseSpheres();
    const c = this.course(f, spheres);
    const off = c ? Math.acos(clamp(dot(f, c.dir), -1, 1)) : 0;
    const adv = pulseAdvice(this.sh.p, f, spheres);
    if (!c || (off < PULSE.turnFirst && !adv.inside && adv.vWant >= PULSE.exitSpeed * 1.5) || this.tooNear(adv)) return this.tryPulse();
    this.turn = { dest: this.target, t: 0, w: 0 };
    this.say(`Turning onto the course for ${BODIES[this.target].name}`, 4);
    this.emit('course-turn');
    return true;
  }

  // Already at the course's world (its sphere is the one that stops the drive, right ahead or
  // round us): no turn, the drive says so.
  tooNear(adv) {
    return !!this.target && adv.block === this.target && adv.vWant < PULSE.exitSpeed * 1.5;
  }

  // The turn onto the course: the nose swings at up to PULSE.turnRate, easing in and out, the
  // hands off the stick (the mouse and A / D stop it: the pilot wants it back); on the course
  // the drive starts. Returns true while it turns (the flight step then takes no steering).
  stepCourseTurn(h, I, mdx, mdy) {
    const T = this.turn;
    if (!T) return false;
    if (this.sm.state !== S.SPACE || !this.target) { this.turn = null; return false; }
    T.dest = this.target;
    T.t += h;
    const steer = Math.abs(I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight')) > 0.3;
    T.hand = (T.hand || 0) * Math.exp(-3 * h) + Math.abs(mdx) + Math.abs(mdy);
    if (steer || T.hand > 60 || T.t > PULSE.turnMax) {
      this.turn = null;
      if (T.t <= PULSE.turnMax) this.say('Turn stopped: F turns onto the course again', 3);
      return false;
    }
    const sh = this.sh;
    const f = qRotate(sh.q, V(0, 0, -1));
    const c = this.course(f);
    if (!c) { this.turn = null; return false; }
    const ang = Math.acos(clamp(dot(f, c.dir), -1, 1));
    if (ang < PULSE.turnDone) {
      this.turn = null;
      this.tryPulse();
      return false;
    }
    T.w = Math.min(PULSE.turnRate, T.w + PULSE.turnAccel * h, Math.sqrt(2 * PULSE.turnAccel * ang));
    let axis = cross(f, c.dir);
    if (len(axis) < 1e-5) axis = qRotate(sh.q, V(0, 1, 0));    // dead astern: round through the ship's own up
    sh.q = qNorm(qMul(qFromAxisAngle(norm(axis), Math.min(ang, T.w * h)), sh.q));
    sh.pending.yaw = 0; sh.pending.pitch = 0;
    return true;
  }

  tryPulse() {
    if (this.sm.state !== S.SPACE) return false;
    const f = qRotate(this.sh.q, V(0, 0, -1));
    const adv = pulseAdvice(this.sh.p, f, this.pulseSpheres());
    if (adv.inside || adv.vWant < PULSE.exitSpeed * 1.5) {
      const name = adv.block === 'sun' ? 'the Sun' : adv.block ? BODIES[adv.block].name : 'something';
      this.say(adv.inside ? `Too close to ${name}: turn away from it first` : `${name} is right ahead`);
      this.emit('pulse-blocked');
      return false;
    }
    this.pulse = createPulse(Math.max(0, dot(this.sh.v, f)));
    // Where this pulse is bound: the course of the moment. (The target itself is dropped as
    // soon as the ship is inside that world's own frame, which a small world's reaches out to
    // where the drive lets go: the words at arrival must not depend on it.)
    this.pulse.dest = this.target;
    this.sm.dispatch(EV.pulseOn);
    this.emit('pulse');
    return true;
  }

  // Lift-off, first half, with PHYSICS: the anti-gravity takes the weight off the legs over
  // 1.2 s, the thruster wash is lit from the first frame, the legs stretch, the feet leave.
  // Returns true while the ship is still on its gear.
  stepGearLiftoff(h) {
    const sh = this.sh, L = sh.liftoff;
    if (!L || L.air || !this.useGear || sh.onLiquid || this.shFrame.kind !== 'body' || !this.shFrame.rotating) {
      if (L) L.air = true;
      return false;
    }
    if (L.lift01 == null) { L.lift01 = 0; this.physics.ship.wake(sh); }
    L.lift01 = Math.min(1, L.lift01 + h / 1.2);
    L.t += h;
    const cmd = this._liftCmd || (this._liftCmd = { lift01: 0, hold: V() });
    const up = norm(sh.p);
    cmd.lift01 = L.lift01;
    cmd.hold.x = up.x * SHIP.liftoffClimb * L.lift01; cmd.hold.y = up.y * SHIP.liftoffClimb * L.lift01; cmd.hold.z = up.z * SHIP.liftoffClimb * L.lift01;
    this.physics.ship.gear(sh, cmd, h, this.explorerEnv(this.shFrame.id));
    sh.speed = len(sh.v);
    sh.throttle01 = mix(sh.throttle01, 0.65, 1 - Math.exp(-4 * h));
    if ((sh.phys && sh.phys.contacts === 0) || L.t > 3.5) { L.air = true; L.t = 0; }
    return true;
  }

  stepFlying(h, I, mdx, mdy, pressed) {
    const sh = this.sh;
    if (sh.liftoff && this.physics && this.stepGearLiftoff(h)) return;
    if (!sh.liftoff) this.reframe();
    const env = this.flightEnv();
    this.updateTarget();

    // ---- pulse drive ---------------------------------------------------------------------------
    const fNow = this.sm.state === S.SPACE && pressed('KeyF');
    if (fNow) this.pressF();
    const turning = this.stepCourseTurn(h, I, mdx, mdy);
    if (turning) { mdx = 0; mdy = 0; }
    if (this.sm.state === S.PULSE && this.pulse && !fNow) {
      const ps = this.pulse;
      if (pressed('KeyF') || pressed('KeyX') || pressed('KeyS') || pressed('Space')) ps.cancel = true;
      let f = qRotate(sh.q, V(0, 0, -1));
      // Draw the nose onto the course, so "point roughly and go" arrives, and round whatever
      // lies across the straight line (the course goes along the tangent past it).
      // (Bound for the world of the pulse's start: a world that comes near the nose on the way,
      // or the course dropped inside the world's own frame near the end, does not turn it.)
      const spheres = this.pulseSpheres();
      const bound = ps.dest || this.target;
      if (bound && !ps.cancel) {
        const want = this.course(f, spheres, bound).dir;
        const axis = cross(f, want);
        const sinA = len(axis);
        const ang = Math.atan2(sinA, dot(f, want));
        if (sinA > 1e-6) {
          sh.q = qMul(qFromAxisAngle(scale(axis, 1 / sinA), Math.min(ang, PULSE.assistRate * h)), sh.q);
          f = qRotate(sh.q, V(0, 0, -1));
        }
      }
      const adv = pulseAdvice(sh.p, f, spheres);
      stepPulseSpeed(ps, ps.cancel ? PULSE.exitSpeed * 0.9 : adv.vWant, h);
      ps.block = adv.block;
      env.pulseSpeed = ps.v;
      env.turnScale = PULSE.turnScale;
      // Let go when asked, or when what lies ahead is so close that cruise speed is all it allows.
      const atEdge = !!adv.block && adv.vWant <= PULSE.exitSpeed * 1.02;
      if (ps.t > 0.6 && ps.v <= PULSE.exitSpeed * 1.05 && (ps.cancel || atEdge)) {
        const arrived = !ps.cancel && adv.block !== 'sun';
        this.pulse = null;
        env.pulseSpeed = null;
        sh.throttle = arrived ? 0 : 0.5;          // arrive and coast to a stop in front of the planet
        this.sm.dispatch(EV.pulseOff);
        if (arrived) {
          // Arrived where we were going (or, with no course set, at whatever lay ahead)...
          const dest = ps.dest || this.target;
          if (!dest || adv.block === dest) this.say(`${BODIES[adv.block].name} ahead`, 5);
          // ...or stopped short by a world that lies between (the course goes round them, so
          // only if the pilot steered into one): F goes on, round it.
          else this.say(`${BODIES[adv.block].name} lies on your course: F goes on round it to ${BODIES[dest] ? BODIES[dest].name : 'the world you chose'}`, 7);
          if (adv.block === this.target || adv.block === dest) this.targetLocked = false;
          this.emit('arrived');
        } else {
          if (!ps.cancel && adv.block === 'sun') this.say(this.target ? 'The Sun lies on your course: F goes on round it' : 'The Sun is in the way: steer round it and pulse again', 6);
          this.emit('pulse-off');
        }
      }
    }

    // Tree tops under and ahead of a low-flying ship (looked up once a frame).
    if (env.floor) {
      if (this._firstStep && sh.altGround < 90) this.canopy = this.obstaclesNear(this.shFrame.id, sh.p, Math.min(45, 20 + sh.speed * 0.6));
      else if (sh.altGround >= 90) this.canopy = [];
    } else this.canopy = [];

    // E pressed faster than the landing assist takes the hull over (LAND_BEGIN_SPEED): the ship
    // first slows down with its own brakes, as X does, through the same flight computer and the
    // same ground assists; the landing begins when it has. W or Space lets it go.
    let slowing = this._landWish && this.sm.state === S.ATMOSPHERE && !sh.liftoff ? this._landWish : (this._landWish = null);
    if (slowing) {
      slowing.t += h;
      if (pressed('Space') || pressed('KeyW') || pressed('ArrowUp')) { this._landWish = slowing = null; this.say('Landing cancelled', 2); }
      else if (slowing.t > 25 || sh.altGround > LAND_PROMPT_ALTITUDE + 15) { this._landWish = slowing = null; this.say(this.slowWord(env)); }
      else sh.throttle = mix(sh.throttle, 0, 1 - Math.exp(-6 * h));
    }
    stepFlight(sh, {
      aimX: mdx * FEEL.mouseShip,
      aimY: mdy * FEEL.mouseShip,
      yawKey: I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight'),
      throttle: slowing ? 0 : I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp'),
      cut: !!slowing || I.down('KeyX'),
      lift: this.sm.state === S.PULSE || slowing ? 0 : (I.down('Space') ? 1 : 0) - (I.down('KeyC') ? 1 : 0),
    }, h, env);
    if (sh.bounce === 0) this.emit('bounce');

    if (this.sm.state === S.SPACE) this._thin = null;
    else if (this.sm.state === S.ATMOSPHERE && !sh.liftoff && env.airBrake > 0 && this._firstStep) this.thinAirWord(h, env);

    if (this.sm.state === S.ATMOSPHERE && !sh.liftoff) {
      // E lands. So does simply sinking onto the ground: nobody should have to hunt for a key.
      // "Onto the ground" is wherever the ship can sink no further: over a boulder, on a slope
      // or under PHYSICS' field the hover can settle higher than the free-flight clearance
      // (PHYSICS saw 4.1 m on the Moon, sink held for 90 s, nothing said). So besides the
      // height, a sink that has stalled for a second and a half near the ground also lands;
      // and if the ship is still moving too fast by then, the screen says so.
      const sinking = I.down('KeyC') && sh.altGround < 14;
      if (!sinking) this._sink = null;
      else if (!this._sink) this._sink = { t: 0, alt: sh.altGround };
      else {
        this._sink.t += h;
        if (this._sink.alt - sh.altGround > 0.3) this._sink = { t: 0, alt: sh.altGround };       // still coming down
      }
      const stalled = !!this._sink && this._sink.t > 1.5;
      if (stalled && sh.speed >= 5 && this._firstStep && !this.notice) this.say(this.slowWord(env));
      const settle = I.down('KeyC') && sh.speed < 5 && (sh.altGround < SHIP.minClearance + 1.2 || stalled);
      if (settle) this._sink = null;
      const asked = pressed('KeyE') && !slowing && this.landable();
      if (asked && sh.speed > LAND_BEGIN_SPEED && !settle) {
        this._landWish = { t: 0 };
        this.say('Slowing down to land', 3);
      } else if (asked || settle || (slowing && sh.speed <= LAND_BEGIN_SPEED)) {
        this._landWish = null;
        const trees = this.obstaclesNear(this.shFrame.id, sh.p, 80);
        // With PHYSICS, a site is good when the ground's friction will hold the parked ship.
        const id = this.shFrame.id;
        const holds = this.physics ? (dir, g) => {
          const G = this.physics.ground(id, dir, this._ground || (this._ground = {}));
          return Math.tan(g.slope) < 0.8 * (G.friction || 0.6);
        } : null;
        if (beginLanding(sh, this.sampler(id), undefined, trees, holds, settle)) {
          this.canopy = []; this.sm.dispatch(EV.beginLanding);
          // The assist picks level, open ground and glides to it. When that is more than a few
          // metres from where the ship hovered (trees, a slope), the screen says so: the
          // ship is not wandering off, it is looking for a place to stand.
          const L = sh.landing, r = len(sh.p);
          const off = L && L.dir ? Math.acos(clamp(dot(norm(sh.p), L.dir), -1, 1)) * r : 0;
          if (off > 6) this.say(`Setting down on level ground ${Math.round(off)} m away`, 4);
        }
        else { this.say('Too steep to land here'); this.emit('too-steep'); }
      } else if (pressed('KeyE') && !slowing) {
        // E without the prompt: never silence. Say what the landing is waiting for.
        this.say(sh.altGround > LAND_PROMPT_ALTITUDE ? `Come down below ${LAND_PROMPT_ALTITUDE} m to land` : this.slowWord(env));
      }
    }
  }

  // What the screen says when the ship is too fast to set down. Where the air is too thin to
  // slow it (Mars, Mercury, the Moon, Pluto) it also says what will: X.
  // Bogged down in a thick liquid (the lava of Venus: PHYSICS' Stokes drag holds a wader to a
  // third of a metre a second): after a few seconds of pushing say the way out, once per wade.
  thickWord(dt, moving) {
    const ex = this.ex;
    if (!(ex.liquidDepth > 0)) { this._bogT = 0; this._bogSaid = false; return; }
    const u = norm(ex.p), w = dot(ex.v, u);
    const slow = moving && ex.liquidDepth > 0.3 && len(sub(ex.v, scale(u, w))) < 1;
    this._bogT = slow ? (this._bogT || 0) + dt : 0;
    if (this._bogT < 2.5 || this._bogSaid) return;
    const env = this._envs[this.bodyId];
    const liq = env && env.liquidOf && ex.surface ? env.liquidOf(ex.surface) : null;
    if (!liq || !(liq.viscosity > 1)) return;                 // water and froth do not hold anyone
    this._bogSaid = true;
    this.say(`The ${liq.name || 'liquid'} is thick: hold Space and the jetpack lifts you out`, 7);
  }

  slowWord(env) {
    if (!env || !(env.airBrake > 0)) return 'Slow down to land';
    return env.airless ? 'Slow down to land: no air to slow the ship here, hold X' : 'Slow down to land: the air is thin here, hold X';
  }

  // A word on the screen when thin air limits the ship (PHYSICS' critique: "nothing telling the
  // player why the ship will not turn or land"). A calm slip of paper, no tone, each at its
  // moment: once per visit, coming down fast to where there is something to hit; and when the
  // nose has turned and the ship has not followed for a second and a half (at most once a minute).
  thinAirWord(h, env) {
    const sh = this.sh, id = this.shFrame.id;
    const name = BODIES[id].name === 'Moon' ? 'the Moon' : BODIES[id].name;
    const T = this._thin && this._thin.id === id ? this._thin : (this._thin = { id, told: false, slip: 0, wideAt: -1e9 });
    if (!T.told && sh.altGround < 250 && sh.speed > SHIP.speedGround * 1.25 && !this.notice) {
      T.told = true;
      this.say(`${env.airless ? 'No air' : 'Thin air'} on ${name}: the ship runs fast and turns wide. Hold X to slow it`, 6);
    }
    const f = qRotate(sh.q, V(0, 0, -1));
    const off = sh.speed > 40 ? Math.acos(clamp(dot(f, sh.v) / sh.speed, -1, 1)) : 0;
    T.slip = off > 0.5 ? T.slip + h : 0;
    if (T.slip > 1.5 && this.t - T.wideAt > 60 && !this.notice) {
      T.wideAt = this.t;
      this.say(`${env.airless ? 'No air to bank on' : 'Thin air'}: the ship turns wide at this speed. Ease off (S) and it turns tighter`, 5);
    }
  }

  landable() {
    // Once the prompt is up it stays up through a little more height and speed (15 m, 10 m/s),
    // so it does not flicker over rough ground and E pressed on the prompt lands.
    const k = this._landOk ? 1 : 0;
    this._landOk = this.shFrame.kind === 'body' && this.shFrame.rotating && !this.sh.liftoff
      && canBeginLanding(this.sm.state, this.sh.altGround - 15 * k, this.sh.speed - 10 * k);
    return this._landOk;
  }

  // ---- camera ------------------------------------------------------------------------------------
  // What the third-person boom must not pass through near body-local point `p`: the parked
  // ship (the one solid thing besides the ground) and trunks, crystals and the like that stand
  // taller than the boom's pivot. Spheres { p, radius }.
  cameraSolids(p, obstacles) {
    let out = [];
    if (this.shFrame.kind === 'body' && this.shFrame.rotating && this.shFrame.id === this.bodyId && len(sub(this.sh.p, p)) < 40) {
      out = [-2.9, 0, 2.9].map((z) => ({ p: add(this.sh.p, qRotate(this.sh.q, V(0, 1.7, z))), radius: 2.2 }));
    }
    const list = obstacles || this.obstaclesNear(this.bodyId, p, 12);
    if (list.length) {
      const r = len(p) + CAMERA.pivotHeight;
      for (const o of list) if (o.height > CAMERA.pivotHeight) out.push({ p: scale(o.unitDir, r), radius: o.radius + 0.3 });
    }
    return out;
  }

  footPose(dt) {
    // (PHYSICS P20) a swimmer rides the drawn sea (an sd of 0.29 m at 4 to 6 s in a gale on Earth):
    // the view follows the swell's mean and lets each slap go (0.45 s; a 5 s wave keeps 85 % of its height)
    let feet = this.ex.p;
    // (M4) and the view rides a little higher over a swimmer, eased in and out (CAMERA.swimLift)
    this._swimLift = (this._swimLift || 0) + ((this.ex.swimming ? CAMERA.swimLift : 0) - (this._swimLift || 0)) * (1 - Math.exp(-Math.max(0, dt) / CAMERA.swimEase));
    if (this.ex.swimming) {
      const r = len(feet);
      this._swimR = this._swimR == null ? r : this._swimR + (r - this._swimR) * (1 - Math.exp(-Math.max(0, dt) / 0.45));
      feet = scale(norm(feet), this._swimR + this._swimLift);
    } else {
      this._swimR = null;
      if (this._swimLift > 0.005) feet = addScaled(feet, norm(feet), this._swimLift);
    }
    return updateFootCamera(this.footCam, feet, dt, this.sampler(this.bodyId), undefined, this.cameraSolids(this.ex.p, this.nearObstacles), this.footCrowns());
  }

  // The trees round the explorer as crowns the foot camera keeps out of (camera.js
  // footBoomAmongCrowns), IN THE AIR ONLY: on the jetpack's way up and down, once the feet are
  // footAirHeight over the ground. On the ground (a walk in a wood, stepping out under a birch)
  // the view is as it always was: null. From the obstacles already looked up round the explorer
  // each frame, their feet put on the ground again whenever the explorer has moved 3 m.
  footCrowns() {
    const near = this.nearObstacles, ex = this.ex;
    if (!near || !near.length) { this._footCrowns = null; return null; }
    if (ex.grounded || ex.swimming || !(ex.airTime > CAMERA.footAir) || !(ex.altitude > CAMERA.footAirHeight)) return null;
    let c = this._footCrowns;
    if (!c || c.body !== this.bodyId || c.n !== near.length || len(sub(c.at, ex.p)) > 3) {
      c = this._footCrowns = { body: this.bodyId, at: { ...ex.p }, n: near.length, list: crownList(this.bodyId, near, this.sampler(this.bodyId)) };
    }
    return c.list.length ? c.list : null;
  }

  shipPose(dt) {
    const env = this.flightEnv();
    const up = env.up ? norm(lerp(env.universeUp, env.up, clamp01(env.upWeight)), env.up) : env.universeUp;
    const speed01 = clamp01(this.sh.speed / SHIP.speedSpace);
    return updateShipCamera(this.shipCam, this.sh, dt, {
      upRef: up, level01: mix(0.55, 1, clamp01(env.upWeight)), speed01, seat: this.seat,
      sample: env.sample, toLocal: env.sample ? (p) => p : null, solid: env.sample ? this.crownSolid() : null,
      descent: this.sm.state === S.LANDING ? this.sh.altGround : null,
    });
  }

  // The trees round a low ship as crowns the chase camera keeps out of (camera.js crownDistance):
  // looked up 32 m round the ship again whenever it has moved 4 m. null when there are none, or
  // the ship is too high for its camera to reach a crown.
  crownSolid() {
    const f = this.shFrame, sh = this.sh;
    if (!(f.kind === 'body' && f.rotating) || !(sh.altGround < 45)) { this._crowns = null; return null; }
    // over the tallest crowns (about 22 m) a camera 3.6 m over the ship meets none: no look-up
    // (a landing looks at its whole way down, so it always does)
    if (this.sm.state !== S.LANDING && len(sh.p) - this.sampler(f.id)(norm(sh.p)).radius > 28) return null;
    let c = this._crowns;
    if (!c || c.body !== f.id || len(sub(c.at, sh.p)) > 4) {
      c = this._crowns = { body: f.id, at: { ...sh.p }, list: crownList(f.id, this.obstaclesNear(f.id, sh.p, 32), this.sampler(f.id)) };
    }
    if (!c.list.length) return null;
    return (p) => crownDistance(c.list, p);
  }

  // ---- view: where the camera is this frame, in universe coordinates ----------------------------
  view(dt) {
    const st = this.sm.state;
    let pose, frame, view;
    if (st === S.ON_FOOT) {
      pose = this.footPose(dt); frame = bodyFrame(this.bodyId, true); view = 'foot';
    } else if (st === S.BOARDING && this.transition) {
      const T = this.transition;
      frame = bodyFrame(this.bodyId, true);
      const k = smoothstep(0, 1, T.t / T.dur);
      const target = T.dir === 'in' ? this.shipPose(dt) : this.footPose(dt);
      pose = T.from ? blendPose(T.from, target, k) : target;
      // The explorer stays in the picture on the way round (PAINTER's critique 8: boarding was a
      // whip pan with the explorer out of the frame in 0.2 s, stepping out a cut to an empty
      // field): through the middle of the move the view is turned onto them, the walk to the
      // hatch and the steps away from the ladder are seen; at its ends it is the old and the new view.
      if (T.from) {
        const kl = T.t / T.dur;
        const w = T.dir === 'in' ? smoothstep(0.04, 0.3, kl) * (1 - smoothstep(0.5, 0.74, kl)) : smoothstep(0.1, 0.42, kl) * (1 - smoothstep(0.7, 1, kl));
        if (w > 0) {
          const up = norm(this.ex.p), aim = addScaled(this.ex.p, up, 1.3), d = sub(aim, pose.p);
          if (len(d) > 0.5) pose = { p: pose.p, q: qSlerp(pose.q, qLook(norm(d), norm(pose.p)), w), fov: pose.fov };
        }
      }
      view = T.dir === 'in' ? (k > 0.5 ? 'chase' : 'foot') : (k > 0.5 ? 'foot' : 'chase');
      if (view === 'chase' && this.shipCam.cockpit) view = 'cockpit';
    } else {
      pose = this.shipPose(dt); frame = this.shFrame; view = this.shipCam.cockpit ? 'cockpit' : 'chase';
    }
    this.camPose = pose; this.camFrame = frame; this.viewKind = view;
    const fsCam = frameState(this.eph, frame, this.t);
    const camU = posToUniverse(fsCam, pose.p);
    const camQ = quatToUniverse(fsCam, pose.q);
    this.origin.set(camU);
    const active = this.activeBody(camU);
    const flying = st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE || st === S.LANDING;
    // Empty air around the camera: only counted in free flight (never while landed or boarding).
    let clearance = 0;
    if (flying && st !== S.LANDING) {
      clearance = this.shFrame.kind === 'body' && this.shFrame.rotating ? this.sh.altGround
        : active ? Math.max(0, active.altitude) : 1e6;
    }
    this.updateMood(active);
    const ti = this.targetInfo();
    // "Land here" is not offered in the first moments after a lift-off (the ship is a metre
    // up and has nowhere else to be): only once it has been 12 m clear of the ground, or eight
    // seconds have passed. E lands all the same; this is about what the screen suggests.
    if (st === S.LANDED || st === S.ON_FOOT || st === S.BOARDING) { this._offT = 0; this._offClear = false; }
    else { this._offT = (this._offT || 0) + dt; if (this.sh.altGround > 12 || st === S.SPACE || st === S.PULSE) this._offClear = true; }
    const offerLanding = this._offClear || this._offT > 8;
    const q = {
      canBoard: st === S.ON_FOOT && this.boardable(), canLand: this.landable() && offerLanding, liftingOff: !!this.sh.liftoff,
      canEasel: st === S.ON_FOOT && !!this.easelOffer && !this.easel,
      slowingToLand: st === S.ATMOSPHERE && !!this._landWish,
      target: ti ? ti.name : null, turning: st === S.SPACE && !!this.turn,
    };
    this.promptNow = promptFor(st, q);
    if (this.notice && this.t > this.notice.until) this.notice = null;
    return { camU, camQ, fov: pose.fov, view, clearance, active, flying };
  }

  // Universe pose of the ship and of the explorer (for placing the models).
  shipPoseU() {
    const fs = frameState(this.eph, this.shFrame, this.t);
    return { p: posToUniverse(fs, this.sh.p), q: quatToUniverse(fs, this.sh.q) };
  }

  explorerPoseU() {
    const fs = frameState(this.eph, bodyFrame(this.bodyId, true), this.t);
    return { p: posToUniverse(fs, this.ex.p), q: quatToUniverse(fs, qLook(this.ex.fwd, norm(this.ex.p))) };
  }

  explorerVisible() {
    const st = this.sm.state;
    // Hidden in first person, and while a squeezed boom has slid the view into the eyes.
    if (st === S.ON_FOOT) return !this.footCam.firstPerson && !(this.footCam.tight01 > 0.3);
    if (st === S.BOARDING && this.transition) return this.transition.dir === 'in' ? this.transition.t / this.transition.dur < 0.72 : true;
    return false;
  }

  // The dominant body at the camera: { id, altitude (above base radius), dir (body-local) }.
  activeBody(camU) {
    let id = null;
    if (this.sm.state === S.ON_FOOT || this.sm.state === S.BOARDING || this.sm.state === S.LANDED) id = this.bodyId;
    else if (this.shFrame.kind === 'body') id = this.shFrame.id;
    if (!id) return null;
    const fs = frameState(this.eph, bodyFrame(id, true), this.t);
    const local = posFromUniverse(fs, camU);
    const r = len(local);
    return { id, altitude: r - BODIES[id].radius, dir: scale(local, 1 / r), r };
  }

  updateMood(active) {
    const m = this.mood;
    m.speed01 = isInShip(this.sm.state) ? clamp01(this.sh.speed / SHIP.speedSpace) : clamp01(this.ex.speed / 40);
    // The pulse drive as one number for the painter's streaks: 0 at cruise, rising as the drive
    // spools up (1 from about 6 km/s), falling as it brakes for arrival and after it lets go.
    m.pulse01 = this.pulse ? smoothstep(PULSE.exitSpeed, 6000, this.pulse.v) : Math.max(0, (m.pulse01 || 0) - 0.05);
    if (!active) {
      m.bodyId = null; m.biomeWeights = {}; m.altitude01 = 1; m.inSpace01 = 1;
      return;
    }
    const body = BODIES[active.id];
    const edge = spaceAltitude(body);
    m.bodyId = active.id;
    m.timeOfDay = this.eph.sunHour(active.id, this.t, active.dir);
    m.altitude01 = clamp01(active.altitude / edge);
    m.inSpace01 = smoothstep(edge * 0.75, edge * 1.6, active.altitude);
    if (active.altitude < edge * 2) {
      const s = this.sampler(active.id)(active.dir);
      m.biomeWeights = s.biomeWeights || (s.biomeId ? { [s.biomeId]: 1 } : {});
      m.biomeId = s.biomeId;
    } else m.biomeWeights = {};
  }

  // ---- debug hooks for scripted play-throughs (window.__pc) --------------------------------------
  info() {
    const st = this.sm.state;
    const sh = this.sh, ex = this.ex;
    const out = {
      state: st, history: this.sm.history.slice(-12), t: this.t, body: this.bodyId,
      frame: this.shFrame.kind === 'body' ? `${this.shFrame.id}:${this.shFrame.rotating ? 'ground' : 'orbit'}` : 'helio',
      prompt: this.promptNow ? this.promptNow.text : null,
      view: this.viewKind,
      mood: { ...this.mood, biomeWeights: undefined },
      events: this.events.slice(-6).map((e) => e.type),
    };
    out.explorer = {
      altitude: ex.altitude, speed: ex.speed, vUp: dot(ex.v, norm(ex.p)), fuel: ex.fuel, grounded: ex.grounded,
      mode: ex.mode, liquidDepth: ex.liquidDepth, slope: ex.slope, firstPerson: this.footCam.firstPerson,
      p: ex.p,
    };
    // Where is the ship from the explorer's view? (+ = to the right of where the camera looks)
    const up = norm(ex.p);
    const toShip = tangent(sub(sh.p, ex.p), up, this.footCam.viewFwd);
    out.shipBearingDeg = this.shFrame.kind === 'body' && this.shFrame.id === this.bodyId
      ? Math.atan2(dot(cross(this.footCam.viewFwd, toShip), scale(up, -1)), dot(this.footCam.viewFwd, toShip)) * 180 / Math.PI : null;
    out.shipDistance = len(sub(sh.p, ex.p));
    out.canBoard = st === S.ON_FOOT && this.boardable();
    out.target = this.targetInfo();
    out.aimed = this.aimed;
    out.pulse = this.pulse ? { v: this.pulse.v, block: this.pulse.block, cancel: this.pulse.cancel } : null;
    out.turning = this.turn ? { dest: this.turn.dest, t: this.turn.t } : null;
    out.notice = this.notice ? this.notice.text : null;
    out.visited = Object.fromEntries(Object.entries(this.visited).map(([k, v]) => [k, Object.keys(v.biomes)]));
    out.vistas = Object.fromEntries(Object.entries(this.vistas).map(([k, v]) => [k, Object.keys(v)]));
    out.easel = this.easel ? { id: this.easel.id, phase: this.easel.phase } : null;
    out.easelOffer = this.easelOffer ? this.easelOffer.id : null;
    out.physics = this.physics ? { ms: this.physicsMs, worstMs: this.physicsWorstMs } : null;
    const env = this.flightEnv();
    const f = qRotate(sh.q, V(0, 0, -1));
    out.ship = {
      altGround: sh.altGround, altitude: env.hasBody ? env.altitude : null, spaceAlt: env.hasBody ? env.spaceAlt : null,
      speed: sh.speed, throttle: sh.throttle, bounces: sh.bounces, gear01: sh.gear01,
      pitchDeg: env.up ? Math.asin(clamp(dot(f, env.up), -1, 1)) * 180 / Math.PI : null,
      vUp: env.up ? dot(sh.v, env.up) : null,
      liftoff: !!sh.liftoff, landing: sh.landing ? sh.landing.phase : null, canLand: this.landable(),
      cockpit: this.shipCam.cockpit,
    };
    // Camera clearance above ground and liquid at the camera (for the "never clips" check).
    if (this.camFrame.kind === 'body' && this.camFrame.rotating && this.camPose) {
      const g = floorAt(this.sampler(this.camFrame.id), this.camPose.p);
      out.cameraClearance = g.r - g.floor;
    } else out.cameraClearance = null;
    return out;
  }

  // Direction to a body from the ship, as yaw (right +) and pitch (up +) in degrees off the nose.
  aimAt(bodyId) {
    const fs = frameState(this.eph, this.shFrame, this.t);
    const P = posToUniverse(fs, this.sh.p);
    const d = norm(sub(this.eph.position(bodyId, this.t), P));
    const local = qRotate(qConj(quatToUniverse(fs, this.sh.q)), d);
    return {
      yawDeg: Math.atan2(local.x, -local.z) * 180 / Math.PI,
      pitchDeg: Math.atan2(local.y, Math.hypot(local.x, local.z)) * 180 / Math.PI,
      distance: len(sub(this.eph.position(bodyId, this.t), P)),
    };
  }

  // Teleport: { body, dir:[x,y,z] | lat, lon (degrees), altitude, hour, ship: bool,
  //             pitchDeg (ship nose above the horizon), throttle,
  //             heading, lookPitch (degrees: where the view faces on foot; heading also turns the
  //             ship's nose before pitchDeg), firstPerson }.
  teleport(o = {}) {
    const body = o.body && BODIES[o.body] ? o.body : this.bodyId;
    let dir = null;
    if (o.dir) dir = V(o.dir[0], o.dir[1], o.dir[2]);
    else if (o.lat != null) {
      const la = (o.lat * Math.PI) / 180, lo = ((o.lon || 0) * Math.PI) / 180;
      dir = V(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
    }
    this.spawnOn(body, dir, { hour: o.hour, altitude: o.ship ? 0 : o.altitude });
    if (o.heading != null && !o.ship) {
      // Face a compass heading on foot (degrees from local north toward east), as a painter's
      // easel is described (world.getVistas / findBiome: yaw, pitch).
      const up = norm(this.ex.p);
      const east = tangent(cross(Y, up), up, V(1, 0, 0));
      const north = cross(up, east);
      const a = (o.heading * Math.PI) / 180;
      const fwd = add(scale(north, Math.cos(a)), scale(east, Math.sin(a)));
      this.footCam = createFootCamera(fwd, up);
      this.ex.fwd = tangent(fwd, up);
      if (o.lookPitch != null) this.footCam.pitch = clamp((o.lookPitch * Math.PI) / 180, CAMERA.pitchMin, CAMERA.pitchMax);
    }
    if (o.firstPerson != null && !o.ship) this.footCam.firstPerson = !!o.firstPerson;
    if (o.ship) {
      // Sit in the ship, hovering at the given altitude above the ground.
      const sample = this.sampler(body);
      const up = norm(this.sh.p);
      const g = floorAt(sample, this.sh.p);
      const alt = o.altitude == null ? 40 : o.altitude;
      this.sh.p = scale(up, g.floor + alt);
      this.sh.gear01 = 0;
      if (o.heading != null) {
        // the nose along a compass heading (degrees from local north toward east), level
        const east = tangent(cross(Y, up), up, V(1, 0, 0)), north = cross(up, east), a = (o.heading * Math.PI) / 180;
        this.sh.q = qLook(add(scale(north, Math.cos(a)), scale(east, Math.sin(a))), up);
      }
      const rotating = alt + g.floor - BODIES[body].radius < spaceAltitude(BODIES[body]);
      if (!rotating) {
        const c = convertState(this.eph, this.t, bodyFrame(body, true), bodyFrame(body, false), this.sh);
        this.sh.p = c.p; this.sh.v = V(); this.sh.q = c.q;
      }
      if (o.pitchDeg) {
        const right = qRotate(this.sh.q, V(1, 0, 0));
        this.sh.q = qMul(qFromAxisAngle(right, (o.pitchDeg * Math.PI) / 180), this.sh.q);
      }
      if (o.throttle != null) this.sh.throttle = o.throttle;
      this.shFrame = bodyFrame(body, rotating);
      this.sm.force(rotating ? S.ATMOSPHERE : S.SPACE);
    }
    return this.info();
  }
}
