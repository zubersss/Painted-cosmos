// The weather field's textures (world/wxfield.js), driven from Node without a browser. Run: node --test src/world/
// What is held: the atlas read back the way the shader reads it gives the maps' own values everywhere on the sphere,
// across every face edge and corner without a seam; the maps switched off give zeros; the updater rebuilds only when a
// map moves on, and no more than twice a second; and the real cloud map of Earth survives the trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { WX, WXN, WXFIELD_GLSL, fillAtlases, sampleAtlas, atlasIndex, createWxField } = await import('./wxfield.js');
const { faceToDir } = await import('../physics/windmap.js');

const T = 6 * WXN * WXN;
// smooth test fields of the direction (each changes slowly over a texel, as the real maps do)
const fLow = (x, y, z) => 0.5 + 0.4 * Math.sin(2.1 * x + 1.3 * y) * Math.cos(1.7 * z);
const fBase = (x, y, z) => 900 + 600 * (0.5 + 0.5 * Math.sin(1.4 * x - 0.9 * z + 0.3 * y));
const fThick = (x, y, z) => 200 + 900 * (0.5 + 0.5 * Math.cos(1.1 * y + 0.7 * x));
const fRain = (x, y, z) => Math.max(0, 25 * Math.sin(1.9 * z + 0.4 * x));
const fStorm = (x, y, z) => 0.5 + 0.5 * Math.sin(1.2 * y - 1.5 * z);
const fHigh = (x, y, z) => 0.5 + 0.5 * Math.cos(0.8 * x + 1.6 * y);
// the wind in the place's own east/north, from a smooth body-local vector field (so it is continuous over the sphere)
function windEN(x, y, z) {
  const vx = 6 + 3 * y, vy = 0, vz = -4 + 2 * x;           // body-local wind, then into east/north
  let ex = z, ez = -x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;   // east = normalize(Y x up)
  const nx = y * ez - 0, ny = z * ex - x * ez, nz = 0 - y * ex;                   // north = up x east
  return [vx * ex + vz * ez, vx * nx + vy * ny + vz * nz];
}
function makeMaps() {
  const C = { low: new Float32Array(T), base: new Float32Array(T), top: new Float32Array(T), rain: new Float32Array(T), storm: new Float32Array(T), high: new Float32Array(T), version: 1, ready: true };
  const W = { e10: new Float32Array(T), n10: new Float32Array(T), version: 1, ready: true };
  const d = [0, 0, 0];
  for (let f = 0; f < 6; f++) for (let j = 0; j < WXN; j++) for (let i = 0; i < WXN; i++) {
    const k = (f * WXN + j) * WXN + i;
    faceToDir(f, (i + 0.5) / WXN * 2 - 1, (j + 0.5) / WXN * 2 - 1, d);
    const [x, y, z] = d;
    C.low[k] = fLow(x, y, z); C.base[k] = fBase(x, y, z); C.top[k] = C.base[k] + fThick(x, y, z);
    C.rain[k] = fRain(x, y, z); C.storm[k] = fStorm(x, y, z); C.high[k] = fHigh(x, y, z);
    const w = windEN(x, y, z); W.e10[k] = w[0]; W.n10[k] = w[1];
  }
  return { C, W };
}
function randDir(r) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [s * Math.cos(a), u, s * Math.sin(a)]; }
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

test('the atlas index: every interior texel copies itself, every border texel a real texel of a neighbouring face', () => {
  const src = atlasIndex(), P = WXN + 2;
  assert.equal(src.length, 6 * P * P);
  for (let f = 0; f < 6; f++) for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
    const k = src[j * 6 * P + f * P + i];
    assert.ok(k >= 0 && k < T);
    const ii = i - 1, jj = j - 1;
    if (ii >= 0 && ii < WXN && jj >= 0 && jj < WXN) assert.equal(k, (f * WXN + jj) * WXN + ii);
    else assert.notEqual(Math.floor(k / (WXN * WXN)), f, 'a border texel comes from another face');
  }
});

