// The look lab: ONE long-lived headless Chromium on a page of the game (the painter's gallery by
// default), driven from the command line, so a change to a shader is seen in seconds and not after
// a reload of several minutes in software GL.
//
//   node tools/lab.mjs serve                      start the lab (keeps running; prints its port)
//   node tools/lab.mjs open '<path?query>' [w h]  load a page and wait until it says it is ready
//   node tools/lab.mjs eval '<js>'                run JS in the page (may return a promise); prints the result
//   node tools/lab.mjs shot <out.png|jpg>         a screenshot of the page (slow in software GL: the compositor's)
//   node tools/lab.mjs grab <out.png> [frames]    hold the page's loop, step it `frames` times (default 1) and write
//                                                 the canvas as it was drawn (read back with gl.readPixels: fast)
//   node tools/lab.mjs hold | resume              hold the page's loop (nothing is drawn between grabs) or let it run
//   node tools/lab.mjs swap                       re-read src/ and give every painted material its new shaders,
//                                                 without a reload (see SWAP below for what it can and cannot carry)
//   node tools/lab.mjs problems                   console errors and page errors since the last call
//   node tools/lab.mjs close                      close the browser and stop
//
// SWAP: the tree is served a second time under /v<N>/, so the module graph is imported afresh. Each
// painted material carries how it was made (material.userData.pcMake, written by the make functions
// in src/render/materials.js and src/world/sky.js); the new graph makes a donor with the same
// arguments and the live material takes its shader text, its defines and any uniform it lacks.
// What a swap does NOT carry: JS that runs every frame (the world's uniform updates), geometry,
// textures made at start-up. For those, open the page again.
//
// Rules of the machine (docs/HANDOVER.md section 6): one browser at a time; close it when done.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GL_ARGS } from './shot.mjs';
import { writePng } from '../tests/stationlib/png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const STATE = process.env.PC_LAB_STATE || '/home/user/.pc-scratch/look/lab.json';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const [op, ...rest] = process.argv.slice(2);
if (op === 'serve') await serve();
else await client(op, rest);

async function client(op, rest) {
  if (!op) { console.error('usage: node tools/lab.mjs serve|open|eval|shot|grab|hold|resume|swap|problems|close'); process.exit(2); }
  let st;
  try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { console.error('the lab is not running (node tools/lab.mjs serve)'); process.exit(2); }
  const body = { op };
  if (op === 'open') { body.url = rest[0] || '/gallery.html'; body.w = +rest[1] || 0; body.h = +rest[2] || 0; }
  if (op === 'eval') body.js = rest[0];
  if (op === 'shot') body.out = path.resolve(rest[0] || 'shot.png');
  if (op === 'grab') { body.out = path.resolve(rest[0] || 'grab.png'); body.frames = +rest[1] || 1; }
  const res = await new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: st.port, path: '/cmd', method: 'POST', headers: { 'content-type': 'application/json' } }, (m) => {
      let d = ''; m.on('data', (c) => (d += c)); m.on('end', () => resolve(d));
    });
    r.on('error', reject); r.setTimeout(0); r.end(JSON.stringify(body));
  }).catch((e) => { console.error('lab: ' + e.message); process.exit(2); });
  let j; try { j = JSON.parse(res); } catch { j = { ok: false, error: res }; }
  if (j.result !== undefined) console.log(typeof j.result === 'string' ? j.result : JSON.stringify(j.result, null, 1));
  if (j.problems && j.problems.length) console.log('PROBLEMS:\n' + j.problems.join('\n'));
  if (!j.ok) { console.error('FAILED: ' + j.error); process.exit(1); }
  if (j.ms != null) console.log(`(${j.ms} ms)`);
}

