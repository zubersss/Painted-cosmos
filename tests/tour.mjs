// The freeze-frame tour: the lead's instrument for "every frame passes the freeze-frame test".
// In the integrated game, for every body:
//   - stand in every biome, on dry and gentle ground of that biome (the world's own place for
//     it, checked here, and moved to the nearest standable spot if it is not one); when that
//     place is the painter's easel the frame is taken in first person, facing as the painter did;
//   - stand at every vista (world.getVistas): the views the game sends the player to, facing
//     the way the painter faced when the world says so (yaw, pitch);
//   - look at the body from orbit, from the ship.
// Each frame waits until the world has nothing left to build (world.busy === 0 for ten frames
// in a row), is captured on foot at 960x540 and quality 1 with the HUD hidden, and goes into
// one contact sheet per body: docs/lead/evidence/tour-<body>.jpg (+ .json with the numbers).
// The sheet says in so many words when a frame did NOT settle, when the explorer is standing
// in liquid, when a vista cannot be stood on, and what each frame cost.
// Console errors on any body fail the run.
//
// For a long tour in software GL run one body per process (the browser tires):
//   for b in mercury venus earth; do node tests/tour.mjs --bodies $b; done
// Usage: node tests/tour.mjs [--bodies earth,mars] [--root dir] [--quality 1] [--w 960 --h 540]
//                            [--hour 10] [--settle 120] [--out dir] [--vistas 0] [--orbit 0]
//                            [--label "text for the sheet's header"] [--query "stub=1"]
//                            [--sheets dir (default docs/lead/evidence)]
//                            [--weather 1 (leave PHYSICS' weather on; default: a clear sky, no marks)]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs, repo } from './browser.mjs';
import { openPage } from '../tools/shot.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/tour', w: 960, h: 540, quality: 1, hour: 10, settle: 120, vistas: 1, orbit: 1, label: '', query: '', bodies: 'mercury,venus,earth,moon,mars,jupiter,saturn,uranus,neptune,pluto' });
const W = Number(opt.w), H = Number(opt.h), SETTLE = Number(opt.settle);
const sheets = opt.sheets || path.join(repo, 'docs/lead/evidence');
fs.mkdirSync(opt.out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let label = opt.label;
if (!label) {
  try { label = 'commit ' + execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim() + (opt.root ? ' (clean export)' : ' (working tree)'); }
  catch { label = opt.root ? 'a clean export' : 'the working tree'; }
}
// Fair weather and no weather marks unless asked otherwise (--weather 1): the sheets are compared
// from review to review, and a storm that happens to cross a stand would make that impossible.
// The weather itself is judged on its own sheet: node tests/weather.mjs.
const fair = String(opt.weather || '0') === '0' ? '&weather=fair&kits=0' : '';
const query = `dynres=0&pointerlock=0&card=0&fresh=1&save=0&audio=0&quality=${opt.quality}${fair}` + (opt.query ? '&' + opt.query : '');
const { page, browser, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root: opt.root });
const summary = { label, quality: Number(opt.quality), size: `${W}x${H}`, settleLimit: SETTLE, bodies: {} };
let failed = false;

