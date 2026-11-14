// Tests: the air and how things fall through it. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATMOSPHERES, SPECIES, terminalVelocity, sphereCd, airDensity, airTemperature, fallSpeed, bluntTerminal,
  meanFreePath, gravityAt, scaleHeight, liquidOf,
} from './atmosphere.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';

const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg || ''} got ${a}, want ${b} +-${rel * 100}%`);

test('every body has an atmosphere row and a liquid', () => {
  for (const id of BODY_IDS) { assert.ok(ATMOSPHERES[id], id); assert.ok(liquidOf(id).density > 0); }
});

test('raindrop terminal speeds match Gunn and Kinzer (1949) within 6 %', () => {
  const ref = [[0.001, 4.03], [0.002, 6.49], [0.003, 8.06], [0.004, 8.83], [0.005, 9.09]];
  for (const [d, v] of ref) close(terminalVelocity({ d, rho: 999, shape: 1, tension: 0.073 }, 9.81, 1.2, 1.81e-5), v, 0.06, `drop ${d * 1000} mm`);
});

test('terminal speed satisfies its own force balance: weight - buoyancy = drag', () => {
  for (const name of ['rain', 'snow', 'hail', 'sand', 'leaf', 'dust']) {
    const sp = SPECIES[name], g = 9.0, rho = 1.225, mu = 1.81e-5;
    const v = terminalVelocity(sp, g, rho, mu);
    const Re = rho * v * sp.d / mu;
    let shape = sp.shape; if (sp.tension > 0) shape *= 1 + 0.147 * sp.rho * g * sp.d * sp.d / sp.tension;
    const drag = 0.5 * rho * v * v * sphereCd(Re) * shape * Math.PI * sp.d * sp.d / 4;
    const weight = (sp.rho - rho) * g * Math.PI * sp.d ** 3 / 6;
    close(drag, weight, 1e-3, name);
  }
});

test('small particles follow Stokes law: v = d^2 (rho_p - rho) g / (18 mu)', () => {
  const sp = { d: 5e-6, rho: 2600, shape: 1, tension: 0 };
  close(terminalVelocity(sp, 9.81, 1.225, 1.81e-5), sp.d ** 2 * (2600 - 1.225) * 9.81 / (18 * 1.81e-5), 0.01);
});

test('snow falls about 1 m/s on Earth, rain 6-9 m/s', () => {
  const snow = fallSpeed('earth', 'snow'), rain = fallSpeed('earth', 'rain'), heavy = fallSpeed('earth', 'heavyRain');
  assert.ok(snow > 0.7 && snow < 1.5, 'snow ' + snow);
  assert.ok(rain > 5.5 && rain < 7.5, 'rain ' + rain);
  assert.ok(heavy > 7.5 && heavy < 9.5, 'heavy rain ' + heavy);
});

test('the same drop falls differently on every planet, in the right order', () => {
  const v = (b) => fallSpeed(b, 'rain');
  assert.ok(v('venus') < 1.2, 'Venus air is 53 times denser: rain drifts down, ' + v('venus'));
  assert.ok(v('mars') > 3 * v('earth'), 'thin Mars air: ' + v('mars'));
  assert.ok(v('venus') < v('earth') && v('earth') < v('jupiter') && v('jupiter') < v('mars'));
  assert.equal(v('moon'), Infinity, 'no terminal speed in a vacuum');
  assert.equal(fallSpeed('mercury', 'dust'), Infinity);
});

test('dust hangs longer in thin air only where the gas is rarefied; Pluto frost drifts slowly', () => {
  // Stokes settling does not depend on density, only on viscosity and gravity
  const e = fallSpeed('earth', 'dust'), m = fallSpeed('mars', 'dust');
  assert.ok(m < e * 1.5 && m > e * 0.5, `Mars ${m} vs Earth ${e}`);
  const frost = fallSpeed('pluto', 'frost');
  assert.ok(frost > 0.02 && frost < 1, 'Pluto frost falls slowly: ' + frost);
  assert.ok(meanFreePath('pluto', airDensity('pluto', 0), 40) > 1e-4, 'Pluto is in the slip regime');
});

test('a leaf and a snowflake float in the air of Venus', () => {
  assert.equal(fallSpeed('venus', 'leaf'), 0);
  assert.equal(fallSpeed('venus', 'snow'), 0);
});

test('density falls exponentially with the game scale height and reaches vacuum above the top', () => {
  for (const id of BODY_IDS) {
    const top = BODIES[id].atmosphereHeight, rho0 = ATMOSPHERES[id].rho0;
    if (!(top > 0) || !(rho0 > 0)) { assert.equal(airDensity(id, 10), 0, id); continue; }
    close(airDensity(id, 0), rho0, 1e-9, id);
    close(airDensity(id, scaleHeight(id)), rho0 / Math.E, 1e-9, id);
    close(airDensity(id, top), rho0 * Math.exp(-2.5), 1e-6, id + ' top');
    assert.equal(airDensity(id, top * 1.31), 0, id);
    let prev = Infinity;
    for (let h = -50; h < top * 1.4; h += top / 97) { const r = airDensity(id, h); assert.ok(r <= prev + 1e-12 && r >= 0 && Number.isFinite(r)); prev = r; }
  }
});

test('the ratio of ground to top-of-atmosphere density gives PILOT\'s 46 -> 160 m/s speed range', () => {
  const ratio = Math.sqrt(airDensity('earth', 0) / airDensity('earth', BODIES.earth.atmosphereHeight));
  close(46 * ratio, 160, 0.01);
});

test('temperature: colder aloft, colder at the poles, warmer in the sun, never absurd', () => {
  assert.ok(airTemperature('earth', 400, 0.6, null) < airTemperature('earth', 0, 0.6, null));
  assert.ok(airTemperature('earth', 0, 0.98, null) < airTemperature('earth', 0, 0, null));
  assert.ok(airTemperature('mars', 0, 0, 1) > airTemperature('mars', 0, 0, -1) + 40, 'Mars has a large day-night swing');
  for (const id of BODY_IDS) for (const h of [-1e6, 0, 1e6]) for (const s of [-1, 0, 1, null]) {
    const T = airTemperature(id, h, 0.3, s); assert.ok(Number.isFinite(T) && T >= 20 && T < 1200, `${id} ${T}`);
  }
  // snow line: 273 K is reached between 100 and 450 m in Earth's mid latitudes
  let line = null;
  for (let h = 0; h < 800; h += 5) if (airTemperature('earth', h, Math.sin(0.7), null) < 273.15) { line = h; break; }
  assert.ok(line > 100 && line < 450, 'snow line at ' + line);
});

test('gravity follows the inverse square law', () => {
  close(gravityAt('earth', 4000), 9.0, 1e-12);
  close(gravityAt('earth', 8000), 2.25, 1e-12);
});

test('a falling person: 50-55 m/s on Earth, a gentle 7 m/s on Venus', () => {
  const e = bluntTerminal(100, 9.0, 1.225, 0.6), v = bluntTerminal(100, 8.6, 65, 0.6);
  assert.ok(e > 45 && e < 56, 'earth ' + e); assert.ok(v > 5 && v < 8, 'venus ' + v);
  assert.equal(bluntTerminal(100, 2.2, 0, 0.6), Infinity);
});

test('no NaN for any species on any body at any altitude', () => {
  for (const id of BODY_IDS) for (const s of Object.keys(SPECIES)) for (const h of [-100, 0, 100, 5000]) {
    const v = fallSpeed(id, s, h); assert.ok(v === Infinity || (Number.isFinite(v) && v >= 0), `${id} ${s} ${h}: ${v}`);
  }
});
