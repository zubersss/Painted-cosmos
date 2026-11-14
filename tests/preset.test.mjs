// The phone and tablet preset (W3.5 of the sharp-smooth plan, part 1, src/core/preset.js) and the
// upright view's field (W3.4, src/player/camera.js portraitFov). The plan's acceptance: iPhone 14
// landscape draws css size x 1.25; an iPad Pro 11 at most 1.6 MP (2.24 MP before); a desktop 1920 x
// 1080 window keeps 1920 x 1080; an iPad held upright keeps 60 degrees across.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS, choosePreset, bufferSize } from '../src/core/preset.js';
import { portraitFov, horizontalFov, CAMERA } from '../src/player/camera.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

test('main.js sizes the buffer by the preset and starts the controller at its tier', () => {
  const m = fs.readFileSync(path.join(repo, 'src/main.js'), 'utf8');
  assert.match(m, /bufferSize\(canvas\.clientWidth, canvas\.clientHeight, window\.devicePixelRatio \|\| 1, PRESET\)/);
  assert.match(m, /quality: params\.has\('quality'\) \? Number\(params\.get\('quality'\)\) : PRESET\.tier/);
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
