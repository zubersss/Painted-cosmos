// Touch (src/core/touch.js, W3.1 of the sharp-smooth plan): the floating stick, the look drag,
// the pinch, the controls' presses and taps, as numbers; and how they reach the game through
// Input (src/core/input.js) the way the gamepad does, with no pointer lock for a finger.
import test from 'node:test';
import assert from 'node:assert/strict';

function target() {
  const l = {};
  return {
    l,
    addEventListener(t, f, o) { (l[t] || (l[t] = [])).push({ f, o }); },
    fire(t, e = {}) { const ev = { defaultPrevented: false, cancelable: true, preventDefault() { this.defaultPrevented = true; }, ...e }; for (const h of l[t] || []) h.f(ev); return ev; },
  };
}
globalThis.window = globalThis.window || target();
const { TOUCH, LOOK_GAIN, TouchPad, attachTouch } = await import('../src/core/touch.js');
const { Input } = await import('../src/core/input.js');
const { FEEL } = await import('../src/core/sim.js');
const DEG = 180 / Math.PI;
const W = 750;                                            // the iPhone 14 held sideways, css px

test('the look: its gain is the foot\'s mouse gain, and a 120 px drag turns the view at least 30 degrees', () => {
  assert.equal(TOUCH.mouseFoot, FEEL.mouseFoot, 'touch.js carries sim.js FEEL.mouseFoot');
  const p = new TouchPad();
  assert.equal(p.down(1, 600, 170, 0, W), 'look');
  for (let i = 1; i <= 12; i++) p.move(1, 600 - 10 * i, 170, i * 0.016);
  const r = p.frame(1 / 60);
  const turn = -r.dx * FEEL.mouseFoot * DEG;
  assert.ok(turn >= 30, `120 px turned ${turn.toFixed(1)} degrees on foot`);
  assert.ok(Math.abs(turn - 120 * TOUCH.lookDeg) < 1e-9, 'the gain is lookDeg per css px');
  assert.ok(p.looked, 'the player has looked around (the hint goes)');
  // in the ship the same drag points the nose by FEEL.mouseShip
  assert.ok(-r.dx * FEEL.mouseShip * DEG > 20, 'and turns the nose by ' + (-r.dx * FEEL.mouseShip * DEG).toFixed(1) + ' degrees');
});

test('the stick: floating, a dead zone of 8 px, full at 56 px, up is forward; its centre follows a thumb past the rim', () => {
  const p = new TouchPad();
  assert.equal(p.down(1, 120, 250, 0, W), 'stick', 'the left 40 % is the stick');
  p.move(1, 120, 245, 0.01);
  assert.equal(p.moveX, 0); assert.equal(p.moveY, 0, 'inside the dead zone');
  p.move(1, 120, 250 - TOUCH.stickR, 0.02);
  assert.ok(Math.abs(p.moveY - 1) < 1e-9 && Math.abs(p.moveX) < 1e-9, 'straight up at the rim: full forward');
  p.move(1, 120 + 32, 250, 0.03);
  assert.ok(p.moveX > 0.4 && p.moveX < 0.6 && Math.abs(p.moveY) < 1e-9, 'half way right: ' + p.moveX.toFixed(2));
  p.move(1, 120 + 200, 250, 0.04);                        // far past the rim to the right
  assert.ok(Math.abs(p.moveX - 1) < 1e-9);
  assert.ok(Math.abs(p.stick.cx - (320 - TOUCH.stickR)) < 1e-9, 'the centre was pulled along');
  p.move(1, 320 - TOUCH.stickR - TOUCH.stickR, 250, 0.05); // and straight back: full left at once
  assert.ok(Math.abs(p.moveX + 1) < 1e-9, 'turning back is immediate: ' + p.moveX);
  p.up(1, 0.06);
  assert.equal(p.moveX, 0); assert.equal(p.stick, null);
});

test('held at the rim for a quarter of a second the stick runs; let go or eased off, it walks', () => {
  const p = new TouchPad();
  p.down(1, 100, 250, 0, W);
  p.move(1, 100, 250 - 60, 0.01);
  for (let i = 0; i < 12; i++) p.frame(0.02);               // 0.24 s
  assert.equal(p.run, false, 'not yet at 0.24 s');
  p.frame(0.02);
  assert.equal(p.run, true, 'running at 0.26 s');
  p.move(1, 100, 250 - 40, 0.3);                            // eased off to 0.67
  p.frame(0.02);
  assert.equal(p.run, false, 'eased off: walking');
  p.move(1, 100, 250 - 60, 0.32);
  p.frame(0.02);
  assert.equal(p.run, false, 'back at the rim: it waits its quarter second again');
  for (let i = 0; i < 13; i++) p.frame(0.02);
  assert.equal(p.run, true);
  p.up(1, 0.6);
  p.frame(0.02);
  assert.equal(p.run, false, 'let go');
});

