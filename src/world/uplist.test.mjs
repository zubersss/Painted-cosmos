// Painted Cosmos: the ground's short uniform list (world/terrain.js pickUniformList). OWNER: PAINTER (the far view).
// Run: node --test src/world/uplist.test.mjs
// three.js re-sends a material's whole uniform list for every draw that sets uniformsNeedUpdate; the ground sets it for
// every patch. pickUniformList hands three the full list for the first patch of each render call and a short one (the
// four per-patch values and the textures) for the rest. This checks the choice against a stand-in for three's own
// bookkeeping (renderer.properties, info.render.frame, a program's uniform sequence). The picture itself is checked by a
// pixel proof in the browser (?uplist=0 against the default), which a test here cannot do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { pickUniformList, UPLIST } = await import('./terrain.js');

const tex = { isTexture: true };
function makeWorld() {
  const uniforms = { uOrigin: { value: 1 }, uAnchor: { value: 2 }, uCamLocal: { value: 3 }, uMorph: { value: 4 },
    uSunDirW: { value: [0, 1, 0] }, uOilA: { value: [1, 2, 3, 4] }, uNoise3D: { value: tex }, uDabId: { value: tex }, uBodyR: { value: 4000 } };
  const material = { uniforms };
  const prog = (names) => ({ getUniforms: () => ({ seq: names.map((id) => ({ id })) }) });
  const p1 = prog(['uSunDirW', 'uOrigin', 'uNoise3D', 'uAnchor', 'uOilA', 'uCamLocal', 'uMorph', 'uDabId', 'uBodyR', 'projectionMatrix']);
  const mp = { currentProgram: p1, uniforms, uniformsList: [] };
  const renderer = { properties: { get: () => mp }, info: { render: { frame: 1 } } };
  return { material, mp, renderer, p1, prog, st: { prog: null, full: null, short: null, frame: -1 } };
}
const ids = (l) => l.map((u) => u.id);

test('the first patch of a render takes the full list, the rest the short one', () => {
  const w = makeWorld();
  pickUniformList(w.renderer, w.material, w.st);
  assert.deepEqual(ids(w.mp.uniformsList), ['uSunDirW', 'uOrigin', 'uNoise3D', 'uAnchor', 'uOilA', 'uCamLocal', 'uMorph', 'uDabId', 'uBodyR']);
  pickUniformList(w.renderer, w.material, w.st);
  assert.deepEqual(ids(w.mp.uniformsList), ['uOrigin', 'uNoise3D', 'uAnchor', 'uCamLocal', 'uMorph', 'uDabId']);
  pickUniformList(w.renderer, w.material, w.st);
  assert.equal(w.mp.uniformsList.length, 6);
  // the next render call: the full list again for its first patch
  w.renderer.info.render.frame = 2;
  pickUniformList(w.renderer, w.material, w.st);
  assert.equal(w.mp.uniformsList.length, 9);
  pickUniformList(w.renderer, w.material, w.st);
  assert.equal(w.mp.uniformsList.length, 6);
});

test('a program three has rebuilt gets its own lists, full first', () => {
  const w = makeWorld();
  pickUniformList(w.renderer, w.material, w.st);
  pickUniformList(w.renderer, w.material, w.st);
  w.mp.currentProgram = w.prog(['uOrigin', 'uAnchor', 'uCamLocal', 'uMorph', 'uOilA', 'uNoise3D']);
  pickUniformList(w.renderer, w.material, w.st);
  assert.deepEqual(ids(w.mp.uniformsList), ['uOrigin', 'uAnchor', 'uCamLocal', 'uMorph', 'uOilA', 'uNoise3D']);
  pickUniformList(w.renderer, w.material, w.st);
  assert.deepEqual(ids(w.mp.uniformsList), ['uOrigin', 'uAnchor', 'uCamLocal', 'uMorph', 'uNoise3D']);
});

test('before three has made a list, nothing is touched; switched off, every list is whole', () => {
  const w = makeWorld();
  w.mp.uniformsList = null;
  pickUniformList(w.renderer, w.material, w.st);
  assert.equal(w.mp.uniformsList, null);
  w.mp.uniformsList = [];
  UPLIST.on = false;
  try {
    for (let i = 0; i < 3; i++) { pickUniformList(w.renderer, w.material, w.st); assert.equal(w.mp.uniformsList.length, 9); }
  } finally { UPLIST.on = true; }
});
