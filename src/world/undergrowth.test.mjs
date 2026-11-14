// R1 W2.3 (docs/lead/SHARP-SMOOTH-PLAN.md, PAINTER W2 item 3): the undergrowth is built and submitted only where a
// stroke of it can be seen. Run: node --test src/world/
//   - on foot every undergrowth mesh that is submitted has a stroke within its reach, and every one that has is submitted
//   - from the ship 150 m up no undergrowth mesh is submitted (98 draws of nothing before), at 1 km none is even kept
//   - on a descent from 1 km at 15 m/s every cell that can show a stroke is laid by 110 m, and at touchdown as many
//     cells are laid as on a standing start
// A stroke's reach is PROP_VERT's (render/materials.js): a stroke is drawn while its root is nearer than
// uLod.y x (1 + (seed - 0.5) uLod.z), uLod = the mesh's lod with the range scale of the tier on x and y.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { createWorld } = await import('./index.js');
const { QUALITY } = await import('../render/shared.js');

QUALITY.level = 2;
const scene = new THREE.Scene();
const world = createWorld(scene);
const cam = new THREE.Vector3(0, 0, 0);
world.sun.position.set(2e5, 1e5, 1.5e5);
const sp = world.getSpawn('earth').unitDir;

// the camera `alt` metres above the Earth's spawn (the body is moved, the camera stays at the origin), as game.js places
// the bodies: each root's own matrix
function place(alt) {
  const s = world.sampleSurface('earth', sp);
  const r = Math.max(s.radius, s.liquidRadius || 0) + alt;
  let i = 0;
  for (const [id, root] of world.bodies) {
    if (id === 'earth') root.position.set(-sp.x * r, -sp.y * r, -sp.z * r);
    else root.position.set(6e5 * (i + 2), -4e5, -2e6 - i * 9e5);
    root.updateWorldMatrix(false, false);
    i++;
  }
}
function settle(alt, max = 6000) {
  world.setBuildBudget(40);
  let idle = 0, n = 0;
  while (idle < 3 && n < max) { place(alt); world.update(1 / 60, cam, 'earth'); idle = world.busy === 0 ? idle + 1 : 0; n++; }
  return n;
}

// each undergrowth mesh's kit and lod, as flora.js makes them: [kit, lod far, lod jitter]
const LODS = [['grass', 30, 0.9], ['fern', 110, 0.5], ['reed', 110, 0.4], ['flower', 88, 0.5], ['bush', 110, 0.3], ['rock', 110, 0.3], ['shard', 110, 0.3]];
const _v = new THREE.Vector3();
function census() {
  const fl = world._flora, K = fl.kit, k = fl.rangeScale, camL = fl.camLocal;
  const c = { cells: 0, laid: 0, drawn: 0, seeable: 0, drawnUnseeable: 0, seeableHidden: 0, pending: 0 };
  for (const [map, maxReach] of [[fl.underChunks, 30 * 1.45], [fl.under2Chunks, 110 * 1.25]]) for (const ch of map.values()) {
    // a cell that could show a stroke: built and laid, or not (still to come)
    if (ch.origin.distanceTo(camL) - ch.size * 0.75 < maxReach * k && (!ch.built || ch.held)) c.pending++;
    if (!ch.built) continue;
    c.cells++; if (!ch.held) c.laid++;
    for (const m of ch.meshes) {
      const lod = LODS.find(([n]) => K[n] && K[n].index === m.geometry.index);
      assert.ok(lod, 'every undergrowth mesh is on a kit geometry');
      const reach = lod[1] * k * (1 + 0.5 * lod[2]), a = m.instanceMatrix.array;
      let near = 1e9;
      for (let i = 0; i < m.count; i++) { _v.set(a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]).add(m.position); near = Math.min(near, _v.distanceTo(camL)); }
      const drawn = m.visible && m.count > 0 && !ch.held, seeable = near < reach && !ch.held;
      if (drawn) c.drawn++;
      if (seeable) c.seeable++;
      if (drawn && !seeable) c.drawnUnseeable++;
      if (seeable && !drawn && !(m.userData.skipLow && QUALITY.level === 0)) c.seeableHidden++;
    }
  }
  return c;
}

