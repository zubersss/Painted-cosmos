// Painted Cosmos: boot. Creates the renderer and camera (COORDINATOR.md C7), loads Painter's
// modules or Pilot's stubs through src/core/providers.js, and runs the frame loop.
//
// URL parameters (all optional):
//   stub=1 | stub=render,world,art   force stubs        real=1 | real=...   try real modules
//   body=<id>  time=<hours>          where and when to start
//   dynres=0   scale=<0.25..1>  quality=<0|1|2>   pin the resolution controller (for screenshots)
//   pointerlock=0                    drag to look instead of locking the pointer
//   card=0                           no start card (for captures)
//   stats=1                          show the frame read-out (also the ` key)
//   fresh=1                          forget the saved game       save=0   do not save
//   audio=0                          silence
import * as THREE from 'three';
import { loadProviders } from './core/providers.js';
import { Game } from './core/game.js';
import { Input } from './core/input.js';
import { DynamicResolution } from './core/dynres.js';
import { createHud } from './ui/hud.js';
import { createMap } from './ui/map.js';
import { createBook } from './ui/book.js';
import { createAudio } from './audio/audio.js';
import { readSave, restore, clearSave, AutoSave } from './core/save.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('pc-canvas');
const loading = document.getElementById('pc-loading');

let debugNote = null;

