// Storms born from the land (weather.js STORMLAND, ?stormland=1; group D, the STORMS AND RAIN lane;
// docs/lead/WEATHER-DESIGN.md 6.4). On PAINTER's real Earth in the oil look, with the game's own sun (core/orbits.js).
// Each statistic below is about behaviour the code before this step did not have: Earth's storms were placed at random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WindMap } from './windmap.js';
import * as W from './weather.js';
import { CloudField, rainBetween, RAINLAND } from './cloudfield.js';
import { WX2 } from './wx2.js';

let E = null;
async function earth() {
  if (E) return E;
  let surf, eph, BODIES;
  try {
    const mode = await import('../data/mode.js'); mode.MODE.oil = true;
    const looks = await import('../data/looks.js'); mode.overlayOil(looks.LOOKS);
    surf = await import('../world/surface.js');
    ({ BODIES } = await import('../data/bodies.js'));
    const { Ephemeris } = await import('../core/orbits.js');
    eph = new Ephemeris(BODIES);
  } catch (e) { console.log('# (skipped: the real surface or the ephemeris did not load: ' + e.message + ')'); return null; }
  const sp = surf.getSurface('earth').getSpawn(), spawn = { x: sp.x, y: sp.y, z: sp.z };
  eph.setSunHour('earth', 0, spawn, 8);            // a new game: 8 in the morning at the spawn
  const wm = new WindMap(18);
  wm.readLand('earth', (d) => surf.sampleSurfacePure('earth', d.x, d.y, d.z), null, 0, 1e9);
  const sunAt = (t) => eph.sunDirLocal('earth', t);
  E = { surf, wm, spawn, sunAt };
  return E;
}
// (a storm's top stands about 2.4 km over the datum: 220 m base and 1,800 m of tower over a range at 300 to 500 m; on a
//  world of 4 km radius it sinks under the horizon of an eye 2 m up past acos(R / (R + 2)) + acos(R / (R + 2400)) of arc)
const SIGHT = 3700;
const R = 4000, dist = (a, b) => R * Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));
function on(E) {
  WX2.stormland = true;
  W.setLandStorms('earth', E.wm.sites, E.sunAt(0), 0);
  E.wm.refresh('earth', 1900, E.sunAt(1900));
  RAINLAND.map = E.wm;
}
function off() { WX2.stormland = false; W.setLandStorms(null); RAINLAND.map = null; }

test('land storms: a storm over the mountains on about two days in three, maturing in the afternoon', async () => {
  const E0 = await earth(); if (!E0) return;
  try {
    on(E0);
    const L = W.landStorms(), days = 50, T0 = W.STORMLAND.from;
    const stormDay = new Set(), seen = new Set(), born = new Map(), hours = [];
    for (let t = T0; t < T0 + days * L.solarDay; t += 15) {
      for (const c of W.cellsAt('earth', t)) {
        if (!c.land || c.kindId !== 'storm' || c.w < 0.3) continue;
        stormDay.add(c.gen);
        if (dist(c, E0.spawn) < SIGHT) seen.add(c.gen);
        const key = c.i + ':' + c.gen;
        if (!born.has(key)) {
          born.set(key, c);
          const s = E0.sunAt(t); let h = Math.atan2(c.x, c.z) - Math.atan2(s.x, s.z); h -= 2 * Math.PI * Math.round(h / (2 * Math.PI));
          hours.push(12 + h * 12 / Math.PI);
        }
      }
    }
    const share = stormDay.size / days;
    assert.ok(share > 0.5 && share < 0.85, `a mature storm on ${stormDay.size} of ${days} days`);
    const afternoon = hours.filter((h) => h >= 14 && h <= 19).length / hours.length;
    assert.ok(afternoon >= 0.7, `${(afternoon * 100).toFixed(0)} % first mature between 14:00 and 19:00 local solar time`);
    // where they are born: the wind map's sites, each on high ground or in a hot dry basin
    const sites = E0.wm.sites, onHigh = sites.filter((s) => s.kind === 'basin' || E0.wm.land.relief[s.k] > 40).length;
    assert.ok(onHigh / sites.length >= 0.9, `${onHigh} of ${sites.length} sites stand on ground 40 m and more over its surroundings or in a hot basin`);
    const alpine = sites.filter((s) => E0.surf.sampleSurfacePure('earth', s.x, s.y, s.z).biomeId === 'alpine_meadow').length;
    assert.ok(alpine / sites.length >= 0.6, `${alpine} of ${sites.length} on the alpine range`);
    // and seen from the wood where the game begins (a storm's top, 2.4 km up, is over the horizon past 3.7 km of ground)
    assert.ok(seen.size / days >= 0.2, `a storm within sight of the spawn's wood on ${seen.size} of ${days} days`);
  } finally { off(); }
});

