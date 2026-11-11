// Tests: the wind field. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { WINDS, WIND, prevailing, windLarge, gustLevel, turbulenceIntensity, heightFactor, slopeFactor, shelterFactor, seaRoughness } from './wind.js';
import { BIOMES, coverAt, liquidRoughness } from './ground.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';

const o = new Float64Array(4), o2 = new Float64Array(4), pv = new Float64Array(2);
const dir = (lat, lon) => { const c = Math.cos(lat); return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)]; };

test('Earth: easterly trades at the equator, westerlies in mid latitudes, calm between', () => {
  prevailing('earth', 0, pv); assert.ok(pv[0] < -4, 'trades blow toward the west: ' + pv[0]);
  prevailing('earth', Math.sin(0.9), pv); assert.ok(pv[0] > 3, 'westerlies: ' + pv[0]);
  prevailing('earth', Math.sin(Math.PI / 6), pv); assert.ok(Math.hypot(pv[0], pv[1]) < 0.5, 'horse latitudes are calm');
  prevailing('earth', Math.sin(0.26), pv); assert.ok(pv[1] < 0, 'northern trades blow toward the equator');
  prevailing('earth', Math.sin(-0.26), pv); assert.ok(pv[1] > 0, 'southern trades blow toward the equator');
});

test('the giants keep their real order of windiness; airless bodies have no wind', () => {
  assert.ok(WINDS.neptune.U > WINDS.uranus.U && WINDS.uranus.U > WINDS.saturn.U && WINDS.saturn.U > WINDS.jupiter.U);
  assert.ok(WINDS.venus.U < 1.5, 'Venus surface air is slow');
  for (const id of ['moon', 'mercury']) { windLarge(id, 0.3, 0.5, 0.8, 100, 1, o); assert.equal(o[3], 0); }
  prevailing('jupiter', 0, pv); assert.ok(pv[0] > 0, 'Jupiter equatorial jet is prograde');
  prevailing('neptune', 0, pv); assert.ok(pv[0] < 0, 'Neptune equatorial jet is retrograde');
});

test('wind is tangent to the sphere and finite everywhere, poles included', () => {
  for (const id of BODY_IDS) for (let k = 0; k < 400; k++) {
    const d = dir(-1.5708 + 3.1416 * (k % 20) / 19, k * 0.37);
    windLarge(id, d[0], d[1], d[2], 1234.5 + k, 3, o);
    assert.ok(Number.isFinite(o[0]) && Number.isFinite(o[1]) && Number.isFinite(o[2]) && Number.isFinite(o[3]), id);
    const radial = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    assert.ok(Math.abs(radial) < 1e-6 * (1 + o[3]), `${id} radial ${radial}`);
    assert.ok(o[3] < WINDS[id].U * 4 + 1e-9, `${id} speed ${o[3]}`);
  }
});

test('continuity in space: one metre of travel changes the wind by centimetres per second', () => {
  for (const id of ['earth', 'neptune', 'jupiter', 'mars']) {
    const R = BODIES[id].radius;
    let worst = 0;
    for (let k = 0; k < 3000; k++) {
      const lat = -1.57 + 3.14 * ((k * 0.6180339) % 1), lon = k * 1.7;
      const a = dir(lat, lon), b = dir(lat + 0.7 / R, lon + 0.7 / R / Math.max(0.05, Math.cos(lat)));
      windLarge(id, a[0], a[1], a[2], 777, 5, o); windLarge(id, b[0], b[1], b[2], 777, 5, o2);
      worst = Math.max(worst, Math.hypot(o[0] - o2[0], o[1] - o2[1], o[2] - o2[2]));
    }
    assert.ok(worst < 0.12, `${id}: ${worst} m/s per metre`);
  }
});

test('continuity across the pole', () => {
  const R = 4000, e = 0.3 / R;
  for (const s of [1, -1]) {
    windLarge('earth', e, s * Math.sqrt(1 - e * e), 0, 50, 2, o); windLarge('earth', -e, s * Math.sqrt(1 - e * e), 0, 50, 2, o2);
    assert.ok(Math.hypot(o[0] - o2[0], o[1] - o2[1], o[2] - o2[2]) < 0.05);
  }
});

