// Painted Cosmos: runoff -- the water that comes and goes with the rain (?runoff=1 with ?rivers=tree). OWNER: PAINTER (the
// water group's lead). Run: node --test src/world/runoff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
waterFromSearch('?rivers=tree&runoff=1');
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers } = await import('./rivers.js');
const { WATERSTATE, RUNOFF, stepRunoff, RUNOFF_PART } = await import('./waterstate.js');
const { WATER_PARTS } = await import('./waterhooks.js');

test('the switch: ?runoff=1 is a part that changes the world, and it registers its frame', () => {
  assert.equal(MODE.water.runoff, 1); assert.equal(MODE.water.on, true);
  assert.ok(WATER_PARTS.includes(RUNOFF_PART));
});

test('the hydrograph, on the world\'s clock: a storm fills the runnels within minutes and drains them within about twenty minutes of its end; the streams peak after it and fall back over tens of minutes; a long soaking raises them as much', async () => {
  const { WEATHER } = await import('../physics/weather.js');
  assert.equal(RUNOFF.clock, WEATHER.timeScale, 'the hydrograph keeps the weather\'s clock (an hour of weather is a game minute)');
  // a rain history (mm/h by world second) through the three windows the rain field is asked over, stepped every 5 world s
  const run = (rate) => {
    const mmB = (a, b) => { let s = 0; for (let t = Math.max(0, a); t < b; t += 5) s += rate(t) * 5 / 3600; return s; };
    const st = { wet: 0, rise: 0, mud: 0, rain: 0, from: '', t: 0 }, at = {};
    let peak = 0, peakT = 0, mudMax = 0;
    for (let t = 0; t <= 6 * 3600; t += 5) {
      if (t % 60 === 0) at[t / 60] = { wet: st.wet, rise: st.rise };
      if (st.rise > peak) { peak = st.rise; peakT = t / 60; }
      mudMax = Math.max(mudMax, st.mud);
      stepRunoff(st, 5, { mm10: mmB(t - RUNOFF.win[0], t), mm30: mmB(t - RUNOFF.win[1], t), mm180: mmB(t - RUNOFF.win[2], t), rain: rate(t) }, 0);
    }
    assert.equal(st.from, 'rain');
    return { at, peak, peakT, mudMax };
  };
  // a storm: 30 mm/h for 20 minutes, then dry
  const s = run((t) => (t < 1200 ? 30 : 0));
  assert.ok(s.at[3].wet > 0.5 && s.at[10].wet > 0.95, 'the runnels run within minutes (' + s.at[3].wet.toFixed(2) + ' at 3 min)');
  assert.ok(s.at[40].wet < 0.15, 'and are drained twenty minutes after the storm (' + s.at[40].wet.toFixed(2) + ')');
  assert.ok(s.peakT > 22 && s.peakT < 45 && s.peak > 0.2 && s.peak < RUNOFF.riseMax, 'the streams peak after the storm (' + s.peak.toFixed(3) + ' m at ' + s.peakT.toFixed(0) + ' min)');
  assert.ok(s.at[50].rise > s.peak * 0.6, 'they are still high half an hour after it (' + s.at[50].rise.toFixed(3) + ' m)');
  assert.ok(s.at[80].rise < s.peak * 0.5, 'and down to half within the hour after it (' + s.at[80].rise.toFixed(3) + ' m)');
  assert.ok(s.at[180].rise > 0.03, 'a little slow flow for some hours (' + s.at[180].rise.toFixed(3) + ' m at 3 h)');
  assert.ok(s.at[260].rise < 0.02, 'and quiet again some four hours on (' + s.at[260].rise.toFixed(3) + ' m)');
  assert.ok(s.mudMax > 0.3 && s.mudMax <= RUNOFF.mudK, 'brown at the rise (' + s.mudMax.toFixed(2) + ')');
  // a long soaking: 20 mm over three hours raises them as much as before the clock was mended (0.25 m)
  const k = run((t) => (t < 10800 ? 20 / 3 : 0));
  assert.ok(k.at[180].rise > 0.2 && k.at[180].rise < 0.3, 'a long soaking: ' + k.at[180].rise.toFixed(3) + ' m');
  assert.ok(k.at[90].wet > 0.5, 'the runnels run in a steady rain of 6.7 mm/h (' + k.at[90].wet.toFixed(2) + ')');
  // and with no rain field, the ground's wetness stands in
  const st2 = { wet: 0, rise: 0, mud: 0, rain: 0, from: '', t: 0 };
  for (let i = 0; i < 1200; i++) stepRunoff(st2, 1, null, 0.95);
  assert.equal(st2.from, 'wetness'); assert.ok(st2.wet > 0.8 && st2.rise > 0.2);
  for (let i = 0; i < 1200; i++) stepRunoff(st2, 1, null, 0.0);
  assert.ok(st2.wet < 0.2);
});

