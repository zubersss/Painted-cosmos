// The station harness's picture measures (plan section 5). Pure JavaScript, no imports: the same
// file runs in the game's page (tests/stationlib/inpage.mjs loads it from a Blob URL, so it works
// on a clean export of any commit) and in Node (tests/stationmetrics.test.mjs).
//
// A port of the sharpness audit's metrics.py (/home/user/.pc-scratch/audit/sharp/bin/), number for
// number: luma of 8-bit sRGB / 255, separable Gaussians (radius ceil(3.5 sigma), numpy 'reflect'
// padding), the 4-neighbour Laplacian (edge padding), erosion with a false border, the 7 % frame
// margin. Added: the aliasing index A, the sub-pixel flicker index F, the halo share, CIELAB per
// region, the paper border strip.
//
// Images are Float32Array luma planes, row 0 at the TOP, with their width and height.

// ---- planes ----------------------------------------------------------------------------------

// RGBA bytes as gl.readPixels gives them (row 0 at the bottom unless flip is false) -> luma plane.
export function lumaOf(rgba, W, H, flip = true) {
  const y = new Float32Array(W * H);
  for (let r = 0; r < H; r++) {
    const src = (flip ? H - 1 - r : r) * W * 4, dst = r * W;
    for (let c = 0; c < W; c++) {
      const i = src + c * 4;
      y[dst + c] = Math.fround(Math.fround(Math.fround(rgba[i] / 255) * 0.299 + Math.fround(rgba[i + 1] / 255) * 0.587) + Math.fround(rgba[i + 2] / 255) * 0.114);
    }
  }
  return y;
}

// RGBA (bottom-up) -> top-down RGB bytes (for colour measures and the sheets).
export function rgbOf(rgba, W, H, flip = true) {
  const o = new Uint8Array(W * H * 3);
  for (let r = 0; r < H; r++) {
    const src = (flip ? H - 1 - r : r) * W * 4, dst = r * W * 3;
    for (let c = 0; c < W; c++) { o[dst + c * 3] = rgba[src + c * 4]; o[dst + c * 3 + 1] = rgba[src + c * 4 + 1]; o[dst + c * 3 + 2] = rgba[src + c * 4 + 2]; }
  }
  return o;
}

// The region view (post.js debug view 4: g = floor(class) / 6) -> class per pixel, 0..6 (7 and 8 read as 6).
export function classesOf(rgba, W, H, flip = true) {
  const k = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    const src = (flip ? H - 1 - r : r) * W * 4, dst = r * W;
    for (let c = 0; c < W; c++) k[dst + c] = Math.max(0, Math.min(6, Math.round(rgba[src + c * 4 + 1] / 42.5)));
  }
  return k;
}

// The depth view (debug view 3: b = log2(1 + view depth) / 20) -> metres.
export function depthOf(rgba, W, H, flip = true) {
  const d = new Float32Array(W * H);
  for (let r = 0; r < H; r++) {
    const src = (flip ? H - 1 - r : r) * W * 4, dst = r * W;
    for (let c = 0; c < W; c++) d[dst + c] = Math.pow(2, (rgba[src + c * 4 + 2] / 255) * 20) - 1;
  }
  return d;
}

// A 2x plane box-filtered to 1x (the supersampled reference of the aliasing index).
export function boxDown(y2, W2, H2) {
  const W = W2 >> 1, H = H2 >> 1, o = new Float32Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = 2 * r * W2 + 2 * c;
    o[r * W + c] = (y2[i] + y2[i + 1] + y2[i + W2] + y2[i + W2 + 1]) * 0.25;
  }
  return o;
}

// ---- filters (metrics.py) ------------------------------------------------------------------

const kernels = new Map();
function gk(s) {
  if (kernels.has(s)) return kernels.get(s);
  const r = Math.max(1, Math.ceil(s * 3.5));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp((-i * i) / (2 * s * s)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] = Math.fround(k[i] / sum);
  kernels.set(s, k);
  return k;
}
// numpy.pad(mode='reflect'): ... 2 1 | 0 1 2 ... n-1 | n-2 n-3 ...
const reflect = (i, n) => { while (i < 0 || i >= n) i = i < 0 ? -i : 2 * (n - 1) - i; return i; };

