// Painted Cosmos physics: filmstrips of everything the physics moves. OWNER: PHYSICS. (P11)
// A Node tool, not part of the game and not a test (node --test does not pick it up).
//
//   node src/physics/three/film.mjs <subject>[,<subject>...] | all | list
//        [--root <dir>]   serve this directory (a clean export: tools/export-head.sh <dir>); default the repo
//        [--out <dir>]    where motion-<subject>.jpg and motion-<subject>.json go (default docs/shots/physics)
//        [--tag <t>]      file names motion-<subject>-<t>.* (for a before / after pair)
//        [--q "a=b&c=d"]  extra URL parameters for the lab (they win over the subject's own)
//        [--quality 2]    the tier (default 1)
//
// Each subject opens the painted lab (physics-lab.html?painted=1: PAINTER's world and painter, the game's own
// kits) with its clock stopped, and asks the page for a strip: __lab.film() advances the simulation by a fixed
// step, draws, copies the crop of the subject into one sheet, and reads the numbers of that frame from the
// simulation itself (the `probe`). So a strip does not depend on how fast the machine draws, and a verdict
// rests on a picture and on numbers of the same instants. One browser at a time (software GL).
//
// A subject:
//   q       URL parameters of the lab (body, place, time, camera, walk, ship, pre ...)
//   w, h    the viewport (px); crop [x, y, w, h] in fractions of it; tile [w, h] px of a frame in the sheet
//           (default: the crop's own pixels, nothing resampled); cols
//   frames, dt (s a frame), sub (simulation steps a frame)
//   before  (lab) => ...  run once in the page when it is ready (for instance lab.run(seconds, 1/60, each))
//   each    (i, t, ctl, lab) => ...  before every frame: scripts the explorer, the ship, the camera (lab.ctl)
//   probe   (lab) => ({...})  the numbers of a frame; P.* below are helpers that live in the page
//   cols2   which of the probe's keys go in the printed table (default all)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../../../tools/shot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');

// helpers that live in the page (window.P), written once here
const PAGE_HELPERS = `(() => {
  const L = window.__lab, ph = L.physics, r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), D = 180 / Math.PI;
  const o = {}, a = {};
  window.P = {
    r2, r3,
    // bend of a plant rooted e, n metres from the focus: degrees, and its east / north parts (deg)
    bend(e, n, stiff = 0) { ph.fields.flora.plantBend(L.at(e, n), stiff, o); return { deg: r2(o.angle * D), e: r2(o.e * D), n: r2(o.n * D), flat: r2(o.flatten01 || 0) }; },
    // wind speed (m/s) h metres over the ground e, n metres from the focus
    wind(e, n, h) { const w = ph.air(L.bodyId, L.at(e, n, h), a, h).wind; return r2(Math.hypot(w.x, w.y, w.z)); },
    windEN(e, n, h) { const w = L.enuV(ph.air(L.bodyId, L.at(e, n, h), a, h).wind); return { e: r2(w.e), n: r2(w.n) }; },
    // the explorer: where (east, north, feet over the ground), how fast (over the ground, upward), the legs
    ex() { const p = L.enu(L.ex.p), v = L.enuV(L.ex.v), B = L.ex.phys || {}; return { e: r2(p.e), n: r2(p.n), h: r3(p.h), vh: r2(Math.hypot(v.e, v.n)), vu: r2(v.u), hip: r3(B.hip || 0), clamber: r2(B.clamber01 || 0), gnd: L.ex.grounded ? 1 : 0 }; },
    // the ship: height of its origin over the ground, speeds, feet down, lift, tilt (deg from the local up), wash
    ship() { const s = L.sh, p = L.enu(s.p), v = L.enuV(s.v), B = s.phys || {}, q = s.q;
      const ux = 2 * (q.x * q.y - q.w * q.z), uy = 1 - 2 * (q.x * q.x + q.z * q.z), uz = 2 * (q.y * q.z + q.w * q.x), r = Math.hypot(s.p.x, s.p.y, s.p.z);
      const c = (ux * s.p.x + uy * s.p.y + uz * s.p.z) / r;
      return { h: r3(p.h), e: r2(p.e), n: r2(p.n), vu: r3(v.u), vh: r3(Math.hypot(v.e, v.n)), feet: B.contacts || 0, lift: r2(B.lift01 == null ? 1 : B.lift01), tilt: r2(Math.acos(Math.min(1, c)) * D), wash: r2(B.downwash ? B.downwash.speed || 0 : 0), asleep: B.asleep ? 1 : 0 }; },
    // particles of a kind: how many, their mean velocity (east, north, up; m/s) and mean height over the focus plane
    parts(kind) { const b = ph.particles[kind], n = b.count; if (!n) return { n: 0 };
      let x = 0, y = 0, z = 0, s = 0; const v = b.velocity || b.vel, st = b.stride || 3;
      if (!v) return { n };
      for (let i = 0; i < n; i++) { x += v[i * st]; y += v[i * st + 1]; z += v[i * st + 2]; s += Math.hypot(v[i * st], v[i * st + 1], v[i * st + 2]); }
      const m = L.enuV({ x: x / n, y: y / n, z: z / n }); return { n, e: r2(m.e), nn: r2(m.n), u: r2(m.u), sp: r2(s / n) }; },
    here() { const h = ph.here; return { wx: h.weather.kind, wind: r2(h.air.speed), gust: r2(h.air.gust01 || 0), rate: r2(h.weather.precipitation.rate) }; },
  };
})()`;

