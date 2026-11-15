// R1 W2.5 (docs/lead/SHARP-SMOOTH-PLAN.md, PAINTER W2 item 5): the region id kept honest through the MSAA resolve.
// Run: node --test src/world/
// The scene pass's second target holds the region (aux.w: 0 sky, 0.5/0.6 far worlds and cloud deck, 1 ground, 2 water,
// 3-3.9 props, 4-4.9 foliage and near strokes, 5 figure, 6-6.9 marks, 7-7.9 flakes, 8 lights). A resolve averages the
// samples, so half sky and half foliage came out 2: water. pcWrite now writes the region squared beside it (aux.y) and
// post.js AUXFIX_FRAG repairs a pixel whose samples lay on different regions. The shader's rule is read here and
// mirrored, and run on made pictures drawn with 4 samples a pixel (edges at every angle between every pair of regions,
// thin lines one sample wide, three regions meeting): no repaired pixel may take a region that is not among its 3x3
// neighbours drawn with one sample, and none may read as water where no water is near.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const post = fs.readFileSync(path.join(here, '../render/post.js'), 'utf8');
const chunks = fs.readFileSync(path.join(here, '../render/chunks.js'), 'utf8');
const sky = fs.readFileSync(path.join(here, 'sky.js'), 'utf8');

test('every writer of the second target carries the region squared in .y', () => {
  assert.match(chunks, /pcAux = pcAuxEnc\(vec4\(nV\.x, uAux8 > 0\.5 \? nV\.y : id \* id,/, 'pcWrite writes id * id into .y on float targets');
  // the sky writes region 0 and .y 0 (0 squared)
  assert.match(sky, /pcAux = uAux8 > 0\.5 \? vec4\(starOK, 0\.0, 20\.0 \/ 32\.0, 0\.0\) : vec4\(starOK, 0\.0, 20\.0, 0\.0\);/);
  // and the clear that stands for the backdrop: region 0, .y 0
  assert.match(post, /new Float32Array\(this\.floatFallback \? \[0\.5, 0\.5, 20 \/ 32, 0\] : \[0, 0, 20, 0\]\)/);
});

const src = (post.match(/export const AUXFIX_FRAG = \/\* glsl \*\/`([\s\S]*?)`;/) || [])[1];
test('the region rule is in the post passes, read before anything else reads the second target', () => {
  assert.ok(src, 'post.js exports AUXFIX_FRAG');
  assert.match(post, /if \(this\.samples\) this\._pass\(this\.mAuxFix, this\.rtAux\);\s*\n\s*this\._pass\(this\.mPrep, this\.rtHalf\);/);
  assert.match(post, /const col = this\.rtScene\.textures\[0\], aux = this\.samples \? this\.rtAux\.texture : this\.rtScene\.textures\[1\];/);
  assert.match(post, /G\.uSceneAux\.value = aux;/, 'the glazes (sky.js, kitmat.js) read the repaired region');
});

// the shader's rule, mirrored: [x, y, z, w] per pixel
const MIXED = +(src || '').match(/const float MIXED = ([0-9.]+);/)?.[1];
const R = +((src || '').match(/for \(int r = 1; r <= (\d+); r\+\+\)/) || [])[1];
function repair(img, W, H) {
  const out = new Array(W * H);
  const at = (x, y) => img[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = at(x, y);
    if (a[1] - a[3] * a[3] < MIXED) { out[y * W + x] = a; continue; }
    let best = a, bd = 1e9;
    for (let r = 1; r <= R; r++) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const n = at(x + i, y + j), dz = Math.abs(n[2] - a[2]);
        if (n[1] - n[3] * n[3] < MIXED && dz < bd) { bd = dz; best = n; }
      }
      if (bd < 1e8) break;
    }
    if (bd > 1e8) best = [a[0], a[1], a[2], a[1] / Math.max(a[3], 1e-3)];
    out[y * W + x] = best;
  }
  return out;
}
// half floats, as the target stores them
const half = (v) => { if (v === 0) return 0; const e = Math.floor(Math.log2(Math.abs(v))), q = Math.pow(2, e - 10); return Math.round(v / q) * q; };
// a made picture: region and depth at any point; drawn with 4 samples (the standard 4x pattern) and with one (the centre)
const S4 = [[0.375, 0.125], [0.875, 0.375], [0.125, 0.625], [0.625, 0.875]];
function draw(W, H, scene) {
  const ms = [], one = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let w = 0, w2 = 0, z = 0;
    for (const [sx, sy] of S4) { const s = scene(x + sx, y + sy); w += s.w / 4; w2 += s.w * s.w / 4; z += s.z / 4; }
    ms.push([0, half(w2), half(z), half(w)]);
    const c = scene(x + 0.5, y + 0.5); one.push([0, c.w * c.w, c.z, c.w]);
  }
  return { ms, one };
}
const REGIONS = [0, 0.5, 0.6, 1, 2, 3, 3.45, 3.9, 4, 4.45, 4.9, 5, 6, 6.9, 7.3, 8];
const DEPTH = (w) => (w < 0.7 ? 20 : 2 + w * 0.7);
function judge(W, H, ms, one, name) {
  const fix = repair(ms, W, H);
  const cls = (v) => Math.floor(v[3] + 0.001);
  let bad = 0, water = 0, worst = '';
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const c = cls(fix[y * W + x]);
    let among = false, wat = false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cls(one[(y + j) * W + x + i]) === c) among = true;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const yy = Math.min(H - 1, Math.max(0, y + j)), xx = Math.min(W - 1, Math.max(0, x + i)); if (cls(one[yy * W + xx]) === 2) wat = true; }
    if (!among) { bad++; worst = worst || `${name} at ${x},${y}: ${c}`; }
    if (c === 2 && !wat) water++;
  }
  return { bad, water, worst };
}

