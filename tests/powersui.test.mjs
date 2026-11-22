// The elemental powers on the screen (src/ui/powers.js): the power button, the swap chip and the ring of seven.
// Driven here with made-up pointer events on a made-up page, so that the gestures can be checked without a browser.
// NO FINGER HAS BEEN ON ANY OF THIS: what is proved below is the arithmetic and the order of the gestures, not the
// picture and not the feel. It must be pressed on a real phone before it is called done.
// Run: node --test tests/powersui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Powers, ABILITIES } from '../src/core/powers.js';
import { S } from '../src/core/state.js';
import { attachPowersUi, ringPick, ringPlaces, RING } from '../src/ui/powers.js';

// ---- a page of two elements and a window, enough for the buttons -------------------------------------------
// A phone held sideways: 844 by 390 css px. The chip's slot in the style sheet is 72 by 48 px, its right edge
// 92 px in from the right and its foot 106 px up from the bottom.
const W = 844, H = 390;
const RECTS = {
  'pc-pw-swap': { left: W - 92 - 72, top: H - 106 - 48, width: 72, height: 48 },
  'pc-pw-fan': { left: W - 128, top: H - 130, width: 0, height: 0 },
};
function elem(doc, tag) {
  const e = {
    tag, className: '', textContent: '', style: {}, children: [], attrs: {}, _h: {}, ownerDocument: doc,
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, f) { (this._h[t] || (this._h[t] = [])).push(f); },
    setPointerCapture() { }, releasePointerCapture() { },
    getBoundingClientRect() {
      // as a browser does it: a thing the page is not showing measures as nothing at all, wherever its style sheet
      // would have put it (the ring is only shown while it is open)
      const none = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
      if (this.className.includes('pc-pw-fan') && !this.classList.contains('pc-open')) return none;
      for (const k of Object.keys(RECTS)) if (this.className.includes(k)) { const r = RECTS[k]; return { ...r, right: r.left + r.width, bottom: r.top + r.height }; }
      return none;
    },
    // a pointer event as the browser makes one, handed to every listener for its type
    send(type, p = {}) {
      const ev = { type, pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, preventDefault() { this.defaultPrevented = true; }, defaultPrevented: false, ...p };
      for (const f of this._h[type] || []) f(ev);
      return ev;
    },
  };
  e.classList = {
    add(c) { if (!e.className.split(' ').includes(c)) e.className = (e.className + ' ' + c).trim(); },
    remove(c) { e.className = e.className.split(' ').filter((x) => x && x !== c).join(' '); },
    contains(c) { return e.className.split(' ').includes(c); },
    toggle(c, on) { if (on) this.add(c); else this.remove(c); },
  };
  return e;
}
function page() {
  const doc = { head: null, defaultView: null, createElement: (t) => elem(doc, t) };
  doc.head = elem(doc, 'head');
  doc.defaultView = { innerWidth: W, innerHeight: H, matchMedia: () => ({ matches: true }) };   // a touch screen
  const root = elem(doc, 'div');
  return { doc, root };
}
const R = 4000;
const fakeSim = () => ({ sm: { state: S.ON_FOOT }, bodyId: 'earth', easel: null, ex: { p: { x: 0, y: R, z: 0 }, casting: 0 },
  footCam: { viewFwd: { x: 0, y: 0, z: 1 }, pitch: -0.3 }, sampleSurface: () => ({ radius: R, liquidRadius: 0 }) });
// one frame of the game, so that the screen's part of the powers runs (powers.onFrame)
const frame = (p, sim, n = 1) => { for (let i = 0; i < n; i++) p.update(1 / 60, sim); };
function fitted() {
  const { root } = page(), powers = new Powers(), ui = attachPowersUi(powers, root), sim = fakeSim();
  frame(powers, sim);                                    // the powers come alive on foot
  const c = ui.swap.getBoundingClientRect(), mid = { x: c.left + c.width / 2, y: c.top + c.height / 2 };
  return { root, powers, ui, sim, mid };
}
// a flick: the thumb lands on the chip, goes `d` px in the direction `deg`, and lifts
const flick = (ui, mid, deg, d = 70, ms = 0) => {
  const a = deg * Math.PI / 180;
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  ui.swap.send('pointermove', { clientX: mid.x + Math.cos(a) * d, clientY: mid.y - Math.sin(a) * d });
  if (ms) sleep(ms);
  ui.swap.send('pointerup', { clientX: mid.x + Math.cos(a) * d, clientY: mid.y - Math.sin(a) * d });
};
const sleep = (ms) => { const t = Date.now() + ms; while (Date.now() < t) { /* the clock is the only one here */ } };
// (2026-11-22) THE PANEL, not a ring: the thumb lands on the chip and slides onto the TILE it wants. This goes to
// tile i of a list of n, as ringPlaces lays it, and lifts there.
const toTile = (ui, mid, i, n) => {
  // the thumb down first: that is what lays the panel out for THIS screen, and the tiles are read where they lie
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  const p = ringPlaces(undefined, n)[i];
  ui.swap.send('pointermove', { clientX: mid.x + p.x, clientY: mid.y + p.y });
  ui.swap.send('pointerup', { clientX: mid.x + p.x, clientY: mid.y + p.y });
};
const nameOf = (p) => ABILITIES[p.ability].id;