test('read back as the shader reads it, the atlas gives the maps everywhere, seams and corners included', () => {
  const { C, W } = makeMaps();
  const A = new Uint8Array(WX.uWxField.value.image.data.length), B = new Uint8Array(A.length);
  const t0 = performance.now();
  for (let r = 0; r < 20; r++) fillAtlases(C, W, A, B);
  const ms = (performance.now() - t0) / 20;
  console.log(`  rebuild of both atlases: ${ms.toFixed(3)} ms (Node, this machine)`);
  const r = rng(7), a = [0, 0, 0, 0], b = [0, 0, 0, 0];
  let worst = { low: 0, base: 0, thick: 0, rain: 0, storm: 0, high: 0, wind: 0 };
  // random directions, plus directions hugging the face edges and the eight corners
  const dirs = [];
  for (let n = 0; n < 4000; n++) dirs.push(randDir(r));
  for (let n = 0; n < 2000; n++) { const s = [r() < 0.5 ? -1 : 1, r() < 0.5 ? -1 : 1]; const e = 1 + (r() - 0.5) * 0.02; const q = r() * 2 - 1; const v = [[e, q, s[1]], [q, e * s[0], s[1] * e], [s[0], q, e]][n % 3]; const l = Math.hypot(...v); dirs.push(v.map((x) => x / l)); }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) dirs.push([sx, sy, sz].map((x) => x / Math.sqrt(3)));
  for (const [x, y, z] of dirs) {
    sampleAtlas(A, x, y, z, a); sampleAtlas(B, x, y, z, b);
    worst.low = Math.max(worst.low, Math.abs(a[0] - fLow(x, y, z)));
    worst.thick = Math.max(worst.thick, Math.abs(a[1] * 2500 - fThick(x, y, z)));
    worst.rain = Math.max(worst.rain, Math.abs(40 * a[2] * a[2] - fRain(x, y, z)));
    worst.storm = Math.max(worst.storm, Math.abs(a[3] - fStorm(x, y, z)));
    worst.base = Math.max(worst.base, Math.abs(b[0] * 2500 - fBase(x, y, z)));
    worst.high = Math.max(worst.high, Math.abs(b[1] - fHigh(x, y, z)));
  }
  console.log('  worst error: ' + Object.entries(worst).filter(([k]) => k !== 'wind').map(([k, v]) => `${k} ${v.toFixed(3)}`).join(', '));
  // 8-bit steps (1/255 of the scale) plus a texel's worth of the field's own change (the bilinear's error)
  assert.ok(worst.low < 0.02, 'low cover');
  assert.ok(worst.thick < 25, 'thickness (m)');
  assert.ok(worst.base < 25, 'base (m)');
  assert.ok(worst.rain < 0.8, 'rain (mm/h)');
  assert.ok(worst.storm < 0.02, 'storm');
  assert.ok(worst.high < 0.02, 'high cover');
});

test('the wind, decoded as pcWindAt decodes it (four texels, vectors blended), is the map wind', () => {
  const { C, W } = makeMaps();
  const A = new Uint8Array(WX.uWxField.value.image.data.length), B = new Uint8Array(A.length);
  fillAtlases(C, W, A, B);
  const P = WXN + 2, AW = 6 * P;
  // the shader's own decode: the four texels' speed and angle to vectors, blended
  const tex = (i, j) => { const o = (j * AW + i) * 4, s = B[o + 2] / 255 * 30, g = B[o + 3] / 255 * Math.PI * 2; return [s * Math.cos(g), s * Math.sin(g)]; };
  const r = rng(11); let worst = 0, n = 0;
  for (let q = 0; q < 3000; q++) {
    const [x, y, z] = randDir(r);
    if (Math.abs(y) > 0.97) continue;          // (east is undefined at the poles, in the physics as here)
    // the atlas position as the shader computes it (wxfield.js atlasPx is that function's twin)
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    const F = [[1, 0, 0, 0, 0, -1, 0, 1, 0], [-1, 0, 0, 0, 0, 1, 0, 1, 0], [0, 1, 0, 1, 0, 0, 0, 0, -1], [0, -1, 0, 1, 0, 0, 0, 0, 1], [0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 0, -1, -1, 0, 0, 0, 1, 0]];
    const f = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5), m = F[f];
    const dn = x * m[0] + y * m[1] + z * m[2];
    const s = Math.atan((x * m[3] + y * m[4] + z * m[5]) / dn) * 4 / Math.PI, t = Math.atan((x * m[6] + y * m[7] + z * m[8]) / dn) * 4 / Math.PI;
    const px = f * P + 1 + (s * 0.5 + 0.5) * WXN - 0.5, py = 1 + (t * 0.5 + 0.5) * WXN - 0.5;
    const i0 = Math.floor(px), j0 = Math.floor(py), tx = px - i0, ty = py - j0;
    const a00 = tex(i0, j0), a10 = tex(i0 + 1, j0), a01 = tex(i0, j0 + 1), a11 = tex(i0 + 1, j0 + 1);
    const we = (a00[0] * (1 - tx) + a10[0] * tx) * (1 - ty) + (a01[0] * (1 - tx) + a11[0] * tx) * ty;
    const wn = (a00[1] * (1 - tx) + a10[1] * tx) * (1 - ty) + (a01[1] * (1 - tx) + a11[1] * tx) * ty;
    const [ee, en] = windEN(x, y, z);
    worst = Math.max(worst, Math.hypot(we - ee, wn - en)); n++;
  }
  console.log(`  wind: worst ${worst.toFixed(3)} m/s over ${n} directions`);
  assert.ok(worst < 0.6, 'wind within 0.6 m/s (8-bit speed and angle, a texel of the field\'s own change, the frames turning near the poles)');
});

