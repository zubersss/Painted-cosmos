// Tests: the weather as a painter needs it. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { skyNumbers, SKY } from './sky.js';
import { weatherAt, moistureAt, cellsAt, DEFAULT_SEED } from './weather.js';
import { BODY_IDS, BODIES } from '../data/bodies.js';

const KEYS = ['cloud', 'overcast', 'haze', 'fog', 'dust', 'wet', 'snow', 'rain', 'snowfall', 'storm', 'flash'];
const KEYS12 = KEYS.concat(['fresh']);
const wx = (id, d, t, T) => { const w = weatherAt(id, d.x, d.y, d.z, 2, t, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4, dustSource: 1 }, {}); const m = moistureAt(id, d.x, d.y, d.z, t, DEFAULT_SEED, { moist: 1, T: T ?? w.temperature, wind: 4 }, {}); w.wetness01 = m.wetness01; w.snowDepth = m.snowDepth; return w; };

test('every number is there, finite and between 0 and 1, on every world, in any weather', () => {
  for (const id of BODY_IDS) for (let k = 0; k < 60; k++) {
    const a = k * 2.399963, y = 1 - 2 * (k + 0.5) / 60, r = Math.sqrt(1 - y * y), d = { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
    const s = skyNumbers(wx(id, d, 300 + k * 137), {});
    for (const key of KEYS) assert.ok(Number.isFinite(s[key]) && s[key] >= 0 && s[key] <= 1, `${id} ${key} = ${s[key]}`);
    assert.ok(s.fog + s.dust <= 1 - s.haze + 1e-9, 'fog and dust share what the haze takes');
  }
  const moon = skyNumbers(wx('moon', { x: 0, y: 0, z: 1 }, 500), {});
  assert.deepEqual(KEYS.map((k) => moon[k]), [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], 'vacuum: nothing, and a clear view');
  assert.equal(skyNumbers(null, {}).haze, 1);
});

test('it says what a painter would say: a storm is dark, wet and rainy; a dust storm is dust; snow covers', () => epoch0(() => {
  const find = (id, pred) => { for (let t = 0; t < 9000; t += 41) for (const c of cellsAt(id, t)) { const w = wx(id, c, t + 15); if (pred(w)) return { w, c, t: t + 15 }; } throw new Error('not found on ' + id); };
  const storm = skyNumbers(find('earth', (w) => w.storm01 > 0.7 && w.precipitation.rate > 10 && w.precipitation.type === 'rain').w, {});
  assert.ok(storm.cloud > 0.8 && storm.overcast > 0.7 && storm.rain > 0.6 && storm.haze < 0.6 && storm.snowfall < 0.1 && storm.dust < 0.05, JSON.stringify(storm));
  const fair = skyNumbers(wx('earth', { x: 0.1736, y: 0.5817, z: 0.7946 }, 20), {});
  assert.ok(fair.cloud < 0.2 && fair.overcast < 0.05 && fair.haze > 0.9 && fair.rain === 0, JSON.stringify(fair));
  const dust = skyNumbers(find('mars', (w) => w.dust01 > 0.85).w, {});
  assert.ok(dust.dust > 0.6 && dust.dust > dust.fog * 4 && dust.haze < 0.3, JSON.stringify(dust));
  const fog = skyNumbers(find('earth', (w) => w.fog01 > 0.8 && w.precipitation.rate < 0.02).w, {});
  assert.ok(fog.fog > 0.6 && fog.dust < 0.05 && fog.haze < 0.3 && fog.overcast < 0.5, JSON.stringify(fog));
  const snow = find('earth', (w) => w.precipitation.type === 'snow' && w.precipitation.rate > 1);
  const s = skyNumbers(snow.w, {});
  assert.ok(s.snowfall > 0.3 && s.rain < 0.05, JSON.stringify(s));
  const deep = { ...snow.w, snowDepth: 0.2 }, thin = { ...snow.w, snowDepth: 0.01 };
  assert.ok(skyNumbers(deep, {}).snow > 0.99 && Math.abs(skyNumbers(thin, {}).snow - (1 - Math.exp(-0.01 / SKY.snowCover))) < 1e-9);
}));

test('continuous in time: nothing but the flash moves by more than a tenth in a second', () => {
  let worst = 0, what = '';
  for (const id of ['earth', 'mars', 'jupiter', 'neptune', 'uranus']) for (let n = 0; n < 6; n++) {
    const t0 = 500 + n * 977;
    for (const c of cellsAt(id, t0)) {
      const d = { x: c.x, y: c.y, z: c.z }; let prev = null;
      for (let k = 0; k < 90; k += 1) {
        const s = skyNumbers(wx(id, d, t0 + k, 280), {});
        if (prev) for (const key of KEYS) { if (key === 'flash') continue; const dv = Math.abs(s[key] - prev[key]); if (dv > worst) { worst = dv; what = `${id} ${key}`; } }
        prev = { ...s };
      }
    }
  }
  assert.ok(worst <= 0.1, `largest change in one second: ${worst.toFixed(3)} (${what})`);
});

// ---- P7: the ruling on snow, a closed sky under what falls, a gale's own sky, and R-WX-1 -----------

import { createPhysics } from './index.js';
import { windLarge } from './wind.js';
import { makeWorld } from './testworld.mjs';
import { epoch0 } from './testworld.mjs';

test('fresh snow is a number of its own: it gathers while snow falls, is never more than the snow that lies, and a green meadow in fair weather has none', () => {
  const find = (id, pred) => { for (let t = 0; t < 9000; t += 41) for (const c of cellsAt(id, t)) { const w = weatherAt(id, c.x, c.y, c.z, 2, t + 15, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4 }, {}); if (pred(w)) return { c, t: t + 15 }; } throw new Error('not found'); };
  const hit = find('earth', (w) => w.precipitation.type === 'snow' && w.precipitation.intensity01 > 0.6);
  const at = (t, snowBase = 0) => { const w = weatherAt('earth', hit.c.x, hit.c.y, hit.c.z, 2, t, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4 }, {}); const m = moistureAt('earth', hit.c.x, hit.c.y, hit.c.z, t, DEFAULT_SEED, { moist: 1, T: 266, wind: 4, snowBase }, {}); w.wetness01 = m.wetness01; w.snowDepth = m.snowDepth; w.freshSnow = m.freshSnow; return skyNumbers(w, {}); };
  const s = at(hit.t + 60);
  assert.ok(s.fresh > 0.3 && Math.abs(s.fresh - s.snow) < 1e-9, `in the snowfall, on ground with no snow of its own: fresh ${s.fresh}, snow ${s.snow}`);
  const onTundra = at(hit.t + 60, 0.1);
  assert.ok(onTundra.snow > 0.96 && Math.abs(onTundra.fresh - s.fresh) < 1e-9, 'standing snow adds to `snow`, not to `fresh`');
  // long before the snowfall: nothing fresh
  // some time when nothing has fallen for long: nothing fresh (fresh snow settles into the pack or melts in half an hour of game time)
  let least = 1; for (let t = hit.t - 9000; t < hit.t + 9000; t += 120) { const q = at(t); if (q.snowfall === 0) least = Math.min(least, q.fresh); }
  assert.ok(least < 0.05, `fair weather, long after: fresh ${least}`);
  for (const id of BODY_IDS) for (let k = 0; k < 40; k++) { const a = k * 2.399963, y = 1 - 2 * (k + 0.5) / 40, r = Math.sqrt(1 - y * y), q = skyNumbers(wx(id, { x: Math.cos(a) * r, y, z: Math.sin(a) * r }, 300 + k * 137), {}); assert.ok(q.fresh >= 0 && q.fresh <= q.snow + 1e-12, `${id}: fresh ${q.fresh} of ${q.snow}`); }
  assert.equal(skyNumbers(null, {}).fresh, 0);
});