export function blur(y, W, H, s) {
  const k = gk(s), r = (k.length - 1) >> 1;
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  const row = new Float32Array(W + 2 * r);
  for (let y0 = 0; y0 < H; y0++) {
    const o = y0 * W;
    for (let i = -r; i < W + r; i++) row[i + r] = y[o + reflect(i, W)];
    for (let x = 0; x < W; x++) { let a = 0; for (let j = 0; j < k.length; j++) a += k[j] * row[x + j]; tmp[o + x] = a; }
  }
  const col = new Float32Array(H + 2 * r);
  for (let x = 0; x < W; x++) {
    for (let i = -r; i < H + r; i++) col[i + r] = tmp[reflect(i, H) * W + x];
    for (let y0 = 0; y0 < H; y0++) { let a = 0; for (let j = 0; j < k.length; j++) a += k[j] * col[y0 + j]; out[y0 * W + x] = a; }
  }
  return out;
}

// The three bands: G(0.6)-G(1.6) about 2-6 px, G(1.6)-G(4) about 6-16 px, G(4)-G(10) about 16-40 px.
export function bands(y, W, H) {
  const g06 = blur(y, W, H, 0.6), g16 = blur(y, W, H, 1.6), g4 = blur(y, W, H, 4.0), g10 = blur(y, W, H, 10.0);
  const b = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)];
  for (let i = 0; i < W * H; i++) { b[0][i] = g06[i] - g16[i]; b[1][i] = g16[i] - g4[i]; b[2][i] = g4[i] - g10[i]; }
  return b;
}
export function fineBand(y, W, H) {
  const g06 = blur(y, W, H, 0.6), g16 = blur(y, W, H, 1.6), b = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) b[i] = g06[i] - g16[i];
  return b;
}

export function lap(y, W, H) {
  const L = new Float32Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c, v = y[i];
    L[i] = y[r * W + (c > 0 ? c - 1 : 0)] + y[r * W + (c < W - 1 ? c + 1 : W - 1)] + y[(r > 0 ? r - 1 : 0) * W + c] + y[(r < H - 1 ? r + 1 : H - 1) * W + c] - 4 * v;
  }
  return L;
}

export function erode(m, W, H, n) {
  let a = m;
  for (let it = 0; it < n; it++) {
    const b = new Uint8Array(W * H);
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
      const i = r * W + c;
      b[i] = a[i] && a[i - 1] && a[i + 1] && a[i - W] && a[i + W] ? 1 : 0;
    }
    a = b;
  }
  return a;
}

// ---- masks -----------------------------------------------------------------------------------

export const MARGIN = 0.07;      // the paper's ragged border and the frame's edge: 7 % of the height off every side
export function frameMask(W, H) {
  const m = new Uint8Array(W * H), g = Math.floor(MARGIN * H);
  for (let r = g; r < H - g; r++) for (let c = g; c < W - g; c++) m[r * W + c] = 1;
  return m;
}
const and = (a, b) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] & b[i]; return o; };
const count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };

export const DEPTH_BANDS = [[0, 30], [30, 150], [150, 600], [600, Infinity]];
export const REGION_NAMES = ['sky', 'ground', 'water', 'prop', 'foliage', 'figure', 'marks+'];

// The masks of metrics.py: land (ground, solid props, foliage; eroded 3 px), ground (3), foliage (2),
// props (2), the ground by view distance; and here also each region class (eroded 2) for the palette.
export function masks(cls, dep, W, H) {
  const fr = frameMask(W, H), N = W * H;
  const is = (f) => { const m = new Uint8Array(N); for (let i = 0; i < N; i++) m[i] = f(cls[i]) ? 1 : 0; return m; };
  const M = {
    land: and(erode(is((k) => k === 1 || k === 3 || k === 4), W, H, 3), fr),
    ground: and(erode(is((k) => k === 1), W, H, 3), fr),
    foliage: and(erode(is((k) => k === 4), W, H, 2), fr),
    props: and(erode(is((k) => k === 3), W, H, 2), fr),
  };
  if (dep) for (const [lo, hi] of DEPTH_BANDS) {
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = M.ground[i] && dep[i] >= lo && dep[i] < hi ? 1 : 0;
    M[`ground_${lo}_${hi === Infinity ? 'inf' : hi}`] = m;
  }
  const region = REGION_NAMES.map((_, k) => and(erode(is((c) => c === k), W, H, 2), fr));
  return { M, region, frame: fr };
}
export function shares(M, W, H) {
  const o = {};
  for (const [k, m] of Object.entries(M)) o[k] = Math.round((count(m) / (W * H)) * 1000) / 1000;
  return o;
}