let ground0 = null;
test('on foot: an undergrowth mesh is submitted exactly when a stroke of it can be seen', () => {
  settle(1.7);
  const c = census();
  ground0 = c;
  assert.ok(c.cells > 50 && c.seeable > 50, 'undergrowth is laid round the eye: ' + JSON.stringify(c));
  assert.equal(c.drawnUnseeable, 0, 'meshes submitted with no stroke in reach: ' + JSON.stringify(c));
  assert.equal(c.seeableHidden, 0, 'meshes with a stroke in reach left out: ' + JSON.stringify(c));
});

test('from the ship: no undergrowth submitted 150 m up, none kept 1 km up', () => {
  for (let a = 1.7; a <= 150; a += 1) { place(a); world.update(1 / 60, cam, 'earth'); }
  for (let i = 0; i < 60; i++) { place(150); world.update(1 / 60, cam, 'earth'); }
  const c150 = census();
  assert.equal(c150.drawn, 0, '150 m up: undergrowth meshes submitted: ' + JSON.stringify(c150));
  for (let a = 150; a <= 1000; a += 4) { place(a); world.update(1 / 60, cam, 'earth'); }
  for (let i = 0; i < 60; i++) { place(1000); world.update(1 / 60, cam, 'earth'); }
  const c1k = census();
  assert.equal(c1k.cells, 0, '1 km up: undergrowth cells kept: ' + JSON.stringify(c1k));
});

test('a descent from 1 km at 15 m/s: the undergrowth is laid by 110 m, and as much at touchdown as on a standing start', () => {
  world.setBuildBudget(10, { fixed: true });
  let at110 = null;
  for (let a = 1000; a > 1.7; a -= 15 / 60) {
    place(a); world.update(1 / 60, cam, 'earth');
    if (!at110 && a <= 110) at110 = census();
  }
  assert.equal(at110.pending, 0, 'at 110 m cells that could show a stroke are not laid: ' + JSON.stringify(at110));
  assert.equal(at110.seeableHidden, 0, 'at 110 m: ' + JSON.stringify(at110));
  assert.equal(at110.drawnUnseeable, 0, 'at 110 m: ' + JSON.stringify(at110));
  assert.ok(at110.seeable > 10, 'at 110 m some undergrowth can be seen: ' + JSON.stringify(at110));
  settle(1.7);
  const c = census();
  assert.ok(Math.abs(c.laid - ground0.laid) <= 0.1 * ground0.laid, 'laid cells at touchdown ' + c.laid + ' against ' + ground0.laid + ' on a standing start');
  assert.equal(c.seeable, ground0.seeable, 'the same undergrowth can be seen');
  assert.equal(c.drawnUnseeable + c.seeableHidden, 0, JSON.stringify(c));
});

// (the same item: world.update brought every body's whole tree up to date twice a frame, by force, for nothing: the
// renderer does it before it draws. Now only the roots' own matrices: the meshes under them are not walked.)
test('world.update does not walk the meshes under the bodies to update their matrices', () => {
  settle(1.7);
  const P = THREE.Object3D.prototype, keep = [P.updateMatrixWorld, P.updateWorldMatrix];
  let n = 0, meshes = 0;
  // (calls on meshes only: a root's own world matrix is brought up to date, with the scene above it, by every
  // getWorldPosition and worldToLocal, and that is the work wanted)
  P.updateMatrixWorld = function (...a) { if (this.isMesh) n++; return keep[0].apply(this, a); };
  P.updateWorldMatrix = function (...a) { if (this.isMesh) n++; return keep[1].apply(this, a); };
  try { for (let i = 0; i < 10; i++) { place(1.7); world.update(1 / 60, cam, 'earth'); } }
  finally { P.updateMatrixWorld = keep[0]; P.updateWorldMatrix = keep[1]; }
  scene.traverse((o) => { if (o.isMesh) meshes++; });
  assert.ok(meshes > 500, 'a full world is built: ' + meshes + ' meshes');
  assert.ok(n / 10 < 20, 'meshes whose matrices are updated a frame: ' + n / 10 + ' (the scene holds ' + meshes + ' meshes)');
});