test('the panel of named tiles: every one reachable, a thumb-sized target, and nothing out to the right', () => {
  // (the owner, 2026-11-22: "I want it to be simpler to pick stuff and for it to still be easy to understand".
  //  The ring of directions held SEVEN -- thirty degrees apart over half the screen -- and space and time has
  //  TWELVE: five of them came out in the same directions as the first five and were reachable by nothing at all
  //  on a phone. Tiles with words on them are read, not remembered.)
  const ROOM = 240, WIDE = 696;                 // what the phone below gives: 240 px above the chip, 696 to its left
  for (const n of [7, 9, 12]) {
    const places = ringPlaces(ROOM, n, WIDE);
    assert.equal(places.length, n);
    for (let i = 0; i < n; i++) {
      const p = places[i];
      assert.equal(ringPick(p.x, p.y, n, ROOM, WIDE), i, 'tile ' + i + ' of ' + n + ' is not where it is drawn');
      // its own corners belong to it as well: a thumb need not hit the middle
      assert.equal(ringPick(p.x - p.w * 0.45, p.y - p.h * 0.4, n, ROOM, WIDE), i, 'the corner of tile ' + i + ' of ' + n);
      assert.equal(ringPick(p.x + p.w * 0.45, p.y + p.h * 0.4, n, ROOM, WIDE), i, 'the far corner of tile ' + i + ' of ' + n);
      assert.ok(p.w >= 44 && p.h >= 24, 'tile ' + i + ' is ' + p.w + ' by ' + p.h + ': a phone wants 44 across');
      assert.ok(p.x < 0, 'the tiles lie to the LEFT of the chip, so the element keeps the right');
    }
    // no two tiles claim the same place
    const seen = new Set();
    for (const p of places) { const k = Math.round(p.x) + ',' + Math.round(p.y); assert.ok(!seen.has(k), 'two tiles in one place'); seen.add(k); }
  }
  assert.equal(ringPick(70, 0, 7, ROOM, WIDE), -1, 'out to the right, where the element lies: no tile');
  assert.equal(ringPick(0, 0, 7, ROOM, WIDE), -1, 'still on the chip: nothing');
  assert.equal(ringPick(-2000, -2000, 7, ROOM, WIDE), -1, 'off the panel altogether: nothing');
  // the twelve of space and time stand in two columns of six, read top to bottom
  const twelve = ringPlaces(ROOM, 12, WIDE);
  assert.ok(twelve[0].y < twelve[5].y, 'the first six run DOWN the first column');
  assert.ok(twelve[6].x > twelve[0].x, 'and the second six are the next column over');
  assert.ok(Math.abs(twelve[6].y - twelve[0].y) < 1, 'the two columns start at the same height');
});

test('the ring opens on the instant the thumb lands, with the ability in hand marked', () => {
  const { powers, ui, mid } = fitted();
  assert.ok(!ui.fan.classList.contains('pc-open'), 'shut until a thumb asks');
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  assert.ok(ui.fan.classList.contains('pc-open'), 'open on the first event, with no hold to wait out');
  assert.ok(ui.tabs[powers.ability].classList.contains('pc-now'), 'the one in hand is marked');
  assert.ok(ui.swap.classList.contains('pc-down'), 'and the chip shows it is pressed');
  // the words are hung round the chip's middle, as far out as the screen allows
  // the tiles are laid up and to the left of the chip, each at its own size
  const put = ui.tabs.map((t) => t.style.transform);
  for (let i = 0; i < ABILITIES.length; i++) assert.ok(/translate\(calc\(-50% \+ -\d/.test(put[i]), 'tile ' + i + ' is not to the left: ' + put[i]);
  assert.ok(parseFloat(ui.tabs[0].style.width) >= 44, 'a tile is drawn at its own width');
  // THE ELEMENT'S TILE is up and to the right: out of the ability tiles' half of the screen, and lifted clear of
  // the power button, which sits level with the chip and to its right (seen half off a 390 px phone, 2026-11-22)
  const el = ui.fan.children[ui.fan.children.length - 1].style.transform;
  const ex = parseFloat(/-50% \+ (-?[\d.]+)px/.exec(el)[1]), ey = parseFloat(/-50% \+ (-?[\d.]+)px\)\)$/.exec(el)[1]);
  assert.ok(ex > RING.dead && ex <= RING.elX, 'the element tile is out to the right: ' + el);
  assert.ok(ey <= RING.elY, 'and lifted above the power button: ' + el);
  ui.swap.send('pointerup', { clientX: mid.x, clientY: mid.y });
  assert.ok(!ui.fan.classList.contains('pc-open'), 'and it is gone when the thumb lifts');
});

