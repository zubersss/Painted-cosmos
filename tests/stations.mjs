// THE STATION HARNESS: the quality guard's measuring stick (docs/lead/SHARP-SMOOTH-PLAN.md, W1.1 and
// section 5). One headless Chromium on the game (pinned tier, fair sky, no weather marks, the loop
// held); at each fixed station (tests/stationlib/stations.mjs) one render of the held frame and its
// debug views read back with gl.readPixels: v0 the final sheet, v1 the raw scene pass, v3 depth, v4
// regions, v5 the abstraction pass's output. Measured in Node (tests/stationlib/metrics.mjs, a port
// of the sharpness audit's metrics.py, number for number): lapvar, the bands b1 b2 b3 and the
// transfers t1 t2 t3 against the raw scene over the land, the ground by distance and the foliage;
// the halo share; CIELAB per region with L* percentiles; the paper's border strip; the cost (draw
// calls and triangles over every pass). On request: the aliasing index A (--alias: the same view at
// twice the size, box-filtered down, as the reference), the sub-pixel flicker index F (--flicker: the
// picture panned 0.25 px), the post passes' texture reads per pixel, counted in instrumented copies of
// their shaders (--taps), post experiments on the held scene (--exp x26,...).
//
//   node tests/stations.mjs [--root DIR] [--set quick] [--tier q2] [--size 1280x720] [--device iphone14]
//        [--out DIR] [--label TEXT] [--alias] [--flicker] [--taps] [--exp x21,x26] [--views 0,1,3,4,5]
//   node tests/stations.mjs --compare BASE.json[:KEY] --with RUNDIR       the guard's rules, no browser
//   node tests/stations.mjs --baseline OUT.json --commit SHA --from RUNDIR[,RUNDIR...]   collect runs
//   node tests/stations.mjs --sheet RUNDIR_A,RUNDIR_B --out SHEET.jpg      before/after sheet and 1:1 crops
//   node tests/stations.mjs --diff RUNDIR_A,RUNDIR_B        two runs' numbers side by side: the largest differences
//   node tests/stations.mjs --reref RUNDIR --ref REFDIR       a lower tier's final against the top tier's raw scene
//        (no browser: the frames on disk; adds `vsRef` to each station of RUNDIR/run.json)
//
// --set: set names (quick, audit, earth, air, phone, all), station names or regular expressions,
//   comma separated; the stations always run in the list's order. --root: the tree to serve (a clean
//   export of any commit: this harness's own files are read from its own tree and put into the page).
// A run writes into --out (default /home/user/.pc-scratch/pilot/stations/<tier>-<size>): run.json (every
// number), summary.txt, frames/<station>_v<k>.png (lossless), sheet.jpg (final | raw per station) and
// crops.jpg (1:1 crops of the land). SwiftShader: the page takes 4 to 6 min to load at q2, a station
// about 1 min (more with --alias, which renders at twice the size).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tools/serve.mjs';
import { GL_ARGS } from '../tools/shot.mjs';
import { readPng, writePng } from './stationlib/png.mjs';
import * as MX from './stationlib/metrics.mjs';
import { STATIONS, pick, TIERS, EXPERIMENTS, byName } from './stationlib/stations.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }

