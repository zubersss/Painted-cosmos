// Every check, in order, one table at the end. This is the command for milestone 4:
//
//   node tests/all.mjs --export        (a clean export of the last commit is made and checked:
//                                       nobody's half-written files; this is the one to trust)
//   node tests/all.mjs                 (the tree this script lives in, as it is)
//   node tests/all.mjs --only unit,static     --skip painted-trip     --list
//
// Steps: the three unit suites (PILOT's, PHYSICS', PAINTER's), the static rules of the brief
// (no build step, relative URLs only, no external assets, Three.js from /vendor, storage in
// try/catch), then the scripted browser runs in headless Chromium, one at a time (two at once
// make each other flaky on this machine): play-through on stubs, with PHYSICS, and in the
// painted world; the Earth, Mars, Saturn trip on stubs and in the painted world; milestone 3's
// checks; pointer lock and its fallback; the sound, measured. Every browser run fails on any
// console error, page error, failed request or request that leaves the page's own server.
// Exit code 0 only if every step that ran passed. Logs: one file per step in --out.
//
// What this cannot check, anywhere in this sandbox: the frame rate on a real GPU, a real
// mouse under pointer lock, a real gamepad, how the sound sounds.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const out = val('out', '/home/user/.pc-scratch/pilot/all');
fs.mkdirSync(out, { recursive: true });

if (flag('export')) {
  // Check the last commit, not the working tree: export it and run this script from there.
  const dir = path.join(out, 'export');
  const ex = spawnSync('bash', [path.join(here, 'tools/export-head.sh'), dir], { cwd: here, encoding: 'utf8' });
  if (ex.status !== 0) { console.error('could not export the last commit:\n' + ex.stderr); process.exit(2); }
  console.log(ex.stdout.trim());
  const rest = argv.filter((a) => a !== '--export');
  const r = spawnSync(process.execPath, [path.join(dir, 'tests/all.mjs'), ...rest, '--label', ex.stdout.trim()], { stdio: 'inherit' });
  process.exit(r.status == null ? 2 : r.status);
}

const painted = 'scale=0.5&quality=0';
const STEPS = [
  { id: 'unit', what: 'PILOT\'s unit tests (simulation, flight, camera, save, sketchbook, contract with the real worlds)', cmd: ['node', '--test', 'tests/'], shell: 'node --test tests/*.test.mjs', min: 15 },
  { id: 'physics-unit', what: 'PHYSICS\' unit tests', cmd: ['node', '--test', 'src/physics/'], min: 20 },   // 291 tests: 145 in 5 min at a load of 18 (2026-11-12)
  { id: 'world-unit', what: 'PAINTER\'s unit tests', shell: 'node --test src/world/*.test.mjs', min: 10 },
  { id: 'static', what: 'the brief\'s static rules', fn: staticRules },
  { id: 'play-stub', what: 'play-through on the stubs (walk, jetpack, board, orbit, land, step out)', cmd: ['node', 'tests/playthrough.mjs', '--out', path.join(out, 'play-stub')], min: 15 },
  { id: 'play-physics', what: 'play-through on the stubs with PHYSICS', cmd: ['node', 'tests/playthrough.mjs', '--query', 'stub=render,world,art&fresh=1', '--out', path.join(out, 'play-physics')], min: 15 },
  { id: 'trip-stub', what: 'Earth, Mars, Saturn in one sitting, reload from the save (stubs)', cmd: ['node', 'tests/trip.mjs', '--out', path.join(out, 'trip-stub')], min: 20 },
  { id: 'm3', what: 'milestone 3: title card, sketchbook and sketches, vistas, gamepad, tiers', cmd: ['node', 'tests/m3check.mjs', '--out', path.join(out, 'm3')], min: 15 },
  { id: 'lock', what: 'pointer lock and the drag-to-look fallback', cmd: ['node', 'tests/lockcheck.mjs', '--out', path.join(out, 'lock')], min: 10 },
  { id: 'audio', what: 'the sound, measured (no clipping, no clicks, no DC)', cmd: ['node', 'tests/audiocheck.mjs'], min: 10 },
  { id: 'painted-play', what: 'play-through in the painted world', cmd: ['node', 'tests/playthrough.mjs', '--query', painted + '&fresh=1', '--w', '400', '--h', '225', '--out', path.join(out, 'painted-play')], min: 40 },
  { id: 'painted-trip', what: 'Earth, Mars, Saturn in the painted world, reload from the save', cmd: ['node', 'tests/trip.mjs', '--query', painted, '--w', '400', '--h', '225', '--out', path.join(out, 'painted-trip')], min: 60 },
  { id: 'painted-m3', what: 'milestone 3\'s checks in the painted world', cmd: ['node', 'tests/m3check.mjs', '--query', 'fresh=1', '--w', '400', '--h', '225', '--out', path.join(out, 'painted-m3')], min: 40 },
];
if (flag('list')) { for (const s of STEPS) console.log(s.id.padEnd(14), s.what); process.exit(0); }
const only = val('only', ''), skip = val('skip', '');
const steps = STEPS.filter((s) => (!only || only.split(',').includes(s.id)) && !skip.split(',').includes(s.id));

