// The painted canopy stands where the trees stand (group C, the far view; world/farstand.js).
// Run: node --test src/world/
//   The ground is told, at every vertex, how many trees the placer keeps there and how many are needle trees, so the
//   roof of crowns it paints from the air lies over the real wood and its glades. That function is a COPY of the
//   placer's arithmetic (world/floraplace.js placeTrees), not a call into it. This counts the placer's own trees over
//   many cells of Earth's woods in the oil look and holds the copy's prediction to them: if the placer's density or its
//   choice of kind changes and the copy does not, this fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
const { getSurface, makeSample } = await import('./surface.js');
const { placeTrees } = await import('./floraplace.js');
const { faceToDir, dirToFace } = await import('./cubesphere.js');
const { standAt, NEEDLE, canopyOn } = await import('./farstand.js');

const LEVEL = 7, GRID = 9;      // world/obstacles.js TREE_LEVEL, TREE_GRID

function countCells(S, dir, half) {
  const f = dirToFace(dir.x, dir.y, dir.z, {}), n = 1 << LEVEL;
  const ix0 = Math.floor((f.u + 1) / 2 * n), iy0 = Math.floor((f.v + 1) / 2 * n);
  const s = makeSample(S.nB), d = [0, 0, 0], o = [0, 0];
  let real = 0, realN = 0, pred = 0, predN = 0;
  for (let iy = iy0 - half; iy <= iy0 + half; iy++) for (let ix = ix0 - half; ix <= ix0 + half; ix++) {
    const t = placeTrees(S, f.face, LEVEL, ix, iy, GRID);
    for (let i = 0; i < t.count; i++) {
      real++;
      if (NEEDLE.has(S.look.flora.tall[t.data[i * 12 + 5]].kit)) realN++;
    }
    // the copy's expectation over the cell: two candidates on each of GRID x GRID jittered points, each kept at 0.62 x stand
    const span = 2 / n, u0 = -1 + ix * span, v0 = -1 + iy * span, K = 12;
    let sum = 0, sumN = 0;
    for (let b = 0; b < K; b++) for (let a = 0; a < K; a++) {
      faceToDir(f.face, u0 + span * (a + 0.5) / K, v0 + span * (b + 0.5) / K, d);
      S.sample(d[0], d[1], d[2], s, true);
      standAt(S, d[0], d[1], d[2], s, o);
      sum += o[0]; sumN += o[0] * o[1];
    }
    pred += 0.62 * 2 * GRID * GRID * sum / (K * K);
    predN += 0.62 * 2 * GRID * GRID * sumN / (K * K);
  }
  return { real, realN, pred, predN };
}

test('the canopy is on for Earth in the oil look only', () => {
  assert.equal(canopyOn('earth'), true);
  assert.equal(canopyOn('neptune'), false);
});

test("the stand predicts the placer's own trees in the autumn wood, the green wood and the mountain", () => {
  const S = getSurface('earth');
  // the first site of each wooded place of Earth (surface.js _buildSites: unit directions with a biome index)
  const dirs = [];
  for (const id of ['autumn_woodland', 'temperate_forest', 'alpine_meadow']) {
    const bi = S.biomes.findIndex((b) => b.id === id);
    const site = S.sites.find((x) => x.b === bi);
    if (site) dirs.push(site);
  }
  assert.ok(dirs.length >= 2, 'the wooded places have sites');
  let real = 0, realN = 0, pred = 0, predN = 0;
  for (const dir of dirs) {
    const c = countCells(S, dir, 3);
    real += c.real; realN += c.realN; pred += c.pred; predN += c.predN;
  }
  assert.ok(real > 2000, `enough trees to judge by (${real})`);
  const ratio = pred / real;
  assert.ok(Math.abs(ratio - 1) < 0.08, `predicted ${pred.toFixed(0)} trees against the placer's ${real} (ratio ${ratio.toFixed(3)})`);
  const shareReal = realN / real, sharePred = predN / pred;
  assert.ok(Math.abs(shareReal - sharePred) < 0.05, `needle share predicted ${sharePred.toFixed(3)} against the placer's ${shareReal.toFixed(3)}`);
});