// Runs in the page: every place to stand on `b`, checked against the world's own surface.
function planPlaces(b) {
  const pc = window.__pc, w = pc.world, smp = pc.sim.sampler(b);
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const deg = (r) => (r == null ? null : (r * 180) / Math.PI);
  const look = (d) => { const s = smp(d); return { liquid: s.isLiquid ? +(s.liquidRadius - s.radius).toFixed(2) : 0, slopeDeg: +deg(s.slope).toFixed(1), biome: s.biomeId, radius: s.radius }; };
  const ok = (q, want) => q.liquid === 0 && q.slopeDeg < 20 && (!want || q.biome === want);
  // The nearest standable spot around d0: rings out to 400 m, sixteen bearings each.
  const dry = (d0, want) => {
    const here = look(d0);
    if (ok(here, want)) return { dir: d0, moved: 0, at: here };
    const up = norm(d0);
    let e = { x: up.z, y: 0, z: -up.x };                      // east = Y x up
    const el = Math.hypot(e.x, e.z); e = el > 1e-6 ? { x: e.x / el, y: 0, z: e.z / el } : { x: 1, y: 0, z: 0 };
    const n = { x: up.y * e.z - up.z * e.y, y: up.z * e.x - up.x * e.z, z: up.x * e.y - up.y * e.x };
    for (const pass of [want, null]) {
      for (const ring of [8, 16, 30, 50, 80, 120, 170, 230, 300, 400]) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + ring, k = ring / here.radius;
          const d = norm({ x: up.x + (e.x * Math.cos(a) + n.x * Math.sin(a)) * k, y: up.y + (e.y * Math.cos(a) + n.y * Math.sin(a)) * k, z: up.z + (e.z * Math.cos(a) + n.z * Math.sin(a)) * k });
          const q = look(d);
          if (ok(q, pass)) return { dir: d, moved: ring, at: q, otherBiome: pass ? null : q.biome };
        }
      }
    }
    return { dir: d0, moved: 0, at: here, problem: 'no dry, gentle ground within 400 m' };
  };
  const arr = (d) => [d.x, d.y, d.z];
  const out = [];
  for (const bi of (w.getBiomes ? w.getBiomes(b) : [])) {
    const at = w.findBiome ? w.findBiome(b, bi.id) : null;
    if (!at || !at.unitDir) { out.push({ kind: 'biome', id: bi.id, name: bi.name || bi.id, missing: true }); continue; }
    const p = dry(norm(at.unitDir), bi.id);
    out.push({ kind: 'biome', id: bi.id, name: bi.name || bi.id, dir: arr(p.dir), heading: p.moved ? null : deg(at.yaw), lookPitch: p.moved ? null : deg(at.pitch), moved: p.moved, otherBiome: p.otherBiome || null, problem: p.problem || null, at: p.at });
  }
  if (!out.length) { const sp = norm(w.getSpawn(b).unitDir); out.push({ kind: 'biome', id: 'spawn', name: 'spawn', dir: arr(sp), moved: 0, at: look(sp) }); }
  for (const v of (w.getVistas ? w.getVistas(b) : [])) {
    if (!v || !v.unitDir) continue;
    const d = norm(v.unitDir);
    out.push({ kind: 'vista', id: String(v.id), name: v.name || String(v.id), dir: arr(d), heading: deg(v.yaw), lookPitch: deg(v.pitch), moved: 0, at: look(d) });
  }
  return out;
}

try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 600000, polling: 300 });
  const using = await page.evaluate(() => window.__pc.info().using);
  log('ready', JSON.stringify(using), label);
  // The painting, not the interface: hide the HUD; count the whole frame's triangles and calls.
  await page.evaluate(() => { document.getElementById('pc-hud').style.visibility = 'hidden'; window.__pc.game.showStats = true; });
  for (const body of String(opt.bodies).split(',')) {
    let places = await page.evaluate(planPlaces, body);
    if (String(opt.vistas) === '0') places = places.filter((p) => p.kind !== 'vista');
    // A vista that is the very place and heading of a biome frame is the same picture: one frame.
    const frames = [];
    const same = (a, b) => a.dir && b.dir && Math.hypot(a.dir[0] - b.dir[0], a.dir[1] - b.dir[1], a.dir[2] - b.dir[2]) * 3000 < 4 && Math.abs((a.heading || 0) - (b.heading || 0)) < 2;
    for (const pl of places) {
      if (pl.missing) { frames.push({ ...pl, flags: ['THE WORLD NAMES NO PLACE FOR THIS BIOME'] }); continue; }
      const twin = pl.kind === 'vista' ? frames.find((f) => f.kind === 'biome' && same(f, pl)) : null;
      if (twin) { twin.alsoVista = pl.name; twin.vistaId = pl.id; continue; }
      frames.push(await capture(body, pl));
    }
    // Did the game count each view as found when the explorer stood on its spot?
    const found = ((await measure()).vistas[body]) || [];
    for (const f of frames) {
      const id = f.kind === 'vista' ? f.id : f.vistaId;
      if (!id || !f.file) continue;
      f.found = found.includes(id);
      if (!f.found) f.flags.push('THE GAME DID NOT COUNT THE VIEW AS FOUND HERE');
    }
    if (String(opt.orbit) !== '0') frames.push(await captureOrbit(body));
    await writeSheet(body, frames);
  }
} catch (e) { failed = true; log('exception:', e && e.stack ? e.stack : e); }
await close();
if (problems.length) { failed = true; log('PROBLEMS:', [...new Set(problems)].slice(0, 8).join(' | ')); }
log(failed ? 'TOUR FAILED' : 'TOUR DONE', JSON.stringify(Object.fromEntries(Object.entries(summary.bodies).map(([k, v]) => [k, v.frames.length]))));
process.exit(failed ? 1 : 0);

// Wait for the world: nothing left to build for ten frames in a row, or the limit. Returns the
// seconds it took, or null when the limit ran out first.
async function settle() {
  const t0 = Date.now();
  const ok = await page.evaluate((sec) => Promise.race([window.__pc.settle(10), new Promise((r) => setTimeout(() => r(false), sec * 1000))]), SETTLE);
  return ok === true ? Math.round((Date.now() - t0) / 100) / 10 : null;
}

