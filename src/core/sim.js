// The simulation: the state machine, the explorer, the ship, the cameras and the solar system,
// with no three and no DOM. src/core/game.js presents it; tests/loop.test.mjs plays the whole
// loop through it in Node.
import { BODIES, SUN } from '../data/bodies.js';
import { Ephemeris, spaceAltitude } from './orbits.js';
import {
  HELIO, bodyFrame, sameFrame, frameState, posToUniverse, quatToUniverse, quatFromUniverse,
  convertState, chooseFrame, FloatingOrigin, posFromUniverse,
} from './frames.js';
import { StateMachine, S, EV, canBoard, canBeginLanding, promptFor, isInShip, LAND_PROMPT_ALTITUDE } from './state.js';
import {
  V, add, sub, scale, addScaled, dot, len, norm, cross, tangent, lerp, clamp, clamp01, mix, smoothstep,
  qLook, qRotate, qConj, qMul, qFromAxisAngle, rotateAround,
} from './vec.js';
import { EXPLORER, createExplorerState, stepExplorer, collideObstacles, scrambleSample } from '../player/explorer.js';
import {
  CAMERA, createFootCamera, lookFootCamera, updateFootCamera, createShipCamera, updateShipCamera, blendPose, boomRoom,
} from '../player/camera.js';
import {
  SHIP, stepFlight, beginLiftoff, beginLanding, stepLanding, stepLanded, restOnSurface, floorAt,
} from '../ship/flight.js';
import { PULSE, arrivalRadius, createPulse, pulseAdvice, stepPulseSpeed, pulseEta } from '../ship/pulse.js';

