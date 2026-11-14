// The sketchbook: one page per world, with a small sketch for every landscape walked and every
// view found (kept at the moment it happened), and empty frames for the ones still to find.
// B opens and closes it; the arrow keys (or a click on a tab) turn the pages.
// Painted like the rest of the interface (src/ui/paint.js): torn paper, hand lettering.
import { ink, SIZE, CLOSE_SVG } from './paint.js';
import { wrapLettering } from './layout.js';
import { words as sayFor } from '../core/words.js';

// On a touch screen (W3.3) nothing in the book is lettered smaller than this (cap height, css px):
// the sheet is not scaled down there, so this is its size on the screen.
export const BOOK_TOUCH_MIN = 11.5;

// el(tag, class, parent, text, size): `text` is lettered by hand at `size` (cap height, px).
function el(tag, cls, parent, text, size) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) ink(e, text, size || SIZE.small);
  if (parent) parent.appendChild(e);
  return e;
}

// A count in words, as one would pencil it ("five more landscapes").
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const words = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const plural = (n, one, many) => `${words(n)} more ${n === 1 ? one : many}`;
// How wide a sketch is laid on the page (px), by how many the page holds: large and loose while
// they are few. The page itself never changes size (one scale for the whole book).
const tileWidth = (n) => (n <= 1 ? 420 : n <= 2 ? 310 : n <= 6 ? 205 : n <= 12 ? 152 : 120);

