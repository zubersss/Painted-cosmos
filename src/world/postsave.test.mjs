// R1 W2.4 (docs/lead/SHARP-SMOOTH-PLAN.md, PAINTER W2 item 4): the post passes' savings, with the same picture.
// Run: node --test src/world/
// The passes are driven with a recording stand-in for the renderer (no GL here): what is drawn, into what, in which
// frame. (That the picture is the same is measured in the browser at every station: docs/notes/painter.md, W2.4.)
//   - no backdrop pass: the scene's targets are cleared (white; normal 0, log depth 20, region 0 in the second)
//   - last frame's painting is kept for the water only while water is drawn, and the frame after
//   - the paper is laid once per size of the sheet, not read again every frame; not on the 8-bit fallback
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
const { Post } = await import('../render/post.js');
const shared = await import('../render/shared.js');
const { G } = shared;

function stand(floatOK = true) {
  const log = [];
  let target = null;
  const gl = { COLOR: 0x1800, clearBufferfv: (b, i, v) => log.push({ op: 'clearBuffer', b, i, v: Array.from(v) }) };
  const r = {
    extensions: { has: (n) => floatOK },
    getContext: () => gl,
    getRenderTarget: () => target,
    setRenderTarget: (t) => { target = t; },
    setClearColor: (c, a) => log.push({ op: 'clearColor', c, a }),
    clear: (c, d, s) => log.push({ op: 'clear', target, c, d, s }),
    render: (o, cam) => log.push({ op: 'draw', target, material: o.material }),
  };
  const post = new Post(r);
  post.setSize(1280, 720, 1);
  return { post, log, r };
}
const draws = (log) => log.filter((e) => e.op === 'draw');

test('the scene pass begins with clears, no backdrop pass', () => {
  const { post, log } = stand();
  post.beginScene();
  assert.equal(draws(log).length, 0, 'passes drawn to begin the scene: ' + draws(log).length);
  const clear = log.find((e) => e.op === 'clear');
  assert.ok(clear && clear.target === post.rtScene && clear.c && clear.d, 'the scene target cleared (colour and depth)');
  assert.deepEqual(log.find((e) => e.op === 'clearColor'), { op: 'clearColor', c: 0xffffff, a: 1 });
  const cb = log.find((e) => e.op === 'clearBuffer');
  assert.ok(cb && cb.i === 1, 'the second attachment cleared on its own');
  assert.deepEqual(cb.v, [0, 0, 20, 0], 'to the backdrop\'s value: normal 0, log depth 20, region 0');
  assert.equal(post.mBackdrop, undefined, 'no backdrop material');
});

test('last frame\'s painting is kept on a world once its water has been drawn there, never on a world without water', () => {
  const { post, log } = stand();
  const frame = (water, body) => {
    log.length = 0;
    shared.PREV.body = body;                 // (index.js, from the mood, every frame)
    post.beginScene();
    if (water) shared.PREV.water = true;     // (what the water material's onBeforeRender does as it is drawn)
    post.finish([], null);
    return { keep: draws(log).some((e) => e.material === post.mKeep), on: G.uPrevOn.value };
  };
  // Mars: no water, never kept; Earth: from the first water on, every frame, also while no water is in view (R1 re-fix:
  // the W2.4 rule stopped after a frame without water, so water coming back into view reflected nothing for a frame)
  const seq = [[false, 'mars'], [false, 'mars'], [false, 'earth'], [true, 'earth'], [true, 'earth'], [false, 'earth'], [false, 'earth'],
    [false, 'earth'], [true, 'earth'], [false, 'mars'], [false, 'mars'], [true, 'neptune'], [false, 'neptune']].map(([w, b]) => frame(w, b));
  assert.deepEqual(seq.map((f) => f.keep), [false, false, false, true, true, true, true, true, true, false, false, true, true]);
  // the water reflects last frame only where it was kept: the first water a world shows reflects nothing for that frame
  assert.deepEqual(seq.map((f) => f.on), [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1]);
  shared.PREV.body = null;
});

