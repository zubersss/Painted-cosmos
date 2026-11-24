// The wind map of a whole world (windmap.js; group D, the WIND lane; docs/lead/WEATHER-DESIGN.md 5.4).
// Each test below that is about new behaviour fails on the code before windmap.js, which had no land beyond 256 m at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WindMap, WINDMAP, FACES, faceToDir, dirToFace, sunHourAt, heatBuilt, setThermal } from './windmap.js';
import { makeWorld, norm, timing } from './testworld.mjs';
import { createPhysics } from './index.js';
import { WX2 } from './wx2.js';

// ---- the copies held equal to their originals (the physics may not import world/ or core/) -----------------------
test('wind map: its cube sphere is world/cubesphere.js to the digit', async () => {
  let cs;
  try { cs = await import('../world/cubesphere.js'); } catch (e) { console.log('# (skipped: ' + e.message + ')'); return; }
  assert.deepEqual(FACES, cs.FACES);
  const a = [0, 0, 0], b = [0, 0, 0], fa = {}, fb = {};
  for (let f = 0; f < 6; f++) for (let q = 0; q < 40; q++) {
    const u = Math.sin(q * 1.7 + f) * 0.97, v = Math.cos(q * 2.3 - f) * 0.97;
    faceToDir(f, u, v, a); cs.faceToDir(f, u, v, b);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-12);
    dirToFace(a[0], a[1], a[2], fa); cs.dirToFace(a[0], a[1], a[2], fb);
    assert.equal(fa.face, fb.face); assert.ok(Math.abs(fa.u - fb.u) < 1e-9 && Math.abs(fa.v - fb.v) < 1e-9);
  }
});

test('wind map: its hour is core/orbits.js sunHourAt to the digit', async () => {
  let ob;
  try { ob = await import('../core/orbits.js'); } catch (e) { console.log('# (skipped: ' + e.message + ')'); return; }
  for (let q = 0; q < 200; q++) {
    const s = norm({ x: Math.sin(q * 0.37), y: Math.cos(q * 0.91), z: Math.sin(q * 1.13 + 1) });
    const d = norm({ x: Math.cos(q * 0.53 + 2), y: Math.sin(q * 0.29), z: Math.cos(q * 1.71) });
    assert.ok(Math.abs(sunHourAt(s, d) - ob.sunHourAt(s, d)) < 1e-9);
  }
  assert.equal(heatBuilt(6), 0); assert.equal(heatBuilt(15), 1); assert.equal(heatBuilt(21), 0);
});

// ---- the land, and what the wind does over it (a synthetic world: one hill) --------------------------------------
// (in the trade winds near the equator, where the large-scale wind is steady over a few kilometres: at mid-latitudes on
//  Earth's bands it is the calm of the horse latitudes, and its eddies turn it within the hill's own width)
const D0 = norm({ x: 0.2, y: 0.04, z: 0.98 });
function hillMap(height = 420, radius = 900) {
  const sample = makeWorld({ R: 4000, cone: { dir: D0, radius, height } });
  const wm = new WindMap(18);
  wm.readLand('earth', sample, null, 0, 1e9);
  return wm;
}

test('wind map: the land is read, and the one hill is the world\'s first convection site', () => {
  const wm = hillMap();
  assert.ok(wm.land.ready);
  assert.ok(wm.sites.length >= 1);
  const s = wm.sites[0];
  const ang = Math.acos(Math.min(1, s.x * D0.x + s.y * D0.y + s.z * D0.z)) * 4000;
  assert.ok(ang < 450, `the first site lies ${ang.toFixed(0)} m from the hill's top`);
});

