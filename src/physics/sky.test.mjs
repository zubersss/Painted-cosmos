// Tests: the weather as a painter needs it. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { skyNumbers, SKY } from './sky.js';
import { weatherAt, moistureAt, cellsAt, DEFAULT_SEED } from './weather.js';
import { BODY_IDS } from '../data/bodies.js';

const KEYS = ['cloud', 'overcast', 'haze', 'fog', 'dust', 'wet', 'snow', 'rain', 'snowfall', 'storm', 'flash'];
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

test('it says what a painter would say: a storm is dark, wet and rainy; a dust storm is dust; snow covers', () => {
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
});

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
