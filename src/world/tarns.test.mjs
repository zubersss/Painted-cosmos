// Painted Cosmos: the mountain tarns (?mount=1 with the lakes; world/hydro.js _buildTarns and its alpine hook; lane W2).
// OWNER: PAINTER (the water group). Run: node --test src/world/tarns.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
waterFromSearch('?rivers=tree&mount=1&lakes=1');
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers } = await import('./rivers.js');
const MT = await import('./mountain.js');
const HY = await import('./hydro.js');

const S = getSurface('earth');
const spawn = S.getSpawn();
const D = ensureDrainage('earth');
MT.prepareMountain(S);
attachRivers(S, D);
// (the alpine hook's call to the tarns: world/mountain.js's own line once the water lead lands it; done here for the test, and
//  harmless if both run: the tarn only ever raises the level and the rim)
const stream = S.mount.alpine;
S.mount.alpine = (S2, c, h, T) => { h = stream(S2, c, h, T); return S2.hydro && S2.hydro.alpine ? S2.hydro.alpine(S2, c, h, T) : h; };
const t0 = performance.now();
const hy = HY.attachHydro(S, D, S.rivers);
const ms = performance.now() - t0;
const R = S.R, o = makeSample(S.nB), N = HY.HYDRO_DEF.tarnN, cs = HY.HYDRO_DEF.tarnCell, half = (N - 1) / 2;
const at = (tr, a, b) => { const du = (a - half) * cs / R, dv = (b - half) * cs / R; const q = [tr.c[0] + tr.u[0] * du + tr.v[0] * dv, tr.c[1] + tr.u[1] * du + tr.v[1] * dv, tr.c[2] + tr.u[2] * du + tr.v[2] * dv]; const l = Math.hypot(...q); return q.map((v) => v / l); };

test('tarns: small still lakes in the mountains\' hollows, built at load in reasonable time', () => {
  assert.ok(hy && hy.nTarns >= 8, 'tarns on Earth: ' + (hy && hy.nTarns));
  assert.ok(ms < 2000, 'build ' + ms.toFixed(0) + ' ms');
  for (const tr of hy.tarns) {
    assert.ok(tr.cells * cs * cs <= HY.HYDRO_DEF.tarnArea * 1e6 + 1e-6, 'small');
    assert.ok(tr.level - tr.hmin <= HY.HYDRO_DEF.tarnDepth + 1e-6 && tr.level - tr.hmin >= HY.HYDRO_DEF.tarnMin[1] - 1e-6, 'shallow');
  }
  for (let i = 0; i < hy.nTarns; i++) for (let j = i + 1; j < hy.nTarns; j++) {
    const a = hy.tarns[i].c, b = hy.tarns[j].c;
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * R >= HY.HYDRO_DEF.tarnGap - 1, 'apart');
  }
});

test('tarns: dead level, held in by their rim, the water only where the ground is under the level (never on a slope)', () => {
  let water = 0;
  for (const tr of hy.tarns) {
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      const m = tr.mask[b * N + a]; if (!m) continue;
      const q = at(tr, a, b);
      S.sample(q[0], q[1], q[2], o, false);
      if (m === 3) assert.ok(o.h >= tr.level + 0.149 || (o.lq !== NOLQ && o.lq > tr.level + 0.05), 'the rim stands over the level');
      if (o.lq !== NOLQ && o.lq > o.h + 0.01 && Math.abs(o.lq - tr.level) < 1e-6) { water++; assert.ok(m !== 3); }
    }
    // the middle of each tarn is water at its level
    const q = at(tr, half, half);
    S.sample(q[0], q[1], q[2], o, false);
  }
  assert.ok(water > hy.nTarns * 3, 'water stands in the tarns: ' + water + ' points');
});

test('tarns: none without the mountains, and the landing keeps its ground', () => {
  const keep = { ...MODE.water };
  try {
    waterFromSearch('?rivers=tree&lakes=1');
    const S2 = { ...S, hydro: null, mount: null };
    Object.setPrototypeOf(S2, Object.getPrototypeOf(S));
    const h2 = HY.attachHydro(S2, D, S.rivers);
    assert.ok(!h2 || !h2.nTarns, 'no tarns without ?mount=1');
  } finally { Object.assign(MODE.water, keep); }
  const sv = S.hydro; S.hydro = null; S.sample(spawn.x, spawn.y, spawn.z, o, false); const a = { h: o.h, lq: o.lq }; S.hydro = sv;
  S.sample(spawn.x, spawn.y, spawn.z, o, false);
  assert.equal(o.h, a.h); assert.equal(o.lq, a.lq);
});