test('stick and look at once; a second finger on the right pinches the camera boom; the finger left looks again', () => {
  const p = new TouchPad();
  assert.equal(p.down(1, 100, 250, 0, W), 'stick');
  assert.equal(p.down(2, 550, 150, 0, W), 'look');
  p.move(1, 100, 200, 0.02); p.move(2, 580, 150, 0.02);
  let r = p.frame(0.02);
  assert.ok(p.moveY > 0.8 && r.dx > 0, 'walking and turning together');
  assert.equal(p.down(3, 650, 150, 0.05, W), 'pinch', 'a second finger on the right');
  p.move(2, 550, 150, 0.06); p.move(3, 680, 150, 0.06);    // spread from 70 to 130 px
  r = p.frame(0.02);
  assert.ok(Math.abs(r.wheel + 60 / TOUCH.pinchPx) < 1e-9, 'fingers apart: the camera comes nearer (wheel ' + r.wheel + ')');
  assert.equal(r.dx, 0, 'the look waits while two fingers pinch');
  assert.ok(p.moveY > 0.8, 'the stick is still held');
  p.up(3, 0.1);
  p.move(2, 560, 150, 0.12);
  r = p.frame(0.02);
  assert.ok(r.dx > 0, 'the finger left on the picture looks again');
  assert.equal(p.down(4, 300, 100, 0.2, W), 'pinch', 'a finger landing on the stick\'s side while it is held pinches with the look');
});

test('taps: a short touch that hardly moved is a tap; a drag or a long hold is not', () => {
  const p = new TouchPad();
  p.down(1, 500, 100, 0, W); p.move(1, 504, 103, 0.05); p.up(1, 0.12);
  p.down(2, 500, 100, 1, W); p.move(2, 540, 100, 1.05); p.up(2, 1.1);
  p.down(3, 500, 100, 2, W); p.up(3, 2.6);
  const r = p.frame(0.02);
  assert.equal(r.taps.length, 1);
  assert.equal(r.taps[0].x, 504);
  p.down(4, 500, 100, 3, W); p.up(4, 3.05, true);
  assert.equal(p.frame(0.02).taps.length, 0, 'a cancelled finger is no tap');
});

test('the controls: a press is an edge and held while the finger stays; a tap is the edge alone', () => {
  const p = new TouchPad();
  p.press('Space', 7, 1);
  assert.ok(p.holds('Space'));
  assert.ok(p.frame(0.02).edges.has('Space'));
  assert.ok(p.holds('Space') && !p.frame(0.02).edges.has('Space'), 'held, one edge');
  p.release(7);
  assert.ok(!p.holds('Space'));
  p.tap('KeyE', 2);
  assert.ok(!p.holds('KeyE') && p.frame(0.02).edges.has('KeyE'), 'a tap holds nothing');
  p.press('KeyC', 8, 3); p.reset();
  assert.ok(!p.holds('KeyC'), 'reset lets go of everything');
  assert.ok(p.idle(3 + TOUCH.idle + 0.1) && !p.idle(3 + TOUCH.idle - 0.1), 'idle after ' + TOUCH.idle + ' s');
});

function page() {
  const doc = target(), el = target();
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => {};
  let asked = 0;
  el.requestPointerLock = () => { asked++; doc.pointerLockElement = el; doc.fire('pointerlockchange'); return Promise.resolve(); };
  el.setPointerCapture = () => {};
  const input = new Input(el, {}, doc);
  const win = target();
  win.innerWidth = W; win.innerHeight = 340; win.performance = { now: () => clock * 1000 };
  return { doc, el, input, win, asked: () => asked };
}
let clock = 100;

