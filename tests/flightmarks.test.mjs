// The marks in flight (src/core/game.js updateMarks, driven in Node on stand-ins), from M4's second
// blind player:
//  - under the edge of space only the course's world (chosen on the map) is marked, not the world
//    the nose happens to point at ("Uranus 709 km" through Venus' air down to the ground);
//  - an edge arrow for a place behind the ship points to the side it lies on, the way to turn, and
//    keeps that side near dead behind ("the arrow pointing down meant behind"; "the label kept
//    jumping sides").
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { Game } = await import('../src/core/game.js');
const { S } = await import('../src/core/state.js');
const { BODIES } = await import('../src/data/bodies.js');

// The camera at the scene's origin looking down -z (the floating origin), 1 km over Venus' ground;
// Uranus straight ahead, every other world far off to the side.
function presenter(state, { target = 'uranus', locked = false, visited = true, site = null } = {}) {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 1, 1e9);
  cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const bodies = new Map();
  const R = BODIES.venus.radius;
  let k = 0;
  for (const id of Object.keys(BODIES)) {
    if (!BODIES[id].radius || id === 'sun') continue;
    const root = new THREE.Object3D();
    if (id === 'venus') root.position.set(0, -(R + 1000), 0);
    else if (id === 'uranus') root.position.set(0, 0, -7e5);
    else root.position.set(9e6, 2e6 * (k++), 0);
    bodies.set(id, root);
  }
  let marks = null;
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    camera: cam, renderer: { domElement: { clientWidth: 960, clientHeight: 540 } },
    world: { bodies }, _marks: [], _p: new THREE.Vector3(),
    hud: { setMarks: (list) => { marks = list.map((m) => ({ ...m })); } },
    shipModel: { object3D: { position: new THREE.Vector3(0, -2, -12) } },
    sim: { sm: { state }, target, targetLocked: locked, shipCam: { cockpit: false }, visited: visited ? { venus: true } : {} },
    landingSite: () => site,
  });
  return { g, marks: () => g.updateMarks({ active: { id: 'venus' }, view: 'chase' }) || marks, R };
}

test('in the air only the course\'s world is marked; the world the nose points at is not', () => {
  for (const st of [S.ATMOSPHERE, S.LANDING]) {
    const aimed = presenter(st).marks();
    assert.equal(aimed.filter((m) => m.label === 'Uranus').length, 0, `${st}: Uranus, only aimed at, is not marked under the edge of space (${JSON.stringify(aimed.map((m) => m.label))})`);
    const chosen = presenter(st, { locked: true }).marks();
    assert.equal(chosen.filter((m) => m.label === 'Uranus' && m.kind === 'target').length, 1, `${st}: Uranus chosen on the map is marked`);
  }
  for (const st of [S.SPACE, S.PULSE]) {
    const aimed = presenter(st).marks();
    assert.equal(aimed.filter((m) => m.label === 'Uranus' && m.kind === 'target').length, 1, `${st}: above the air the aimed world is marked as before`);
  }
});

test('the edge arrow of a place to land behind the ship points to its side, and keeps it near dead behind', () => {
  // A place 1.2 km behind and below (Venus' ground is 1 km down), a little to the right.
  const R = BODIES.venus.radius;
  const at = (x, z) => { const v = new THREE.Vector3(x, R + 1000 - 1000, z); return v.normalize().multiplyScalar(R); };
  const P = presenter(S.ATMOSPHERE, { visited: false, site: at(60, 1200) });
  const one = (m) => m.find((x) => x.label === 'a place to land');
  let m = one(P.marks());
  assert.ok(m && m.kind === 'edge', 'an edge arrow: ' + JSON.stringify(m));
  assert.ok(Math.cos(m.angle) > 0.9, `behind and to the right: the arrow points right, not down (angle ${(m.angle * 180 / Math.PI).toFixed(0)} deg)`);
  assert.ok(m.x > 960 * 0.8, 'at the right edge: x ' + m.x.toFixed(0));
  // The nose swings a little: the place now lies just left of dead behind. The arrow keeps its side.
  P.g.landingSite = () => at(-60, 1200);
  m = one(P.marks());
  assert.ok(Math.cos(m.angle) > 0.9, `near dead behind it keeps the side it had (angle ${(m.angle * 180 / Math.PI).toFixed(0)} deg)`);
  // Clearly to the left behind: it goes left.
  P.g.landingSite = () => at(-900, 1200);
  m = one(P.marks());
  assert.ok(Math.cos(m.angle) < -0.9, `clearly behind to the left: left (angle ${(m.angle * 180 / Math.PI).toFixed(0)} deg)`);
  // In front and below the picture it still points down: there down is the way.
  P.g.landingSite = () => at(0, -300);
  m = one(P.marks());
  assert.ok(m && m.kind === 'edge' && Math.sin(m.angle) > 0.9, `ahead and below: down (angle ${m && (m.angle * 180 / Math.PI).toFixed(0)} deg)`);
});

test('the course\'s world behind the ship: its edge arrow points to the side too', () => {
  const P = presenter(S.SPACE, { locked: true });
  P.g.world.bodies.get('uranus').position.set(-3e4, -2e5, 7e5);      // behind, below, a little left
  const m = P.marks().find((x) => x.label === 'Uranus');
  assert.ok(m && m.kind === 'edge', 'an edge arrow: ' + JSON.stringify(m));
  assert.ok(Math.cos(m.angle) < -0.9, `left, not down (angle ${(m.angle * 180 / Math.PI).toFixed(0)} deg)`);
});
