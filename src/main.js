// Painted Cosmos: boot. Creates the renderer and camera (COORDINATOR.md C7), loads Painter's
// modules or Pilot's stubs through src/core/providers.js, and runs the frame loop.
//
// URL parameters (all optional):
//   stub=1 | stub=render,world,art   force stubs        real=1 | real=...   try real modules
//   body=<id>  time=<hours>          where and when to start
//   clock=even                       no uneven clock (slow dusk and dawn, short night): for instruments
//   quality=<0|1|2>  pin the quality tier;  scale=<0.25..1>  where the resolution starts;
//   dynres=0   pin both (for screenshots). Without any of them: best tier, full resolution,
//   and the controller steps down only when the frame rate asks.
//   pointerlock=0                    drag to look instead of locking the pointer
//   card=0                           no start card (for captures)
//   stats=1                          show the frame read-out (also the ` key)
//   fresh=1                          forget the saved game       save=0   do not save
//   audio=0                          silence
//   kits=0                           no weather marks (rain, snow, dust)   weather=fair   a clear sky, always
import * as THREE from 'three';
import { loadProviders } from './core/providers.js';
import { Game } from './core/game.js';
import { Input, keyLabels } from './core/input.js';
import { attachTouch } from './core/touch.js';
import { DynamicResolution } from './core/dynres.js';
import { createHud } from './ui/hud.js';
import { createMap } from './ui/map.js';
import { createBook } from './ui/book.js';
import { createAudio } from './audio/audio.js';
import { readSave, restore, clearSave, AutoSave } from './core/save.js';
import { SketchStore } from './core/sketches.js';

// Every static import has loaded: index.html's watchdog stands down (hardening review P14).
window.__pcBooting = true;

const params = new URLSearchParams(location.search);
// The most pixels the drawing buffer may have (the coordinator's ruling, 2026-11-11: 3.7 MP,
// about 2560x1440).
const OUTPUT_MAX_PIXELS = 3.7e6;
const canvas = document.getElementById('pc-canvas');
const loading = document.getElementById('pc-loading');

let debugNote = null;

// Plain words on the bare sheet when the game cannot run or has stopped (nothing painted:
// the painted UI may be what failed).
function say(text) {
  loading.classList.remove('pc-done');
  loading.textContent = text;
}