async function shoot(file) {
  // Software GL sometimes refuses a capture after a long run: wait and try once more.
  try { await page.screenshot({ path: file, type: 'jpeg', quality: 84, timeout: 600000 }); }
  catch { await page.waitForTimeout(4000); await page.screenshot({ path: file, type: 'jpeg', quality: 84, timeout: 600000 }); }
}

async function measure() {
  return page.evaluate(() => {
    const x = window.__pc.info();
    return {
      biome: x.mood.biomeId, state: x.state, busy: window.__pc.world.busy, tris: x.stats.tris, calls: x.stats.calls,
      worldWorstMs: x.stats.worldWorstMs, liquidDepth: +(x.explorer.liquidDepth || 0).toFixed(2), mode: x.explorer.mode,
      grounded: x.explorer.grounded, vistas: x.vistas, physicsWorstMs: x.physics ? +x.physics.worstMs.toFixed(2) : null,
    };
  });
}

async function capture(body, pl) {
  const t0 = Date.now();
  // A biome frame taken from the painter's own easel is the picture as it was painted: first
  // person, nothing in the way. Every other frame is third person, as the player arrives.
  const easel = pl.kind === 'biome' && pl.heading != null;
  await page.evaluate(({ b, pl, hour, easel }) => { window.__pc.teleport({ body: b, dir: pl.dir, hour, heading: pl.heading == null ? undefined : pl.heading, lookPitch: pl.lookPitch == null ? undefined : pl.lookPitch, firstPerson: easel }); }, { b: body, pl, hour: Number(opt.hour), easel });
  const settled = await settle();
  await page.waitForTimeout(900);                 // let the explorer come to rest and the read-out count a frame
  const m = await measure();
  const file = path.join(opt.out, `${body}-${pl.kind}-${pl.id}.jpg`);
  await shoot(file);
  const flags = [];
  if (settled == null) flags.push(`NOT SETTLED after ${SETTLE} s (world.busy ${m.busy})`);
  if (pl.problem) flags.push(pl.problem.toUpperCase());
  if (m.liquidDepth > 0.3 || pl.at.liquid > 0.3) flags.push(`STANDING IN LIQUID (${Math.max(m.liquidDepth, pl.at.liquid)} m)`);
  if (pl.kind === 'vista' && pl.at.slopeDeg >= 35) flags.push(`ON A ${pl.at.slopeDeg} DEGREE SLOPE`);
  if (pl.kind === 'biome' && pl.id !== 'spawn' && m.biome && m.biome !== pl.id) flags.push('STOOD IN ' + m.biome);
  const f = { ...pl, file, settled, flags, found: null, tris: m.tris, calls: m.calls, worldWorstMs: m.worldWorstMs, physicsWorstMs: m.physicsWorstMs, stoodIn: m.biome, seconds: Math.round((Date.now() - t0) / 1000) };
  log(`${body} ${pl.kind} ${pl.id}: ${settled == null ? 'NOT SETTLED (busy ' + m.busy + ')' : 'settled in ' + settled + ' s'}, ${Math.round(m.tris / 1000)} k tris, ${m.calls} calls, world worst ${m.worldWorstMs} ms${pl.moved ? ', moved ' + pl.moved + ' m' : ''}${flags.length ? ' | ' + flags.join('; ') : ''} (${f.seconds} s)`);
  return f;
}

// The body from orbit, from the ship: about one radius up (where a pulse hop arrives), nose on the planet.
async function captureOrbit(body) {
  const t0 = Date.now();
  await page.evaluate(({ b, hour }) => {
    const pc = window.__pc, sp = pc.world.getSpawn(b).unitDir;
    const R = pc.sim.sampler(b)(sp).radius;
    pc.teleport({ body: b, dir: [sp.x, sp.y, sp.z], hour, ship: true, altitude: R * 1.15, pitchDeg: -86 });
  }, { b: body, hour: Number(opt.hour) });
  const settled = await settle();
  await page.waitForTimeout(900);
  const m = await measure();
  const file = path.join(opt.out, `${body}-orbit.jpg`);
  await shoot(file);
  const flags = settled == null ? [`NOT SETTLED after ${SETTLE} s (world.busy ${m.busy})`] : [];
  log(`${body} orbit: ${settled == null ? 'NOT SETTLED' : 'settled in ' + settled + ' s'}, ${Math.round(m.tris / 1000)} k tris, ${m.calls} calls (${Math.round((Date.now() - t0) / 1000)} s)`);
  return { kind: 'orbit', id: 'orbit', name: 'from orbit', file, settled, flags, tris: m.tris, calls: m.calls, worldWorstMs: m.worldWorstMs, stoodIn: null, moved: 0 };
}