const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const r4 = (v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
const DEVICES = { iphone14: 'iPhone 14 landscape', pixel7: 'Pixel 7 landscape', ipadpro11: 'iPad Pro 11 landscape' };

if (flag('compare')) process.exit(compare(val('compare'), val('with')));
if (flag('diff')) process.exit(diffRuns(val('diff').split(',')));
if (flag('reref')) process.exit(reref(val('reref'), val('ref')));
if (flag('baseline')) process.exit(collect(val('baseline'), val('commit', '?'), val('from', '')));
if (flag('sheet') && !flag('set')) { await sheetOnly(val('sheet').split(','), val('out')); process.exit(0); }
process.exit(await run());

// ---------------------------------------------------------------------------------------------------
async function run() {
  const tierName = val('tier', 'q2'), tier = TIERS[tierName];
  if (!tier) { console.error('unknown tier ' + tierName); return 2; }
  const device = val('device', '');
  const size = val('size', device ? 'device' : '1280x720');
  const [vw, vh] = size === 'device' ? [0, 0] : size.split('x').map(Number);
  const stations = pick(val('set', device ? 'phone' : 'quick'));
  if (!stations.length) { console.error('no station matches ' + val('set')); return 2; }
  const views = val('views', '0,1,3,4,5').split(',').map(Number);
  for (const need of [0, 1, 4]) if (!views.includes(need)) views.push(need);
  const exps = val('exp', '') ? val('exp').split(',').map((x) => { const k = Object.keys(EXPERIMENTS).find((e) => e === x || e.startsWith(x + '_')); if (!k) throw new Error('unknown experiment ' + x); return k; }) : [];
  const root = path.resolve(val('root', repo));
  const out = path.resolve(val('out', `/home/user/.pc-scratch/pilot/stations/${tierName}-${device || size}`));
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  fs.mkdirSync(path.join(out, 'thumbs'), { recursive: true });
  const query = `quality=${tier.q}&scale=${tier.scale}&dynres=0&weather=fair&kits=0&card=0&fresh=1&save=0&audio=0&pointerlock=0&body=earth&time=11`;
  const label = val('label', `${path.basename(root)} ${tierName} ${device || size}`);
  const runFile = path.join(out, 'run.json');
  const result = { label, root, when: new Date().toISOString(), config: { tier: tierName, size, device: device || null, query, views, alias: flag('alias'), flicker: flag('flicker'), taps: flag('taps'), exps }, stations: {} };

  const srv = await startServer(0, root);
  const browser = await pw.chromium.launch({ args: GL_ARGS });
  const ctxOpt = device ? { ...pw.devices[DEVICES[device] || device] } : { viewport: { width: vw, height: vh }, deviceScaleFactor: 1 };
  delete ctxOpt.defaultBrowserType;
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  page.setDefaultTimeout(1800000);
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + (e.stack || e.message)));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
  let code = 0;
  try {
    log('open', root, query, device || size);
    await page.goto(srv.url + '/index.html?' + query);
    await page.waitForFunction('window.__pcReady === true', null, { timeout: 1800000, polling: 500 });
    const using = await page.evaluate(() => ({ fallback: window.__pc.info().fallback, using: window.__pc.info().using }));
    if (using.fallback && using.fallback.length) throw new Error('FALLBACK: ' + JSON.stringify(using.fallback));
    await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'stationlib/inpage.js'), 'utf8') });
    await page.evaluate(() => { window.__pc.hold(true); window.__st.hud(false); });
    log('ready; loop held', JSON.stringify(using.using));
    result.using = using.using;
    for (const st of stations) {
      const t0 = Date.now();
      const rec = await station(page, st, tier, views, exps, out);
      rec.secs = Math.round((Date.now() - t0) / 1000);
      result.stations[st.name] = rec;
      fs.writeFileSync(runFile, JSON.stringify(result, null, 1));
      log(line(st.name, rec), `(${rec.secs} s)`);
    }
    result.problems = [...new Set(problems)];
    if (!flag('no-sheet')) await sheets(browser, [{ dir: out, label }], out, stations.map((s) => s.name));
  } catch (e) {
    code = 1;
    log('FAILED:', e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e);
  } finally {
    result.problems = [...new Set(problems)];
    fs.writeFileSync(runFile, JSON.stringify(result, null, 1));
    fs.writeFileSync(path.join(out, 'summary.txt'), Object.entries(result.stations).map(([n, r]) => line(n, r)).join('\n') + '\n');
    await browser.close(); srv.server.close();
  }
  if (result.problems.length) { log('PROBLEMS:', result.problems.slice(0, 8).join(' | ')); code = 1; }
  log(code ? 'STATIONS FAILED' : 'STATIONS DONE', Object.keys(result.stations).length, 'stations;', runFile);
  return code;
}

