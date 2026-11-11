// Every module of the physics loads as the ENTRY of a fresh Node process (P16, after the incident of 6d5c02a).
//
// 6d5c02a made flora.js import air.js while air.js read FLORA at load time. In the browser the first module entered was
// flora.glsl.js -> flora.js -> air.js, so air.js ran while FLORA was still in its temporal dead zone, threw, and every
// real module fell back to PILOT's stub; the Node tests entered in another order and passed. A cycle of ES modules
// only breaks for some entry orders, so this test enters through EACH module on its own, in its own process (a module
// already loaded in the test runner would hide the order), and fails on any error while loading.
// `three` is resolved to the vendored build, as the pages' import maps do. painted-lab.js is a page's own script: it
// reads `location` in its body, so it cannot finish in Node; it passes when the only error is a browser global missing
// in its OWN body, which means everything it imports (the physics, PAINTER's render and world, PILOT's player) loaded.
// A second test forbids static import cycles among the modules the physics reaches: none exist now; a cycle that is
// really wanted goes into ALLOWED_CYCLES with its reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const THREE_URL = pathToFileURL(path.join(repo, 'vendor/three/three.module.js')).href;
const PAGE_ENTRIES = new Set(['three/painted-lab.js']);   // a page's script: may stop at a browser global in its own body
const ALLOWED_CYCLES = [];                                 // 'a.js -> b.js -> a.js' strings, each with a reason beside it

function physicsModules() {
  const out = [];
  (function walk(d) {
    for (const f of readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.js')) out.push(p);
    }
  })(here);
  return out;
}

const hook = 'export async function resolve(s, c, n) { return s === "three" ? { url: ' + JSON.stringify(THREE_URL) + ', shortCircuit: true } : n(s, c); }';
function loadAlone(file) {
  const code = [
    "import { register } from 'node:module';",
    `register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(hook)}));`,
    `await import(${JSON.stringify(pathToFileURL(file).href)});`,
    "process.stdout.write('LOADED');",
  ].join('\n');
  return new Promise((resolve) => {
    execFile(process.execPath, ['--input-type=module', '-e', code], { cwd: repo, timeout: 60000, maxBuffer: 1 << 22 },
      (err, stdout, stderr) => resolve({ ok: !err && stdout.includes('LOADED'), stdout, stderr: String(stderr), err }));
  });
}

// a few at a time: the machine is shared
async function pool(items, n, fn) {
  const res = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]); } }));
  return res;
}

test('every physics module loads as the entry point of a fresh process', async () => {
  const files = physicsModules();
  assert.ok(files.length >= 20, `found ${files.length} modules`);
  const results = await pool(files, 3, loadAlone);
  const bad = [];
  files.forEach((f, k) => {
    const rel = path.relative(here, f).split(path.sep).join('/');
    const r = results[k];
    if (r.ok) return;
    if (PAGE_ENTRIES.has(rel)) {
      // allowed: ReferenceError for a browser global, thrown at the page script's own line
      const m = /ReferenceError: (location|document|window|navigator|requestAnimationFrame|addEventListener) is not defined/.exec(r.stderr);
      const at = r.stderr.split('\n').find((l) => l.includes('file://'));
      if (m && at && at.includes(rel)) return;
    }
    bad.push(`${rel}:\n${r.stderr.split('\n').slice(0, 8).join('\n')}`);
  });
  assert.equal(bad.length, 0, 'modules that fail to load on their own:\n' + bad.join('\n---\n'));
});

test('no static import cycle among the modules the physics reaches', () => {
  const re = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g;
  const graph = new Map();
  const visit = (f) => {
    if (graph.has(f)) return;
    const out = []; graph.set(f, out);
    for (const m of readFileSync(f, 'utf8').matchAll(re)) {
      if (!m[1].startsWith('.')) continue;
      const p = path.resolve(path.dirname(f), m[1]);
      if (existsSync(p)) out.push(p);
    }
    for (const d of out) visit(d);
  };
  for (const f of physicsModules()) visit(f);
  const state = new Map(), stack = [], cycles = [];
  const dfs = (f) => {
    state.set(f, 1); stack.push(f);
    for (const d of graph.get(f)) {
      if (state.get(d) === 1) cycles.push(stack.slice(stack.indexOf(d)).concat(d).map((p) => path.relative(repo, p).split(path.sep).join('/')).join(' -> '));
      else if (!state.get(d)) dfs(d);
    }
    stack.pop(); state.set(f, 2);
  };
  for (const f of graph.keys()) if (!state.get(f)) dfs(f);
  const unexpected = cycles.filter((c) => !ALLOWED_CYCLES.includes(c));
  assert.ok(graph.size >= 20, `walked ${graph.size} modules`);
  assert.deepEqual(unexpected, [], 'import cycles (a module that reads another\'s export at load time inside a cycle breaks for some entry orders):\n' + unexpected.join('\n'));
});
