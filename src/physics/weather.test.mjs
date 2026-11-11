// Tests: weather systems. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherAt, moistureAt, cellsAt, weatherWind, saltationThreshold, REGIMES, DEFAULT_SEED, WEATHER } from './weather.js';
import { ATMOSPHERES } from './atmosphere.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';

const dir = (latDeg, lonDeg) => { const a = latDeg * Math.PI / 180, b = lonDeg * Math.PI / 180, c = Math.cos(a); return { x: c * Math.sin(b), y: Math.sin(a), z: c * Math.cos(b) }; };
const env = { moist: 1, fog: 0.3, sun01: 0.6, wind: 4 };
const wx = (id, d, t, e = env, alt = 30, seed = DEFAULT_SEED) => weatherAt(id, d.x, d.y, d.z, alt, t, seed, e, {});

// find a time and place where something is happening
function find(id, pred, seed = DEFAULT_SEED, e = env) {
  for (let t = 0; t < 6000; t += 37) {
    for (const c of cellsAt(id, t, seed)) {
      const w = weatherAt(id, c.x, c.y, c.z, 30, t, seed, e, {});
      if (pred(w, c)) return { t, d: { x: c.x, y: c.y, z: c.z }, w, c };
    }
  }
  return null;
}

test('deterministic: the same place and time always has the same weather', () => {
  const d = dir(40, 20);
  for (const id of BODY_IDS) {
    const a = JSON.stringify(wx(id, d, 1234.5)), b = JSON.stringify(wx(id, d, 1234.5));
    assert.equal(a, b, id);
  }
  assert.notEqual(JSON.stringify(cellsAt('earth', 500, 1).map((c) => c.x)), JSON.stringify(cellsAt('earth', 500, 2).map((c) => c.x)));
});

test('a fair morning over Earth\'s home forest for the first seven minutes (default seed)', () => {
  // PAINTER's spawn is found near the first forest site (38 N, 10 E); PILOT's stub spawn is elsewhere
  for (const d of [dir(38, 10), { x: 0.1736, y: 0.5817, z: 0.7946 }, { x: 0.3339, y: 0.1072, z: -0.9365 }]) {
    for (let t = 0; t <= 420; t += 10) {
      const w = wx('earth', d, t);
      assert.ok(w.precipitation.rate < 0.03 && w.storm01 === 0 && w.fog01 < 0.25, `t=${t}: ${w.kind}`);
      assert.ok(['clear', 'breeze', 'overcast', 'mist', 'windy'].includes(w.kind), w.kind);
    }
  }
  // ... and then, at PAINTER's spawn, you see weather coming and it comes: cloud builds within
  // five minutes, a storm passes between ten and fourteen, and the sky opens again
  const d = { x: 0.1736, y: 0.5817, z: 0.7946 };
  assert.ok(wx('earth', d, 60).cloud01 < 0.2 && wx('earth', d, 300).cloud01 > 0.5, 'cloud builds');
  let wettest = 0, when = 0; for (let t = 420; t <= 900; t += 10) { const r = wx('earth', d, t).precipitation.rate; if (r > wettest) { wettest = r; when = t; } }
  assert.ok(wettest > 3 && when > 600 && when < 840, `the storm: ${wettest.toFixed(1)} mm/h at ${when} s`);
  assert.ok(wx('earth', d, 960).precipitation.rate < 0.03, 'and it passes');
});

test('cells are born, drift with the wind, and die; nothing teleports while alive', () => {
  for (const id of ['earth', 'neptune', 'mars', 'venus']) {
    const R = BODIES[id].radius;
    let moved = 0, worst = 0, n = 0;
    for (let t = 100; t < 400; t += 1) {
      const a = cellsAt(id, t), b = cellsAt(id, t + 1);
      for (const c of a) {
        const c2 = b.find((x) => x.i === c.i && x.gen === c.gen);
        if (!c2) continue;
        const d = R * Math.hypot(c.x - c2.x, c.y - c2.y, c.z - c2.z);
        worst = Math.max(worst, d); moved += d; n++;
        assert.ok(Math.abs(c.w - c2.w) < 0.05, 'strength changes smoothly');
      }
    }
    assert.ok(n > 500, id + ' has live cells');
    assert.ok(worst < 60, `${id}: fastest cell ${worst} m/s`);
    assert.ok(moved / n > 0.2, `${id}: cells drift (${moved / n} m/s mean)`);
  }
});

