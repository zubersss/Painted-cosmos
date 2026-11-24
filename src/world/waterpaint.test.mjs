// Painted Cosmos: the water's new paint (lane W3, ?wpaint=2; docs/lead/WATER-DESIGN.md 3.4) -- what the mesher hands it.
// OWNER: PAINTER (the water group). Run: node --test src/world/waterpaint.test.mjs
// The still byte (aTurb.w): 0 without the switch, exactly as before; with it, 1 on the sea, 0 on the river's current, and
// high in the junction pond by the landing that v37 painted as a whorl.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
const { getSurface } = await import('./surface.js');
const { buildPatchData, PATCH_N } = await import('./patchgen.js');
const { dirToFace } = await import('./cubesphere.js');

const S = getSurface('earth'), R = S.R;
const P0 = [0.19461, 0.62161, 0.75877];
// a point east/north metres from a unit direction (the gallery's frame)
function off(dir, e, n) {
  const l = Math.hypot(...dir), u = dir.map((v) => v / l);
  let ex = u[2], ey = 0, ez = -u[0]; const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
  const nx = u[1] * ez - u[2] * ey, ny = u[2] * ex - u[0] * ez, nz = u[0] * ey - u[1] * ex;
  const x = u[0] + (ex * e + nx * n) / R, y = u[1] + (ey * e + ny * n) / R, z = u[2] + (ez * e + nz * n) / R, k = Math.hypot(x, y, z);
  return [x / k, y / k, z / k];
}
// the still byte of the water vertex nearest a place, from the level-7 patch it lies in (about 1.5 m between vertices)
function stillAt(d, level = 7, byte = 3) {
  const f = dirToFace(d[0], d[1], d[2], {}), span = 2 / (1 << level);
  const ix = Math.floor((f.u + 1) / span), iy = Math.floor((f.v + 1) / span);
  const P = buildPatchData(S, f.face, level, ix, iy);
  if (!P.water || !P.water.turb) return null;
  const du = span / PATCH_N, V = PATCH_N + 1;
  const i = Math.round((f.u - (-1 + ix * span)) / du), j = Math.round((f.v - (-1 + iy * span)) / du);
  return P.water.turb[(j * V + i) * 4 + byte];
}

test('with ?wpaint=0 the still byte is 0 everywhere, as before', () => {
  waterFromSearch('?look=oil&wpaint=0');
  for (const p of [[0, 100], [100, 330], [-1720, -1240]]) {
    const v = stillAt(off(P0, p[0], p[1]));
    assert.ok(v === null || v === 0, 'still ' + v + ' at ' + p);
    const o = stillAt(off(P0, p[0], p[1]), 7, 2);
    assert.ok(o === null || o === 0, 'sea byte ' + o + ' at ' + p);
  }
});

test('with ?wpaint=2: the sea still, the river running, the junction pond still', () => {
  waterFromSearch('?look=oil&wpaint=2');
  try {
    const sea = stillAt(off(P0, -1720, -1240));
    assert.equal(sea, 255, 'the sea has no current: still');
    const river = stillAt(off(P0, 30, 100));
    assert.ok(river !== null && river < 30, 'the main river by the landing keeps its current: ' + river);
    const pond = stillAt(off(P0, 100, 320));
    assert.ok(pond !== null && pond > 200, 'the junction pond (v37 painted a whorl there) is still: ' + pond);
  } finally { waterFromSearch(''); }
});

test('the default (?wpaint=1, the sea on v37): the sea is told from the river and the pond', () => {
  waterFromSearch('?look=oil');
  try {
    assert.equal(stillAt(off(P0, -1720, -1240), 7, 2), 255, 'the sea stands at the sea level');
    const river = stillAt(off(P0, 30, 100), 7, 2), pond = stillAt(off(P0, 100, 320), 7, 2);
    assert.ok(river !== null && river === 0, 'the main river by the landing is not the sea: ' + river);
    assert.ok(pond !== null && pond === 0, 'nor the junction pond: ' + pond);
    assert.ok(stillAt(off(P0, 100, 320)) > 200, 'and the pond is still still');
  } finally { waterFromSearch(''); }
});
