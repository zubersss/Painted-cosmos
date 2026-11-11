// The gamepad mapping (pure): a pad's snapshot becomes the same axes, keys and look as the
// keyboard and mouse give.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPad, PAD } from '../src/core/gamepad.js';

const pad = (axes = [0, 0, 0, 0], down = {}) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!down[i], value: typeof down[i] === 'number' ? down[i] : down[i] ? 1 : 0 })) });

test('sticks: a dead zone, forward is up, look follows a curve and the frame time', () => {
  let r = readPad(pad([0.1, -0.1, 0.05, 0]), null, 1 / 60);
  assert.equal(r.moveX, 0); assert.equal(r.moveY, 0); assert.equal(r.lookX, 0);
  assert.equal(r.active, false);
  r = readPad(pad([1, -1, 1, 0.5]), null, 1 / 60);
  assert.equal(r.moveX, 1); assert.equal(r.moveY, 1);
  assert.ok(Math.abs(r.lookX - PAD.lookRate / 60) < 1e-9, 'full deflection is the look rate');
  assert.ok(r.lookY > 0 && r.lookY < r.lookX * 0.4, 'half deflection is well under half the rate');
  const slow = readPad(pad([0, 0, 1, 0]), null, 1 / 30);
  assert.ok(Math.abs(slow.lookX - 2 * r.lookX) < 1e-9, 'the same turn at any frame rate');
  assert.ok(r.active);
});

test('buttons: held keys, one edge a press, triggers as throttle and run', () => {
  let r = readPad(pad([0, 0, 0, 0], { 0: true, 2: true }), null, 1 / 60);
  assert.deepEqual(r.held, ['Space']);
  assert.deepEqual(r.edges.sort(), ['KeyE', 'Space']);
  const again = readPad(pad([0, 0, 0, 0], { 0: true, 2: true }), r.buttons, 1 / 60);
  assert.deepEqual(again.edges, [], 'holding does not repeat the press');
  assert.deepEqual(again.held, ['Space']);
  const released = readPad(pad(), again.buttons, 1 / 60);
  r = readPad(pad([0, 0, 0, 0], { 2: true }), released.buttons, 1 / 60);
  assert.deepEqual(r.edges, ['KeyE'], 'a new press is a new edge');
  r = readPad(pad([0, 0, 0, 0], { 7: 1 }), null, 1 / 60);
  assert.ok(r.throttle > 0.99 && r.run);
  r = readPad(pad([0, 0, 0, 0], { 6: 0.6, 7: 0.1 }), null, 1 / 60);
  assert.ok(r.throttle < -0.4 && !r.run);
  r = readPad(pad([0, 0, 0, 0], { 12: true, 14: true, 8: true, 9: true, 5: true, 3: true, 1: true, 4: true }), null, 1 / 60);
  assert.deepEqual(r.edges.sort(), ['ArrowLeft', 'KeyB', 'KeyC', 'KeyF', 'KeyH', 'KeyM', 'KeyV', 'KeyX']);
  assert.deepEqual(r.held.sort(), ['KeyC', 'KeyX']);
});

test('no pad, or a broken one, is nothing at all', () => {
  for (const p of [null, undefined, {}, { axes: [] }]) {
    const r = readPad(p, null, 1 / 60);
    assert.equal(r.active, false); assert.deepEqual(r.edges, []);
  }
});

// Hardening review P2: a device that is not in the standard layout (a flight stick's throttle,
// wheel pedals) can rest an axis at -1 or +1; read as the right stick it spun the camera and
// started the title card by itself. Only a standard pad is read; the other is said once.
test('only a standard pad is read: a throttle resting at -1 neither turns the view nor counts as input', async () => {
  if (!globalThis.window) globalThis.window = { addEventListener() {} };
  const { Input } = await import('../src/core/input.js');
  const stub = () => ({ addEventListener() {}, pointerLockElement: null, exitPointerLock() {} });
  const hotas = { id: 'throttle', mapping: '', connected: true, axes: [0, 0, -1, 0], buttons: [{ pressed: false, value: 0 }] };
  const xbox = { id: 'xbox', mapping: 'standard', connected: true, ...pad() };
  const saved = navigator.getGamepads;
  try {
    navigator.getGamepads = () => [hotas, xbox];
    let input = new Input(stub(), {}, stub());
    let r = input.take(1 / 60);
    assert.ok(input.pad, 'the standard pad is read');
    assert.equal(r.dx, 0); assert.equal(input.pad.lookX, 0);
    assert.equal(input.used, false, 'a resting throttle is not input');
    assert.equal(input.message, null, 'nothing to say while a standard pad is there');
    navigator.getGamepads = () => [null, hotas];
    input = new Input(stub(), {}, stub());
    for (let i = 0; i < 30; i++) r = input.take(1 / 60);
    assert.equal(input.pad, null, 'the throttle alone is not a pad');
    assert.equal(r.dx, 0); assert.equal(input.used, false);
    assert.match(input.message, /not a standard gamepad/);
    input.message = null; input.take(1 / 60);
    assert.equal(input.message, null, 'said once');
  } finally { navigator.getGamepads = saved; }
});