test('weather is continuous in time and space', () => {
  const d = dir(12, 77);
  let prev = wx('earth', d, 0), worst = 0;
  for (let t = 0.5; t < 3000; t += 0.5) {
    const w = wx('earth', d, t);
    worst = Math.max(worst, Math.abs(w.precipitation.rate - prev.precipitation.rate) / 32, Math.abs(w.cloud01 - prev.cloud01), Math.abs(w.visibility01 - prev.visibility01));
    prev = w;
  }
  assert.ok(worst < 0.05, 'largest change in half a second: ' + worst);
});

test('Earth has every kind of weather somewhere, sometime', () => {
  const seen = new Set();
  for (let t = 0; t < 4000; t += 61) for (const c of cellsAt('earth', t)) {
    seen.add(wx('earth', c, t).kind);
    seen.add(wx('earth', c, t, { moist: 1, fog: 0.9, sun01: -0.2, wind: 1 }).kind);
    seen.add(wx('earth', c, t, { moist: 1, fog: 0.3, sun01: 0.5, wind: 14, dT: -30 }).kind);
  }
  for (const k of ['clear', 'breeze', 'overcast', 'drizzle', 'rain', 'thunderstorm', 'snow', 'blizzard', 'fog', 'mist']) assert.ok(seen.has(k) || seen.has(k === 'clear' ? 'breeze' : k), 'never saw ' + k + ' in ' + [...seen].join(', '));
});

test('rain turns to snow below freezing, and falls at this planet\'s terminal speed', () => {
  const hit = find('earth', (w) => w.precipitation.type === 'rain' && w.precipitation.rate > 3);
  assert.ok(hit, 'found rain');
  const p = hit.w.precipitation;
  assert.ok(p.fallSpeed > 5 && p.fallSpeed < 9.5, 'rain fall speed ' + p.fallSpeed);
  const cold = wx('earth', hit.d, hit.t, { ...env, dT: -30 });
  assert.equal(cold.precipitation.type, 'snow');
  assert.ok(cold.precipitation.fallSpeed > 0.5 && cold.precipitation.fallSpeed < 2.5, 'snow fall speed ' + cold.precipitation.fallSpeed);
  assert.ok(cold.visibility01 < hit.w.visibility01, 'snow hides more than rain');
});

test('deserts are dry: the biome moisture scales the rain', () => {
  const hit = find('earth', (w) => w.precipitation.rate > 5);
  const dry = wx('earth', hit.d, hit.t, { ...env, moist: 0.08 });
  assert.ok(dry.precipitation.rate < hit.w.precipitation.rate * 0.1);
});

test('thunderstorms: lightning is scheduled, repeatable, and thunder arrives at the speed of sound', () => {
  const hit = find('earth', (w) => w.kind === 'thunderstorm' && w.lightning.rate > 1.5);
  assert.ok(hit, 'found a thunderstorm');
  // watch it for a minute: flashes happen, at the same times on a second viewing
  const run = () => { const ts = []; let last = -1e9; for (let t = hit.t; t < hit.t + 60; t += 1 / 30) { const w = wx('earth', hit.d, t); if (w.lightning.last.t !== last && w.lightning.last.t > -1e8) { last = w.lightning.last.t; ts.push(last); } } return ts; };
  const a = run(), b = run();
  assert.ok(a.length >= 2, 'flashes in a minute: ' + a.length);
  assert.deepEqual(a, b);
  // the flash is bright at the moment it happens and gone a second later
  const tf = a[a.length - 1];
  const at = wx('earth', hit.d, tf + 0.01).lightning, later = wx('earth', hit.d, tf + 1.0).lightning;
  assert.ok(at.flash01 > 0.05 && later.flash01 === 0, `flash ${at.flash01} then ${later.flash01}`);
  // thunder: distance / speed of sound
  const c = ATMOSPHERES.earth.c;
  assert.ok(Math.abs((at.thunderIn + 0.01) - at.last.distance / c) < 1e-6);
  assert.ok(at.last.distance < 2500);
  // nextIn counts down to the next flash
  const w0 = wx('earth', hit.d, hit.t).lightning;
  if (Number.isFinite(w0.nextIn)) { const w1 = wx('earth', hit.d, hit.t + w0.nextIn + 0.02).lightning; assert.ok(w1.last.t > hit.t, 'the predicted flash happened'); }
});

