// Tests: weather systems. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherAt, moistureAt, cellsAt, weatherWind, saltationThreshold, ownStorm01, REGIMES, DEFAULT_SEED, WEATHER } from './weather.js';
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

test('M4 the first day at Earth\'s home forest is fair; the first thunderstorm crosses it at the second noon (1690 to 1850 s of play), seen coming, and the afternoon is clear (default seed, Earth\'s epoch)', () => {
  // (lead review 5, P2: it crossed at 640 to 800 s, after dark as the clock then was; P8 to M4: at 160 to 320 s.
  // PILOT's critique of PHYSICS in M4, item 5: two minutes into every new game is too soon, the first ten minutes are
  // when a player learns to walk and finds the ship; hold the first front off for about ten minutes. Ten minutes in is
  // the dusk of PILOT's clock (sunset at 11 minutes, sunrise at 22): the storm is at the second day's noon.)
  const d = { x: 0.1736, y: 0.5817, z: 0.7946 };                // PAINTER's spawn
  const fair = (t) => { const w = wx('earth', d, t); assert.ok(w.precipitation.rate < 0.03 && w.storm01 === 0 && w.fog01 < 0.25 && ['clear', 'breeze', 'overcast', 'mist', 'windy'].includes(w.kind), `t=${t}: ${w.kind}`); return w; };
  // the first day, its dusk and most of the night (17 minutes): no rain, and no system's cloud over the forest
  for (let t = 0; t <= 1050; t += 10) assert.ok(fair(t).cloud01 < 0.12, `t=${t}: cloud ${wx('earth', d, t).cloud01.toFixed(2)}`);
  // the second morning clouds over, brightens, and you see the storm come (the shield is over you before the first drop)
  for (let t = 1050; t <= 1650; t += 10) fair(t);
  assert.ok(wx('earth', d, 1350).cloud01 > 0.6 && wx('earth', d, 1630).cloud01 < 0.45 && wx('earth', d, 1680).cloud01 > 0.6, 'cloud builds');
  let wettest = 0, when = 0, first = -1, last = -1;
  for (let t = 0; t <= 2400; t += 10) { const w = wx('earth', d, t); if (w.precipitation.rate > wettest) { wettest = w.precipitation.rate; when = t; } if (w.kind === 'thunderstorm') { if (first < 0) first = t; last = t; } }
  assert.ok(wettest > 15 && when >= 1720 && when <= 1810, `the storm: ${wettest.toFixed(1)} mm/h at ${when} s`);
  assert.ok(first >= 1680 && first <= 1730 && last >= 1810 && last <= 1870, `called a thunderstorm from ${first} to ${last} s`);
  for (let t = 1880; t <= 2430; t += 10) fair(t);
  // PILOT's stub spawn has a fair first ten minutes
  for (let t = 0; t <= 600; t += 20) { const w = wx('earth', { x: 0.3339, y: 0.1072, z: -0.9365 }, t); assert.ok(w.precipitation.rate < 0.03 && w.storm01 === 0, `stub t=${t}: ${w.kind}`); }
  // the epoch is Earth's alone: no other body's weather clock moved
  for (const id in REGIMES) if (id !== 'earth') assert.ok(!REGIMES[id].epoch, id);
});

