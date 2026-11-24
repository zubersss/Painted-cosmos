// Every plant kit builds, at every level of detail, with every kind of spec a world's look hands it.
// Run: node --test src/world/
//   (2026-11-24) The look director found the snow world in the oil look throwing on load at v37: the bare winter
//   tree (KITS.broadleaf with spec.bare, Neptune's aurora_tundra) called bareGeometry(seed, lod), whose body had read a
//   `spec` it was never given since 19 Nov ("ReferenceError: spec is not defined"). The frame loop does not catch, so
//   the owner's favourite world froze, and no test built that kit with that spec. This walks them all.
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

const SPECS = [undefined, {}, { bare: true }, { fir: true }, { thin: true }];

test('every plant kit builds at every level of detail with every kind of spec', async () => {
  const fk = await import('./florakit.js');
  const tables = Object.entries(fk).filter(([name, v]) => /KITS$/.test(name) && v && typeof v === 'object');
  assert.ok(tables.length > 0, 'florakit.js exports kit tables');
  let built = 0;
  for (const [tname, table] of tables) {
    for (const [kind, make] of Object.entries(table)) {
      if (typeof make !== 'function') continue;
      for (const lod of [0, 1, 2]) {
        for (const spec of SPECS) {
          let g;
          assert.doesNotThrow(() => { g = make(7 + lod, lod, spec); }, `${tname}.${kind} lod ${lod} spec ${JSON.stringify(spec)}`);
          if (g && g.attributes && g.attributes.position) {
            assert.ok(g.attributes.position.count > 0, `${tname}.${kind} lod ${lod}: a geometry with no vertices`);
            built++;
          }
        }
      }
    }
  }
  assert.ok(built > 0, 'some kits built geometry');
});