test('a gust front runs ahead of a storm: wind blows outward from the core', () => {
  const hit = find('earth', (w, c) => c.kindId === 'storm' && c.w > 0.7);
  assert.ok(hit);
  const c = hit.c, R = BODIES.earth.radius;
  // a point just ahead of the rain edge, east of the centre
  let ex = c.z, ez = -c.x; const l = Math.hypot(ex, ez); ex /= l; ez /= l;
  const k = c.r * 1.0 / R;
  const p = { x: c.x + ex * k, y: c.y, z: c.z + ez * k }; const pl = Math.hypot(p.x, p.y, p.z); p.x /= pl; p.y /= pl; p.z /= pl;
  const o = new Float64Array(5);
  weatherWind('earth', p.x, p.y, p.z, hit.t, DEFAULT_SEED, o);
  const out = o[1] * ex + o[3] * ez;
  assert.ok(out > 2, 'outflow away from the storm: ' + out + ' m/s');
  assert.ok(o[0] >= 1, 'and the mean wind is not weaker');
});

test('wetness builds up under rain and dries afterwards; faster in sun and wind', () => {
  const hit = find('earth', (w) => w.precipitation.type === 'rain' && w.precipitation.rate > 4);
  const m = (t, e) => moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, t, DEFAULT_SEED, { moist: 1, T: 288, wind: 3, sun01: 0.3, ...e }, {});
  // find when the rain ends at this place
  let tEnd = hit.t;
  while (wx('earth', hit.d, tEnd).precipitation.rate > 0.01 && tEnd < hit.t + 3000) tEnd += 10;
  const during = m(hit.t + 30).wetness01, after1 = m(tEnd + 120).wetness01, after2 = m(tEnd + 600).wetness01, after3 = m(tEnd + 2400).wetness01;
  assert.ok(during > 0.5, 'wet in the rain: ' + during);
  assert.ok(after2 < after1 + 1e-9 && after3 < 0.15, `dries: ${after1} -> ${after2} -> ${after3}`);
  const still = m(tEnd + 200, { wind: 0, sun01: -0.5 }).wetness01, windy = m(tEnd + 200, { wind: 12, sun01: 0.9 }).wetness01;
  assert.ok(windy < still, `sun and wind dry faster: ${windy} < ${still}`);
  // bounded
  for (let t = hit.t - 500; t < hit.t + 3000; t += 50) { const w = m(t).wetness01; assert.ok(w >= 0 && w <= 1); }
});

test('snow piles up in the cold, melts in the warm, and stays where the mean is below freezing', () => {
  const hit = find('earth', (w) => w.precipitation.rate > 4);
  const cold = moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, hit.t + 200, DEFAULT_SEED, { moist: 1, T: 265, Tmean: 271, wind: 3 }, {});
  const warm = moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, hit.t + 200, DEFAULT_SEED, { moist: 1, T: 290, Tmean: 288, wind: 3 }, {});
  assert.ok(cold.freshSnow > 0.01, 'fresh snow: ' + cold.freshSnow);
  assert.equal(warm.freshSnow, 0);
  const alpine = moistureAt('earth', 0.2, 0.9, 0.38, 100, DEFAULT_SEED, { moist: 1, T: 255, Tmean: 255, wind: 3 }, {});
  assert.ok(alpine.snowDepth >= 0.39, 'permanent snow where it never thaws: ' + alpine.snowDepth);
  const frozenWet = moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, hit.t + 200, DEFAULT_SEED, { moist: 1, T: 265, wind: 3 }, {});
  assert.ok(frozenWet.wetness01 < 0.05, 'snow does not wet the ground until it melts');
});

