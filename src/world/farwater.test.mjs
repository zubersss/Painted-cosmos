// Painted Cosmos: the far view's water line (?farwater=1 with the rivers of the tree; world/patchgen.js, render/materials.js
// TERRAIN_FRAG PC_FARWATER). OWNER: PAINTER (the water group's lead). Run: node --test src/world/farwater.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
waterFromSearch('?look=oil');
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers } = await import('./rivers.js');
const { buildPatchData } = await import('./patchgen.js');
const { dirToFace } = await import('./cubesphere.js');

const S = getSurface('earth'), sp = S.getSpawn();
attachRivers(S, ensureDrainage('earth'));
const f = dirToFace(sp.x, sp.y, sp.z, {});
const patchAt = (level) => { const n = 1 << level; return buildPatchData(S, f.face, level, Math.min(n - 1, Math.floor((f.u * 0.5 + 0.5) * n)), Math.min(n - 1, Math.floor((f.v * 0.5 + 0.5) * n))); };
const unpack = (d, v) => ({ sd: (d.farw[v * 4] / 255 - 0.5) * 96, dc: d.farw[v * 4 + 1] / 255 * 48, hw: d.farw[v * 4 + 2] / 255 * 24 });

test('the switch: ?farwater=1 is a paint switch (it changes no ground); without it nothing is packed', () => {
  assert.equal(waterFromSearch('?look=oil&farwater=1').farwater, 1);
  assert.equal(waterFromSearch('?look=oil&farwater=1').on, waterFromSearch('?look=oil').on);
  waterFromSearch('?look=oil');
  assert.equal(MODE.water.farwater, 0);
  assert.equal(patchAt(3).farw, null, 'no line data without the switch');
});

test('with it, a coarse patch over the landing carries the signed distance: inside the river where the river is, and the size rules out far vertices', () => {
  waterFromSearch('?look=oil&farwater=1');
  const o = makeSample(S.nB);
  for (const level of [2, 3, 4]) {
    const d = patchAt(level);
    assert.ok(d.farw && d.farwP, 'packed at level ' + level);
    let inside = 0, insideWet = 0, far = 0;
    const nv = d.positions.length / 3;
    for (let v = 0; v < nv; v++) {
      const q = unpack(d, v);
      if (q.dc >= 47) { far++; continue; }
      if (q.hw > 0.75 && Math.abs(q.sd) < q.hw - 0.6) {
        inside++;
        // (a vertex the line says is in the river is water on the surface, but for the ground's own rounding)
        const x = d.positions[v * 3] + d.origin[0], y = d.positions[v * 3 + 1] + d.origin[1], z = d.positions[v * 3 + 2] + d.origin[2], l = Math.hypot(x, y, z);
        S.sample(x / l, y / l, z / l, o, false);
        if (o.lq !== NOLQ && o.lq > o.h - 0.5) insideWet++;
      }
    }
    assert.ok(inside > 20, 'vertices in a river at level ' + level + ': ' + inside);
    assert.ok(insideWet >= inside * 0.9, 'and they are wet: ' + insideWet + ' of ' + inside);
    assert.ok(far > 0, 'and some lie far from every river');
  }
  waterFromSearch('?look=oil');
});
