// Keyboard and mouse. Pointer lock when the browser grants it; when it does not (an embedded
// frame, a headless test), holding the left button and dragging looks around instead.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyV', 'KeyC', 'KeyX', 'Space', 'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
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
    this._lx = 0; this._ly = 0;

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
        try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* drag-look instead */ }
      }
    });
    doc.addEventListener('mouseup', () => { this.dragging = false; });
    doc.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // Some browsers report one enormous delta when the lock is taken or focus returns.
        const mx = e.movementX || 0, my = e.movementY || 0;
        if (Math.abs(mx) < 400 && Math.abs(my) < 400) { this.dx += mx; this.dy += my; }
      }
      else if (this.dragging) {
        this.dx += e.clientX - this._lx; this.dy += e.clientY - this._ly;
        this._lx = e.clientX; this._ly = e.clientY;
      }
    });
    doc.addEventListener('pointerlockchange', () => { this.locked = doc.pointerLockElement === el; });
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
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