test('each body has its own regime', () => {
  const kinds = (id, e = env) => { const s = new Set(); for (let t = 0; t < 5000; t += 83) for (const c of cellsAt(id, t)) { s.add(weatherAt(id, c.x, c.y, c.z, 30, t, DEFAULT_SEED, e, {}).kind); } return s; };
  for (const id of ['moon', 'mercury']) {
    const w = wx(id, dir(10, 10), 300);
    assert.equal(w.kind, 'vacuum'); assert.equal(w.precipitation.type, 'none'); assert.equal(w.visibility01, 1); assert.equal(cellsAt(id, 300).length, 0);
  }
  const mars = kinds('mars', { ...env, dustSource: 1 });
  assert.ok(mars.has('dust storm'), 'Mars has dust storms: ' + [...mars].join(', '));
  assert.ok(!mars.has('rain') && !mars.has('thunderstorm') && !mars.has('snow'), 'no rain on Mars');
  const venus = kinds('venus');
  assert.ok(venus.has('haze') || venus.has('virga'), 'Venus: ' + [...venus].join(', '));
  assert.ok(!venus.has('rain') && !venus.has('snow'));
  const jup = kinds('jupiter'); assert.ok(jup.has('thunderstorm'), 'Jupiter storms');
  const ura = kinds('uranus'); assert.ok(ura.has('ice fall') || ura.has('snow'), 'Uranus: ' + [...ura].join(', '));
  const nep = kinds('neptune'); assert.ok(nep.has('thunderstorm') && (nep.has('rain') || nep.has('snow')), 'Neptune: ' + [...nep].join(', '));
  const plu = kinds('pluto'); assert.ok(plu.has('frost fall'), 'Pluto: ' + [...plu].join(', '));
});

test('Venus: acid drizzle evaporates before reaching low ground (virga), reaches the mesas', () => {
  const hit = find('venus', (w) => w.precipitation.type === 'acid');
  assert.ok(hit, 'found acid drizzle');
  const low = wx('venus', hit.d, hit.t, env, 20), high = wx('venus', hit.d, hit.t, env, 260);
  assert.ok(low.precipitation.reachesGround01 < 0.05 && low.kind === 'virga', low.kind);
  assert.ok(high.precipitation.reachesGround01 > 0.9 && high.kind === 'acid drizzle', high.kind);
  assert.ok(low.precipitation.fallSpeed < 1.5, 'drops drift down through air a twentieth as dense as water');
});

test('Neptune rains methane (liquid at 95 K); Uranus snows it (below its 90.7 K melting point)', () => {
  const n = find('neptune', (w) => w.precipitation.type === 'rain');
  assert.ok(n && n.w.precipitation.species === 'methaneRain', n && n.w.precipitation.species);
  const u = find('uranus', (w) => w.precipitation.rate > 0.2);
  assert.ok(u && ['ice', 'snow'].includes(u.w.precipitation.type), u && u.w.precipitation.type);
});

test('sand starts to blow at about 6 m/s on Earth, needs a gale on Mars, a breath on Venus', () => {
  const e = saltationThreshold('earth', 1.225), m = saltationThreshold('mars', 0.02), v = saltationThreshold('venus', 65);
  assert.ok(e > 4.5 && e < 7.5, 'earth ' + e); assert.ok(m > 20, 'mars ' + m); assert.ok(v < 1.2, 'venus ' + v);
  assert.equal(saltationThreshold('moon', 0), Infinity);
});

test('fog needs calm, damp, cool air: wetland dawn yes, windy noon no', () => {
  const d = dir(-20, 200);
  let t = 0; while (wx('earth', d, t).cloud01 > 0.05 && t < 4000) t += 50;
  const dawn = wx('earth', d, t, { moist: 1.2, fog: 0.9, sun01: -0.05, wind: 0.8 });
  const noon = wx('earth', d, t, { moist: 1.2, fog: 0.9, sun01: 0.9, wind: 9 });
  assert.equal(dawn.kind, 'fog'); assert.ok(dawn.visibility < 400, 'dawn fog visibility ' + dawn.visibility);
  assert.ok(noon.fog01 < 0.1 && noon.visibility > 5000, `noon: ${noon.kind} ${noon.visibility}`);
});

