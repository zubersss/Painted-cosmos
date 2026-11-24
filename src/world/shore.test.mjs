// Painted Cosmos: the shore's direction for the sea's strokes (world/shore.js; lane W2). Run: node --test src/world/shore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS); waterFromSearch('?look=oil&wpaint=1');
const SURF = await import('./surface.js');
const SH = await import('./shore.js');
const S = SURF.getSurface('earth'), R = S.R, st = SURF.makeSample(S.nB);
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const wet = (p) => { S.sample(p[0], p[1], p[2], st, false); return st.lq !== SURF.NOLQ && st.lq > st.h; };
// the strait south of the falls (the falls view's sea): water at the sea's level with land a few hundred metres off
const P0 = unit([-0.0219, 0.2275, 0.9735]);

test('shore: near land the field points toward it, its length the nearness (0..1)', () => {
  const F = new SH.ShoreField(S), o = {};
  F.at(...P0, o);
  assert.ok(wet(P0), 'the test point is sea');
  assert.ok(o.w > 0.3 && o.w <= 1 + 1e-9, 'near land: w ' + o.w.toFixed(2));
  // the falls' strait is narrow: land within a few hundred metres both ways across
  assert.ok(o.width > 100 && o.width < 1000, 'the strait is narrow: ' + o.width.toFixed(0) + ' m');
  // a few hundred metres along the way it points there is land
  const [ux, uy, uz, vx, vy, vz] = SH.frameOf(...P0), lx = o.lx / o.w, ly = o.ly / o.w;
  let found = false;
  for (let m = 50; m <= 600 && !found; m += 25) {
    const q = unit([P0[0] + (ux * lx + vx * ly) * m / R, P0[1] + (uy * lx + vy * ly) * m / R, P0[2] + (uz * lx + vz * ly) * m / R]);
    if (!wet(q)) found = true;
  }
  assert.ok(found, 'land lies the way the field points');
});

test('shore: the field is continuous (read between nodes, the same from any patch) and costs a node once', () => {
  const F = new SH.ShoreField(S), a = {}, b = {};
  let worst = 0;
  for (let k = 0; k < 200; k++) {
    const p = unit([P0[0] + (k - 100) * 2 / R, P0[1] + (k % 7 - 3) * 2 / R, P0[2]]), q = unit([p[0] + 1 / R, p[1], p[2]]);
    F.at(...p, a); F.at(...q, b);
    worst = Math.max(worst, Math.hypot(a.lx - b.lx, a.ly - b.ly));
  }
  assert.ok(worst < 0.03, 'one metre apart the field moves at most ' + worst.toFixed(4));
  const n = F.nodes, s = F.samples;
  F.at(...P0, a);
  assert.equal(F.nodes, n, 'a node is measured once'); assert.equal(F.samples, s);
});

test('shore: none on land, over deep water or on water above the sea (a lake, a pond)', () => {
  const F = new SH.ShoreField(S);
  // the node measure itself: land
  let land = null;
  for (let k = 0; k < 400 && !land; k++) { const p = unit([P0[0] + k * 3 / R, P0[1] + k * 3 / R, P0[2]]); if (!wet(p)) land = p; }
  assert.ok(land, 'land found near the strait');
  assert.deepEqual([...F._measure(...land)].slice(0, 2), [0, 0], 'no shore field on land');
  // a lake or pond (water standing above the sea's level), if one is found near the landing
  const g = S.getSpawn(); let lake = null;
  for (let k = 0; k < 3000 && !lake; k++) {
    const p = unit([g.x + ((k * 37) % 101 - 50) * 8 / R, g.y + ((k * 53) % 97 - 48) * 8 / R, g.z]);
    S.sample(p[0], p[1], p[2], st, false);
    if (st.lq !== SURF.NOLQ && st.lq > st.h && st.lq > 0.5) lake = p;
  }
  if (lake) assert.deepEqual([...F._measure(...lake)].slice(0, 2), [0, 0], 'no shore field on water above the sea');
});

test('shore: the paint decodes the crossing at the field\'s own scale', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../render/materials.js', import.meta.url), 'utf8');
  assert.ok(src.includes('vShore.z * ' + SH.SHORE_DEF.open + '.0'), 'materials.js reads the width byte as SHORE_DEF.open metres');
});
