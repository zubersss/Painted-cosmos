// The game: wires input, the state machine, the explorer, the ship, the cameras and the solar
// system together, and hands a positioned scene to Painter every frame.
//
// Per-frame order (COORDINATOR.md C6): simulate in small fixed steps -> place the sun and every
// body root relative to the floating origin (the camera) -> camera -> world.update ->
// painter.setMood -> painter.render.
import * as THREE from 'three';
import { BODIES, SUN } from '../data/bodies.js';
import { Ephemeris, spaceAltitude } from './orbits.js';
import {
  HELIO, bodyFrame, sameFrame, frameState, posToUniverse, quatToUniverse, quatFromUniverse,
  convertState, chooseFrame, bodyLocal, FloatingOrigin, posFromUniverse,
} from './frames.js';
import { StateMachine, S, EV, canBoard, canBeginLanding, promptFor, isInShip } from './state.js';
import { cameraPlanes, farthestExtent } from './depth.js';
import {
  V, add, sub, scale, addScaled, dot, len, norm, cross, tangent, lerp, clamp, clamp01, mix, smoothstep,
  qLook, qRotate, qConj, rotateAround,
} from './vec.js';
import { EXPLORER, createExplorerState, stepExplorer } from '../player/explorer.js';
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

export class Game {
  constructor({ scene, camera, world, painter, explorer, ship, input, hud, params }) {
    this.scene = scene; this.camera = camera; this.world = world; this.painter = painter;
    this.explorerModel = explorer; this.shipModel = ship; this.input = input; this.hud = hud;
    this.params = params || new URLSearchParams();

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
    this.view = 'foot';
    this._vec = new THREE.Vector3();
    this._samplers = {};
    this._planes = { near: 0, far: 0, fov: 0, aspect: 0 };
    this.mood = { bodyId: 'earth', biomeWeights: {}, timeOfDay: 12, altitude01: 0, inSpace01: 0, speed01: 0 };

    scene.add(explorer.object3D);
    scene.add(ship.object3D);
    this.seat = ship.object3D.userData.seat ? V(ship.object3D.userData.seat.x, ship.object3D.userData.seat.y, ship.object3D.userData.seat.z) : V(0, 2.2, -1.2);
    this.hatch = ship.object3D.userData.hatch ? V(ship.object3D.userData.hatch.x, ship.object3D.userData.hatch.y, ship.object3D.userData.hatch.z) : V(-2.7, 0, -0.9);

    const start = this.params.get('body') && BODIES[this.params.get('body')] ? this.params.get('body') : 'earth';
    this.spawnOn(start, null, { hour: this.params.has('time') ? Number(this.params.get('time')) : FEEL.startHour });
  }

