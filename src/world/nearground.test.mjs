// THE NEAR GROUND DENSER (world/nearground.js ?dense=1, the flora lane). Run: node --test src/world/nearground.test.mjs
// Off, the near rings are laid from exactly the numbers they had; on, only the numbers DENSE_K names change, and the far
// and vista rings are the same rings. (What it looks like and what it costs are judged in stills and counted in Node.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { LOOK } = await import('../render/shared.js');
const { FLORA, ringsFor, DENSE_K } = await import('./nearground.js');
LOOK.oil = true; FLORA.grass2 = 1;
const byName = (rs) => new Map(rs.map((r) => [r.name, r]));

test('off: the near rings are laid from the numbers they had', () => {
  const R = byName(ringsFor(0));
  assert.deepEqual(R.get('carpet').range, [0, 7, 8]); assert.equal(R.get('carpet').per, 20);
  assert.deepEqual(R.get('fine').range, [11, 12, 23]); assert.equal(R.get('fine').per, 12);
  assert.equal(R.get('mid').per, 7);
  for (const r of R.values()) for (const k of ['bk', 'fk', 'lo', 'room', 'per0']) assert.equal(r[k], undefined, r.name + ' has ' + k + ' with the switch off');
});

test('on: only the numbers DENSE_K names change; the far and vista rings are the same rings', () => {
  const A = byName(ringsFor(0)), B = byName(ringsFor(1));
  assert.deepEqual([...A.keys()], [...B.keys()]);
  for (const [name, a] of A) {
    const b = B.get(name), K = DENSE_K[name] || {};
    if (!DENSE_K[name]) { assert.equal(b, a, name + ' should be the same ring'); continue; }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k in K) assert.deepEqual(b[k], K[k], name + '.' + k);
      else assert.deepEqual(b[k], a[k], name + '.' + k + ' changed');
    }
  }
  // the phone's tier reaches farther and lays more; the top tier's reach of the fine ring is as it was
  assert.ok(B.get('fine').range[1] > A.get('fine').range[1] && B.get('fine').range[2] === A.get('fine').range[2]);
  assert.ok(B.get('carpet').per > A.get('carpet').per && B.get('mid').per > A.get('mid').per);
});

test('with the lane off (?grass2=0 / ?flora=old) the switch changes nothing', () => {
  FLORA.grass2 = 0;
  try { assert.deepEqual(ringsFor(1), ringsFor(0)); } finally { FLORA.grass2 = 1; }
});