test('a straight edge between any two regions, at any angle: every repaired pixel takes a region of its neighbours', () => {
  assert.ok(MIXED > 0 && R >= 1, 'the rule read from the shader');
  const W = 24, H = 24;
  let total = 0, worst = '';
  for (const a of REGIONS) for (const b of REGIONS) {
    if (a === b) continue;
    for (const ang of [0, 0.13, 0.5, 0.79, 1.1, 1.57, 2.3]) {
      const nx = Math.cos(ang), ny = Math.sin(ang);
      const { ms, one } = draw(W, H, (x, y) => { const w = (x - 12.2) * nx + (y - 11.7) * ny < 0 ? a : b; return { w, z: DEPTH(w) + 0.01 * y }; });
      const r = judge(W, H, ms, one, `${a}|${b} at ${ang}`);
      total += r.bad + r.water; worst = worst || r.worst;
      // without the rule a sky/foliage edge reads as water: the made picture can tell
      if (a === 0 && b === 4 && ang === 0.5) {
        const raw = judge(W, H, ms.map((v) => v), one, 'raw');
        const plain = ms.filter((v) => Math.floor(v[3] + 0.001) === 2).length;
        assert.ok(plain > 0, 'the plain resolve has water on a sky/foliage edge (' + plain + ' pixels)');
        void raw;
      }
    }
  }
  assert.equal(total, 0, 'repaired pixels with a region not among their neighbours, or water away from water: ' + worst);
});

test('thin lines one sample wide, and three regions meeting, keep honest regions too', () => {
  const W = 32, H = 32;
  let total = 0, worst = '';
  for (const fg of [3, 4, 4.9, 5, 8]) for (const bg of [0, 1, 2]) {
    // a line about a quarter of a pixel wide, slanting (a grass blade, a twig against the sky or the ground)
    let d = draw(W, H, (x, y) => { const w = Math.abs((x - 16) - (y - 16) * 0.37) < 0.14 ? fg : bg; return { w, z: DEPTH(w) }; });
    let r = judge(W, H, d.ms, d.one, `line ${fg} on ${bg}`); total += r.bad + r.water; worst = worst || r.worst;
    // three regions: a wedge of fg over bg, with the third (4: a crown) behind the corner
    d = draw(W, H, (x, y) => { const w = y < 16 + 0.3 * (x - 16) ? (x < 14.6 ? fg : 4) : bg; return { w, z: DEPTH(w) }; });
    r = judge(W, H, d.ms, d.one, `three ${fg}/4/${bg}`); total += r.bad + r.water; worst = worst || r.worst;
  }
  assert.equal(total, 0, worst);
});

