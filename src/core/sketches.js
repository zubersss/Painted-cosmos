// The sketchbook's pictures. Pure (no three, no DOM): a small store of data-URL thumbnails, one
// per landscape first walked and one per view found, kept beside the save in its own key (so a
// full or blocked storage can cost a picture, never the player's place). Every touch of the
// storage is inside try/catch.
//
// Budget: one sketch is a 256x144 JPEG of the frame as the sketch's hand redraws it (flat washes,
// a white ragged edge: it packs well), about 6 to 10 kB as a data URL.
// With every page of the book drawn (44 landscapes and 80 views today) that is about 1 MB
// of the 5 MB a browser gives one site. `maxTotal` caps it; past the cap the oldest pictures
// go first (their pages stay in the book as text and are drawn again on the next visit).
export const SKETCH_KEY = 'painted-cosmos.sketches';
export const SKETCH_VERSION = 1;
export const SKETCH = Object.freeze({
  width: 256, height: 144,     // pixels: a sketch, not a screenshot (192 x 108 until M4: the page now shows it large)
  quality: 0.72,               // JPEG quality asked for first...
  qualityLow: 0.5,             // ...and when the first try is over `maxEach`
  maxEach: 16000,              // characters of data URL for one sketch
  maxTotal: 1500000,           // characters for all of them
});

// The slip that shows a new page as it is made. At an arrival (the game's start, a step out of
// the ship) it waits until the explorer has set off, so the first view stays quiet and the slip
// never lies over the ship the player is meant to walk to.
export const SKETCH_SLIP = Object.freeze({
  moved: 4,                    // metres from where the explorer stood at the arrival...
  wait: 25,                    // ...or this many seconds standing there
  seconds: 5,                  // how long the slip stays
  shipWait: 45,                // seconds a new page waits for the parked ship to be out of the middle of the frame
});