async function boot() {
  const prov = await loadProviders(location.search);

  // Depth (COORDINATOR.md C7): reversed-Z where EXT_clip_control exists, logarithmic depth
  // otherwise. Asking three for both makes it warn, so ask for exactly the one that will work.
  const options = { ...prov.RENDERER_OPTIONS };
  if (options.reversedDepthBuffer && options.logarithmicDepthBuffer) {
    if (hasClipControl()) delete options.logarithmicDepthBuffer;
    else delete options.reversedDepthBuffer;
  }
  const renderer = new THREE.WebGLRenderer({ canvas, ...options });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3e6);

  const world = prov.createWorld(scene);
  const painter = prov.createPainter(renderer);
  if (painter._attachWorld && world.isStub) painter._attachWorld(world);
  // Build the first view quickly while the loading sheet is up, then go back to a frame budget.
  if (world.setBuildBudget) world.setBuildBudget(40);
  const explorer = prov.createExplorer();
  const ship = prov.createShip();

  // PHYSICS (COORDINATOR.md C14): one instance, fed the world's sampleSurface; the world reads
  // its fields, the simulation steps the explorer and the ship through its models.
  let physics = null;
  if (prov.createPhysics) {
    try {
      // PHYSICS' default seed: chosen so that weather happens at the real Earth spawn
      // (a thunderstorm crosses late in the first morning).
      physics = prov.createPhysics({ sampleSurface: (bodyId, d) => world.sampleSurface(bodyId, d) });
      if (world.setPhysics) world.setPhysics(physics);
    } catch (e) {
      physics = null;
      console.warn('[painted-cosmos] physics could not start (' + (e && e.message) + '); using the built-in movement.');
    }
  }
  prov.using.physics = physics ? 'real' : 'stub';

  const hudRoot = document.getElementById('pc-hud');
  const hud = createHud(hudRoot);
  const input = new Input(canvas, { pointerLock: params.get('pointerlock') !== '0' });
  // Resolution: at most 1080p-class output; the controller scales the scene inside that.
  const dyn = new DynamicResolution({
    enabled: params.get('dynres') !== '0',
    // Start carefully and climb: a weak GPU never sees the expensive setting first. The
    // controller raises the scale after 2.5 s of headroom and the tier after 12 s at full scale.
    scale: params.has('scale') ? Number(params.get('scale')) : 0.75,
    quality: params.has('quality') ? Number(params.get('quality')) : 1,
  });
  const storage = safeStorage();
  const map = createMap(hudRoot, { onSelect: (id) => game.sim.setTarget(id) });
  const book = createBook(hudRoot);
  const audio = createAudio({ enabled: params.get('audio') !== '0' });
  const game = new Game({
    renderer, scene, camera, world, painter, explorer, ship, input, hud, map, book, audio, params, physics, dyn,
    autosave: storage && params.get('save') !== '0' ? new AutoSave(storage) : null,
  });
  game.showStats = params.get('stats') === '1';
  // Continue where the last visit ended, unless asked for a fresh start (?fresh=1).
  if (storage && params.get('fresh') === '1') clearSave(storage);
  else if (storage && !params.has('body')) {
    const saved = readSave(storage);
    if (saved && restore(game.sim, saved)) {
      debugNote = 'continued from a save';
      hud.setSubtitle('your journey continues on ' + game.sim.bodyId.charAt(0).toUpperCase() + game.sim.bodyId.slice(1));
      // Views already found look found again.
      if (world.setVistaFound) for (const [b, ids] of Object.entries(saved.vistas || {})) for (const id of ids) world.setVistaFound(b, id, true);
    }
  }
  // Fill the near field (wind grid, terrain cache) behind the loading sheet, not in frame one.
  if (physics && physics.warmUp) {
    try { physics.warmUp({ bodyId: game.sim.bodyId, time: game.sim.t, focus: game.sim.ex.p }); } catch { /* optional */ }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    painter.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();
  if (painter.setRenderScale) painter.setRenderScale(dyn.scale);
  painter.setQuality(dyn.quality);
  const showCard = params.get('card') !== '0';
  hud.showStart(showCard);
  if (!showCard) { game.started = true; game.hintOn = false; }

  const sim = game.sim;
  const debug = {
    game, sim, world, painter, renderer, scene, camera, dyn, physics, map, book, audio, storage, using: prov.using, note: debugNote,
    info: () => ({ ...game.info(), using: prov.using, fps: debug.fps, frames: game.frameCount, scale: dyn.scale, quality: dyn.quality, settled: worldSettled(world, game.frameCount) }),
    teleport: (o) => sim.teleport(o),
    aimAt: (id) => sim.aimAt(id),
    setTimeScale: (k) => { sim.timeScale = Math.max(0, Math.min(20, k)); },
    setHour: (h) => { sim.eph.setLocalSolarTime(sim.bodyId, sim.t, norm3(sim.ex.p), h); },
    // Resolves when the world has had nothing left to build for `frames` frames in a row.
    settle: (frames = 12) => new Promise((resolve) => {
      let n = 0;
      const f = () => { n = worldSettled(world, game.frameCount) ? n + 1 : 0; if (n >= frames) resolve(true); else requestAnimationFrame(f); };
      f();
    }),
    fps: 0,
    errors: [],
  };
  window.__pc = debug;
  window.addEventListener('error', (e) => debug.errors.push(String(e.message)));

  let last = performance.now();
  let settledFrames = 0;
  let fpsAcc = 0, fpsN = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dtMs = now - last;
    last = now;
    if (dtMs <= 0) return;
    game.frame(dtMs / 1000);
    const r = dyn.frame(dtMs);
    if (r.changed) {
      if (painter.setRenderScale) painter.setRenderScale(r.scale);
      painter.setQuality(r.quality);
    }
    fpsAcc += dtMs; fpsN++;
    if (fpsAcc > 500) { debug.fps = Math.round((1000 * fpsN) / fpsAcc * 10) / 10; fpsAcc = 0; fpsN = 0; }
    // "Ready" = a complete frame is on screen: the terrain around the camera has settled
    // (or, for a world that cannot say, a generous number of frames has passed).
    if (!window.__pcReady) {
      const settled = worldSettled(world, game.frameCount);
      settledFrames = settled ? settledFrames + 1 : 0;
      if (settledFrames >= 2 || game.frameCount > 900) {
        window.__pcReady = true;
        loading.classList.add('pc-done');
        if (world.setBuildBudget) world.setBuildBudget(5);
      }
    }
  }
  requestAnimationFrame(tick);
}

// Has the world finished building what the camera can see? The stub says so through
// isSettled(); Painter's world exposes `busy` (pending build jobs); anything else gets time.
function worldSettled(world, frames) {
  if (typeof world.isSettled === 'function') return world.isSettled();
  if (typeof world.busy === 'number') return world.busy === 0 && frames > 3;
  return frames > 90;
}

// localStorage, or null where it is blocked (private windows, sandboxed frames): never throws.
function safeStorage() {
  try {
    const s = window.localStorage;
    const k = 'painted-cosmos.probe';
    s.setItem(k, '1'); s.removeItem(k);
    return s;
  } catch { return null; }
}

function hasClipControl() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ok = !!(gl && gl.getExtension('EXT_clip_control'));
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return ok;
  } catch { return false; }
}

function norm3(p) {
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / l, y: p.y / l, z: p.z / l };
}

boot().catch((e) => {
  console.error('[painted-cosmos] could not start:', e);
  loading.textContent = 'the paper tore: ' + (e && e.message ? e.message : e);
});