async function boot() {
  // No WebGL 2 at all (hardware acceleration off, a blocked driver, a virtual machine): say so
  // in a sentence rather than let three throw (hardening review P13).
  const gl = probeGL();
  if (!gl.webgl2) {
    say('Painted Cosmos needs WebGL 2: turn on hardware acceleration in the browser settings, or use a current Chrome, Edge, Firefox or Safari.');
    window.__pcNoGL = true;
    return;
  }
  const prov = await loadProviders(location.search);

  // Depth (COORDINATOR.md C7): reversed-Z where EXT_clip_control exists, logarithmic depth
  // otherwise. Asking three for both makes it warn, so ask for exactly the one that will work.
  const options = { ...prov.RENDERER_OPTIONS };
  if (options.reversedDepthBuffer && options.logarithmicDepthBuffer) {
    if (gl.clipControl) delete options.logarithmicDepthBuffer;
    else delete options.reversedDepthBuffer;
  }
  const renderer = new THREE.WebGLRenderer({ canvas, ...options });
  // A lost context (a driver reset, the browser taking WebGL away): three restores what it can
  // when the context comes back; until then the sheet says so, and if it never comes back the
  // player is told to reload, not left with a blank page and the sound playing on (P15).
  let lostTimer = 0;
  canvas.addEventListener('webglcontextlost', () => {
    say('the paper is being redrawn\u2026');
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => say('the graphics driver stopped: reload the page (your journey is saved)'), 5000);
    if (window.__pc && window.__pc.audio) window.__pc.audio.pause();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(lostTimer);
    loading.textContent = '';
    if (window.__pcReady) loading.classList.add('pc-done');
    if (window.__pc && window.__pc.audio && !document.hidden) window.__pc.audio.resume();
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3e6);

  const world = prov.createWorld(scene);
  const painter = prov.createPainter(renderer);
  // Painter's targets have half-float attachments: without float colour buffers every pass is an
  // incomplete framebuffer and the sheet stays dark under the HUD (hardening review gap 12, seen
  // in Chromium with both extensions hidden). Say so, unless the painter declares a fallback.
  if (!gl.floatTargets && prov.using.render === 'real' && painter.floatFallback !== true) {
    say('Painted Cosmos needs a graphics feature this browser or driver does not offer (float colour buffers in WebGL 2): try a current Chrome, Edge, Firefox or Safari, with hardware acceleration on.');
    window.__pcNoGL = true;
    return;
  }
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
      // The world draws PHYSICS' weather marks itself (rain, snow, dust, rings, prints);
      // ?kits=0 leaves them out, ?weather=fair holds a clear sky (comparable captures).
      if (world.setPhysics) world.setPhysics(physics, params.get('kits') === '0' ? { kits: false } : undefined);
    } catch (e) {
      physics = null;
      console.warn('[painted-cosmos] physics could not start (' + (e && e.message) + '); using the built-in movement.');
      prov.fallback.push('physics: ' + ((e && e.message) || e));
    }
  }
  prov.using.physics = physics ? 'real' : 'stub';
  if (params.get('weather') === 'fair' && world.setWeather) world.setWeather({});

  const hudRoot = document.getElementById('pc-hud');
  const hud = createHud(hudRoot);
  // Name the keys as this keyboard prints them, where the browser can say (Chromium; elsewhere
  // the QWERTY names stand, and the action keys work by their letter anyway: src/core/input.js).
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then((m) => { const l = keyLabels(m); if (l) hud.setKeyLabels(l); }, () => {});
    }
  } catch { /* not in a frame, not here */ }
  const input = new Input(canvas, { pointerLock: params.get('pointerlock') !== '0' });
  // Fingers (src/core/touch.js): the stick, the look and the pinch on the picture, the touch
  // HUD's controls; shown only once a finger touches, or on a phone or a tablet from the start.
  const touch = attachTouch(input, canvas);
  hud.bindTouch(touch);
  // Resolution: the output is capped at OUTPUT_MAX_PIXELS (resize, below); the controller
  // scales the scene inside that.
  const dyn = new DynamicResolution({
    enabled: params.get('dynres') !== '0',
    // Start at the best picture (top tier, full resolution) and give some of it up only when
    // the measured frame time asks: under 30 fps the controller sheds load within a second or
    // two, and it climbs back by careful steps (src/core/dynres.js). ?quality=0|1|2 pins the
    // tier (the resolution still adapts); ?scale= chooses where the resolution starts;
    // ?dynres=0 pins both.
    scale: params.has('scale') ? Number(params.get('scale')) : 1,
    quality: params.has('quality') ? Number(params.get('quality')) : 2,
    minQuality: params.has('quality') ? Number(params.get('quality')) : 0,
    maxQuality: params.has('quality') ? Number(params.get('quality')) : 2,
  });
  const storage = safeStorage();
  // (on a touch screen a sheet's corner presses its key, as the touch HUD's tabs do)
  const tap = (code) => touch.tap(code, performance.now() / 1000);
  const audio = createAudio({ enabled: params.get('audio') !== '0' });
  // (the sheets letter their lines for the hand on the game: src/core/words.js, game.wordMode)
  const wordMode = () => { try { return game.wordMode(); } catch { return 'keys'; } };
  const map = createMap(hudRoot, { onSelect: (id) => game.sim.setTarget(id), press: tap, mode: wordMode });
  const book = createBook(hudRoot, { press: tap, onTurn: () => audio.event('paper'), mode: wordMode });
  // Sound may start only inside a click, a tap or a key press (Safari for the whole session;
  // Chrome, where a gamepad is not a gesture): start it there, in the capture phase so that no
  // handler can swallow the event first. Idempotent; a running context ignores it.
  // (Esc and browser shortcuts are not gestures: where the browser can say, skip what is not one.)
  const wake = () => {
    if (audio.state === 'running') return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    audio.start(true);
  };
  for (const t of ['pointerdown', 'mousedown', 'keydown', 'touchend', 'click']) document.addEventListener(t, wake, { capture: true });
  // A hidden tab stops the frame loop: silence the mix rather than freeze it (src/audio/audio.js).
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.pause(); else audio.resume(); });
  // The sketchbook's pictures live beside the save (their own key); ?save=0 keeps them in memory.
  const sketches = new SketchStore(storage && params.get('save') !== '0' ? storage : null);
  if (params.get('fresh') === '1') sketches.clear();
  const game = new Game({
    renderer, scene, camera, world, painter, explorer, ship, input, hud, map, book, audio, params, physics, dyn, sketches,
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

  // The drawing buffer: the window's pixels at up to 1.5 device pixels per CSS pixel, and at
  // most OUTPUT_MAX_PIXELS (about 2560x1440; the coordinator's ruling on hardening review P7):
  // a 1080p screen and a Retina laptop keep every pixel, a 4K monitor draws about 1440p and the
  // browser stretches it (the paper composite runs at this size whatever the render scale).
  function resize() {
    const css = Math.max(1, canvas.clientWidth * canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(OUTPUT_MAX_PIXELS / css));
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    painter.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();
  // Moving the window to a screen of another scale changes the device pixel ratio without a
  // resize event in some browsers (hardening review P12): watch for it, and re-arm each time.
  const watchDpr = () => {
    try {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener('change', () => { resize(); watchDpr(); }, { once: true });
    } catch { /* an old browser: the resize event will have to do */ }
  };
  watchDpr();
  if (painter.setRenderScale) painter.setRenderScale(dyn.scale);
  painter.setQuality(dyn.quality);
  // PHYSICS' particle counts and sampling follow the tier too (hardening review P8): a tier
  // drop then sheds CPU as well as pixels, and the top tier gets its full storms.
  if (physics && physics.setQuality) physics.setQuality(dyn.quality);
  const showCard = params.get('card') !== '0';
  hud.showStart(showCard);
  if (!showCard) { game.started = true; game.hintOn = false; }
  else {
    // The title card is the loading screen: it says what it is waiting for, on the bare sheet.
    loading.textContent = '';
    hud.setWaiting(true);
    hud.setStartStatus('preparing the paper\u2026', true);
    game.canStart = false;
  }

  const sim = game.sim;
  // ?clock=even: every world turns at its own even rate (the game's clock is uneven: slow dusks
  // and dawns, short nights; an instrument that sets an hour and lets the clock run wants it even).
  if (params.get('clock') === 'even') sim.unevenClock = false;
  const debug = {
    game, sim, world, painter, renderer, scene, camera, dyn, physics, map, book, audio, storage, sketches, touch, using: prov.using, note: debugNote, gl,
    info: () => ({ ...game.info(), using: prov.using, fallback: prov.fallback, fps: debug.fps, frames: game.frameCount, scale: dyn.scale, quality: dyn.quality, settled: worldSettled(world, game.frameCount) }),
    teleport: (o) => sim.teleport(o),
    aimAt: (id) => sim.aimAt(id),
    setTimeScale: (k) => { sim.timeScale = Math.max(0, Math.min(20, k)); },
    // Force lightning (setMood.sky.flash = 1) for `frames` frames: nobody has seen it yet.
    flash: (frames = 1) => { game.forceFlash = Math.max(1, frames | 0); },
    // Set the game clock (seconds): the weather is a function of it. The sun moves with it
    // (use setHour or teleport({ hour }) afterwards to choose the light).
    setClock: (t) => { sim.t = Math.max(0, +t || 0); },
    setHour: (h) => { sim.eph.setSunHour(sim.bodyId, sim.t, norm3(sim.ex.p), h); },
    // Resolves when the world has had nothing left to build for `frames` frames in a row.
    settle: (frames = 12) => new Promise((resolve) => {
      let n = 0;
      const f = () => { n = worldSettled(world, game.frameCount) ? n + 1 : 0; if (n >= frames) resolve(true); else requestAnimationFrame(f); };
      f();
    }),
    // A test drives the clock itself (tests/motion.mjs): hold() stops the frame loop, step(dt, n)
    // then runs n frames of exactly dt seconds each, whatever the machine's pace.
    hold: (on = true) => { held = !!on; },
    step: (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) game.frame(dt); return game.frameCount; },
    fps: 0,
    errors: [],
  };
  let held = false;
  window.__pc = debug;
  window.addEventListener('error', (e) => debug.errors.push(String(e.message)));

  let last = performance.now();
  let settledFrames = 0;
  const warm = { started: false, done: false, frame: 0 };
  debug.warm = warm;
  let judged = 0;
  let fpsAcc = 0, fpsN = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dtMs = now - last;
    last = now;
    if (dtMs <= 0 || held) return;
    game.frame(dtMs / 1000);
    // The controller judges frames only once the first view is on the paper (loading and the
    // first settle are not the machine's pace), and not the first second after that.
    if (window.__pcReady) judged += dtMs / 1000;
    const r = judged > 1 ? dyn.frame(dtMs) : { changed: false };
    if (r.changed) {
      if (painter.setRenderScale) painter.setRenderScale(r.scale);
      painter.setQuality(r.quality);
      if (physics && physics.setQuality) physics.setQuality(r.quality);
    }
    fpsAcc += dtMs; fpsN++;
    if (fpsAcc > 500) { debug.fps = Math.round((1000 * fpsN) / fpsAcc * 10) / 10; fpsAcc = 0; fpsN = 0; }
    // "Ready" = a complete frame is on screen: the terrain around the camera has settled
    // (or, for a world that cannot say, a generous number of frames has passed).
    if (!window.__pcReady) {
      const settled = worldSettled(world, game.frameCount);
      settledFrames = settled ? settledFrames + 1 : 0;
      const firstView = settledFrames >= 2 || game.frameCount > 900;
      // Then, still behind the card, every shader the journey will need is compiled (a compile
      // in mid-game stalls the frame for 0.1 to 1 s on Windows' ANGLE and trips the resolution
      // controller): see prewarm() below.
      if (firstView && !warm.started) {
        warm.started = true;
        if (showCard) hud.setStartStatus('mixing the colours\u2026', true);
        prewarm({ world, painter, renderer, scene, camera }).then((r) => { Object.assign(warm, r); }, (e) => { warm.error = String((e && e.message) || e); })
          .then(() => { warm.done = true; warm.frame = game.frameCount; });
      }
      // Ready once warm and the view is whole again (the warm step may have built more), or a
      // generous number of frames after it.
      if (warm.done && (settledFrames >= 2 || game.frameCount > warm.frame + 300)) {
        window.__pcReady = true;
        dyn.rest();
        loading.classList.add('pc-done');
        hud.setWaiting(false);
        hud.setStartStatus('{click} to begin');
        game.canStart = true;
        if (world.setBuildBudget) world.setBuildBudget(5);
      }
    }
  }
  requestAnimationFrame(tick);
}

