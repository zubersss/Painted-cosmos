// Painted Cosmos: mountain streams (?mount=1 with ?rivers=tree; world/mountain.js, world/rivers.js). OWNER: PAINTER (the water
// group's lead). Run: node --test src/world/mountain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
waterFromSearch('?rivers=tree&mount=1');
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers, RIVER_DEF } = await import('./rivers.js');
const { prepareMountain } = await import('./mountain.js');

const S = getSurface('earth');
const ai = S.biomes.findIndex((b) => b.terrain === 'alpine');
const before = S.lqGroup.slice();
const D = ensureDrainage('earth');
const M = prepareMountain(S);
const net = attachRivers(S, D);
const R = S.R;
const mid = (s) => { const a = s * 3, m = [0, 1, 2].map((i) => (net.sA[a + i] + net.sB[a + i]) * 0.5 / R), l = Math.hypot(...m); return m.map((v) => v / l); };
const w = new Float32Array(S.nB);
const mountainSegs = [];
for (let s = 0; s < net.nSeg; s++) { const p = mid(s); S.biomeWeights(p[0], p[1], p[2], w); if (w[ai] > 0.9) mountainSegs.push(s); }

test('the switch: ?mount=1 is a part that changes the world; the alpine meadow joins the streams\' group, the old groups kept', () => {
  assert.equal(MODE.water.mount, 1); assert.equal(MODE.water.on, true);
  assert.ok(M && M.idx.includes(ai));
  assert.equal(before[ai], -1, 'the alpine meadow carried no liquid before');
  assert.equal(S.lqGroup[ai], 0); assert.deepEqual(S._lqGroup0, before);
  assert.ok(D.share, 'the field kept the mountains\' share of each node');
});

test('streams run on the mountains, narrow, and their water never rises; a few stretches run dry over crags', () => {
  assert.ok(mountainSegs.length > 300, 'mountain segments: ' + mountainSegs.length);
  for (const s of mountainSegs) assert.ok(net.sW[s * 2] * 2 <= RIVER_DEF.mountW + 0.6, 'a torrent is narrow: ' + (net.sW[s * 2] * 2).toFixed(2) + ' m');
  // (on the mountain the level follows the slope's own height down, never rising; where a crag stands more than mountCut over
  //  it across the stream, that stretch runs dry (sM 2) and the stream comes out below at the slope's level)
  let rises = 0, wetSeg = 0, drySeg = 0;
  for (let s = 0; s < net.nSeg; s++) {
    if (net.sM[s] === 2) { drySeg++; continue; }
    if (net.sM[s] === 1) wetSeg++;
    if (net.sP[s * 2 + 1] > net.sP[s * 2] + 1e-4) rises++;
    if (s + 1 < net.nSeg && net.sR[s] === net.sR[s + 1] && net.sM[s + 1] !== 2 && net.sP[(s + 1) * 2] > net.sP[s * 2 + 1] + 1e-4) rises++;
  }
  assert.equal(rises, 0, 'the water never rises where it is drawn');
  assert.ok(drySeg < (wetSeg + drySeg) * 0.15, 'dry over crags: ' + drySeg + ' of ' + (wetSeg + drySeg) + ' mountain segments');
});

test('the alpine land keeps them: water in the gully under the snow line, white where it falls steeply, none over the snow', () => {
  const o = makeSample(S.nB), T = S.biomes[ai].t || {}, frozen = (T.snow || 190) + 30;
  let wet = 0, dry = 0, white = 0, snowy = 0, snowWet = 0;
  for (const s of mountainSegs) {
    if (net.sM[s] === 2) continue;
    const p = mid(s), lw = (net.sP[s * 2] + net.sP[s * 2 + 1]) / 2;
    S.sample(p[0], p[1], p[2], o, false);
    if (lw < frozen - 5) { if (o.lq !== NOLQ && o.lq > o.h) wet++; else dry++; if (o.turb > 0.3) white++; }
    else if (lw > frozen + 5) { snowy++; if (o.lq !== NOLQ && o.lq > o.h) snowWet++; }
  }
  assert.ok(wet > 100 && dry <= wet * 0.02, 'water in the channel: ' + wet + ' wet, ' + dry + ' dry');
  assert.ok(white > 10, 'white water on the steep stretches: ' + white);
  assert.equal(snowWet, 0, 'no water over the snow line (' + snowy + ' segments there)');
  // (Earth's streams all start under its snow line, so the rule is asked directly: the same stream under a snow line far below)
  const p = mid(mountainSegs.find((s) => net.sM[s] === 1)), c = { x: p[0], y: p[1], z: p[2], dr: null, fu: 0, fv: 0, turbW: NaN, fspdW: 0 };
  S.mount.alpine(S, c, 1000, { snow: 100 });
  assert.ok(!(c.lqA === c.lqA), 'the stream frozen over its snow line: no water');
  const c2 = { x: p[0], y: p[1], z: p[2], dr: null, fu: 0, fv: 0, turbW: NaN, fspdW: 0 };
  const h2 = S.mount.alpine(S, c2, 1000, T);
  assert.ok(c2.lqA === c2.lqA && h2 < c2.lqA, 'the same stream under its snow line: water over a bed cut down from 1000 m');
});

test('the wood is the wood: away from the mountains the ground is what ?rivers=tree alone makes it', () => {
  // (the landing stands in the wood two kilometres from the mountains: the ground and water there as without the switch)
  const sp = S.getSpawn(), o = makeSample(S.nB);
  S.sample(sp.x, sp.y, sp.z, o, true);
  assert.ok(!(o.lq !== NOLQ && o.lq > o.h - 0.3), 'the landing stays dry');
  assert.ok(o.s < 60, 'the brook still runs by it (s = ' + o.s.toFixed(1) + ')');
});