test('land storms come to the player now and then, by the wind aloft swinging from day to day (the coordinator, 24 Nov)', async () => {
  const E0 = await earth(); if (!E0) return;
  const days = 100, measure = () => {
    const L = W.landStorms(), T0 = W.STORMLAND.from, stormy = new Set(), wood = new Set(), seen = new Set();
    for (let t = T0; t < T0 + days * L.solarDay; t += 30) for (const c of W.cellsAt('earth', t)) {
      if (!c.land || c.kindId !== 'storm' || c.w < 0.3) continue;
      stormy.add(c.gen); const d = dist(c, E0.spawn);
      if (d < 1500) wood.add(c.gen);
      if (d < SIGHT) seen.add(c.gen);
    }
    return { stormy: stormy.size / days, wood: wood.size / days, seen: seen.size / days };
  };
  try {
    on(E0);
    const a = measure();
    // the owner's asks: a storm over the spawn's wood on about 1 day in 4, one within sight on about every other day
    assert.ok(a.wood >= 0.15 && a.wood <= 0.4, `a storm over the spawn's wood (within 1.5 km) on ${(a.wood * 100).toFixed(0)} % of days`);
    assert.ok(a.seen >= 0.4, `a storm within sight of it on ${(a.seen * 100).toFixed(0)} % of days`);
    assert.ok(a.stormy > 0.5 && a.stormy < 0.85, `storms over the land on ${(a.stormy * 100).toFixed(0)} % of days`);
    // the owner's dial (the look's storms): fewer at 0.5, none at 0
    W.setStormDial(0.5); const h = measure(); W.setStormDial(0); const z = measure(); W.setStormDial(1);
    assert.ok(h.wood < a.wood && h.seen < a.seen, `dial 0.5: over the wood ${(h.wood * 100).toFixed(0)} %, in sight ${(h.seen * 100).toFixed(0)} %`);
    assert.equal(z.stormy, 0);
    // and with ?stormswing=0 they are W3.2's: none over the wood
    WX2.stormswing = false; W.setLandStorms(null); W.setLandStorms('earth', E0.wm.sites, E0.sunAt(0), 0);
    const b = measure();
    assert.ok(b.wood < 0.05, `without the swing: over the wood on ${(b.wood * 100).toFixed(0)} % of days`);
  } finally { WX2.stormswing = true; W.setStormDial(1); off(); }
});

test('land storms: the upper alpine meadow gets its weather (it got none above 496 m), as rain and snow', async () => {
  const E0 = await earth(); if (!E0) return;
  const { wm, surf } = E0;
  const upper = [], valley = [];
  for (let k = 0; k < wm.count; k++) {
    if (wm.land.water[k] > 0.1) continue;
    if (surf.sampleSurfacePure('earth', wm.cx[k], wm.cy[k], wm.cz[k]).biomeId !== 'alpine_meadow') continue;
    const d = { x: wm.cx[k], y: wm.cy[k], z: wm.cz[k], h: wm.land.h[k] };
    if (d.h > 500) upper.push(d); else if (d.h < 200) valley.push(d);
  }
  const pick = (a, n) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / n)) === 0).slice(0, n);
  const up = pick(upper, 24), va = pick(valley, 24);
  const total = (pts, T0, T1) => { let s = 0; for (const d of pts) { const r = rainBetween('earth', d.x, d.y, d.z, T0, T1, 18, { altitude: d.h }, {}, 20); s += r.mm + r.mmSnow; } return s / pts.length; };
  try {
    off();
    const T0 = W.STORMLAND.from, T1 = T0 + 10 * 1674;
    const u0 = total(up, T0, T1), v0 = total(va, T0, T1);
    assert.equal(u0, 0, 'without it, nothing falls above the old ceiling');
    on(E0);
    const u1 = total(up, T0, T1), v1 = total(va, T0, T1);
    assert.ok(u1 > 1 && u1 >= 0.8 * v1, `over ten days the upper meadow ${u1.toFixed(1)} mm of water, its valleys ${v1.toFixed(1)} mm`);
  } finally { off(); }
});

