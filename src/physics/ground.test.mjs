// Tests: ground materials and contact. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, BIOMES, groundAt, coverAt, iceFriction, biomePhysics, holdAngle } from './ground.js';
import { LOOKS } from '../data/looks.js';

const surf = (biomeId, slope = 0, liquid = 0, radius = 4000) => ({ radius, slope, liquidRadius: liquid, biomeId, biomeWeights: { [biomeId]: 1 }, normal: { x: 0, y: 1, z: 0 } });

test('every biome PAINTER defines has a physics row with known materials', () => {
  for (const bodyId of Object.keys(LOOKS)) for (const b of LOOKS[bodyId].biomes) {
    const p = BIOMES[b.id];
    assert.ok(p, `no physics for biome ${bodyId}/${b.id}`);
    for (const k of ['ground', 'steep', 'shore']) assert.ok(MATERIALS[p[k]], `${b.id}.${k} = ${p[k]}`);
  }
});

test('material table is physically ordered', () => {
  const M = MATERIALS;
  for (const k of Object.keys(M)) { assert.ok(M[k].muK <= M[k].muS, k); assert.ok(M[k].muS > 0 && M[k].muS < 1.2); assert.ok(M[k].rest >= 0 && M[k].rest < 0.5); }
  assert.ok(M.rock.muS > M.grass.muS && M.grass.muS > M.mud.muS && M.mud.muS > M.ice.muS);
  assert.ok(M.snow.sink > M.sand.sink && M.sand.sink > M.soil.sink && M.rock.sink === 0);
  assert.ok(Math.abs(M.sand.repose - 34 * Math.PI / 180) < 0.01, 'dry sand holds about 34 degrees');
  assert.ok(M.sand.resist > 5 * M.soil.resist, 'walking on sand costs far more than on firm ground');
});

test('ice is slippery only near its melting point', () => {
  assert.ok(iceFriction(273) < 0.08); assert.ok(iceFriction(263) > 0.12 && iceFriction(263) < 0.2);
  assert.ok(iceFriction(90) > 0.5, 'the ice of Uranus grips like rock');
  let prev = 1; for (let T = 60; T < 280; T += 3) { const m = iceFriction(T); assert.ok(m <= prev + 1e-12); prev = m; }
  const uranus = groundAt('uranus', surf('ice_shelves'), { temperature: 90 }), earth = groundAt('earth', surf('stub-polar'), { temperature: 271, snowDepth: 0 });
  assert.equal(uranus.material, 'ice'); assert.ok(uranus.friction > 0.5);
  assert.ok(earth.friction < 0.5);
});

test('rain: wet rock loses nearly half its grip, soaked soil becomes mud, dust stops rising', () => {
  const dry = groundAt('earth', surf('desert_canyon', 0.9), { wetness01: 0, temperature: 300 }, {});
  const wet = groundAt('earth', surf('desert_canyon', 0.9), { wetness01: 1, temperature: 300 }, {});
  assert.equal(dry.material, 'rock');
  assert.ok(wet.friction < dry.friction * 0.62 && wet.friction > dry.friction * 0.45, `${dry.friction} -> ${wet.friction}`);
  const s0 = groundAt('earth', surf('temperate_forest'), { wetness01: 0, temperature: 288 }, {});
  const s1 = groundAt('earth', surf('temperate_forest'), { wetness01: 1, temperature: 288 }, {});
  assert.ok(s1.sink > s0.sink && s1.drag > s0.drag && s1.friction < s0.friction);
  const d0 = groundAt('earth', surf('desert_canyon'), { wetness01: 0, temperature: 300 }, {}), d1 = groundAt('earth', surf('desert_canyon'), { wetness01: 0.6, temperature: 300 }, {});
  assert.ok(d0.dust > 0.4 && d1.dust < 0.05);
  assert.ok(d1.friction > d0.friction, 'damp sand is firmer than dry sand');
});

test('wet ground that freezes is glazed with ice', () => {
  const g = groundAt('earth', surf('alpine_meadow'), { wetness01: 0.9, temperature: 268 }, {});
  assert.equal(g.material, 'ice'); assert.ok(g.friction < 0.3);
});

test('snow covers the ground: deeper prints, more drag, less grip', () => {
  const bare = groundAt('earth', surf('alpine_meadow'), { snowDepth: 0, temperature: 265 }, {});
  const thin = groundAt('earth', surf('alpine_meadow'), { snowDepth: 0.05, temperature: 265 }, {});
  const deep = groundAt('earth', surf('alpine_meadow'), { snowDepth: 0.4, temperature: 265 }, {});
  assert.equal(deep.material, 'snow');
  assert.ok(deep.sink > 0.25 && deep.sink > thin.sink && thin.sink > bare.sink, `${bare.sink} ${thin.sink} ${deep.sink}`);
  assert.ok(deep.drag > 0.3 && deep.friction < bare.friction);
  assert.ok(deep.imprint > 0.9);
});

