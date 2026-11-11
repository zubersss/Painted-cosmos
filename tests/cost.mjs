// Frame cost in the game at every quality tier: what each view draws, as information.
// For the dearest frame of each body in the last tour (docs/lead/evidence/tour-<body>.json),
// plus the Earth spawn, the game is put there in third person as the player arrives (fair
// weather held, real explorer and ship in the frame), left to settle, and its own counters are
// read at quality 0, 1 and 2: triangles and draw calls of the whole frame.
// There is no triangle or draw-call budget (the owner's instruction, COORDINATOR.md section E,
// 2026-11-11: the best possible quality; the frame rate is held by the tiers and dynamic
// resolution, not by a count). This reports the numbers; only a console error fails it.
// Writes docs/lead/evidence/cost.json and prints a table.
//
// Usage: node tests/cost.mjs [--root dir] [--qualities 0,1,2] [--bodies earth,mars]
//                            [--places "earth:vista:temperate_forest-1,mars:biome:rust_canyons"]
//                            [--shoot "mercury:vista:crystal_gardens-2,..."  --shots dir]  (frames at quality 1)
//                            [--sheets dir (default docs/lead/evidence)] [--label text]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, repo } from './browser.mjs';
import { openPage } from '../tools/shot.mjs';

const opt = parseArgs({ w: 960, h: 540, qualities: '0,1,2', bodies: 'mercury,venus,earth,moon,mars,jupiter,saturn,uranus,neptune,pluto', places: '', shoot: '', shots: '/home/user/.pc-scratch/pilot/cost', label: '' });
const sheets = opt.sheets || path.join(repo, 'docs/lead/evidence');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
fs.mkdirSync(opt.shots, { recursive: true });

// Where to stand: given on the command line, or the dearest tour frame of each body.
let places = [];
if (opt.places) places = String(opt.places).split(',').map((s) => { const [body, kind, id] = s.split(':'); return { body, kind, id }; });
else {
  places.push({ body: 'earth', kind: 'spawn', id: 'spawn' });
  for (const body of String(opt.bodies).split(',')) {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(repo, 'docs/lead/evidence', `tour-${body}.json`), 'utf8'));
      const f = t.frames.filter((x) => x.kind !== 'orbit' && x.tris).sort((a, b) => b.tris - a.tris)[0];
      if (f) places.push({ body, kind: f.kind, id: f.id, tourTris: f.tris, tourCalls: f.calls });
    } catch { /* no sheet for this body */ }
  }
}
const shoot = new Set(String(opt.shoot).split(',').filter(Boolean));
for (const s of shoot) { const [body, kind, id] = s.split(':'); if (!places.some((p) => p.body === body && p.kind === kind && p.id === id)) places.push({ body, kind, id }); }

const query = 'dynres=0&pointerlock=0&card=0&fresh=1&save=0&audio=0&stats=1&quality=1&weather=fair&kits=0';
const { page, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: Number(opt.w), h: Number(opt.h), root: opt.root });
const rows = [];
let failed = false;
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 600000, polling: 300 });
  await page.evaluate(() => { document.getElementById('pc-hud').style.visibility = 'hidden'; });
  for (const q of String(opt.qualities).split(',').map(Number)) {
    await page.evaluate((q) => { const pc = window.__pc; pc.dyn.quality = q; pc.painter.setQuality(q); }, q);
    for (const pl of places) {
      const where = await page.evaluate((pl) => {
        const pc = window.__pc, w = pc.world, deg = (r) => (r == null ? undefined : (r * 180) / Math.PI);
        let at = null;
        if (pl.kind === 'spawn') at = { unitDir: w.getSpawn(pl.body).unitDir };
        else if (pl.kind === 'vista') at = (w.getVistas(pl.body) || []).find((v) => String(v.id) === pl.id);
        else at = w.findBiome(pl.body, pl.id);
        if (!at || !at.unitDir) return null;
        const d = at.unitDir, l = Math.hypot(d.x, d.y, d.z);
        pc.teleport({ body: pl.body, dir: [d.x / l, d.y / l, d.z / l], hour: 10, heading: deg(at.yaw), lookPitch: deg(at.pitch), firstPerson: false });
        return true;
      }, pl);
      if (!where) { log(`${pl.body} ${pl.kind} ${pl.id}: the world names no such place`); continue; }
      const t0 = Date.now();
      const settled = await page.evaluate((s) => Promise.race([window.__pc.settle(10), new Promise((r) => setTimeout(() => r(false), s * 1000))]), 150);
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => { const pc = window.__pc, x = pc.info(); return { tris: x.stats.tris, calls: x.stats.calls, quality: pc.dyn.quality, busy: pc.world.busy, tight: +(pc.sim.footCam.tight01 || 0).toFixed(2), boom: +pc.sim.footCam.boomNow.toFixed(2), shown: pc.sim.explorerVisible() }; });
      const tag = `${pl.body}:${pl.kind}:${pl.id}`;
      if (q === 1 && shoot.has(tag)) await page.screenshot({ path: path.join(opt.shots, tag.replace(/:/g, '-') + '.jpg'), type: 'jpeg', quality: 86, timeout: 600000 });
      rows.push({ place: tag, quality: q, tris: m.tris, calls: m.calls, settled: settled === true, boom: m.boom, tight01: m.tight, explorerShown: m.shown });
      log(`q${q} ${tag}: ${Math.round(m.tris / 1000)} k tris, ${m.calls} calls${settled === true ? '' : '  NOT SETTLED'}, boom ${m.boom} m${m.tight ? ', view slid ' + Math.round(m.tight * 100) + ' % into the eyes' : ''} (${Math.round((Date.now() - t0) / 1000)} s)`);
      fs.writeFileSync(path.join(sheets, 'cost.json'), JSON.stringify({ label: opt.label || (opt.root ? 'a clean export' : 'the working tree'), size: `${opt.w}x${opt.h}`, weather: 'fair, no kits', note: 'no budget: numbers are information (owner, 2026-11-11)', rows }, null, 1));
    }
  }
} catch (e) { failed = true; log('exception:', e && e.stack ? e.stack : e); }
await close();
if (problems.length) { failed = true; log('PROBLEMS:', [...new Set(problems)].slice(0, 8).join(' | ')); }
console.log('\nplace'.padEnd(40) + ['q0', 'q1', 'q2'].map((s) => s.padStart(22)).join(''));
for (const pl of places) {
  const tag = `${pl.body}:${pl.kind}:${pl.id}`;
  const cell = (q) => { const r = rows.find((x) => x.place === tag && x.quality === q); return (r ? `${Math.round(r.tris / 1000)} k / ${r.calls}` : '-').padStart(22); };
  console.log(tag.padEnd(39) + cell(0) + cell(1) + cell(2));
}
log(failed ? 'COST: FAILED (console errors or an exception)' : 'COST: measured (numbers are information, not limits)');
process.exit(failed ? 1 : 0);
