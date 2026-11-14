// Headless screenshot + console-error check, using the pre-installed Playwright Chromium with
// software WebGL2. Starts its own static server on a free port, so parallel runs never collide.
//
// Usage:
//   node tools/shot.mjs <pagePathAndQuery> <out.png|out.jpg> [options]   (.jpg = smaller, use for committed evidence)
// Options:
//   --w 1280 --h 720      viewport (keep it small: software GL is slow)
//   --ready "expr"        JS expression polled until truthy (default: window.__pcReady === true)
//   --timeout 120000      max ms to wait for --ready
//   --wait 0              extra ms to wait after ready
//   --eval "js"           JS to run in the page after ready (may be repeated; each may return a promise)
//   --shots N --every ms  capture N screenshots spaced by ms (out-0.png, out-1.png, ...)
//   --quality 88          jpeg quality
//   --shot-timeout 180000 max ms for one screenshot (the painted world in software GL can need
//                         more than Playwright's 30 s default for a single frame)
//   --root dir            serve this directory instead of the repo root (e.g. a clean export of HEAD)
//   --allow-errors        do not exit 1 on console errors
// Prints console errors / page errors / failed requests. Exit code 1 if there were any.
import { createRequire } from 'node:module';
import path from 'node:path';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

export const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync',
  '--autoplay-policy=no-user-gesture-required',
];

export async function openPage({ pagePath = '/', w = 1280, h = 720, root } = {}) {
  const srv = await startServer(0, root ? path.resolve(root) : undefined);
  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + (e.stack || e.message)));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) problems.push('http ' + r.status() + ': ' + r.url()); });
  page.on('request', (r) => { if (!r.url().startsWith(srv.url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problems.push('EXTERNAL REQUEST: ' + r.url()); });
  await page.goto(srv.url + (pagePath.startsWith('/') ? pagePath : '/' + pagePath));
  const close = async () => { await browser.close(); srv.server.close(); };
  return { page, browser, problems, close, baseUrl: srv.url };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const pos = []; const opt = { evals: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--eval') opt.evals.push(args[++i]);
    else if (a === '--allow-errors') opt.allowErrors = true;
    else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
    else pos.push(a);
  }
  if (pos.length < 2) { console.error('usage: node tools/shot.mjs <pagePath> <out.png> [options]'); process.exit(2); }
  const [pagePath, out] = pos;
  const { page, problems, close } = await openPage({ pagePath, w: Number(opt.w || 1280), h: Number(opt.h || 720), root: opt.root });
  const ready = opt.ready || 'window.__pcReady === true';
  let ok = true;
  try { await page.waitForFunction(ready, null, { timeout: Number(opt.timeout || 120000), polling: 250 }); }
  catch (e) { ok = false; problems.push('READY TIMEOUT waiting for: ' + ready); }
  if (opt.wait) await page.waitForTimeout(Number(opt.wait));
  for (const js of opt.evals) {
    try { const r = await page.evaluate(js); if (r !== undefined) console.log('eval ->', JSON.stringify(r)); }
    catch (e) { problems.push('eval failed: ' + e.message); }
  }
  const n = Number(opt.shots || 1);
  const shotTimeout = Number(opt['shot-timeout'] || 180000);
  for (let i = 0; i < n; i++) {
    const file = n === 1 ? out : out.replace(/\.(png|jpe?g)$/, `-${i}.$1`);
    try {
      await page.screenshot(/\.jpe?g$/.test(file)
        ? { path: file, type: 'jpeg', quality: Number(opt.quality || 88), timeout: shotTimeout }
        : { path: file, timeout: shotTimeout });
      console.log('wrote', file);
    } catch (e) { ok = false; problems.push('SCREENSHOT FAILED (' + file + '): ' + String(e.message).split('\n')[0]); break; }
    if (i < n - 1) await page.waitForTimeout(Number(opt.every || 500));
  }
  await close();
  if (problems.length) { console.log('PROBLEMS (' + problems.length + '):'); for (const p of [...new Set(problems)].slice(0, 40)) console.log('  ' + p); }
  else console.log('no console errors');
  process.exit(problems.length && !opt.allowErrors ? 1 : (ok ? 0 : 1));
}