// ---- the sketch's hand -----------------------------------------------------------------------
// A page of the sketchbook is a sketch, not a small copy of the finished painting (PAINTER's
// critique, M4 item 2: "a stamp-sized photograph on a slip is the most digital thing on the
// screen"). The kept frame is redrawn here, in place, on its own pixels (RGBA bytes, w x h):
//  - the colours go most of the way to one sepia and graphite ink (a little of the place's own
//    colour stays, as a tint);
//  - the tones are laid as a few flat washes with soft joins, the lights left as bare paper;
//  - what has an edge in the frame gets a pencil line;
//  - toward a ragged edge everything is lifted to white: there is no rectangle. (The page shows
//    it multiplied onto its paper, so white is the paper itself: theme.css.)
// Pure and fixed for a given picture and seed: nothing random at draw time. Returns the pixels,
// or null (and leaves them alone) for a frame with nothing in it.
export const SKETCH_HAND = Object.freeze({
  keep: 0.34,                  // of the frame's own colour left in the wash
  washes: 3,                   // flat tones between paper and the darkest ink
  soft: 0.2,                   // how soft the joins between washes are (0 hard .. 0.5)
  lift: 0.42,                  // the whole sketch is this much lighter than the painting (paper shows)
  gamma: 0.8,                  // the middle tones are laid lighter still
  broad: 2,                    // passes of the broad brush over the tones before they are laid
  pencil: 0.62,                // strength of the pencil line on an edge...
  pencilFrom: 0.42,            // ...and how strong an edge has to be to get one (of the frame's range of tone over three pixels)
  edge: 0.2,                   // of the half-size: where the ragged fade to paper begins, from the border in
  rag: 0.55,                   // how ragged that edge is (0 an even oval .. 1)
  blank: 0.02,                 // a frame whose tones span less than this is taken for an empty canvas
});
const INK_DARK = [58, 50, 52], INK_MID = [128, 104, 84], PENCIL = [62, 60, 66];
function lattice(ix, iy, seed) {
  let h = (Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = lattice(ix, iy, seed), b = lattice(ix + 1, iy, seed), c = lattice(ix, iy + 1, seed), d = lattice(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function sketchHand(px, w, h, seed = 1, H = SKETCH_HAND) {
  const n = w * h, L = new Float32Array(n), T = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = (0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2]) / 255;
  // a broad brush: the tones are taken from the frame a little out of focus (twice over three
  // pixels each way), so a wash is a shape and not a scatter of specks
  for (let pass = 0; pass < H.broad; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) T[y * w + x] = (L[y * w + Math.max(0, x - 1)] + L[y * w + x] + L[y * w + Math.min(w - 1, x + 1)]) / 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = (T[Math.max(0, y - 1) * w + x] + T[y * w + x] + T[Math.min(h - 1, y + 1) * w + x]) / 3;
  }
  // the frame's own range of tones is spread over the washes (a dusk and a noon both read)
  let lo = 1, hi = 0;
  for (let i = 0; i < n; i += 7) { if (L[i] < lo) lo = L[i]; if (L[i] > hi) hi = L[i]; }
  // A frame with nothing in it (a canvas that was read after it was cleared, a lost context) is no
  // sketch: the caller keeps nothing and tries again.
  if (hi - lo < H.blank) return null;
  const span = Math.max(0.15, hi - lo), F = 192 / w;          // (the grain and the rag were set at 192 pixels across)
  const at = (x, y) => L[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = 4 * i;
      // the tone, in flat washes with soft joins (the grain of the paper moves a join a little)
      let t = (L[i] - lo) / span;
      t = Math.pow(Math.min(1, Math.max(0, t + (noise2(x * 0.35 * F, y * 0.35 * F, seed + 5) - 0.5) * 0.05)), H.gamma);
      const q = t * H.washes, f = q - Math.floor(q);
      const step = Math.floor(q) + Math.min(1, Math.max(0, (f - (0.5 - H.soft)) / (2 * H.soft)));
      let tone = Math.min(1, step / H.washes);
      tone = H.lift + (1 - H.lift) * tone;                       // 0 the darkest ink .. 1 bare paper
      // the ink of that tone: graphite in the darks, sepia in the middle, paper in the lights
      const k = tone < 0.5 ? tone / 0.5 : (tone - 0.5) / 0.5;
      let r, g, b;
      if (tone < 0.5) { r = INK_DARK[0] + (INK_MID[0] - INK_DARK[0]) * k; g = INK_DARK[1] + (INK_MID[1] - INK_DARK[1]) * k; b = INK_DARK[2] + (INK_MID[2] - INK_DARK[2]) * k; }
      else { r = INK_MID[0] + (255 - INK_MID[0]) * k; g = INK_MID[1] + (255 - INK_MID[1]) * k; b = INK_MID[2] + (255 - INK_MID[2]) * k; }
      // a tint of the place's own colour, at the wash's tone
      const l = Math.max(1, L[i] * 255), tl = 0.299 * r + 0.587 * g + 0.114 * b;
      r += (px[o] * tl / l - r) * H.keep; g += (px[o + 1] * tl / l - g) * H.keep; b += (px[o + 2] * tl / l - b) * H.keep;
      // the pencil: where the frame has an edge
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const e = Math.min(1, Math.max(0, (Math.hypot(gx, gy) / span - H.pencilFrom) * 2.2)) * H.pencil * (0.6 + 0.4 * noise2(x * 0.5, y * 0.5, seed + 9));
      r += (PENCIL[0] - r) * e; g += (PENCIL[1] - g) * e; b += (PENCIL[2] - b) * e;
      // the ragged edge: lifted to paper
      const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1;
      const inward = 1 - Math.pow(Math.pow(Math.abs(u), 3.2) + Math.pow(Math.abs(v), 3.2), 1 / 3.2);       // 1 in the middle .. 0 on the border
      const rag = (noise2(x * 0.07 * F + 3, y * 0.07 * F + 7, seed) - 0.5) * H.rag * 0.5 + (noise2(x * 0.23 * F, y * 0.23 * F, seed + 2) - 0.5) * H.rag * 0.16;
      let a = (inward + rag * Math.min(1, inward * 7) - 0.035) / H.edge;        // (the rag dies at the border: no ink ever reaches it)
      a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
      px[o] = Math.round(255 + (r - 255) * a); px[o + 1] = Math.round(255 + (g - 255) * a); px[o + 2] = Math.round(255 + (b - 255) * a); px[o + 3] = 255;
    }
  }
  return px;
}

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