// On a touch screen (W3.2): a corner closes the book (press('KeyB'): the game puts it away), and a
// swipe across the page turns it (onTurn: the paper's sound). mode(): the hand on the game
// ('keys', 'touch', 'pad': src/core/words.js), for the line at the foot.
export function createBook(root, { press, onTurn, mode } = {}) {
  const panel = el('div', 'pc-panel pc-book', root);
  const close = el('div', 'pc-close', panel);
  close.innerHTML = CLOSE_SVG;
  close.addEventListener('touchstart', (ev) => { if (ev.cancelable) ev.preventDefault(); }, { passive: false });
  close.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); if (press) press('KeyB'); });
  // A swipe: a finger that went 48 css px or more across, more across than up or down.
  let swipe = null;
  panel.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'touch' && !swipe) swipe = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; });
  const lift = (ev) => {
    if (!swipe || ev.pointerId !== swipe.id) return;
    const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
    swipe = null;
    if (ev.type === 'pointerup' && Math.abs(dx) >= 48 && Math.abs(dx) > 1.4 * Math.abs(dy) && open && pages.length) {
      at = (at + (dx < 0 ? 1 : -1) + pages.length) % pages.length;
      draw();
      if (onTurn) onTurn();
    }
  };
  panel.addEventListener('pointerup', lift);
  panel.addEventListener('pointercancel', lift);
  const head = el('div', 'pc-book-head', panel);
  ink(el('div', 'pc-title', head), 'sketchbook', SIZE.head + 3, { rough: true, tracking: 1.1 });
  const body = el('div', 'pc-book-body', panel);
  const tabs = el('div', 'pc-book-tabs', body);
  const page = el('div', 'pc-book-page', body);
  const foot = el('div', 'pc-label pc-book-foot', panel, '');
  let open = false, pages = [], at = 0, hintText = '';
  const touchOn = () => root.classList.contains('pc-touch');
  // a size, or the touch screen's least
  const sz = (s) => (touchOn() ? Math.max(s, BOOK_TOUCH_MIN) : s);

  // Pages drawn: a landscape walked, a view drawn from its easel (found is not yet drawn).
  const count = (p) => ({ done: p.biomes.filter((x) => x.done).length + p.vistas.filter((x) => x.done && x.sketch).length, total: p.biomes.length + p.vistas.length });

  // A page of the book shows what has been drawn, and nothing of what has not: no empty boxes,
  // no names of places not yet seen (PAINTER's critique, M4 item 2: "a sketchbook is not a
  // completion table"). What is left on a world is one pencilled line at the foot of its page.
  function tile(parent, x, w) {
    const t = el('figure', 'pc-sketch pc-on' + (x.sketch ? '' : ' pc-bare'), parent);
    t.style.width = w + 'px';
    const frame = el('div', 'pc-sketch-frame', t);
    if (x.sketch) { const img = el('img', '', frame); img.alt = x.name; img.draggable = false; img.src = x.sketch; }
    else el('span', '', frame, wrapLettering('seen, not yet drawn', sz(SIZE.tiny), w - 6), sz(SIZE.tiny));
    el('figcaption', '', t, wrapLettering(x.name, sz(SIZE.tiny), w - 6), sz(SIZE.tiny));
    return t;
  }

  // On a touch screen the sketches are laid as large as the page's box lets them lie in it (the
  // page scrolls if even 110 px across will not do).
  function touchTileWidth(n) {
    const pw = page.clientWidth || 400, ph = Math.max(80, (page.clientHeight || 200) - 34 - 26);
    const cap = sz(SIZE.tiny) * 3.3 + 4;          // a caption of up to two lines, and the gap under it
    for (let w = Math.min(tileWidth(n), pw); w >= 110; w -= 6) {
      const cols = Math.max(1, Math.floor((pw + 16) / (w + 16))), rows = Math.ceil(n / cols);
      if (rows * (w * 9 / 16 + cap + 6) <= ph) return w;
    }
    return Math.min(110, pw);
  }

  // One scale for the whole book: the sheet has one size whatever its page holds, so the fit to
  // a small window is the same on every page (it was taken from each page's own height, and
  // turning from Earth's page to the Moon's rescaled the whole sheet).
  function fit() {
    // (on a touch screen the sheet fills the screen at its own size: theme.css, no scale)
    if (touchOn()) { panel.style.setProperty('--pc-fit', '1'); return; }
    panel.style.setProperty('--pc-fit', String(Math.min(1, window.innerWidth / (panel.offsetWidth + 30), window.innerHeight / (panel.offsetHeight + 30))));
  }

  function draw() {
    const p = pages[at];
    tabs.innerHTML = '';
    pages.forEach((q, i) => {
      const b = el('button', 'pc-book-tab' + (i === at ? ' pc-on' : '') + (q.visited ? '' : ' pc-dim'), tabs);
      el('b', '', b, q.name, sz(SIZE.body));
      b.addEventListener('click', () => { at = i; draw(); });
    });
    // (on a phone the strip slides: the open page's tab is kept in it; a new page starts at its top)
    if (touchOn()) {
      const tb = tabs.children[at];
      if (tb) {
        const x = tb.offsetLeft - tabs.offsetLeft;
        if (x < tabs.scrollLeft) tabs.scrollLeft = Math.max(0, x - 12);
        else if (x + tb.offsetWidth > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = x + tb.offsetWidth - tabs.clientWidth + 12;
      }
      page.scrollTop = 0;
    }
    page.innerHTML = '';
    // the foot first: on a touch screen the page's box is what the foot leaves of the sheet
    let done = 0, total = 0;
    for (const q of pages) { const c = count(q); done += c.done; total += c.total; }
    const how = sayFor('arrow keys turn the page, {KeyB} closes', touchOn() ? 'touch' : (mode && mode()) || 'keys') || '';
    const footText = (hintText ? hintText + '\n' : '') + (total ? `${done} of ${total} pages drawn   ·   ` : '') + how;
    ink(foot, touchOn() ? wrapLettering(footText, sz(SIZE.small), Math.max(200, foot.clientWidth - 8)) : footText, sz(SIZE.small), { align: 'center' });
    if (!p) return;
    el('div', 'pc-book-world', page, p.name, SIZE.head);
    // what is on the page: the landscapes walked, then the views found (a view found but not yet
    // drawn from its easel, or a page whose picture could not be kept, is named on bare paper)
    const shown = p.biomes.filter((x) => x.done).concat(p.vistas.filter((x) => x.done));
    if (shown.length) {
      const g = el('div', 'pc-book-grid', page), w = touchOn() ? touchTileWidth(shown.length) : tileWidth(shown.length);
      for (const x of shown) tile(g, x, w);
    }
    const nb = p.biomes.filter((x) => !x.done).length, nv = p.vistas.filter((x) => !x.done).length;
    const where = p.name === 'Moon' ? 'the Moon' : p.name;
    const left = !p.visited ? 'not yet visited'
      : nb && nv ? `${plural(nb, 'landscape', 'landscapes')} and ${plural(nv, 'view', 'views')} on ${where}`
        : nb ? `${plural(nb, 'landscape', 'landscapes')} on ${where}` : nv ? `${plural(nv, 'view', 'views')} on ${where}` : `every page of ${where} is drawn`;
    el('div', 'pc-label pc-book-left', page, touchOn() ? wrapLettering(left, sz(SIZE.small), Math.max(160, page.clientWidth - 8)) : left, sz(SIZE.small));
    fit();
  }

  return {
    get open() { return open; },
    get page() { return pages[at] ? pages[at].id : null; },
    // pages: [{ id, name, visited, biomes: [{ id, name, done, sketch }], vistas: [{ id, name, done, sketch }] }]
    // hint: { name, distance, bearingDeg } | null (the nearest view not yet found);  here: the world to open at.
    show(list, hint, here) {
      open = true;
      pages = list || [];
      const i = pages.findIndex((p) => p.id === here);
      at = i >= 0 ? i : Math.max(0, pages.findIndex((p) => p.visited));
      const where = (deg) => (Math.abs(deg) < 25 ? 'ahead' : Math.abs(deg) > 155 ? 'behind you' : deg > 0 ? (deg < 90 ? 'ahead to the right' : 'behind to the right') : (deg > -90 ? 'ahead to the left' : 'behind to the left'));
      // (no name: a view is named when it is found)
      hintText = hint ? `the nearest view not yet found is ${hint.distance >= 1000 ? (hint.distance / 1000).toFixed(1) + ' km' : Math.round(hint.distance) + ' m'} ${where(hint.bearingDeg)}` : '';
      panel.classList.add('pc-on');
      draw();
    },
    step(n) { if (open && pages.length) { at = (at + n + pages.length) % pages.length; draw(); } },
    hide() { open = false; panel.classList.remove('pc-on'); },
    // the tabs strip: the page's tab is brought into view where the strip slides (a phone)
    get tabs() { return tabs; },
    panel,
  };
}