test('the paper is laid once per size of the sheet, into three targets read with three fetches', () => {
  const { post, log } = stand();
  const sheetFrame = () => { log.length = 0; post.beginScene(); post.finish([], null); return draws(log).filter((e) => e.material === post.mPaper).length; };
  assert.ok(post.mSheet.defines && post.mSheet.defines.PC_PAPER_BAKED, 'the sheet reads the laid paper');
  assert.deepEqual([sheetFrame(), sheetFrame(), sheetFrame()], [1, 0, 0]);
  post.setSize(1920, 1080, 1);
  assert.deepEqual([sheetFrame(), sheetFrame()], [1, 0], 'laid again at a new size');
  assert.deepEqual([post.rtPaper.width, post.rtPaper.height], [1920, 1080]);
  post.sheetUniforms.uBorder.value.y += 0.001;
  assert.equal(sheetFrame(), 1, 'and when the border\'s roughness changes');
  // (R1 re-fix) three targets (the tremor and the border's terms, and ph pmidR ploR skD, in half floats; the grain's four
  // 8-bit), read with three fetches (was two targets and two live reads of the paper: four)
  assert.deepEqual(post.rtPaper.textures.map((t) => t.type), [1016, 1016, 1009]);
  const sheetMain = post.mSheet.fragmentShader.slice(post.mSheet.fragmentShader.indexOf('void main()'));
  const baked = sheetMain.slice(sheetMain.indexOf('#ifdef PC_PAPER_BAKED'), sheetMain.indexOf('#else'));
  assert.equal((baked.match(/texelFetch\(tPap/g) || []).length, 3, 'three fetches of the paper');
  assert.equal((baked.match(/texture\(tPaper/g) || []).length, 0, 'no live read of the paper');
});

// (R1 re-fix) a target resized loses what was laid in it: the paper and the brush's paper are laid again at the next frame,
// also when the size changed and changed back with no frame between (the station harness's settle; a tier and a scale
// stepped together). Before this the key was the size, so the round trip drew with cleared targets.
test('the laid paper and the brush\'s paper are laid again after any resize, also a round trip with no frame between', () => {
  const { post, log } = stand();
  const frame = () => { log.length = 0; post.beginScene(); post.finish([], null); return { paper: draws(log).filter((e) => e.material === post.mPaper).length, absP: draws(log).filter((e) => e.material === post.mAbsP).length }; };
  frame();
  assert.deepEqual(frame(), { paper: 0, absP: 0 }, 'nothing laid again while nothing changes');
  post.setSize(1280, 720, 0.34); post.setSize(1280, 720, 1);     // (a settle at a small scale, and back, no frame between)
  const f = frame();
  assert.equal(f.paper, 1, 'the paper laid again');
  assert.equal(f.absP, post.absPaperBaked ? 1 : 0, 'the brush\'s paper laid again (where it is baked)');
  assert.deepEqual(frame(), { paper: 0, absP: 0 });
});

// (R1 re-fix) the sheet's pooling and outlines are read from two passes of their own, every frame, before the sheet
test('the pool (half size) and the edges (the scene\'s size) are drawn before the sheet; the post AA where it is on', () => {
  const { post, log } = stand();
  const order = () => { log.length = 0; post.beginScene(); post.finish([], null); return draws(log).map((e) => e.material.name || (e.material === post.mSheet ? 'sheet' : e.material === post.mKeep ? 'keep' : e.material === post.mPrep ? 'prep' : Object.values(post.mAbs).includes(e.material) ? 'abs' : e.material === post.mPrepF ? 'prepF' : '?')); };
  order();
  const o = order();
  assert.ok(o.indexOf('pool') > o.indexOf('prep') && o.indexOf('pool') < o.indexOf('sheet'), o.join(' '));
  assert.ok(o.indexOf('edges') >= 0 && o.indexOf('edges') < o.indexOf('sheet'), o.join(' '));
  assert.equal(o.indexOf('post-aa'), -1, 'no post AA unless asked');
  assert.deepEqual([post.rtPool.width, post.rtPool.height], [640, 360]);
  assert.deepEqual([post.rtEdge.width, post.rtEdge.height], [1280, 720]);
  post.setPostAA(true);
  const o2 = order();
  assert.ok(o2.indexOf('post-aa') > o2.indexOf('abs') && o2.indexOf('post-aa') < o2.indexOf('sheet'), o2.join(' '));
  assert.equal(post.sheetUniforms.tAbs.value, post.rtAA.texture);
  post.setPostAA(false);
  assert.equal(post.sheetUniforms.tAbs.value, post.rtAbs.texture);
  // the old brush's sheet reads its own pooling: no pool pass then
  post.sheetUniforms.uSheetOld.value = 1;
  assert.equal(order().indexOf('pool'), -1);
  post.sheetUniforms.uSheetOld.value = 0;
  // the sheet no longer reads the half-size prep or the region target for its pooling, outlines and pencil
  const sheetMain = post.mSheet.fragmentShader;
  const newPath = sheetMain.slice(sheetMain.indexOf('void main()'));
  assert.equal((newPath.match(/texture\(tAux/g) || []).length, 1 + 5, 'the region read once where the picture is (and five times only under a lightning flash)');
});

test('on the 8-bit fallback the sheet reads the paper itself, and the clear is the packed value', () => {
  const { post, log } = stand(false);
  assert.ok(!(post.mSheet.defines && post.mSheet.defines.PC_PAPER_BAKED));
  post.beginScene(); post.finish([], null);
  assert.equal(draws(log).filter((e) => e.material === post.mPaper).length, 0);
  assert.deepEqual(log.find((e) => e.op === 'clearBuffer').v, [0.5, 0.5, 0.625, 0]);
});