// Compile every shader the game will draw before the first frame counts (hardening review P3).
// PAINTER's hooks, when they exist (A2): world.prewarm() makes what is otherwise made late (every
// world's dabs and flora washes, the weather kits) and puts it where a compile of the scene finds
// it; painter.prewarm(scene, camera) compiles the scene as its scene pass draws it (into its own
// target) and lays each post-process pass once. Without the painter's hook, three compiles every
// material in the scene graph here, visible or not, with a render target bound: the scene is
// drawn into Painter's targets, and three keys a program by the bound target's colour space, so
// a compile for the screen would be compiled again at its first real draw. Then each program is
// asked for its uniforms, which waits for its link here, behind the card (without
// KHR_parallel_shader_compile the compile returns at once while the GPU process is still
// linking). A safety net of 90 s keeps a driver that never reports completion from holding the
// card. Resolves to what it did, for the read-out (window.__pc.warm).
async function prewarm({ world, painter, renderer, scene, camera }) {
  const t0 = performance.now();
  const programs = () => (renderer.info && renderer.info.programs ? renderer.info.programs.length : 0);
  const p0 = programs();
  const steps = [];
  const work = (async () => {
    if (typeof world.prewarm === 'function') { await world.prewarm(); steps.push('world'); }
    if (typeof painter.prewarm === 'function') { await painter.prewarm(scene, camera); steps.push('painter'); }
    else if (typeof renderer.compileAsync === 'function') {
      const rt = new THREE.WebGLRenderTarget(2, 2);
      const prev = renderer.getRenderTarget();
      let done;
      try { renderer.setRenderTarget(rt); done = renderer.compileAsync(scene, camera); }
      finally { renderer.setRenderTarget(prev); }
      await done;
      rt.dispose();
      steps.push('scene');
    }
    try { for (const p of renderer.info.programs || []) if (p && p.getUniforms) p.getUniforms(); } catch { /* the draw will tell */ }
    steps.push('linked');
  })();
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), 90000); });
  const how = await Promise.race([work.then(() => 'done'), late]);
  clearTimeout(timer);
  return { how, steps, ms: Math.round(performance.now() - t0), programs: programs() - p0 };
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

// What this browser's WebGL can do, from one throwaway context: WebGL 2 at all, EXT_clip_control
// (reversed depth), and float colour buffers (Painter's targets are half-float).
function probeGL() {
  const out = { webgl2: false, clipControl: false, floatTargets: false };
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return out;
    out.webgl2 = true;
    out.clipControl = !!gl.getExtension('EXT_clip_control');
    out.floatTargets = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch { /* out says what was found */ }
  return out;
}

function norm3(p) {
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / l, y: p.y / l, z: p.z / l };
}

boot().catch((e) => {
  console.error('[painted-cosmos] could not start:', e);
  say('the paper tore: ' + (e && e.message ? e.message : e));
});