test('land storms: the windward side of a raining range gets more than its lee; the map is continuous in time', async () => {
  const E0 = await earth(); if (!E0) return;
  try {
    on(E0);
    const cf = new CloudField(18);
    // a time when a land storm is mature over the range
    let t = W.STORMLAND.from;
    for (; t < W.STORMLAND.from + 30 * 1674; t += 20) if (W.cellsAt('earth', t).some((c) => c.land && c.kindId === 'storm' && c.w > 0.6)) break;
    E0.wm.refresh('earth', t, E0.sunAt(t));
    cf.refresh('earth', t, E0.sunAt(t), E0.wm);
    let ww = 0, nw = 0, lw = 0, nl = 0;
    for (let k = 0; k < cf.count; k++) {
      if (!(cf.rain[k] + cf.snow[k] > 0.5)) continue;
      if (E0.wm.lift[k] > 0.3) { ww += cf.rain[k] + cf.snow[k]; nw++; } else if (E0.wm.lift[k] < -0.3) { lw += cf.rain[k] + cf.snow[k]; nl++; }
    }
    assert.ok(nw > 3 && nl > 3 && ww / nw >= 1.3 * (lw / nl), `windward ${(ww / nw).toFixed(1)} mm/h over ${nw} texels, lee ${(lw / nl).toFixed(1)} over ${nl}`);
    // continuity: two refreshes half a second apart
    const sum = () => { let s = 0; for (let k = 0; k < cf.count; k++) s += cf.rain[k] + cf.snow[k]; return s; };
    const a = sum(); cf.refresh('earth', t + 0.5, E0.sunAt(t + 0.5), E0.wm); const b = sum();
    assert.ok(Math.abs(a - b) <= 0.05 * Math.max(a, 1), `the planet's rain ${a.toFixed(1)} then ${b.toFixed(1)} half a second later`);
    // the lightning of every storm near a place: each mature storm cell within reach is listed, with a ground point
    const c = W.cellsAt('earth', t).find((q) => q.land && q.kindId === 'storm' && q.w > 0.6);
    const f = { x: c.x * 4001.7, y: c.y * 4001.7, z: c.z * 4001.7 };
    let listed = 0, flashes = new Set();
    for (let q = 0; q < 120; q++) {
      const tt = t + q * 0.5;
      cf.step(0.5, 'earth', tt, E0.sunAt(tt), E0.wm);
      const L = cf.flashesFor('earth', tt, f.x, f.y, f.z);
      for (let i = 0; i < L.n; i++) { listed++; flashes.add(L[i].cell + ':' + L[i].t.toFixed(2)); assert.ok(L[i].distance < 6000 && Number.isFinite(L[i].base)); }
    }
    // a mature storm flashes about K.flash x w a minute (5 a minute at full strength): in 60 s, some
    assert.ok(listed > 0 && flashes.size >= 2, `${flashes.size} distinct flashes listed in a minute under a mature storm`);
  } finally { off(); }
});

test('land storms: none before STORMLAND.from, so the first day at the spawn stays as tuned', async () => {
  const E0 = await earth(); if (!E0) return;
  try {
    on(E0);
    for (let t = 0; t < W.STORMLAND.from; t += 30) assert.ok(!W.cellsAt('earth', t).some((c) => c.land), `no land storm at ${t} s`);
    // and the body's own systems before then are exactly what they were
    const a = W.cellsAt('earth', 1200).map((c) => c.kindId + c.x.toFixed(6)).join();
    off();
    const b = W.cellsAt('earth', 1200).map((c) => c.kindId + c.x.toFixed(6)).join();
    assert.equal(a, b);
  } finally { off(); }
});

test('land storms: the weather lives under its own top, not under half the atmosphere above the datum', () => {
  // a place 700 m above the datum under a downpour: the old law gave it nothing; with a cloud top over it, it rains
  const u = { x: 0.6, y: 0.48, z: 0.64 }, l = Math.hypot(u.x, u.y, u.z); u.x /= l; u.y /= l; u.z /= l;
  W.setForcedCell({ kind: 'storm', x: u.x, y: u.y, z: u.z, r: 900, w: 1 });
  try {
    const old = W.weatherAt('earth', u.x, u.y, u.z, 700, 3000, 18, { moist: 1 }, {});
    const now = W.weatherAt('earth', u.x, u.y, u.z, 700, 3000, 18, { moist: 1, cloudTop: 2600 }, {});
    assert.equal(old.precipitation.rate, 0);
    assert.ok(now.precipitation.rate > 10, `${now.precipitation.rate.toFixed(1)} mm/h at 700 m under its own top`);
  } finally { W.setForcedCell(null); }
});