async function serve() {
  const require = createRequire(import.meta.url);
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
  // the tree, and the same tree again under /v<N>/ (a fresh module graph for a swap)
  const files = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/v\d+\//, '/');
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(repo, path.normalize(p));
    if (!file.startsWith(repo)) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + p); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
  await new Promise((r) => files.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${files.address().port}`;
  const browser = await chromium.launch({ args: GL_ARGS });
  let page = null, problems = [], ver = 0;
  const newPage = async (w, h) => {
    if (page) await page.close().catch(() => {});
    page = await browser.newPage({ viewport: { width: w || 1280, height: h || 720 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(0);
    // the page's loop can be held: while __labHold is set a requested frame waits until __labStep runs it
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window); let q = null;
      window.__labHold = false;
      window.requestAnimationFrame = (cb) => { if (window.__labHold) { q = cb; return 0; } return raf(cb); };
      window.__labWaiting = () => q != null;
      window.__labStep = (n = 1) => { let k = 0; for (let i = 0; i < n; i++) { const cb = q; q = null; if (cb) { cb(performance.now()); k++; } } return k; };
      window.__labResume = () => { window.__labHold = false; const cb = q; q = null; if (cb) raf(cb); };
    });
    page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text().slice(0, 1500)); });
    page.on('pageerror', (e) => problems.push('pageerror: ' + String(e.stack || e.message).slice(0, 1500)));
    page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
  };
  const take = () => { const p = problems; problems = []; return p; };
  // (the state file is removed only by the lab that wrote it: an older lab still closing must not take a newer one's)
  const forget = () => { try { if (JSON.parse(fs.readFileSync(STATE, 'utf8')).pid === process.pid) fs.unlinkSync(STATE); } catch {} };
  const SWAP = async (v) => {
    const R = await import(`/v${v}/src/render/materials.js`);
    const S = await import(`/v${v}/src/world/sky.js`);
    const H = await import(`/v${v}/src/render/shared.js`);
    const K = await import(`/v${v}/src/render/kitmat.js`).catch(() => null);
    const scene = (window.__pcGallery && window.__pcGallery.scene) || (window.__pc && window.__pc.scene);
    const out = { swapped: 0, skipped: [], added: [], kinds: {} };
    const seen = new Set();
    const one = (m) => {
      if (!m || seen.has(m)) return; seen.add(m);
      const mk = m.userData && m.userData.pcMake;
      if (!mk) { if (m.name && m.name.startsWith('pc-')) out.skipped.push(m.name); return; }
      // the body's own uniform objects are the live ones: the donor is lit as the live material is
      const bu = new Proxy({}, { get: (_, k) => m.uniforms[k] });
      let d = null;
      try {
        if (mk.kind === 'terrain') d = R.makeTerrainMaterial(bu);
        else if (mk.kind === 'water') d = R.makeWaterMaterial(bu, bu);
        else if (mk.kind === 'prop') d = R.makePropMaterial(bu, mk.opts);
        else if (mk.kind === 'wash') d = R.makeWashMaterial({ ...mk.opts, bodyUniforms: bu });
        else if (mk.kind === 'figure') d = R.makeFigureMaterial(mk.opts);
        else if (mk.kind === 'near') d = R.makeNearMaterial(bu);
        else if (mk.kind === 'sky') d = S.makeSky(m.uniforms).material;
        else if (mk.kind === 'skyglaze') d = S.makeSkyGlaze(m.uniforms).material;
      } catch (e) { out.skipped.push(m.name + ': ' + e.message); return; }
      if (!d) { out.skipped.push(m.name + ' (' + mk.kind + ')'); return; }
      m.vertexShader = d.vertexShader; m.fragmentShader = d.fragmentShader;
      m.defines = { ...(d.defines || {}) };
      for (const k in d.uniforms) if (!(k in m.uniforms)) { m.uniforms[k] = d.uniforms[k]; if (!out.added.includes(k)) out.added.push(k); }
      m.needsUpdate = true; out.swapped++; out.kinds[mk.kind] = (out.kinds[mk.kind] || 0) + 1;
    };
    scene.traverse((o) => { const m = o.material; if (Array.isArray(m)) m.forEach(one); else one(m); });
    // what is not in the scene just now (pooled meshes, the kits' glazes) is reached through the registry, where there is one
    const reg = window.__pcMaterials; if (reg) for (const m of reg) one(m);
    window.__lab = { R, S, H, K, v };
    return out;
  };
  const control = http.createServer((req, res) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', async () => {
      const t0 = Date.now();
      const done = (o) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ...o, ms: Date.now() - t0, problems: take() }));
      let b; try { b = JSON.parse(d); } catch { return done({ ok: false, error: 'bad json' }); }
      try {
        if (b.op === 'open') {
          await newPage(b.w, b.h);
          await page.goto(base + (b.url.startsWith('/') ? b.url : '/' + b.url));
          await page.waitForFunction('window.__pcReady === true', null, { timeout: 0, polling: 500 });
          return done({ ok: true, result: 'ready ' + b.url });
        }
        if (!page) return done({ ok: false, error: 'no page: open one first' });
        if (b.op === 'eval') return done({ ok: true, result: await page.evaluate(`(async () => { ${/\breturn\b/.test(b.js) ? b.js : 'return (' + b.js + ')'} })()`) ?? null });
        if (b.op === 'shot') {
          fs.mkdirSync(path.dirname(b.out), { recursive: true });
          await page.screenshot({ path: b.out, timeout: 0, ...(b.out.endsWith('.jpg') ? { type: 'jpeg', quality: 92 } : {}) });
          return done({ ok: true, result: b.out });
        }
        if (b.op === 'hold' || b.op === 'grab') {
          await page.evaluate('window.__labHold = true');
          await page.waitForFunction('window.__labWaiting()', null, { timeout: 0, polling: 100 });
          if (b.op === 'hold') return done({ ok: true, result: 'held' });
          const r = await page.evaluate((n) => {
            const t0 = performance.now();
            window.__labStep(n);
            const c = document.querySelector('canvas'), gl = c.getContext('webgl2'), W = c.width, H = c.height;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            const buf = new Uint8Array(W * H * 4);
            gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
            return { W, H, b64: btoa(s), ms: Math.round(performance.now() - t0) };
          }, b.frames || 1);
          const raw = Buffer.from(r.b64, 'base64'), W = r.W, H = r.H, flip = Buffer.alloc(raw.length);
          for (let y = 0; y < H; y++) raw.copy(flip, y * W * 4, (H - 1 - y) * W * 4, (H - y) * W * 4);
          for (let i = 3; i < flip.length; i += 4) flip[i] = 255;
          fs.mkdirSync(path.dirname(b.out), { recursive: true });
          fs.writeFileSync(b.out, writePng(flip, W, H, 4));
          return done({ ok: true, result: `${b.out} ${W}x${H} drawn in ${r.ms} ms` });
        }
        if (b.op === 'resume') { await page.evaluate('window.__labResume()'); return done({ ok: true, result: 'running' }); }
        if (b.op === 'swap') { ver++; return done({ ok: true, result: await page.evaluate(SWAP, ver) }); }
        if (b.op === 'problems') return done({ ok: true });
        if (b.op === 'close') { done({ ok: true, result: 'closing' }); await browser.close().catch(() => {}); forget(); process.exit(0); }
        return done({ ok: false, error: 'unknown op ' + b.op });
      } catch (e) { return done({ ok: false, error: String(e && e.message || e).slice(0, 2000) }); }
    });
  });
  control.setTimeout(0);
  await new Promise((r) => control.listen(0, '127.0.0.1', r));
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ port: control.address().port, files: base, pid: process.pid }));
  console.log('lab: control port', control.address().port, 'files', base, 'pid', process.pid);
  const bye = async () => { await browser.close().catch(() => {}); forget(); process.exit(0); };
  process.on('SIGTERM', bye); process.on('SIGINT', bye);
}