// the tier's samples (index.js): driven with a stand-in for the renderer (no GL here)
test('MSAA belongs to the tier: 4 samples at tiers 2 and 1 while they cost under 100 MiB, 2 above, none at tier 0', async () => {
  const { register } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
  register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'three') return { url: '${three}', shortCircuit: true }; return n(s, c); }`), import.meta.url);
  const { createPainter } = await import('../render/index.js');
  const gl = { COLOR: 0x1800, clearBufferfv() {} };
  const r = { autoClear: true, domElement: { width: 1280, height: 720 }, capabilities: { reversedDepthBuffer: true, logarithmicDepthBuffer: false },
    extensions: { has: () => true }, setPixelRatio() {}, setSize() {}, getContext: () => gl, getRenderTarget: () => null, setRenderTarget() {},
    setClearColor() {}, clear() {}, render() {} };
  const p = createPainter(r);
  const post = p._post;
  p.setQuality(2);
  assert.equal(p.info.aa, 4, 'q2 at 1280x720: 4 samples (' + (1280 * 720 * 72 / 1048576).toFixed(0) + ' MiB)');
  assert.equal(post.rtScene, post.rtSceneMS); assert.equal(post.rtScene.samples, 4);
  assert.equal(post.rtScene.resolveDepthBuffer, false, 'the multisampled depth is not resolved');
  assert.equal(post.rtScene.storeMultisampledDepthBuffer, false, 'nor kept after the pass');
  assert.equal(post.rtScene.depthTexture.type, 1015, 'a 32-bit float depth (the reversed-Z needs it)');
  assert.equal(post.absUniforms.tAux.value, post.rtAux.texture, 'the brush reads the region through the rule');
  assert.equal(post.sheetUniforms.tAux.value, post.rtAux.texture);
  p.resize(1920, 1080);
  assert.equal(p.info.aa, 2, 'q2 at 1920x1080: 4 samples would add 142 MiB, two add 79');
  p.setQuality(1);
  assert.equal(p.info.aa, 4, 'q1 at 1920x1080 (1536 x 864 drawn): 4 samples, 91 MiB');
  p.setQuality(0);
  assert.equal(p.info.aa, 0, 'tier 0: no samples');
  assert.equal(p.info.postAA, true, 'tier 0: the light post AA instead (R1 re-fix, ruling 4)');
  assert.equal(post.sheetUniforms.tAbs.value, post.rtAA.texture, 'the sheet reads the post AA\'s output');
  assert.equal(p.aaMode(), 'post (fxaa)');
  assert.equal(post.rtScene, post.rtScene1);
  assert.equal(post.absUniforms.tAux.value, post.rtScene1.textures[1], 'without samples the region is read as drawn');
  p.setQuality(2); p.resize(1280, 720);
  assert.equal(p.info.postAA, false, 'with samples no post AA');
  assert.equal(post.sheetUniforms.tAbs.value, post.rtAbs.texture);
  p.setAA('off'); assert.equal(p.info.aa, 0, 'aa=0'); assert.equal(p.info.postAA, false, 'aa=0: none at all');
  p.setAA('post'); assert.equal(p.info.aa, 0, 'aa=post'); assert.equal(p.info.postAA, true);
  p.setAA('msaa'); assert.equal(p.info.aa, 4, 'aa=msaa'); assert.equal(p.info.postAA, false);
  p.setAA('auto'); assert.equal(p.info.aa, 4);
  assert.equal(p.aaMode(), 'msaa 4x');
  assert.equal(p.info.depth, 'reversed-z');
  // (R1 re-fix) the budget is the tier's full size's: the resolution controller's steps never change the samples (at
  // 1920x1080 q2 the samples were 2 at scale 1 and 4 below about 0.83, so each step rebuilt the multisampled targets)
  p.resize(1920, 1080);
  const seen = new Set();
  for (const s of [1, 0.9, 0.83, 0.8, 0.7, 0.6, 0.5, 0.75, 1]) { p.setRenderScale(s); seen.add(p.info.aa); }
  assert.deepEqual([...seen], [2], 'q2 at 1920x1080: 2 samples at every render scale');
  const ms = post.rtSceneMS;
  p.setRenderScale(0.6); p.setRenderScale(1);
  assert.equal(post.rtSceneMS, ms, 'the multisampled target is kept (resized), not rebuilt');
});
