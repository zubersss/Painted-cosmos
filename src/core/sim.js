// The simulation: the state machine, the explorer, the ship, the cameras and the solar system,
// with no three and no DOM. src/core/game.js presents it; tests/loop.test.mjs plays the whole
// loop through it in Node.
import { BODIES } from '../data/bodies.js';
import { Ephemeris, spaceAltitude } from './orbits.js';
import {
  HELIO, bodyFrame, sameFrame, frameState, posToUniverse, quatToUniverse, quatFromUniverse,
  convertState, chooseFrame, FloatingOrigin, posFromUniverse,
} from './frames.js';
import { StateMachine, S, EV, canBoard, canBeginLanding, promptFor, isInShip } from './state.js';
import {
  V, add, sub, scale, addScaled, dot, len, norm, cross, tangent, lerp, clamp, clamp01, mix, smoothstep,
  qLook, qRotate, qConj, qMul, qFromAxisAngle, rotateAround,
} from './vec.js';
import { EXPLORER, createExplorerState, stepExplorer, collideObstacles } from '../player/explorer.js';
import {
  CAMERA, createFootCamera, lookFootCamera, updateFootCamera, createShipCamera, updateShipCamera, blendPose,
} from '../player/camera.js';
import {
  SHIP, stepFlight, beginLiftoff, beginLanding, stepLanding, stepLanded, restOnSurface, floorAt,
} from '../ship/flight.js';

export const FEEL = Object.freeze({
  mouseFoot: 0.0023,         // rad per pixel on foot
  mouseShip: 0.0017,         // rad per pixel in the ship (the nose follows with a little weight)
  boardSeconds: 1.25,        // walking up the hatch and sitting down
  exitSeconds: 0.95,
  simStep: 1 / 60,           // fixed physics step (the feel is identical at any frame rate)
  maxFrame: 0.25,            // seconds of real time simulated per frame at most
  startHour: 9.5,            // local solar time at the first spawn: a clear morning
});

const Y = V(0, 1, 0);

export class Sim {
  // sampleSurface(bodyId, {x,y,z}) -> contract surface;  getSpawn(bodyId) -> {x,y,z} or null;
  // seat / hatch: ship-local points from the ship model (COORDINATOR.md C10).
  // sampleObstacles(bodyId, {x,y,z}, radius) -> [{ unitDir, radius, height }] (optional).
  constructor({ sampleSurface, getSpawn, sampleObstacles, seat, hatch, body, hour }) {
    this.sampleSurface = sampleSurface;
    this.sampleObstacles = sampleObstacles || null;
    this.nearObstacles = [];
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
    this.frameCount++;
    return simDt;
  }