test('continuity in time, including across gust-cycle boundaries', () => {
  const p = [1200, 3000, 2300], w = [5, 0, -2];
  let worst = 0, prev = gustLevel('earth', p[0], p[1], p[2], w[0], w[1], w[2], 0, 4);
  for (let t = 1 / 60; t < 3 * WIND.gustCycle; t += 1 / 60) {
    const g = gustLevel('earth', p[0], p[1], p[2], w[0], w[1], w[2], t, 4);
    assert.ok(g >= -WIND.gustMax && g <= WIND.gustMax);      // (P11: the clamp sits at 3.3 sigma, not at level 1)
    worst = Math.max(worst, Math.abs(g - prev)); prev = g;
  }
  assert.ok(worst < 0.03, 'largest jump per frame ' + worst);
  let prevW = null, worstW = 0;
  for (let t = 0; t < 900; t += 0.5) {
    windLarge('earth', 0.3, 0.6, 0.74, t, 4, o);
    if (prevW) worstW = Math.max(worstW, Math.hypot(o[0] - prevW[0], o[1] - prevW[1], o[2] - prevW[2]));
    prevW = [o[0], o[1], o[2]];
  }
  assert.ok(worstW < 0.05, 'large-scale wind changes slowly: ' + worstW);
});

test('gusts travel downwind at the wind speed (frozen turbulence)', () => {
  // the pattern seen at x at time t is seen at x + w dt at time t + dt
  const w = [6, 0, 0];
  let err = 0, n = 0;
  for (let k = 0; k < 200; k++) {
    const x = k * 13.1, t = 40 + (k % 7), dt = 1.0;       // stay inside one phase of the cycle
    const a = gustLevel('earth', x, 4000, 100, w[0], w[1], w[2], t, 9);
    const b = gustLevel('earth', x + w[0] * dt, 4000, 100, w[0], w[1], w[2], t + dt, 9);
    err += Math.abs(a - b); n++;
  }
  assert.ok(err / n < 0.06, 'mean change following the flow: ' + err / n);
  // while at a fixed point the gust level really does change
  let ch = 0;
  for (let k = 0; k < 200; k++) ch += Math.abs(gustLevel('earth', k * 13.1, 4000, 100, 6, 0, 0, 40, 9) - gustLevel('earth', k * 13.1, 4000, 100, 6, 0, 0, 48, 9));
  assert.ok(ch / 200 > 0.15, 'gusts pass a fixed point: ' + ch / 200);
});

test('gusts are a balanced signal: lulls and gusts both happen', () => {
  let sum = 0, sq = 0, hi = 0, lo = 0, n = 0;
  for (let k = 0; k < 4000; k++) { const g = gustLevel('earth', k * 37.7, 3900 + (k % 50), k * 11.3, 5, 0, 1, k * 0.9, 7); sum += g; sq += g * g; if (g > 0.5) hi++; if (g < -0.5) lo++; n++; }
  assert.ok(Math.abs(sum / n) < 0.1, 'mean ' + sum / n);
  assert.ok(Math.sqrt(sq / n) > 0.25 && Math.sqrt(sq / n) < 0.7, 'rms ' + Math.sqrt(sq / n));
  assert.ok(hi > 40 && lo > 40);
});

test('determinism: same body, place, time and seed give the same wind', () => {
  windLarge('earth', 0.3, 0.6, 0.74, 123.4, 11, o); const a = [...o];
  windLarge('mars', 0.1, 0.2, 0.97, 5, 11, o2);
  windLarge('earth', 0.3, 0.6, 0.74, 123.4, 11, o); assert.deepEqual([...o], a);
  windLarge('earth', 0.3, 0.6, 0.74, 123.4, 12, o); assert.notDeepEqual([...o], a);
});

test('wind profile: log law over open ground, calm on the forest floor', () => {
  assert.ok(Math.abs(heightFactor(10, 0.03) - 1) < 1e-9, 'the reference is 10 m over grass');
  let prev = 0;
  for (let z = 0.1; z < 80; z += 0.5) { const f = heightFactor(z, 0.03); assert.ok(f >= prev - 1e-12); prev = f; }
  const open = heightFactor(2, 0.03), forest = heightFactor(2, 0.05, 14, 1), thin = heightFactor(2, 0.05, 14, 0.4);
  assert.ok(open > 0.6 && open < 0.8, 'open at 2 m: ' + open);
  assert.ok(forest < 0.12, 'closed forest floor at 2 m: ' + forest);
  assert.ok(thin > forest && thin < open);
  assert.ok(heightFactor(20, 0.05, 14, 1) > heightFactor(13, 0.05, 14, 1), 'crowns move more than trunks');
  // continuous through the canopy top
  assert.ok(Math.abs(heightFactor(13.999, 0.05, 14, 0.7) - heightFactor(14.001, 0.05, 14, 0.7)) < 1e-3);
  assert.ok(heightFactor(1.5, 0.0002) > heightFactor(1.5, 0.03), 'smooth water lets the wind reach the surface');
});