test('with the maps off the textures hold zeros, and the updater rebuilds only when a map moves on (at most twice a second)', async () => {
  const wx = createWxField();
  assert.equal(wx.update(null), false);
  assert.deepEqual([WX.uWxOn.value.x, WX.uWxOn.value.y], [0, 0]);
  assert.ok(WX.uWxField.value.image.data.every((v) => v === 0) && WX.uWxField2.value.image.data.every((v) => v === 0));
  const { C, W } = makeMaps();
  const fields = { cloud: C, wind: W };
  assert.equal(wx.update(fields), true, 'the first live frame rebuilds');
  assert.deepEqual([WX.uWxOn.value.x, WX.uWxOn.value.y], [1, 1]);
  assert.equal(wx.update(fields), false, 'nothing moved: no rebuild');
  C.version++;
  assert.equal(wx.update(fields), false, 'moved, but within half a second of the last');
  await new Promise((r) => setTimeout(r, 470));
  assert.equal(wx.update(fields), true, 'moved, and half a second on');
  assert.equal(wx.rebuilds, 2);
  // a map not yet ready counts as off
  assert.equal(wx.update({ cloud: { ...C, ready: false }, wind: null }), false);
  assert.deepEqual([WX.uWxOn.value.x, WX.uWxOn.value.y], [0, 0]);
});

test('the GLSL carries the contract\'s functions and is guarded against a second inclusion', () => {
  for (const name of ['vec4 pcWxField(vec3', 'vec4 pcWxField2(vec3', 'float pcRainAt(vec3', 'vec2 pcWindAt(vec3', 'float pcCloudShadow(vec3', 'float pcCloudBase(vec3', 'float pcCloudTop(vec3']) assert.ok(WXFIELD_GLSL.includes(name), name);
  assert.ok(WXFIELD_GLSL.includes('#ifndef PC_WXFIELD_GLSL'));
  assert.ok(!WXFIELD_GLSL.includes('`'), 'no backtick in the shader text');
  for (const u of ['uWxField', 'uWxField2', 'uWxN', 'uWxOn', 'uCloudShadow', 'uCloudShadowM', 'uCloudShadowK']) assert.ok(WX[u], u);
});

test('the real cloud map of Earth survives the trip into the atlas', async () => {
  const { CloudField } = await import('../physics/cloudfield.js');
  const cf = new CloudField();
  cf.refresh('earth', 1760, { x: 0.3, y: 0.9, z: 0.3 }, null);
  const A = new Uint8Array(WX.uWxField.value.image.data.length), B = new Uint8Array(A.length);
  fillAtlases(cf, null, A, B);
  const r = rng(3), a = [0, 0, 0, 0], b = [0, 0, 0, 0], o = {};
  let worstLow = 0, worstBase = 0, any = 0;
  for (let q = 0; q < 3000; q++) {
    const [x, y, z] = randDir(r);
    sampleAtlas(A, x, y, z, a); sampleAtlas(B, x, y, z, b); cf.at(x, y, z, o);
    worstLow = Math.max(worstLow, Math.abs(a[0] - o.low)); worstBase = Math.max(worstBase, Math.abs(b[0] * 2500 - o.base));
    if (o.low > 0.05) any++;
  }
  console.log(`  Earth t=1760: ${any} of 3000 directions in cloud; worst low ${worstLow.toFixed(3)}, base ${worstBase.toFixed(1)} m`);
  assert.ok(any > 0, 'some cloud somewhere');
  // (the map's own bilinear clamps at a face edge where the atlas carries the neighbour: a weather system's edge is
  //  sharp over a texel, so allow a texel's step there)
  assert.ok(worstBase < 60);
});
