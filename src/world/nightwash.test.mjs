// The deeper night wash over the near land is a world's own, not every world's. Run: node --test src/world/
//   PAINTER 19 (the M4 pre-ship round, item 3): Mars by night was one blue-grey wash from the sky to the boots, so the
//   sheet was given a graded darker wash over the land within about twenty metres at night (post.js). It was laid on
//   every world, and the verifier of the round measured Earth's nocturnes flatter for it: the spawn's moonlit meadow at
//   the top tier (L* 10-90 spread 19.9 -> 16.9) and the sea coast's pale beach (12.6 -> 11.4) sank toward the wood's and
//   the sea's value. Its strength is now a look's `nightNear` (Mars 0.30); a look that says nothing has none, and the
//   sheet then lays exactly what it laid before the wash existed.
//   The sheet's shader cannot run in Node; what is checked is the data, that the files parse, and the plumbing, read
//   as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p) => fs.readFileSync(path.resolve(here, '..', p), 'utf8');

test('the near-land night wash is laid only where a look asks for it (Mars), never on Earth', async () => {
  const { LOOKS } = await import(pathToFileURL(path.resolve(here, '../data/looks.js')).href);
  const asking = Object.keys(LOOKS).filter((id) => (LOOKS[id].nightNear || 0) > 0);
  assert.deepEqual(asking, ['mars'], 'worlds with a near-land night wash');
  assert.ok(LOOKS.mars.nightNear > 0.2 && LOOKS.mars.nightNear <= 0.4, 'Mars keeps the wash item 3 was judged with');
  assert.ok(!LOOKS.earth.nightNear, 'Earth: the moonlit meadow and the pale beach keep their value');

  // the files parse (a backtick in a shader's comment once closed the template string: the game fell back)
  for (const f of ['render/post.js', 'render/index.js', 'render/shared.js', 'world/index.js']) {
    const r = spawnSync(process.execPath, ['--check', path.resolve(here, '..', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, f + ' parses: ' + r.stderr);
  }
  // the sheet: the wash's strength is the uniform, not a number of its own
  const post = src('render/post.js');
  const line = post.split('\n').find((l) => /nearLand\s*\*\s*\(1\.0 - lamp\)/.test(l));
  assert.ok(line, 'post.js lays the near-land wash');
  assert.match(line, /uNight\s*\*\s*uNightNear\s*\*\s*nearLand/, 'its strength is uNightNear');
  assert.match(post, /uNightNear:\s*\{\s*value:\s*0\s*\}/, 'and the uniform starts at none');
  // the plumbing: the look's number reaches the sheet, and deep space lays none
  assert.match(src('world/index.js'), /SHEET\.nightNear\s*=\s*look\.nightNear\s*\|\|\s*0/);
  assert.match(src('world/index.js'), /SHEET\.night = 0; SHEET\.nightNear = 0;/);
  assert.match(src('render/index.js'), /uNightNear\.value\s*=\s*SHEET\.valid \? SHEET\.nightNear : 0/);
});
