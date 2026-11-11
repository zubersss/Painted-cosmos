// The stub guard: a browser check fails when the real game falls back to PILOT's stubs without
// being asked to (an import cycle once made every real module fall back, and every Node test
// still passed). fallbackProblem (tests/browser.mjs) reads the game's own list of modules it
// tried and could not load (info().fallback, src/core/providers.js and src/main.js); this
// drives it with a stand-in page, so it needs no browser. (providers.js imports three through
// the page's import map, so it cannot be loaded in Node: its list is checked in the browser runs.)
import test from 'node:test';
import assert from 'node:assert/strict';

let B = null, why = '';
try { B = await import('./browser.mjs'); } catch (e) { why = String(e && e.message).slice(0, 120); }
const skip = B && B.fallbackProblem ? false : 'tests/browser.mjs not importable here: ' + why;

// A page whose evaluate() runs the function against a given window.__pc.
const pageWith = (info) => ({ evaluate: async (fn) => { const keep = globalThis.window; globalThis.window = { __pc: info ? { info: () => info } : undefined }; try { return fn(); } finally { globalThis.window = keep; } } });

test('a run on the real game passes; a module that fell back fails it, named', { skip }, async () => {
  const real = { using: { render: 'real', world: 'real', art: 'real', physics: 'real', ui: 'stub' }, fallback: [] };
  assert.equal(await B.fallbackProblem(pageWith(real), 'quality=2'), null, 'the ui key is PILOT\'s own and never counts');
  const broken = { using: { render: 'stub', world: 'stub', art: 'stub', physics: 'real', ui: 'stub' }, fallback: ["render: Cannot access 'FLORA' before initialization", 'world: same', 'art: same'] };
  const why = await B.fallbackProblem(pageWith(broken), 'quality=2');
  assert.match(why, /fell back to the stub for render: Cannot access 'FLORA'/);
  assert.match(await B.fallbackProblem(pageWith(null), ''), /did not start/);
});

test('stubs asked for are not a fall-back; an older game without the list is judged by its query', { skip }, async () => {
  const asked = { using: { render: 'stub', world: 'stub', art: 'stub', physics: 'real', ui: 'stub' }, fallback: [] };
  assert.equal(await B.fallbackProblem(pageWith(asked), 'stub=render,world,art'), null);
  const old = { using: { render: 'stub', world: 'real', art: 'real', physics: 'real', ui: 'stub' } };
  assert.match(await B.fallbackProblem(pageWith(old), 'quality=1'), /stub for render/);
  assert.equal(await B.fallbackProblem(pageWith(old), 'stub=render'), null);
});