// Contact sheet: a header that says what this is and how it went, two frames across, a caption
// under each with its numbers; anything wrong with a frame is spelled out in capitals.
async function writeSheet(body, frames) {
  const shot = frames.filter((f) => f.file);
  const unsettled = shot.filter((f) => f.settled == null).length;
  const k = (n) => (n >= 1000 ? Math.round(n / 1000) + ' k' : String(n || 0));
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const caption = (f) => {
    const what = f.kind === 'biome' ? `biome <b>${esc(f.id)}</b>` : f.kind === 'vista' ? `vista <b>${esc(f.name)}</b>` : '<b>from orbit</b>';
    const bits = [];
    if (f.alsoVista) bits.push(`also the vista "${esc(f.alsoVista)}"`);
    if (f.kind === 'biome' && f.heading != null) bits.push('from the easel, first person');
    if (f.moved) bits.push(`moved ${f.moved} m from the world's place to stand on dry, gentle ground${f.otherBiome ? ' (of ' + esc(f.otherBiome) + ')' : ''}`);
    if (f.file) bits.push(f.settled == null ? '' : `settled in ${f.settled} s`, `${k(f.tris)} triangles, ${f.calls} draw calls`, `world.update worst ${f.worldWorstMs} ms`);
    const flags = (f.flags || []).map((x) => `<span class="bad">${esc(x)}</span>`).join(' ');
    return `${body} / ${what}${bits.filter(Boolean).length ? ': ' + bits.filter(Boolean).join('; ') : ''} ${flags}`;
  };
  const cells = frames.map((f) => `<figure>${f.file ? `<img src="data:image/jpeg;base64,${fs.readFileSync(f.file).toString('base64')}">` : '<div class="none"></div>'}<figcaption>${caption(f)}</figcaption></figure>`).join('');
  const head = `<header><b>${body}</b>: the freeze-frame tour, ${esc(label)}, ${W}x${H}, quality ${opt.quality}, local time ${opt.hour}:00, ${fair ? 'fair weather held (no weather marks)' : 'the weather as it comes'}. `
    + `${shot.length} frames; <span class="${unsettled ? 'bad' : ''}">${unsettled ? unsettled + ' of them DID NOT SETTLE within ' + SETTLE + ' s (world.busy never reached 0): those frames may show unfinished terrain or flora' : 'every frame settled (world.busy reached 0) before it was captured'}</span>.</header>`;
  // The numbers first: they must survive whatever happens to the picture of the sheet.
  const rows = frames.map((f) => ({ kind: f.kind, id: f.id, name: f.name, alsoVista: f.alsoVista || null, settledSeconds: f.settled, tris: f.tris, calls: f.calls, worldWorstMs: f.worldWorstMs, physicsWorstMs: f.physicsWorstMs, stoodIn: f.stoodIn, moved: f.moved || 0, found: f.found, at: f.at, flags: f.flags || [] }));
  summary.bodies[body] = { frames: rows, unsettled };
  fs.writeFileSync(path.join(sheets, `tour-${body}.json`), JSON.stringify({ label, size: `${W}x${H}`, quality: Number(opt.quality), hour: Number(opt.hour), settleLimit: SETTLE, unsettled, frames: rows }, null, 1));
  fs.writeFileSync(path.join(opt.out, 'summary.json'), JSON.stringify(summary, null, 2));
  const html = `<body style="margin:0;background:#f4efe4;font:italic 15px Georgia,serif;color:#2c3350">${head}<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;width:1620px">${cells}</div><style>header{padding:12px 12px 2px;font-size:17px}figure{margin:0}img,.none{width:800px;display:block}.none{height:120px;background:#e6dfd0}figcaption{padding:3px 2px 6px;font-size:13.5px;line-height:1.3}.bad{color:#a02c1c;font-style:normal;font-weight:bold}</style></body>`;
  const out = path.join(sheets, `tour-${body}.jpg`);
  try {
    const sheet = await browser.newPage({ viewport: { width: 1640, height: 200 }, deviceScaleFactor: 1 });
    await sheet.setContent(html);
    await sheet.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
    await sheet.close();
  } catch (e) {
    // A browser that has painted a dozen frames in software GL sometimes refuses one more
    // capture: lay the sheet out in a fresh browser instead.
    log('  (the sheet could not be captured in the game\'s browser: ' + String(e && e.message).split('\n')[0] + '; using a fresh one)');
    const alt = await openPage({ pagePath: '/src/ui/theme.css', w: 1640, h: 200, root: opt.root });
    await alt.page.setContent(html);
    await alt.page.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
    await alt.close();
  }
  log('wrote', out, `(${shot.length} frames, ${unsettled} unsettled)`);
}
