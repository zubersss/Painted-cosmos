// The far impostors' views (render/impostor.js): every baked direction finds its own view again, the views cover the
// sky above a tree from the horizon to straight down, an eye below the horizon is given the lowest ring, and the
// shader's arithmetic (written out again here as the vertex shader does it) agrees with the bake's.
// Run: node --test src/world/
import test from 'node:test';
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

const THREE = await import('three');
const { viewDir, viewCell, viewBasis, IMP, impostorQuadGeometry } = await import('../render/impostor.js');

// the vertex shader's choice of view, line for line (IMP_VERT)
function shaderCell(d, N) {
  const dh = [d.x, Math.max(d.y, 0), d.z];
  const s = Math.abs(dh[0]) + dh[1] + Math.abs(dh[2]) + 1e-6;
  const x = dh[0] / s, z = dh[2] / s;
  const c = [(x + z) * 0.5 + 0.5, (x - z) * 0.5 + 0.5].map((v) => Math.min(N - 1, Math.max(0, Math.floor(v * N))));
  const qc = c.map((v) => ((v + 0.5) / N) * 2 - 1);
  const pc = [(qc[0] + qc[1]) * 0.5, (qc[0] - qc[1]) * 0.5];
  const dc = new THREE.Vector3(pc[0], 1 - Math.abs(pc[0]) - Math.abs(pc[1]), pc[1]).normalize();
  return { c, dc };
}

test('every baked view is found again from its own direction, by the bake and by the shader', () => {
  const N = IMP.views;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = viewDir(i, j, N);
    assert.ok(d.y >= -1e-9, 'a baked view looks down on the tree, never up');
    assert.deepEqual(viewCell(d, N), [i, j]);
    const s = shaderCell(d, N);
    assert.deepEqual(s.c, [i, j]);
    assert.ok(s.dc.distanceTo(d) < 1e-6, 'the shader turns the quad to the very direction the view was baked from');
  }
});

test('the views reach from the horizon to nearly straight down, no two far apart', () => {
  const N = IMP.views, dirs = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) dirs.push(viewDir(i, j, N));
  const lo = Math.min(...dirs.map((d) => d.y)), hi = Math.max(...dirs.map((d) => d.y));
  assert.ok(lo < 0.15, 'a view near the horizon (lowest ' + lo.toFixed(3) + ')');
  assert.ok(hi > 0.95, 'a view from nearly straight above (highest ' + hi.toFixed(3) + ')');
  // any direction in the upper half has a baked view within about 17 degrees (MEASURED 16.7 at the worst corner of a
  // cell; the hemi-octahedron's cells are largest at the horizon's diagonals; about 13 degrees between neighbours)
  let worst = 0;
  for (let k = 0; k < 2000; k++) {
    const a = (k * 2.399963) % (Math.PI * 2), y = (k + 0.5) / 2000;
    const r = Math.sqrt(1 - y * y), d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const [ci, cj] = viewCell(d, N);
    worst = Math.max(worst, d.angleTo(viewDir(ci, cj, N)));
  }
  assert.ok(worst < (17.5 * Math.PI) / 180, 'the view chosen is never more than 17.5 degrees off (worst ' + ((worst * 180) / Math.PI).toFixed(1) + ')');
});

test('an eye below the horizon takes the lowest ring, the same way round', () => {
  const N = IMP.views;
  const below = new THREE.Vector3(0.8, -0.3, 0.2).normalize();
  const [i, j] = viewCell(below, N);
  const d = viewDir(i, j, N);
  assert.ok(d.y < 0.2, 'a low view');
  assert.ok(d.x > 0.5, 'facing the same way round');
});

test('the quad is square to its view, with its up tilted toward the sky', () => {
  for (const [i, j] of [[0, 0], [3, 4], [7, 7], [4, 3], [0, 7]]) {
    const d = viewDir(i, j), b = viewBasis(d);
    assert.ok(Math.abs(b.right.dot(d)) < 1e-6 && Math.abs(b.up.dot(d)) < 1e-6 && Math.abs(b.right.dot(b.up)) < 1e-6);
    assert.ok(b.up.y >= -1e-6, 'up is never upside down');
  }
  const g = impostorQuadGeometry();
  assert.equal(g.index.count, 6, 'two triangles a tree');
});
