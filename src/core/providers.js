// THE integration switch: Pilot's stubs or Painter's real modules, behind one contract.
//
//   default        real modules where REAL_READY says they exist, stubs elsewhere
//   ?stub=1        force every stub            ?stub=render,world,art   force some
//   ?real=1        try every real module       ?real=world              try some (ahead of the flag)
//
// A real module that fails to load falls back to its stub with a console warning, never an
// error, so the game always starts. Flip a flag below when Painter's notes say
// "INTEGRATION: ready" for that module (a missing file would otherwise log a 404).
import * as stubPainter from './stubs/painter.js';
import * as stubWorld from './stubs/world.js';
import * as stubModels from './stubs/models.js';

export const REAL_READY = { render: false, world: false, art: false, ui: false };

const REAL_PATH = {
  render: '../render/index.js',
  world: '../world/index.js',
  art: '../art/models.js',
};
const STUB = { render: stubPainter, world: stubWorld, art: stubModels };
const NEEDS = {
  render: ['createPainter'],
  world: ['createWorld'],
  art: ['createExplorer', 'createShip'],
};

function listParam(v) {
  if (v == null) return [];
  if (v === '' || v === '1' || v === 'true' || v === 'all') return ['render', 'world', 'art', 'ui'];
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

export function planProviders(search, ready = REAL_READY) {
  const q = new URLSearchParams(search || '');
  const forceStub = listParam(q.has('stub') ? q.get('stub') : null);
  const forceReal = listParam(q.has('real') ? q.get('real') : null);
  const plan = {};
  for (const key of ['render', 'world', 'art', 'ui']) {
    if (forceStub.includes(key)) plan[key] = 'stub';
    else if (forceReal.includes(key)) plan[key] = 'real';
    else plan[key] = ready[key] ? 'real' : 'stub';
  }
  return plan;
}

export async function loadProviders(search) {
  const plan = planProviders(search);
  const mods = {};
  const using = {};
  for (const key of ['render', 'world', 'art']) {
    mods[key] = STUB[key];
    using[key] = 'stub';
    if (plan[key] !== 'real') continue;
    try {
      const m = await import(REAL_PATH[key]);
      const missing = NEEDS[key].filter((n) => typeof m[n] !== 'function');
      if (missing.length) throw new Error('missing export(s): ' + missing.join(', '));
      mods[key] = m;
      using[key] = 'real';
    } catch (e) {
      console.warn(`[painted-cosmos] Painter's ${key} module is not usable yet (${e && e.message}); using the stub.`);
    }
  }
  if (Object.values(using).includes('stub')) {
    const which = Object.keys(using).filter((k) => using[k] === 'stub').join(', ');
    console.warn(`[painted-cosmos] running with Pilot's stub for: ${which}. This is a mock-up, not the painted game.`);
  }
  using.ui = plan.ui;
  return {
    using,
    createPainter: mods.render.createPainter,
    RENDERER_OPTIONS: mods.render.RENDERER_OPTIONS || stubPainter.RENDERER_OPTIONS,
    makeWashMaterial: mods.render.makeWashMaterial || null,
    createWorld: mods.world.createWorld,
    createExplorer: mods.art.createExplorer,
    createShip: mods.art.createShip,
  };
}