  // ---- world access ------------------------------------------------------------------------
  // sampleSurface for one body, as plain numbers (the result is copied at once, so the world
  // may reuse its own scratch objects).
  sampler(bodyId) {
    if (this._samplers[bodyId]) return this._samplers[bodyId];
    const world = this.world, v = this._vec;
    const fn = (dir) => {
      const s = world.sampleSurface(bodyId, v.set(dir.x, dir.y, dir.z));
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
    if (!d) {
      const sp = this.world.getSpawn ? this.world.getSpawn(bodyId) : null;
      d = sp && sp.unitDir ? V(sp.unitDir.x, sp.unitDir.y, sp.unitDir.z) : V(0.3, 0.4, 0.86);
    }
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
  frame(realDt) {
    const inp = this.input.take();
    const simDt = Math.min(realDt, FEEL.maxFrame) * this.timeScale;
    const steps = Math.max(1, Math.ceil(simDt / FEEL.simStep - 1e-6));
    const h = simDt / steps;
    for (let i = 0; i < steps; i++) this.step(h, inp, i === 0);
    this.present(simDt);
    this.frameCount++;
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
      upWeight: 1 - smoothstep(spaceAlt * 1.6, soiAlt * 0.9, altitude),
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
        if (beginLanding(sh, this.sampler(this.shFrame.id))) this.sm.dispatch(EV.beginLanding);
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
    return updateFootCamera(this.footCam, this.ex.p, dt, this.sampler(this.bodyId));
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

  // ---- present: place everything, then let Painter paint -------------------------------------------
  present(dt) {
    const st = this.sm.state;
    const eph = this.eph, t = this.t;

    // Camera pose in its own frame.
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
    this.camPose = pose; this.camFrame = frame; this.view = view;

    const fsCam = frameState(eph, frame, t);
    const camU = posToUniverse(fsCam, pose.p);
    const camQ = quatToUniverse(fsCam, pose.q);
    this.origin.set(camU);

    // Sun and bodies, relative to the camera, in doubles.
    const items = [{ p: V(), radius: SUN.radius }];
    const world = this.world;
    if (world.sun) {
      const s = this.origin.toScene(V());
      world.sun.position.set(s.x, s.y, s.z);
      world.sun.updateWorldMatrix(false, false);
    }
    for (const [id, root] of world.bodies) {
      if (!BODIES[id]) continue;
      const P = eph.position(id, t);
      const s = this.origin.toScene(P);
      const q = eph.orientation(id, t);
      root.position.set(s.x, s.y, s.z);
      root.quaternion.set(q.x, q.y, q.z, q.w);
      root.updateWorldMatrix(false, false);
      items.push({ p: P, radius: BODIES[id].radius });
    }

    // Explorer and ship models.
    const exObj = this.explorerModel.object3D, shObj = this.shipModel.object3D;
    const fsShip = frameState(eph, this.shFrame, t);
    const shU = this.origin.toScene(posToUniverse(fsShip, this.sh.p));
    const shQ = quatToUniverse(fsShip, this.sh.q);
    shObj.position.set(shU.x, shU.y, shU.z);
    shObj.quaternion.set(shQ.x, shQ.y, shQ.z, shQ.w);
    const flying = st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE || st === S.LANDING;
    this.shipModel.animate({
      mode: st === S.PULSE ? 'pulse' : !flying ? 'landed' : this.sh.speed > 12 ? 'fly' : 'hover',
      throttle01: this.sh.throttle01, gear01: this.sh.gear01, canopy01: this.sh.canopy01,
    }, dt);

    const exVisible = st === S.ON_FOOT ? !this.footCam.firstPerson
      : st === S.BOARDING && this.transition ? (this.transition.dir === 'in' ? this.transition.t / this.transition.dur < 0.72 : true) : false;
    exObj.visible = exVisible;
    if (st === S.ON_FOOT || st === S.BOARDING) {
      const fsBody = frameState(eph, bodyFrame(this.bodyId, true), t);
      const eU = this.origin.toScene(posToUniverse(fsBody, this.ex.p));
      const eQ = quatToUniverse(fsBody, qLook(this.ex.fwd, norm(this.ex.p)));
      exObj.position.set(eU.x, eU.y, eU.z);
      exObj.quaternion.set(eQ.x, eQ.y, eQ.z, eQ.w);
      this.explorerModel.animate({
        mode: this.ex.mode, speed: this.ex.speed, jet01: this.ex.jet01, lookPitch: this.footCam.pitch,
      }, dt);
    }

    // Camera: always at the scene origin.
    const cam = this.camera;
    cam.position.set(0, 0, 0);
    cam.quaternion.set(camQ.x, camQ.y, camQ.z, camQ.w);
    const active = this.activeBody(camU);
    // Empty air around the camera: only counted in free flight (never while landed or boarding).
    let clearance = 0;
    if (flying && st !== S.LANDING) {
      clearance = this.shFrame.kind === 'body' && this.shFrame.rotating ? this.sh.altGround
        : active ? Math.max(0, active.altitude) : 1e6;
    }
    const planes = cameraPlanes(view, clearance, farthestExtent(camU, items));
    const P = this._planes;
    if (Math.abs(planes.near - P.near) > P.near * 0.02 || Math.abs(planes.far - P.far) > P.far * 0.02 || Math.abs(pose.fov - P.fov) > 0.01 || cam.aspect !== P.aspect) {
      cam.near = planes.near; cam.far = planes.far; cam.fov = pose.fov;
      P.near = planes.near; P.far = planes.far; P.fov = pose.fov; P.aspect = cam.aspect;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    // World, mood, paint.
    world.update(dt, cam.position, active ? active.id : null);
    this.updateMood(active, camU);
    this.painter.setMood(this.mood);
    this.painter.render(this.scene, cam, dt);
    this.updateHud();
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

  updateMood(active, camU) {
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

  updateHud() {
    const hud = this.hud;
    if (!hud) return;
    const st = this.sm.state;
    const q = { canBoard: st === S.ON_FOOT && this.boardable(), canLand: this.landable(), liftingOff: !!this.sh.liftoff };
    this.promptNow = promptFor(st, q);
    hud.setPrompt(this.promptNow);
    hud.setFuel(this.ex.fuel, st === S.ON_FOOT && this.ex.fuel < 0.995);
    hud.setThrottle(this.sh.throttle, st === S.ATMOSPHERE || st === S.SPACE);
    hud.setReticle(st === S.ATMOSPHERE || st === S.SPACE || (st === S.ON_FOOT && this.footCam.firstPerson));
    if (this.frameCount % 6 === 0) {
      const name = this.mood.bodyId ? BODIES[this.mood.bodyId].name : 'deep space';
      if (isInShip(st) && st !== S.LANDED) {
        const env = this.flightEnv();
        const alt = env.sample ? this.sh.altGround : env.hasBody ? env.altitude : null;
        hud.setReadout(`${name}\n${alt == null ? '' : fmt(alt) + ' up   '}${Math.round(this.sh.speed)} m/s`);
      } else hud.setReadout(name);
    }
    if (this.input.used && !this._started) { this._started = true; hud.showStart(false); }
  }

  // ---- debug hooks for scripted play-throughs (window.__pc) --------------------------------------
  info() {
    const st = this.sm.state;
    const sh = this.sh, ex = this.ex;
    const out = {
      state: st, history: this.sm.history.slice(-12), t: this.t, body: this.bodyId,
      frame: this.shFrame.kind === 'body' ? `${this.shFrame.id}:${this.shFrame.rotating ? 'ground' : 'orbit'}` : 'helio',
      prompt: this.promptNow ? this.promptNow.text : null,
      view: this.view,
      mood: { ...this.mood, biomeWeights: undefined },
      events: this.events.slice(-6).map((e) => e.type),
      near: this.camera.near, far: this.camera.far,
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

  // Teleport: { body, dir:[x,y,z] | lat, lon (degrees), altitude, hour, ship: bool }.
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
      this.shFrame = bodyFrame(body, rotating);
      this.sm.force(rotating ? S.ATMOSPHERE : S.SPACE);
    }
    return this.info();
  }
}

function fmt(m) {
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}
