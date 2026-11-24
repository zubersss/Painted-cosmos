// Painted Cosmos: rivers drawn from the drainage field's own flow tree (?rivers=tree; docs/lead/WATER-DESIGN.md 3.2).
// OWNER: PAINTER (the water group, lane W1). Run: node --test src/world/rivers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS); MODE.water.rivers = 1;
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers } = await import('./rivers.js');

const S = getSurface('earth');
const spawn = S.getSpawn();                      // (the landing, as the game has it before the rivers attach)
const D = ensureDrainage('earth');
const t0 = performance.now();
const net = attachRivers(S, D);
const buildMs = performance.now() - t0;

test('the field kept its flow tree for the rivers, and its levels are v34\'s', () => {
  assert.ok(D.to && D.accF && D.ordR, 'to, accF and the routing order are kept');
  assert.ok(D.lvlR, 'the routing had its own flood over the roughened base');
  for (let p = 0; p < D.g.len; p += 97) if (D.ter[p] !== 0 || D.lvl[p] !== 0) assert.ok(D.lvl[p] >= D.ter[p] - 1e-3);
});

test('a network: every reach ends in a junction, the sea, the edge of the wood or an outlet, and some reach the sea', () => {
  assert.ok(net, 'attached');
  assert.equal(S.rivers, net);
  const ends = {};
  for (const r of net.reaches) { ends[r.end] = (ends[r.end] || 0) + 1; assert.ok(['join', 'sea', 'edge', 'outlet'].includes(r.end)); }
  assert.ok((ends.join || 0) > 50, 'rivers join rivers: ' + JSON.stringify(ends));
  assert.ok(net.mouths.length > 5, 'rivers reach the coast: ' + net.mouths.length + ' mouths');
  for (const m of net.mouths) assert.ok(m.levelTop >= m.levelSea - 1e-3, 'a mouth stands over the sea');
});

test('the water never rises downstream, and the rivers widen downstream', () => {
  const { sP, sW, sR, nSeg } = net;
  let rises = 0, narrows = 0, steps = 0;
  for (let s = 0; s + 1 < nSeg; s++) {
    if (sR[s] !== sR[s + 1]) continue;
    steps++;
    if (sP[s * 2 + 1] > sP[s * 2] + 1e-4) rises++;
    if (sP[(s + 1) * 2] > sP[s * 2 + 1] + 1e-4) rises++;
  }
  assert.equal(rises, 0, 'no segment rises (of ' + steps + ')');
  // widths: along each reach the width at its last segment is at least the first's (save the thinning at a wood's edge)
  const first = new Map(), last = new Map();
  for (let s = 0; s < nSeg; s++) { if (!first.has(sR[s])) first.set(sR[s], sW[s * 2]); last.set(sR[s], sW[s * 2 + 1]); }
  for (const [r, w0] of first) if (net.reaches[r].end !== 'edge' && last.get(r) < w0 - 1e-3) narrows++;
  assert.equal(narrows, 0, 'no reach ends narrower than it starts');
});

test('a sample on a river: the water there, a current running downstream, a level that falls with it', () => {
  const o = makeSample(S.nB), R = S.R;
  // the middle of a long segment of a wide river
  let best = -1;
  for (let s = 0; s < net.nSeg; s++) if (net.sW[s * 2] > 4 && (best < 0 || net.sQ[s] > net.sQ[best])) best = s;
  assert.ok(best >= 0);
  const a = best * 3;
  const mid = [0, 1, 2].map((i) => (net.sA[a + i] + net.sB[a + i]) * 0.5 / R);
  const l = Math.hypot(...mid); for (let i = 0; i < 3; i++) mid[i] /= l;
  S.sample(mid[0], mid[1], mid[2], o, true);
  assert.ok(o.lq !== NOLQ && o.lq > o.h, 'water on the river: ground ' + o.h.toFixed(2) + ', water ' + o.lq.toFixed(2));
  assert.ok(o.fu !== 0 || o.fv !== 0, 'a current');
  // the current's direction against the segment's own (downstream), in the place's tangent axes
  const [x, y, z] = mid;
  let ux, uy, uz; if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
  const bx = net.sB[a] - net.sA[a], by = net.sB[a + 1] - net.sA[a + 1], bz = net.sB[a + 2] - net.sA[a + 2];
  const du = bx * ux + by * uy + bz * uz, dv = bx * vx + by * vy + bz * vz;
  assert.ok(o.fu * du + o.fv * dv > 0, 'the current runs downstream');
});

test('the landing stays dry, with a brook by it', () => {
  const o = makeSample(S.nB);
  S.sample(spawn.x, spawn.y, spawn.z, o, true);
  assert.ok(!(o.lq !== NOLQ && o.lq > o.h - 0.3), 'dry at the landing');
  assert.ok(o.s < 60, 'water within 60 m of the landing (s = ' + o.s.toFixed(1) + ')');
});

test('the budget: build, memory and the cost of a sample', () => {
  assert.ok(buildMs < 600, 'the network built in ' + buildMs.toFixed(0) + ' ms (here; the design budget is 150 ms with the drainage)');
  assert.ok(net.bytes() < 2.5 * 1024 * 1024, 'memory ' + (net.bytes() / 1024).toFixed(0) + ' KB');
  const o = makeSample(S.nB), R = S.R, c = [spawn.x, spawn.y, spawn.z];
  let ex = c[2], ez = -c[0]; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
  const nx = c[1] * ez, ny = c[2] * ex - c[0] * ez, nz = -c[1] * ex;
  const N = 40000, P = new Float64Array(N * 3); let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) { const e = (rnd() * 2 - 1) * 900, n = (rnd() * 2 - 1) * 900; let x = c[0] + (ex * e + nx * n) / R, y = c[1] + (ny * n) / R, z = c[2] + (ez * e + nz * n) / R; const k = Math.hypot(x, y, z); P[i * 3] = x / k; P[i * 3 + 1] = y / k; P[i * 3 + 2] = z / k; }
  for (let i = 0; i < N; i++) S.sample(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], o, false);
  const t = performance.now();
  for (let i = 0; i < N; i++) S.sample(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], o, false);
  const us = (performance.now() - t) * 1000 / N;
  assert.ok(us < 4, 'a sample in the wood ' + us.toFixed(2) + ' us');
});
