// R2 W7.2 (docs/lead/SHARP-SMOOTH-PLAN.md, PAINTER W7 item 2): an interpolating enlargement where the scene is drawn
// smaller than the sheet. Run: node --test src/world/
// The sheet (render/post.js SHEET_FRAG) read the picture through a cubic B-spline at a place the paper shook by half a
// pixel of the scene (PAINTER 19's soft enlargement): an average, not an interpolation, so every enlargement blurred.
// Now Catmull-Rom (five bilinear taps), held inside the range of the taps round it, then RCAS from four reads a texel
// each way; at full size one tap, as before. The shader's enlargement is mirrored here and run on made pictures (step
// edges at every angle, one-pixel lines, a fine texture) drawn at 0.75, 0.62 and 0.5 of the sheet's size:
//   - at full size the sheet gives the picture back exactly (one bilinear tap at the pixel's centre);
//   - Catmull-Rom alone gives every texel back where the sheet's pixel lies on a texel's centre (interpolating);
//   - the 2-6 px band of the enlarged picture against the same picture enlarged by a plain bilinear lookup (the harness's
//     "own raw"): at least 1.0 with Catmull-Rom and RCAS, where the B-spline kept 0.6 to 0.8 of it;
//   - against the picture drawn at the sheet's own size: the new enlargement keeps at least 0.8 of its finest band
//     at 0.75 (the plan's acceptance, measured in the game on the land at E_foot and E_150_45);
//   - no halo: a pixel overshooting the range of the scene's texels round it by more than 8/255 on at most 0.5 % of the
//     picture (the plan's halo share); none at all from the Catmull-Rom step (the clamp), what there is is RCAS's.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as MX from '../../tests/stationlib/metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);
// (the module itself, so that a shader that breaks its template string fails here)
const { RCAS } = await import('../render/post.js');
const post = fs.readFileSync(path.join(here, '../render/post.js'), 'utf8');
const sheet = (post.match(/const SHEET_FRAG = \/\* glsl \*\/`([\s\S]*?)`;\n/) || [])[1] || '';

test('the sheet enlarges with Catmull-Rom and RCAS, and only where the picture is enlarged', () => {
  assert.ok(sheet.length > 1000, 'post.js has SHEET_FRAG');
  assert.doesNotMatch(sheet, /pcCubic|shake/, 'the B-spline and its shake are gone');
  assert.match(sheet, /vec4 pcEnlarge\(sampler2D t, vec2 uv, vec2 tx, float sharp\)/);
  assert.match(sheet, /vec4 c = up > 1\.0005 \? pcEnlarge\(tAbs, uv, uInTexel, uRcas \* smoothstep\(1\.0, 1\.12, up\)\) : texture\(tAbs, uv\);/,
    'at full size the picture is read with one tap');
  assert.equal(RCAS, 0.5, "RCAS at the plan's 0.5");
  // the mirrored arithmetic below is the shader's: its weights and RCAS's limit
  assert.match(sheet, /vec2 w0 = -0\.5 \* f3 \+ f2 - 0\.5 \* f, w1 = 1\.5 \* f3 - 2\.5 \* f2 \+ 1\.0, w2 = -1\.5 \* f3 \+ 2\.0 \* f2 \+ 0\.5 \* f, w3 = 0\.5 \* f3 - 0\.5 \* f2;/);
  assert.match(sheet, /float lobe = max\(-0\.1875, min\(max\(lobeC\.r, max\(lobeC\.g, lobeC\.b\)\), 0\.0\)\) \* sharp;/);
  assert.match(sheet, /vec3 e = clamp\(a\.rgb, mn, mx\);/);
});

