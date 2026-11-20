// The phone and tablet preset (W3.5 of the sharp-smooth plan, part 1, src/core/preset.js) and the
// upright view's field (W3.4, src/player/camera.js portraitFov). The plan's acceptance: iPhone 14
// landscape draws css size x 1.25; an iPad Pro 11 at most 1.6 MP (2.24 MP before); a desktop 1920 x
// 1080 window keeps 1920 x 1080; an iPad held upright keeps 60 degrees across.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { PRESETS, choosePreset, bufferSize, MAX_PIXELS } from '../src/core/preset.js';
import { portraitFov, horizontalFov, CAMERA } from '../src/player/camera.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// (src/core/game.js imports 'three': resolved to the vendored copy, as tests/flightmarks.test.mjs does)
const three = pathToFileURL(path.join(repo, 'vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);
const { Game } = await import('../src/core/game.js');

// Playwright's profiles (viewport, screen, device pixel ratio): what tests/touch.mjs runs.
const IPHONE14 = { coarse: true, touchPoints: 5, screenW: 390, screenH: 844, css: [750, 340], dpr: 3 };
const PIXEL7 = { coarse: true, touchPoints: 5, screenW: 915, screenH: 412, css: [863, 360], dpr: 2.625 };
const IPADPRO11 = { coarse: true, touchPoints: 5, screenW: 1194, screenH: 834, css: [1194, 834], dpr: 2 };
const DESKTOP = { coarse: false, touchPoints: 0, screenW: 1920, screenH: 1080, css: [1920, 1080], dpr: 1 };

test('which preset: a phone, a tablet, the desktop', () => {
  assert.equal(choosePreset(IPHONE14).id, 'phone');
  assert.equal(choosePreset(PIXEL7).id, 'phone');
  assert.equal(choosePreset(IPADPRO11).id, 'tablet');
  assert.equal(choosePreset(DESKTOP).id, 'desktop');
  // a laptop with a touch screen and a mouse: its pointer is fine, it is the desktop
  assert.equal(choosePreset({ coarse: false, touchPoints: 10, screenW: 1366, screenH: 768 }).id, 'desktop');
  // a coarse pointer without touch points (a TV remote): the desktop
  assert.equal(choosePreset({ coarse: true, touchPoints: 0, screenW: 1920, screenH: 1080 }).id, 'desktop');
  // the URL names one
  assert.equal(choosePreset({ ...DESKTOP, ask: 'phone' }).id, 'phone');
  assert.equal(choosePreset({ ...IPHONE14, ask: 'nonsense' }).id, 'phone');
  assert.equal(PRESETS.phone.tier, 1, 'a phone starts at tier 1');
  assert.equal(PRESETS.tablet.tier, 2);
  assert.equal(PRESETS.desktop.tier, 2);
});

test('the drawing buffer: iPhone 14 at 1.25, iPad Pro 11 at most 1.6 MP, the desktop as before', () => {
  const at = (d) => bufferSize(d.css[0], d.css[1], d.dpr, choosePreset(d));
  const ip = at(IPHONE14);
  assert.deepEqual([ip.w, ip.h], [Math.floor(750 * 1.25), Math.floor(340 * 1.25)], 'iPhone 14: css size x 1.25');
  const pad = at(IPADPRO11);
  assert.ok(pad.w * pad.h <= 1.6e6, `iPad Pro 11: ${pad.w}x${pad.h} = ${(pad.w * pad.h / 1e6).toFixed(2)} MP`);
  const old = bufferSize(1194, 834, 2, PRESETS.desktop);
  assert.ok(old.w * old.h > 2.2e6, 'before: the desktop rule gave the iPad ' + (old.w * old.h / 1e6).toFixed(2) + ' MP');
  const d = at(DESKTOP);
  assert.deepEqual([d.w, d.h], [1920, 1080], 'a desktop 1920x1080 window keeps 1920x1080');
  // the desktop's other cases, unchanged from main.js before W3.5
  const retina = bufferSize(1440, 900, 2, PRESETS.desktop);
  assert.deepEqual([retina.w, retina.h], [2160, 1350]);
  const uhd = bufferSize(3840, 2160, 1, PRESETS.desktop);
  assert.ok(uhd.w * uhd.h <= 3.7e6 && uhd.w * uhd.h > 3.6e6, 'a 4K window: about 1440p');
  // a big tablet (iPad Pro 12.9, 1366x1024 at 2): 1.6 MP at most
  const big = bufferSize(1366, 1024, 2, PRESETS.tablet);
  assert.ok(big.w * big.h <= 1.6e6);
});

test('?dpr= raises or lowers the picture pixels to the screen point, and never past the screen itself', () => {
  // the owner's S23 Ultra: 823 x 384 points at 3.75 device pixels each. The phone preset gives 1.25.
  const plain = bufferSize(823, 384, 3.75, PRESETS.phone);
  assert.equal(plain.ratio, 1.25);
  assert.deepEqual([plain.w, plain.h], [1028, 480], 'the picture the owner photographed');
  const sharp = bufferSize(823, 384, 3.75, PRESETS.phone, 2.5);
  assert.equal(sharp.ratio, 2.5);
  assert.deepEqual([sharp.w, sharp.h], [2057, 960], 'twice as sharp each way, four times the pixels');
  // never more picture pixels than the screen has points to show them
  assert.equal(bufferSize(823, 384, 1.5, PRESETS.phone, 4).ratio, 1.5, 'held at the screen\'s own ratio');
  // THE WHOLE SCREEN: the owner asked whether the game can draw their phone's own 3086 x 1440 (2026-11-18). It can:
  // an asked-for sharpness is not held back by the preset's limit on pixels in all, only by the screen itself.
  const whole = bufferSize(823, 384, 3.75, PRESETS.phone, 3.75);
  assert.deepEqual([whole.w, whole.h], [3086, 1440], 'every pixel the screen has');
  assert.ok(whole.w * whole.h > PRESETS.phone.maxPixels, 'past the preset\'s own 3.7 MP, on purpose');
  // but never past what a phone could hold as drawing targets at all
  const silly = bufferSize(2000, 1200, 8, PRESETS.phone, 8);
  assert.ok(silly.w * silly.h <= MAX_PIXELS + 1, 'held at MAX_PIXELS: ' + silly.w + 'x' + silly.h);
  // 0, or nothing at all, is exactly the game as it was
  assert.deepEqual(bufferSize(823, 384, 3.75, PRESETS.phone, 0), plain);
});

test('main.js sizes the buffer by the preset and starts the controller at its tier', () => {
  const m = fs.readFileSync(path.join(repo, 'src/main.js'), 'utf8');
  // (2026-11-20: the buffer's sharpness is no longer the pin alone. It is dprNow(), which is the pin where the
  //  address asked for one and otherwise the sharpening ladder's current rung -- 0, the preset's own, until the
  //  device has shown it has room above sixty a second. core/dynres.js.)
  assert.match(m, /bufferSize\(canvas\.clientWidth, canvas\.clientHeight, window\.devicePixelRatio \|\| 1, PRESET, dprNow\(\)\)/);
  assert.match(m, /const dprNow = \(\) => \(DPR_PIN > 0 \? DPR_PIN : /, 'an asked-for sharpness must still win over the ladder');
  assert.match(m, /const LADDER_OFF = params\.get\('sharpen'\) === '0' \|\| DPR_PIN > 0/, 'the ladder must stand aside for ?dpr= and ?sharpen=0');
  // (?dpr=: the pin may only be what the address asked for, between 0 and 4, and 0 means "leave the preset alone")
  assert.match(m, /const DPR_PIN = Math\.max\(0, Math\.min\(4, \+params\.get\('dpr'\) \|\| \(BEST_PIN \? window\.devicePixelRatio \|\| 0 : 0\)\)\)/);
  // the tier still comes from the preset unless the address asks otherwise (?quality=, or ?best=1 for the top one)
  assert.match(m, /quality: params\.has\('quality'\) \? Number\(params\.get\('quality'\)\) : BEST_PIN \? 2 : PRESET\.tier/);
  assert.match(m, /const BEST_PIN = !!\(params\.get\('best'\) && params\.get\('best'\) !== '0'\)/);
  assert.ok(!/Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5/.test(m), 'no second, fixed cap');
});

test('held upright a screen keeps 60 degrees across; landscape screens are unchanged', () => {
  for (const fov of [CAMERA.fovFoot, CAMERA.fovShip, CAMERA.fovShipFast]) {
    assert.equal(portraitFov(fov, 16 / 9), fov, 'a 16:9 screen: as before');
    assert.equal(portraitFov(fov, 750 / 340), fov, 'a phone held sideways: as before');
    assert.equal(portraitFov(fov, 1194 / 834), fov, 'a tablet held sideways: as before');
  }
  const ipadUp = 834 / 1194;
  assert.ok(horizontalFov(CAMERA.fovFoot, ipadUp) < 43, 'before: an upright iPad saw ' + horizontalFov(CAMERA.fovFoot, ipadUp).toFixed(1) + ' degrees across');
  for (const fov of [CAMERA.fovFoot, CAMERA.fovShip, CAMERA.fovShipFast]) {
    const h = horizontalFov(portraitFov(fov, ipadUp), ipadUp);
    assert.ok(h >= 60 - 1e-9, `iPad Pro 11 upright: ${h.toFixed(1)} degrees across at a ${fov} degree view`);
  }
  // the ship at speed still widens the view, upright too
  assert.ok(portraitFov(CAMERA.fovShipFast, ipadUp) > portraitFov(CAMERA.fovShip, ipadUp));
  // no step as a window passes square
  assert.ok(Math.abs(portraitFov(58, 1.0) - portraitFov(58, 1.001)) < 0.05);
});

test('the upright field is the phone\'s and the tablet\'s: a desktop window keeps its field whatever its shape', () => {
  // The verifier's 600 x 900 desktop window went from 58 to 81.8 degrees (re-fix of release 1):
  // the plan asks the wider field of a tablet held upright, not of a desktop window.
  const field = (preset, vfov, aspect) => Game.prototype.fieldOfView.call({ device: preset ? { preset } : undefined }, vfov, aspect);
  const tall = 600 / 900, ipadUp = 834 / 1194;
  for (const fov of [CAMERA.fovFoot, CAMERA.fovShip, CAMERA.fovShipFast]) {
    assert.equal(field('desktop', fov, tall), fov, 'a desktop window taller than wide: as before');
    assert.equal(field('desktop', fov, 16 / 9), fov);
    assert.equal(field(null, fov, tall), fov, 'no preset (a test, a stand-in): as before');
    assert.equal(field('tablet', fov, ipadUp), portraitFov(fov, ipadUp), 'a tablet held upright: widened');
    assert.ok(horizontalFov(field('tablet', fov, ipadUp), ipadUp) >= 60 - 1e-9);
    assert.equal(field('phone', fov, tall), portraitFov(fov, tall), 'a phone in a window taller than wide: widened');
    assert.equal(field('tablet', fov, 1194 / 834), fov, 'a tablet held sideways: as before');
  }
  assert.ok(Math.abs(horizontalFov(field('desktop', 58, tall), tall) - horizontalFov(58, tall)) < 1e-9);
  // the game sets the camera through it, both where the view is laid and where it is laid again
  const g = fs.readFileSync(path.join(repo, 'src/core/game.js'), 'utf8');
  assert.equal((g.match(/portraitFov\(/g) || []).length, 1, 'portraitFov is called in one place, fieldOfView');
  assert.equal((g.match(/this\.fieldOfView\(/g) || []).length, 2);
});
