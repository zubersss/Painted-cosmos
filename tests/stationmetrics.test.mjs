// The station harness's measures (tests/stationlib/metrics.mjs) and its files (png.mjs, stations.mjs).
// The reference numbers below are the sharpness audit's own metrics.py (numpy) on the same synthetic
// frame set, run once on 2026-11-14 (the port is number for number; on the audit's real frames of
// E_150_45 the largest difference over 144 numbers was 6e-5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPng, writePng } from './stationlib/png.mjs';
import * as MX from './stationlib/metrics.mjs';
import { STATIONS, SETS, pick, EXPERIMENTS } from './stationlib/stations.mjs';

// a deterministic frame set: v1 the "raw scene", v0 a toned, softer "final", v4 regions, v3 depth
function synth(W = 160, H = 120) {
  const v0 = new Uint8Array(W * H * 3), v1 = new Uint8Array(W * H * 3), v4 = new Uint8Array(W * H * 3), v3 = new Uint8Array(W * H * 3);
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const base = 0.5 + 0.25 * Math.sin(x * 0.21) * Math.cos(y * 0.17) + 0.12 * Math.sin((x + 2 * y) * 0.9);
    const n = hash(x, y) - 0.5;
    const raw = Math.max(0, Math.min(1, base + 0.15 * n));
    const fin = Math.max(0, Math.min(1, 0.8 * base + 0.1 + 0.04 * n));
    v1[i] = Math.round(raw * 255); v1[i + 1] = Math.round(raw * 230); v1[i + 2] = Math.round(raw * 200);
    v0[i] = Math.round(fin * 250); v0[i + 1] = Math.round(fin * 240); v0[i + 2] = Math.round(fin * 210);
    const cls = x < 20 && y < 30 ? 0 : (x > 120 ? 4 : 1);
    v4[i] = 0; v4[i + 1] = Math.round((cls / 6) * 255); v4[i + 2] = 128;
    const d = 5 + x * 6; v3[i] = 128; v3[i + 1] = 128; v3[i + 2] = Math.round((Math.log2(1 + d) / 20) * 255);
  }
  return { W, H, v0, v1, v3, v4 };
}
// top-down RGB -> RGBA bottom-up, as gl.readPixels gives it
function asRead(rgb, W, H) {
  const o = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (y * W + x) * 3, d = ((H - 1 - y) * W + x) * 4; o[d] = rgb[s]; o[d + 1] = rgb[s + 1]; o[d + 2] = rgb[s + 2]; o[d + 3] = 255; }
  return o;
}
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tolerance ${tol})`);

test('png: what the writer writes the reader reads back, byte for byte', () => {
  const W = 37, H = 11, px = new Uint8Array(W * H * 3).map((_, i) => (i * 37 + (i >> 3)) & 255);
  const back = readPng(writePng(px, W, H, 3));
  assert.equal(back.width, W); assert.equal(back.height, H);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) assert.equal(back.rgba[i * 4 + c], px[i * 3 + c]);
});

test('metrics: the port gives metrics.py\'s numbers on the synthetic set (from read-back bytes, rows flipped)', () => {
  const s = synth(), { W, H } = s;
  const rd = { 0: asRead(s.v0, W, H), 1: asRead(s.v1, W, H), 3: asRead(s.v3, W, H), 4: asRead(s.v4, W, H) };
  const { out } = MX.measure({ W, H, views: { final: MX.lumaOf(rd[0], W, H), raw: MX.lumaOf(rd[1], W, H) }, cls: MX.classesOf(rd[4], W, H), dep: MX.depthOf(rd[3], W, H), rgb: { final: MX.rgbOf(rd[0], W, H), raw: MX.rgbOf(rd[1], W, H) } });
  // metrics.py, same frames:
  assert.deepEqual([out.share.land, out.share.ground, out.share.foliage, out.share.props], [0.761, 0.577, 0.157, 0]);
  assert.deepEqual([out.share.ground_30_150, out.share.ground_150_600, out.share.ground_600_inf], [0.073, 0.401, 0.103]);
  const fl = out.final.land;
  assert.equal(fl.n, 14607);
  near(fl.lapvar, 444.70999, 1e-3, 'final land lapvar'); near(fl.b1, 33.07525, 1e-3, 'b1'); near(fl.b2, 32.82973, 1e-3, 'b2'); near(fl.b3, 49.37371, 1e-3, 'b3');
  near(fl.t1, 0.74324, 1e-4, 't1'); near(fl.t2, 0.80829, 1e-4, 't2'); near(fl.t3, 0.81670, 1e-4, 't3');
  const rg = out.raw.ground;
  assert.equal(rg.n, 11071);
  near(rg.lapvar, 953.73853, 1e-3, 'raw ground lapvar'); near(rg.b3, 61.28035, 1e-3, 'raw ground b3'); assert.equal(rg.t1, 1);
  near(out.final.ground_30_150.t2, 0.81830, 1e-4, 'final ground 30-150 t2'); near(out.final.foliage.b2, 33.22726, 1e-3, 'final foliage b2');
});

test('metrics: transfer is 1 for the raw scene itself, low in the fine band for a blur, and blind to a tone change', () => {
  const s = synth(), { W, H } = s;
  const raw = MX.lumaOf(asRead(s.v1, W, H), W, H), m = MX.frameMask(W, H);
  const rb = MX.bands(raw, W, H);
  const same = MX.stats(raw, W, H, rb, m);
  assert.equal(same.t1, 1); assert.equal(same.t2, 1);
  const soft = MX.blur(raw, W, H, 2.0), b = MX.stats(soft, W, H, rb, m);
  assert.ok(b.t1 < 0.15 && b.t3 > 0.6, `a 2 px blur: t1 ${b.t1}, t3 ${b.t3}`);
  const toned = raw.map((v) => 0.5 * v + 0.2), t = MX.stats(toned, W, H, rb, m);
  near(t.t1, 0.5, 1e-4, 'half the contrast');
});

test('metrics: the aliasing index is about 0 for a box-filtered supersampled frame and high for a point-sampled one', () => {
  const W = 128, H = 96, f = (x, y) => 0.5 + 0.4 * Math.sin(x * 4.0 + y * 0.7);   // 1.6 px a wave: past the 1x frame's limit
  const ref2 = new Float32Array(4 * W * H);
  for (let y = 0; y < 2 * H; y++) for (let x = 0; x < 2 * W; x++) {
    let s = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s += f((x + (i + 0.5) / 4) / 2, (y + (j + 0.5) / 4) / 2);
    ref2[y * 2 * W + x] = s / 16;
  }
  const ref = MX.boxDown(ref2, 2 * W, 2 * H), m = MX.frameMask(W, H);
  const point = new Float32Array(W * H).map((_, i) => f((i % W) + 0.5, Math.floor(i / W) + 0.5));
  const filtered = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) s += f(x + (i + 0.5) / 8, y + (j + 0.5) / 8); filtered[y * W + x] = s / 64; }
  const aP = MX.aliasIndex(point, ref, W, H, m), aF = MX.aliasIndex(filtered, ref, W, H, m);
  assert.ok(aF < 0.1, `box-filtered: A ${aF}`);
  assert.ok(aP > 0.5, `point-sampled: A ${aP}`);
});

test('metrics: the flicker index is about 0 for a smooth picture panned 0.25 px and high for an aliased one', () => {
  const W = 128, H = 64, m = MX.frameMask(W, H);
  const render = (f, dx) => new Float32Array(W * H).map((_, i) => f((i % W) + 0.5 + dx, Math.floor(i / W) + 0.5));
  const smooth = (x, y) => 0.5 + 0.3 * Math.sin(x * 0.9) * Math.cos(y * 0.5);        // 7 px waves, well sampled
  const sharp = (x, y) => (Math.sin(x * 2.9 + y * 0.31) > 0 ? 0.8 : 0.2);           // hard stripes of 2.2 px: stair-steps
  const fS = MX.flickerIndex(render(smooth, 0), render(smooth, 0.25), W, H, m, 0.25);
  const fA = MX.flickerIndex(render(sharp, 0), render(sharp, 0.25), W, H, m, 0.25);
  const wrong = MX.flickerIndex(render(smooth, 0), render(smooth, 0.25), W, H, m, -0.25);
  assert.ok(fS < 0.08, `smooth: F ${fS}`);
  assert.ok(fA > 0.5, `aliased stripes: F ${fA}`);
  assert.ok(wrong > 3 * fS, `the pan's sign matters: ${wrong} vs ${fS}`);
});