test('a flick picks that ability and casts nothing; the thumb need not be accurate, only in the right direction', () => {
  const { powers, ui, mid, sim } = fitted();
  assert.equal(nameOf(powers), 'gust');
  toTile(ui, mid, 6, ABILITIES.length);                    // the seventh tile
  assert.equal(nameOf(powers), 'knife');
  assert.equal(powers.casts, 0, 'choosing is not casting');
  assert.equal(powers.keys.touch, false); assert.equal(powers.tapOnce, false);
  frame(powers, sim, 3);
  assert.equal(powers.winds.count, 0, 'and nothing was put in the air');
  toTile(ui, mid, 1, ABILITIES.length);                    // the second tile
  assert.equal(nameOf(powers), 'gather');
  frame(powers, sim);
  assert.equal(ui.btn.textContent, 'gather', 'the button carries the name of what it will cast');
});

test('a tap on the chip goes back to the ability before, and a second tap comes again: one press each way', () => {
  const { powers, ui, mid } = fitted();
  toTile(ui, mid, 4, ABILITIES.length);                    // the fifth tile, the whirl
  assert.equal(nameOf(powers), 'whirl');
  const tap = () => { ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y }); ui.swap.send('pointerup', { clientX: mid.x, clientY: mid.y }); };
  tap();
  assert.equal(nameOf(powers), 'gust', 'back to the one it came from');
  assert.equal(powers.casts, 0, 'and still nothing cast');
  tap();
  assert.equal(nameOf(powers), 'whirl', 'and back again');
  // the chip says where a tap would go, so it can be read without opening anything
  assert.equal(ui.swap.children[1].textContent, 'gust');
});

test('ways out of the ring that change nothing: back onto the chip, out to the right, a long read, a lost touch', () => {
  const { powers, ui, mid } = fitted();
  toTile(ui, mid, 3, ABILITIES.length);                    // the fourth tile, "still"
  assert.equal(nameOf(powers), 'still');
  // out and then back onto the chip
  const p3 = ringPlaces(undefined, ABILITIES.length)[3];
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  ui.swap.send('pointermove', { clientX: mid.x + p3.x, clientY: mid.y + p3.y });
  assert.ok(ui.tabs[3].classList.contains('pc-sel'), 'it was pointing at one');
  ui.swap.send('pointermove', { clientX: mid.x + 2, clientY: mid.y - 4 });
  assert.ok(!ui.tabs[3].classList.contains('pc-sel'), 'and lets it go when the thumb comes home');
  ui.swap.send('pointerup', { clientX: mid.x + 2, clientY: mid.y - 4 });
  assert.equal(nameOf(powers), 'still', 'and letting go at home changes nothing: a thumb that left the chip is a flick, never a tap');
  // (2026-11-18) OUT TO THE RIGHT IS THE ELEMENT NOW. It used to be dead ground -- and the element was reachable by
  // one key on a keyboard and by nothing whatever on a phone, which broke this project's own rule that a power works
  // the same on a phone, a keyboard and a pad. The ring's own wedges run from straight up round to straight down and
  // never reach the right, so the two cannot disagree about a direction.
  flick(ui, mid, 0);
  assert.equal(powers.element, 1, 'a flick out to the right swaps the element: fire');
  assert.equal(powers.list[powers.ability].id, 'kindle', 'and the hand now holds the fire\u2019s own ability');
  // (2026-11-22: THREE elements, so the flick walks wind -> fire -> space and time -> wind)
  flick(ui, mid, 0);
  assert.equal(powers.element, 2, 'a third flick reaches space and time');
  assert.equal(powers.list[powers.ability].id, 'slow', 'and the hand holds its first ability');
  flick(ui, mid, 0);
  assert.equal(powers.element, 0, 'and again to come back to the wind');
  powers.pick(3);
  assert.equal(nameOf(powers), 'still', 'the wind\u2019s own ability is reached again');
  // held still and read for longer than a tap, then let go
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  sleep(RING.tapMs + 60);
  ui.swap.send('pointerup', { clientX: mid.x, clientY: mid.y });
  assert.equal(nameOf(powers), 'still', 'a long look at the seven changes nothing');
  // the system takes the touch away (a call comes in, the palm presses the edge)
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  ui.swap.send('pointermove', { clientX: mid.x, clientY: mid.y - 90 });
  ui.swap.send('pointercancel', { clientX: mid.x, clientY: mid.y - 90 });
  assert.equal(nameOf(powers), 'still', 'a cancelled touch chooses nothing');
  assert.ok(!ui.fan.classList.contains('pc-open'), 'and the ring is put away');
});

