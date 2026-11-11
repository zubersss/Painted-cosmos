// The freeze-frame tour: the lead's instrument for "every frame passes the freeze-frame test".
// In the integrated game, stand in every biome of every body (teleport), wait until the world
// has settled, capture the frame on foot at 960x540 and quality 1, and lay the frames out as
// one contact sheet per body in docs/lead/evidence/tour-<body>.jpg. Console errors on any
// body fail the run. A frame that never settles is captured anyway and marked "(unsettled)".
//
// For a long tour in software GL run one body per process (the browser tires):
//   for b in mercury venus earth; do node tests/tour.mjs --bodies $b; done
// Usage: node tests/tour.mjs [--bodies earth,mars] [--root dir] [--quality 1] [--w 960 --h 540]
//                            [--hour 10] [--settle 120] [--out dir]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, repo } from './browser.mjs';
import { openPage } from '../tools/shot.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/tour', w: 960, h: 540, quality: 1, hour: 10, settle: 120, bodies: 'mercury,venus,earth,moon,mars,jupiter,saturn,uranus,neptune,pluto' });
const W = Number(opt.w), H = Number(opt.h);
const sheets = path.join(repo, 'docs/lead/evidence');
fs.mkdirSync(opt.out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const query = `dynres=0&pointerlock=0&card=0&fresh=1&save=0&audio=0&quality=${opt.quality}`;
const { page, browser, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root: opt.root });
const summary = { quality: Number(opt.quality), size: `${W}x${H}`, bodies: {} };
let failed = false;
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 600000, polling: 300 });
  const using = await page.evaluate(() => window.__pc.info().using);
  log('ready', JSON.stringify(using));
  for (const body of String(opt.bodies).split(',')) {
    // Every biome the world names for this body, and where to stand in it.
    const places = await page.evaluate((b) => {
      const w = window.__pc.world;
      const list = w.getBiomes ? w.getBiomes(b) : [];
      const out = [];
      for (const bi of list) {
        const at = w.findBiome ? w.findBiome(b, bi.id) : null;
        if (at && at.unitDir) out.push({ id: bi.id, name: bi.name || bi.id, dir: [at.unitDir.x, at.unitDir.y, at.unitDir.z] });
      }
      if (!out.length) { const sp = w.getSpawn(b).unitDir; out.push({ id: 'spawn', name: 'spawn', dir: [sp.x, sp.y, sp.z] }); }
      return out;
    }, body);
    const frames = [];
    for (const pl of places) {
      const t0 = Date.now();
      await page.evaluate(({ b, dir, hour }) => { window.__pc.teleport({ body: b, dir, hour }); }, { b: body, dir: pl.dir, hour: Number(opt.hour) });
      const settled = await page.evaluate((sec) => Promise.race([window.__pc.settle(10), new Promise((r) => setTimeout(() => r(false), sec * 1000))]), Number(opt.settle));
      await page.waitForTimeout(600);
      const i = await page.evaluate(() => { const x = window.__pc.info(); return { biome: x.mood.biomeId, tris: x.stats.tris, state: x.state, busy: window.__pc.world.busy }; });
      const file = path.join(opt.out, `${body}-${pl.id}.jpg`);
      // Software GL sometimes refuses a capture after a long run: wait and try once more.
      try { await page.screenshot({ path: file, type: 'jpeg', quality: 84, timeout: 600000 }); }
      catch { await page.waitForTimeout(4000); await page.screenshot({ path: file, type: 'jpeg', quality: 84, timeout: 600000 }); }
      frames.push({ ...pl, file, settled: settled === true, stoodIn: i.biome, seconds: Math.round((Date.now() - t0) / 1000) });
      log(`${body} ${pl.id}: stood in ${i.biome}${settled === true ? '' : ' (unsettled, busy ' + i.busy + ')'} ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    // Contact sheet: two frames across, captions under each.
    const sheet = await browser.newPage({ viewport: { width: 1640, height: 200 }, deviceScaleFactor: 1 });
    const cells = frames.map((f) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f.file).toString('base64')}"><figcaption>${body} / ${f.id}${f.stoodIn && f.stoodIn !== f.id ? ' (stood in ' + f.stoodIn + ')' : ''}${f.settled ? '' : ' (unsettled)'}</figcaption></figure>`).join('');
    await sheet.setContent(`<body style="margin:0;background:#f4efe4;font:italic 15px Georgia,serif;color:#2c3350"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;width:1620px">${cells}</div><style>figure{margin:0}img{width:800px;display:block}figcaption{padding:3px 2px 6px}</style></body>`);
    const out = path.join(sheets, `tour-${body}.jpg`);
    await sheet.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
    await sheet.close();
    summary.bodies[body] = frames.map((f) => ({ biome: f.id, stoodIn: f.stoodIn, settled: f.settled, seconds: f.seconds }));
    log('wrote', out, `(${frames.length} frames)`);
    fs.writeFileSync(path.join(opt.out, 'summary.json'), JSON.stringify(summary, null, 2));
  }
} catch (e) { failed = true; log('exception:', e && e.stack ? e.stack : e); }
await close();
if (problems.length) { failed = true; log('PROBLEMS:', [...new Set(problems)].slice(0, 8).join(' | ')); }
log(failed ? 'TOUR FAILED' : 'TOUR DONE', JSON.stringify(Object.fromEntries(Object.entries(summary.bodies).map(([k, v]) => [k, v.length]))));
process.exit(failed ? 1 : 0);