test('metrics: the halo share counts overshoot past the raw 3x3 range, not a blur or a tone change', () => {
  const W = 96, H = 64, m = MX.frameMask(W, H);
  const raw = new Float32Array(W * H).map((_, i) => ((i % W) % 16 < 8 ? 0.3 : 0.7));   // bars 8 px wide
  const toned = raw.map((v) => 0.6 * v + 0.25);
  const soft = MX.blur(raw, W, H, 0.8);
  const rim = raw.map((v, i) => { const x = i % W, e = x % 8; return v + (e === 0 ? (v > 0.5 ? 0.12 : -0.12) : 0); });   // sharpening rims at each edge
  assert.equal(MX.haloShare(toned, raw, W, H, m).share, 0);
  assert.ok(MX.haloShare(soft, raw, W, H, m).share < 0.01, 'a slight blur stays inside the range');
  assert.ok(MX.haloShare(rim, raw, W, H, m).share > 0.1, 'rims overshoot');
});

test('metrics: CIELAB of white, black and sRGB red; the border strip', () => {
  const w = MX.lab(255, 255, 255), k = MX.lab(0, 0, 0), r = MX.lab(255, 0, 0);
  near(w[0], 100, 0.01, 'L* of white'); near(Math.hypot(w[1], w[2]), 0, 0.05, 'white is neutral');
  near(k[0], 0, 0.01, 'L* of black');
  near(r[0], 53.24, 0.05, 'L* of red'); near(r[1], 80.09, 0.1, 'a* of red'); near(r[2], 67.20, 0.1, 'b* of red');
  const W = 40, H = 40, rgb = new Uint8Array(W * H * 3).fill(100);
  assert.deepEqual(MX.borderStrip(rgb, W, H), [100, 100, 100]);
  const rgb2 = rgb.slice(); rgb2.fill(110, 0, W * 3);   // the top row brighter
  assert.ok(MX.stripDiff(rgb, rgb2, W, H) > 0);
});

