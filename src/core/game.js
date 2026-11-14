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
import { V, len, scale } from './vec.js';
import { pulseEta, arrivalRadius } from '../ship/pulse.js';
import { SKETCH, SKETCH_SLIP, biomeKey, vistaKey, sketchHand } from './sketches.js';
import { figureArgs, hullTrim, hasFootfalls, footLoudness } from '../player/figure.js';

const NO_KEYS = { down: () => false, axis: () => 0 };
// The ship as the chase view sees it, in metres round its middle: half its span, and how far it
// stands over and under its origin (the fin, the gear).
const SHIP_BOX = Object.freeze({ half: 4.6, over: 3.4, under: 1.2 });
// An arrow at the picture's edge rides an ellipse round the middle; its lower half is flatter, so
// that the arrow and its label stay over the band where the notice, the prompt and the gauges lie.
const edgeY = (a) => (Math.sin(a) > 0 ? 0.19 : 0.36);
const NO_EVENTS = { edges: new Set(), dx: 0, dy: 0, wheel: 0 };

export class Game {
  constructor({ renderer, scene, camera, world, painter, explorer, ship, input, hud, map, book, audio, params, physics, autosave, dyn, sketches }) {
    this.book = book || null; this.audio = audio || null; this._eventSeq = 0; this._promptKey = '';
    this.sketches = sketches || null;      // SketchStore: the sketchbook's pictures
    this._sketchWant = {};                 // key -> { due (game time), kind, bodyId, id }
    this._names = {};
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.world = world; this.painter = painter;
    this.explorerModel = explorer; this.shipModel = ship; this.input = input; this.hud = hud;
    this.map = map || null; this.autosave = autosave || null; this.dyn = dyn || null;
    this.showStats = false;
    this.stats = { frameMs: 16.7, worstMs: 0, worldMs: 0, worldWindow: [], worldPeakMs: 0, tris: 0, calls: 0, window: [] };
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
        if (!sp || !sp.unitDir) return null;
        const d = V(sp.unitDir.x, sp.unitDir.y, sp.unitDir.z);
        // Additive: where to look on arrival (radians from local north toward east), if the world says.
        if (typeof sp.yaw === 'number') { d.yaw = sp.yaw; d.pitch = typeof sp.pitch === 'number' ? sp.pitch : null; }
        return d;
      },
      sampleObstacles: world.sampleObstacles ? (bodyId, d, radius) => world.sampleObstacles(bodyId, scratch.set(d.x, d.y, d.z), radius) : null,
      physics: physics || null,
      getVistas: world.getVistas ? (bodyId) => world.getVistas(bodyId) : null,
      seat: ud.seat, hatch: ud.hatch,
      body: q.get('body'), hour: q.has('time') ? Number(q.get('time')) : null,
    });
    this.sim.onVistaFound = (bodyId, id) => { if (world.setVistaFound) world.setVistaFound(bodyId, id, true); };
    this.sim.vistaDrawn = (bodyId, id) => !!(this.sketches && this.sketches.has(vistaKey(bodyId, id)));
    this._planes = { near: 0, far: 0, fov: 0, aspect: 0 };
    this._figure = {}; this._hullTrim = { pitch: 0, roll: 0, yaw: 0 };   // reused each frame
    this.frameCount = 0;
    this.started = false;
    this.canStart = true;          // false while the title card is still waiting for the first view
  }

  frame(realDt) {
    const sim = this.sim;
    this.input.inShip = isInShip(sim.sm.state);
    const raw = this.input.take(realDt);
    // Keys that belong to the interface, not to the explorer or the ship.
    // Sound starts inside a click or a key press (main.js), never from here. A gamepad press is
    // not a gesture to the browser: a player using only the pad is told once how to get sound.
    if (this.audio && !this._soundAsked && this.input.pad && this.input.pad.active && this.audio.enabled && this.audio.state !== 'running') {
      this._soundAsked = true;
      this.uiNotice = 'Click or press a key for sound'; this.uiNoticeUntil = performance.now() + 9000;
    }
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
    } else if (this.book && this.book.open) {
      if (raw.edges.has('ArrowRight') || raw.edges.has('ArrowDown')) { this.book.step(1); if (this.audio) this.audio.event('paper'); }
      if (raw.edges.has('ArrowLeft') || raw.edges.has('ArrowUp')) { this.book.step(-1); if (this.audio) this.audio.event('paper'); }
      if (raw.edges.has('Enter') || raw.edges.has('Escape')) this.toggleBook();
    }
    if (panel) { keys = NO_KEYS; events = NO_EVENTS; }          // the world goes on; the hands are on the page
    if (this.input.message) {
      this.uiNotice = this.input.message; this.uiNoticeUntil = performance.now() + 9000;
      this.input.message = null;
    }
    // The lock reported nonsense before the game stopped trusting it: whatever it did to the
    // view (thrown straight up, in the blind play-test) is taken back to looking over the land.
    if (this.input.thrown) { this.input.thrown = false; if (sim.levelView) sim.levelView(); }
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
    // Pitch, roll and (P13) yaw: the wind rolls the hull away from it and weathercocks the nose.
    const buf = sim.sh.phys && v.flying ? sim.sh.phys.buffetAngle : null;
    if (buf) {
      const tr = hullTrim(buf, this._hullTrim);
      if (tr.pitch) shObj.rotateX(tr.pitch);
      if (tr.yaw) shObj.rotateY(tr.yaw);
      if (tr.roll) shObj.rotateZ(tr.roll);
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
      // The figure steps with PHYSICS' gait: the hips ride the stride (`ride`, passed as `hip`
      // too), the feet are placed, the legs fold before a jump (src/player/figure.js). The
      // explorer's place and the camera stay on the stride's mean (st.p): the view does not bob.
      // M4: and PHYSICS' body state in the figure's own axes (the lean into the wind, the gale's
      // crouch, the air past the cloth, the swimmer's stroke, the arc of a flight, a wall).
      const fa = figureArgs(sim.ex, sim.footCam.pitch, this._figure, sim.physics && sim.physics.here && sim.physics.here.bodyId ? sim.physics.here.air : null);
      // A model that has no swimmer yet is handed the wader it knows (with swim: 1 beside it).
      if (fa.mode === 'swim' && !this.explorerModel.swims) fa.mode = 'wade';
      this.explorerModel.animate(fa, dt);
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
    this._activeId = v.active ? v.active.id : null;
    world.update(dt, cam.position, this._activeId);
    const wms = performance.now() - tw;
    st0.worldMs += (wms - st0.worldMs) * 0.08;
    // The worst world.update of the last 90 frames (the budget is a worst frame, not an average).
    st0.worldWindow.push(wms);
    if (st0.worldWindow.length > 90) st0.worldWindow.shift();
    if (wms > st0.worldPeakMs) st0.worldPeakMs = wms;
    // Additive: the weather as eleven 0..1 numbers a painter can use (PHYSICS' `here.sky`:
    // cloud, overcast, haze, fog, dust, wet, snow, rain, snowfall, storm, flash), or null.
    sim.mood.sky = sim.physics && sim.physics.here && sim.physics.here.bodyId ? sim.physics.here.sky || null : null;
    // Debug (window.__pc.flash()): lightning for a frame or a few, so that it can be seen and shot.
    if (this.forceFlash > 0 && sim.mood.sky) { sim.mood.sky = { ...sim.mood.sky, flash: 1 }; this.forceFlash--; }
    this.painter.setMood(sim.mood);
    const info = this.renderer ? this.renderer.info : null;
    if (info) {
      // Count the whole frame (Painter renders in several passes) while the read-out is up.
      if (info.autoReset === this.showStats) info.autoReset = !this.showStats;
      if (this.showStats) info.reset();
    }
    this.painter.render(this.scene, cam, dt);
    if (info && this.showStats) { st0.tris = info.render.triangles; st0.calls = info.render.calls; }
    this.updateSketches();                 // right after the frame is painted: it is still in the canvas
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

  // A panel wants the cursor ("click a world"): opening one lets go of the mouse lock; a click
  // on the painting takes it again.
  toggleMap() {
    if (!this.map) return;
    if (this.map.open) this.map.hide(); else { this.map.show(this.mapData()); this.releaseMouse(); }
    if (this.audio) this.audio.event('paper');
  }

  toggleBook() {
    if (!this.book) return;
    if (this.book.open) this.book.hide();
    else {
      this.book.show(this.bookPages(), this.sim.sm.state === S.ON_FOOT ? this.sim.nearestVista() : null, this.sim.mood.bodyId || this.sim.bodyId);
      this.releaseMouse();
    }
    if (this.audio) this.audio.event('paper');
  }

  releaseMouse() { if (this.input && this.input.release) this.input.release(); }

  // ---- the sketchbook ---------------------------------------------------------------------------
  // The landscapes a world has (id and name), from the world when it can say, else from what
  // has been walked.
  biomesOf(bodyId) {
    const c = this._names[bodyId];
    if (c) return c;
    let list = null;
    if (this.world.getBiomes) { try { list = this.world.getBiomes(bodyId).map((b) => ({ id: b.id, name: b.name || pretty(b.id) })); } catch { list = null; } }
    if (list) this._names[bodyId] = list;
    return list;
  }

  // Every page of the book: per world, each landscape (walked or not) and each view (found or
  // not), with its sketch when one was drawn.
  bookPages() {
    const sk = this.sketches;
    return this.sim.sketchbook().map((p) => {
      const walked = new Set(p.biomes);
      const known = this.biomesOf(p.id) || p.biomes.map((id) => ({ id, name: pretty(id) }));
      const biomes = known.map((b) => ({ id: b.id, name: b.name, done: walked.has(b.id), sketch: sk && walked.has(b.id) ? sk.get(biomeKey(p.id, b.id)) : null }));
      for (const id of p.biomes) if (!known.some((b) => b.id === id)) biomes.push({ id, name: pretty(id), done: true, sketch: sk ? sk.get(biomeKey(p.id, id)) : null });
      // (a view named as a landscape of the page is captioned as the view: on Uranus' page the
      // landscape and the view were both "Pearl Fog Flats", M4's blind play-test)
      const names = new Set(biomes.map((b) => b.name));
      const vistas = (p.vistas || []).map((v) => ({ id: v.id, name: names.has(v.name) ? `${v.name}, the view` : v.name, done: v.found, sketch: sk && v.found ? sk.get(vistaKey(p.id, v.id)) : null }));
      return { id: p.id, name: p.name, visited: p.visited, biomes, vistas };
    });
  }

  // How many pages the book has, and how many are filled (a landscape walked, a view found).
  bookProgress() {
    let done = 0, total = 0;
    for (const p of this.bookPages()) {
      for (const x of p.biomes) { total++; if (x.done) done++; }
      for (const x of p.vistas) { total++; if (x.done && x.sketch) done++; }      // a view is a page once it is drawn from its easel
    }
    return { done, total };
  }

  showSketchSlip(url, title, sub) {
    if (this.hud && this.hud.showSketch) this.hud.showSketch(url, title, sub, SKETCH_SLIP.seconds);
    if (this.audio) this.audio.event('sketch');
  }

  // Sketches: when a landscape is first walked or a view found, a small picture of that moment
  // is kept for the book. A page that has no picture yet (an older save, a full storage) gets
  // one the next time the explorer stands there.
  updateSketches() {
    const sk = this.sketches, sim = this.sim;
    if (!sk || !this.started || sim.sm.state !== S.ON_FOOT) { this._footFrom = null; return; }
    const want = this._sketchWant, t = sim.t, body = sim.bodyId;
    // The first view of an arrival (the game's start, every step out of the ship) is left
    // quiet: the page is kept as it is made, but its slip waits until the explorer has set off
    // (SKETCH_SLIP.moved metres from where they stood) or SKETCH_SLIP.wait seconds have passed,
    // so it never lies over the ship the player is meant to walk to in the very first view.
    const ep = sim.ex.p;
    if (!this._footFrom || this._footFrom.body !== body) this._footFrom = { body, t, x: ep.x, y: ep.y, z: ep.z, off: false };
    const ff = this._footFrom;
    if (!ff.off && (Math.hypot(ep.x - ff.x, ep.y - ff.y, ep.z - ff.z) > SKETCH_SLIP.moved || t - ff.t > SKETCH_SLIP.wait)) ff.off = true;
    if (this._slipHeld && (ff.off || this._slipHeld.body !== body)) {
      const h = this._slipHeld; this._slipHeld = null;
      if (h.body === body) this.showSketchSlip(h.url, h.title, h.sub);
    }
    const biome = sim.ex.surface ? sim.ex.surface.biomeId : null;
    if (this.frameCount % 20 === 0) {
      const walked = sim.visited[body];
      if (biome && walked && walked.biomes[biome]) {
        const k = biomeKey(body, biome);
        // A little way in, so the picture is of the place and not of its border.
        if (!sk.has(k) && !want[k]) want[k] = { due: t + 2.5, kind: 'biome', bodyId: body, id: biome };
      }
    }
    // A view is drawn from its easel (PAINTER's critique 4: the page of a view was whatever the
    // camera happened to hold as the explorer walked into its 14 m): the page is wanted while the
    // explorer is held there, the view turned the way the picture was painted (sim.easel).
    const E = sim.easel;
    if (E && E.phase === 'hold') {
      const k = vistaKey(body, E.id);
      if (!sk.has(k) && !want[k]) want[k] = { due: t + 0.3, kind: 'vista', bodyId: body, id: E.id, name: E.name };
    }
    const panel = (this.map && this.map.open) || (this.book && this.book.open) || (this.hud && this.hud.startShown);
    for (const k in want) {
      const w = want[k];
      if (w.bodyId !== body || (w.kind === 'biome' && w.id !== biome) || t > w.due + 40) { delete want[k]; continue; }   // moved on: next time
      if (t < w.due || panel) continue;
      // Wait for the world to finish what it is building here (a few seconds at most).
      const busy = typeof this.world.busy === 'number' && this.world.busy > 0;
      if (busy && t < w.due + 8) continue;
      // (The ship is not the place: captureSketch paints the kept frame without it, so the page
      // does not wait for the hull to leave the view.)
      delete want[k];
      const url = this.captureSketch(k);
      if (url && sk.put(k, url)) {
        const names = this.biomesOf(body);
        const hit = w.kind === 'biome' && names ? names.find((b) => b.id === w.id) : null;
        const title = w.kind === 'vista' ? w.name : hit ? hit.name : pretty(w.id);
        const pr = this.bookProgress();
        this.lastSketch = { key: k, title, t };
        const sub = `${BODIES[body].name}  \u00b7  page ${pr.done} of ${pr.total}\nB opens the sketchbook`;
        if (!ff.off && w.kind !== 'vista') this._slipHeld = { body, url, title, sub };          // shown once they set off
        else this.showSketchSlip(url, title, sub);
      }
      break;                                // one picture a frame is plenty
    }
  }

  // A thumbnail of the frame that has just been painted (a data URL), or null. The frame is
  // read straight after painter.render, while it is still in the canvas; nothing here can
  // throw into the frame loop.
  // The page is of the place, not of the explorer's back nor of the parked ship's hull: for the
  // frame that is kept the figure and the ship step out of the picture (the frame is painted once
  // more without them, their shade with them, kept, and painted again as it was, all before the
  // screen is shown: the player sees no gap). The kept frame is then drawn over by the sketch's
  // hand (sketches.js sketchHand): washes, pencil, a ragged edge.
  // (The ship used to be waited out instead, up to 45 s within 40 m: at the game's start it
  // stands 16 m off in the middle of the first view, and the first page never came.)
  captureSketch(key) {
    const can = !!(this.painter && this.scene && this.camera);
    const out = can ? [this.explorerModel, this.shipModel].map((m) => (m ? m.object3D : null)).filter((o) => o && o.visible) : [];
    const hide = out.length > 0;
    try {
      const src = this.renderer ? this.renderer.domElement : null;
      if (!src || !src.width || !src.height || typeof document === 'undefined') return null;
      if (hide) { for (const o of out) o.visible = false; this.repaint(); }
      const c = this._sketchCanvas || (this._sketchCanvas = document.createElement('canvas'));
      c.width = SKETCH.width; c.height = SKETCH.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      // Crop the frame to the sketch's proportions (centre), then scale it down.
      const ar = SKETCH.width / SKETCH.height;
      let sw = src.width, sh = src.height;
      if (sw / sh > ar) sw = sh * ar; else sh = sw / ar;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
      try {
        const img = g.getImageData(0, 0, c.width, c.height);
        let seed = 7;
        for (const ch of String(key || '')) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
        // (an empty canvas is no page: nothing is kept, and the page is wanted again)
        if (!sketchHand(img.data, c.width, c.height, seed)) return null;
        g.putImageData(img, 0, 0);
      } catch { /* a canvas that cannot be read keeps the plain frame */ }
      let url = c.toDataURL('image/jpeg', SKETCH.quality);
      if (url.length > SKETCH.maxEach) url = c.toDataURL('image/jpeg', SKETCH.qualityLow);
      return url.length > SKETCH.maxEach ? null : url;
    } catch { return null; } finally {
      if (hide) { for (const o of out) o.visible = true; try { this.repaint(); } catch { /* the next frame repaints */ } }
    }
  }

  // Paint the frame again as it stands; no time passes. The world goes first: it lays the shade
  // of whatever stands on the land and can be seen (a figure taken out of the picture left its
  // shade on the ground: a dark smear in the middle of the page).
  repaint() {
    if (this.world && this.world.update) this.world.update(0, this.camera.position, this._activeId || null);
    this.painter.render(this.scene, this.camera, 0);
  }

  // The footfall to sound this frame, if PHYSICS counted a new one: { foot, loud }, or null.
  takeFootfall(st) {
    const ph = this.sim.ex.phys;
    if (!hasFootfalls(ph)) { this._stepsSeen = null; return null; }
    const seen = this._stepsSeen;
    this._stepsSeen = ph.steps;
    if (seen == null || ph.steps === seen || st !== S.ON_FOOT || !ph.footfall) return null;
    const body = BODIES[this.sim.bodyId];
    const f = ph.footfall, out = this._footfall || (this._footfall = { foot: 0, loud: 1 });
    out.foot = f.foot; out.loud = footLoudness(f.force, body ? body.gravity : 9);
    return out;
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
      // Rain: PHYSICS' sky.rain (liquid falling; snow is silent), what it falls on, and the shelter.
      rain01: here && here.sky ? here.sky.rain : w && w.precipitation && w.precipitation.type !== 'snow' ? w.precipitation.intensity01 : 0,
      canopy01: here && here.cover ? here.cover.canopy01 || 0 : 0,
      blown: here && here.blown ? here.blown : null,
      dripping: here && sim.physics.particles && sim.physics.particles.system ? sim.physics.particles.system.dripping || 0 : 0,
      underHull: st === S.ON_FOOT && sim.shFrame.kind === 'body' && sim.shFrame.id === sim.bodyId
        && Math.hypot(sim.sh.p.x - sim.ex.p.x, sim.sh.p.y - sim.ex.p.y, sim.sh.p.z - sim.ex.p.z) < 3.6,
      airless: !!body && !(body.atmosphereHeight > 0),
      thunderIn: w && w.lightning ? w.lightning.thunderIn : null,
      thunder01: w && w.lightning ? w.lightning.thunder01 : null,
      submerged: sim.ex.liquidDepth > 0.2,
      material: sim.ex.phys ? sim.ex.phys.material : null,
      // Footsteps on PHYSICS' footfalls (P13), loud by their force; without them the mixer
      // keeps its own cadence.
      footfalls: hasFootfalls(sim.ex.phys),
      footfall: this.takeFootfall(st),
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
    const cam = this.camera, p = this._p;
    const el = this.renderer ? this.renderer.domElement : null;
    const w = el ? el.clientWidth : 1280, h = el ? el.clientHeight : 720;
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    const view = this._markView || (this._markView = { w: 0, h: 0, keep: [] });
    view.w = w; view.h = h; view.keep.length = 0;
    if (flying && !(this.map && this.map.open)) {
      const here = v.active ? v.active.id : null;
      for (const [id, root] of this.world.bodies) {
        const body = BODIES[id];
        if (!body || id === here) continue;
        const isTarget = id === sim.target;
        if (!isTarget && st !== S.SPACE && st !== S.PULSE) continue;
        // Under the edge of space only the course's world (chosen on the map) is marked, not the
        // world the nose happens to point at (M4's second blind player: "Uranus 709 km" through
        // Venus' air all the way down to the ground, "Jupiter" over Mars' mesas).
        if (st !== S.SPACE && st !== S.PULSE && !sim.targetLocked) continue;
        const dist = root.position.length();
        p.copy(root.position).applyMatrix4(cam.matrixWorldInverse);
        const nx = p.z < 0 ? p.x / -p.z / (tanHalf * cam.aspect) : 9;
        const ny = p.z < 0 ? p.y / -p.z / tanHalf : 9;
        if (Math.abs(nx) < 0.9 && Math.abs(ny) < 0.82) {
          const r = (body.radius / dist / tanHalf) * (h / 2);
          const x = (nx * 0.5 + 0.5) * w, y = (-ny * 0.5 + 0.5) * h;
          if (isTarget) {
            const eta = pulseEta(Math.max(0, dist - arrivalRadius(body)));
            // In the cockpit the prompt sits just under the middle of the picture: with the nose on
            // the target ("Pulse to Mars") the label would lie on it, so there it is written above the ring.
            const above = !!sim.shipCam.cockpit && Math.abs(x - w / 2) < w * 0.22 && y > h * 0.36 && y < h * 0.64;
            list.push({ kind: 'target', x, y, r, above, label: body.name, sub: `${fmt(dist)}  ${Math.max(1, Math.round(eta))} s` });
          } else if (r < 30) list.push({ kind: 'body', x, y, r, label: body.name, sub: null });
        } else if (isTarget) {
          // Off screen: a small arrow at the edge of the picture, pointing the way to turn.
          const a = this.edgeAngle(p, id);
          list.push({ kind: 'edge', x: w / 2 + Math.cos(a) * w * 0.4, y: h / 2 + Math.sin(a) * h * edgeY(a), r: 0, angle: a, label: body.name, sub: fmt(dist) });
        }
      }
      // The world's own landing place (where its first view was painted from), until the player
      // has walked on that world: one small ring on the ground, so that a first landing can be
      // the one the painter composed. Not behind the horizon, not once the ship is nearly there.
      const site = here && st !== S.PULSE && st !== S.LANDING && !sim.visited[here] && BODIES[here] ? this.landingSite(here) : null;
      const root = site ? this.world.bodies.get(here) : null;
      if (root) {
        p.set(site.x, site.y, site.z).applyQuaternion(root.quaternion);
        const ox = p.x, oy = p.y, oz = p.z, R = p.length();
        p.add(root.position);
        const dist = p.length();
        const over = -(ox * p.x + oy * p.y + oz * p.z) / R;       // the camera's height over the site's own horizon
        if (dist > 60) {
          // Where the place lies over the ground from here (these worlds are small: the straight line
          // to a place round the curve goes down through the ground): behind the way the view faces
          // and to which side, unless it is nearly under the ship (nearer over the ground than the
          // ship is high), where the way to it is down.
          const up = this._u || (this._u = new THREE.Vector3()), fw = this._f || (this._f = new THREE.Vector3()), hv = this._h || (this._h = new THREE.Vector3());
          up.copy(root.position).multiplyScalar(-1);
          const high = up.length() - R;
          up.normalize();
          const ground = R * Math.acos(Math.max(-1, Math.min(1, (ox * up.x + oy * up.y + oz * up.z) / R)));
          cam.getWorldDirection(fw).addScaledVector(up, -fw.dot(up));
          hv.copy(p).addScaledVector(up, -p.dot(up));
          const fl = fw.length(), along = fl > 1e-6 ? -hv.dot(fw) / fl : 0;
          const across = fl > 1e-6 ? hv.dot(fw.cross(up)) / fl : 0;
          const behind = along > 0 && ground > high;
          // In sight: a ring on the place. Round the curve of the world or out of the picture: an
          // arrow at the picture's edge, the way to fly.
          p.applyMatrix4(cam.matrixWorldInverse);
          const nx = p.z < 0 ? p.x / -p.z / (tanHalf * cam.aspect) : 9;
          const ny = p.z < 0 ? p.y / -p.z / tanHalf : 9;
          if (over > 2 && Math.abs(nx) < 0.9 && Math.abs(ny) < 0.82) {
            list.push({ kind: 'body', keep: true, x: (nx * 0.5 + 0.5) * w, y: (-ny * 0.5 + 0.5) * h, r: 3, label: 'a place to land', sub: fmt(dist) });
          } else {
            const a = this.edgeAngle(p, 'site', behind, across, along);
            list.push({ kind: 'edge', x: w / 2 + Math.cos(a) * w * 0.4, y: h / 2 + Math.sin(a) * h * edgeY(a), r: 0, angle: a, label: 'a place to land', sub: fmt(dist) });
          }
        }
      }
      // (the ship's keep-out follows)
    }
    // On foot: one quiet mark for the nearest view not yet drawn within VISTA_MARK metres (a small
    // ring where its easel is, or an arrow at the picture's edge), as "a place to land" is in flight;
    // and the way back to the ship, farther than SHIP_MARK metres or out of the picture.
    if (st === S.ON_FOOT && !(this.map && this.map.open) && !(this.book && this.book.open) && this.started) {
      const root = this.world.bodies.get(sim.bodyId);
      const mark = (q, label, distance, always) => {
        p.set(q.x, q.y, q.z).applyQuaternion(root.quaternion).add(root.position).applyMatrix4(cam.matrixWorldInverse);
        const nx = p.z < 0 ? p.x / -p.z / (tanHalf * cam.aspect) : 9;
        const ny = p.z < 0 ? p.y / -p.z / tanHalf : 9;
        if (Math.abs(nx) < 0.9 && Math.abs(ny) < 0.82) {
          if (always) list.push({ kind: 'body', keep: true, x: (nx * 0.5 + 0.5) * w, y: (-ny * 0.5 + 0.5) * h, r: 3, label, sub: fmt(distance) });
        } else {
          let a = Math.atan2(-p.y, p.x);
          // Behind (or below) the view the arrow goes to the side the mark lies on, a little low:
          // straight down it lay on the figure's legs, in the lower middle of the picture.
          if (p.z >= 0 || Math.sin(a) > 0.7) a = p.x >= 0 ? 0.3 : Math.PI - 0.3;
          list.push({ kind: 'edge', x: w / 2 + Math.cos(a) * w * 0.4, y: h / 2 + Math.sin(a) * h * edgeY(a), r: 0, angle: a, label, sub: fmt(distance) });
        }
      };
      const n0 = list.length;
      const vm = root ? sim.vistaMark() : null;
      if (vm && vm.distance > 5) mark(vm.p, 'a view', vm.distance, true);
      const sm = root && sim.shipMark ? sim.shipMark() : null;
      if (sm) mark(sm.p, 'the ship', sm.distance, !sm.near);
      // the figure is the subject on foot: the labels keep off it
      if (list.length > n0 && !sim.footCam.firstPerson) {
        p.copy(this.explorerModel.object3D.position).applyMatrix4(cam.matrixWorldInverse);
        if (p.z < -0.5) {
          const k = (h / 2) / (-p.z * tanHalf), sx = w / 2 + p.x * k, sy = h / 2 - p.y * k;
          view.keep.push({ x0: sx - 0.8 * k, x1: sx + 0.8 * k, y0: sy - 2.2 * k, y1: sy + 0.1 * k });
        }
      }
    }
    if (flying && !(this.map && this.map.open)) {
      // The ship is the subject of the chase view: its place in the picture is kept clear of the
      // labels (aimed at a world, the world's name lay on the ship for the whole pulse drive).
      if (list.length && v.view === 'chase') {
        p.copy(this.shipModel.object3D.position).applyMatrix4(cam.matrixWorldInverse);
        if (p.z < -1) {
          const k = (h / 2) / (-p.z * tanHalf), sx = w / 2 + p.x * k, sy = h / 2 - p.y * k;
          view.keep.push({ x0: sx - SHIP_BOX.half * k, x1: sx + SHIP_BOX.half * k, y0: sy - SHIP_BOX.over * k, y1: sy + SHIP_BOX.under * k });
        }
      }
    }
    hud.setMarks(list, view);
  }

  // Which way a flight mark's edge arrow points, for its point p in camera space. In front of the
  // view it points where the point lies past the edge of the picture. Behind the view the point's
  // projection pointed down for anything behind and below (M4's second blind player: "the arrow
  // pointing down meant behind"): there it points to the side the point lies on, the way to turn,
  // a little low as on foot; near dead behind it keeps the side it had (the label jumped from
  // side to side as the nose swung across the place behind). `behind`, `across` (to the right)
  // and `along` (backward) may be given in the caller's own terms (the place to land: over the
  // ground); by default they are read off p.
  edgeAngle(p, key, behind = p.z >= 0, across = p.x, along = p.z) {
    const sides = this._edgeSides || (this._edgeSides = {});
    let side = across >= 0 ? 1 : -1;
    if (!behind) { sides[key] = side; return Math.atan2(-p.y, p.x); }
    if (sides[key] && Math.abs(across) < 0.25 * Math.abs(along)) side = sides[key];
    sides[key] = side;
    return side > 0 ? 0.3 : Math.PI - 0.3;
  }

  // Where the world itself would set a newcomer down (world.getSpawn), as a point in the body's
  // own frame, on the ground. Looked up once per body.
  landingSite(bodyId) {
    const cache = this._sites || (this._sites = {});
    if (bodyId in cache) return cache[bodyId];
    let out = null;
    const sp = this.world.getSpawn ? this.world.getSpawn(bodyId) : null;
    if (sp && sp.unitDir) {
      const l = Math.hypot(sp.unitDir.x, sp.unitDir.y, sp.unitDir.z) || 1;
      const d = V(sp.unitDir.x / l, sp.unitDir.y / l, sp.unitDir.z / l);
      const g = this.sim.sampler(bodyId)(d);
      const r = Math.max(g && g.radius > 0 ? g.radius : BODIES[bodyId].radius, g && g.liquidRadius > 0 ? g.liquidRadius : 0);
      out = V(d.x * r, d.y * r, d.z * r);
    }
    cache[bodyId] = out;
    return out;
  }

  updateHud() {
    const hud = this.hud, sim = this.sim;
    if (!hud) return;
    const st = sim.sm.state;
    const panelOpen = (this.map && this.map.open) || (this.book && this.book.open);
    hud.setPrompt(panelOpen ? null : sim.promptNow);
    if (panelOpen && hud.sketchShown) hud.hideSketch();
    if (hud.root) {
      hud.root.classList.toggle('pc-paneled', !!panelOpen);      // an open panel has the page to itself
      // From the seat the lower third of the frame is the cowl and its dials: the slips move up.
      hud.root.classList.toggle('pc-cockpit', !!sim.shipCam.cockpit && (st === S.LANDED || st === S.ATMOSPHERE || st === S.SPACE || st === S.PULSE));
      // On foot in third person the explorer stands in the lower middle of the frame, where the
      // slips used to lie across the legs: they go under the feet instead.
      hud.root.classList.toggle('pc-foot3', st === S.ON_FOOT && !sim.footCam.firstPerson);
    }
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
    if (this.frameCount % 6 === 0 && hud.root) {
      // The slips' paper takes the sheet's key: white by day, toward a moonlit blue-grey as the
      // night comes on (the world's hour: 18 the sun on the horizon) and out in space.
      const h = sim.mood.timeOfDay == null || !sim.mood.bodyId ? 12 : sim.mood.timeOfDay;
      const ramp = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const night = h >= 12 ? ramp(17.7, 18.9, h) : 1 - ramp(5.1, 6.3, h);
      const q = Math.round(Math.max(night, 0.85 * (sim.mood.inSpace01 || 0)) * 16) / 16;
      if (q !== this._slipKey) { this._slipKey = q; hud.root.style.setProperty('--pc-key', `rgb(${Math.round(255 - 97 * q)}, ${Math.round(255 - 82 * q)}, ${Math.round(255 - 36 * q)})`); }
    }
    if (this.frameCount % 6 === 0) {
      // On foot the screen is the painting and nothing else: the place name shows for a few
      // seconds on arrival, then fades. In flight the read-out stays.
      const name = sim.mood.bodyId ? BODIES[sim.mood.bodyId].name : 'deep space';
      // The place is named when it is come to: a new world, the first frame of the game, stepping
      // out of the ship. (It used to be named again on sitting down in the ship, and at the start
      // of a new game its six seconds ran out behind the title card: PAINTER's critique 15.)
      const afoot = st === S.ON_FOOT;
      const key = name + (this.started ? '' : ':card');
      if (key !== this._placeKey || (afoot && this._placeFoot === false)) { this._placeKey = key; this._placeAt = sim.t; }
      if (st !== S.BOARDING) this._placeFoot = afoot;
      if (isInShip(st) && st !== S.LANDED) {
        const env = sim.flightEnv();
        // Height over the ground or the water (not over the tree tops, which the ship's own floor
        // counts: rising out of the wood the read-out said "0 m up" for three seconds).
        let alt = env.hasBody ? env.altitude : null;
        if (env.sample) { const r = len(sim.sh.p), s = env.sample(scale(sim.sh.p, 1 / r)); alt = Math.max(0, r - Math.max(s.radius, s.liquidRadius || 0)); }
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
      `render scale ${d ? d.scale.toFixed(2) : '1.00'}   quality tier ${d ? d.quality : '-'}${d && !d.enabled ? '  (pinned)' : ''}${d && d.capMs ? `   capped at ${(1000 / d.capMs).toFixed(0)} fps` : ''}`,
      `world ${s.worldMs.toFixed(1)} ms (worst ${Math.max(0, ...s.worldWindow).toFixed(1)})   physics ${sim.physics ? sim.physicsMs.toFixed(1) + ' ms (worst ' + (sim.physicsWorstMs || 0).toFixed(1) + ')' : 'off'}`,
      this.weatherText(k),
    ].join('\n');
  }

  // What the weather is doing and what its marks cost (the world draws PHYSICS' kits itself:
  // rain, snow, dust, rings, prints; their share is already inside the scene line above).
  weatherStats() {
    const kits = this.world.kits, st = kits && kits.stats;
    const sky = this.sim.mood.sky;
    const r = (x) => +(+x || 0).toFixed(2);
    return {
      kits: st ? { calls: st.drawCalls | 0, tris: st.triangles | 0 } : null,
      sky: sky ? { cloud: r(sky.cloud), overcast: r(sky.overcast), haze: r(sky.haze), fog: r(sky.fog), dust: r(sky.dust), wet: r(sky.wet), snow: r(sky.snow), rain: r(sky.rain), snowfall: r(sky.snowfall), storm: r(sky.storm), flash: r(sky.flash) } : null,
    };
  }

  weatherText(k) {
    const w = this.weatherStats();
    const kits = w.kits ? `kits ${w.kits.calls} draw calls, ${k(w.kits.tris)} triangles` : 'kits none';
    if (!w.sky) return `weather  ${kits}   (no sky numbers)`;
    const s = w.sky, bits = [];
    for (const [name, v] of [['overcast', s.overcast], ['rain', s.rain], ['snowfall', s.snowfall], ['dust', s.dust], ['fog', s.fog], ['storm', s.storm], ['wet', s.wet]]) if (v >= 0.05) bits.push(`${name} ${v.toFixed(2)}`);
    return `weather  ${kits}   ${bits.length ? bits.join('  ') : 'fair'}`;
  }

  info() {
    const s = this.stats;
    return {
      ...this.sim.info(), near: this.camera.near, far: this.camera.far,
      marks: this._marks.map((m) => ({ kind: m.kind, label: m.label, x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r) })),
      stats: {
        frameMs: +s.frameMs.toFixed(1), worldMs: +s.worldMs.toFixed(2), worldWorstMs: +Math.max(0, ...s.worldWindow).toFixed(2),
        worldPeakMs: +s.worldPeakMs.toFixed(2), tris: s.tris, calls: s.calls, shown: this.showStats,
      },
      weather: this.weatherStats(),
      mapOpen: !!(this.map && this.map.open), bookOpen: !!(this.book && this.book.open), uiNotice: this.uiNotice,
      audio: this.audio ? { state: this.audio.state, ready: this.audio.ready, mix: this.audio.debug() } : null,
      sketches: this.sketches ? { count: this.sketches.count, chars: this.sketches.total, saved: this.sketches.saved, keys: Object.keys(this.sketches.items), last: this.lastSketch || null } : null,
    };
  }
}

const pretty = (id) => String(id).replace(/[_-]+/g, ' ');

function fmt(m) {
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}
