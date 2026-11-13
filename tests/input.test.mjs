// Keyboard, mouse and wheel (src/core/input.js), through its real event handlers on stand-in
// targets. The cases come from the hardening review (docs/lead/HARDENING.md): P5 pointer lock
// (Chrome's pause after Esc, flicks at 30 fps, a panel wants the cursor), P6 keyboard layouts,
// P9 touchpad wheels, P11 keys held through a blur or a Cmd chord.
import test from 'node:test';
import assert from 'node:assert/strict';

function target() {
  const l = {};
  return {
    l,
    addEventListener(t, f) { (l[t] || (l[t] = [])).push(f); },
    fire(t, e = {}) { const ev = { preventDefault() {}, ...e }; for (const f of l[t] || []) f(ev); return ev; },
  };
}
globalThis.window = globalThis.window || target();
const { Input, bindingOf, keyLabels, LOCK_RETRY_MS } = await import('../src/core/input.js');

// A page: the document, the canvas, and a pointer lock that is granted (or refused) at once.
function page({ grant = true } = {}) {
  const doc = target(), el = target();
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => { if (doc.pointerLockElement) { doc.pointerLockElement = null; doc.fire('pointerlockchange'); } };
  el.requestPointerLock = () => {
    if (!grant) { doc.fire('pointerlockerror'); return Promise.reject(new Error('refused')); }
    doc.pointerLockElement = el; doc.fire('pointerlockchange'); return Promise.resolve();
  };
  const input = new Input(el, {}, doc);
  return { doc, el, input };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('a lock refused just after the player let it go (Chrome after Esc) asks for another click; only repeated refusals give up', async () => {
  const { doc, el, input } = page();
  el.fire('mousedown', { button: 0 });
  assert.equal(input.locked, true);
  doc.exitPointerLock();                                   // Esc
  assert.equal(input.locked, false);
  el.requestPointerLock = () => { doc.fire('pointerlockerror'); return Promise.reject(new Error('too soon')); };
  el.fire('mousedown', { button: 0 }); await tick();
  assert.equal(input.usePointerLock, true, 'one refusal after Esc keeps pointer lock');
  assert.match(input.message, /Click again/);
  // Refusals that do not follow an Esc: the promise and the event say it once per click; the third click gives up.
  input._unlockAt = -1e9; input.message = null;
  el.fire('mousedown', { button: 0 }); await tick();
  el.fire('mousedown', { button: 0 }); await tick();
  assert.equal(input.usePointerLock, true, 'two refusals: still trying');
  el.fire('mousedown', { button: 0 }); await tick();
  assert.equal(input.usePointerLock, false, 'the third refusal falls back to drag-look');
  assert.match(input.message, /drag to look/);
});

// A fast turn under the lock as Chrome delivers it: one coalesced mousemove per rendered frame,
// and the game taking its input once a frame.
function flicks(fps, { turns = 3, ms = 180, gap = 250, px = 1366 } = {}) {
  const { doc, el, input } = page();
  el.fire('mousedown', { button: 0 });
  const dtF = 1000 / fps; let t = 1000, wanted = 0, turned = 0;
  const frame = (mx) => { t += dtF; doc.fire('mousemove', { movementX: mx, movementY: 0, timeStamp: t }); return input.take(dtF / 1000).dx; };
  for (let i = 0; i < 30; i++) frame(0);                   // the game has been running a while
  for (let f = 0; f < turns; f++) {
    const n = Math.max(1, Math.round(ms / dtF));
    const w = Array.from({ length: n }, (_, i) => Math.sin(Math.PI * (i + 0.5) / n) ** 2), s = w.reduce((a, b) => a + b, 0);
    const dir = f % 2 ? -1 : 1;
    for (let i = 0; i < n; i++) { const mx = Math.round(dir * px * w[i] / s); wanted += Math.abs(mx); turned += dir * frame(mx); }
    for (let k = 0; k < Math.round(gap / dtF); k++) turned += dir * frame(0);
  }
  return { kept: input.usePointerLock && input.locked, applied: turned / wanted };
}

test('flicks at 20 to 60 fps keep the lock and turn the view as far as the hand did', () => {
  for (const fps of [60, 40, 30, 20]) {
    const r = flicks(fps);
    assert.ok(r.kept, `${fps} fps: the lock is kept`);
    assert.ok(r.applied >= 0.9, `${fps} fps: ${(r.applied * 100).toFixed(0)} % of the turn applied`);
  }
});

// M4's blind play-test (3d38bb2): the lock reported nonsense, the game noticed and said "hold
// the left mouse button and drag", but every mousedown took the lock again (the first fall-back
// re-armed it for the next click), so dragging never turned the camera, and the view the
// nonsense had thrown straight up was saved. Now the fall-back holds for the session.
// The pre-ship round (M4's blind play-test, BROKEN 3): every click after the fall-back took the lock
// again, the nonsense with it, and dragging never turned the view. The round made the fall-back
// for the session; the verifier's R4: one glitch of a real browser then left the player dragging
// until a reload. Now the clicks right after a trip drag; a click LOCK_RETRY_MS later tries the lock
// once more; a second trip is for the session.
test('nonsense under the lock: the clicks after it drag and turn the view; a click later tries the lock once more; a second trip is for good', () => {
  const { doc, el, input } = page();
  el.fire('mousedown', { button: 0 });
  assert.equal(input.locked, true);
  let t = 1000;
  const jump = () => { t += 16; doc.fire('mousemove', { movementX: 500 * 0.6, movementY: 0, timeStamp: t }); t += 16; doc.fire('mousemove', { movementX: -500 * 0.6, movementY: 0, timeStamp: t }); };
  for (let i = 0; i < 3; i++) jump();
  assert.equal(input.usePointerLock, false); assert.equal(input.locked, false);
  assert.equal(doc.pointerLockElement, null, 'the lock is let go');
  assert.match(input.message, /hold the left button and drag/);
  assert.equal(input.thrown, true, 'the game is told to level the view');
  assert.equal(input.dx, 0, 'none of it turned the view');
  assert.ok(Math.abs(input._retryAt - performance.now() - LOCK_RETRY_MS) < 1000, 'a later click may try it again');
  doc.fire('mouseup', {});
  // The clicks that follow are drags, never a lock.
  let asked = 0;
  const req = el.requestPointerLock;
  el.requestPointerLock = () => { asked++; return req(); };
  const drags = (n) => {
    for (let k = 0; k < n; k++) {
      el.fire('mousedown', { button: 0, clientX: 300, clientY: 200 });
      assert.equal(input.locked, false, 'click ' + (k + 1) + ' does not take the lock');
      doc.fire('mousemove', { clientX: 300, clientY: 160, movementX: 999, movementY: 999 });
      doc.fire('mouseup', {});
    }
  };
  drags(5);
  assert.equal(asked, 0, 'the lock is not asked for right after the trip');
  let o = input.take(1 / 60);
  assert.equal(o.dy, -200, 'five drags of 40 px up turned the view by 200 px');
  assert.equal(o.dx, 0);
  // LOCK_RETRY_MS later: a click asks for the lock once more (a real browser that glitched once)
  input._retryAt -= LOCK_RETRY_MS;
  el.fire('mousedown', { button: 0, clientX: 300, clientY: 200 });
  assert.equal(asked, 1, 'a later click tries the lock again');
  assert.equal(input.locked, true, 'and has it');
  doc.fire('mouseup', {});
  t += 5000;
  doc.fire('mousemove', { movementX: 12, movementY: -5, timeStamp: (t += 16) });
  o = input.take(1 / 60);
  assert.equal(o.dx, 12, 'the lock turns the view again');
  // a second trip: for the session, however long after
  input.thrown = false;
  for (let i = 0; i < 3; i++) jump();
  assert.equal(input.usePointerLock, false); assert.equal(input.locked, false);
  assert.equal(input.thrown, true);
  assert.match(input.message, /in this browser/);
  doc.fire('mouseup', {});
  input._retryAt -= 1e9;
  drags(3);
  assert.equal(asked, 1, 'never asked for again');
  assert.equal(input.take(1 / 60).dy, -120, 'the drags turn the view');
});

test('a lock that arrives after the fall-back (a request still on its way) is let go at once, and the drag still turns the view', () => {
  const { doc, el, input } = page();
  input.fallBack('Mouse capture is misbehaving in this browser: hold the left button and drag to look');
  doc.pointerLockElement = el; doc.fire('pointerlockchange');
  assert.equal(doc.pointerLockElement, null, 'let go');
  assert.equal(input.locked, false);
  // Even a browser that never lets go (headless keeps the canvas as the lock element) cannot
  // turn the drag into lock moves.
  doc.exitPointerLock = () => {};
  doc.pointerLockElement = el; doc.fire('pointerlockchange');
  el.fire('mousedown', { button: 0, clientX: 100, clientY: 100 });
  doc.fire('mousemove', { clientX: 130, clientY: 100, movementX: 640, movementY: -360 });
  assert.equal(input.take(1 / 60).dx, 30, 'the drag, not the lock\'s nonsense');
});

// What headless Chromium sends for scripted drags under the lock (recorded, run 8): jumps to and
// from the middle of a 640x360 window, out of stillness, seconds apart on a slow page.
test('window-sized jumps out of stillness on a slow page never turn the view', () => {
  const { doc, el, input } = page();
  el.fire('mousedown', { button: 0 });
  const rec = [[-320, -180, 7439], [0, 0, 7568], [0, 0, 7936], [320, 180, 7936], [-320, -180, 8783], [0, 0, 9116], [-320, -180, 9462], [0, 0, 10958], [0, 0, 12354], [330, 173, 12460], [-330, -173, 12897], [0, 0, 13753], [340, 166, 15365], [-340, -166, 17936], [0, 0, 19996], [350, 160, 26698], [-350, -160, 30656], [0, 0, 36204], [-350, -160, 42314], [0, 0, 49203]];
  let turned = 0;
  for (const [mx, my, ts] of rec) { input.take(0.12); doc.fire('mousemove', { movementX: mx, movementY: my, timeStamp: ts }); const r = input.take(0.12); turned += Math.abs(r.dx) + Math.abs(r.dy); }
  assert.equal(turned, 0, 'none of it reached the view');
});

test('opening a panel lets go of the lock', () => {
  const { el, input } = page();
  el.fire('mousedown', { button: 0 });
  assert.equal(input.locked, true);
  input.release();
  assert.equal(input.locked, false);
});

test('keyboard layouts: walking keys by position, action keys by the letter on the key', () => {
  const { doc, input } = page();
  const press = (code, key, extra = {}) => doc.fire('keydown', { code, key, ...extra });
  const lift = (code, key) => doc.fire('keyup', { code, key });
  press('Semicolon', 'm');                                 // AZERTY: M is where QWERTY has ;
  assert.ok(input.edges.has('KeyM'), 'AZERTY M opens the map');
  lift('Semicolon', 'm'); input.take();
  press('KeyW', 'z');                                      // AZERTY: Z is where QWERTY has W
  assert.deepEqual([...input.keys], ['KeyW'], 'AZERTY Z walks forward, by position');
  lift('KeyW', 'z');
  press('KeyB', 'x');                                      // Dvorak: X is where QWERTY has B
  assert.deepEqual([...input.keys], ['KeyX'], 'Dvorak X brakes and does not open the sketchbook');
  lift('KeyB', 'x');
  press('KeyE', 'f');                                      // Colemak: F is where QWERTY has E
  assert.deepEqual([...input.keys], ['KeyF'], 'Colemak F is the pulse, not E as well');
  lift('KeyE', 'f');
  assert.equal(input.keys.size, 0, 'each release lets go of what its press held');
  press('KeyE', 'у');                                      // a Cyrillic layout: by position
  assert.ok(input.keys.has('KeyE')); lift('KeyE', 'у');
  assert.equal(bindingOf('KeyD', 'e'), 'KeyD', 'a letter printed on a walking key stays a walking key (Dvorak E)');
  assert.equal(bindingOf('KeyE', '.'), 'KeyE', 'and that action keeps its QWERTY place');
  const dv = new Map(Object.entries({ KeyW: ',', KeyA: 'a', KeyS: 'o', KeyD: 'e', KeyE: '.', KeyB: 'x', KeyN: 'b' }));
  const L = keyLabels(dv);
  assert.equal([L.KeyW, L.KeyA, L.KeyS, L.KeyD].join(' '), ', A O E');
  assert.equal(L.KeyE, '.', 'Dvorak: board is the . key');
  assert.equal(L.KeyX, 'X');
  assert.equal(keyLabels(new Map(Object.entries({ KeyW: 'z', KeyA: 'q', KeyS: 's', KeyD: 'd' }))).KeyW, 'Z');
  assert.equal(keyLabels(new Map(Object.entries({ KeyW: 'ц' }))).KeyW, 'W', 'what the lettering cannot draw keeps its name');
  assert.equal(keyLabels(null), null);
});

test('a key held through a blur comes back on its repeats; a Cmd chord cannot leave W stuck', () => {
  const { doc, input } = page();
  doc.fire('keydown', { code: 'KeyW', key: 'w' });
  window.fire('blur');
  assert.equal(input.keys.size, 0);
  input.take();
  doc.fire('keydown', { code: 'KeyW', key: 'w', repeat: true });
  assert.ok(input.keys.has('KeyW'), 'held again on the repeat');
  assert.ok(!input.edges.has('KeyW'), 'a repeat is not a fresh press');
  doc.fire('keyup', { code: 'MetaLeft', key: 'Meta' });
  assert.equal(input.keys.size, 0, 'Cmd released: nothing held');
});

test('the wheel: a touchpad swipe is a few small steps, a notch is one', () => {
  const { el, input } = page();
  for (let i = 0; i < 30; i++) el.fire('wheel', { deltaY: 4, deltaMode: 0 });
  let w = input.take().wheel;
  assert.ok(Math.abs(w * 0.8) < 1, `a 120 px swipe moves the boom ${(w * 0.8).toFixed(2)} m`);
  el.fire('wheel', { deltaY: 120, deltaMode: 0 });
  w = input.take().wheel;
  assert.ok(Math.abs(w - 1) < 1e-9, 'one notch is one step (0.8 m)');
  el.fire('wheel', { deltaY: 3, deltaMode: 1 });            // Firefox: lines
  w = input.take().wheel;
  assert.ok(Math.abs(w - 0.4) < 1e-9, 'three lines are 48 px');
});