export const FEEL = Object.freeze({
  mouseFoot: 0.0023,         // rad per pixel on foot
  mouseShip: 0.0017,         // rad per pixel in the ship (the nose follows with a little weight)
  boardSeconds: 1.25,        // walking up the hatch and sitting down
  exitSeconds: 0.95,
  simStep: 1 / 60,           // fixed physics step (the feel is identical at any frame rate)
  maxFrame: 0.25,            // seconds of real time simulated per frame at most
  startHour: 9.5,            // local solar time at the first spawn: a clear morning
});

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const Y = V(0, 1, 0);
// Touchdown on the legs: where the assist hands the hull to the landing gear (m over the
// ground) and how fast the gear lets it down (m/s; PHYSICS' recipe).
export const LEGS = Object.freeze({ gearAt: 1.0, sink: 0.6 });
export const VISTA_RANGE = 14;      // metres: this close to a vista's spot, on foot, and it is yours
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
    this.notice = null;            // { text, until } one line of feedback for the HUD
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
    this.mood = { bodyId: 'earth', biomeWeights: {}, timeOfDay: 12, altitude01: 0, inSpace01: 0, speed01: 0 };
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
    if (opts.hour != null) this.eph.setLocalSolarTime(bodyId, this.t, d, opts.hour);
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
      const score = g.slope + (g.liquid ? 2 : 0) + Math.abs(g.floor - s.radius) * 0.03;
      if (!best || score < best.score) best = { score, dir: cd, off };
    }
    const toShip = tangent(best.off, d);
    this.bodyId = bodyId;
    this.ex = createExplorerState(feet, toShip);
    this.ex.grounded = !(opts.altitude > 0);
    // Look a little to the side of the ship so both it and the landscape are in frame.
    this.footCam = createFootCamera(rotateAround(toShip, d, 0.45), d);
    if (face) {
      // PAINTER's request: arrive facing the way the picture was painted (yaw from north toward east).
      const fwd = add(scale(north, Math.cos(face.yaw)), scale(east, Math.sin(face.yaw)));
      this.footCam = createFootCamera(fwd, d);
      if (face.pitch != null) this.footCam.pitch = clamp(face.pitch, CAMERA.pitchMin, CAMERA.pitchMax);
    }
    this.sh = restOnSurface(sample, best.dir, rotateAround(toShip, d, -1.9));
    this.shFrame = bodyFrame(bodyId, true);
    this.shipCam = createShipCamera();
    this.transition = null;
    this.sm.force(S.ON_FOOT);
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
    this.updatePhysics(simDt);
    this.noteVisit();
    this.checkVistas();
    this.frameCount++;
    return simDt;
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

    if (st === S.ON_FOOT) {
      if (first && inp.edges.has('KeyV')) this.footCam.firstPerson = !this.footCam.firstPerson;
      if (first && inp.wheel) this.footCam.boom = clamp(this.footCam.boom + inp.wheel * 0.8, CAMERA.boomMin, CAMERA.boomMax);
      lookFootCamera(this.footCam, norm(this.ex.p), mdx * FEEL.mouseFoot, mdy * FEEL.mouseFoot);
      stepExplorer(this.ex, {
        moveX: I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight'),
        moveZ: I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp'),
        run: I.down('ShiftLeft') || I.down('ShiftRight'),
        jump: pressed('Space'),
        jet: I.down('Space'),
        viewFwd: this.footCam.viewFwd,
        faceView: this.footCam.firstPerson,
      }, h, this.explorerEnv(this.bodyId));
      // Trunks and boulders: looked up once a frame around the explorer, hit every step.
      if (first) this.nearObstacles = this.obstaclesNear(this.bodyId, this.ex.p, 9);
      const moving = I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight') !== 0 || I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp') !== 0;
      if (collideObstacles(this.ex, this.nearObstacles, undefined, { moving, dt: h }) && this.ex.grounded) {
        // Pushed sideways on sloping ground: put the feet back on it.
        const d = norm(this.ex.p);
        this.ex.p = scale(d, Math.max(len(this.ex.p), this.explorerEnv(this.bodyId).sample(d).radius));
      }
      if (this.shFrame.kind === 'body' && this.shFrame.rotating) this.stepParked(h);     // the ship waits on its gear
      if (pressed('KeyE') && this.boardable()) this.beginBoarding();
    } else if (st === S.BOARDING) {
      this.stepBoarding(h);
    } else if (st === S.LANDED) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      this.stepParked(h);
      this.sh.canopy01 = mix(this.sh.canopy01, 0, 1 - Math.exp(-4 * h));
      if (pressed('Space')) {
        this.sh.gearOn = false;
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
    } else stepLanded(sh, h);
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
          .map((v) => ({ id: String(v.id), name: v.name || 'a view', dir: norm(V(v.unitDir.x, v.unitDir.y, v.unitDir.z)) }));
      } catch { list = []; }
    }
    this._vistaList[bodyId] = list;
    return list;
  }

  // Walking up to a vista finds it (within VISTA_RANGE metres of its spot, on foot).
  checkVistas() {
    if (this.sm.state !== S.ON_FOOT) return;
    const list = this.vistasOf(this.bodyId);
    if (!list.length) return;
    const found = this.vistas[this.bodyId] || (this.vistas[this.bodyId] = {});
    const r = len(this.ex.p), up = scale(this.ex.p, 1 / r);
    for (const v of list) {
      if (found[v.id]) continue;
      const d = Math.acos(Math.min(1, dot(up, v.dir))) * r;
      if (d < VISTA_RANGE) {
        found[v.id] = true;
        this.say('A view for the sketchbook: ' + v.name, 6);
        this.emit('vista');
        if (this.onVistaFound) this.onVistaFound(this.bodyId, v.id);
      }
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
    this.transition = { t: 0, dur: FEEL.boardSeconds, dir: 'in', from: this.camPose, exFrom: { ...this.ex.p }, exTo: this.hatchPoint() };
    this.shipCam.q = null;
    this.ex.v = V();
  }

  beginExit() {
    if (!this.sm.dispatch(EV.exit)) return;
    const hp = this.hatchPoint();
    const up = norm(hp);
    // Step out facing away from the hull.
    const away = tangent(sub(hp, this.sh.p), up, qRotate(this.sh.q, V(-1, 0, 0)));
    this.ex = createExplorerState(hp, away);
    this.ex.fuel = 1;
    this.bodyId = this.shFrame.id;
    // The view: as near to "half over the shoulder, away from the ship" as leaves the boom
    // room. Straight away from the hull puts the camera inside it (a boom of 0.8 m: the back
    // of a helmet); so turn the view along the hull, either way, until the boom is free.
    const solid = this.cameraSolids(hp);
    let best = 0.5, room = -1;
    for (const a of [0.5, -0.5, 0.95, -0.95, 1.4, -1.4, 1.85, -1.85, 2.4, -2.4, Math.PI]) {
      const r = boomRoom(hp, rotateAround(away, up, a), -0.12, solid);
      if (r > room + 0.05) { room = r; best = a; }
      if (r >= CAMERA.boom - 0.05) break;
    }
    this.footCam = createFootCamera(rotateAround(away, up, best), up);
    this.footCam.firstPerson = false;
    this.transition = { t: 0, dur: FEEL.exitSeconds, dir: 'out', from: this.camPose };
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
      this.sh.canopy01 = Math.sin(Math.PI * clamp01(k)) ** 0.7;
      if (k >= 1) { this.transition = null; this.sh.canopy01 = 0; this.sm.dispatch(EV.steppedOut); }
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
      env.speedScale = clamp(Math.pow(1.225 / Math.max(rho0, 0.02), 0.4), 0.75, 3);
      // The drive field turns the velocity onto the nose with at most this sideways acceleration,
      // so thin-air worlds turn wide at their speed; and where the air cannot stop the ship, X
      // has a little of the field brake (stops from 138 m/s in about 4 s).
      env.carveAccel = 40;
      env.airBrake = rho0 < 0.3 ? 0.15 : 0;
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
    if (this.sm.state === S.ATMOSPHERE && !inAtmo) { this.sm.dispatch(EV.leftAtmosphere); this.emit('space'); }
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
    if (this.sm.state === S.SPACE && pressed('KeyF')) this.tryPulse();
    else if (this.sm.state === S.PULSE && this.pulse) {
      const ps = this.pulse;
      if (pressed('KeyF') || pressed('KeyX') || pressed('KeyS') || pressed('Space')) ps.cancel = true;
      let f = qRotate(sh.q, V(0, 0, -1));
      // Draw the nose onto the target, so "point roughly and go" arrives.
      if (this.target && !ps.cancel) {
        const want = norm(sub(this.bodyInShipFrame(this.target), sh.p));
        const axis = cross(f, want);
        const sinA = len(axis);
        const ang = Math.atan2(sinA, dot(f, want));
        if (sinA > 1e-6 && ang < 1.2) {
          sh.q = qMul(qFromAxisAngle(scale(axis, 1 / sinA), Math.min(ang, PULSE.assistRate * h)), sh.q);
          f = qRotate(sh.q, V(0, 0, -1));
        }
      }
      const adv = pulseAdvice(sh.p, f, this.pulseSpheres());
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
          this.say(`${BODIES[adv.block].name} ahead`, 5);
          if (adv.block === this.target) this.targetLocked = false;
          this.emit('arrived');
        } else this.emit('pulse-off');
      }
    }

    // Tree tops under and ahead of a low-flying ship (looked up once a frame).
    if (env.floor) {
      if (this._firstStep && sh.altGround < 90) this.canopy = this.obstaclesNear(this.shFrame.id, sh.p, Math.min(45, 20 + sh.speed * 0.6));
      else if (sh.altGround >= 90) this.canopy = [];
    } else this.canopy = [];

    stepFlight(sh, {
      aimX: mdx * FEEL.mouseShip,
      aimY: mdy * FEEL.mouseShip,
      yawKey: I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight'),
      throttle: I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp'),
      cut: I.down('KeyX'),
      lift: this.sm.state === S.PULSE ? 0 : (I.down('Space') ? 1 : 0) - (I.down('KeyC') ? 1 : 0),
    }, h, env);
    if (sh.bounce === 0) this.emit('bounce');

    if (this.sm.state === S.ATMOSPHERE && !sh.liftoff) {
      // E lands. So does simply sinking onto the ground: nobody should have to hunt for a key.
      const settle = sh.altGround < SHIP.minClearance + 1.2 && sh.speed < 5 && I.down('KeyC');
      if ((pressed('KeyE') && this.landable()) || settle) {
        const trees = this.obstaclesNear(this.shFrame.id, sh.p, 80);
        // With PHYSICS, a site is good when the ground's friction will hold the parked ship.
        const id = this.shFrame.id;
        const holds = this.physics ? (dir, g) => {
          const G = this.physics.ground(id, dir, this._ground || (this._ground = {}));
          return Math.tan(g.slope) < 0.8 * (G.friction || 0.6);
        } : null;
        if (beginLanding(sh, this.sampler(id), undefined, trees, holds, settle)) { this.canopy = []; this.sm.dispatch(EV.beginLanding); }
        else { this.say('Too steep to land here'); this.emit('too-steep'); }
      } else if (pressed('KeyE')) {
        // E without the prompt: never silence. Say what the landing is waiting for.
        this.say(sh.altGround > LAND_PROMPT_ALTITUDE ? `Come down below ${LAND_PROMPT_ALTITUDE} m to land` : 'Slow down to land');
      }
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
    return updateFootCamera(this.footCam, this.ex.p, dt, this.sampler(this.bodyId), undefined, this.cameraSolids(this.ex.p, this.nearObstacles));
  }

  shipPose(dt) {
    const env = this.flightEnv();
    const up = env.up ? norm(lerp(env.universeUp, env.up, clamp01(env.upWeight)), env.up) : env.universeUp;
    const speed01 = clamp01(this.sh.speed / SHIP.speedSpace);
    return updateShipCamera(this.shipCam, this.sh, dt, {
      upRef: up, level01: mix(0.55, 1, clamp01(env.upWeight)), speed01, seat: this.seat,
      sample: env.sample, toLocal: env.sample ? (p) => p : null,
    });
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
    const q = {
      canBoard: st === S.ON_FOOT && this.boardable(), canLand: this.landable(), liftingOff: !!this.sh.liftoff,
      target: ti ? ti.name : null,
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
    if (!active) {
      m.bodyId = null; m.biomeWeights = {}; m.altitude01 = 1; m.inSpace01 = 1;
      return;
    }
    const body = BODIES[active.id];
    const edge = spaceAltitude(body);
    m.bodyId = active.id;
    m.timeOfDay = this.eph.localSolarTime(active.id, this.t, active.dir);
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
    out.notice = this.notice ? this.notice.text : null;
    out.visited = Object.fromEntries(Object.entries(this.visited).map(([k, v]) => [k, Object.keys(v.biomes)]));
    out.vistas = Object.fromEntries(Object.entries(this.vistas).map(([k, v]) => [k, Object.keys(v)]));
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
  //             heading, lookPitch (degrees: where the view faces on foot), firstPerson }.
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