// ---- the shader's sampling, mirrored (one channel: the picture is grey here) ----
// texture(): bilinear, clamped to the edge, texel centres at (i + 0.5) / W
function tex(img, W, H, u, v) {
  const x = u * W - 0.5, y = v * H - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (i, j) => img[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}
// post.js pcEnlarge
function enlarge(img, W, H, u, v, sharp, clampOn = true) {
  const tx = 1 / W, ty = 1 / H;
  const sx = u / tx - 0.5, sy = v / ty - 0.5, ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
  const wts = (f) => { const f2 = f * f, f3 = f2 * f; return [-0.5 * f3 + f2 - 0.5 * f, 1.5 * f3 - 2.5 * f2 + 1.0, -1.5 * f3 + 2.0 * f2 + 0.5 * f, 0.5 * f3 - 0.5 * f2]; };
  const [x0, x1, x2, x3] = wts(fx), [y0, y1, y2, y3] = wts(fy);
  const x12 = x1 + x2, y12 = y1 + y2;
  const p12x = (ix + 0.5 + x2 / x12) * tx, p12y = (iy + 0.5 + y2 / y12) * ty, p0x = (ix - 0.5) * tx, p0y = (iy - 0.5) * ty, p3x = (ix + 2.5) * tx, p3y = (iy + 2.5) * ty;
  const cC = tex(img, W, H, p12x, p12y);
  let a = tex(img, W, H, p12x, p0y) * (x12 * y0) + tex(img, W, H, p0x, p12y) * (x0 * y12) + cC * (x12 * y12) + tex(img, W, H, p3x, p12y) * (x3 * y12) + tex(img, W, H, p12x, p3y) * (x12 * y3);
  a /= x12 * y0 + x0 * y12 + x12 * y12 + x3 * y12 + x12 * y3;
  if (!clampOn) return a;
  const b = tex(img, W, H, u, v - ty), d = tex(img, W, H, u - tx, v), f = tex(img, W, H, u + tx, v), h = tex(img, W, H, u, v + ty);
  const mn = Math.min(b, d, f, h, cC), mx = Math.max(b, d, f, h, cC);
  const e = Math.min(mx, Math.max(mn, a));
  const hitMin = mn / (4 * mx + 1e-4), hitMax = (1 - mx) / (4 * mn - 4 - 1e-4);
  const lobe = Math.max(-0.1875, Math.min(Math.max(-hitMin, hitMax), 0)) * sharp;
  return (lobe * (b + d + f + h) + e) / (4 * lobe + 1);
}
// the B-spline it replaces (PAINTER 19's pcCubic, without its shake, which only blurred it more)
function bspline(img, W, H, u, v) {
  const tx = 1 / W, ty = 1 / H;
  const one = (s) => { const i = Math.floor(s), f = s - i, f2 = f * f, f3 = f2 * f; const w0 = (-f3 + 3 * f2 - 3 * f + 1) / 6, w1 = (3 * f3 - 6 * f2 + 4) / 6, w2 = (-3 * f3 + 3 * f2 + 3 * f + 1) / 6, w3 = f3 / 6; const g0 = w0 + w1, g1 = w2 + w3; return [g0, g1, i - 0.5 + w1 / g0, i + 1.5 + w3 / g1]; };
  const [gx0, gx1, hx0, hx1] = one(u / tx - 0.5), [gy0, gy1, hy0, hy1] = one(v / ty - 0.5);
  return gy0 * (gx0 * tex(img, W, H, hx0 * tx, hy0 * ty) + gx1 * tex(img, W, H, hx1 * tx, hy0 * ty)) + gy1 * (gx0 * tex(img, W, H, hx0 * tx, hy1 * ty) + gx1 * tex(img, W, H, hx1 * tx, hy1 * ty));
}
// the sheet's read of the scene at each of its pixels' centres
function sheetRead(img, W, H, OW, OH, how) {
  const out = new Float32Array(OW * OH), up = OH / H;
  const sharp = RCAS * Math.min(1, Math.max(0, (up - 1) / 0.12)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, (up - 1) / 0.12)));
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const u = (x + 0.5) / OW, v = (y + 0.5) / OH;
    let c;
    if (how === 'sheet') c = up > 1.0005 ? enlarge(img, W, H, u, v, sharp) : tex(img, W, H, u, v);
    else if (how === 'cr') c = enlarge(img, W, H, u, v, 0, false);
    else if (how === 'clamped') c = enlarge(img, W, H, u, v, 0);
    else if (how === 'bspline') c = bspline(img, W, H, u, v);
    else c = tex(img, W, H, u, v);
    out[y * OW + x] = Math.min(1, Math.max(0, c));
  }
  return out;
}

