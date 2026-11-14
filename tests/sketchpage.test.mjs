// The first page of the sketchbook (the game's own presenter, src/core/game.js, driven in Node on
// stand-ins): a new player gets it a few seconds in, and it is a page of the place, not of the
// parked ship's hull.
//
// At the game's start the explorer stands 16 m from the ship with the hull in the middle of the
// frame. The pre-ship round made a page wait for the hull within 40 m (it was 14) for up to 45 s,
// longer than a wanted page lives (40 s past its time): the first page never came while the player
// stood there, and tests/m3check.mjs failed ("the first landscape walked gets a sketch: []").
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

// the page's import map, for Node: the bare 'three' specifier is the vendored build
const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { Game } = await import('../src/core/game.js');
const { S } = await import('../src/core/state.js');
const { SKETCH } = await import('../src/core/sketches.js');
const { Sim } = await import('../src/core/sim.js');
const { stubSurface, stubSpawn } = await import('../src/core/stubs/surface.js');
const { Pad, play } = await import('./helpers.mjs');

// A canvas whose 2D context records what the painter last painted when the frame is read.
function fakeCanvas(state) {
  const n = SKETCH.width * SKETCH.height * 4;
  return {
    width: 0, height: 0,
    getContext: () => ({
      drawImage: () => { state.kept = state.last ? { ...state.last } : null; },
      getImageData: (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < data.length; i += 4) { const v = 40 + ((i / 4) % w) * 0.8; data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255; }
        return { data, width: w, height: h };
      },
      putImageData: () => {},
    }),
    toDataURL: () => 'data:image/jpeg;base64,' + 'A'.repeat(Math.min(4000, n / 100)),
  };
}

function presenter() {
  const state = { last: null, kept: null, paints: 0 };
  const fig = { visible: true }, hull = { visible: true };
  globalThis.document = globalThis.document || { createElement: () => fakeCanvas(state) };
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    explorerModel: { object3D: fig }, shipModel: { object3D: hull },
    scene: {}, camera: { position: {} }, _activeId: 'earth',
    world: { update: () => {}, busy: 0 },
    painter: { render: () => { state.paints++; state.last = { figure: fig.visible, ship: hull.visible }; } },
    renderer: { domElement: { width: 640, height: 360 } },
    _sketchCanvas: fakeCanvas(state),
  });
  return { g, state, fig, hull };
}

test('the kept frame is of the place: neither the figure nor the parked ship is in it, and both are back after', () => {
  const { g, state, fig, hull } = presenter();
  const url = g.captureSketch('b:earth:stub-lowland');
  assert.ok(url && url.startsWith('data:image/jpeg'), 'a page is made');
  assert.ok(state.kept, 'the frame was read after a paint');
  assert.equal(state.kept.figure, false, 'the figure steps out of the kept frame');
  assert.equal(state.kept.ship, false, 'the parked ship steps out of the kept frame (a page of its hull is no page of the place)');
  assert.ok(fig.visible && hull.visible, 'both are back in the picture after');
  assert.deepEqual(state.last, { figure: true, ship: true }, 'and the frame the player sees is painted again as it was');
  // a ship already out of the picture (not drawn) stays out
  const b = presenter();
  b.hull.visible = false;
  b.g.captureSketch('b:earth:stub-lowland');
  assert.equal(b.hull.visible, false, 'a ship that was not drawn is not put back into the picture');
});

test('a new player gets the first page a few seconds in, with the parked ship in the middle of the first view', () => {
  // The real simulation at the game's start on the stub world (as tests/m3check.mjs plays it).
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
  const pad = new Pad();
  play(sim, pad, 0.5);
  assert.equal(sim.sm.state, S.ON_FOOT);
  assert.ok(sim.shipInPicture(), 'the first view has the parked ship in the middle of the frame (the case that failed)');
  const { g } = presenter();
  const kept = [];
  Object.assign(g, {
    sim, started: true, frameCount: 0, _sketchWant: {},
    sketches: { has: (k) => kept.some((x) => x.key === k), put: (k, url) => { kept.push({ key: k, url, t: sim.t }); return true; } },
    biomesOf: () => null, bookProgress: () => ({ done: kept.length, total: 31 }),
    hud: { showSketch: () => {} }, audio: null,
  });
  // The game calls this once a frame, straight after the frame is painted; the explorer stands still.
  const t0 = sim.t;
  while (sim.t - t0 < 25 && !kept.length) {
    play(sim, pad, 1 / 30);
    g.frameCount++;
    g.updateSketches();
  }
  assert.equal(kept.length, 1, `the first landscape gets its page within 25 s of standing at the start (kept: ${kept.length})`);
  assert.match(kept[0].key, /^b:earth:/);
  assert.ok(kept[0].t - t0 < 6, `a few seconds in: ${(kept[0].t - t0).toFixed(1)} s`);
  assert.ok(sim.shipInPicture(), 'with the hull still in the middle of the view (the page is drawn without it)');
});
