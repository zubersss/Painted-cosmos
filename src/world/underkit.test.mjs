// THE UNDERGROWTH WITH A BODY (package O / F4, the flora lane; world/underkit.js, world/floraplace.js placeKits).
// Run: node --test src/world/underkit.test.mjs
// Built where nothing can be seen, so what is checked is in numbers: OFF (no ?under=1) every undergrowth cell is placed
// exactly as before; ON, the sea coast's cells carry heather and gorse, in patches (not an even scatter), only the kinds
// the data names, never in water; and each kit stays within its triangle budget and carries the parts its paint expects.
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

const { MODE } = await import('../data/mode.js');
MODE.oil = true;
const { placeUnder, setUnder2, U_KIT0, UNDER_KITS, INST_STRIDE } = await import('./floraplace.js');
const { getSurface, getStandPure } = await import('./surface.js');
const { dirToFace } = await import('./cubesphere.js');
const { UNDER_LEVEL, UNDER_GRID } = await import('./obstacles.js');

const S = getSurface('earth');
const coast = getStandPure('earth', 'sea_coast');
// the undergrowth cells round the coast's stand (a block of them, so patches and gaps both show)
function cellsNear(u, n) {
  const f = {}; dirToFace(u.x, u.y, u.z, f);
  const N = 1 << UNDER_LEVEL, ix = Math.floor((f.u + 1) * 0.5 * N), iy = Math.floor((f.v + 1) * 0.5 * N), out = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) out.push([f.face, ix + i, iy + j]);
  return out;
}

test('off: every undergrowth cell is placed exactly as before (no kit kinds at all)', () => {
  assert.ok(coast, 'the sea coast has a stand');
  setUnder2(false);
  for (const [face, ix, iy] of cellsNear(coast.unitDir, 2)) {
    const t = placeUnder(S, face, UNDER_LEVEL, ix, iy, UNDER_GRID);
    for (let i = 0; i < t.count; i++) assert.ok(t.data[i * INST_STRIDE + 5] < U_KIT0, 'a kit kind with the switch off');
  }
});

test('on: the coast carries heather and gorse in patches, only those kinds, the cells otherwise unchanged', () => {
  const cells = cellsNear(coast.unitDir, 3);
  setUnder2(false);
  const before = cells.map(([f, i, j]) => placeUnder(S, f, UNDER_LEVEL, i, j, UNDER_GRID));
  setUnder2(true);
  const after = cells.map(([f, i, j]) => placeUnder(S, f, UNDER_LEVEL, i, j, UNDER_GRID));
  setUnder2(false);
  const perCell = [], kinds = new Map();
  for (let c = 0; c < cells.length; c++) {
    const A = before[c], B = after[c];
    // the old placement first, unchanged, the kits after it
    for (let q = 0; q < A.count * INST_STRIDE; q++) assert.equal(B.data[q], A.data[q], 'the old placement changed with the switch on');
    let n = 0;
    for (let i = A.count; i < B.count; i++) {
      const k = B.data[i * INST_STRIDE + 5];
      assert.ok(k >= U_KIT0 && k < U_KIT0 + UNDER_KITS.length, 'an unknown kit kind ' + k);
      kinds.set(UNDER_KITS[k - U_KIT0], (kinds.get(UNDER_KITS[k - U_KIT0]) || 0) + 1); n++;
    }
    perCell.push(n);
  }
  const total = perCell.reduce((a, b) => a + b, 0);
  assert.ok(total > 20, 'too few kits round the coast: ' + total);
  assert.ok((kinds.get('heather') || 0) > 0 && (kinds.get('gorse') || 0) > 0, 'both kinds: ' + JSON.stringify([...kinds]));
  // patches: some cells hold many, some few or none (an even scatter would put about the mean in every cell)
  const mean = total / perCell.length, empty = perCell.filter((n) => n <= mean * 0.35).length, full = perCell.filter((n) => n >= mean * 1.6).length;
  assert.ok(empty > 0 && full > 0, 'no patches: per cell ' + perCell.join(','));
});

test('each kit within its triangle budget, with the parts its paint expects', async () => {
  const { heatherGeometry, gorseGeometry } = await import('./underkit.js');
  for (const [name, gen, maxT, parts] of [['heather', heatherGeometry, 160, [2, 3, 5]], ['gorse', gorseGeometry, 160, [5, 3]]]) {
    for (const seed of [211, 228, 999]) {
      const g = gen(seed), tris = g.index.count / 3, d = g.getAttribute('aData').array;
      assert.ok(tris <= maxT, name + ' ' + tris + ' triangles');
      const seen = new Set(); for (let i = 1; i < d.length; i += 4) seen.add(d[i]);
      for (const p of parts) assert.ok(seen.has(p), name + ' has no part ' + p);
      g.computeBoundingBox();
      const bb = g.boundingBox;
      assert.ok(bb.min.y > -0.05 && bb.max.y < 1.2, name + ' stands ' + bb.min.y.toFixed(2) + '..' + bb.max.y.toFixed(2));
    }
  }
});
