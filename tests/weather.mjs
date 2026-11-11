// The weather set: the lead's instrument for "weather in the game" (review 5).
// In the integrated game, third person as the player sees it, 960x540, quality 1, HUD hidden:
//   - the Earth spawn before, in and after the default seed's first thunderstorm (the game
//     clock is set a few seconds ahead of each moment and left to run up to it);
//   - one forced lightning flash in that storm (window.__pc.flash);
//   - a blizzard on Earth's alpine meadow (fresh snow left to gather by itself);
//   - a dust storm on Mars' dunes;
//   - Neptune's storm sea under PHYSICS' own sky, and under a forced storm sky.
// Every frame waits for the world to settle and for the clock, and records the game's own
// counters: triangles and draw calls of the whole frame, the kits' share, the sky numbers.
// Writes docs/lead/evidence/weather.jpg (contact sheet) and weather.json. Console errors fail it.
//
// Usage: node tests/weather.mjs [--root dir] [--only earth-storm,mars-dust] [--quality 1]
//                               [--out dir] [--sheets dir] [--w 960 --h 540] [--label text]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs, repo } from './browser.mjs';
import { openPage } from '../tools/shot.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/weather', w: 960, h: 540, quality: 1, only: '', label: '' });
const W = Number(opt.w), H = Number(opt.h);
const sheets = opt.sheets || path.join(repo, 'docs/lead/evidence');
fs.mkdirSync(opt.out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let label = opt.label;
if (!label) {
  try { label = 'commit ' + execSync('git rev-parse --short HEAD', { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() + (opt.root ? ' (clean export)' : ' (working tree)'); }
  catch { label = opt.root ? 'a clean export' : 'the working tree'; }
}

// t: the game clock at the frame (s). pre: seconds of game time run up to it (the sky eases,
// the marks fill the air, fresh snow gathers). place: the spawn, or a biome's stand.
const STORM = { cloud: 1, overcast: 0.95, haze: 0.35, fog: 0.5, wet: 0.9, rain: 0.85, storm: 0.85 };
const SHOTS = [
  { id: 'earth-before', what: 'Earth spawn, before the thunderstorm', body: 'earth', place: 'spawn', t: 540, pre: 10 },
  { id: 'earth-storm', what: 'Earth spawn, in the thunderstorm', body: 'earth', place: 'spawn', t: 720, pre: 14 },
  { id: 'earth-flash', what: 'the same storm, one forced lightning flash (__pc.flash)', body: 'earth', place: 'spawn', t: 724, pre: 0, flash: true, stay: true },
  { id: 'earth-after', what: 'Earth spawn, after the storm', body: 'earth', place: 'spawn', t: 870, pre: 10, stay: true },
  // The same three moments with the sun held at eleven in the morning, to judge the storm as a
  // daylight picture (the frames above are what a new player gets: Earth's day is 25 minutes,
  // the game begins at 9:30, so this storm arrives at nine in the evening).
  { id: 'earth-before-day', what: 'before the storm, sun held at 11:00', body: 'earth', place: 'spawn', t: 540, pre: 10, hour: 11 },
  { id: 'earth-storm-day', what: 'in the storm, sun held at 11:00', body: 'earth', place: 'spawn', t: 720, pre: 14, hour: 11 },
  { id: 'earth-flash-day', what: 'the same, one forced lightning flash', body: 'earth', place: 'spawn', t: 724, pre: 0, flash: true, stay: true },
  { id: 'earth-after-day', what: 'after the storm, sun held at 11:00 (the clock was jumped, so the ground had no time to dry)', body: 'earth', place: 'spawn', t: 870, pre: 10, hour: 11 },
  { id: 'earth-blizzard', what: 'blizzard on Earth\'s alpine meadow (fresh snow gathered by itself)', body: 'earth', place: 'alpine_meadow', t: 470, pre: 32, hour: 11 },
  { id: 'mars-dust', what: 'dust storm on Mars\' dunes', body: 'mars', place: 'dust_dunes', t: 840, pre: 12, hour: 11 },
  { id: 'neptune-gale', what: 'Neptune\'s storm sea under PHYSICS\' own sky', body: 'neptune', place: 'storm_seas', t: 150, pre: 12, hour: 11 },
  { id: 'neptune-gale-forced', what: 'the same sea under a forced storm sky (world.setWeather)', body: 'neptune', place: 'storm_seas', t: 156, pre: 4, hour: 11, stay: true, force: STORM },
];
const WANT = SHOTS.filter((s) => !opt.only || String(opt.only).split(',').includes(s.id));

const query = `dynres=0&pointerlock=0&card=0&fresh=1&save=0&audio=0&stats=1&quality=${opt.quality}`;
const { page, browser, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root: opt.root });
// With --only, the frames not shot again are kept from the last run (their numbers and files).
let rows = [];
if (opt.only) { try { rows = JSON.parse(fs.readFileSync(path.join(sheets, 'weather.json'), 'utf8')).frames.filter((r) => !WANT.some((s) => s.id === r.id) && r.file && fs.existsSync(path.join(opt.out, r.file))); } catch { rows = []; } }
const order = (r) => SHOTS.findIndex((s) => s.id === r.id);
const save = () => { rows.sort((a, b) => order(a) - order(b)); fs.writeFileSync(path.join(sheets, 'weather.json'), JSON.stringify({ label, size: `${W}x${H}`, quality: Number(opt.quality), frames: rows }, null, 1)); };
let failed = false;

async function settle(sec = 150) {
  const t0 = Date.now();
  const ok = await page.evaluate((s) => Promise.race([window.__pc.settle(10), new Promise((r) => setTimeout(() => r(false), s * 1000))]), sec);
  return ok === true ? Math.round((Date.now() - t0) / 100) / 10 : null;
}

try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 600000, polling: 300 });
  log('ready', JSON.stringify(await page.evaluate(() => window.__pc.info().using)), label);
  await page.evaluate(() => { document.getElementById('pc-hud').style.visibility = 'hidden'; });
  for (const s of WANT) {
    const t0 = Date.now();
    await page.evaluate((s) => {
      const pc = window.__pc, w = pc.world;
      if (w.setWeather) w.setWeather(s.force || null);
      pc.setClock(s.t - s.pre);
      if (s.stay) return;
      if (s.place === 'spawn') { const d = w.getSpawn(s.body).unitDir; pc.teleport({ body: s.body, dir: [d.x, d.y, d.z], hour: s.hour }); return; }
      const at = w.findBiome(s.body, s.place), d = at.unitDir, deg = (r) => (r == null ? undefined : (r * 180) / Math.PI);
      pc.teleport({ body: s.body, dir: [d.x, d.y, d.z], hour: s.hour, heading: deg(at.yaw), lookPitch: deg(at.pitch), firstPerson: false });
    }, s);
    const settled = await settle();
    await page.waitForFunction((t) => window.__pc.sim.t >= t, s.t, { timeout: 900000, polling: 250 });
    if (s.flash) {
      // Hold the flash long enough for the capture to land inside it.
      await page.evaluate(() => new Promise((res) => { window.__pc.flash(400); let n = 0; const f = () => (++n >= 3 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    }
    const file = path.join(opt.out, s.id + '.jpg');
    try { await page.screenshot({ path: file, type: 'jpeg', quality: 86, timeout: 600000 }); }
    catch { await page.waitForTimeout(4000); await page.screenshot({ path: file, type: 'jpeg', quality: 86, timeout: 600000 }); }
    const m = await page.evaluate(() => {
      const pc = window.__pc, x = pc.info(), h = pc.physics && pc.physics.here, wx = h && h.weather, air = h && h.air;
      const wind = h && h.wind ? Math.hypot(h.wind.x || 0, h.wind.y || 0, h.wind.z || 0) : null;
      if (pc.game.forceFlash) pc.game.forceFlash = 0;
      return {
        t: +pc.sim.t.toFixed(1), hour: +pc.sim.eph.localSolarTime(pc.sim.bodyId, pc.sim.t, (() => { const p = pc.sim.ex.p, l = Math.hypot(p.x, p.y, p.z); return { x: p.x / l, y: p.y / l, z: p.z / l }; })()).toFixed(1), state: x.state, biome: x.mood.biomeId, busy: pc.world.busy, tris: x.stats.tris, calls: x.stats.calls,
        kits: x.weather.kits, sky: x.weather.sky, kind: wx ? wx.kind : null, wind: wind == null ? (air && air.speed != null ? +air.speed.toFixed(1) : null) : +wind.toFixed(1),
        freshSnow: pc.world.freshSnow == null ? null : +(+pc.world.freshSnow).toFixed(2), firstPerson: !!pc.sim.footCam.firstPerson,
        physicsWorstMs: x.physics ? +x.physics.worstMs.toFixed(2) : null,
      };
    });
    const row = { id: s.id, what: s.what, file: path.basename(file), wanted: s.t, forced: s.force || null, settledSeconds: settled, seconds: Math.round((Date.now() - t0) / 1000), ...m };
    rows.push(row);
    const sk = m.sky || {};
    log(`${s.id}: t ${m.t}, ${m.kind}, ${Math.round(m.tris / 1000)} k tris, ${m.calls} calls, kits ${m.kits ? m.kits.calls + ' calls ' + m.kits.tris + ' tris' : 'none'}, overcast ${sk.overcast} rain ${sk.rain} snowfall ${sk.snowfall} dust ${sk.dust} wet ${sk.wet} storm ${sk.storm}, fresh snow ${m.freshSnow}, ${settled == null ? 'NOT SETTLED' : 'settled'} (${row.seconds} s)`);
    save();
  }
  await writeSheet();
} catch (e) { failed = true; log('exception:', e && e.stack ? e.stack : e); }
await close();
if (problems.length) { failed = true; log('PROBLEMS:', [...new Set(problems)].slice(0, 8).join(' | ')); }
log(failed ? 'WEATHER SET FAILED' : 'WEATHER SET DONE', rows.length, 'frames');
process.exit(failed ? 1 : 0);

async function writeSheet() {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const k = (n) => (n >= 1000 ? Math.round(n / 1000) + ' k' : String(n || 0));
  const cap = (r) => {
    const s = r.sky || {}, bits = [];
    for (const n of ['overcast', 'rain', 'snowfall', 'dust', 'fog', 'storm', 'wet']) if (s[n] >= 0.05) bits.push(`${n} ${s[n]}`);
    return `<b>${esc(r.id)}</b>: ${esc(r.what)}. Clock ${r.t} s${r.hour == null ? '' : ', local time ' + Math.floor(r.hour) + ':' + String(Math.round((r.hour % 1) * 60)).padStart(2, '0')}, PHYSICS says "${esc(r.kind)}", wind ${r.wind} m/s at the explorer${r.forced ? ' (the sky in the picture is forced; the numbers here are PHYSICS\' own)' : ''}; ${bits.join(', ') || 'fair'}. `
      + `${k(r.tris)} triangles, ${r.calls} draw calls; kits ${r.kits ? r.kits.calls + ' calls, ' + k(r.kits.tris) + ' triangles' : 'none'}`
      + `${r.freshSnow ? '; fresh snow ' + r.freshSnow : ''}${r.settledSeconds == null ? ' <span class="bad">NOT SETTLED</span>' : ''}${r.firstPerson ? ' <span class="bad">FIRST PERSON</span>' : ''}`;
  };
  const cells = rows.map((r) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(opt.out, r.file)).toString('base64')}"><figcaption>${cap(r)}</figcaption></figure>`).join('');
  const html = `<body style="margin:0;background:#f4efe4;font:italic 15px Georgia,serif;color:#2c3350"><header><b>The weather set</b>: the game itself, third person, ${esc(label)}, ${W}x${H}, quality ${opt.quality}, HUD hidden.</header>`
    + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;width:1620px">${cells}</div><style>header{padding:12px 12px 2px;font-size:17px}figure{margin:0}img{width:800px;display:block}figcaption{padding:3px 2px 6px;font-size:13.5px;line-height:1.3}.bad{color:#a02c1c;font-style:normal;font-weight:bold}</style></body>`;
  const out = path.join(sheets, 'weather.jpg');
  try {
    const sheet = await browser.newPage({ viewport: { width: 1640, height: 200 }, deviceScaleFactor: 1 });
    await sheet.setContent(html);
    await sheet.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true });
    await sheet.close();
  } catch (e) {
    log('  (sheet could not be captured in the game\'s browser; using a fresh one)');
    const alt = await openPage({ pagePath: '/src/ui/theme.css', w: 1640, h: 200, root: opt.root });
    await alt.page.setContent(html);
    await alt.page.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true });
    await alt.close();
  }
  log('wrote', out);
}