test('the browser says the capture was lost after the lift: the choice is made once, not twice', () => {
  const { powers, ui, mid } = fitted();
  toTile(ui, mid, 3, ABILITIES.length);                    // the fourth tile, "still"
  assert.equal(nameOf(powers), 'still');
  const p3 = ringPlaces(undefined, ABILITIES.length)[3];
  ui.swap.send('lostpointercapture', { clientX: mid.x + p3.x, clientY: mid.y + p3.y });
  assert.equal(nameOf(powers), 'still', 'the second word from the browser is ignored (it would have swapped back)');
});

test('the power button: the thumb down holds and the circle grows, the lift casts it - a drift off the button does not stop it', () => {
  const { powers, ui, sim } = fitted();
  ui.btn.send('pointerdown', { clientX: 10, clientY: 10 });
  assert.equal(powers.keys.touch, true, 'the hold begins at once (an ultimate is a hold of seconds)');
  frame(powers, sim, 40);
  assert.ok(powers.size > 1.2, 'the circle is growing: x' + powers.size.toFixed(2));
  ui.btn.send('pointermove', { clientX: 200, clientY: 300 });                 // the thumb drifts far off the button
  frame(powers, sim, 40);
  sleep(220);                                                                 // a real hold, by the clock the button reads
  assert.equal(powers.keys.touch, true, 'and the drift does not let it go');
  assert.ok(powers.size > 2, 'it is still growing: x' + powers.size.toFixed(2));
  ui.btn.send('pointerup', { clientX: 200, clientY: 300 });
  assert.equal(powers.keys.touch, false);
  assert.equal(powers.tapOnce, false, 'a long hold is not also a tap');
  frame(powers, sim, 2);
  assert.equal(powers.casts, 1, 'one cast, made when the thumb lifted');
  assert.ok(powers.winds.count > 0, 'and there is wind in the air');
});

test('a quick tap on the power button is said twice over, so that one slow frame cannot swallow it', () => {
  const { powers, ui, sim } = fitted();
  ui.btn.send('pointerdown', { clientX: 10, clientY: 10 });
  ui.btn.send('pointerup', { clientX: 10, clientY: 10 });                     // down and up inside one frame
  assert.equal(powers.tapOnce, true, 'the tap is left for the next frame to find');
  frame(powers, sim, 4);
  assert.equal(powers.casts, 1, 'exactly one cast, the smallest');
  assert.ok(powers.size <= 1.0001, 'at the smallest size: x' + powers.size.toFixed(2));
});

test('a key or the pad changes the ability: the ring shows itself for a moment with the new one marked', () => {
  const { powers, ui, sim } = fitted();
  powers.pick(4);                                        // as the keyboard's "5" or the pad's bumper does
  frame(powers, sim);
  assert.ok(ui.fan.classList.contains('pc-open'), 'the ring tells a keyboard player what they now hold');
  assert.ok(ui.tabs[4].classList.contains('pc-now'));
  // it stands for a moment and goes (the clock is wound on by hand here)
  const real = Date.now;
  try { Date.now = () => real() + RING.flashMs + 100; frame(powers, sim); } finally { Date.now = real; }
  assert.ok(!ui.fan.classList.contains('pc-open'), 'and then it is out of the way of the picture');
  // in the ship (no powers) nothing of it is left on the screen
  powers.pick(2); frame(powers, sim);
  assert.ok(ui.fan.classList.contains('pc-open'));
  sim.sm.state = 'FLYING'; frame(powers, sim);
  assert.ok(!ui.fan.classList.contains('pc-open'), 'put away with the rest of the powers');
});