// One station: place, settle, a warm render (the water reflects the frame before), the measured render.
async function station(page, st, tier, views, exps, out) {
  const place = await page.evaluate(([o, t]) => window.__st.place(o, t), [st, tier]);
  await page.evaluate(() => window.__st.render(0));
  const cap = await page.evaluate((v) => window.__st.capture(v, true), views);
  const W = cap.W, H = cap.H;
  const px = {};
  for (const [v, s] of Object.entries(cap.px)) px[v] = Buffer.from(s, 'base64');
  const rgb = {}, f = {};
  for (const [v, b] of Object.entries(px)) {
    rgb[v] = MX.rgbOf(b, W, H, true);
    fs.writeFileSync(path.join(out, 'frames', `${st.name}_v${v}.png`), writePng(rgb[v], W, H, 3));
  }
  thumb(rgb[0], W, H, path.join(out, 'thumbs', `${st.name}_v0.png`));
  thumb(rgb[1], W, H, path.join(out, 'thumbs', `${st.name}_v1.png`));
  const lum = (v) => (px[v] ? MX.lumaOf(px[v], W, H, true) : null);
  const planes = { final: lum(0), raw: lum(1), abs: lum(5) };
  const cls = MX.classesOf(px[4], W, H, true), dep = px[3] ? MX.depthOf(px[3], W, H, true) : null;
  const { out: m, M } = MX.measure({ W, H, views: planes, cls, dep, rgb: { final: rgb[0], raw: rgb[1] } });
  const rec = { station: st, place, size: [W, H], cost: cap.cost, ...m };

  // the post experiments first: they run on the scene pass held in the targets (the 2x render resizes them)
  if (exps.length) {
    rec.exp = {};
    const keep = await page.evaluate(() => window.__st.postState());
    const refBands = MX.bands(planes.raw, W, H);
    for (const name of exps) {
      const e = EXPERIMENTS[name];
      const n = await page.evaluate(([e, keep]) => {
        const st = window.__st, P = window.__pc.painter._post, A = P.absUniforms, S = P.sheetUniforms;
        st.restorePost(keep);
        const u = e.uniforms || {};
        if (u.pigZ != null) S.uPig.value.z = u.pigZ;
        if (u.abstraction != null) A.uAbstraction.value = u.abstraction;
        if (u.bleed != null) A.uBrush.value.w = u.bleed;
        if (u.brushX != null) A.uBrush.value.x = u.brushX;
        if (u.brushY != null) A.uBrush.value.y = u.brushY;
        let n = 0;
        for (const [a, b] of e.patches || []) n += st.patch(a, b);
        return n;
      }, [e, keep]);
      const c = await page.evaluate(() => window.__st.capture([0, 5], false));
      const fin = MX.lumaOf(Buffer.from(c.px[0], 'base64'), W, H, true), ab = MX.lumaOf(Buffer.from(c.px[5], 'base64'), W, H, true);
      const r = { patched: n, final: {}, abs: {} };
      for (const [key, y] of [['final', fin], ['abs', ab]]) {
        const pre = { bands: MX.bands(y, W, H), lap: MX.lap(y, W, H) };
        for (const mk of ['land', 'ground', 'ground_150_600', 'foliage']) if (M[mk]) r[key][mk] = MX.round(MX.stats(y, W, H, refBands, M[mk], pre));
      }
      const h = MX.haloShare(ab, planes.raw, W, H, M.land), hf = MX.haloShare(fin, planes.raw, W, H, M.land);
      r.halo = { abs: h && r4(h.share), final: hf && r4(hf.share) };
      rec.exp[name] = r;
      const rgbE = MX.rgbOf(Buffer.from(c.px[0], 'base64'), W, H, true);
      fs.writeFileSync(path.join(out, 'frames', `${st.name}__${name}_v0.png`), writePng(rgbE, W, H, 3));
      if (flag('exp-abs')) fs.writeFileSync(path.join(out, 'frames', `${st.name}__${name}_v5.png`), writePng(MX.rgbOf(Buffer.from(c.px[5], 'base64'), W, H, true), W, H, 3));
    }
    await page.evaluate((keep) => window.__st.restorePost(keep), keep);
  }
  if (flag('taps')) {
    const t = await page.evaluate(() => window.__st.taps(false));
    rec.taps = {};
    for (const p of t) {
      const k = rec.taps[p.name] ? p.name + '2' : p.name;
      rec.taps[k] = { size: [p.w, p.h], perPixel: p.mean, min: p.min, max: p.max, perFrame: p.perFrame };
      if (p.px && dep) {
        // the abstraction pass's reads on far land (view depth over 294 m: its brush is all 'far' there)
        const b = Buffer.from(p.px, 'base64');
        let s = 0, n = 0;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          const X = Math.min(W - 1, Math.floor((x + 0.5) * W / p.w)), Y = Math.min(H - 1, Math.floor((p.h - 1 - y + 0.5) * H / p.h));
          const i = Y * W + X;
          if (M.land[i] && dep[i] >= 294) { s += b[(y * p.w + x) * 4]; n++; }
        }
        rec.taps[k].perFarLandPixel = n ? r4(s / n) : null;
      }
    }
    rec.taps.total = Object.values(rec.taps).reduce((a, p) => a + (p.perFrame || 0), 0);
  }
  if (flag('flicker')) {
    // the picture panned by 0.25 px (the projection shifted; nothing in the world moves): b(x) = a(x + 0.25)
    const c2 = await page.evaluate((v) => { window.__st.jitterPx = 0.25; try { return window.__st.capture(v, true); } finally { window.__st.jitterPx = 0; } }, [0, 1, 5]);
    rec.F = {};
    for (const [v, key] of [[1, 'raw'], [5, 'abs'], [0, 'final']]) {
      if (!planes[key] || !c2.px[v]) continue;
      const b = MX.lumaOf(Buffer.from(c2.px[v], 'base64'), W, H, true);
      rec.F[key] = r4(MX.flickerIndex(planes[key], b, W, H, M.land, 0.25));
      if (key === 'raw') rec.F.rawWrongWay = r4(MX.flickerIndex(planes[key], b, W, H, M.land, -0.25));   // the sign check: must be larger
    }
  }
  if (flag('alias')) {
    // the same view on twice the pixels, box-filtered down: the anti-aliased reference
    await page.evaluate(([w, h]) => window.__st.size(w, h), [2 * W, 2 * H]);
    await page.evaluate(() => window.__st.render(0));
    const c2 = await page.evaluate(() => window.__st.capture([0, 1, 5], true));
    await page.evaluate(([w, h]) => window.__st.size(w, h), [W, H]);
    rec.A = { refSize: [c2.W, c2.H], costAt2x: c2.cost };
    for (const [v, key] of [[1, 'raw'], [5, 'abs'], [0, 'final']]) {
      if (!planes[key]) continue;
      const ref = MX.boxDown(MX.lumaOf(Buffer.from(c2.px[v], 'base64'), c2.W, c2.H, true), c2.W, c2.H);
      rec.A[key] = r4(MX.aliasIndex(planes[key], ref, W, H, M.land));
    }
  }
  return rec;
}

