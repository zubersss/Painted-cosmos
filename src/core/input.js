// Keyboard and mouse. Pointer lock when the browser grants it; when it does not (an embedded
// frame, a headless test), holding the left button and dragging looks around instead.
// A gamepad, when one is connected, feeds the same axes, keys and look (src/core/gamepad.js);
// so do the fingers on a phone or a tablet (src/core/touch.js: input.touch, merged in take()).
// A touch never asks for pointer lock.
//
// Keys (hardening review P6): walking and flying keys are read by POSITION (e.code: W A S D,
// Space, Shift, the arrows sit where they sit on any layout), the action keys by the LETTER on
// the key (e.key: E board, V view, C stroll/sink, X brake, F pulse, M map, B book, H help), so
// "press E" means the key with E on it on AZERTY, Dvorak and Colemak too. A key that prints no
// Latin letter (a Cyrillic or Greek layout) keeps its position; a printed action letter that sits
// on a walking key (Dvorak's E is QWERTY's D) stays a walking key, and that action keeps its
// QWERTY position (keyLabels() names that key for the prompts, where the browser can say).
import { readPad } from './gamepad.js';
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyV', 'KeyC', 'KeyX', 'Space', 'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyF', 'KeyM', 'KeyB', 'KeyH', 'Backquote',
]);
// Read by position whatever they print.
export const POSITION_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backquote', 'Enter', 'Escape']);
// Read by the letter printed on the key.
export const ACTION_KEYS = new Set(['KeyE', 'KeyV', 'KeyC', 'KeyX', 'KeyF', 'KeyM', 'KeyB', 'KeyH']);

// Which binding a key press is: its position for walking keys; the printed letter for an action
// letter; else its position (so an action whose letter sits on a walking key, or is printed
// nowhere, still has its QWERTY place). Each key press is exactly one binding.
export function bindingOf(code, key) {
  if (POSITION_KEYS.has(code)) return code;
  if (typeof key === 'string' && key.length === 1) {
    const c = key.toUpperCase();
    if (c >= 'A' && c <= 'Z') {
      const byLetter = 'Key' + c;
      if (ACTION_KEYS.has(byLetter)) return byLetter;
    }
  }
  return code;
}

