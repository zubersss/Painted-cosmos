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
import { pulseEta, arrivalRadius } from '../ship/pulse.js';

const NO_KEYS = { down: () => false, axis: () => 0 };
const NO_EVENTS = { edges: new Set(), dx: 0, dy: 0, wheel: 0 };

export class Game {
  constructor({ renderer, scene, camera, world, painter, explorer, ship, input, hud, map, book, audio, params, physics, autosave, dyn }) {
    this.book = book || null; this.audio = audio || null; this._eventSeq = 0; this._promptKey = '';
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.world = world; this.painter = painter;
    this.explorerModel = explorer; this.shipModel = ship; this.input = input; this.hud = hud;
    this.map = map || null; this.autosave = autosave || null; this.dyn = dyn || null;
    this.showStats = false;
    this.stats = { frameMs: 16.7, worstMs: 0, worldMs: 0, tris: 0, calls: 0, window: [] };
    this.uiNotice = null; this.uiNoticeUntil = 0;
    this._marks = []; this._p = new THREE.Vector3();
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
      sampleObstacles: world.sampleObstacles ? (bodyId, d, radius) => world.sampleObstacles(bodyId, scratch.set(d.x, d.y, d.z), radius) : null,
      physics: physics || null,
      getVistas: world.getVistas ? (bodyId) => world.getVistas(bodyId) : null,
      seat: ud.seat, hatch: ud.hatch,
      body: q.get('body'), hour: q.has('time') ? Number(q.get('time')) : null,
    });
    this.sim.onVistaFound = (bodyId, id) => { if (world.setVistaFound) world.setVistaFound(bodyId, id, true); };
    this._planes = { near: 0, far: 0, fov: 0, aspect: 0 };
    this.frameCount = 0;
    this.started = false;
    this.canStart = true;          // false while the title card is still waiting for the first view
  }

  frame(realDt) {
    const sim = this.sim;
    const raw = this.input.take();
    // Keys that belong to the interface, not to the explorer or the ship.
    if (this.audio && this.input.used) this.audio.start();
    if (raw.edges.has('KeyM')) { if (this.book && this.book.open) this.book.hide(); this.toggleMap(); }
    if (raw.edges.has('KeyB')) { if (this.map && this.map.open) this.map.hide(); this.toggleBook(); }
    if (raw.edges.has('KeyH') && this.started) {
      this.hud.showStart(!this.hud.startShown);
      if (this.hud.setStartStatus) this.hud.setStartStatus('H closes this card');
      if (this.audio) this.audio.event('paper');
    }
    if (raw.edges.has('Backquote')) this.showStats = !this.showStats;
    let keys = this.input, events = raw;
    const panel = (this.map && this.map.open) || (this.book && this.book.open);
    if (this.map && this.map.open) {
      if (raw.edges.has('ArrowRight') || raw.edges.has('ArrowDown')) this.map.step(1);
      if (raw.edges.has('ArrowLeft') || raw.edges.has('ArrowUp')) this.map.step(-1);
      if (raw.edges.has('Enter') || raw.edges.has('Escape')) this.toggleMap();
    } else if (this.book && this.book.open && (raw.edges.has('Enter') || raw.edges.has('Escape'))) this.toggleBook();
    if (panel) { keys = NO_KEYS; events = NO_EVENTS; }          // the world goes on; the hands are on the page
    if (this.input.message) {
      this.uiNotice = this.input.message; this.uiNoticeUntil = performance.now() + 9000;
      this.input.message = null;
    }
    const st0 = this.stats;
    st0.window.push(realDt * 1000);
    if (st0.window.length > 90) st0.window.shift();
    st0.frameMs += (realDt * 1000 - st0.frameMs) * 0.08;
    const dt = sim.frame(realDt, keys, events);
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
    // The air is there: PHYSICS' buffet shows on the drawn hull (never on the flight itself).
    const buf = sim.sh.phys && v.flying ? sim.sh.phys.buffetAngle : null;
    if (buf && (buf.pitch || buf.roll)) {
      shObj.rotateX(Math.max(-0.12, Math.min(0.12, buf.pitch || 0)));
      shObj.rotateZ(Math.max(-0.12, Math.min(0.12, buf.roll || 0)));
    }
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
    const tw = performance.now();
    world.update(dt, cam.position, v.active ? v.active.id : null);
    st0.worldMs += (performance.now() - tw - st0.worldMs) * 0.08;
    // Additive: the weather as eleven 0..1 numbers a painter can use (PHYSICS' `here.sky`:
    // cloud, overcast, haze, fog, dust, wet, snow, rain, snowfall, storm, flash), or null.
    sim.mood.sky = sim.physics && sim.physics.here && sim.physics.here.bodyId ? sim.physics.here.sky || null : null;
    this.painter.setMood(sim.mood);
    const info = this.renderer ? this.renderer.info : null;
    if (info) {
      // Count the whole frame (Painter renders in several passes) while the read-out is up.
      if (info.autoReset === this.showStats) info.autoReset = !this.showStats;
      if (this.showStats) info.reset();
    }
    this.painter.render(this.scene, cam, dt);
    if (info && this.showStats) { st0.tris = info.render.triangles; st0.calls = info.render.calls; }
    this.updateMarks(v);
    this.updateHud();
    this.updateAudio(dt, v);
    if (this.autosave) this.autosave.update(sim);
    if (this.map && this.map.open && this.frameCount % 30 === 0) this.map.refresh(this.mapData());
    this.frameCount++;
  }

  // ---- planet map -------------------------------------------------------------------------------
  mapData() {
    const sim = this.sim;
    const positions = {};
    for (const id of sim.eph.ids) positions[id] = sim.eph.position(id, sim.t);
    return {
      positions, here: sim.shFrame.kind === 'body' ? sim.shFrame.id : (sim.sm.state === S.ON_FOOT ? sim.bodyId : null),
      selected: sim.target, target: sim.targetInfo(),
      targetOf: (id) => { sim.setTarget(id); return sim.targetInfo(); },
    };
  }

  toggleMap() {
    if (!this.map) return;
    if (this.map.open) this.map.hide(); else this.map.show(this.mapData());
    if (this.audio) this.audio.event('paper');
  }

  toggleBook() {
    if (!this.book) return;
    if (this.book.open) this.book.hide();
    else {
      const sim = this.sim, totals = {};
      if (this.world.getBiomes) for (const id of sim.eph.ids) { try { totals[id] = this.world.getBiomes(id).length; } catch { /* optional */ } }
      this.book.show(sim.sketchbook(), sim.sm.state === S.ON_FOOT ? sim.nearestVista() : null, totals);
    }
    if (this.audio) this.audio.event('paper');
  }

  // Sound: the state of the world for the mixer, and one-shots for what just happened.
  updateAudio(dt, v) {
    const audio = this.audio, sim = this.sim;
    if (!audio || !audio.ready) return;
    const st = sim.sm.state;
    const here = sim.physics && sim.physics.here && sim.physics.here.bodyId ? sim.physics.here : null;
    const w = here ? here.weather : null;
    const inShip = isInShip(st);
    const body = sim.mood.bodyId ? BODIES[sim.mood.bodyId] : null;
    audio.update(dt, {
      state: st, onFoot: st === S.ON_FOOT, inShip,
      speed: inShip ? sim.sh.speed : sim.ex.speed, grounded: sim.ex.grounded, jet01: sim.ex.jet01,
      throttle01: sim.sh.throttle01, pulse01: st === S.PULSE ? 1 : 0,
      inSpace01: sim.mood.inSpace01, altitude01: sim.mood.altitude01, bodyId: sim.mood.bodyId,
      wind: here ? here.air.speed : body && body.atmosphereHeight > 0 ? 4 : 0, gust01: here ? here.air.gust01 : 0,
      rain01: w && w.precipitation ? w.precipitation.intensity01 : 0,
      airless: !!body && !(body.atmosphereHeight > 0),
      thunderIn: w && w.lightning ? w.lightning.thunderIn : null,
      submerged: sim.ex.liquidDepth > 0.2,
    });
    const seq = sim.eventSeq || 0;
    const fresh = Math.min(seq - this._eventSeq, sim.events.length);
    for (let i = sim.events.length - fresh; i < sim.events.length; i++) {
      const t = sim.events[i].type;
      if (t === 'touchdown') audio.event('land'); else if (t === 'bounce') audio.event('bounce');
      else if (t === 'vista') audio.event('found'); else if (t === 'biome' || t === 'arrived') audio.event('brush');
    }
    this._eventSeq = seq;
    const key = sim.promptNow ? sim.promptNow.text : '';
    if (key && key !== this._promptKey) audio.event('brush');
    this._promptKey = key;
  }

  // ---- markers: a ring on each world you can fly to, drawn where it is in the sky --------------
  updateMarks(v) {
    const sim = this.sim, hud = this.hud;
    if (!hud || !hud.setMarks) return;
    const list = this._marks;
    list.length = 0;
    const st = sim.sm.state;
    const flying = st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE || st === S.LANDING;
    if (flying && !(this.map && this.map.open)) {
      const cam = this.camera, p = this._p;
      const el = this.renderer ? this.renderer.domElement : null;
      const w = el ? el.clientWidth : 1280, h = el ? el.clientHeight : 720;
      const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
      const here = v.active ? v.active.id : null;
      for (const [id, root] of this.world.bodies) {
        const body = BODIES[id];
        if (!body || id === here) continue;
        const isTarget = id === sim.target;
        if (!isTarget && st !== S.SPACE && st !== S.PULSE) continue;
        const dist = root.position.length();
        p.copy(root.position).applyMatrix4(cam.matrixWorldInverse);
        const nx = p.z < 0 ? p.x / -p.z / (tanHalf * cam.aspect) : 9;
        const ny = p.z < 0 ? p.y / -p.z / tanHalf : 9;
        if (Math.abs(nx) < 0.9 && Math.abs(ny) < 0.82) {
          const r = (body.radius / dist / tanHalf) * (h / 2);
          const x = (nx * 0.5 + 0.5) * w, y = (-ny * 0.5 + 0.5) * h;
          if (isTarget) {
            const eta = pulseEta(Math.max(0, dist - arrivalRadius(body)));
            list.push({ kind: 'target', x, y, r, label: body.name, sub: `${fmt(dist)}  ${Math.max(1, Math.round(eta))} s` });
          } else if (r < 30) list.push({ kind: 'body', x, y, r, label: body.name, sub: null });
        } else if (isTarget) {
          // Off screen: a small arrow at the edge of the picture, pointing the way to turn.
          const a = Math.atan2(-p.y, p.x);
          list.push({ kind: 'edge', x: w / 2 + Math.cos(a) * w * 0.4, y: h / 2 + Math.sin(a) * h * 0.36, r: 0, angle: a, label: body.name, sub: fmt(dist) });
        }
      }
    }
    hud.setMarks(list);
  }

  updateHud() {
    const hud = this.hud, sim = this.sim;
    if (!hud) return;
    const st = sim.sm.state;
    const panelOpen = (this.map && this.map.open) || (this.book && this.book.open);
    hud.setPrompt(panelOpen ? null : sim.promptNow);
    if (hud.setHint) {
      // Until the player has looked around once (and again whenever the capture is lost), say how.
      const need = this.started && !this.input.looked && !panelOpen && this.hintOn !== false;
      hud.setHint(need ? (this.input.usePointerLock ? 'click the picture to look around with the mouse' : 'hold the left mouse button and drag to look around') : null);
    }
    if (hud.setNotice) {
      hud.setNotice(sim.notice ? sim.notice.text : this.uiNotice && performance.now() < this.uiNoticeUntil ? this.uiNotice : null);
    }
    if (hud.setStats) hud.setStats(this.showStats ? this.statsText() : null);
    hud.setFuel(sim.ex.fuel, st === S.ON_FOOT && sim.ex.fuel < 0.995);
    hud.setThrottle(sim.sh.throttle, st === S.ATMOSPHERE || st === S.SPACE);
    hud.setReticle(st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE || (st === S.ON_FOOT && sim.footCam.firstPerson));
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
    // The first click or key begins (once the first view is ready: canStart).
    if (this.input.used && !this.started && this.canStart !== false) { this.started = true; hud.showStart(false); }
  }

  // One glance at how the machine is coping (shown with ?stats=1 or the ` key).
  statsText() {
    const s = this.stats, sim = this.sim, d = this.dyn;
    const worst = Math.max(...s.window);
    const fps = 1000 / Math.max(0.1, s.frameMs);
    const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' k' : String(n));
    return [
      `frame  ${s.frameMs.toFixed(1)} ms   worst ${worst.toFixed(0)} ms   ${fps.toFixed(0)} fps`,
      `scene  ${k(s.tris)} triangles   ${s.calls} draw calls`,
      `render scale ${d ? d.scale.toFixed(2) : '1.00'}   quality tier ${d ? d.quality : '-'}${d && !d.enabled ? '  (pinned)' : ''}`,
      `world ${s.worldMs.toFixed(1)} ms   physics ${sim.physics ? sim.physicsMs.toFixed(1) + ' ms (worst ' + (sim.physicsWorstMs || 0).toFixed(1) + ')' : 'off'}`,
    ].join('\n');
  }

  info() {
    const s = this.stats;
    return {
      ...this.sim.info(), near: this.camera.near, far: this.camera.far,
      marks: this._marks.map((m) => ({ kind: m.kind, label: m.label, x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r) })),
      stats: { frameMs: +s.frameMs.toFixed(1), worldMs: +s.worldMs.toFixed(2), tris: s.tris, calls: s.calls, shown: this.showStats },
      mapOpen: !!(this.map && this.map.open), bookOpen: !!(this.book && this.book.open), uiNotice: this.uiNotice,
      audio: this.audio ? { state: this.audio.state, ready: this.audio.ready, mix: this.audio.debug() } : null,
    };
  }
}

function fmt(m) {
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}