test('M4 the night\'s mist: none through the afternoon, the evening and the dusk; it gathers in the night, lies through the sunrise and is gone by mid-morning; a clouded night has little; without the sun\'s east part, the old law', () => {
  // (PILOT's critique of PHYSICS, item 5: mist from 6.5 minutes into a new game to the 24th: every evening and dusk
  // stood in it, because it hung on the sun's height alone.) A calm damp place with no system over it:
  let P = null;
  for (let k = 0; k < 600 && !P; k++) { const a = k * 2.399963, y = -0.6 + 1.2 * ((k * 0.618034) % 1), r = Math.sqrt(1 - y * y), q = { x: Math.cos(a) * r, y, z: Math.sin(a) * r }; const w = wx('earth', q, 50, { moist: 1, fog: 0.3, sun01: 0.6, wind: 1 }); if (w.cloud01 < 0.1 && w.storm01 === 0 && w.precipitation.rate === 0 && w.fog01 < 0.35) P = q; }
  assert.ok(P, 'a place under an open sky');
  // the sun round the sky: psi -90 sunset, 0 midnight, 90 sunrise, +-180 noon (sun01 = -cos psi x 0.8, sunEast = sin psi x 0.8)
  const at = (psi, extra = {}) => { const a = psi * Math.PI / 180; return wx('earth', P, 50, { moist: 1, fog: 0.3, wind: 1, sun01: -Math.cos(a) * 0.8, sunEast: Math.sin(a) * 0.8, ...extra }).fog01; };
  const noon = at(180), afternoon = at(-135), goldEvening = at(-100), sunset = at(-90), dusk = at(-75), midnight = at(0), small = at(45), sunrise = at(90), early = at(100), midMorning = at(130);
  assert.ok(Math.abs(afternoon - noon) < 1e-9 && Math.abs(goldEvening - noon) < 1e-9 && Math.abs(sunset - noon) < 1e-9 && Math.abs(dusk - noon) < 1e-9, `no more in the evening than at noon: ${noon.toFixed(2)} ${goldEvening.toFixed(2)} ${sunset.toFixed(2)} ${dusk.toFixed(2)}`);
  assert.ok(noon < 0.35, `a clear day: ${noon.toFixed(2)}`);
  assert.ok(midnight > noon + 0.2 && small > midnight && small > 0.6 && Math.abs(sunrise - small) < 1e-9 && early > 0.5, `the night's mist: midnight ${midnight.toFixed(2)}, the small hours ${small.toFixed(2)}, sunrise ${sunrise.toFixed(2)}, after it ${early.toFixed(2)}`);
  assert.ok(Math.abs(midMorning - noon) < 1e-9, `burnt off by mid-morning: ${midMorning.toFixed(2)}`);
  // it comes and goes steadily: under 0.03 of fog01 for a degree of the sun's turning (a degree is a second or more of any clock PILOT runs)
  let worst = 0, prev = at(-180); for (let psi = -179; psi <= 180; psi += 1) { const f = at(psi); worst = Math.max(worst, Math.abs(f - prev)); prev = f; }
  assert.ok(worst < 0.03, `steady: ${worst.toFixed(3)} a degree`);
  // the old law where the east part is not given: the evening as misty as the morning
  const old = (s) => wx('earth', P, 50, { moist: 1, fog: 0.3, wind: 1, sun01: s }).fog01;
  assert.ok(old(0.1) > 0.5 && Math.abs(old(-0.3) - small) < 1e-9, `without sunEast: ${old(0.1).toFixed(2)} at a low sun`);
  // a clouded night keeps its warmth: under a closed sky, less than half the mist
  const hit = find('earth', (w) => w.cloud01 > 0.9 && w.precipitation.rate === 0 && w.fog01 < 0.3 && w.kind === 'overcast');
  if (hit) {
    const cl = (extra) => weatherAt('earth', hit.d.x, hit.d.y, hit.d.z, 30, hit.t, DEFAULT_SEED, { moist: 1, fog: 0.3, wind: 1, sun01: -0.5, ...extra }, {});
    const under = cl({ sunEast: 0.6 }), oldUnder = cl({});
    assert.ok(under.fog01 < oldUnder.fog01 - 0.15, `under cloud ${under.cloud01.toFixed(2)}: fog ${under.fog01.toFixed(2)} for ${oldUnder.fog01.toFixed(2)}`);
  } else console.log('# (no overcast without rain found: the clouded night not checked)');
});