// The label to print for each binding, from a keyboard layout map (navigator.keyboard.getLayoutMap(),
// Chromium only: code -> printed character). Walking keys: what is printed there ("Z Q S D" on
// AZERTY). Action keys: their letter, unless that letter sits on a walking key (then the key that
// does the action, by position). Without a map: null (the QWERTY names stand).
export function keyLabels(layout) {
  if (!layout || typeof layout.get !== 'function') return null;
  const out = {};
  // Only what the hand lettering can draw (src/ui/lettering.js); anything else keeps its name.
  const up = (v) => (typeof v === 'string' && /^[A-Z0-9.,;:\/\-=`]$/.test(v.toUpperCase()) ? v.toUpperCase() : null);
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) out[code] = up(layout.get(code)) || code.slice(3);
  const where = {};
  try { for (const [code, ch] of layout.entries ? layout.entries() : layout) if (typeof ch === 'string' && ch.length === 1) where[ch.toUpperCase()] = code; } catch { /* a map without entries: letters stand */ }
  for (const code of ACTION_KEYS) {
    const letter = code.slice(3), at = where[letter];
    out[code] = at && POSITION_KEYS.has(at) ? up(layout.get(code)) || letter : letter;
  }
  return out;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const NO_TAPS = Object.freeze([]);
export const LOCK_RETRY_MS = 15000;     // after the lock's first trip, a click this much later tries it again

export class Input {
  // opts.pointerLock: false keeps to drag-look (for embeds and for headless tests, where
  // synthetic mouse events under pointer lock report meaningless movement).
  constructor(el, opts = {}, doc = document) {
    this.el = el;
    this.usePointerLock = opts.pointerLock !== false;
    this.keys = new Set();
    this.edges = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.locked = false;
    this.dragging = false;
    this.used = false;                    // any input at all yet (for the first-run hint)
    this.message = null;                  // one line for the HUD when the mouse mode changes
    this.looked = false;                  // has the player looked around yet (lock or drag)
    this._lx = 0; this._ly = 0;
    this._pm = null; this._odd = []; this._doc = doc;
    this._held = new Map();               // e.code -> the binding its keydown pressed
    this._frameMs = 16.7;                 // the game's frame time, smoothed (take())
    this._px = 0; this._py = 0;           // the last movement under the lock
    this._unlockAt = -1e9;                // when the lock was last let go
    this._req = 0; this._refusedReq = -1; this._refusals = 0;
    this._trips = 0;
    this._retryAt = Infinity;             // after the lock's first trip: from when a click may try it once more
    this.thrown = false;                  // the lock reported nonsense before it was dropped: the game levels the view
    this.inShip = false;                  // set by the game: the triggers are the throttle in the ship
    this.pad = null;                      // the gamepad's last reading (null without one)
    this._padButtons = null;
    this.touch = null;                    // the touch layer's pad (src/core/touch.js attachTouch), if any
    this.lastDevice = 'keys';             // the last hand on the game: 'keys' (keyboard, mouse) or 'pad' (src/core/words.js names the controls by it)

    doc.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;       // leave browser shortcuts alone
      const b = bindingOf(e.code, e.key);
      if (!b) { this._held.set(e.code, null); return; }
      if (GAME_KEYS.has(b)) e.preventDefault();
      // A key held through a blur comes back on its repeats; only a fresh press is an edge.
      const was = this._held.get(e.code);
      if (was && was !== b) this.keys.delete(was);
      this._held.set(e.code, b);
      this.keys.add(b);
      if (!e.repeat) { this.edges.add(b); this.used = true; this.lastDevice = 'keys'; }
    });
    doc.addEventListener('keyup', (e) => {
      // Release what this key's press held (not another key's binding of the same name).
      if (this._held.has(e.code)) { const b = this._held.get(e.code); this._held.delete(e.code); if (b) this.keys.delete(b); }
      else this.keys.delete(bindingOf(e.code, e.key) || e.code);
      // macOS sends no keyup for keys released while Cmd was down: let go of everything.
      if (e.key === 'Meta' || e.code === 'MetaLeft' || e.code === 'MetaRight') { this.keys.clear(); this._held.clear(); }
    });
    window.addEventListener('blur', () => { this.keys.clear(); this._held.clear(); this.dragging = false; });

    el.addEventListener('mousedown', (e) => {
      this.used = true;
      // A mouse event a browser makes up from a touch is not a mouse: no drag, no pointer lock
      // (the canvas's touchstart is cancelled, so there should be none; this is the belt).
      if (this.fromTouch(e)) return;
      this.lastDevice = 'keys';
      if (e.button !== 0) return;
      this.dragging = true; this._lx = e.clientX; this._ly = e.clientY;
      // After the lock's first trip into nonsense the game drags; a click LOCK_RETRY_MS later
      // tries the lock once more (a real browser that glitched once is not left on dragging for
      // the visit: the pre-ship verifier's R4); a second trip is for the session. (A click right
      // after the trip does not take it back: in M4's blind play-test every mousedown captured
      // the pointer again, the nonsense with it, the view thrown straight up, dragging dead.)
      if (!this.usePointerLock && this._trips === 1 && now() >= this._retryAt) {
        this._retryAt = Infinity; this.usePointerLock = true; this._odd = []; this._pm = null;
      }
      if (this.usePointerLock && !this.locked && el.requestPointerLock) {
        const req = ++this._req;
        try {
          const p = el.requestPointerLock();
          if (p && p.catch) p.catch(() => this.refused(req));
        } catch { this.fallBack('Mouse capture is not available here: hold the left button and drag to look'); }
      }
    });
    doc.addEventListener('mouseup', () => { this.dragging = false; });
    doc.addEventListener('mousemove', (e) => {
      if (this.locked && this.usePointerLock) {
        // Some browsers report one enormous delta when the lock is taken or focus returns. The
        // browser sends one move per frame: at 30 fps each carries two 60 Hz frames of a flick,
        // so the line for an impossible delta grows with the frame time (at most threefold).
        const mx = e.movementX || 0, my = e.movementY || 0;
        const k = Math.min(3, Math.max(1, this._frameMs / 16.7));
        if (this.suspicious(mx, my, e.timeStamp, k)) return;
        if (Math.abs(mx) < 400 * k && Math.abs(my) < 400 * k) { this.dx += mx; this.dy += my; }
      }
      else if (this.dragging) {
        this.looked = true;
        this.dx += e.clientX - this._lx; this.dy += e.clientY - this._ly;
        this._lx = e.clientX; this._ly = e.clientY;
      }
    });
    doc.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      // A lock that arrives after the game has given up on it (a request still on its way) is
      // let go at once.
      if (!this.usePointerLock && doc.pointerLockElement === el) { try { doc.exitPointerLock(); } catch { /* ignore */ } this.locked = false; return; }
      this.locked = doc.pointerLockElement === el; this._pm = null; this._px = 0; this._py = 0;
      if (this.locked) { this.looked = true; this._refusals = 0; }
      else if (was) { this.looked = false; this._unlockAt = now(); }   // lost the lock: show the hint again
    });
    doc.addEventListener('pointerlockerror', () => this.refused(this._req));
    // A wheel notch is 120 (in pixels); a touchpad sends many small deltas: add them up, so one
    // swipe is not a dozen full steps of the camera boom.
    el.addEventListener('wheel', (e) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      this.wheel += Math.max(-3, Math.min(3, ((e.deltaY || 0) * unit) / 120));
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Did this mouse event come from a finger? (Chromium says so; elsewhere a touch in the last second.)
  fromTouch(e) {
    if (e && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return true;
    const t = this.touch;
    return !!t && (t.clock ? t.clock() : now() / 1000) - t.lastAt < 1;
  }

  // Let go of the mouse (a panel opened: the map and the sketchbook want the cursor).
  release() {
    try { if (this._doc.pointerLockElement === this.el) this._doc.exitPointerLock(); } catch { /* ignore */ }
  }

  // The browser refused a lock request (both the promise and pointerlockerror may say so: one
  // refusal per request). Chrome refuses for about 1.25 s after the player pressed Esc, which
  // is what the help tells them to do: say "click again" and keep trying. Only refusals that
  // keep coming (an embedded frame, a policy) give up on the lock, at the third.
  refused(req) {
    if (!this.usePointerLock || req === this._refusedReq) return;
    this._refusedReq = req;
    if (now() - this._unlockAt < 1500) { this.message = 'Click again to capture the mouse'; return; }
    if (++this._refusals >= 3) this.fallBack('Mouse capture was refused here: hold the left button and drag to look');
    else this.message = 'Mouse capture was refused: click again, or hold the left button and drag to look';
  }

  // Give up on pointer lock and say so: drag-look always works.
  fallBack(text) {
    if (!this.usePointerLock) return;
    this.usePointerLock = false;
    this.message = text;
    this.dx = 0; this.dy = 0; this.dragging = false;
    try { if (this._doc.pointerLockElement === this.el) this._doc.exitPointerLock(); } catch { /* ignore */ }
    this.locked = false;                  // (whether or not the browser says so: the moves are the drag's now)
  }

  // Under a pointer lock some environments report nonsense: jumps the size of the window that
  // are taken back by the very next event, or a stream of huge deltas. A real hand cannot do
  // either. A large delta is therefore held back for one event: if the next one undoes it,
  // both are dropped; if not, it was a real flick and is applied. Three undone jumps (or
  // impossible spikes) within a second and a half: stop trusting the lock; the first time a
  // click LOCK_RETRY_MS later tries it again, the second time it is for the session.
  // k: how many 60 Hz frames one event covers (1 to 3): the spike line scales with it; every
  // large delta, whatever the frame rate, goes through the test above.
  // Returns true when this event has been dealt with here.
  suspicious(mx, my, time, k = 1) {
    const big = Math.abs(mx) >= 120 || Math.abs(my) >= 120;
    const spike = Math.abs(mx) >= 400 * k || Math.abs(my) >= 400 * k;
    const held = this._pm, px = this._px, py = this._py;
    this._pm = null; this._px = mx; this._py = my;
    let odd = spike;
    if (held) {
      const undone = big && Math.abs(mx + held.x) <= 2 && Math.abs(my + held.y) <= 2;
      // A real fast movement has neighbours going the same way: the hand sped up into it, or
      // carries on after it (at 30 fps the last frame of a flick can be a tenth of the one
      // before). A lone window-sized jump out of stillness, with stillness after it, has neither.
      const follows = mx * held.x + my * held.y > 0 && Math.hypot(mx, my) >= 0.15 * Math.hypot(held.x, held.y);
      if (undone) { odd = true; this.finishOdd(time); return true; }
      if (follows || held.led) { this.dx += held.x; this.dy += held.y; } else odd = true;
    }
    if (big && !spike) {
      const led = mx * px + my * py > 0 && Math.hypot(px, py) >= Math.max(4, 0.08 * Math.hypot(mx, my));
      this._pm = { x: mx, y: my, led };
    }
    if (odd) this.finishOdd(time);
    return big || spike;
  }

  finishOdd(time) {
    const t = time || 0;
    this._odd = this._odd.filter((x) => t - x < 1500);
    this._odd.push(t);
    if (this._odd.length < 3 || !this.usePointerLock) return;
    this._odd = [];
    this._trips++;
    this.thrown = true;
    if (this._trips === 1) {
      this.fallBack('Mouse capture misbehaved: hold the left button and drag to look (a later click tries capture again)');
      this._retryAt = now() + LOCK_RETRY_MS;
    } else this.fallBack('Mouse capture is misbehaving in this browser: hold the left button and drag to look');
  }

  down(code) {
    if (this.keys.has(code)) return true;
    const p = this.pad;
    if (p && (p.held.includes(code) || (code === 'ShiftLeft' && p.run && !this.inShip))) return true;
    const t = this.touch;
    return !!t && (t.holds(code) || (code === 'ShiftLeft' && t.run && !this.inShip));
  }

  // -1..1: keys give the ends, the gamepad's sticks (and, in the ship, its triggers) and the
  // touch stick the range between.
  axis(neg, pos) {
    let v = (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    const p = this.pad;
    if (p) {
      if (neg === 'KeyA' && pos === 'KeyD') v += p.moveX;
      else if (neg === 'KeyS' && pos === 'KeyW') v += p.moveY + (this.inShip ? p.throttle : 0);
    }
    const t = this.touch;
    if (t) {
      if (neg === 'KeyA' && pos === 'KeyD') v += t.moveX;
      else if (neg === 'KeyS' && pos === 'KeyW') v += t.moveY;
    }
    return v > 1 ? 1 : v < -1 ? -1 : v;
  }

  // The first connected gamepad in the standard layout, read once a frame. Never throws (the API
  // may be missing or blocked). Any other device (a flight stick's throttle, wheel pedals, a pad
  // the browser cannot map) is ignored: its axes can rest at -1 or +1 and would read as a stick
  // held hard over (the camera spinning, the title card starting by itself). Said once.
  pollPad(dt) {
    let pad = null, other = false;
    try {
      const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
      if (list) for (const g of list) {
        if (!g || g.connected === false || !g.buttons || !g.axes) continue;
        if (g.mapping === 'standard') { pad = g; break; }
        other = true;
      }
    } catch { pad = null; }
    if (!pad && other && !this._otherSaid) {
      this._otherSaid = true;
      this.message = 'A controller that is not a standard gamepad is connected: it is not used';
    }
    if (!pad) { this.pad = null; this._padButtons = null; return; }
    const r = readPad(pad, this._padButtons, dt);
    this._padButtons = r.buttons;
    this.pad = r;
    for (const code of r.edges) this.edges.add(code);
    this.dx += r.lookX; this.dy += r.lookY;
    if (r.active) { this.used = true; this.lastDevice = 'pad'; }
    if (Math.abs(r.lookX) + Math.abs(r.lookY) > 0.5) this.looked = true;
  }

  // Everything that happened since the last frame, consumed once. dt: seconds since the last call.
  // taps: fingers that tapped the picture (the game closes an open panel on one).
  take(dt = 1 / 60) {
    if (dt > 0) this._frameMs += (Math.min(100, dt * 1000) - this._frameMs) * 0.2;
    this.pollPad(Math.min(0.1, dt));
    let taps = NO_TAPS;
    const t = this.touch;
    if (t) {
      const r = t.frame(Math.min(0.1, Math.max(0, dt)));
      for (const code of r.edges) this.edges.add(code);
      this.dx += r.dx; this.dy += r.dy; this.wheel += r.wheel;
      if (t.used) this.used = true;
      if (t.looked) this.looked = true;
      if (r.taps.length) taps = r.taps;
    }
    const out = { edges: this.edges, dx: this.dx, dy: this.dy, wheel: this.wheel, taps };
    this.edges = new Set(); this.dx = 0; this.dy = 0; this.wheel = 0;
    return out;
  }
}