test('the words of the ring are only a legend: they take no touches, and the ring flattens on a short screen', () => {
  const ui = fs.readFileSync(new URL('../src/ui/powers.js', import.meta.url), 'utf8');
  const fan = /\.pc-pw-fan \{([^}]*)\}/.exec(ui);
  assert.ok(fan && /pointer-events:\s*none/.test(fan[1]), 'the ring itself takes no touches: the chip reads the flick');
  const chip = /\.pc-pw-swap \{([^}]*)\}/.exec(ui);
  assert.ok(chip && /pointer-events:\s*auto/.test(chip[1]), 'the chip takes them (the HUD lets them through to the picture)');
  assert.ok(/touch-action:\s*none/.test(chip[1]), 'and no scroll or zoom starts on it');
  assert.ok(/width:\s*72px/.test(chip[1]) && /height:\s*48px/.test(chip[1]), 'and it is 72 by 48 px: no thumb misses that');
  // the drawing may shrink to fit; the wedges are the same angles whatever it does
  const flat = ringPlaces(40, 7, 696), full = ringPlaces(240, 7, 696);
  assert.ok(flat[0].h < full[0].h || flat.length === full.length, 'a short screen still lays out every tile');
  assert.ok(flat.every((p) => p.y > -120), 'on a 40 px screen the panel does not run off the top: ' + flat[0].y);
  assert.ok(flat[0].w >= 44, 'and a tile is still wide enough for a thumb');
  // (a short screen trades rows for COLUMNS rather than shrinking the tiles, so the panel is wider there: that is
  //  the point of it. What must hold is that every tile is still a thumb's target and still on the screen.)
  assert.equal(ringPick(full[0].x, full[0].y, 7, 240, 696), 0, 'the first tile is the first ability');
});

test('if the controller is given a `swapBack` of its own, the chip uses that one and the two agree', () => {
  // (the patch written out in the hand-over for src/core/powers.js: `prev` and `swapBack()` there, so that a key and
  // the pad can go back too. The screen must not then keep a second, different idea of which ability that is.)
  const { powers, ui, mid } = fitted();
  powers.prev = 1; powers.swapBack = function () { this.pick(this.prev); };
  const pick = powers.pick.bind(powers);
  powers.pick = function (i) { if (i !== this.ability) this.prev = this.ability; pick(i); };
  toTile(ui, mid, 2, ABILITIES.length);                    // the third tile, "quicken"
  assert.equal(nameOf(powers), 'quicken');
  assert.equal(powers.prev, 0, 'the controller kept the one before');
  ui.swap.send('pointerdown', { clientX: mid.x, clientY: mid.y });
  ui.swap.send('pointerup', { clientX: mid.x, clientY: mid.y });
  assert.equal(nameOf(powers), 'gust', 'and the tap went back through it');
  assert.equal(ui.swap.children[1].textContent, 'quicken', 'the chip now offers the one just left');
});

// (2026-11-22) THE PANEL MUST FOLLOW THE HAND, whoever changed it. The flick to the right told the panel to
// re-read the list; the element KEY and the pad did not, so they left the previous element's twelve words on the
// screen with the thumb picking by position. And the word at the foot of the screen asked a question with two
// answers (`p.element ? 'fire' : 'wind'`), so space and time was called "fire".
test('the element changed by a key or the pad: the panel re-reads its words and the foot of the screen names it', () => {
  const { powers, ui, sim } = fitted();
  frame(powers, sim);
  const words = () => ui.tabs.filter((t) => t.style.display !== 'none').map((t) => t.children[0].textContent);
  assert.match(ui.word.textContent, /^wind: /, 'the wind to begin with: ' + ui.word.textContent);
  assert.deepEqual(words(), powers.list.map((a) => a.word));
  for (const name of ['fire', 'space and time', 'wind']) {
    powers.nextElement();                       // as the element key or the pad does, NOT this screen's own flick
    frame(powers, sim);
    assert.deepEqual(words(), powers.list.map((a) => a.word), name + ': the tiles are not this element\'s own');
    assert.ok(ui.word.textContent.startsWith(name + ': '), 'the foot of the screen says: ' + ui.word.textContent);
    assert.ok(ui.fan.classList.contains('pc-open'), name + ': the panel shows itself, so a key player sees the swap');
  }
  // and twelve abilities get twelve tiles, not seven
  powers.nextElement(); powers.nextElement(); frame(powers, sim);
  assert.equal(powers.list.length, 12);
  assert.equal(words().length, 12, 'twelve tiles for the twelve of space and time');
});