// ---- detail ----------------------------------------------------------------------------------

// lapvar (x1e4), b1 b2 b3 (rms x1e3), t1 t2 t3 (transfer against the reference's bands) over a mask.
export function stats(y, W, H, refBands, m, pre) {
  const n = count(m);
  if (n < 200) return null;
  const b = pre && pre.bands ? pre.bands : bands(y, W, H);
  const L = pre && pre.lap ? pre.lap : lap(y, W, H);
  let s = 0, ss = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) s += L[i];
  const mean = s / n;
  for (let i = 0; i < m.length; i++) if (m[i]) { const d = L[i] - mean; ss += d * d; }
  const o = { n, lapvar: (ss / n) * 1e4 };
  for (let k = 0; k < 3; k++) {
    let e = 0, x = 0, rr = 0;
    const bb = b[k], rb = refBands ? refBands[k] : null;
    for (let i = 0; i < m.length; i++) if (m[i]) { e += bb[i] * bb[i]; if (rb) { x += bb[i] * rb[i]; rr += rb[i] * rb[i]; } }
    o['b' + (k + 1)] = Math.sqrt(e / n) * 1e3;
    if (rb) o['t' + (k + 1)] = rr / n > 1e-12 ? x / rr : null;
  }
  return o;
}

// ---- aliasing, flicker, halo -----------------------------------------------------------------

// The aliasing index A (the audit's alias.py): rms of the fine band of (1x - ref) over the rms of
// the fine band of ref, over the mask; ref = the same view rendered at twice the size and box-filtered
// down. 0 = the 1x frame is what a 2x supersampled render gives; stair-steps and shimmer raise it.
export function aliasIndex(y1, ref, W, H, m) {
  const d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = y1[i] - ref[i];
  const e = fineBand(d, W, H), r = fineBand(ref, W, H);
  let ee = 0, rr = 0, n = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) { ee += e[i] * e[i]; rr += r[i] * r[i]; n++; }
  return n && rr > 0 ? Math.sqrt(ee / rr) : null;
}

// Catmull-Rom sample of a plane along x at column x + dx (dx in pixels).
function shiftX(y, W, H, dx) {
  const o = new Float32Array(W * H), f = dx - Math.floor(dx), base = Math.floor(dx);
  const w0 = f * (-0.5 + f * (1 - 0.5 * f)), w1 = 1 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  for (let r = 0; r < H; r++) {
    const R = r * W;
    for (let c = 0; c < W; c++) {
      const at = (k) => y[R + Math.max(0, Math.min(W - 1, c + base + k))];
      o[R + c] = w0 * at(-1) + w1 * at(0) + w2 * at(1) + w3 * at(2);
    }
  }
  return o;
}

// The sub-pixel flicker index F: the camera panned by `dx` output pixels (the picture moves the other
// way: b(x) = a(x + dx) for a band-limited picture), the fine-band change that the pan does not
// explain, over the fine band of the still frame. A picture whose detail is properly filtered moves
// smoothly and scores low; stair-steps, one-pixel trunks and aliased patterns pop and crawl and score high.
export function flickerIndex(a, b, W, H, m, dx = 0.25) {
  const pred = shiftX(a, W, H, dx), d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = b[i] - pred[i];
  const e = fineBand(d, W, H), r = fineBand(a, W, H);
  let ee = 0, rr = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) { ee += e[i] * e[i]; rr += r[i] * r[i]; }
  return rr > 0 ? Math.sqrt(ee / rr) : null;
}

// The halo share: final pixels that overshoot the raw scene's 3x3 range there by more than `tol`
// (8/255), over the mask. The final's tone differs from the raw scene's (the sheet's grade, the
// paper), so the raw is first carried to the final's tone by a least-squares straight line over the
// mask. Sharpening rims (an RCAS, the edge pooling) show up here; a blur does not.
export function haloShare(fin, raw, W, H, m, tol = 8 / 255) {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) { const x = raw[i], y = fin[i]; n++; sx += x; sy += y; sxx += x * x; sxy += x * y; }
  if (n < 200) return null;
  const den = n * sxx - sx * sx, a = den > 1e-12 ? (n * sxy - sx * sy) / den : 1, b = (sy - a * sx) / n;
  let over = 0;
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    const i = r * W + c;
    if (!m[i]) continue;
    let lo = Infinity, hi = -Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = raw[i + dy * W + dx]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const L = Math.min(a * lo + b, a * hi + b), Hh = Math.max(a * lo + b, a * hi + b), v = fin[i];
    if (v > Hh + tol || v < L - tol) over++;
  }
  return { share: over / n, fit: [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000] };
}

