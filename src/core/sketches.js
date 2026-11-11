// The sketchbook's pictures. Pure (no three, no DOM): a small store of data-URL thumbnails, one
// per landscape first walked and one per view found, kept beside the save in its own key (so a
// full or blocked storage can cost a picture, never the player's place). Every touch of the
// storage is inside try/catch.
//
// Budget: one sketch is a 192x108 JPEG of the painted frame, about 5 to 9 kB as a data URL.
// With every page of the book drawn (44 landscapes and 80 views today) that is about 1 MB
// of the 5 MB a browser gives one site. `maxTotal` caps it; past the cap the oldest pictures
// go first (their pages stay in the book as text and are drawn again on the next visit).
export const SKETCH_KEY = 'painted-cosmos.sketches';
export const SKETCH_VERSION = 1;
export const SKETCH = Object.freeze({
  width: 192, height: 108,     // pixels: a thumbnail, not a screenshot
  quality: 0.72,               // JPEG quality asked for first...
  qualityLow: 0.5,             // ...and when the first try is over `maxEach`
  maxEach: 16000,              // characters of data URL for one sketch
  maxTotal: 1500000,           // characters for all of them
});

export const biomeKey = (bodyId, biomeId) => `b:${bodyId}:${biomeId}`;
export const vistaKey = (bodyId, vistaId) => `v:${bodyId}:${vistaId}`;

const okUrl = (u, max) => typeof u === 'string' && u.length > 30 && u.length <= max && u.startsWith('data:image/');

export class SketchStore {
  // storage: localStorage-like, or null (pictures then live for this visit only).
  constructor(storage, opts = {}) {
    this.storage = storage || null;
    this.key = opts.key || SKETCH_KEY;
    this.maxEach = opts.maxEach || SKETCH.maxEach;
    this.maxTotal = opts.maxTotal || SKETCH.maxTotal;
    this.items = {};             // key -> { u: data URL, n: order drawn }
    this.seq = 0;
    this.total = 0;              // characters held
    this.saved = true;           // did the last write reach the storage
    this.load();
  }

  get count() { return Object.keys(this.items).length; }
  has(key) { return !!this.items[key]; }
  get(key) { return this.items[key] ? this.items[key].u : null; }

  // Keep a sketch. Returns false when it is not a picture or is over the size for one sketch.
  put(key, url) {
    if (typeof key !== 'string' || !key || !okUrl(url, this.maxEach)) return false;
    if (this.items[key]) this.total -= this.items[key].u.length;
    this.items[key] = { u: url, n: ++this.seq };
    this.total += url.length;
    this.trim(this.maxTotal, key);
    this.write();
    return true;
  }

  remove(key) {
    if (!this.items[key]) return false;
    this.total -= this.items[key].u.length;
    delete this.items[key];
    this.write();
    return true;
  }

  clear() {
    this.items = {}; this.total = 0; this.seq = 0;
    if (this.storage) { try { this.storage.removeItem(this.key); } catch { /* blocked: nothing to do */ } }
  }

  // Drop the oldest pictures until the total is inside `limit` (never the one just drawn).
  trim(limit, keep) {
    if (this.total <= limit) return 0;
    const old = Object.keys(this.items).filter((k) => k !== keep).sort((a, b) => this.items[a].n - this.items[b].n);
    let dropped = 0;
    for (const k of old) {
      if (this.total <= limit) break;
      this.total -= this.items[k].u.length;
      delete this.items[k];
      dropped++;
    }
    return dropped;
  }

  write() {
    if (!this.storage) { this.saved = false; return false; }
    const text = (items) => JSON.stringify({ version: SKETCH_VERSION, items });
    try { this.storage.setItem(this.key, text(this.items)); this.saved = true; return true; } catch { /* full or blocked */ }
    // The storage is full: store the newest half instead (memory keeps them all for this
    // visit). If even that fails the pictures simply live until the page closes.
    const keys = Object.keys(this.items).sort((a, b) => this.items[b].n - this.items[a].n);
    const some = {};
    let room = Math.floor(this.total / 2);
    for (const k of keys) {
      const n = this.items[k].u.length;
      if (n > room) break;
      some[k] = this.items[k]; room -= n;
    }
    try { this.storage.setItem(this.key, text(some)); this.saved = true; return true; } catch { this.saved = false; return false; }
  }

  load() {
    this.items = {}; this.total = 0; this.seq = 0;
    if (!this.storage) return false;
    let d = null;
    try { d = JSON.parse(this.storage.getItem(this.key) || 'null'); } catch { return false; }
    if (!d || typeof d !== 'object' || d.version !== SKETCH_VERSION || !d.items || typeof d.items !== 'object') return false;
    for (const [k, v] of Object.entries(d.items)) {
      if (!v || !okUrl(v.u, this.maxEach)) continue;
      const n = typeof v.n === 'number' && Number.isFinite(v.n) ? v.n : 0;
      this.items[k] = { u: v.u, n };
      this.total += v.u.length;
      if (n > this.seq) this.seq = n;
    }
    this.trim(this.maxTotal);
    return true;
  }
}