test('land storms: under storms, every flash of a storm over the place lights it (the same flashes the bolts are drawn for)', async () => {
  const E0 = await earth(); if (!E0) return;
  const was = WX2.cloudmap;
  try {
    on(E0); WX2.cloudmap = true;
    let t = W.STORMLAND.from;
    for (; t < W.STORMLAND.from + 30 * 1674; t += 20) if (W.cellsAt('earth', t).some((c) => c.land && c.kindId === 'storm' && c.w > 0.7)) break;
    const cf = new CloudField(18);
    E0.wm.refresh('earth', t, E0.sunAt(t)); cf.refresh('earth', t, E0.sunAt(t), E0.wm);
    const c = W.cellsAt('earth', t).find((q) => q.land && q.kindId === 'storm' && q.w > 0.7);
    // a place 30 % of the way out from the storm's middle, where its wider cloud shield covers it more than its core
    let ex = c.z, ez = -c.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
    const a = 0.3 * c.r / 4000, u = { x: c.x * Math.cos(a) + ex * Math.sin(a), y: c.y * Math.cos(a), z: c.z * Math.cos(a) + ez * Math.sin(a) };
    const here = new Set(), listed = new Set(), out = {};
    const near = (i, g, tt) => { const q = W.cellsAt('earth', tt).find((z) => z.i === i && z.gen === g); return q && dist(q, u) < q.r * 0.9; };
    for (let q = 0; q < 1200; q++) {
      const tt = t + q * 0.05;
      const w = W.weatherAt('earth', u.x, u.y, u.z, 30, tt, 18, { moist: 1 }, out);
      if (w.lightning.last && w.lightning.last.t > tt - 0.06 && w.lightning.last.t <= tt) here.add(w.lightning.last.t.toFixed(3));
      cf.step(0.05, 'earth', tt, E0.sunAt(tt), E0.wm);
      const L = cf.flashesFor('earth', tt, u.x * 4001.7, u.y * 4001.7, u.z * 4001.7);
      // (every storm cell flashing within its own radius and a half of the place: the ones whose light reaches it)
      for (let i = 0; i < L.n; i++) if (L[i].t > tt - 0.06 && L[i].t <= tt && near(L[i].cell, L[i].gen, tt)) listed.add(L[i].t.toFixed(3));
    }
    assert.ok(listed.size >= 2, `${listed.size} flashes of the storm listed in a minute`);
    for (const f of listed) assert.ok(here.has(f), `the storm's flash at ${f} s lit the place under it (it saw ${[...here].join(', ')})`);
  } finally { WX2.cloudmap = was; off(); }
});

test('land storms: the gust front blows at a mature storm\'s leading edge (15 to 25 m/s at 10 m), its outflow weak behind; no storm drifts over 10 m/s', async () => {
  const E0 = await earth(); if (!E0) return;
  const { windLarge } = await import('./wind.js');
  try {
    on(E0);
    let n = 0, fastest = 0;
    for (let t = W.STORMLAND.from; t < W.STORMLAND.from + 40 * 1674 && n < 6; t += 300) {
      for (const c of W.cellsAt('earth', t)) {
        if (!c.land || c.kindId !== 'storm') continue;
        fastest = Math.max(fastest, Math.hypot(c.ve, c.vn));
        if (c.w < 0.75 || Math.hypot(c.ve, c.vn) < 3) continue;
        let ex = c.z, ez = -c.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el; const nx = c.y * ez, ny = c.z * ex - c.x * ez, nz = -c.y * ex;
        const sp = Math.hypot(c.ve, c.vn), de = c.ve / sp, dn = c.vn / sp, o = new Float64Array(6), m = new Float64Array(4);
        // the 10 m wind as the near grid composes it (air.js): |mean x mul + outflow|, then the storm's own wind along it
        const at = (k) => {
          const a = k * c.r / 4000, tx = de * ex + dn * nx, ty = dn * ny, tz = de * ez + dn * nz;
          const u = { x: c.x * Math.cos(a) + tx * Math.sin(a), y: c.y * Math.cos(a) + ty * Math.sin(a), z: c.z * Math.cos(a) + tz * Math.sin(a) };
          W.weatherWind('earth', u.x, u.y, u.z, t, 18, o); windLarge('earth', u.x, u.y, u.z, t, 18, m);
          const bs = Math.hypot(m[0] * o[0] + o[1], m[1] * o[0] + o[2], m[2] * o[0] + o[3]);
          return { total: bs + o[5] * Math.min(1, bs / 2), out: Math.hypot(o[1], o[2], o[3]) };
        };
        const edge = at(0.9), behind = at(-0.9);
        assert.ok(edge.total >= 14 && edge.total <= 26, `at the leading edge of a storm of strength ${c.w.toFixed(2)}: ${edge.total.toFixed(1)} m/s at 10 m`);
        assert.ok(behind.out < edge.out / 3, `its outflow behind ${behind.out.toFixed(1)}, ahead ${edge.out.toFixed(1)} m/s`);
        n++; break;
      }
    }
    assert.ok(n >= 3, `${n} mature drifting storms looked at`);
    assert.ok(fastest <= 10 + 1e-6, `the fastest storm drifts at ${fastest.toFixed(1)} m/s`);
  } finally { off(); }
});
