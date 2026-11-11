// Entry for `node --test src/physics/` (see package.json): Node 22 runs a directory argument as
// a single module, so this file pulls in every test file next to it. Running
// `node --test "src/physics/*.test.mjs"` gives the same tests file by file.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
// Only when this module was reached through the directory itself. When the runner globbed the
// files (`node --test "src/physics/*.test.mjs"`) each one runs on its own and this does nothing.
const viaDir = path.resolve(process.argv[1] || '') === here;
if (viaDir) {
  for (const f of readdirSync(here).sort()) {
    if (f.endsWith('.test.mjs') && f !== 'all.test.mjs') await import(pathToFileURL(path.join(here, f)).href);
  }
}
