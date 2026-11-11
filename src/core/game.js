// The presenter: runs the pure simulation (src/core/sim.js) and hands Painter a positioned
// scene every frame.
//
// Per-frame order (COORDINATOR.md C6): simulate in small fixed steps -> camera pose -> place
// the sun and every body root relative to the floating origin (the camera sits at the scene
// origin) -> world.update -> painter.setMood -> painter.render.
import * as THREE from 'three';
import { BODIES, SUN } from '../data/bodies.js';
import { Sim } from './sim.js';
import { S, isInShip } from './state.js';
import { cameraPlanes, farthestExtent } from './depth.js';
import { V } from './vec.js';

export class Game {
  constructor({ scene, camera, world, painter, explorer, ship, input, hud, params }) {
    this.scene = scene; this.camera = camera; this.world = world; this.painter = painter;
    this.explorerModel = explorer; this.shipModel = ship; this.input = input; this.hud = hud;
    const q = params || new URLSearchParams();
    const scratch = new THREE.Vector3();

    scene.add(explorer.object3D);
    scene.add(ship.object3D);
    const ud = ship.object3D.userData || {};
    this.sim = new Sim({
      // The world may hand back its own scratch objects: the sim copies what it needs at once.
      sampleSurface: (bodyId, d) => world.sampleSurface(bodyId, scratch.set(d.x, d.y, d.z)),
      getSpawn: (bodyId) => {
        const sp = world.getSpawn ? world.getSpawn(bodyId) : null;
        return sp && sp.unitDir ? V(sp.unitDir.x, sp.unitDir.y, sp.unitDir.z) : null;
      },
      seat: ud.seat, hatch: ud.hatch,
      body: q.get('body'), hour: q.has('time') ? Number(q.get('time')) : null,
    });
    this._planes = { near: 0, far: 0, fov: 0, aspect: 0 };
    this.frameCount = 0;
    this.started = false;
  }

  frame(realDt) {
    const sim = this.sim;
    const dt = sim.frame(realDt, this.input, this.input.take());
    const v = sim.view(dt);
    const st = sim.sm.state;
    const world = this.world, origin = sim.origin, eph = sim.eph, t = sim.t;

    // Sun and bodies relative to the camera. All the subtraction is done in doubles.
    const items = [{ p: V(), radius: SUN.radius }];
    if (world.sun) {
      const s = origin.toScene(V());
      world.sun.position.set(s.x, s.y, s.z);
      world.sun.updateWorldMatrix(false, false);
    }
    for (const [id, root] of world.bodies) {
      if (!BODIES[id]) continue;
      const P = eph.position(id, t);
      const s = origin.toScene(P);
      const q = eph.orientation(id, t);
      root.position.set(s.x, s.y, s.z);
      root.quaternion.set(q.x, q.y, q.z, q.w);
      root.updateWorldMatrix(false, false);
      items.push({ p: P, radius: BODIES[id].radius });
    }

    // Ship and explorer models.
    const shObj = this.shipModel.object3D, exObj = this.explorerModel.object3D;
    const sp = sim.shipPoseU();
    const ss = origin.toScene(sp.p);
    shObj.position.set(ss.x, ss.y, ss.z);
    shObj.quaternion.set(sp.q.x, sp.q.y, sp.q.z, sp.q.w);
    this.shipModel.animate({
      mode: st === S.PULSE ? 'pulse' : !v.flying ? 'landed' : sim.sh.speed > 12 ? 'fly' : 'hover',
      throttle01: sim.sh.throttle01, gear01: sim.sh.gear01, canopy01: sim.sh.canopy01,
    }, dt);
    exObj.visible = sim.explorerVisible();
    if (st === S.ON_FOOT || st === S.BOARDING) {
      const ep = sim.explorerPoseU();
      const es = origin.toScene(ep.p);
      exObj.position.set(es.x, es.y, es.z);
      exObj.quaternion.set(ep.q.x, ep.q.y, ep.q.z, ep.q.w);
      this.explorerModel.animate({
        mode: sim.ex.mode, speed: sim.ex.speed, jet01: sim.ex.jet01, lookPitch: sim.footCam.pitch,
      }, dt);
    }

    // Camera: always at the scene origin; near and far follow the situation.
    const cam = this.camera;
    cam.position.set(0, 0, 0);
    cam.quaternion.set(v.camQ.x, v.camQ.y, v.camQ.z, v.camQ.w);
    const planes = cameraPlanes(v.view, v.clearance, farthestExtent(v.camU, items));
    const P = this._planes;
    if (Math.abs(planes.near - P.near) > P.near * 0.02 || Math.abs(planes.far - P.far) > P.far * 0.02
        || Math.abs(v.fov - P.fov) > 0.01 || cam.aspect !== P.aspect) {
      cam.near = planes.near; cam.far = planes.far; cam.fov = v.fov;
      P.near = planes.near; P.far = planes.far; P.fov = v.fov; P.aspect = cam.aspect;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    // World, mood, paint.
    world.update(dt, cam.position, v.active ? v.active.id : null);
    this.painter.setMood(sim.mood);
    this.painter.render(this.scene, cam, dt);
    this.updateHud();
    this.frameCount++;
  }

  updateHud() {
    const hud = this.hud, sim = this.sim;
    if (!hud) return;
    const st = sim.sm.state;
    hud.setPrompt(sim.promptNow);
    hud.setFuel(sim.ex.fuel, st === S.ON_FOOT && sim.ex.fuel < 0.995);
    hud.setThrottle(sim.sh.throttle, st === S.ATMOSPHERE || st === S.SPACE);
    hud.setReticle(st === S.ATMOSPHERE || st === S.SPACE || (st === S.ON_FOOT && sim.footCam.firstPerson));
    if (this.frameCount % 6 === 0) {
      // On foot the screen is the painting and nothing else: the place name shows for a few
      // seconds on arrival, then fades. In flight the read-out stays.
      const name = sim.mood.bodyId ? BODIES[sim.mood.bodyId].name : 'deep space';
      const key = name + (isInShip(st) ? '' : ':foot');
      if (key !== this._placeKey) { this._placeKey = key; this._placeAt = sim.t; }
      if (isInShip(st) && st !== S.LANDED) {
        const env = sim.flightEnv();
        const alt = env.sample ? sim.sh.altGround : env.hasBody ? env.altitude : null;
        hud.setReadout(`${name}\n${alt == null ? '' : fmt(alt) + ' up   '}${Math.round(sim.sh.speed)} m/s`, true);
      } else hud.setReadout(name, this.started && sim.t - this._placeAt < 6);
    }
    if (this.input.used && !this.started) { this.started = true; hud.showStart(false); }
  }

  info() {
    return { ...this.sim.info(), near: this.camera.near, far: this.camera.far };
  }
}

function fmt(m) {
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}