// one line a station, in the sharpness audit's summary format, with what this harness adds
function line(name, r) {
  const f2 = (v) => (v == null ? '  -  ' : v.toFixed(2));
  const sh = r.share || {}, raw = (r.raw && r.raw.land) || {}, ab = (r.abs && r.abs.land) || {}, fin = (r.final && r.final.land) || {};
  let s = `${name.padEnd(15)} land ${f2(sh.land)} ground ${f2(sh.ground)} foliage ${f2(sh.foliage)} props ${f2(sh.props)} | raw lap ${(raw.lapvar || 0).toFixed(1).padStart(7)} b1 ${(raw.b1 || 0).toFixed(1).padStart(5)} | abs t1 ${f2(ab.t1)} t2 ${f2(ab.t2)} | final lap ${(fin.lapvar || 0).toFixed(2).padStart(6)} t1 ${f2(fin.t1)} t2 ${f2(fin.t2)} t3 ${f2(fin.t3)}`;
  s += ` | halo abs ${r.halo && r.halo.abs ? (r.halo.abs.land * 100).toFixed(2) : '-'} % fin ${r.halo && r.halo.final ? (r.halo.final.land * 100).toFixed(1) : '-'} % | ${r.cost ? r.cost.calls + ' calls ' + r.cost.triangles + ' tris' : ''}`;
  if (r.A) s += ` | A raw ${f2(r.A.raw)} abs ${f2(r.A.abs)}`;
  if (r.F) s += ` | F raw ${f2(r.F.raw)} abs ${f2(r.F.abs)} fin ${f2(r.F.final)}`;
  if (r.taps) s += ` | taps abs ${r.taps.abstraction ? r.taps.abstraction.perPixel : '-'} (far ${r.taps.abstraction ? r.taps.abstraction.perFarLandPixel : '-'}) sheet ${r.taps.sheet ? r.taps.sheet.perPixel : '-'} total ${(r.taps.total / 1e6).toFixed(1)} M`;
  if (r.place) s += ` | h ${r.place.heightAboveGround.toFixed(1)} ${r.place.biome}`;
  if (r.exp) for (const [k, e] of Object.entries(r.exp)) s += `\n    ${k.padEnd(34)} final land lap ${e.final.land ? e.final.land.lapvar.toFixed(2) : '-'} t1 ${e.final.land ? f2(e.final.land.t1) : '-'} t2 ${e.final.land ? f2(e.final.land.t2) : '-'} t3 ${e.final.land ? f2(e.final.land.t3) : '-'} | abs t1 ${e.abs.land ? f2(e.abs.land.t1) : '-'} t2 ${e.abs.land ? f2(e.abs.land.t2) : '-'} | halo abs ${e.halo.abs != null ? (e.halo.abs * 100).toFixed(2) : '-'} % (patched ${e.patched})`;
  return s;
}

