// R1 re-fix of W2.4 (docs/lead/SHARP-SMOOTH-PLAN.md, PAINTER W2 item 4: the sheet's reads, 17 to at most 11, with the
// same picture). The sheet now reads its pencil line from EDGE_FRAG's four precomputed ways and its paper from three
// targets laid once per size (post.js). Run: node --test src/world/
//   - the line picked from the four ways is the line the sheet's own reads 1.5 texels over gave, at any point
//   - the paper's targets carry every value to within what the picture can show
import test from 'node:test';
import assert from 'node:assert/strict';

// a seeded random
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const step = (e, x) => (x < e ? 0 : 1);
// EDGE_FRAG's pcLine (and the old sheet's line before its paper factor), on aux = [nx, ny, z, w]
function pcLine(a0, a1, a2) {
  const dz = Math.max(Math.abs(a1[2] - a0[2]), Math.abs(a2[2] - a0[2]));
  let c0 = Math.floor(a0[3]), c1 = Math.floor(a1[3]), c2 = Math.floor(a2[3]);
  const sol = (c) => step(2.5, c) * step(c, 3.5) + step(4.5, c) * step(c, 5.5);
  const solid = Math.max(sol(c0), Math.max(sol(c1), sol(c2)));
  c0 = Math.min(c0, 5); c1 = Math.min(c1, 5); c2 = Math.min(c2, 5);
  const idc = Math.max(Math.abs(c1 - c0), Math.abs(c2 - c0)) * Math.min(solid, 1);
  const f = (a) => step(3.5, a[3]) * step(a[3], 4.99);
  const fol = Math.max(f(a0), Math.max(f(a1), f(a2)));
  let line = Math.max(sm(0.14, 0.38, dz) * 0.6, Math.min(idc, 1) * 0.38) * (1 - fol * 0.85);
  line *= 1 - Math.max(step(5.5, a0[3]), Math.max(step(5.5, a1[3]), step(5.5, a2[3])));
  return line * (1 - sm(6.5, 9.5, a0[2]));
}

test('the pencil line picked from the four precomputed ways is the line read 1.5 texels over', () => {
  const R = rnd(7), W = 64, H = 40;
  // a region target with steps in depth and class: blocks of surfaces at random depths, some solid, some foliage, sky
  const aux = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bx = Math.floor(x / (3 + (y % 5))), by = Math.floor(y / 4), h = Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453;
    const k = h - Math.floor(h);
    const cls = k < 0.1 ? 0 : k < 0.4 ? 1 : k < 0.55 ? 3 : k < 0.8 ? 4 : k < 0.9 ? 5 : 6;
    aux.push([0, 0, cls === 0 ? 20 : 2 + k * 9 + R() * 0.2, cls + R() * 0.9]);
  }
  const at = (ix, iy) => aux[Math.min(H - 1, Math.max(0, iy)) * W + Math.min(W - 1, Math.max(0, ix))];
  // EDGE_FRAG at every texel: the four ways (x +1 or +2, y +1 or +2)
  const ways = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a0 = at(x, y), x1 = at(x + 1, y), x2 = at(x + 2, y), y1 = at(x, y + 1), y2 = at(x, y + 2);
    ways.push([pcLine(a0, x1, y1), pcLine(a0, x2, y1), pcLine(a0, x1, y2), pcLine(a0, x2, y2)]);
  }
  let n = 0, worst = 0;
  for (let i = 0; i < 20000; i++) {
    // a read point inside the picture (the sheet's guv in texels; the pencil's offset and tremor put it anywhere)
    const gx = 0.01 + R() * (W - 3.02), gy = 0.01 + R() * (H - 3.02);
    // the old sheet: three nearest reads (index = floor(u * size), clamped)
    const old = pcLine(at(Math.floor(gx), Math.floor(gy)), at(Math.floor(gx + 1.5), Math.floor(gy)), at(Math.floor(gx), Math.floor(gy + 1.5)));
    // the new sheet: the texel the point lies in, the way picked by the halves it lies in
    const L = ways[Math.floor(gy) * W + Math.floor(gx)], fx = step(0.5, gx - Math.floor(gx)), fy = step(0.5, gy - Math.floor(gy));
    const nw = (L[0] * (1 - fx) + L[1] * fx) * (1 - fy) + (L[2] * (1 - fx) + L[3] * fx) * fy;
    worst = Math.max(worst, Math.abs(nw - old));
    if (old > 0) n++;
  }
  assert.ok(n > 1000, 'lines met: ' + n);
  assert.ok(worst < 1e-12, 'largest difference ' + worst);
});

// PAPERS_FRAG's targets: the values as a half float (or a byte) holds them, mirrored
function half(x) {   // round to the nearest IEEE half (normal range)
  if (x === 0) return 0;
  const e = Math.floor(Math.log2(Math.abs(x))), ulp = Math.pow(2, e - 10);
  return Math.round(x / ulp) * ulp;
}
const u8 = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255) / 255;
test('the paper\'s targets carry each value to within what the picture can show', () => {
  const R = rnd(11), rag = 0.034;
  const e = { w0: 0, b: 0, v8: 0 };
  for (let i = 0; i < 20000; i++) {
    // the values' own ranges (post.js PAPER_LIVE / PAPER_STATIC / PAPER_TERMS with the paper texture's 0..1 reads)
    const w0 = (R() - 0.5) * 2 + (R() - 0.5) * 1.2;
    const ploG = R(), pmidG = R(), pg = R(), psg = R();
    const b0 = (ploG - 0.5) * rag + (pmidG - 0.5) * rag * 0.45 + (pg - 0.5) * 0.006;
    const bD = psg * rag * 0.45 - (pg - 0.5) * 0.006 - pmidG * rag * 0.45;
    const v = R();
    e.w0 = Math.max(e.w0, Math.abs(half(w0) - w0)); e.b = Math.max(e.b, Math.abs(half(b0) - b0), Math.abs(half(bD) - bD)); e.v8 = Math.max(e.v8, Math.abs(u8(v) - v));
  }
  // the tremor: 2.6 px at 1080p times w0's error: about a thousandth of a pixel (it moves an unfiltered read of the region
  // target only where the read point lies that close to a texel's edge)
  assert.ok(e.w0 * 2.6 < 0.0014, 'tremor error ' + e.w0 * 2.6 + ' px');
  // the border's terms go through its step (0.72 to 1 of 0.03, steepest 1.5 / 0.0084 a unit): under a 255th of the wash
  assert.ok(e.b * 1.5 / 0.0084 < 1 / 255, 'border error ' + e.b * 1.5 / 0.0084);
  assert.ok(e.v8 <= 0.5 / 255 + 1e-9, '8-bit values within half a step');
});
