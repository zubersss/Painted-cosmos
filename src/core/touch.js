// Touch (W3.1 of the sharp-smooth plan): the game played with the fingers on a phone or a
// tablet, through the same Input as the keyboard, the mouse and the gamepad (src/core/input.js
// merges this pad's reading in take(), axis() and down()), so the simulation does not know
// which hand is on it.
//
//   the left 40 % of the picture   a floating stick: where the thumb lands is its centre, 56 css
//                                  px out is full deflection, 8 px of dead zone; held at the rim
//                                  for 0.25 s it runs. In the ship X turns, Y moves the throttle.
//   the rest of the picture        a relative drag looks round, or points the nose in the ship
//   two fingers there              a pinch: the camera nearer or farther (the wheel's boom)
//   the touch HUD's controls       press the codes the keys press (src/ui/hud.js: JUMP/RISE is
//                                  Space, SINK C, BRAKE X; the prompts and the tabs are taps)
//
// The gesture guard: the canvas and the controls keep every touch to themselves (touch-action
// none in theme.css, a non-passive touchstart preventDefault here, Safari's gesture events), so
// the browser neither scrolls nor zooms the page, and sends none of the compatibility mouse
// events that would ask for pointer lock. Pointer events are taken only from pointerType
// 'touch', and each finger is captured by the element it landed on.
//
// The touch layer shows on the first touch, or from the start where the pointer is coarse and
// the screen takes touches; a key press or a real mouse move hides it again (a tablet with a
// keyboard, a laptop with a touch screen). Without a touch, nothing here does anything.

export const TOUCH = Object.freeze({
  stickShare: 0.4,      // the left share of the picture where a finger is the stick
  stickR: 56,           // css px from the centre: full deflection
  dead: 8,              // css px of dead zone round the centre
  runAt: 0.92,          // deflection that counts as "at the rim"
  runHold: 0.25,        // s at the rim before the explorer runs
  // Degrees of turn per css px dragged on foot: about 210 degrees across an iPhone 14 held
  // sideways (750 css px). Per css px, not per screen width: a thumb's travel is a physical
  // distance, and a css px is about the same size on a phone and a tablet (a ruling, PILOT notes).
  lookDeg: 0.28,
  mouseFoot: 0.0023,    // = sim.js FEEL.mouseFoot, rad per mouse px (tests/touch.test.mjs holds them equal)
  pinchPx: 60,          // css px of change in the fingers' spread for one notch of the wheel
  tapPx: 14,            // a finger that moved less than this ...
  tapMs: 400,           // ... and lifted within this is a tap
  idle: 4,              // s untouched before the controls fade
});

// Mouse px of look per css px of drag: the game's look is in mouse px (FEEL.mouseFoot on foot,
// FEEL.mouseShip in the ship, so the nose turns at about three quarters of the foot's rate).
export const LOOK_GAIN = (TOUCH.lookDeg * Math.PI / 180) / TOUCH.mouseFoot;

// The fingers, as numbers. No DOM: attachTouch() below feeds it from pointer events, the tests
// feed it by hand. Times are seconds on the caller's clock; positions css px.
export class TouchPad {
  constructor(T = TOUCH) {
    this.T = T;
    this.fingers = new Map();     // pointerId -> { role, x0, y0, x, y, t0, travel }
    this.stick = null;            // { id, cx, cy, x, y }: the stick's centre and its thumb
    this.lookId = null;           // the finger that looks
    this.pinch = null;            // { a, b, d }: two fingers and their last spread
    this.moveX = 0; this.moveY = 0; this.mag = 0;
    this.run = false; this._rim = 0;
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.held = new Map();        // pointerId -> code, a control held down
    this.edges = new Set();
    this.taps = [];               // fingers that tapped the picture since the last frame
    this.lastAt = -Infinity;      // when a finger last did anything
    this.shown = false;           // is the touch layer up (attachTouch)
    this.used = false; this.looked = false;
  }