const rows = [];
for (const s of steps) {
  const t0 = Date.now();
  process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s.id} ... `);
  let ok = false, detail = '';
  if (s.fn) {
    const bad = s.fn();
    ok = bad.length === 0;
    detail = ok ? 'all rules hold' : bad.slice(0, 4).join('; ');
    fs.writeFileSync(path.join(out, s.id + '.log'), bad.join('\n') + '\n');
  } else {
    const r = s.shell
      ? spawnSync('bash', ['-c', s.shell], { cwd: here, encoding: 'utf8', maxBuffer: 1 << 28, timeout: s.min * 60000 })
      : spawnSync(s.cmd[0] === 'node' ? process.execPath : s.cmd[0], s.cmd.slice(1), { cwd: here, encoding: 'utf8', maxBuffer: 1 << 28, timeout: s.min * 60000 });
    const text = (r.stdout || '') + (r.stderr || '');
    fs.writeFileSync(path.join(out, s.id + '.log'), text);
    ok = r.status === 0;
    detail = summarise(text, ok, r);
    // Three agents render on this machine: a unit test with a clock in it can fail in the full
    // run and pass alone. Before the table calls it a failure, the files that failed are run
    // once more, alone. (The table says so; the first run's log is kept.)
    if (!ok && /unit$/.test(s.id) && !(r.error && r.error.code === 'ETIMEDOUT')) {
      const files = [...new Set([...text.matchAll(/location: '([^']+?\.mjs):\d+:\d+'/g)].map((m) => m[1]))].filter((f) => fs.existsSync(f));
      if (files.length) {
        // (All three suites: PILOT's, PHYSICS' and PAINTER's. A file gets two tries alone: under
        // a load of 15 a wall-clock test can miss twice running.)
        const alone = (f) => spawnSync(process.execPath, ['--test', f], { cwd: here, encoding: 'utf8', maxBuffer: 1 << 28, timeout: s.min * 60000 });
        let again = files.map(alone), tries = 1;
        if (!again.every((a) => a.status === 0)) { again = files.map((f, i) => (again[i].status === 0 ? again[i] : alone(f))); tries = 2; }
        fs.writeFileSync(path.join(out, s.id + '.alone.log'), again.map((a) => (a.stdout || '') + (a.stderr || '')).join('\n'));
        if (again.every((a) => a.status === 0)) { ok = true; detail += ` [failed in the full run, passed alone${tries > 1 ? ' at the second try' : ''}: ${files.map((f) => path.basename(f)).join(', ')}]`; }
        else detail += ' [failed again alone, twice]';
      }
    }
  }
  const sec = Math.round((Date.now() - t0) / 1000);
  rows.push({ id: s.id, ok, sec, detail, what: s.what });
  console.log((ok ? 'pass' : 'FAIL') + ` (${sec} s) ${detail}`);
}

const label = val('label', 'the tree at ' + here);
const w = Math.max(...rows.map((r) => r.id.length));
console.log('\n' + '='.repeat(78));
console.log('Painted Cosmos: every check, ' + label);
console.log('='.repeat(78));
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(w)}  ${String(r.sec).padStart(5)} s  ${r.detail}`);
console.log('-'.repeat(78));
const failed = rows.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((r) => r.id).join(', ')} (logs in ${out})` : `ALL ${rows.length} PASSED`);
console.log('Not checked here, and not checkable in this sandbox: frame rate on a real GPU, a real mouse\nunder pointer lock, a real gamepad, how the sound sounds.');
fs.writeFileSync(path.join(out, 'table.json'), JSON.stringify({ label, when: new Date().toISOString(), rows }, null, 1));
process.exit(failed.length ? 1 : 0);

// One line that says what a step found.
function summarise(text, ok, r) {
  if (r.error && r.error.code === 'ETIMEDOUT') return 'timed out';
  const lines = text.split('\n');
  const pass = lines.find((l) => /^# pass \d+/.test(l)), fail = lines.find((l) => /^# fail \d+/.test(l));
  if (pass) {
    const firstBad = lines.find((l) => /^not ok /.test(l));
    return `${pass.slice(2)}, ${fail ? fail.slice(2) : ''}` + (firstBad ? ` (${firstBad.slice(0, 90)})` : '');
  }
  const oks = lines.filter((l) => /^\d\d:\d\d:\d\d\s+ok:/.test(l) || /^\s+ok:/.test(l)).length;
  const bad = lines.filter((l) => /FAIL:/.test(l));
  if (!ok) return (bad[0] || lines.filter((l) => l.trim()).slice(-1)[0] || 'no output').trim().slice(0, 150);
  return oks ? `${oks} checks` : (lines.filter((l) => /PASSED|DONE/.test(l)).slice(-1)[0] || 'passed').trim().slice(0, 90);
}

// The rules of the brief that can be read off the files.
function staticRules() {
  const bad = [];
  const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
  const walk = (d) => fs.readdirSync(path.join(here, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of ['index.html', 'README.md', '.nojekyll', 'vendor/three/three.module.js', 'vendor/three/three.core.js', 'src/main.js']) {
    if (!fs.existsSync(path.join(here, f))) bad.push('missing: ' + f);
  }
  if (fs.existsSync(path.join(here, 'index.html'))) {
    const html = read('index.html');
    // GitHub Pages serves the game from /Painted-cosmos/: every URL must be relative.
    for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]*)"/g)) if (/^(?:[a-z]+:)?\/\//i.test(m[1]) || m[1].startsWith('/')) bad.push('index.html: not a relative URL: ' + m[1]);
    const map = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!map) bad.push('index.html: no import map');
    else for (const v of Object.values(JSON.parse(map[1]).imports || {})) if (!String(v).startsWith('./')) bad.push('index.html: import map entry is not relative: ' + v);
    if (!/vendor\/three\/three\.module\.js/.test(html)) bad.push('index.html: three does not come from ./vendor');
  }
  // No runtime network: nothing in the game's own source names a remote host (XML namespaces are not requests).
  const src = walk('src').filter((f) => /\.(js|css|html)$/.test(f) && !/\.test\.mjs$/.test(f));
  for (const f of src.concat(['index.html'])) {
    const t = read(f);
    for (const m of t.matchAll(/https?:\/\/[^\s"'`)<]+/g)) if (!/^http:\/\/www\.w3\.org\//.test(m[0])) bad.push(`${f}: names a remote address: ${m[0]}`);
    if (/\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(|importScripts\s*\(/.test(t) && !/src\/(render|world|art|physics)\//.test(f)) bad.push(`${f}: makes a request at run time`);
    // Storage only through a guarded handle: the word localStorage may appear in comments and in the one guarded probe.
    if (/localStorage\.(getItem|setItem|removeItem)/.test(t)) bad.push(`${f}: touches localStorage outside the guarded handle`);
  }
  // No art assets: no image, sound, font or model files anywhere the game loads from.
  for (const f of walk('src').concat(walk('vendor'))) if (/\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|woff2?|ttf|glb|gltf|obj|ktx2?)$/i.test(f)) bad.push('an asset file: ' + f);
  // No build step: no bundler config, no package dependencies.
  for (const f of ['webpack.config.js', 'vite.config.js', 'rollup.config.js', 'tsconfig.json']) if (fs.existsSync(path.join(here, f))) bad.push('a build step: ' + f);
  if (fs.existsSync(path.join(here, 'package.json'))) {
    const p = JSON.parse(read('package.json'));
    if (p.dependencies && Object.keys(p.dependencies).length) bad.push('package.json has runtime dependencies');
  }
  // The README names every control the help card names.
  if (fs.existsSync(path.join(here, 'README.md'))) {
    const r = read('README.md');
    for (const k of ['W A S D', 'Shift', 'Space', 'E', 'V', 'C', 'X', 'F', 'M', 'B', 'H', 'mouse', 'gamepad']) if (!r.includes(k)) bad.push('README does not mention the control: ' + k);
    if (!/zubersss\.github\.io\/Painted-cosmos/i.test(r)) bad.push('README does not say where to play (GitHub Pages)');
  }
  return bad;
}
