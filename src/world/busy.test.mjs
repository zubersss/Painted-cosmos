// The world's build queues, driven from Node without a browser. Run: node --test src/world/
//   - world.busy reaches 0 at the spawn, after the active body changes (PILOT's readiness
//     signal: lead review 3, item 2), and in deep space
//   - one frame's building stays near the budget it was given
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

// the page's import map, for Node: the bare 'three' specifier is the vendored build
const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { createWorld } = await import('./index.js');
const { QUALITY } = await import('../render/shared.js');
const { BODIES } = await import('../data/bodies.js');
const { getSurface, makeSample } = await import('./surface.js');

QUALITY.level = 1;
const scene = new THREE.Scene();
const world = createWorld(scene);
const cam = new THREE.Vector3(0, 0, 0);
world.sun.position.set(2e5, 1e5, 1.5e5);

// Put the camera `alt` metres above a body's spawn (floating origin: the body is moved, the
// camera stays at the scene origin), every other body far away.
function stand(bodyId, alt) {
  const sp = world.getSpawn(bodyId).unitDir;
  const s = world.sampleSurface(bodyId, sp);
  const r = Math.max(s.radius, s.liquidRadius || 0) + alt;
  let i = 0;
  for (const [id, root] of world.bodies) {
    if (id === bodyId) root.position.set(-sp.x * r, -sp.y * r, -sp.z * r);
    else root.position.set(6e5 * (i + 2), -4e5, -2e6 - i * 9e5);
    root.updateMatrixWorld(true);
    i++;
  }
}

function settle(activeId, maxUpdates) {
  let idle = 0, n = 0;
  while (idle < 2 && n < maxUpdates) { world.update(1 / 60, cam, activeId); idle = world.busy === 0 ? idle + 1 : 0; n++; }
  return n;
}

test('world.busy reaches 0 at the spawn, again after every change of body, and in deep space', () => {
  world.setBuildBudget(40);
  for (const id of ['earth', 'mars', 'neptune', 'mercury', 'earth']) {
    stand(id, 1.7);
    const n = settle(id, 4000);
    assert.equal(world.busy, 0, id + ': busy is ' + world.busy + ' after ' + n + ' updates');
    assert.ok(n < 4000, id + ' settled in ' + n + ' updates');
    const st = world.getStats();
    assert.ok(st.visible > 6, id + ': detail was built (' + st.visible + ' patches in view)');
  }
  // leaving for deep space drops everything that was wanted
  stand('earth', 1.7);
  world.update(1 / 60, cam, 'earth');
  stand('earth', BODIES.earth.radius * 6);
  world.update(1 / 60, cam, null);
  world.update(1 / 60, cam, null);
  assert.equal(world.busy, 0, 'deep space: busy is ' + world.busy);
});

test('jobs of the body just left are dropped at once, not worked off', () => {
  world.setBuildBudget(5);
  stand('saturn', 1.7);
  for (let i = 0; i < 4; i++) world.update(1 / 60, cam, 'saturn');
  assert.ok(world.busy > 0, 'arriving leaves work queued');
  stand('venus', 1.7);
  world.update(1 / 60, cam, 'venus');
  world.update(1 / 60, cam, 'venus');
  // what is still queued belongs to venus alone: saturn's share is gone after one update
  const total = world.busy;
  stand('saturn', BODIES.saturn.radius * 30);
  world.setBuildBudget(40);
  const n = settle('venus', 4000);
  assert.equal(world.busy, 0, 'venus settles (' + total + ' jobs were queued), took ' + n + ' updates');
});

test('one frame of building stays inside its slice while arriving', () => {
  // Descend onto a fresh body at 60 frames a second with the game's 5 ms budget. The machine
  // this runs on is shared, so wall-clock spikes say little: count the work instead (surface
  // samples, the unit all building is made of), priced at this machine's own speed.
  const S = getSurface('uranus'), proto = Object.getPrototypeOf(S), orig = proto.sample;
  const o = makeSample(S.nB);
  let unit = 1e9;
  for (let r = 0; r < 6; r++) {
    const t = performance.now();
    for (let i = 0; i < 4000; i++) { const a = i * 2.399963, y = 1 - 2 * (i + 0.5) / 4000, q = Math.sqrt(1 - y * y); orig.call(S, Math.cos(a) * q, y, Math.sin(a) * q, o, i % 3 === 0); }
    unit = Math.min(unit, (performance.now() - t) / (4000 * (1 + 0.6 / 3)));
  }
  let work = 0;
  proto.sample = function (x, y, z, out, full) { work += full ? 1.6 : 1; return orig.call(this, x, y, z, out, full); };
  world.setBuildBudget(5);
  let worst = 0, total = 0, walls = [];
  try {
    for (let f = 0; f < 420; f++) {
      stand('uranus', Math.max(1.7, 900 - f * 3));
      work = 0;
      const t = performance.now();
      world.update(1 / 60, cam, 'uranus');
      walls.push(performance.now() - t);
      if (work > worst) worst = work;
      total += work;
    }
  } finally { proto.sample = orig; }
  walls.sort((a, b) => a - b);
  assert.ok(total > 20000, 'the descent built something (' + total + ' samples)');
  const ms = worst * unit;
  // the slice is 4 ms of the 5 ms budget; the price of a sample is only known to about a third
  assert.ok(ms < 7, 'heaviest frame: ' + worst.toFixed(0) + ' samples, about ' + ms.toFixed(2) + ' ms of building at ' + (unit * 1000).toFixed(2) + ' us a sample'
    + ' (wall clock: median ' + walls[210].toFixed(2) + ', 95th ' + walls[399].toFixed(2) + ' ms)');
});