const SPAWN = 'body=earth&hour=12.3';
export const SUBJECTS = {
  // ---- where things are: four views round the Earth spawn, 90 degrees apart (not a motion strip) ----
  'look-around': { note: 'four views round the spawn (yaw 30, 120, 210, 300), to choose a framing',
    q: SPAWN + '&t=60&pre=2&dist=14&pitch=10&up=1.5&walk=0', w: 640, h: 360, frames: 4, dt: 1 / 30, sub: 1, cols: 2,
    each: `(i, t, ctl, L) => { L.yaw = (30 + 90 * i) * Math.PI / 180; }`, probe: `(L) => P.here()` },
  // ---- grass and the near ground ----
  // (numbers: the wind half a metre up, the lean of three blades a metre apart (deg), and of one of them east / north)
  'grass-breeze': { note: 'Earth spawn, 60 s of game clock: the near ground in the fair-weather wind (2 m/s at 10 m), 15 frames a second',
    q: SPAWN + '&t=60&pre=6&explorer=0&dist=6&pitch=10&up=0.4', w: 640, h: 360, crop: [0.25, 0.42, 0.5, 0.5], frames: 12, dt: 1 / 15, sub: 4,
    probe: `(L) => ({ w05: P.wind(0, 0, 0.5), a: P.bend(0, 0).deg, b: P.bend(0.6, 0.4).deg, c: P.bend(-0.7, 0.9).deg, ae: P.bend(0, 0).e, an: P.bend(0, 0).n })` },
  'grass-gust': { note: 'Earth spawn, 143 to 149 s: the first storm\'s gust front arrives over the meadow, 2 frames a second',
    q: SPAWN + '&t=143&pre=4&explorer=0&dist=6&pitch=10&up=0.4', w: 640, h: 360, crop: [0.25, 0.42, 0.5, 0.5], frames: 12, dt: 0.5, sub: 30,
    probe: `(L) => ({ w05: P.wind(0, 0, 0.5), a: P.bend(0, 0).deg, b: P.bend(0.6, 0.4).deg, c: P.bend(-0.7, 0.9).deg, ae: P.bend(0, 0).e, an: P.bend(0, 0).n })` },
  'grass-storm': { note: 'Earth spawn, 176 s: the meadow in the storm wind (11 m/s at 10 m), 15 frames a second',
    q: SPAWN + '&t=176&pre=4&explorer=0&dist=6&pitch=10&up=0.4', w: 640, h: 360, crop: [0.25, 0.42, 0.5, 0.5], frames: 12, dt: 1 / 15, sub: 4,
    probe: `(L) => ({ w05: P.wind(0, 0, 0.5), a: P.bend(0, 0).deg, b: P.bend(0.6, 0.4).deg, c: P.bend(-0.7, 0.9).deg, ae: P.bend(0, 0).e, an: P.bend(0, 0).n })` },
  'grass-walker': { note: 'Earth spawn, 60 s: a walker (1.5 m/s) crosses the frame through the grass; it parts and closes behind, 4 frames a second',
    q: SPAWN + '&t=60&pre=3&dist=6&pitch=14&up=0.4&circle=0.01', w: 640, h: 360, crop: [0.2, 0.3, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 0.25, sub: 15,
    before: `(L) => { L.run(2.4, 1 / 60, (i, t, ctl) => { ctl.wish = [-1.5, -0.6]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [1.5, 0.6]; }`,
    probe: `(L) => { const x = P.ex(); return { e: x.e, n: x.n, vh: x.vh, at0: P.bend(0, 0).deg, flat0: P.bend(0, 0).flat, side: P.bend(0.4, -1.0).deg, behind: P.bend(x.e - 1.4, x.n - 0.56).deg }; }` },
  // ---- trees ----
  // (numbers: the wind 10 m up, the lean of a trunk (deg) at two places 12 m apart, a branch tip's swing (m: east, north, up))
  'tree-breeze': { note: 'Earth spawn, 100 to 104 s: birches in a breeze (3 m/s at 10 m), 3 frames a second',
    q: SPAWN + '&t=100&pre=6&explorer=0&dist=20&pitch=3&up=5.5&yaw=30', w: 640, h: 360, crop: [0.2, 0.05, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 1 / 3, sub: 20,
    probe: `(L) => { const b = L.physics.fields.flora.plantBend(L.at(-6, 10), 1, {}), br = L.physics.fields.flora.plantBranch(2.5, 0, 9, 12, L.at(-6, 10), b, {}); return { w10: P.wind(-6, 10, 10), trunk: P.bend(-6, 10, 1).deg, trunk2: P.bend(5, 14, 1).deg, tipE: P.r3(br.e), tipN: P.r3(br.n), tipU: P.r3(br.up) }; }` },
  'tree-gust': { note: 'Earth spawn, 143 to 149 s: the gust front of the first storm reaches the birches, 2 frames a second',
    q: SPAWN + '&t=143&pre=4&explorer=0&dist=20&pitch=3&up=5.5&yaw=30', w: 640, h: 360, crop: [0.2, 0.05, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 0.5, sub: 30,
    probe: `(L) => { const b = L.physics.fields.flora.plantBend(L.at(-6, 10), 1, {}), br = L.physics.fields.flora.plantBranch(2.5, 0, 9, 12, L.at(-6, 10), b, {}); return { w10: P.wind(-6, 10, 10), trunk: P.bend(-6, 10, 1).deg, trunk2: P.bend(5, 14, 1).deg, tipE: P.r3(br.e), tipN: P.r3(br.n), tipU: P.r3(br.up) }; }` },
  'tree-storm': { note: 'Earth spawn, 176 s: birches in the storm, 10 frames a second (the crown against the trunk, the return swing)',
    q: SPAWN + '&t=176&pre=4&explorer=0&dist=20&pitch=3&up=5.5&yaw=30', w: 640, h: 360, crop: [0.2, 0.05, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 0.1, sub: 6,
    probe: `(L) => { const b = L.physics.fields.flora.plantBend(L.at(-6, 10), 1, {}), br = L.physics.fields.flora.plantBranch(2.5, 0, 9, 12, L.at(-6, 10), b, {}); return { w10: P.wind(-6, 10, 10), trunk: P.bend(-6, 10, 1).deg, trunk2: P.bend(5, 14, 1).deg, tipE: P.r3(br.e), tipN: P.r3(br.n), tipU: P.r3(br.up) }; }` },
  // ---- the explorer (PILOT's speeds: walk 4.2 m/s, run 7.4 m/s, jump 4.8 m/s) ----
  // (numbers: east and north of the start (m), feet over the ground (m), speed over the ground and upward (m/s), the legs:
  //  hip = leg length less standing (m), clamber01, on the ground 1 / 0)
  'explorer-run': { note: 'Earth spawn: a walk (4.2 m/s) for 0.6 s, a run (7.4 m/s) for 1.2 s, then stop; the camera follows; 7 frames a second',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=7&pitch=6&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [213, 144], cols: 6, frames: 18, dt: 0.15, sub: 9,
    each: `(i, t, ctl) => { ctl.wish = t < 0.6 ? [4.2, 0] : t < 1.8 ? [7.4, 0] : [0, 0]; }`, probe: `(L) => P.ex()` },
  'explorer-jump': { note: 'Earth spawn: a jump from a walk (4.2 m/s) and its landing; the camera follows; 12 frames a second',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=7&pitch=6&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.1, 0.5, 0.7], tile: [213, 168], cols: 6, frames: 18, dt: 1 / 12, sub: 5,
    before: `(L) => { L.run(1, 1 / 60, (i, t, ctl) => { ctl.wish = [4.2, 0]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; if (i === 1) ctl.jump = true; }`, probe: `(L) => P.ex()` },
  'explorer-jump-moon': { note: 'the Moon, at the spawn: the same jump (4.8 m/s off the ground) and its landing; 3 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&follow=1&dist=9&pitch=6&up=1.6&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.05, 0.5, 0.8], tile: [213, 192], cols: 6, frames: 18, dt: 0.4, sub: 24,
    before: `(L) => { L.run(1, 1 / 60, (i, t, ctl) => { ctl.wish = [4.2, 0]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; if (i === 1) ctl.jump = true; }`, probe: `(L) => P.ex()` },
  'explorer-jet': { note: 'Earth spawn: a 2.5 s jetpack burn from standing, the coast, the fall and the landing; the camera follows from 30 m; 2 frames a second',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=30&pitch=4&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.3, 0.2, 0.4, 0.6], tile: [213, 180], cols: 6, frames: 18, dt: 0.5, sub: 30,
    each: `(i, t, ctl) => { ctl.wish = [0, 0]; ctl.jet = t < 2.5 ? 1 : 0; }`, probe: `(L) => P.ex()` },
  // the walker goes east from the spawn until its legs first reach the end of their stroke (clamber01 > 0.6: a boulder,
  // a ledge), is put back 5 m before that place, and the strip is the walk over it
  'explorer-clamber': { note: 'the Moon: a walk (4.2 m/s) over the first boulder east of the spawn that makes the legs clamber; the camera follows; 6 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&follow=1&dist=7&pitch=8&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [213, 144], cols: 6, frames: 18, dt: 1 / 6, sub: 10,
    before: `(L) => { let found = null; for (let i = 0; i < 60 * 240 && !found; i++) { L.ctl.wish = [4.2, 0]; L.run(1 / 60, 1 / 60); if (L.ex.phys && L.ex.phys.clamber01 > 0.6) found = L.enu(L.ex.p); }
      window.__found = found; if (!found) return; const p = L.at(found.e - 5, found.n); L.ex.p.x = p.x; L.ex.p.y = p.y; L.ex.p.z = p.z; L.ex.v.x = L.ex.v.y = L.ex.v.z = 0; L.run(0.2, 1 / 60, (i, t, ctl) => { ctl.wish = [0, 0]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; }`, probe: `(L) => { const x = P.ex(); x.found = window.__found ? P.r2(window.__found.e) : -1; return x; }` },
};

function arg(name, d) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : d; }

async function filmOne(name, S, { root, out, tag, extra, quality }) {
  const q = 'painted=1&freeze=1&quality=' + quality + '&' + S.q + (extra ? '&' + extra : '');
  const t0 = Date.now();
  const { page, problems, close } = await openPage({ pagePath: '/physics-lab.html?' + q, w: S.w || 720, h: S.h || 405, root });
  let res = null;
  try {
    await page.waitForFunction('window.__pcReady === true', null, { timeout: 900000, polling: 500 });
    await page.evaluate(PAGE_HELPERS);
    if (S.before) await page.evaluate(`(${S.before})(window.__lab)`);
    res = await page.evaluate((o) => window.__lab.film(o), { frames: S.frames || 12, dt: S.dt || 1 / 15, sub: S.sub || 2, crop: S.crop, tile: S.tile, cols: S.cols || 4, each: S.each, probe: S.probe, quality: 0.85 });
    res.info = await page.evaluate('window.__lab.info()');
  } catch (e) { problems.push('FILM FAILED: ' + String(e.message).split('\n')[0]); }
  await close();
  const base = path.join(out, 'motion-' + name + (tag ? '-' + tag : ''));
  if (res) {
    fs.writeFileSync(base + '.jpg', Buffer.from(res.sheet.split(',')[1], 'base64'));
    const rec = { subject: name, note: S.note, url: '/physics-lab.html?' + q, frames: res.numbers.length, dt: res.dt, hz: res.hz, sheet: [res.w, res.h], info: res.info, numbers: res.numbers };
    fs.writeFileSync(base + '.json', JSON.stringify(rec) + '\n');
    // the table: one line a frame
    const keys = S.cols2 || Object.keys(res.numbers[0] || {});
    const flat = (v) => (v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => k + ':' + x).join(' ') : String(v));
    console.log(`# ${name}: ${res.numbers.length} frames, ${res.dt.toFixed(4)} s apart, simulated at ${res.hz} Hz, sheet ${res.w}x${res.h}, ${((Date.now() - t0) / 1000).toFixed(0)} s to make`);
    console.log('#  i  ' + keys.join('  '));
    res.numbers.forEach((r, i) => console.log(String(i).padStart(4) + '  ' + keys.map((k) => flat(r[k])).join('  ')));
    console.log('wrote ' + base + '.jpg and .json');
  }
  if (problems.length) { console.log('PROBLEMS (' + problems.length + '):'); for (const p of [...new Set(problems)].slice(0, 12)) console.log('  ' + p); }
  return !!res && !problems.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2];
  if (!which || which === 'list') { for (const k in SUBJECTS) console.log(k.padEnd(18) + (SUBJECTS[k].note || '')); process.exit(0); }
  const names = which === 'all' ? Object.keys(SUBJECTS) : which.split(',');
  const o = { root: arg('root', undefined), out: path.resolve(arg('out', path.join(REPO, 'docs/shots/physics'))), tag: arg('tag', ''), extra: arg('q', ''), quality: arg('quality', '1') };
  fs.mkdirSync(o.out, { recursive: true });
  let ok = true;
  for (const n of names) { if (!SUBJECTS[n]) { console.log('no such subject: ' + n); ok = false; continue; } ok = (await filmOne(n, SUBJECTS[n], o)) && ok; }
  process.exit(ok ? 0 : 1);
}