test('M4 the ground holds a few millimetres and the rest runs off: it is never wetter than the store, and after the first storm the sward is under 0.3 wet within three minutes of the last drop in the sun, under 0.35 within four under a closed sky', () => {
  // (PILOT's critique of PHYSICS, item 5: "let the sward dry in three or four minutes once the sun is back". Every
  // millimetre of the storm's 33 stayed to be dried: by the old law, with this storm where it now is, 0.35 two minutes
  // after the last drop in the noon sun and 0.62 four minutes after it under a closed sky in still air.)
  const d = { x: 0.1736, y: 0.5817, z: 0.7946 };                // PAINTER's spawn
  // the afternoon after the storm, as the game has it there: a light wind, the sun 40 degrees up
  const m = (t, e = {}) => moistureAt('earth', d.x, d.y, d.z, t, DEFAULT_SEED, { moist: 1, T: 290, wind: 2, sun01: 0.64, ...e }, {}).wetness01;
  let end = 1750; while (wx('earth', d, end).precipitation.rate > 0.02) end += 5;
  assert.ok(end > 1840 && end < 1880, `the last drop at ${end} s`);
  const peak = m(1790), top = 1 - Math.exp(-WEATHER.wetStore / WEATHER.wetDepth);
  assert.ok(peak > 0.9 && peak <= top + 1e-9, `soaked in the storm, and no wetter than the store: ${peak.toFixed(3)} (${top.toFixed(3)})`);
  const a2 = m(end + 120), a3 = m(end + 180), closed = { sun01: 0, wind: 1 }, c4 = m(end + 240, closed);
  console.log(`# M4 the sward after the first storm (the last drop at ${end} s): wetness ${peak.toFixed(2)} at its height, ${m(end).toFixed(2)} at the last drop; in the sun ${a2.toFixed(2)} two minutes after and ${a3.toFixed(2)} three (the old law: 0.35, 0.15); under a closed sky in still air ${c4.toFixed(2)} four minutes after (the old law: 0.62)`);
  assert.ok(a2 < 0.25 && a3 < 0.12, `in the sun: ${a2.toFixed(2)} after two minutes, ${a3.toFixed(2)} after three`);
  assert.ok(c4 < 0.35 && c4 > a3, `under a closed sky in still air, four minutes after: ${c4.toFixed(2)}`);
  for (let t = end; t <= end + 600; t += 5) assert.ok(m(t + 5, closed) <= m(t, closed) + 1e-3 && m(t, closed) - m(t + 5, closed) < 0.06, `drying steadily at ${t}: ${m(t, closed).toFixed(3)} -> ${m(t + 5, closed).toFixed(3)}`);
  // a shower that does not fill the store wets and dries as it did
  const hit = find('earth', (w) => w.precipitation.type === 'drizzle' && w.precipitation.rate > 0.3 && w.precipitation.rate < 1);
  if (hit) {
    const now = moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, hit.t, DEFAULT_SEED, { moist: 1, T: 288, wind: 3, sun01: 0.3 }, {}).wetness01;
    assert.ok(now > 0 && now < top - 0.05, `a drizzle: ${now.toFixed(3)}`);
  }
});

