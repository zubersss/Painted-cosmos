// A run across a boulder field, in the game itself (review 6's measure: on Earth, Mars and
// the Moon a run never lifts the feet more than 0.3 m off the ground without a jump).
// The page is the integrated game; the keys are real (Shift+W held, the camera turned with the
// mouse); the clock is driven by the test at a fixed step (window.__pc.hold / step), so the
// result is that of a machine drawing --hz frames a second, not of this one.
//
// The run starts at the place with the most low boulders within reach of the biome's stand
// (searched on a grid round it with the world's own sampleObstacles), and is made in several
// headings. After every frame: the feet's height over the ground (sim.ex.altitude) and the
// pace; for every stretch off the ground, how high the feet were over the ground, how far the
// body rose above where the feet left it (thrown up, or did the ground fall away under the
// run?), the slope and the nearest boulder at that moment. Space is never pressed.
//
// Usage: node tests/boulderrun.mjs [--root dir] [--body moon] [--biome crater_fields]
//          [--headings 4] [--seconds 12] [--hz 30] [--limit 0.3]
//          [--w 400 --h 225] [--query "scale=0.5&quality=0"] [--out dir] [--keep]
// Writes <out>/boulderrun-<body>.json and one frame per heading (with --keep the first goes
// to docs/shots/pilot/boulderrun-<body>.jpg). Mechanics, not the picture: a low tier is fine.
import fs from 'node:fs';
import path from 'node:path';
import { MOUSE_FOOT, parseArgs, startRun, finish } from './browser.mjs';
import { BODIES } from '../src/data/bodies.js';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/boulderrun', w: 400, h: 225, query: 'scale=0.5&quality=0', body: 'moon', biome: 'crater_fields', headings: 4, seconds: 12, hz: 30, limit: 0.3 });
opt.query += '&dynres=0&pointerlock=0&fresh=1&card=0&save=0&audio=0';
const DT = 1 / Number(opt.hz), HEADINGS = Number(opt.headings), FRAMES = Math.round(Number(opt.seconds) * Number(opt.hz));
const run = await startRun(opt);
const { page, check, shot, look, log } = run;
const summary = { body: opt.body, biome: opt.biome, stepHz: Number(opt.hz), headings: [], timings: {} };
const t0 = Date.now();
try {
  // The densest boulder place within 320 m of the stand.
  const site = await page.evaluate(async ([body, biome, R]) => {
    const pc = window.__pc, w = pc.world;
    pc.hold(true);
    const at = w.findBiome(body, biome);
    if (!at) return null;
    const d = at.unitDir || at;
    const n = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const ref = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const e = n({ x: ref.y * d.z - ref.z * d.y, y: ref.z * d.x - ref.x * d.z, z: ref.x * d.y - ref.y * d.x });
    const nn = { x: d.y * e.z - d.z * e.y, y: d.z * e.x - d.x * e.z, z: d.x * e.y - d.y * e.x };
    let best = null;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const a = (i * 40) / R, b = (j * 40) / R;
      const q = n({ x: d.x + e.x * a + nn.x * b, y: d.y + e.y * a + nn.y * b, z: d.z + e.z * a + nn.z * b });
      let list = [];
      try { list = pc.sim.sampleObstacles(body, q, 28) || []; } catch { list = []; }
      const low = list.filter((o) => o.kind === 'rock' && o.height <= 1.35);
      if (!best || low.length > best.count) best = { dir: [q.x, q.y, q.z], count: low.length, tallest: Math.max(0, ...low.map((o) => o.height)), others: list.length - low.length, east: i * 40, north: j * 40 };
    }
    return best;
  }, [opt.body, opt.biome, BODIES[opt.body].radius]);
  if (!check(!!site && site.count > 0, `a boulder field near the stand of ${opt.body} ${opt.biome}` + (site ? `: ${site.count} low boulders within 28 m (tallest ${site.tallest.toFixed(2)} m), ${site.others} other obstacles, ${site.east} m east and ${site.north} m north of the stand` : ''))) throw new Error('no boulders');
  summary.site = site;

  for (let k = 0; k < HEADINGS; k++) {
    await page.evaluate(([body, dir]) => { const pc = window.__pc; pc.hold(false); pc.setTimeScale(0); pc.teleport({ body, dir, firstPerson: false }); }, [opt.body, site.dir]);
    if (k === 0) await page.evaluate(() => Promise.race([window.__pc.settle(6), new Promise((r) => setTimeout(r, 240000))]));
    await page.evaluate(([dt]) => { const pc = window.__pc; pc.hold(true); pc.setTimeScale(1); pc.step(dt, 45); }, [DT]);
    if (k) { await look(Math.round((k * 2 * Math.PI / HEADINGS) / MOUSE_FOOT), 0); await page.evaluate(([dt]) => window.__pc.step(dt, 6), [DT]); }
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    const acc = { vmax: 0, dist: 0, airFrames: 0, frames: 0, stalled: 0, biomes: {} };
    await page.evaluate(() => { window.__br = { cur: null, list: [], last: null }; });
    for (let done = 0; done < FRAMES;) {
      const nStep = Math.min(30, FRAMES - done);
      const r = await page.evaluate(([dt, nn, skip, body]) => {
        const pc = window.__pc, sim = pc.sim, B = window.__br, o = { vmax: 0, dist: 0, airFrames: 0, stalled: 0, biome: null, state: null };
        let p = { ...sim.ex.p };
        for (let i = 0; i < nn; i++) {
          pc.step(dt, 1);
          const ex = sim.ex, q = ex.p, r = Math.hypot(q.x, q.y, q.z), alt = ex.altitude || 0;
          o.dist += Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z); p = { ...q };
          o.vmax = Math.max(o.vmax, ex.speed || 0);
          if ((ex.speed || 0) < 0.3) o.stalled++;
          if (i < skip) continue;
          if (ex.grounded) {
            if (B.cur) { B.cur.seconds = +(sim.t - B.cur.t0).toFixed(2); B.cur.groundAtLanding = +((r - alt) - B.cur.ground0).toFixed(2); delete B.cur.r0; delete B.cur.ground0; B.list.push(B.cur); B.cur = null; }
            B.last = { r, ground: r - alt, speed: ex.speed || 0, slope: ex.slope || 0 };
          } else {
            o.airFrames++;
            if (!B.cur) {
              const L = B.last || { r, ground: r - alt, speed: ex.speed || 0, slope: 0 };
              let near = null;
              try {
                for (const ob of pc.sim.sampleObstacles(body, { x: q.x / r, y: q.y / r, z: q.z / r }, 6) || []) {
                  if (ob.kind !== 'rock') continue;
                  const d = Math.hypot(ob.unitDir.x * r - q.x, ob.unitDir.y * r - q.y, ob.unitDir.z * r - q.z) - (ob.radius || 0);
                  if (!near || d < near.gap) near = { gap: +d.toFixed(2), height: +ob.height.toFixed(2) };
                }
              } catch { /* no obstacles */ }
              B.cur = { t0: +sim.t.toFixed(2), r0: L.r, ground0: L.ground, speed: +L.speed.toFixed(1), slopeDeg: Math.round(L.slope * 57.3), boulder: near, feetUp: 0, rise: -9, groundLowest: 0 };
            }
            B.cur.feetUp = +Math.max(B.cur.feetUp, alt).toFixed(3);
            B.cur.rise = +Math.max(B.cur.rise, r - B.cur.r0).toFixed(3);
            B.cur.groundLowest = +Math.min(B.cur.groundLowest, (r - alt) - B.cur.ground0).toFixed(2);
          }
        }
        const bw = Object.entries((sim.mood && sim.mood.biomeWeights) || {}).sort((x, y) => y[1] - x[1])[0];
        o.biome = bw ? bw[0] : null; o.state = sim.sm.state;
        return o;
      }, [DT, nStep, done === 0 ? Math.round(0.5 / DT) : 0, opt.body]);
      acc.vmax = Math.max(acc.vmax, r.vmax);
      acc.dist += r.dist; acc.airFrames += r.airFrames; acc.stalled += r.stalled; acc.frames += nStep; if (r.biome) acc.biomes[r.biome] = 1;
      done += nStep;
      if (done === Math.min(FRAMES, 150)) await shot(`boulderrun-${opt.body}-${k}`, k === 0 ? `boulderrun-${opt.body}` : null);
      if (r.state !== 'ON_FOOT') break;
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    const air = (await page.evaluate(() => { const B = window.__br; return B.cur ? B.list.concat([{ ...B.cur, seconds: null, unfinished: true }]) : B.list; })).filter((a) => a.feetUp > 0.05);
    const secs = acc.frames * DT;
    const row = { heading: Math.round((k * 360) / HEADINGS), metres: +acc.dist.toFixed(1), pace: +(acc.dist / secs).toFixed(2), topSpeed: +acc.vmax.toFixed(2), feetUp: Math.max(0, ...air.map((a) => a.feetUp)), thrownUp: Math.max(0, ...air.map((a) => a.rise)), framesOffGround: acc.airFrames, framesStalled: acc.stalled, biomes: Object.keys(acc.biomes), offTheGround: air };
    summary.headings.push(row);
    log(`heading ${row.heading}: ${row.metres} m in ${secs.toFixed(0)} s (${row.pace} m/s, top ${row.topSpeed}), feet ${row.feetUp} m over the ground at most, thrown up ${row.thrownUp} m at most, ${row.framesOffGround} frames off the ground, ${row.framesStalled} stalled`);
    for (const a of air) log(`    off the ground at ${a.t0} s for ${a.seconds} s: feet ${a.feetUp} m over the ground, ${a.rise} m above where they left it; the ground fell ${-a.groundLowest} m away; left at ${a.speed} m/s on a ${a.slopeDeg} degree slope, ${a.boulder ? 'a boulder ' + a.boulder.height + ' m tall ' + a.boulder.gap + ' m from the feet' : 'no boulder within 6 m'}`);
  }
  // Two different things lift the feet: being thrown up (the body rises above where the feet
  // left the ground: a launch, the fault the measure is after) and the ground falling away
  // under a run (a crater rim, the far side of a boulder: the body does not rise).
  const all = summary.headings.flatMap((h) => h.offTheGround.map((a) => ({ ...a, heading: h.heading })));
  summary.worstLift = Math.max(0, ...summary.headings.map((h) => h.feetUp));
  summary.worstThrow = Math.max(0, ...summary.headings.map((h) => h.thrownUp));
  summary.pace = +(summary.headings.reduce((s, h) => s + h.pace, 0) / summary.headings.length).toFixed(2);
  const lim = Number(opt.limit);
  const byBoulder = all.filter((a) => a.feetUp > lim && a.boulder && a.boulder.gap < 1.5);
  const offEdge = all.filter((a) => a.feetUp > lim && a.rise <= lim && !(a.boulder && a.boulder.gap < 1.5));
  check(summary.worstThrow <= lim, `a run never throws the body more than ${lim} m above where the feet left the ground (largest ${summary.worstThrow} m)`);
  check(byBoulder.length === 0, `no boulder lifts the feet more than ${lim} m off the ground` + (byBoulder.length ? ': ' + byBoulder.map((a) => `heading ${a.heading} at ${a.t0} s, ${a.feetUp} m, boulder ${a.boulder.height} m tall`).join('; ') : ''));
  summary.offAnEdge = offEdge.map((a) => ({ heading: a.heading, t0: a.t0, seconds: a.seconds, feetUp: a.feetUp, groundFell: -a.groundLowest, speed: a.speed, slopeDeg: a.slopeDeg }));
  log(`the measure as written (feet never more than ${lim} m over the ground without a jump): largest ${summary.worstLift} m` + (offEdge.length ? `; ${offEdge.length} time(s) the ground fell away under the run (not thrown up): ` + offEdge.map((a) => `heading ${a.heading}: ${a.feetUp} m over ground that fell ${-a.groundLowest} m, ${a.seconds} s in the air`).join('; ') : ''));
  check(summary.headings.every((h) => h.metres > 0.25 * Number(opt.seconds)), 'no heading is stopped dead: ' + summary.headings.map((h) => h.metres + ' m').join(', '));
} catch (e) { run.fails.push('exception: ' + (e && e.message ? e.message : e)); log(e && e.stack ? e.stack : e); }
summary.timings.wallSeconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(opt.out, `boulderrun-${opt.body}.json`), JSON.stringify(summary, null, 1));
await finish(run, opt, summary);
