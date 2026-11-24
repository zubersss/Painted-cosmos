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

test('the hydrograph: runnels fill within minutes of a downpour and drain after it; the streams rise slower and fall slower', () => {
  const st = { wet: 0, rise: 0, mud: 0, rain: 0, from: '', t: 0 };
  // ten minutes of 30 mm/h: 5 mm in the half hour, 5 mm in the three hours
  const storm = (min) => ({ mm30: Math.min(min, 30) / 60 * 30, mm180: min / 60 * 30, rain: 30 });
  for (let s = 0; s < 600; s++) stepRunoff(st, 1, storm(s / 60), 0);
  const wet10 = st.wet, rise10 = st.rise;
  assert.ok(wet10 > 0.7, 'the runnels run after ten minutes of a downpour (' + wet10.toFixed(2) + ')');
  assert.ok(rise10 > 0.03 && rise10 < RUNOFF.riseMax * 0.6, 'the streams have begun to rise (' + rise10.toFixed(3) + ' m)');
  // the rain stops; half an hour on the runnels have mostly drained, the streams are still up
  const dry = { mm30: 0, mm180: 5, rain: 0 };
  for (let s = 0; s < 1800; s++) stepRunoff(st, 1, dry, 0);
  assert.ok(st.wet < wet10 * 0.15, 'the runnels drain within half an hour (' + st.wet.toFixed(2) + ')');
  assert.ok(st.rise > 0.03, 'the streams are still up half an hour on (' + st.rise.toFixed(3) + ' m)');
  assert.ok(st.mud > 0 && st.mud <= RUNOFF.mudK);
  // and with no rain field, the ground's wetness stands in
  const st2 = { wet: 0, rise: 0, mud: 0, rain: 0, from: '', t: 0 };
  for (let s = 0; s < 1200; s++) stepRunoff(st2, 1, null, 0.95);
  assert.equal(st2.from, 'wetness'); assert.ok(st2.wet > 0.8 && st2.rise > 0.2);
  for (let s = 0; s < 1200; s++) stepRunoff(st2, 1, null, 0.0);
  assert.ok(st2.wet < 0.2);
});

test('the frame part reads the rain field when the physics has one, and the ground\'s wetness when not', () => {
  const calls = [];
  const physics = { fields: { rain: { t: 5000, rate: 12, rainBetween: (b, x, y, z, t0, t1) => { calls.push(t1 - t0); return { mm: (t1 - t0) / 3600 * 12 }; } } } };
  WATERSTATE.wet = 0; WATERSTATE.rise = 0;
  for (let i = 0; i < 200; i++) RUNOFF_PART.update({ dt: 0.25, physics, camL: { x: 0.2, y: 0.6, z: 0.76 }, bodyId: 'earth', st: null });
  assert.ok(calls.includes(1800) && calls.includes(10800), 'asked the last half hour and the last three hours');
  assert.equal(WATERSTATE.from, 'rain'); assert.ok(WATERSTATE.wet > 0.4, 'wet ' + WATERSTATE.wet.toFixed(2));
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