test('turbulence intensity: about 0.17 over grass, less over water, more over forest', () => {
  const g = turbulenceIntensity(10, 0.03), w = turbulenceIntensity(10, 0.0002), f = turbulenceIntensity(10, 1.0);
  assert.ok(Math.abs(g - 0.172) < 0.01, 'grass ' + g); assert.ok(w < g && f > g);
});

test('terrain: lee slopes shelter, windward slopes and crests speed the wind up', () => {
  assert.ok(slopeFactor(0.5) < 0.3 && slopeFactor(0) === 1 && slopeFactor(-0.4) > 1.2);
  assert.ok(shelterFactor(0.35) < 0.2 && shelterFactor(0) === 1 && shelterFactor(-0.2) > 1.2);
});

test('boundary layer: under the same wind aloft, a third is left at head height over a boulder shore, more over ice and sea, a sixth under a canopy', () => {
  // (lead review 5, P6: 40 m/s at the blending height, what is left at 2 m)
  const aloft = 40, at2 = (z0, hc, c) => aloft * heightFactor(2, z0, hc, c) / heightFactor(WIND.blendHeight, z0, hc, c);
  const shore = at2(BIOMES.storm_seas.z0), grass = at2(0.03), sand = at2(BIOMES.dust_dunes.z0), ice = at2(BIOMES.ice_shelves.z0), wood = at2(BIOMES.temperate_forest.z0, 14, 0.75);
  assert.ok(shore > 10 && shore < 16, 'boulder shore: ' + shore);
  assert.ok(grass > 20 && grass < 24, 'grass: ' + grass);
  assert.ok(sand > grass && ice > sand && ice < 30, 'smoother ground leaves more: ' + [grass, sand, ice]);
  assert.ok(wood < 8 && wood < shore * 0.6, 'under a canopy: ' + wood);
  // the open sea is as rough as its wind makes it (Charnock): glassy in Earth's breeze, rougher under Neptune's gale, never as rough as land
  assert.equal(seaRoughness(5.5, 9.8), 0.0002);
  const zn = seaRoughness(WINDS.neptune.U, BODIES.neptune.gravity), z40 = seaRoughness(40, BODIES.neptune.gravity);
  assert.ok(zn > 0.001 && zn < 0.004 && z40 > zn && z40 < 0.02, 'Neptune sea: ' + [zn, z40]);
  assert.equal(liquidRoughness('earth'), 0.0002);
  const sea = coverAt('neptune', { biomeId: 'storm_seas', radius: 4000, liquidRadius: 4002 }, {}), land = coverAt('neptune', { biomeId: 'storm_seas', radius: 4000, liquidRadius: 0 }, {});
  assert.ok(Math.abs(sea.z0 - zn) < 1e-9 && land.z0 === BIOMES.storm_seas.z0);
  const overSea = at2(sea.z0);
  assert.ok(overSea > 24 && overSea < 29 && overSea > shore * 1.7, 'over the storm sea: ' + overSea);
  for (const u of [0, 1, 10, 30, 60, 200]) for (const g of [0, 0.6, 3.7, 9.8, 25]) { const z = seaRoughness(u, g); assert.ok(z >= 0.0002 && z <= 0.05, `sea roughness stays bounded: ${u} ${g} ${z}`); }
});