test('no NaN anywhere, any time, any altitude', () => {
  for (const id of BODY_IDS) for (let k = 0; k < 300; k++) {
    const d = dir(-90 + (k % 19) * 10, k * 37);
    const w = weatherAt(id, d.x, d.y, d.z, -50 + k * 7, k * 91.7 - 5000, DEFAULT_SEED, k % 3 ? env : null, {});
    for (const v of [w.intensity01, w.precipitation.rate, w.precipitation.fallSpeed, w.visibility01, w.cloud01, w.temperature, w.lightning.flash01, w.windFactor]) assert.ok(Number.isFinite(v), `${id} ${k}: ${JSON.stringify(w)}`);
    assert.ok(w.intensity01 >= 0 && w.intensity01 <= 1 && w.visibility01 > 0 && w.visibility01 <= 1);
    const m = moistureAt(id, d.x, d.y, d.z, k * 91.7, DEFAULT_SEED, { T: w.temperature }, {});
    assert.ok(Number.isFinite(m.wetness01) && Number.isFinite(m.snowDepth) && m.snowDepth >= 0);
  }
});

test('edges: a fog or dust bank closes in at 5 % of visibility01 a second at most; nothing steps where systems overlap or the air crosses freezing', () => {
  // a watcher standing still while each live system passes over, on every body with weather
  const worst = { bank: 0, any: 0, inten: 0, pi: 0 };
  for (const id of ['earth', 'mars', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
    const R = BODIES[id].radius;
    for (let n = 0; n < 12; n++) {
      const t0 = 500 + n * 977;
      for (const c of cellsAt(id, t0, 14)) for (const off of [0.5, 0.95]) {
        const d = c.r * off / R;
        let tx = -c.z, tz = c.x; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        let ux = c.x + tx * d, uy = c.y, uz = c.z + tz * d; const l = Math.hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l;
        let pv = null, pi = 0, pp = 0;
        for (let k = 0; k < 120; k += 1) {
          const w = weatherAt(id, ux, uy, uz, 2, t0 + k, 14, { moist: 0.5 }, {});
          if (pv != null) {
            const dv = Math.abs(w.visibility01 - pv);
            worst.any = Math.max(worst.any, dv);
            if (w.precipitation.rate < 0.02) worst.bank = Math.max(worst.bank, dv);
            worst.inten = Math.max(worst.inten, Math.abs(w.intensity01 - pi));
            worst.pi = Math.max(worst.pi, Math.abs(w.precipitation.intensity01 - pp));
          }
          pv = w.visibility01; pi = w.intensity01; pp = w.precipitation.intensity01;
        }
      }
    }
  }
  assert.ok(worst.bank <= 0.05, 'fog, dust and haze: ' + worst.bank.toFixed(4) + ' per second');
  assert.ok(worst.any <= 0.125, 'with precipitation (a snow squall is the steepest): ' + worst.any.toFixed(4) + ' per second');
  assert.ok(worst.inten <= 0.08, 'intensity01: ' + worst.inten.toFixed(4) + ' per second');
  assert.ok(worst.pi <= 0.08, 'precipitation.intensity01: ' + worst.pi.toFixed(4) + ' per second');
});

test('a fast system is a big one: the quickest weather on any world still takes half a minute to arrive', () => {
  for (const id of ['jupiter', 'saturn', 'neptune', 'uranus']) for (let n = 0; n < 10; n++) for (const c of cellsAt(id, 300 + n * 811, 14)) {
    const v = Math.hypot(c.ve, c.vn);
    if (c.life < 1e8) assert.ok(c.r >= v * WEATHER.passTime * 0.75 - 1e-6, `${id}: r ${c.r.toFixed(0)} m at ${v.toFixed(1)} m/s`);
  }
});