// ---- colour ----------------------------------------------------------------------------------

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LIN = new Float64Array(256).map((_, i) => lin(i));
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389 / 27 + 16) / 116);
// sRGB bytes -> CIELAB (D65).
export function lab(r, g, b) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const Z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const fx = fLab(X), fy = fLab(Y), fz = fLab(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE76 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// Mean CIELAB and the L* percentiles 10, 50, 90 over a mask of a top-down RGB image.
export function palette(rgb, m) {
  const n = count(m);
  if (n < 200) return null;
  let L = 0, A = 0, B = 0;
  const hist = new Float64Array(1001);
  for (let i = 0; i < m.length; i++) if (m[i]) {
    const p = lab(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    L += p[0]; A += p[1]; B += p[2];
    hist[Math.max(0, Math.min(1000, Math.round(p[0] * 10)))]++;
  }
  const pct = (q) => { let s = 0; const t = q * n; for (let i = 0; i <= 1000; i++) { s += hist[i]; if (s >= t) return i / 10; } return 100; };
  const r2 = (v) => Math.round(v * 100) / 100;
  return { n, lab: [r2(L / n), r2(A / n), r2(B / n)], L10: pct(0.1), L50: pct(0.5), L90: pct(0.9) };
}

// The paper's border strip (the outer 3 % of the height on every side): its mean RGB (0..255).
export const STRIP = 0.03;
export function borderStrip(rgb, W, H) {
  const g = Math.max(1, Math.floor(STRIP * H));
  let r = 0, gg = 0, b = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= g && y < H - g && x >= g && x < W - g) continue;
    const i = (y * W + x) * 3; r += rgb[i]; gg += rgb[i + 1]; b += rgb[i + 2]; n++;
  }
  const r2 = (v) => Math.round((v / n) * 100) / 100;
  return [r2(r), r2(gg), r2(b)];
}
// Mean absolute difference (0..255) of two top-down RGB images over the border strip.
export function stripDiff(p, q, W, H) {
  const g = Math.max(1, Math.floor(STRIP * H));
  let s = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= g && y < H - g && x >= g && x < W - g) continue;
    const i = (y * W + x) * 3; s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]); n += 3;
  }
  return s / n;
}

// ---- one station's frame set -----------------------------------------------------------------

// views: { final, raw, abs } luma planes (any may be missing), cls, dep, rgb: { final, raw } RGB bytes.
// Returns the record metrics.py wrote, plus the palette, halo share and border strip.
export function measure({ W, H, views, cls, dep, rgb }) {
  const out = {};
  const { M, region } = masks(cls, dep, W, H);
  out.share = shares(M, W, H);
  const refBands = views.raw ? bands(views.raw, W, H) : null;
  for (const key of ['raw', 'abs', 'final']) {
    const y = views[key];
    if (!y) continue;
    const pre = { bands: key === 'raw' ? refBands : bands(y, W, H), lap: lap(y, W, H) };
    out[key] = {};
    for (const [mk, m] of Object.entries(M)) out[key][mk] = round(stats(y, W, H, refBands, m, pre));
  }
  if (views.final && views.raw) {
    const h = haloShare(views.final, views.raw, W, H, M.land);
    out.halo = h ? { land: Math.round(h.share * 1e5) / 1e5, fit: h.fit } : null;
  }
  if (rgb) {
    out.palette = {};
    for (const key of ['final', 'raw']) {
      if (!rgb[key]) continue;
      out.palette[key] = {};
      region.forEach((m, k) => { const p = palette(rgb[key], m); if (p) out.palette[key][REGION_NAMES[k]] = p; });
      const p = palette(rgb[key], M.land); if (p) out.palette[key].land = p;
    }
    if (rgb.final) out.strip = borderStrip(rgb.final, W, H);
  }
  return { out, M, refBands };
}

// Four significant decimals: the numbers are compared to two.
export function round(o) {
  if (!o) return o;
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v;
  return r;
}