// ---- P11: the gust pattern against what masts measure -------------------------------------------------
// A mast at 10 m over open grass in a steady wind (gustLevelFull: the large gusts and the fine eddies).
// Kaimal et al. 1972: f S(f) / u*^2 = 105 n / (1 + 33 n)^(5/3), n = f z / U; the share of the variance at
// frequencies below f is 1 - (1 + 33 f z / U)^(-2/3). Gust factor: the largest 3 s mean over the 10 minute
// mean, 1.4 to 1.6 over open country (WMO; Harper, Kepert and Ginger 2010).
test('P11 a mast at 10 m: turbulence intensity, gust factor and the shares of the variance by period follow Kaimal\'s spectrum', async () => {
  const { gustLevelFull } = await import('./wind.js');
  const z = 10, I = turbulenceIntensity(z, 0.03), hz = 10, N = 3600 * hz;
  const below = (f, U) => 1 - Math.pow(1 + 33 * f * z / U, -2 / 3);
  const edges = [600, 60, 15, 4, 1];              // s: bands 600-60, 60-15, 15-4, 4-1
  for (const U of [5, 11, 20]) {
    const u = new Float64Array(N);
    for (let i = 0; i < N; i++) u[i] = U * Math.max(WIND.minFactor, 1 + I * WIND.gustGain * gustLevelFull('earth', 0, 6371010, 0, U, 0, 0, 1000 + i / hz, 18));
    let m = 0; for (const v of u) m += v; m /= N; let s2 = 0; for (const v of u) s2 += (v - m) ** 2; s2 /= N;
    const TI = Math.sqrt(s2) / m;
    // gust factor over six 10 minute blocks
    let G = 0; const w = 3 * hz, B = 600 * hz;
    for (let b = 0; b < N; b += B) { let bm = 0, run = 0, mx = 0; for (let i = b; i < b + B; i++) { bm += u[i]; run += u[i]; if (i >= b + w) run -= u[i - w]; if (i >= b + w - 1) mx = Math.max(mx, run / w); } G += mx / (bm / B) / 6; }
    // variance of the means over p seconds keeps what is slower than about 2 p
    const vm = (p) => { const k = Math.max(1, Math.round(p * hz)); let n = 0, s = 0, q = 0; for (let i = 0; i + k <= N; i += k) { let a = 0; for (let j = i; j < i + k; j++) a += u[j]; a /= k; s += a; q += a * a; n++; } return q / n - (s / n) ** 2; };
    const got = [], want = [];
    for (let k = 0; k + 1 < edges.length; k++) { got.push((vm(edges[k + 1] / 2) - vm(edges[k] / 2)) / s2); want.push(below(1 / edges[k + 1], U) - below(1 / edges[k], U)); }
    // rate of change of the 1 s means against the same integral of Kaimal's spectrum to 0.5 Hz (Gaussian p99)
    const m1 = []; for (let i = 0; i + hz <= N; i += hz) { let a = 0; for (let j = i; j < i + hz; j++) a += u[j]; m1.push(a / hz); }
    const d = []; for (let i = 1; i < m1.length; i++) d.push(Math.abs(m1[i] - m1[i - 1])); d.sort((a, b) => a - b);
    const us = 0.4 * U / Math.log(z / 0.03); let va = 0; for (let f = 0.001; f < 0.5; f += 0.001) va += (2 * Math.PI * f) ** 2 * us * us * 105 * (z / U) / Math.pow(1 + 33 * f * z / U, 5 / 3) * 0.001;
    const p99 = d[Math.floor(d.length * 0.99)], real = 2.58 * Math.sqrt(va);
    console.log(`# mast at 10 m, U ${U}: TI ${TI.toFixed(3)} (I ${I.toFixed(3)}), G(3 s, 600 s) ${G.toFixed(2)}; shares 600-60 / 60-15 / 15-4 / 4-1 s: ${got.map((v) => v.toFixed(2)).join(' ')} (Kaimal ${want.map((v) => v.toFixed(2)).join(' ')}); p99 of the 1 s rate ${p99.toFixed(2)} m/s2 (Kaimal ${real.toFixed(2)})`);
    assert.ok(Math.abs(TI - I) < 0.015, `U ${U}: TI ${TI}`);
    assert.ok(G > 1.33 && G < 1.6, `U ${U}: gust factor ${G}`);
    for (let k = 0; k < got.length; k++) assert.ok(Math.abs(got[k] - want[k]) < 0.09, `U ${U}: band ${edges[k]}-${edges[k + 1]} s holds ${got[k].toFixed(3)}, Kaimal ${want[k].toFixed(3)}`);
    // what was wrong before P11: nothing under 4 s (0.01 to 0.05 where Kaimal has 0.09 to 0.24)
    assert.ok(got[3] > 0.5 * want[3], `U ${U}: the inertial range is there`);
    assert.ok(p99 > 0.6 * real && p99 < 1.3 * real, `U ${U}: 1 s rate ${p99} against ${real}`);
  }
});
