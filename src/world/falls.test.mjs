// Painted Cosmos: the waterfalls' shapes (?falls=1; docs/lead/WATER-DESIGN.md 3.5; lane W2). OWNER: PAINTER (the water group).
// Run: node --test src/world/falls.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { MODE, overlayOil, waterFromSearch } = await import('../data/mode.js');
const { LOOKS } = await import('../data/looks.js');
// (the falls first: render/shared.js, which the falls' material reaches, sets MODE.oil from the page's address when it loads)
const WH = await import('./waterhooks.js');
const FL = await import('./falls.js');
MODE.oil = true; overlayOil(LOOKS);
waterFromSearch('?rivers=tree&falls=1');
const { getSurface } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers } = await import('./rivers.js');
const { attachHydro } = await import('./hydro.js');

const S = getSurface('earth');
S.getSpawn();
const D = ensureDrainage('earth');
const net = attachRivers(S, D);
const hy = attachHydro(S, D, net);
const R = S.R;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('the layer registers itself with the water\'s frame and the speed test', () => {
  assert.ok(WH.WATER_PARTS.some((p) => p.name === 'falls'));
  const row = WH.WATER_BENCH.find((r) => r.name === 'no falls');
  assert.ok(row && typeof row.on === 'function' && typeof row.off === 'function');
  row.on(); assert.equal(FL.FALLS.on, false); row.off(); assert.equal(FL.FALLS.on, true);
});

test('a jet leaves the lip at the river\'s level and lands at the foot, clear of the wall', () => {
  assert.ok(hy && hy.falls.length >= 3, 'falls on Earth');
  for (const f of hy.falls) {
    const F = FL.fallFrame(f, R), q = [0, 0, 0];
    // the top edge at the lip's level, the foot at the foot's
    for (const u of [-1, 0, 1]) {
      FL.fallAt(F, 0, u, q);
      assert.ok(Math.abs(dot(q, F.up) - (R + f.top)) < 0.05, 'the sheet starts at the water\'s level');
      FL.fallAt(F, F.T, u, q);
      assert.ok(Math.abs(dot(q, F.up) - (R + f.foot)) < 0.2, 'and reaches the foot: ' + (dot(q, F.up) - R - f.foot).toFixed(2));
    }
    // it falls in a parabola and never back toward the cliff (the way out from the lip only grows)
    let prev = -Infinity;
    for (let k = 0; k <= 10; k++) { FL.fallAt(F, F.T * k / 10, 0, q); const out = dot([q[0] - F.lipP[0], q[1] - F.lipP[1], q[2] - F.lipP[2]], F.dir); assert.ok(out >= prev - 1e-9); prev = out; }
    assert.ok(prev > 0.15 + 0.9 * f.speed * F.T, 'clear of the wall by the speed times the time it falls');
    // the drop is real: g t^2 / 2 over the time of flight
    assert.ok(Math.abs(0.5 * 9.81 * F.T * F.T - F.drop) < 1e-6);
  }
});

test('the meshes: a few hundred triangles a fall near, fewer far; the pool at the foot; dabs by detail', () => {
  const f = hy.falls.reduce((a, b) => (b.width > a.width ? b : a));
  const F = FL.fallFrame(f, R), org = F.lipP;
  let prevT = Infinity, prevD = Infinity;
  for (const lod of [2, 1, 0]) {
    const a = FL.sheetArrays([{ f, lod, id: 0 }], R, org), s = FL.sprayArrays([{ f, lod }], R, org);
    const tris = a.I.length / 3;
    assert.ok(tris < 1100, 'triangles at detail ' + lod + ': ' + tris);
    assert.ok(tris < prevT && s.n < prevD, 'fewer far off');
    prevT = tris; prevD = s.n;
    for (let i = 0; i < a.I.length; i++) assert.ok(a.I[i] < a.P.length / 3);
    // every pool vertex lies at the foot's level (plus its lift)
    for (let v = 0; v < a.AF.length / 4; v++) if (a.AF[v * 4 + 3] === 1) {
      const p = [a.P[v * 3] + org[0], a.P[v * 3 + 1] + org[1], a.P[v * 3 + 2] + org[2]];
      assert.ok(Math.abs(dot(p, F.up) - (R + f.foot + FL.FALLS_DEF.lift)) < 0.3, 'the pool lies on the sea');
    }
  }
  assert.ok(FL.sprayArrays([{ f, lod: 2 }], R, org).n <= 300, 'at most 300 dabs a fall');
});

test('the lip follows the coast\'s wall across the cut', () => {
  for (const f of hy.falls) if (f.edgeU) {
    const F = FL.fallFrame(f, R);
    assert.equal(FL.edgeAt(F, 0), f.edgeT[4]);
    for (const u of [-1, -0.3, 0.5, 1]) assert.ok(Math.abs(FL.edgeAt(F, u)) <= 6, 'within six metres of the centre\'s lip');
  }
});
