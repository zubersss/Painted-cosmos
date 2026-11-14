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

test('last frame\'s painting is kept only while water is drawn, and the frame after', () => {
  const { post, log } = stand();
  const frame = (water) => {
    log.length = 0;
    post.beginScene();
    if (water) shared.PREV.water = true;    // (what the water material's onBeforeRender does as it is drawn)
    post.finish([], null);
    return { keep: draws(log).some((e) => e.material === post.mKeep), on: G.uPrevOn.value };
  };
  const seq = [false, false, true, true, false, false, false, true, false, true].map(frame);
  assert.deepEqual(seq.map((f) => f.keep), [false, false, true, true, true, false, false, true, true, true]);
  // the water reflects last frame only where it was kept (a gap of one frame keeps it; after a longer one the first
  // frame back reflects nothing rather than an old picture)
  assert.deepEqual(seq.map((f) => f.on), [0, 0, 1, 1, 1, 0, 0, 1, 1, 1]);
});

test('the paper is laid once per size of the sheet', () => {
  const { post, log } = stand();
  const sheetFrame = () => { log.length = 0; post.beginScene(); post.finish([], null); return draws(log).filter((e) => e.material === post.mPaper).length; };
  assert.ok(post.mSheet.defines && post.mSheet.defines.PC_PAPER_BAKED, 'the sheet reads the laid paper');
  assert.deepEqual([sheetFrame(), sheetFrame(), sheetFrame()], [1, 0, 0]);
  post.setSize(1920, 1080, 1);
  assert.deepEqual([sheetFrame(), sheetFrame()], [1, 0], 'laid again at a new size');
  assert.deepEqual([post.rtPaper.width, post.rtPaper.height], [1920, 1080]);
  post.sheetUniforms.uBorder.value.y += 0.001;
  assert.equal(sheetFrame(), 1, 'and when the border\'s roughness changes');
  // its targets: the steep values in half floats, the rest 8-bit
  assert.deepEqual(post.rtPaper.textures.map((t) => t.type), [1016, 1009]);
});

test('on the 8-bit fallback the sheet reads the paper itself, and the clear is the packed value', () => {
  const { post, log } = stand(false);
  assert.ok(!(post.mSheet.defines && post.mSheet.defines.PC_PAPER_BAKED));
  post.beginScene(); post.finish([], null);
  assert.equal(draws(log).filter((e) => e.material === post.mPaper).length, 0);
  assert.deepEqual(log.find((e) => e.op === 'clearBuffer').v, [0.5, 0.5, 0.625, 0]);
});