test('wind map: over and round a hill: the crest blows harder than the plain, the lee is calmer, the windward slope lifts', () => {
  const wm = hillMap();
  setThermal(false);
  wm.refresh('earth', 500, null);
  setThermal(true);
  const L = wm.land;
  // the large-scale wind over the hill (the same everywhere near it), to tell its lee from its windward side
  const o = wm.at(D0.x, D0.y, D0.z, {});
  let crest = [], plain = [], leeS = [], windS = [], lw = 0, nw = 0, ll = 0, nl = 0;
  for (let k = 0; k < wm.count; k++) {
    const dot = wm.cx[k] * D0.x + wm.cy[k] * D0.y + wm.cz[k] * D0.z, d = Math.acos(Math.min(1, dot)) * 4000;
    if (d < 250) crest.push(wm.shelter[k]);
    else if (d > 2500) plain.push(wm.shelter[k]);
    else if (d > 350 && d < 850) {
      // where the texel lies from the top, in the top's own east and north, against the way the wind blows
      let ex = D0.z, ez = -D0.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
      const nx = D0.y * ez, ny = D0.z * ex - D0.x * ez, nz = -D0.y * ex;
      const pe = wm.cx[k] * ex + wm.cz[k] * ez, pn = wm.cx[k] * nx + wm.cy[k] * ny + wm.cz[k] * nz, pl = Math.hypot(pe, pn);
      const c = (pe * o.e10 + pn * o.n10) / (pl * Math.hypot(o.e10, o.n10));
      if (c < -0.85) { windS.push(wm.shelter[k]); lw += wm.lift[k]; nw++; } else if (c > 0.85) { leeS.push(wm.shelter[k]); ll += wm.lift[k]; nl++; }
    }
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  assert.ok(med(crest) >= 1.3 * med(plain), `crest ${med(crest)} plain ${med(plain)}`);
  const leeCalm = leeS.filter((v) => v < med(plain)).length / leeS.length;
  assert.ok(leeCalm >= 0.7, `the lee is calmer than the plain over ${(leeCalm * 100).toFixed(0)} % of it`);
  assert.ok(lw / nw > 0.05 && ll / nl < 0, `lift windward ${(lw / nw).toFixed(2)} m/s, lee ${(ll / nl).toFixed(2)} m/s`);
});

test('wind map: thermal winds run up a sunny slope by day and drain down it at night', () => {
  const wm = hillMap(300, 1200);
  const L = wm.land;
  // a sun straight over the hill (noon there), and one under the hill's horizon (night)
  const day = { x: D0.x, y: D0.y, z: D0.z }, night = { x: -D0.x, y: -D0.y, z: -D0.z };
  const run = (sun, on) => { setThermal(on); wm.refresh('earth', 500, sun); const e = Float32Array.from(wm.e10), n = Float32Array.from(wm.n10); setThermal(true); return { e, n }; };
  for (const [sun, sign] of [[day, 1], [night, -1]]) {
    const a = run(sun, true), b = run(sun, false);
    let good = 0, n = 0;
    for (let k = 0; k < wm.count; k++) {
      const sl = Math.hypot(L.gradE[k], L.gradN[k]);
      if (sl < 0.1) continue;
      const de = a.e[k] - b.e[k], dn = a.n[k] - b.n[k];
      n++; if (sign * (de * L.gradE[k] + dn * L.gradN[k]) > 0) good++;
    }
    assert.ok(n > 10 && good / n >= 0.9, `${sign > 0 ? 'day: uphill' : 'night: downhill'} on ${good} of ${n} slope texels`);
  }
});

test('wind map: the sea lifts nothing by day; the convection trigger waits for the afternoon', () => {
  const sample = makeWorld({ R: 4000, sea: 4005, cone: { dir: D0, radius: 900, height: 420 } });
  const wm = new WindMap(18);
  wm.readLand('earth', sample, null, 0, 1e9);
  wm.refresh('earth', 500, D0);
  let sea = 0, ns = 0, trig = 0;
  for (let k = 0; k < wm.count; k++) {
    if (wm.land.water[k] > 0.99) { sea += wm.lift[k]; ns++; trig = Math.max(trig, wm.trigger[k]); }
  }
  assert.ok(ns > 1000 && sea / ns <= 0.02, `mean lift over open sea ${(sea / ns).toFixed(3)} m/s`);
  assert.equal(trig, 0, 'no convection is triggered over open sea');
  // the hill under a noon sun (the hour at the hill is 12): no built-up heat yet at noon's start? heatBuilt(12) is part way
  assert.ok(heatBuilt(12) > 0 && heatBuilt(12) < 1);
});

// ---- on PAINTER's real Earth, in the oil look -------------------------------------------------------------------
let EARTH = null;
async function realEarth() {
  if (EARTH) return EARTH;
  let surf, mode, looks;
  try {
    mode = await import('../data/mode.js'); mode.MODE.oil = true;
    looks = await import('../data/looks.js'); mode.overlayOil(looks.LOOKS);
    surf = await import('../world/surface.js');
  } catch (e) { console.log('# (skipped: the real surface did not load in Node: ' + e.message + ')'); return null; }
  const wm = new WindMap(18);
  const t0 = performance.now();
  wm.readLand('earth', (d) => surf.sampleSurfacePure('earth', d.x, d.y, d.z), null, 0, 1e9);
  const ms = performance.now() - t0;
  EARTH = { wm, surf, ms };
  return EARTH;
}

test('wind map on the real Earth: the storms\' sites are on the mountains; valleys channel the wind', async () => {
  const E = await realEarth();
  if (!E) return;
  const { wm, surf } = E;
  const onRange = wm.sites.filter((s) => surf.sampleSurfacePure('earth', s.x, s.y, s.z).biomeId === 'alpine_meadow').length;
  assert.ok(wm.sites.length >= 20 && onRange / wm.sites.length >= 0.6, `${onRange} of ${wm.sites.length} sites on the alpine range`);
  setThermal(false);
  wm.refresh('earth', 1760, null);
  setThermal(true);
  const L = wm.land;
  let n = 0, good = 0;
  for (let k = 0; k < wm.count; k++) {
    const sp = Math.hypot(wm.e10[k], wm.n10[k]);
    if (L.confine[k] <= 0.6 || sp < 0.3) continue;
    n++;
    if (Math.abs(wm.e10[k] * L.axisE[k] + wm.n10[k] * L.axisN[k]) / sp > Math.cos(20 * Math.PI / 180)) good++;
  }
  assert.ok(n > 200 && good / n >= 0.7, `${good} of ${n} confined valley texels blow within 20 degrees of the valley's axis`);
});

test('wind map on the real Earth: crests blow harder; sunny slopes lift; the cost of a refresh', async () => {
  const E = await realEarth();
  if (!E) return;
  const { wm } = E;
  const sun = norm({ x: 0.3, y: 0.8, z: 0.52 });
  for (let r = 0; r < 4; r++) wm.refresh('earth', 1760 + r, sun);
  const t0 = performance.now();
  for (let r = 0; r < 5; r++) wm.refresh('earth', 1770 + r, sun);
  const ms = (performance.now() - t0) / 5;
  const L = wm.land;
  const crest = [], plain = [];
  let sunny = 0, lifting = 0;
  for (let k = 0; k < wm.count; k++) {
    if (L.water[k] > 0.5) continue;
    if (L.relief[k] > 150) crest.push(wm.shelter[k]);
    else if (Math.abs(L.relief[k]) < 15 && Math.hypot(L.gradE[k], L.gradN[k]) < 0.03) plain.push(wm.shelter[k]);
    const up = sun.x * wm.cx[k] + sun.y * wm.cy[k] + sun.z * wm.cz[k];
    if (up > 0.5 && Math.hypot(L.gradE[k], L.gradN[k]) > 0.14) { sunny++; if (wm.lift[k] > 0) lifting++; }
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  assert.ok(med(crest) >= 1.3 * med(plain), `crest ${med(crest).toFixed(2)}, plain ${med(plain).toFixed(2)}`);
  assert.ok(sunny > 100 && lifting / sunny >= 0.7, `${lifting} of ${sunny} sunny slopes over 8 degrees lift`);
  timing(ms < 8, `a full refresh of the wind map on Earth: ${ms.toFixed(2)} ms (the land: ${E.ms.toFixed(0)} ms once)`);
});

// ---- wired into the physics -------------------------------------------------------------------------------------
test('wind map: off by default, the physics has none; on, it is read in slices and published', () => {
  const sample = makeWorld({ R: 4000, cone: { dir: D0, radius: 900, height: 420 } });
  const was = WX2.windmap;
  try {
    WX2.windmap = false;
    const p0 = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    p0.update(1 / 30, { bodyId: 'earth', time: 100, focus: { x: D0.x * 4010, y: D0.y * 4010, z: D0.z * 4010 }, sunDir: D0 });
    assert.equal(p0.fields.wind, null);
    WX2.windmap = true;
    const p1 = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    let frames = 0;
    while (!(p1.fields.wind && p1.fields.wind.ready) && frames < 400) { p1.update(1 / 30, { bodyId: 'earth', time: 100 + frames / 30, focus: { x: D0.x * 4010, y: D0.y * 4010, z: D0.z * 4010 }, sunDir: D0 }); frames++; }
    const W = p1.fields.wind;
    assert.ok(W && W.ready, `ready after ${frames} frames`);
    assert.ok(frames <= Math.ceil(6144 / WINDMAP.staticBatch) + 40, `${frames} frames to read the land and make the first refresh`);
    const o = W.at(D0.x, D0.y, D0.z, {});
    assert.ok(Number.isFinite(o.e10) && Number.isFinite(o.lift) && o.shelter > 1, `the hill's top: shelter ${o.shelter.toFixed(2)}`);
  } finally { WX2.windmap = was; }
});