test('M4 mist and fog do not stand in a gale: over 12 m/s the grey air is called spray over open water and windy elsewhere; in calm air it is mist as before', () => {
  // PILOT's critique of PHYSICS, item 8: at Neptune's storm coast the weather was called mist for 348 of 600 s with 5 to 41 m/s blowing
  let P = null;
  for (let k = 0; k < 800 && !P; k++) { const a = k * 2.399963, y = -0.8 + 1.6 * ((k * 0.618034) % 1), r = Math.sqrt(1 - y * y), q = { x: Math.cos(a) * r, y, z: Math.sin(a) * r }; const w = wx('neptune', q, 40, { moist: 1, fog: 0.3, sun01: 0.6, wind: 30, fetch: 2500 }); if (w.precipitation.rate === 0 && w.storm01 === 0 && w.gale01 > 0.6) P = q; }
  assert.ok(P, 'a place in a gale with nothing falling');
  const sea = wx('neptune', P, 40, { moist: 1, fog: 0.3, sun01: 0.6, wind: 30, fetch: 2500 });
  assert.ok(sea.fog01 > 0.5 && sea.kind === 'spray', `over the open sea in the gale: ${sea.kind} (fog01 ${sea.fog01.toFixed(2)})`);
  // a pearl-fog flat (the biome's own fog, whatever the wind) in the same gale, inland: not mist
  const land = wx('neptune', P, 40, { moist: 1, fog: 1, sun01: 0.6, wind: 30, fetch: 0 });
  assert.ok(land.fog01 > 0.5 && land.kind === 'windy', `inland in the gale: ${land.kind} (fog01 ${land.fog01.toFixed(2)})`);
  // the numbers are what they were: only the name changed
  assert.ok(sea.visibility01 < 0.5 && land.visibility01 < 0.5);
  // calm damp air before dawn: mist, as before
  const d = dir(40, 20); let calm = null;
  for (let t = 0; t < 3000 && !calm; t += 50) { const w = wx('earth', d, t, { moist: 1, fog: 0.3, sun01: -0.3, wind: 1 }); if (w.precipitation.rate === 0 && w.cloud01 < 0.3 && w.fog01 > 0.5) calm = w; }
  assert.ok(calm && (calm.kind === 'mist' || calm.kind === 'fog'), 'calm: ' + (calm && calm.kind));
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

test('snow piles up in the cold, melts in the warm; standing snow is the biome\'s own and nothing else', () => {
  const hit = find('earth', (w) => w.precipitation.rate > 4);
  const cold = moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, hit.t + 200, DEFAULT_SEED, { moist: 1, T: 265, Tmean: 271, wind: 3 }, {});
  const warm = moistureAt('earth', hit.d.x, hit.d.y, hit.d.z, hit.t + 200, DEFAULT_SEED, { moist: 1, T: 290, Tmean: 288, wind: 3 }, {});
  assert.ok(cold.freshSnow > 0.01, 'fresh snow: ' + cold.freshSnow);
  assert.equal(warm.freshSnow, 0);
  // (P7, the ruling on snow) a cold place with no standing snow of its own (the green alpine meadow) has only
  // what has fallen lately; a biome painted under snow keeps its own, in fair weather too
  // (P9: the place was fixed, (0.2, 0.9, 0.38) at t = 100, where on Earth's clock as the game has it 27 mm has
  // just fallen; "no pack of its own" needs a place where nothing has fallen lately: the first one found)
  let F = null;
  for (let k = 0; k < 400 && !F; k++) { const a = k * 2.399963, y = 0.3 + 0.65 * ((k * 0.618034) % 1), r = Math.sqrt(1 - y * y), d = { x: Math.cos(a) * r, y, z: Math.sin(a) * r }; if (moistureAt('earth', d.x, d.y, d.z, 100, DEFAULT_SEED, { moist: 1, T: 255, Tmean: 255, wind: 3 }, {}).freshSnow < 1e-4) F = d; }
  assert.ok(F, 'a place where no snow has fallen lately');
  const alpine = moistureAt('earth', F.x, F.y, F.z, 100, DEFAULT_SEED, { moist: 1, T: 255, Tmean: 255, wind: 3 }, {});
  assert.ok(Math.abs(alpine.snowDepth - alpine.freshSnow) < 1e-12 && alpine.standing === 0 && alpine.snowDepth < 0.01, 'no pack of its own: ' + alpine.snowDepth);
  const tundra = moistureAt('earth', F.x, F.y, F.z, 100, DEFAULT_SEED, { moist: 1, T: 255, Tmean: 255, wind: 3, snowBase: 0.1 }, {});
  assert.ok(Math.abs(tundra.snowDepth - 0.1 - tundra.freshSnow) < 1e-12 && tundra.standing === 0.1);
  // and the wetness of melting snow comes in steadily as the afternoon crosses the melting point (it was a step of 55 %)
  let prevW = null, worst = 0;
  // (on standing snow, where nothing has fallen lately: the melt water alone)
  for (let T = 271; T <= 276; T += 0.02) { const m = moistureAt('earth', F.x, F.y, F.z, 100, DEFAULT_SEED, { moist: 1, T, wind: 3, snowBase: 0.05 }, {}); if (prevW != null) worst = Math.max(worst, Math.abs(m.wetness01 - prevW)); prevW = m.wetness01; }
  assert.ok(worst < 0.012 && prevW > 0.5, `wetness across the melting point: ${worst} for 0.02 K, ${prevW} well above it`);
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

test('a sea named for its storms storms most of the time: home-grown storms where the surface feeds the air (review 5, P3)', () => {
  const places = [dir(-4, -159), dir(20, 40), dir(-35, 100)];
  const share = (id, moist, fog = 0.4) => { let on = 0, n = 0, named = 0, flash = 0; for (const d of places) for (let t = 0; t < 14400; t += 30) { const w = wx(id, d, t, { moist, fog, sun01: 0.5, fetch: 2500 }, 2); n++; if (w.storm01 > 0.25) on++; if (w.kind === 'thunderstorm') named++; if (w.lightning.rate > 0.5) flash++; } return { on: on / n, named: named / n, flash: flash / n }; };
  const seas = share('neptune', 1.6), wall = share('jupiter', 1.4), plain = share('neptune', 1.0);
  assert.ok(seas.on > 0.6 && seas.on < 0.95 && seas.named > 0.5 && seas.flash > 0.4, 'Neptune\'s storm seas: ' + JSON.stringify(seas));
  assert.ok(wall.on > plain.on && seas.on > wall.on, 'more moisture, more storms: ' + JSON.stringify([plain, wall, seas]));
  // nothing of the kind where the ground is no wetter than the body's mean, or on a body without weather
  for (const m of [0, 0.5, 1, 1.2]) assert.equal(ownStorm01('neptune', 0.3, 0.2, 0.93, 500, DEFAULT_SEED, m), 0);
  // it comes and goes over minutes, and neighbours agree (R-WX-1: 15 % a second on the giants)
  let worst = 0, worstX = 0; const d = places[0], R = BODIES.neptune.radius;
  for (let t = 0; t < 7200; t += 1) { const a = ownStorm01('neptune', d.x, d.y, d.z, t, DEFAULT_SEED, 1.6), b = ownStorm01('neptune', d.x, d.y, d.z, t + 1, DEFAULT_SEED, 1.6); worst = Math.max(worst, Math.abs(b - a));
    const c = ownStorm01('neptune', d.x + 10 / R, d.y, d.z, t, DEFAULT_SEED, 1.6); worstX = Math.max(worstX, Math.abs(c - a)); }
  assert.ok(worst < 0.05, 'in a second: ' + worst);
  assert.ok(worstX < 0.05, 'over ten metres: ' + worstX);
  // its lightning is a real strike with a place and a distance
  let struck = 0; for (let t = 0; t < 3600; t += 7) { const w = wx('neptune', d, t, { moist: 1.6, sun01: 0.5 }, 2); if (w.lightning.last.t > -1e8) { struck++; assert.ok(Number.isFinite(w.lightning.last.distance) && w.lightning.last.distance < 20000); } }
  assert.ok(struck > 20, 'strikes seen: ' + struck);
});

test('only dry ground gives dust to the wind: none over a wet wood in any gale, plenty over a desert (review 5, P4)', () => {
  const d = { x: 0.1736, y: 0.5817, z: 0.7946 };
  for (const wind of [5, 15, 30, 60]) for (let t = 0; t <= 900; t += 30) {
    const wood = wx('earth', d, t, { moist: 1, dustSource: 0.02, wind, sun01: 0.5 }, 2), meadow = wx('earth', d, t, { moist: 1.1, dustSource: 0.05, wind, sun01: 0.5 }, 2);
    assert.equal(wood.dust01, 0, `wood, wind ${wind}, t ${t}`); assert.equal(meadow.dust01, 0);
  }
  const desert = wx('earth', d, 60, { moist: 0.08, dustSource: 0.7, wind: 20, sun01: 0.5 }, 2), calm = wx('earth', d, 60, { moist: 0.08, dustSource: 0.7, wind: 3, sun01: 0.5 }, 2);
  assert.ok(desert.dust01 > 0.5 && calm.dust01 === 0, 'desert in a gale ' + desert.dust01 + ', in a breeze ' + calm.dust01);
  const mars = wx('mars', d, 60, { moist: 0, dustSource: 1, wind: 3 * saltationThreshold('mars', ATMOSPHERES.mars.rho0), sun01: 0.5 }, 2);
  assert.ok(mars.dust01 > 0.3, 'Mars: ' + mars.dust01);
});