test('what falls, falls from cloud: under rain or snow the sky is closed and the light is dimmed', () => {
  let n = 0;
  for (const id of ['earth', 'jupiter', 'neptune', 'uranus', 'saturn']) for (let t = 0; t < 6000; t += 83) for (const c of cellsAt(id, t)) {
    const s = skyNumbers(wx(id, c, t + 15), {}), fall = Math.max(s.rain, s.snowfall);
    if (fall > 0.65) { n++; assert.ok(s.cloud > 0.85 && s.overcast > 0.5, `${id}: falling ${fall.toFixed(2)} under cloud ${s.cloud.toFixed(2)}, overcast ${s.overcast.toFixed(2)}`); }
    else if (fall > 0.2) assert.ok(s.cloud > 0.34, `${id}: falling ${fall.toFixed(2)} under cloud ${s.cloud.toFixed(2)}`);
  }
  assert.ok(n > 20, `${n} downpours and blizzards looked at`);
});

test('a gale has a sky of its own: scud, a dimmed light, and over an open sea spray that takes the view; a breeze has none of it', () => {
  // Neptune: find where the large-scale wind is strongest and weakest (no weather cell near)
  const o = new Float64Array(4); let hi = null, lo = null;
  for (let k = 0; k < 4000; k++) {
    const a = k * 2.399963, y = 1 - 2 * (k + 0.5) / 4000, r = Math.sqrt(1 - y * y), d = { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
    windLarge('neptune', d.x, d.y, d.z, 700, DEFAULT_SEED, o);
    if (!hi || o[3] > hi.u) hi = { d, u: o[3] }; if (!lo || o[3] < lo.u) lo = { d, u: o[3] };
  }
  assert.ok(hi.u > 30 && lo.u < 12, `Neptune's winds at one moment: ${lo.u.toFixed(0)} to ${hi.u.toFixed(0)} m/s`);
  const sea = (d, fetch) => skyNumbers(weatherAt('neptune', d.x, d.y, d.z, 2, 700, DEFAULT_SEED, { moist: 0.8, sun01: 0.5, fetch }, {}), {});
  const gale = sea(hi.d, 2500), galeLand = sea(hi.d, 0), calm = sea(lo.d, 2500);
  assert.ok(gale.cloud > 0.6 && gale.overcast > 0.4 && gale.storm > 0.5 && gale.haze < 0.45 && gale.fog > 0.4, 'a gale over the open sea: ' + JSON.stringify(gale));
  assert.ok(galeLand.cloud > 0.6 && galeLand.haze > gale.haze + 0.2, 'the same wind over land: scud, no spray: ' + JSON.stringify(galeLand));
  assert.ok(calm.overcast < gale.overcast - 0.3 && calm.haze > gale.haze + 0.2, 'where it is calm: ' + JSON.stringify(calm));
  // Earth's ordinary winds never get there
  for (let k = 0; k < 300; k++) { const a = k * 2.399963, y = 1 - 2 * (k + 0.5) / 300, r = Math.sqrt(1 - y * y); const w = weatherAt('earth', Math.cos(a) * r, y, Math.sin(a) * r, 2, 400 + k * 31, DEFAULT_SEED, { moist: 1, sun01: 0.5, fetch: 2500 }, {}); if (w.storm01 < 0.2) assert.ok(w.gale01 < 0.2, `earth gale01 ${w.gale01}`); }
});

test('R-WX-1: with the real temperature of each place, through physics.weather at any time (the stateless path) and through physics.here (the stateful one), no number but the flash moves faster than 8 % a second on Earth-like worlds and 15 % on the ice giants; the two paths agree', () => {
  const LIMIT = { earth: 0.08, mars: 0.08, venus: 0.08, jupiter: 0.08, saturn: 0.08, uranus: 0.15, neptune: 0.15 };
  for (const id of Object.keys(LIMIT)) {
    const R = BODIES[id].radius, sample = makeWorld({ R, biome: id === 'earth' ? 'alpine_meadow' : 'stub-lowland' });
    const physics = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    let worst = 0, what = '', worstHere = 0, whatHere = '', apart = 0;
    for (let n = 0; n < 3; n++) {
      const t0 = 400 + n * 1733, cells = cellsAt(id, t0);
      for (let ci = 0; ci < cells.length; ci += Math.max(1, Math.floor(cells.length / 4))) {
        const c = cells[ci], p = { x: c.x * (R + 1), y: c.y * (R + 1), z: c.z * (R + 1) };
        let prev = null, prevH = null; const w = {}, s = {};
        physics.warmUp({ bodyId: id, time: t0, focus: p });
        for (let k = 0; k <= 40; k++) {
          const t = t0 + k;
          for (let j = 0; j < 4; j++) physics.update(0.25, { bodyId: id, time: t - 0.75 + j * 0.25, focus: p });
          const here = physics.here.sky;
          // the stateless path: another body's-eye view of the same place at the same time (a time other than now makes it stateless)
          physics.sky(physics.weather(id, p, w, { time: t + 1e-3, surface: sample(c) }), s);
          for (const key of KEYS12) {
            if (key === 'flash') continue;
            if (prev) { const dv = Math.abs(s[key] - prev[key]); if (dv > worst) { worst = dv; what = key; } const dh = Math.abs(here[key] - prevH[key]); if (dh > worstHere) { worstHere = dh; whatHere = key; } }
            // (snow and fresh: at the focus fresh snow is integrated as it falls; elsewhere it is a quadrature
            // over the past, which is an estimate: see the next test)
            if (key !== 'snow' && key !== 'fresh') apart = Math.max(apart, Math.abs(s[key] - here[key]));
          }
          prev = { ...s }; prevH = { ...here };
        }
      }
    }
    assert.ok(worst <= LIMIT[id], `${id} stateless: ${what} moved ${(100 * worst).toFixed(1)} % in a second`);
    assert.ok(worstHere <= LIMIT[id], `${id} here: ${whatHere} moved ${(100 * worstHere).toFixed(1)} % in a second`);
    assert.ok(apart < 0.03, `${id}: the two paths are ${(100 * apart).toFixed(1)} % apart at most`);
  }
});

test('at the focus fresh snow comes only from the sky: it gathers while snow falls and never rises under a clear one', () => epoch0(() => {
  const R = BODIES.earth.radius, sample = makeWorld({ R, biome: 'alpine_meadow' });
  const physics = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
  let hit = null;
  for (let t = 0; t < 9000 && !hit; t += 41) for (const c of cellsAt('earth', t)) { const w = weatherAt('earth', c.x, c.y, c.z, 2, t + 15, DEFAULT_SEED, { moist: 1, sun01: 0.5 }, {}); if (w.precipitation.type === 'snow' && w.precipitation.intensity01 > 0.7) { hit = { c, t: t + 15 }; break; } }
  const p = { x: hit.c.x * (R + 1), y: hit.c.y * (R + 1), z: hit.c.z * (R + 1) };
  physics.warmUp({ bodyId: 'earth', time: hit.t - 200, focus: p });
  let dry = 0, gainedFalling = 0, gainedDry = 0, worstDry = 0, prev = null, top = 0, falling = 0;
  for (let t = hit.t - 200; t < hit.t + 700; t += 0.25) {
    physics.update(0.25, { bodyId: 'earth', time: t, focus: p });
    const s = physics.here.sky;
    assert.ok(s.fresh <= s.snow + 1e-9);
    if (s.snowfall > 0.005) { dry = 0; falling += 0.25; } else dry += 0.25;
    if (prev != null) { const d = s.fresh - prev; if (d > 0) { if (dry > 2) { gainedDry += d; worstDry = Math.max(worstDry, d); } else gainedFalling += d; } }
    prev = s.fresh; top = Math.max(top, s.fresh);
  }
  assert.ok(falling > 30 && gainedFalling > 0.15 && top > 0.2, `it snowed for ${falling} s and laid ${gainedFalling.toFixed(2)} of cover (most ${top.toFixed(2)})`);
  assert.ok(gainedDry < 1e-6, `cover gained with nothing falling: ${gainedDry} (worst step ${worstDry})`);
  // and the standing snow of a biome that has it is there in fair weather, with no fresh on it
  const polar = createPhysics({ sampleSurface: (b, d) => makeWorld({ R, biome: 'stub-polar' })(d), timeBudget: false });
  const q = { x: 0.6 * (R + 1), y: 0.64 * (R + 1), z: 0.48 * (R + 1) };
  polar.warmUp({ bodyId: 'earth', time: 20, focus: q }); polar.update(0.1, { bodyId: 'earth', time: 20.1, focus: q });
  assert.ok(polar.here.sky.snow > 0.99 && polar.here.sky.fresh <= polar.here.sky.snow);
  // the alpine meadow in fair weather: no snow at all (it stood under 40 cm before P7)
  const meadow = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
  let fair = null; for (let k = 0; k < 400 && !fair; k++) { const a = k * 2.399963, y = 0.2 + 0.6 * ((k * 0.618) % 1), r = Math.sqrt(1 - y * y), d = { x: Math.cos(a) * r, y, z: Math.sin(a) * r }, pp = { x: d.x * (R + 1), y: d.y * (R + 1), z: d.z * (R + 1) }; meadow.warmUp({ bodyId: 'earth', time: 50, focus: pp }); meadow.update(0.1, { bodyId: 'earth', time: 50.1, focus: pp }); const s = meadow.here.sky; if (s.cloud < 0.2 && s.snow < 0.02 && s.fresh < 0.02) fair = s; }
  assert.ok(fair, 'a fair day on the meadow with bare grass');
}));