  // ---- simulation step -----------------------------------------------------------------------
  step(h, inp, first) {
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
      }, h, { sample: this.sampler(this.bodyId), gravity: BODIES[this.bodyId].gravity });
      // Trunks and boulders: looked up once a frame around the explorer, hit every step.
      if (first) this.nearObstacles = this.obstaclesNear(this.bodyId, this.ex.p, 9);
      if (collideObstacles(this.ex, this.nearObstacles) && this.ex.grounded) {
        // Pushed sideways on sloping ground: put the feet back on it.
        const d = norm(this.ex.p);
        this.ex.p = scale(d, Math.max(len(this.ex.p), this.sampler(this.bodyId)(d).radius));
      }
      if (pressed('KeyE') && this.boardable()) this.beginBoarding();
    } else if (st === S.BOARDING) {
      this.stepBoarding(h);
    } else if (st === S.LANDED) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      stepLanded(this.sh, h);
      this.sh.canopy01 = mix(this.sh.canopy01, 0, 1 - Math.exp(-4 * h));
      if (pressed('Space')) {
        beginLiftoff(this.sh);
        this.sm.dispatch(EV.liftoff);
        this.emit('liftoff');
      } else if (pressed('KeyE')) this.beginExit();
    } else if (st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      this.stepFlying(h, I, mdx, mdy, pressed);
    } else if (st === S.LANDING) {
      if (first && inp.edges.has('KeyV')) this.shipCam.cockpit = !this.shipCam.cockpit;
      const r = stepLanding(this.sh, h, this.sampler(this.shFrame.id));
      if (r === 'touchdown') {
        this.bodyId = this.shFrame.id;
        this.sm.dispatch(EV.touchdown);
        this.emit('touchdown');
      } else if (pressed('Space') || pressed('KeyW')) {
        this.sh.landing = null;
        this.sm.dispatch(EV.abortLanding);
      }
    }
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

  emit(type) { this.events.push({ type, t: this.t }); if (this.events.length > 40) this.events.shift(); }

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
    this.footCam = createFootCamera(rotateAround(away, up, 0.5), up);
    this.footCam.firstPerson = false;
    this.transition = { t: 0, dur: FEEL.exitSeconds, dir: 'out', from: this.camPose };
  }

  stepBoarding(h) {
    const T = this.transition;
    if (!T) { this.sm.force(this.sm.ctx.boardingDir === 'out' ? S.ON_FOOT : S.LANDED); return; }
    T.t = Math.min(T.dur, T.t + h);
    const k = T.t / T.dur;
    stepLanded(this.sh, h);
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
  flightEnv() {
    const f = this.shFrame;
    if (f.kind !== 'body') {
      return { up: null, universeUp: Y, upWeight: 0, altitude: 1e9, spaceAlt: 1, hasBody: false, sample: null };
    }
    const body = BODIES[f.id];
    const r = len(this.sh.p);
    const spaceAlt = spaceAltitude(body);
    const altitude = r - body.radius;
    const soiAlt = this.eph.soiRadius(f.id) - body.radius;
    return {
      up: scale(this.sh.p, 1 / r),
      universeUp: f.rotating ? qRotate(qConj(this.eph.orientation(f.id, this.t)), Y) : Y,
      // Inside a body's sphere of influence "up" is simply away from the body; it eases to
      // the ecliptic's up only in the outer third, on the way out to open space.
      upWeight: 1 - smoothstep(soiAlt * 0.68, soiAlt, altitude),
      altitude, spaceAlt, hasBody: true,
      sample: f.rotating ? this.sampler(f.id) : null,
    };
  }

  stepFlying(h, I, mdx, mdy, pressed) {
    const sh = this.sh;
    // Which frame are we flying in? (ground frame in the atmosphere, body-centred in orbit,
    // the sun's frame between worlds). State changes follow the frame.
    if (!sh.liftoff) {
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
    const env = this.flightEnv();
    stepFlight(sh, {
      aimX: mdx * FEEL.mouseShip,
      aimY: mdy * FEEL.mouseShip,
      yawKey: I.axis('KeyA', 'KeyD') + I.axis('ArrowLeft', 'ArrowRight'),
      throttle: I.axis('KeyS', 'KeyW') + I.axis('ArrowDown', 'ArrowUp'),
      cut: I.down('KeyX'),
      lift: (I.down('Space') ? 1 : 0) - (I.down('KeyC') ? 1 : 0),
    }, h, env);
    if (sh.bounce === 0) this.emit('bounce');

    if (this.sm.state === S.ATMOSPHERE && !sh.liftoff) {
      // E lands. So does simply sinking onto the ground: nobody should have to hunt for a key.
      const settle = sh.altGround < SHIP.minClearance + 1.2 && sh.speed < 5 && I.down('KeyC');
      if ((pressed('KeyE') && this.landable()) || settle) {
        const trees = this.obstaclesNear(this.shFrame.id, sh.p, 80);
        if (beginLanding(sh, this.sampler(this.shFrame.id), undefined, trees)) this.sm.dispatch(EV.beginLanding);
        else this.emit('too-steep');
      }
    }
  }

  landable() {
    return this.shFrame.kind === 'body' && this.shFrame.rotating && !this.sh.liftoff
      && canBeginLanding(this.sm.state, this.sh.altGround, this.sh.speed);
  }

  // ---- camera ------------------------------------------------------------------------------------
  footPose(dt) {
    // The parked ship is the one solid thing besides the ground: keep the camera out of it.
    let hull = null;
    if (this.shFrame.kind === 'body' && this.shFrame.rotating && this.shFrame.id === this.bodyId
        && len(sub(this.sh.p, this.ex.p)) < 40) {
      hull = [-2.9, 0, 2.9].map((z) => ({ p: add(this.sh.p, qRotate(this.sh.q, V(0, 1.7, z))), radius: 2.2 }));
    }
    // Trunks between the camera and the explorer pull the boom in as well.
    if (this.nearObstacles.length) {
      const r = len(this.ex.p) + CAMERA.pivotHeight;
      const trunks = this.nearObstacles.filter((o) => o.height > CAMERA.pivotHeight).map((o) => ({ p: scale(o.unitDir, r), radius: o.radius + 0.3 }));
      hull = hull ? hull.concat(trunks) : trunks;
    }
    return updateFootCamera(this.footCam, this.ex.p, dt, this.sampler(this.bodyId), undefined, hull);
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
    const q = { canBoard: st === S.ON_FOOT && this.boardable(), canLand: this.landable(), liftingOff: !!this.sh.liftoff };
    this.promptNow = promptFor(st, q);
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
    if (st === S.ON_FOOT) return !this.footCam.firstPerson;
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
  //             pitchDeg (ship nose above the horizon), throttle }.
  teleport(o = {}) {
    const body = o.body && BODIES[o.body] ? o.body : this.bodyId;
    let dir = null;
    if (o.dir) dir = V(o.dir[0], o.dir[1], o.dir[2]);
    else if (o.lat != null) {
      const la = (o.lat * Math.PI) / 180, lo = ((o.lon || 0) * Math.PI) / 180;
      dir = V(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
    }
    this.spawnOn(body, dir, { hour: o.hour, altitude: o.ship ? 0 : o.altitude });
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
