// Keyboard and mouse. Pointer lock when the browser grants it; when it does not (an embedded
// frame, a headless test), holding the left button and dragging looks around instead.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyV', 'KeyC', 'KeyX', 'Space', 'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyF', 'KeyM', 'Backquote',
]);

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
    this._lx = 0; this._ly = 0;
    this._pm = null; this._odd = []; this._doc = doc;

    doc.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;       // leave browser shortcuts alone
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) { this.edges.add(e.code); this.keys.add(e.code); this.used = true; }
    });
    doc.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });

    el.addEventListener('mousedown', (e) => {
      this.used = true;
      if (e.button !== 0) return;
      this.dragging = true; this._lx = e.clientX; this._ly = e.clientY;
      if (this.usePointerLock && !this.locked && el.requestPointerLock) {
        try {
          const p = el.requestPointerLock();
          if (p && p.catch) p.catch(() => this.fallBack('Mouse capture was refused here: hold the left button and drag to look'));
        } catch { this.fallBack('Mouse capture is not available here: hold the left button and drag to look'); }
      }
    });
    doc.addEventListener('mouseup', () => { this.dragging = false; });
    doc.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // Some browsers report one enormous delta when the lock is taken or focus returns.
        const mx = e.movementX || 0, my = e.movementY || 0;
        if (this.suspicious(mx, my, e.timeStamp)) return;
        if (Math.abs(mx) < 400 && Math.abs(my) < 400) { this.dx += mx; this.dy += my; }
      }
      else if (this.dragging) {
        this.dx += e.clientX - this._lx; this.dy += e.clientY - this._ly;
        this._lx = e.clientX; this._ly = e.clientY;
      }
    });
    doc.addEventListener('pointerlockchange', () => { this.locked = doc.pointerLockElement === el; this._pm = null; });
    doc.addEventListener('pointerlockerror', () => this.fallBack('Mouse capture was refused here: hold the left button and drag to look'));
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Give up on pointer lock for this session and say so: drag-look always works.
  fallBack(text) {
    if (!this.usePointerLock) return;
    this.usePointerLock = false;
    this.message = text;
    this.dx = 0; this.dy = 0; this.dragging = false;
    try { if (this._doc.pointerLockElement === this.el) this._doc.exitPointerLock(); } catch { /* ignore */ }
  }

  // Under a pointer lock some environments report nonsense: jumps the size of the window that
  // are taken back by the very next event, or a stream of huge deltas. A real hand cannot do
  // either. Three such events within a second and a half: stop trusting the lock.
  suspicious(mx, my, time) {
    const big = Math.abs(mx) >= 120 || Math.abs(my) >= 120;
    const pm = this._pm;
    const cancels = big && pm && Math.abs(mx + pm.x) <= 2 && Math.abs(my + pm.y) <= 2;
    const spike = Math.abs(mx) >= 400 || Math.abs(my) >= 400;
    this._pm = { x: mx, y: my };
    if (!cancels && !spike) return false;
    const t = time || 0;
    this._odd = this._odd.filter((x) => t - x < 1500);
    this._odd.push(t);
    if (cancels && Math.abs(pm.x) < 400 && Math.abs(pm.y) < 400) { this.dx -= pm.x; this.dy -= pm.y; }   // take back the jump just undone
    if (this._odd.length >= 3) this.fallBack('Mouse capture is misbehaving in this browser: hold the left button and drag to look');
    return true;
  }

  down(code) { return this.keys.has(code); }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }

  // Everything that happened since the last frame, consumed once.
  take() {
    const out = { edges: this.edges, dx: this.dx, dy: this.dy, wheel: this.wheel };
    this.edges = new Set(); this.dx = 0; this.dy = 0; this.wheel = 0;
    return out;
  }
}