  // A finger lands on the picture (not on a control). w: the picture's css width. Returns its role.
  down(id, x, y, t, w) {
    this.lastAt = t; this.used = true;
    const f = { role: 'idle', x0: x, y0: y, x, y, t0: t, travel: 0 };
    this.fingers.set(id, f);
    if (x < w * this.T.stickShare && !this.stick) {
      f.role = 'stick';
      this.stick = { id, cx: x, cy: y, x, y };
      this.moveX = 0; this.moveY = 0; this.mag = 0;
    } else if (this.lookId == null && !this.pinch) {
      f.role = 'look'; this.lookId = id;
    } else if (this.lookId != null && !this.pinch) {
      // a second finger beside the one that looks: the two pinch (and the look waits)
      const fa = this.fingers.get(this.lookId);
      this.pinch = { a: this.lookId, b: id, d: Math.hypot(x - fa.x, y - fa.y) };
      fa.role = 'pinch'; f.role = 'pinch'; this.lookId = null;
    }
    return f.role;
  }

  move(id, x, y, t) {
    const f = this.fingers.get(id);
    if (!f) return;
    this.lastAt = t;
    const mx = x - f.x, my = y - f.y;
    f.x = x; f.y = y;
    f.travel = Math.max(f.travel, Math.hypot(x - f.x0, y - f.y0));
    if (f.role === 'stick') this._stickTo(x, y);
    else if (f.role === 'look') {
      this.dx += mx * LOOK_GAIN; this.dy += my * LOOK_GAIN;
      if (mx || my) this.looked = true;
    } else if (f.role === 'pinch' && this.pinch) {
      const p = this.pinch, fa = this.fingers.get(p.a), fb = this.fingers.get(p.b);
      if (fa && fb) {
        const d = Math.hypot(fa.x - fb.x, fa.y - fb.y);
        this.wheel -= (d - p.d) / this.T.pinchPx;          // fingers apart: nearer (the wheel rolled up)
        p.d = d;
      }
    }
  }

  // The stick's centre follows a thumb that runs on past the rim, so turning back is at once.
  _stickTo(x, y) {
    const s = this.stick, T = this.T;
    s.x = x; s.y = y;
    let ox = x - s.cx, oy = y - s.cy, d = Math.hypot(ox, oy);
    if (d > T.stickR) {
      const k = (d - T.stickR) / d;
      s.cx += ox * k; s.cy += oy * k;
      ox = x - s.cx; oy = y - s.cy; d = T.stickR;
    }
    const m = d <= T.dead ? 0 : Math.min(1, (d - T.dead) / (T.stickR - T.dead));
    this.mag = m;
    this.moveX = d > 0 ? (ox / d) * m : 0;
    this.moveY = d > 0 ? (-oy / d) * m : 0;            // up the screen is forward
  }

  // A finger lifts (or the browser takes it: cancelled). Returns what it was.
  up(id, t, cancelled = false) {
    this.held.delete(id);
    const f = this.fingers.get(id);
    if (!f) return null;
    this.fingers.delete(id);
    this.lastAt = t;
    if (f.role === 'stick') { this.stick = null; this.moveX = 0; this.moveY = 0; this.mag = 0; this._rim = 0; this.run = false; }
    else if (f.role === 'look') this.lookId = null;
    else if (f.role === 'pinch' && this.pinch) {
      // the finger left on the picture looks again, from where it is
      const other = this.pinch.a === id ? this.pinch.b : this.pinch.a;
      this.pinch = null;
      const fo = this.fingers.get(other);
      if (fo) { fo.role = 'look'; this.lookId = other; }
    }
    if (!cancelled && f.travel < this.T.tapPx && t - f.t0 < this.T.tapMs / 1000) this.taps.push({ x: f.x, y: f.y, role: f.role });
    return f;
  }