// a third-size thumbnail (box filter) for the sheets
function thumb(rgb, W, H, file, k = 3) {
  const w = Math.floor(W / k), h = Math.floor(H / k), o = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += rgb[((y * k + j) * W + x * k + i) * 3 + c];
    o[(y * w + x) * 3 + c] = Math.round(s / (k * k));
  }
  fs.writeFileSync(file, writePng(o, w, h, 3));
}

// a 1:1 crop of a frame (the land in the lower middle) as a PNG data URL
function crop(file, cw = 400, ch = 260) {
  const p = readPng(fs.readFileSync(file)), W = p.width, H = p.height;
  const x0 = Math.max(0, Math.floor(W / 2 - cw / 2)), y0 = Math.max(0, Math.min(H - ch, Math.floor(H * 0.62 - ch / 2)));
  const o = new Uint8Array(cw * ch * 3);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let c = 0; c < 3; c++) o[(y * cw + x) * 3 + c] = p.rgba[((y0 + y) * W + x0 + x) * 4 + c];
  return 'data:image/png;base64,' + writePng(o, cw, ch, 3).toString('base64');
}

// Contact sheets: per station, each run's final (and the first run's raw scene); and 1:1 crops of the land.
async function sheets(browser, runs, outDir, names) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const data = (f) => (fs.existsSync(f) ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : '');
  const recs = runs.map((r) => { try { return JSON.parse(fs.readFileSync(path.join(r.dir, 'run.json'), 'utf8')).stations; } catch { return {}; } });
  const cap = (n, i) => { const r = recs[i][n]; if (!r) return 'not measured'; const f = r.final && r.final.land; return `${esc(runs[i].label)}: final land t1 ${f ? f.t1.toFixed(2) : '-'} t2 ${f ? f.t2.toFixed(2) : '-'}, raw lap ${r.raw && r.raw.land ? r.raw.land.lapvar.toFixed(0) : '-'}, ${r.cost ? r.cost.calls + ' calls' : ''}`; };
  const rows = [], crops = [];
  for (const n of names) {
    const cells = runs.map((r, i) => `<figure><img src="${data(path.join(r.dir, 'thumbs', n + '_v0.png'))}"><figcaption>${cap(n, i)}</figcaption></figure>`);
    if (runs.length === 1) cells.push(`<figure><img src="${data(path.join(runs[0].dir, 'thumbs', n + '_v1.png'))}"><figcaption>raw scene pass (v1)</figcaption></figure>`);
    rows.push(`<h3>${esc(n)}</h3><div class="row">${cells.join('')}</div>`);
    const cc = runs.map((r) => { const f = path.join(r.dir, 'frames', n + '_v0.png'); return fs.existsSync(f) ? `<figure><img src="${crop(f)}"><figcaption>${esc(r.label)} final, 1:1</figcaption></figure>` : ''; });
    if (runs.length === 1) { const f = path.join(runs[0].dir, 'frames', n + '_v1.png'); if (fs.existsSync(f)) cc.push(`<figure><img src="${crop(f)}"><figcaption>raw scene, 1:1</figcaption></figure>`); }
    crops.push(`<h3>${esc(n)}</h3><div class="row">${cc.join('')}</div>`);
  }
  const css = '<style>body{margin:0;background:#f4efe4;font:13px Georgia,serif;color:#2c3350;padding:8px}h3{margin:6px 0 2px}.row{display:flex;gap:8px}figure{margin:0}img{display:block}figcaption{font-size:12px;padding:2px 0 4px}</style>';
  const title = `<b>Stations</b>: ${runs.map((r) => esc(r.label)).join(' | ')}`;
  const shoot = async (html, file) => {
    const p = await browser.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 1 });
    try { await p.setContent(html); await p.screenshot({ path: file, type: 'jpeg', quality: 84, fullPage: true, timeout: 600000 }); } finally { await p.close(); }
  };
  await shoot(`<body>${css}${title}${rows.join('')}</body>`, path.join(outDir, runs.length > 1 ? 'compare.jpg' : 'sheet.jpg'));
  await shoot(`<body>${css}${title} (1:1 crops of the land)${crops.join('')}</body>`, path.join(outDir, runs.length > 1 ? 'compare-crops.jpg' : 'crops.jpg'));
  log('sheets in', outDir);
}