test('through Input: the stick is the axes, its run is Shift on foot only, the look and pinch add up, the presses are keys', () => {
  const { input, el, doc, win } = page();
  const pad = attachTouch(input, el, { doc, win });
  assert.equal(input.touch, pad);
  el.fire('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 250 });
  el.fire('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 100 + 30, clientY: 250 - 60 });
  assert.ok(input.axis('KeyS', 'KeyW') > 0.8 && input.axis('KeyA', 'KeyD') > 0.3, 'forward and a little right');
  assert.equal(input.axis('ArrowLeft', 'ArrowRight'), 0, 'the arrows are the keyboard\'s alone');
  for (let i = 0; i < 20; i++) input.take(0.02);
  assert.ok(input.down('ShiftLeft'), 'held at the rim: running');
  input.inShip = true;
  assert.ok(!input.down('ShiftLeft'), 'in the ship the stick does not run');
  assert.ok(input.axis('KeyS', 'KeyW') > 0.8, 'in the ship stick Y is the throttle axis');
  input.inShip = false;
  el.fire('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 600, clientY: 120 });
  el.fire('pointermove', { pointerType: 'touch', pointerId: 2, clientX: 640, clientY: 110 });
  pad.press('Space', 9, clock);
  let r = input.take(0.02);
  assert.ok(Math.abs(r.dx - 40 * LOOK_GAIN) < 1e-9 && Math.abs(r.dy + 10 * LOOK_GAIN) < 1e-9, 'the look in mouse px');
  assert.ok(r.edges.has('Space') && input.down('Space'), 'JUMP is Space: an edge, and held');
  assert.ok(input.used && input.looked, 'a touch is a start, a drag is a look');
  pad.release(9);
  assert.ok(!input.down('Space'));
  el.fire('pointerup', { pointerType: 'touch', pointerId: 1 });
  assert.equal(input.axis('KeyS', 'KeyW'), 0, 'thumb off: standing');
  r = input.take(0.02);
  assert.deepEqual(r.taps, []);
  clock += 1;
  el.fire('pointerdown', { pointerType: 'touch', pointerId: 3, clientX: 400, clientY: 100 });
  el.fire('pointerup', { pointerType: 'touch', pointerId: 3 });
  r = input.take(0.02);
  assert.ok(r.taps.length === 1 && r.taps[0].x === 400, 'a tap on the picture reaches the game');
});

test('a finger never asks for pointer lock; a mouse still does', () => {
  const { input, el, doc, win, asked } = page();
  attachTouch(input, el, { doc, win });
  clock += 5;
  el.fire('mousedown', { button: 0, sourceCapabilities: { firesTouchEvents: true }, clientX: 10, clientY: 10 });
  assert.equal(asked(), 0, 'a mouse event made up from a touch: no lock');
  assert.equal(input.dragging, false, 'and no drag');
  el.fire('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 500, clientY: 100 });
  el.fire('mousedown', { button: 0, clientX: 500, clientY: 100 });
  assert.equal(asked(), 0, 'a mousedown within a second of a touch: no lock');
  clock += 2;
  el.fire('mousedown', { button: 0, clientX: 500, clientY: 100 });
  assert.equal(asked(), 1, 'a real click later: the lock, as before');
});

test('the guard and the layer: touchstart is cancelled (non-passive), Safari\'s gestures too; shown by a touch or a coarse pointer, hidden by a key or a real mouse', () => {
  const { input, el, doc, win } = page();
  const pad = attachTouch(input, el, { doc, win });
  const ts = el.l.touchstart.find((h) => h.o && h.o.passive === false);
  assert.ok(ts, 'a non-passive touchstart on the canvas');
  assert.ok(el.fire('touchstart').defaultPrevented, 'which cancels the compatibility mouse events and the gestures');
  assert.ok(doc.fire('gesturestart').defaultPrevented, 'Safari\'s pinch gesture is cancelled');
  assert.equal(pad.shown, false, 'no touch yet, no coarse pointer: no layer (the desktop)');
  el.fire('pointerdown', { pointerType: 'mouse', pointerId: 1, clientX: 100, clientY: 250 });
  assert.equal(pad.fingers.size, 0, 'a mouse button is not a finger');
  doc.fire('pointerdown', { pointerType: 'touch', pointerId: 2 });
  assert.equal(pad.shown, true, 'a touch shows the layer');
  doc.fire('pointermove', { pointerType: 'mouse', movementX: 30, movementY: 0 });
  assert.equal(pad.shown, true, 'a mouse move within a second of the touch is not believed');
  clock += 2;
  doc.fire('pointermove', { pointerType: 'mouse', movementX: 0, movementY: 0 });
  assert.equal(pad.shown, true, 'a mouse move of nothing (a browser\'s hover) does not hide it');
  doc.fire('pointermove', { pointerType: 'mouse', movementX: 30, movementY: 4 });
  assert.equal(pad.shown, false, 'a real mouse move hides it');
  doc.fire('pointerdown', { pointerType: 'touch', pointerId: 3 });
  doc.fire('keydown', { code: 'KeyW', key: 'w' });
  assert.equal(pad.shown, false, 'a key press hides it (a tablet with a keyboard)');
  // a phone: coarse pointer, touch points
  const q = page();
  q.win.matchMedia = (m) => ({ matches: m === '(pointer: coarse)' });
  q.win.navigator = { maxTouchPoints: 5 };
  assert.equal(attachTouch(q.input, q.el, { doc: q.doc, win: q.win }).shown, true, 'on a phone or a tablet the layer is there from the start');
  const r = page();
  r.win.matchMedia = (m) => ({ matches: m === '(pointer: coarse)' });
  r.win.navigator = { maxTouchPoints: 0 };
  assert.equal(attachTouch(r.input, r.el, { doc: r.doc, win: r.win }).shown, false, 'a coarse pointer without touch (a TV remote) is not a touch screen');
});