test('steep ground is rock, the shore is its own material, liquid means standing on the bed', () => {
  assert.equal(groundAt('earth', surf('temperate_forest', 0.2), null, {}).material, 'litter');
  assert.equal(groundAt('earth', surf('temperate_forest', 0.9), null, {}).material, 'rock');
  assert.equal(groundAt('earth', surf('sea_coast', 0.05, 3999.8), null, {}).material, 'sand');
  const wade = groundAt('earth', surf('sea_coast', 0.05, 4000.6), null, {});
  assert.equal(wade.material, 'bed'); assert.ok(Math.abs(wade.liquidDepth - 0.6) < 1e-9); assert.equal(wade.dust, 0);
});

test('biome weights blend the numbers smoothly', () => {
  const a = groundAt('earth', surf('desert_canyon'), null, {}).sink, b = groundAt('earth', surf('alpine_meadow'), null, {}).sink;
  const mixd = groundAt('earth', { radius: 4000, slope: 0, liquidRadius: 0, biomeId: 'desert_canyon', biomeWeights: { desert_canyon: 0.5, alpine_meadow: 0.5 } }, null, {}).sink;
  assert.ok(Math.abs(mixd - (a + b) / 2) < 1e-9);
  let prev = null;
  for (let w = 0; w <= 1.0001; w += 0.02) {
    const g = groundAt('earth', { radius: 4000, slope: 0.3, liquidRadius: 0, biomeId: 'x', biomeWeights: { temperate_forest: 1 - w, sea_coast: w } }, { wetness01: 0.3, temperature: 285 }, {});
    if (prev != null) assert.ok(Math.abs(g.friction - prev) < 0.02);
    prev = g.friction;
  }
});

test('airless bodies and unknown biomes fall back to that body\'s usual ground', () => {
  assert.equal(groundAt('moon', surf('stub-lowland'), null, {}).material, 'dust');
  assert.equal(groundAt('moon', surf('something-new'), null, {}).material, 'dust');
  assert.equal(groundAt('earth', surf('something-new'), null, {}).material, 'soil');
  assert.ok(groundAt('moon', surf('mare'), null, {}).dust > 0.9, 'regolith is all loose fines');
});

test('hold angle: grass about 43 degrees, sand about its angle of repose, cold ice 30, wet ice 5', () => {
  const deg = (g) => holdAngle(g) * 180 / Math.PI;
  const grass = deg(groundAt('earth', surf('alpine_meadow'), { temperature: 285 }, {}));
  const sand = deg(groundAt('earth', surf('desert_canyon'), { temperature: 300 }, {}));
  assert.ok(grass > 40 && grass < 46, 'grass ' + grass);
  assert.ok(sand > 30 && sand < 36, 'sand ' + sand);
  assert.ok(deg({ friction: iceFriction(272.5), foothold: 0.03 }) < 6);
});

test('cover: forest has a canopy and is rough, water is smooth', () => {
  const f = coverAt('earth', surf('temperate_forest'), {}), c = coverAt('earth', surf('sea_coast', 0, 4001), {});
  assert.ok(f.canopy01 > 0.6 && f.canopyHeight > 10); assert.ok(c.z0 < 0.001 && c.canopy01 === 0);
  assert.ok(coverAt('earth', surf('desert_canyon'), {}).moist < 0.2);
  // a surface sample that carries its own canopy overrides the biome's (a glade in the forest)
  const glade = coverAt('earth', { ...surf('temperate_forest'), canopy01: 0.1, canopyHeight: 15 }, {});
  assert.ok(Math.abs(glade.canopy01 - 0.1) < 1e-9 && glade.canopyHeight === 15);
});

test('no NaN for odd inputs', () => {
  for (const s of [surf('temperate_forest', NaN), surf(undefined), { radius: 1, slope: 0 }, surf('mare', 3), surf('sea_coast', 0, 1e9)]) {
    const g = groundAt('earth', s, { wetness01: 5, snowDepth: -3, temperature: 0 }, {});
    for (const k of ['friction', 'kinetic', 'restitution', 'sink', 'drag', 'dust', 'z0']) assert.ok(Number.isFinite(g[k]) && g[k] >= 0, `${k} = ${g[k]}`);
    assert.ok(biomePhysics('earth', s.biomeId));
  }
});