  // A control held down by a finger (JUMP: a tap jumps, a hold is the jetpack) ...
  press(code, id, t) { this.held.set(id, code); this.edges.add(code); this.lastAt = t; this.used = true; }
  release(id) { this.held.delete(id); }
  // ... or tapped (a prompt, a tab: only the press counts, so a slip that goes away under the
  // finger cannot leave its key held down).
  tap(code, t) { this.edges.add(code); this.lastAt = t; this.used = true; }
  holds(code) { for (const c of this.held.values()) if (c === code) return true; return false; }

  // Every finger off (the window lost focus, the layer was put away).
  reset() {
    this.fingers.clear(); this.held.clear();
    this.stick = null; this.lookId = null; this.pinch = null;
    this.moveX = 0; this.moveY = 0; this.mag = 0; this.run = false; this._rim = 0;
  }

  // Once a frame (Input.take): the run timer, then what gathered since the last frame, consumed.
  frame(dt) {
    const T = this.T;
    if (this.stick && this.mag >= T.runAt) this._rim += dt;
    else if (!this.stick || this.mag < T.runAt * 0.8) this._rim = 0;
    this.run = !!this.stick && this._rim >= T.runHold;
    const out = { edges: this.edges, dx: this.dx, dy: this.dy, wheel: this.wheel, taps: this.taps };
    this.edges = new Set(); this.dx = 0; this.dy = 0; this.wheel = 0; this.taps = [];
    return out;
  }

  idle(t) { return t - this.lastAt > this.T.idle; }
}

// Wire the pad to the page: fingers on `el` (the canvas) are the stick, the look and the pinch;
// the touch HUD's controls call pad.press / tap / release themselves. Returns the pad (also
// input.touch). Never throws on a browser without pointer events: then it is simply never fed.
export function attachTouch(input, el, { doc = document, win = window } = {}) {
  const pad = new TouchPad();
  input.touch = pad;
  const now = () => ((win.performance && win.performance.now) ? win.performance.now() : Date.now()) / 1000;
  let touchAt = -Infinity, mouseTravel = 0;
  const show = (on) => {
    if (pad.shown === !!on) return;
    pad.shown = !!on;
    if (!on) pad.reset();
  };
  // The guard: no scroll, no zoom, no compatibility mouse events from a finger on the picture.
  const keep = (e) => { if (e.cancelable) e.preventDefault(); };
  el.addEventListener('touchstart', keep, { passive: false });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) doc.addEventListener(g, keep, { passive: false });
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    try { el.setPointerCapture(e.pointerId); } catch { /* the finger is still followed */ }
    touchAt = now(); show(true);
    pad.down(e.pointerId, e.clientX, e.clientY, touchAt, win.innerWidth || 1);
    input.used = true;
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    pad.move(e.pointerId, e.clientX, e.clientY, now());
  });
  el.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') pad.up(e.pointerId, now(), false); });
  el.addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') pad.up(e.pointerId, now(), true); });
  // Shown on a touch anywhere; put away by a key or a real mouse (not the moves a browser may
  // make up from a touch, which are mouse events without a pointer of their own).
  doc.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') { touchAt = now(); show(true); }
    else if (e.pointerType === 'mouse' && now() - touchAt > 1) show(false);
  }, { capture: true, passive: true });
  doc.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !pad.shown || now() - touchAt < 1) { mouseTravel = 0; return; }
    mouseTravel += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    if (mouseTravel > 24) show(false);
  }, { passive: true });
  doc.addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey) show(false); }, { capture: true });
  win.addEventListener('blur', () => pad.reset());
  // A phone or a tablet: the controls are there from the start.
  try {
    const coarse = win.matchMedia && win.matchMedia('(pointer: coarse)').matches;
    const nav = win.navigator || {};
    if (coarse && ((nav.maxTouchPoints || 0) > 0 || 'ontouchstart' in win)) show(true);
  } catch { /* no media queries: the first touch shows them */ }
  pad.show = show;
  pad.clock = now;
  return pad;
}