test('the frame part reads the rain field when the physics has one, and the ground\'s wetness when not', () => {
  const calls = [];
  // (12 mm/h on the weather's clock: a game second lays 12 x 60 / 3600 mm, physics/cloudfield.js rainBetween)
  const physics = { fields: { rain: { t: 5000, now: 12, rainBetween: (b, x, y, z, t0, t1) => { calls.push(Math.round(t1 - t0)); return { mm: (t1 - t0) * 60 / 3600 * 12 }; } } } };
  WATERSTATE.wet = 0; WATERSTATE.rise = 0;
  for (let i = 0; i < 200; i++) RUNOFF_PART.update({ dt: 0.25, physics, camL: { x: 0.2, y: 0.6, z: 0.76 }, bodyId: 'earth', st: null });
  // (the world's last ten minutes, half hour and three hours: ten, thirty and 180 game seconds)
  assert.ok(calls.includes(10) && calls.includes(30) && calls.includes(180), 'asked the world\'s windows in game seconds: ' + [...new Set(calls)]);
  assert.equal(WATERSTATE.from, 'rain'); assert.ok(WATERSTATE.wet > 0.8, 'wet after 50 game s of steady rain: ' + WATERSTATE.wet.toFixed(2));
  assert.equal(WATERSTATE.rain, 12, 'the rate at the eye (fields.rain.now)');
  assert.ok(calls.length < 200 * 2, 'not asked every frame (' + calls.length + ' asks in 200 frames)');
});

test('the data: runnels carry o.cap (water only when wet), rivers carry o.swell, and the landing stays dry', () => {
  const S = getSurface('earth'), sp = S.getSpawn(), D = ensureDrainage('earth'), net = attachRivers(S, D);
  assert.ok(net);
  const o = makeSample(S.nB), R = S.R;
  let capWet = 0, capAll = 0, swellRiver = 0, n = 0;
  let seed = 21; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let ex = sp.z, ez = -sp.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
  const nx = sp.y * ez, ny = sp.z * ex - sp.x * ez, nz = -sp.y * ex;
  for (let i = 0; i < 30000; i++) {
    const e = (rnd() * 2 - 1) * 1200, nn = (rnd() * 2 - 1) * 1200;
    let x = sp.x + (ex * e + nx * nn) / R, y = sp.y + (ny * nn) / R, z = sp.z + (ez * e + nz * nn) / R; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    S.sample(x, y, z, o, false); n++;
    const wet = o.lq !== NOLQ && o.lq > o.h;
    if (o.cap > 0) { capAll++; if (wet) capWet++; }
    if (wet && o.swell > 0.3) swellRiver++;
    assert.ok(o.cap >= 0 && o.cap <= 1 && o.swell >= 0 && o.swell <= 1);
  }
  assert.ok(capWet > 50, 'runnels hold water at full wet: ' + capWet + ' of ' + n);
  assert.ok(swellRiver > 50, 'rivers that rise: ' + swellRiver);
  S.sample(sp.x, sp.y, sp.z, o, true);
  assert.ok(!(o.lq !== NOLQ && o.lq > o.h - 0.3), 'the landing stays dry');
});

test('a runnel is narrow: 1 to 2 m of water in a storm (F, 24 Nov), wider only where a basin or a small stream fills', () => {
  const S = getSurface('earth'), sp = S.getSpawn(), o = makeSample(S.nB), R = S.R;
  if (!S.rivers) attachRivers(S, ensureDrainage('earth'));
  let ex = sp.z, ez = -sp.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
  const nx = sp.y * ez, ny = sp.z * ex - sp.x * ez, nz = -sp.y * ex;
  const at = (e, n) => { let x = sp.x + (ex * e + nx * n) / R, y = sp.y + (ny * n) / R, z = sp.z + (ez * e + nz * n) / R; const l = Math.hypot(x, y, z); S.sample(x / l, y / l, z / l, o, false); return o; };
  const rain = (q) => q.lq !== NOLQ && q.lq > q.h && q.cap >= 0.3;
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const widths = []; let capOnly = 0, capN = 0, capBad = 0;
  for (let i = 0; i < 400000 && widths.length < 120; i++) {
    const e = (rnd() * 2 - 1) * 1500, n = (rnd() * 2 - 1) * 1500, s0 = at(e, n);
    if (!(s0.cap >= 0.59 && s0.lq > s0.h + 0.05 && s0.swell < 0.15)) continue;   // (a runnel: swell 0.1; a basin 0.6, a stream more)
    // (the recipe is told where ALL the water is rain-only -- surface.js c.capOnly, for C's dry bed; where a runnel crosses a
    //  hollow deeper than its cap, a pool stays in the dry and the flag is 0 there)
    if (S.biomes[o.top].terrain === 'forest' && o.w[o.top] > 0.999) { capN++; if ((S._ctx.capOnly === 1) !== (s0.cap >= s0.lq - s0.h)) capBad++; else if (S._ctx.capOnly === 1) capOnly++; }
    let best = 1e9;
    for (let a = 0; a < 8; a++) {
      const an = a * Math.PI / 8, de = Math.sin(an), dn = Math.cos(an);
      let w = 0;
      for (const sg of [1, -1]) for (let t = 0.1; t <= 8; t += 0.1) if (!rain(at(e + de * t * sg, n + dn * t * sg)) || t > 7.95) { w += t; break; }
      best = Math.min(best, w);
    }
    widths.push(best);
  }
  widths.sort((a, b) => a - b);
  const p = (q) => widths[Math.floor(q * (widths.length - 1))];
  assert.ok(widths.length >= 100, 'runnels found: ' + widths.length);
  assert.ok(p(0.5) >= 1.0 && p(0.5) <= 2.2, 'the median runnel is 1 to 2 m wide: ' + p(0.5).toFixed(2));
  assert.ok(p(0.9) <= 3.0, 'nine in ten under 3 m: ' + p(0.9).toFixed(2));
  assert.equal(capBad, 0, 'c.capOnly exactly where the cap holds all the water (' + capOnly + ' of ' + capN + ' runnel points)');
  assert.ok(capOnly > capN * 0.6, 'most runnel water is all rain-only: ' + capOnly + ' of ' + capN);
  at(0, 0); assert.equal(S._ctx.capOnly, 0, 'and not at the landing');
});