async function sheetOnly(dirs, outFile) {
  const runs = dirs.map((d) => { const j = JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8')); return { dir: path.resolve(d), label: val('labels') ? val('labels').split(',')[dirs.indexOf(d)] : j.label, names: Object.keys(j.stations) }; });
  const names = STATIONS.map((s) => s.name).filter((n) => runs.some((r) => r.names.includes(n)));
  const browser = await pw.chromium.launch();
  try {
    const dir = outFile ? path.dirname(path.resolve(outFile)) : runs[runs.length - 1].dir;
    await sheets(browser, runs, dir, names);
    if (outFile) { fs.renameSync(path.join(dir, 'compare.jpg'), outFile); fs.renameSync(path.join(dir, 'compare-crops.jpg'), outFile.replace(/\.jpe?g$/, '-crops.jpg')); }
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------------------------------------------
// The committed baseline: the runs' numbers (no pixels), keyed by tier and size.
function collect(outFile, commit, from) {
  const base = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { commit, harness: 'tests/stations.mjs', configs: {} };
  base.commit = commit;
  for (const d of from.split(',').filter(Boolean)) {
    const j = JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8'));
    const key = `${j.config.tier}@${j.config.device || j.config.size}`;
    const prev = base.configs[key] || { stations: {} };
    base.configs[key] = { label: j.label, when: j.when, query: j.config.query, device: j.config.device, using: j.using, problems: j.problems, stations: { ...prev.stations, ...j.stations } };
    console.log('collected', key, Object.keys(j.stations).length, 'stations from', d);
  }
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(base, null, 1) + '\n');
  return 0;
}

// The guard's rules (section 5) for a run against the baseline: printed per station, 'flag' where a rule
// is not met. An item may state its own exceptions (W2.1's raw b1, W7.1's cost budget): read with them.
function compare(baseSpec, withDir) {
  const [baseFile, keyWanted] = baseSpec.split(':');
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  const runs = withDir.split(',').map((d) => JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8')));
  let flags = 0;
  for (const [ri, j] of runs.entries()) {
    const key = keyWanted || `${j.config.tier}@${j.config.device || j.config.size}`;
    const B = base.configs ? base.configs[key] : { stations: base.stations };
    if (!B) { console.log('no baseline for', key); return 2; }
    console.log(`== ${j.label} against ${base.commit || baseFile} ${key}`);
    for (const [n, r] of Object.entries(j.stations)) {
      const b = B.stations[n];
      if (!b) { console.log(n, 'not in the baseline'); continue; }
      const out = [];
      const chk = (ok, txt) => { out.push((ok ? 'ok   ' : 'FLAG ') + txt); if (!ok) flags++; };
      const fl = r.final.land, bl = b.final.land, rl = r.raw.land, brl = b.raw.land;
      chk(fl.t1 >= bl.t1 - 0.02 && fl.t2 >= bl.t2 - 0.02, `detail: final land t1 ${bl.t1.toFixed(2)} -> ${fl.t1.toFixed(2)}, t2 ${bl.t2.toFixed(2)} -> ${fl.t2.toFixed(2)} (at least base - 0.02)`);
      chk(rl.b2 >= 0.95 * brl.b2 && rl.b3 >= 0.95 * brl.b3, `detail: raw land b2 ${brl.b2.toFixed(1)} -> ${rl.b2.toFixed(1)}, b3 ${brl.b3.toFixed(1)} -> ${rl.b3.toFixed(1)} (at least 0.95 x base)`);
      chk(fl.t1 <= 1.4, `false sharpness: final land t1 ${fl.t1.toFixed(2)} (at most 1.4)`);
      if (r.halo && r.halo.abs) chk(r.halo.abs.land <= 0.005, `false sharpness: halo share of the abstraction output ${(r.halo.abs.land * 100).toFixed(2)} % (at most 0.5 %); final ${b.halo && b.halo.final ? (b.halo.final.land * 100).toFixed(1) : '-'} -> ${(r.halo.final.land * 100).toFixed(1)} %`);
      if (r.A && r.A.abs != null && b.A && b.A.raw != null) chk(r.A.abs <= b.A.raw, `false sharpness: A of the abstraction output ${r.A.abs.toFixed(3)} (at most the baseline raw's ${b.A.raw.toFixed(3)})`);
      if (r.F && r.F.raw != null && b.F && b.F.raw != null) out.push(`info F raw ${b.F.raw.toFixed(3)} -> ${r.F.raw.toFixed(3)}, abs ${b.F.abs != null ? b.F.abs.toFixed(3) : '-'} -> ${r.F.abs != null ? r.F.abs.toFixed(3) : '-'} (W2.5 on: at most 0.8 x the baseline raw's at the air stations)`);
      const pf = (r.palette && r.palette.final) || {}, pb = (b.palette && b.palette.final) || {};
      for (const reg of Object.keys(pb)) {
        if (!pf[reg]) continue;
        const dE = MX.deltaE76(pf[reg].lab, pb[reg].lab), dL = Math.max(Math.abs(pf[reg].L10 - pb[reg].L10), Math.abs(pf[reg].L50 - pb[reg].L50), Math.abs(pf[reg].L90 - pb[reg].L90));
        chk(dE <= 3 && dL <= 3, `look: ${reg} mean colour dE76 ${dE.toFixed(2)} (at most 3), L* 10/50/90 moved ${dL.toFixed(1)} at most (at most 3)`);
      }
      if (r.strip && b.strip) { const d = Math.max(...r.strip.map((v, i) => Math.abs(v - b.strip[i]))); chk(d <= 2, `look: paper border strip mean moved ${d.toFixed(2)}/255 (at most 2)`); }
      chk(r.cost.calls <= 1.1 * b.cost.calls && r.cost.triangles <= 1.1 * b.cost.triangles, `cost: ${b.cost.calls} -> ${r.cost.calls} calls, ${b.cost.triangles} -> ${r.cost.triangles} triangles (at most +10 %)`);
      if (r.taps && b.taps) out.push(`info post reads per frame ${(b.taps.total / 1e6).toFixed(2)} M -> ${(r.taps.total / 1e6).toFixed(2)} M (may not grow but by an item's stated cost)`);
      console.log(`${n}${ri ? ' (' + j.label + ')' : ''}\n  ` + out.join('\n  '));
    }
  }
  console.log(flags ? `${flags} flags (read each against the item's own exceptions)` : 'no flags');
  return flag('strict') && flags ? 1 : 0;
}

// Two runs of the same stations: every number of the measures compared. The harness's acceptance is that two runs
// agree to two decimals on every metric: read here as the normalised measures (the transfers t, the region shares,
// A, F, the halo shares) within half a unit of the second decimal (0.005), the cost equal, CIELAB and the L*
// percentiles within 0.5, and the absolute magnitudes (lapvar, b1-b3) within 1 %; a mask of fewer than 5000 pixels is
// not judged (at E_foot the ground 30-150 m off is 771 pixels of stream bank, where the water and the grass move).
function diffRuns([a, b]) {
  const A = JSON.parse(fs.readFileSync(path.join(a, 'run.json'), 'utf8')).stations, B = JSON.parse(fs.readFileSync(path.join(b, 'run.json'), 'utf8')).stations;
  const skip = new Set(['secs', 'place', 'station', 'size', 'refSize', 'fit', 'costAt2x', 'perFrame', 'min', 'max', 'total', 'n', 'rawWrongWay']);
  const rows = [];
  let small = 0;
  const walk = (x, y, k) => {
    if (typeof x === 'number' && typeof y === 'number') { rows.push({ k, a: x, b: y, d: Math.abs(x - y) }); return; }
    // a mask of fewer than 5000 pixels (0.5 % of a 1280x720 frame) is too small a sample to judge run against run
    if (x && y && typeof x === 'object' && typeof x.n === 'number' && Math.min(x.n, y.n || 0) < 5000) { small++; return; }
    if (x && y && typeof x === 'object') for (const key of Object.keys(x)) if (!skip.has(key) && key in y) walk(x[key], y[key], k + '.' + key);
  };
  for (const n of Object.keys(A)) if (B[n]) walk(A[n], B[n], n);
  const kind = (k) => (/\.(t[123]|land|ground|foliage|props|raw|abs|final|sky|water|figure)$/.test(k) && /\.(share|A|F|halo)\.|\.t[123]$/.test(k) ? 'normalised'
    : /\.cost\./.test(k) ? 'cost' : /\.palette\./.test(k) ? 'colour' : 'absolute');
  const bad = [];
  let worstRel = { r: 0 };
  for (const r of rows) {
    const kd = kind(r.k);
    r.kind = kd;
    if (kd === 'normalised' && r.d > 0.005) bad.push(r);
    else if (kd === 'cost' && r.a !== r.b) bad.push(r);
    else if (kd === 'colour' && r.d > 0.5) bad.push(r);   // CIELAB and L* percentiles: half a unit (the guard's bound is 3)
    else if (kd === 'absolute') {
      const rel = r.d / Math.max(1e-9, Math.abs(r.a), Math.abs(r.b));
      if (Math.abs(r.a) > 0.5 && rel > worstRel.r) worstRel = { r: rel, k: r.k, a: r.a, b: r.b };
      if (Math.abs(r.a) > 0.5 && rel > 0.01) bad.push(r);
    }
  }
  const counts = rows.reduce((o, r) => { o[r.kind] = (o[r.kind] || 0) + 1; return o; }, {});
  const norm = rows.filter((r) => r.kind === 'normalised').sort((p, q) => q.d - p.d);
  console.log('largest normalised differences:'); for (const r of norm.slice(0, 6)) console.log('  ' + r.k.padEnd(44), r.a, r.b);
  console.log(`largest relative difference of an absolute measure: ${(worstRel.r * 100).toFixed(2)} % (${worstRel.k}: ${worstRel.a} / ${worstRel.b})`);
  console.log(`${rows.length} numbers compared (${JSON.stringify(counts)}; ${small} masks under 5000 pixels not judged); ${bad.length} outside the rule` + (bad.length ? ': ' + bad.slice(0, 8).map((r) => `${r.k} ${r.a} / ${r.b}`).join('; ') : ''));
  return bad.length ? 1 : 0;
}

// A tier's pictures against another run's raw scene of the same station (the plan's tier measures read "against the
// q2 raw": the q1 and q0 finals are measured with the q2 raw scene's bands as the reference, over the q2 run's land).
function reref(dir, refDir) {
  const runFile = path.join(dir, 'run.json'), j = JSON.parse(fs.readFileSync(runFile, 'utf8'));
  const refRun = JSON.parse(fs.readFileSync(path.join(refDir, 'run.json'), 'utf8'));
  const load = (d, n, v) => { const f = path.join(d, 'frames', `${n}_v${v}.png`); return fs.existsSync(f) ? readPng(fs.readFileSync(f)) : null; };
  for (const [n, rec] of Object.entries(j.stations)) {
    const R1 = load(refDir, n, 1), R4 = load(refDir, n, 4), F0 = load(dir, n, 0), F5 = load(dir, n, 5), F1 = load(dir, n, 1);
    if (!R1 || !R4 || !F0) { console.log(n, 'missing frames'); continue; }
    if (R1.width !== F0.width || R1.height !== F0.height) { console.log(n, 'sizes differ'); continue; }
    const W = F0.width, H = F0.height, lum = (p) => MX.lumaOf(p.rgba, W, H, false);
    const { M } = MX.masks(MX.classesOf(R4.rgba, W, H, false), null, W, H);
    const rb = MX.bands(lum(R1), W, H);
    rec.vsRef = { ref: refRun.label };
    for (const [key, p] of [['final', F0], ['abs', F5], ['raw', F1]]) {
      if (!p) continue;
      const y = lum(p), pre = { bands: MX.bands(y, W, H), lap: MX.lap(y, W, H) };
      rec.vsRef[key] = {};
      for (const mk of ['land', 'ground', 'foliage']) rec.vsRef[key][mk] = MX.round(MX.stats(y, W, H, rb, M[mk], pre));
    }
    const f = rec.vsRef.final.land;
    console.log(n.padEnd(15), `final land vs ${refRun.label} raw: t1 ${f ? f.t1.toFixed(2) : '-'} t2 ${f ? f.t2.toFixed(2) : '-'} t3 ${f ? f.t3.toFixed(2) : '-'}`);
  }
  fs.writeFileSync(runFile, JSON.stringify(j, null, 1));
  return 0;
}