test('stations: the audit\'s twenty in its order, the plan\'s additions, the sets, the experiments', () => {
  assert.deepEqual(SETS.audit, ['E_foot', 'E_50_45', 'E_50_90', 'E_150_45', 'E_150_90', 'E_400_45', 'E_400_90', 'E_1000_45', 'E_1000_90',
    'M_foot', 'M_50_45', 'M_50_90', 'M_150_45', 'M_150_90', 'M_400_45', 'M_400_90', 'M_1000_45', 'M_1000_90', 'S_150_45', 'S_150_90']);
  for (const n of ['E_foot_night', 'E_150_45_dusk', 'E_150_45_storm', 'N_150_45']) assert.ok(STATIONS.some((s) => s.name === n), n);
  assert.deepEqual(SETS.quick, ['E_foot', 'E_150_45', 'E_1000_45']);
  assert.deepEqual(pick('E_1000_45,E_foot').map((s) => s.name), ['E_foot', 'E_1000_45'], 'list order kept');
  const e = STATIONS.find((s) => s.name === 'E_150_45');
  assert.deepEqual([e.body, e.where, e.alt, e.pitch, e.heading], ['earth', 'spawn', 150, 45, 0]);
  const mf = STATIONS.find((s) => s.name === 'M_foot');
  assert.deepEqual([mf.where, mf.foot, mf.heading], ['rust_canyons', true, 250]);
  assert.ok(EXPERIMENTS['x26_keepfar1_wobble0.3'].patches[0][0].includes('float keep = (1.0 - far)'));
});