// ---- made pictures: what the scene pass draws, 2 x 2 samples a pixel (as with MSAA) ----
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(7);
const EDGES = Array.from({ length: 14 }, () => ({ a: R() * Math.PI * 2, c: 0.2 + R() * 0.6, v: 0.15 + R() * 0.7 }));
const LINES = Array.from({ length: 10 }, () => ({ a: R() * Math.PI, c: 0.1 + R() * 0.8, v: R() < 0.5 ? 0.1 : 0.9 }));
const WAVES = Array.from({ length: 24 }, () => ({ fx: (R() - 0.5) * 2, fy: (R() - 0.5) * 2, k: 30 + R() * 160, p: R() * 6.283, amp: 0.02 + R() * 0.04 }));
// the world at a point of the sheet (0..1 across, 0..9/16 down): step edges, thin lines, a fine texture
function world(X, Y) {
  let v = 0.5;
  for (const e of EDGES) if (Math.cos(e.a) * (X - 0.5) + Math.sin(e.a) * (Y - 0.28) > e.c - 0.5) v = v * 0.55 + e.v * 0.45;
  for (const w of WAVES) v += w.amp * Math.sin((w.fx * X + w.fy * Y) * w.k + w.p);
  for (const l of LINES) if (Math.abs(Math.cos(l.a) * (X - 0.5) + Math.sin(l.a) * (Y - 0.28) - (l.c - 0.5)) < 0.0009) v = l.v;
  return Math.min(1, Math.max(0, v));
}
function draw(W, H) {
  const img = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (const [a, b] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) s += world((x + a) / W, ((y + b) / W));
    img[y * W + x] = s / 4;
  }
  return img;
}
const OW = 480, OH = 270;
const full = draw(OW, OH);
const fullBands = MX.bands(full, OW, OH);
const mask = (() => { const m = new Uint8Array(OW * OH); const g = 12; for (let y = g; y < OH - g; y++) for (let x = g; x < OW - g; x++) m[y * OW + x] = 1; return m; })();
const t1 = (img, ref) => MX.stats(img, OW, OH, ref, mask, { bands: MX.bands(img, OW, OH), lap: MX.lap(img, OW, OH) }).t1;
// pixels overshooting the range of the scene's texels round them (the 3 x 3 texels nearest) by more than 8/255
function halo(out, img, W, H) {
  let over = 0, n = 0;
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    if (!mask[y * OW + x]) continue;
    const cx = Math.floor((x + 0.5) * W / OW), cy = Math.floor((y + 0.5) * H / OH);
    let lo = 1, hi = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const v = img[Math.min(H - 1, Math.max(0, cy + j)) * W + Math.min(W - 1, Math.max(0, cx + i))]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const v = out[y * OW + x];
    if (v > hi + 8 / 255 || v < lo - 8 / 255) over++;
    n++;
  }
  return over / n;
}

test('at full size the sheet gives the picture back exactly', () => {
  const o = sheetRead(full, OW, OH, OW, OH, 'sheet');
  let worst = 0;
  for (let i = 0; i < o.length; i++) worst = Math.max(worst, Math.abs(o[i] - full[i]));
  assert.ok(worst < 1e-6, 'largest change ' + worst);
});

test('Catmull-Rom gives every texel back where a sheet pixel lies on its centre (an interpolation, not an average)', () => {
  const W = OW / 2, H = OH / 2, img = draw(W, H);
  let worstCR = 0, worstB = 0;
  // at a 2x enlargement no sheet pixel centre lies on a texel centre; sample the texel centres themselves
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const u = (x + 0.5) / W, v = (y + 0.5) / H;
    worstCR = Math.max(worstCR, Math.abs(enlarge(img, W, H, u, v, 0, false) - img[y * W + x]));
    worstB = Math.max(worstB, Math.abs(bspline(img, W, H, u, v) - img[y * W + x]));
  }
  assert.ok(worstCR < 1e-5, 'Catmull-Rom off a texel at its centre by ' + worstCR);
  assert.ok(worstB > 0.05, 'the B-spline averaged texels with their neighbours (off by up to ' + worstB.toFixed(3) + ')');
});

for (const scale of [0.75, 0.62, 0.5]) {
  test(`at ${scale} of the sheet's size: sharper than a bilinear lookup and than the B-spline, no halo`, () => {
    const W = Math.round(OW * scale), H = Math.round(OH * scale), img = draw(W, H);
    const bil = sheetRead(img, W, H, OW, OH, 'bilinear'), bilB = MX.bands(bil, OW, OH);
    const nw = sheetRead(img, W, H, OW, OH, 'sheet'), bs = sheetRead(img, W, H, OW, OH, 'bspline'), cr = sheetRead(img, W, H, OW, OH, 'cr');
    const own = { sheet: t1(nw, bilB), bspline: t1(bs, bilB), cr: t1(cr, bilB) };
    const truth = { sheet: t1(nw, fullBands), bspline: t1(bs, fullBands), bilinear: t1(bil, fullBands) };
    const msg = JSON.stringify({ own, truth });
    assert.ok(own.sheet >= 1.0, 'the 2-6 px band against the bilinear enlargement: ' + msg);
    assert.ok(own.bspline < 0.85 && own.sheet > own.bspline + 0.3, 'the B-spline was a blur: ' + msg);
    assert.ok(own.cr >= 0.99, 'Catmull-Rom alone at least as sharp as bilinear: ' + msg);
    if (scale === 0.75) assert.ok(truth.sheet >= 0.8, "the finest band against the picture drawn at the sheet's own size: " + msg);
    assert.ok(truth.sheet > truth.bilinear && truth.sheet > truth.bspline, msg);
    const h = halo(nw, img, W, H), hCr = halo(cr, img, W, H), hCl = halo(sheetRead(img, W, H, OW, OH, 'clamped'), img, W, H);
    assert.ok(h <= 0.005, 'halo share ' + (h * 100).toFixed(3) + ' % (the plan: at most 0.5 %)');
    assert.ok(hCr > 0 && hCl === 0, 'the clamp takes all the ringing of Catmull-Rom: ' + (hCr * 100).toFixed(3) + ' % unclamped, ' + (hCl * 100).toFixed(3) + ' % clamped');
  });
}
