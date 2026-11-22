// Painted Cosmos: the elemental powers on the screen. OWNER: PILOT.
// Loaded with core/powers.js when the address says ?powers=1 (main.js), and not otherwise.
//   - a round POWER BUTTON above "jump" for the right thumb (touch): the thumb down begins the cast and the circle
//     grows while it stays down, the lift casts it at that size;
//   - a SWAP CHIP beside it: a tap goes back to the ability before, and a press that slides onto one of the named
//     tiles above it chooses that one (THE PANEL). Choosing casts nothing;
//   - one word at the foot of the screen that names the chosen ability (every device), and a small mark in the middle
//     of the picture while a power is held: the power acts where the view looks.
// Plain HTML over the canvas, in the hand of the game's other buttons (theme.css's .pc-tbtn); its few rules of style
// are added here, so that nothing of the powers is in the page without the flag.
//
// WHY A PANEL OF WORDS (the owner, 2026-11-22: "change the ui for the powers I want it to be simpler to pick stuff
// and for it to still be easy to understand").
// What stood here before: each ability had its own DIRECTION out of the chip, thirty degrees apart, and the flick's
// angle was the choice. That was a real mend on what came before it (an accurate release on a 32 px word), but it
// holds SEVEN and no more, and space and time has TWELVE: the eighth to twelfth wedges came out in the same
// directions as the first ones, and those five abilities were reachable by a key and by nothing at all on a phone.
// It also asked the thumb to LEARN a direction for each, which is a thing to remember rather than to read. Now:
//   - the abilities are TILES with their words on them, laid up and to the LEFT of the chip in columns of six, so
//     the wind's seven are a column and a bit and the twelve of space and time are two columns read top to bottom.
//     Hold the chip, slide onto the one you want, let go. Nothing to learn and nothing to aim at: it is a list;
//   - a tile is 112 px by 38, which no thumb misses, and on a short screen the panel takes another COLUMN rather
//     than shrinking the tiles (grid below): a target never becomes a sliver;
//   - the panel opens THE INSTANT the thumb lands on the chip, with the ability in hand marked, and the tile under
//     the thumb lights as it moves, so the choice is seen before the lift;
//   - the panel sits on ITS OWN chip, not on the power button. A thumb that drifts while a power is held no longer
//     opens a menu - it must not, now that holding is how a cast is grown - and choosing never casts;
//   - a TAP on the chip swaps the last two abilities, so going back and coming again is one press each way. The chip
//     carries the word of the one it would go to, so the player can read it without opening anything;
//   - a slide back onto the chip, or out to the RIGHT where no tile lies, chooses no ability: a way out that costs
//     no cast. Out to the right is the ELEMENT's own tile, so that flick still swaps wind / fire / space and time.
// The keyboard (1 to 9, 0, -, =) and the pad's bumper still choose, and when they do the panel shows itself for a
// moment with the new ability marked, so that a player who never touches the screen sees the same picture.
//
// NOT PRESSED BY A HAND YET. This was built and driven by made-up pointer events in Node (tests/powersui.test.mjs)
// and in a real browser with ?touch=1; no finger has been on it. It must be pressed on a real phone before anyone
// calls it done.
import { ABILITIES, ELEMENTS } from '../core/powers.js';

// THE PANEL, in numbers.
//   dead:  how far the thumb must leave the chip's middle before the panel chooses at all (below this, nothing);
//   tileW, tileH, gap: a tile and the space between two;
//   perCol: at most this many in a column, so a list never climbs off the top of the screen;
//   edge:  how far the panel's near corner keeps clear of the chip's own middle, so the thumb does not cover it;
//   wide:  how much width to the left of the chip to assume when nobody has measured the screen yet;
//   rx:    only how far out the ELEMENT's tile is drawn, to the right;
//   tapMs: a press no longer than this that never left the chip is a tap, and goes back to the ability before. Hold
//          the chip still and let go, and nothing changes (the player was reading the words);
//   flashMs: how long the panel shows itself when a key or the pad changed the ability.
export const RING = Object.freeze({ dead: 18, rx: 132, ry: 96, tapMs: 400, flashMs: 1200,
  tileW: 112, tileH: 38, gap: 7, perCol: 6, edge: 14, wide: 520, minH: 26, elX: 72, elY: -46 });

// THE GRID a list of n tiles stands in: `room` pixels of height above the chip and `wide` pixels of width to the
// left of it. A thumb's target must not shrink to a sliver, so a short screen gets MORE COLUMNS rather than
// shorter tiles: as many rows as fit at (nearly) full height, up to six, and the columns follow from that. Only
// when the width runs out as well -- a very small window -- do the tiles shrink at all, and never below 55%.
function grid(n, room, wide) {
  const maxCols = Math.max(1, Math.floor((wide + RING.gap) / (RING.tileW + RING.gap)));
  const fitRows = Math.max(1, Math.floor((room + RING.gap) / (RING.tileH * 0.8 + RING.gap)));
  const rows0 = Math.max(1, Math.min(RING.perCol, fitRows, n));
  const cols = Math.max(1, Math.min(maxCols, Math.ceil(n / rows0)));
  const rows = Math.ceil(n / cols);
  const full = rows * RING.tileH + (rows - 1) * RING.gap;
  const k = room > 0 && full > room ? Math.max(0.55, (room - (rows - 1) * RING.gap) / (rows * RING.tileH)) : 1;
  const th = RING.tileH * k, gp = RING.gap;
  return { cols, rows, tw: RING.tileW, th, gp, w: cols * RING.tileW + (cols - 1) * gp, h: rows * th + (rows - 1) * gp };
}
let lastRoom = RING.ry, lastWide = RING.wide;   // what place() last had room for, so a thumb is read against the tiles as drawn

// Which ability a thumb this far from the chip's middle is asking for (dx right, dy down, in css pixels), or -1
// for none: on no tile at all, or out to the right where the element lies.
export function ringPick(dx, dy, n = ABILITIES.length, room = lastRoom, wide = lastWide) {
  if (Math.hypot(dx, dy) < RING.dead) return -1;
  const g = grid(n, room, wide);
  // the grid's bottom-right corner sits a little up and left of the chip, clear of the thumb itself
  const right = -RING.edge, bottom = -RING.edge;
  const u = (dx - (right - g.w)) / (g.tw + g.gp);
  const v = (dy - (bottom - g.h)) / (g.th + g.gp);
  if (u < 0 || v < 0) return -1;
  const col = Math.floor(u), row = Math.floor(v);
  if (col >= g.cols || row >= g.rows) return -1;
  if ((u - col) * (g.tw + g.gp) > g.tw + g.gp * 0.5) return -1;        // in the gap between two tiles
  if ((v - row) * (g.th + g.gp) > g.th + g.gp * 0.5) return -1;
  const i = col * g.rows + row;                                        // a column at a time, read top to bottom
  return i < n ? i : -1;
}

// Where each tile's middle is drawn, as offsets in css pixels from the chip's middle, and how big it is.
export function ringPlaces(room = lastRoom, n = ABILITIES.length, wide = lastWide) {
  lastRoom = room; lastWide = wide;
  const g = grid(n, room, wide), out = [];
  const right = -RING.edge, bottom = -RING.edge;
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / g.rows), row = i % g.rows;
    out.push({
      x: right - g.w + col * (g.tw + g.gp) + g.tw / 2,
      y: bottom - g.h + row * (g.th + g.gp) + g.th / 2,
      w: g.tw, h: g.th,
    });
  }
  return out;
}

// (pointer-events: auto on the button and the chip: the HUD's layer lets a finger through to the picture, theme.css
// .pc-hud, and each of its own buttons takes it back. Without it the button was drawn and a finger on it turned the
// view: found with real touch events in a browser, 2026-11-17; tests/powers.test.mjs holds it.)
const CSS = `
.pc-pw-btn { position: absolute; display: none; align-items: center; justify-content: center; box-sizing: border-box; width: 64px; height: 64px;
  right: calc(var(--pc-sr, 0px) + 18px); bottom: calc(var(--pc-sb, 0px) + 98px); border-radius: 50%; pointer-events: auto; touch-action: none; user-select: none;
  -webkit-user-select: none; font: 600 13px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; letter-spacing: .02em;
  background: rgba(250, 246, 236, 0.86); box-shadow: inset 0 0 0 1.5px rgba(47, 58, 93, 0.35), 0 1px 5px rgba(20, 24, 40, 0.25); }
.pc-pw-btn.pc-down { background: rgba(226, 232, 250, 0.94); box-shadow: inset 0 0 0 1.5px rgba(47, 58, 93, 0.5), inset 0 0 22px rgba(77, 96, 178, 0.4); }
/* the swap chip, left of the button: 72 by 48 px, a target a thumb cannot miss, with the word it would go back to */
.pc-pw-swap { position: absolute; display: none; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;
  width: 72px; height: 48px; right: calc(var(--pc-sr, 0px) + 92px); bottom: calc(var(--pc-sb, 0px) + 106px); border-radius: 15px;
  pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none;
  font: 600 13px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; background: rgba(250, 246, 236, 0.82);
  box-shadow: inset 0 0 0 1.5px rgba(47, 58, 93, 0.3), 0 1px 5px rgba(20, 24, 40, 0.22); }
.pc-pw-swap > i { font: 400 11px/1 Georgia, 'Times New Roman', serif; font-style: normal; opacity: 0.62; margin-bottom: 5px; }
.pc-pw-swap.pc-down { background: rgba(226, 232, 250, 0.94); box-shadow: inset 0 0 0 1.5px rgba(47, 58, 93, 0.5), inset 0 0 22px rgba(77, 96, 178, 0.4); }
.pc-pw-on .pc-pw-btn, .pc-pw-on .pc-pw-swap { display: flex; }
/* the panel: a point at the chip's middle, with the tiles laid up and to the left of it (the thumb is read on the
   chip, which holds the touch, so the tiles themselves take none of their own) */
.pc-pw-fan { position: absolute; display: none; width: 0; height: 0; right: calc(var(--pc-sr, 0px) + 128px); bottom: calc(var(--pc-sb, 0px) + 130px); pointer-events: none; }
.pc-pw-fan.pc-open { display: block; }
/* a tile: a rectangle big enough for a thumb (its size is set in code, from how much room the screen has), with
   its own word on it and, on a keyboard, the key that does the same */
.pc-pw-tab { position: absolute; left: 0; top: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
  padding: 0 8px; border-radius: 10px; white-space: nowrap; overflow: hidden;
  font: 600 13px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; background: rgba(250, 246, 236, 0.94);
  box-shadow: inset 0 0 0 1.2px rgba(47, 58, 93, 0.3), 0 1px 4px rgba(20, 24, 40, 0.22); }
/* the one the thumb is pointing at now */
.pc-pw-tab.pc-sel { background: rgba(214, 224, 250, 0.98); box-shadow: inset 0 0 0 1.6px rgba(47, 58, 93, 0.6), 0 0 0 2px rgba(250, 246, 236, 0.5); }
/* the one in hand (so the panel always says where the player is standing) */
.pc-pw-tab.pc-now { box-shadow: inset 0 0 0 1.6px rgba(47, 58, 93, 0.55), inset 0 0 14px rgba(77, 96, 178, 0.28); }
/* the number of the key that does the same, for a keyboard; a phone is shown no keys */
/* the element's own word, out to the right where no ability lies: warm, so a thumb can tell it from the seven */
/* the element's own tile, out to the right where no ability lies: warm, so a thumb can tell it from the rest */
.pc-pw-el { width: auto !important; height: auto !important; min-height: 26px; padding: 5px 10px; background: rgba(250, 238, 222, 0.94); }
.pc-pw-el.pc-sel { background: rgba(252, 226, 186, 0.99); box-shadow: inset 0 0 0 1.6px rgba(120, 66, 34, 0.6), 0 0 0 2px rgba(250, 246, 236, 0.5); }
.pc-pw-tab > i { display: none; }
.pc-pw-keys .pc-pw-tab > i { display: inline; font: 400 11px/1 Georgia, 'Times New Roman', serif; font-style: normal; opacity: 0.55; margin-left: 6px; }
.pc-pw-word { position: absolute; left: 50%; bottom: calc(var(--pc-sb, 0px) + 14px); transform: translateX(-50%); padding: 4px 10px; border-radius: 11px;
  font: 600 12px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; background: rgba(250, 246, 236, 0.78); pointer-events: none; display: none; }
.pc-pw-live .pc-pw-word { display: block; }
.pc-pw-mark { position: absolute; left: 0; top: 0; width: 22px; height: 22px; border-radius: 50%; pointer-events: none; display: none; opacity: 0.55;
  box-shadow: 0 0 0 1.5px rgba(250, 246, 236, 0.9), 0 0 0 3px rgba(47, 58, 93, 0.35); }
.pc-pw-live .pc-pw-mark { display: block; }
.pc-pw-held .pc-pw-mark { opacity: 1; }
/* A short window (a phone held sideways in a small browser): the HUD puts its slips at the foot, so the button and
   the chip go down into the bottom row, to the left of "jump", where "sink" and "brake" sit in the ship - the powers
   are only ever on foot, so the two never show at once. The panel's corner moves with the chip. */
@media (max-height: 300px) {
  .pc-pw-btn { width: 56px; height: 56px; right: calc(var(--pc-sr, 0px) + 88px); bottom: calc(var(--pc-sb, 0px) + 8px); }
  .pc-pw-swap { width: 64px; height: 44px; right: calc(var(--pc-sr, 0px) + 152px); bottom: calc(var(--pc-sb, 0px) + 14px); }
  .pc-pw-fan { right: calc(var(--pc-sr, 0px) + 184px); bottom: calc(var(--pc-sb, 0px) + 36px); }
}
`;

export function attachPowersUi(powers, root) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
  const el = (cls, text) => { const e = doc.createElement('div'); e.className = cls; if (text) e.textContent = text; root.appendChild(e); return e; };
  const btn = el('pc-pw-btn'), swap = el('pc-pw-swap'), fan = el('pc-pw-fan'), word = el('pc-pw-word'), mark = el('pc-pw-mark');
  btn.setAttribute('aria-label', 'cast the power');
  swap.setAttribute('aria-label', 'change the power');
  // the chip says what a tap on it would do, in two lines: "swap" over the name of that ability
  const swapTag = doc.createElement('i'); swapTag.textContent = 'swap'; swap.appendChild(swapTag);
  const swapName = doc.createElement('span'); swap.appendChild(swapName);
  // (2026-11-18, found by an independent reader driving this with real touch events) THE RING READS THE LIST IN THE
  // HAND, not the wind's seven for ever. With fire in hand the button said "kindle" and the ring beside it offered
  // gust, gather, quicken, still, whirl, part and knife -- not one of which the player had -- marked the gust as the
  // one in hand, and every flick did nothing at all, because pick() refuses an index past the list's end. The two
  // controls contradicted each other and the thumb got no answer.
  let cur = powers.list || ABILITIES;
  let NA = cur.length;
  const tabWords = [];
  // AS MANY WEDGES AS THE LONGEST LIST (2026-11-22: space and time has twelve, where the wind has seven. Built
  // from the wind's seven, the fan showed seven of the twelve and the last five were reachable by a key and by
  // nothing on a phone -- the same fault the element button was made to mend in the first place.)
  const MOST = Math.max(...ELEMENTS.map((e) => e.list.length));
  const KEYWORD = (i) => (i < 9 ? String(i + 1) : i === 9 ? '0' : i === 10 ? '-' : '=');
  const tabs = Array.from({ length: MOST }, (unused, i) => {
    const a = (powers.list || ABILITIES)[i] || { word: '' };
    const t = doc.createElement('div'); t.className = 'pc-pw-tab';
    const s = doc.createElement('span'); s.textContent = a.word; t.appendChild(s); tabWords.push(s);
    const n = doc.createElement('i'); n.textContent = KEYWORD(i); t.appendChild(n);        // the key that does the same
    fan.appendChild(t); return t;
  });
  // AND THE ELEMENT HAS A THUMB'S WAY TO IT. Until this it was reachable by one key on a keyboard and by nothing at
  // all on a phone, which breaks this project's own rule that a power works the same on a phone, a keyboard and a
  // pad. Every ability tile is drawn to the LEFT of the chip (ringPlaces), so a slide out to the RIGHT is free
  // ground: it swaps the element, and the tile out there says which one it goes to.
  const elTab = doc.createElement('div'); elTab.className = 'pc-pw-tab pc-pw-el';
  const elWord = doc.createElement('span'); elTab.appendChild(elWord);
  const elKey = doc.createElement('i'); elKey.textContent = 'G'; elTab.appendChild(elKey);
  fan.appendChild(elTab);
  let coarse = false;
  try { coarse = win.matchMedia('(pointer: coarse)').matches; } catch { /* a mouse */ }
  // (?touch=1, 2026-11-18) FORCE THE THUMB'S INTERFACE ON A MACHINE THAT HAS NO THUMB. This project's own rule is
  // that anything the owner will touch is pressed with real touch events before it is called done, and that rule
  // had never once been kept for this screen, because the test browser is not a touch device and so the whole
  // interface is laid out at nothing and a press lands on the canvas behind it. With this the layout can be driven
  // and pressed here; it also lets the owner see the phone's controls on a desktop.
  try { if (win.location && new URLSearchParams(win.location.search).get('touch') === '1') coarse = true; } catch { /* no address to read */ }
  if (!coarse) root.classList.add('pc-pw-keys');          // a keyboard: the ring names its keys

  // THE ONE BEFORE, which the chip's tap goes back to. It is kept here, not in the controller, so that this screen
  // needs nothing added to core/powers.js; `took` notices the change whoever made it - the ring the moment it picks,
  // a key or the pad by the next frame - and at the start it points at the second ability, so the chip does
  // something useful before anything has been changed. (If the controller grows a `swapBack` of its own one day,
  // that one is used and the two agree.)
  let lastAb = powers.ability, prevAb = NA > 1 ? (powers.ability + 1) % NA : powers.ability;
  let elNow = powers.element | 0;          // which element the panel's words are of, so it can follow a change made elsewhere
  const sayPrev = () => { swapName.textContent = NA > 1 && cur[prevAb] ? cur[prevAb].word : ''; };
  // The list in the hand has changed (the element was swapped): the words, how many wedges there are, and the one
  // the chip would go back to all follow it, so the ring can never offer an ability the player does not have.
  const setList = (list) => {
    cur = list || ABILITIES; NA = cur.length;
    tabs.forEach((t, i) => {
      t.style.display = i < NA ? '' : 'none';
      if (i < NA && tabWords[i]) tabWords[i].textContent = cur[i].word;
    });
    // where a flick to the right goes: the NEXT element round, whichever that is
    elWord.textContent = (ELEMENTS[((powers.element | 0) + 1) % ELEMENTS.length] || ELEMENTS[0]).word;
    lastAb = powers.ability; prevAb = NA > 1 ? (powers.ability + 1) % NA : powers.ability;
    elNow = powers.element | 0;
    sayPrev();
    // AND IF THE PANEL IS OPEN WHILE THIS HAPPENS, LAY IT OUT AGAIN. (2026-11-22, seen in the real game: with the
    // thumb holding the chip, the element key put twelve words on the screen but only the first SEVEN had ever
    // been given a place and a size -- the other five sat in a heap on the chip itself, at no size at all, because
    // nothing had placed them since the list grew. place() used to be called only when the panel opens.)
    if (fan.classList.contains('pc-open')) { place(); markTabs(); }
  };
  setList(cur);
  const took = () => {
    if (powers.ability === lastAb) return false;
    prevAb = lastAb; lastAb = powers.ability; sayPrev(); return true;
  };
  const goBack = () => { if (typeof powers.swapBack === 'function') powers.swapBack(); else powers.pick(prevAb); took(); };

  // ---- the ring ---------------------------------------------------------------------------------------------
  let sel = -1;
  const markTabs = () => tabs.forEach((t, i) => {
    t.classList.toggle('pc-sel', i === sel);
    t.classList.toggle('pc-now', i === powers.ability && i !== sel);
  });
  // where the words are hung: as far out as there is room on this screen (the wedges are untouched by this)
  const fix = (v) => (Math.abs(v) < 0.5 ? '0' : v.toFixed(0));
  const place = () => {
    let ry = RING.ry, rw = RING.wide, ox = 0, oy = 0, f0 = 0;
    try {
      const f = fan.getBoundingClientRect(), h = (win && win.innerHeight) || 0;
      f0 = f.left;
      // (f.top > 0: a thing the page is not showing measures as nothing at all, and a ring squashed to nothing is
      // what you get if this is asked before the ring is on the screen - so openRing shows it first, then places it)
      // (the room ABOVE the chip: the panel grows upward from it, and on a short screen the tiles shrink to fit
      //  rather than running off the top)
      if (h > 0 && f.top > 0) ry = Math.max(96, Math.min(f.top - 20, 380));
      // the words belong round the CHIP, which is what the thumb flicks from; if the two ever drift apart in the
      // style sheet, the drawing follows the chip and the flicks stay honest
      const c = swap.getBoundingClientRect();
      if (c.width > 0) {
        ox = c.left + c.width / 2 - f.left; oy = c.top + c.height / 2 - f.top;
        // and the room to the LEFT of the chip, which is how many columns there is width for
        rw = Math.max(RING.tileW, c.left + c.width / 2 - RING.edge - 6);
      }
    } catch { /* no window to ask: the full ring */ }
    ringPlaces(ry, NA, rw).forEach((p, i) => {
      const t = tabs[i];
      t.style.width = fix(p.w) + 'px';
      t.style.height = fix(p.h) + 'px';
      t.style.transform = `translate(calc(-50% + ${fix(p.x + ox)}px), calc(-50% + ${fix(p.y + oy)}px))`;
    });
    // THE ELEMENT'S OWN TILE, up and out to the right. (2026-11-22: it was drawn level with the chip at 103 px,
    // which on a 390 px phone put it HALF OFF THE SCREEN and on top of the power button -- seen in a real browser
    // at 390 by 844. It is lifted clear of the button and held inside the window here.)
    let ex = RING.elX;
    try {
      const ew = elTab.getBoundingClientRect().width || 76, vw = (win && win.innerWidth) || 0;
      if (vw > 0 && ew > 0) ex = Math.min(ex, vw - 8 - ew / 2 - (f0 + ox));
    } catch { /* no window to ask */ }
    ex = Math.max(RING.dead + 12, ex);
    elTab.style.transform = `translate(calc(-50% + ${fix(ex + ox)}px), calc(-50% + ${fix(RING.elY + oy)}px))`;
  };
  const openRing = () => { fan.classList.add('pc-open'); place(); markTabs(); };
  const closeRing = () => { sel = -1; fan.classList.remove('pc-open'); tabs.forEach((t) => { t.classList.remove('pc-sel'); t.classList.remove('pc-now'); }); elTab.classList.remove('pc-sel'); };

  // ---- the chip: a tap goes back, a flick chooses ------------------------------------------------------------
  let spid = null, scx = 0, scy = 0, sat = 0, sleft = false, flashT = 0;
  const nowMs = () => Date.now();
  swap.addEventListener('pointerdown', (e) => {
    // (2026-11-18) a touch whose lift was never reported must not shut the chip for good: a new finger takes it over
    if (spid != null && spid !== e.pointerId) { spid = null; sel = -1; closeRing(); }
    if (spid != null) return;
    spid = e.pointerId; sel = -1; sat = nowMs(); sleft = false;
    const r = swap.getBoundingClientRect(); scx = r.left + r.width / 2; scy = r.top + r.height / 2;
    try { swap.setPointerCapture(spid); } catch { /* old browsers */ }
    swap.classList.add('pc-down');
    flashT = 0; openRing();                               // at once: there is nothing to hold and wait out
    e.preventDefault();
  });
  // Is the thumb out to the RIGHT of the chip, where the element's own tile is? Every ability tile is drawn to the
  // LEFT (ringPlaces), so the whole right side can belong to the element and the two can never disagree. (It used
  // to be a 90-degree cone, which no longer held the tile once that was lifted clear of the power button.)
  const toElement = (dx, dy) => Math.hypot(dx, dy) >= RING.dead && dx > 0;
  const smove = (e) => {
    if (e.pointerId !== spid) return;
    const dx = e.clientX - scx, dy = e.clientY - scy;
    elTab.classList.toggle('pc-sel', toElement(dx, dy));
    // once the thumb has left the chip, this press is a flick and never a tap: bringing it home again and letting go
    // is the way out of the ring, and must not be read as "go back to the one before"
    if (Math.hypot(dx, dy) >= RING.dead) sleft = true;
    const i = ringPick(dx, dy, NA);
    if (i !== sel) { sel = i; markTabs(); }
  };
  const sup = (e) => {
    if (e.pointerId !== spid) return;
    // (2026-11-18, found by a reader driving this with real touch events) WHERE THE THUMB LIFTED is the choice, not
    // where the last move was reported. A browser holds back the moves of a fast flick, and may send none at all; the
    // flick was then read as a tap and went back to the wrong ability - every one of the seven directions came out as
    // the same one.
    const dx = e.clientX - scx, dy = e.clientY - scy, out = Math.hypot(dx, dy) >= RING.dead;
    const held = nowMs() - sat, picked = out ? ringPick(dx, dy, NA) : sel;
    spid = null; swap.classList.remove('pc-down'); closeRing();
    if (e.type !== 'pointerup') return;                   // the system took the touch away: change nothing
    if (toElement(dx, dy)) { if (powers.nextElement) { powers.nextElement(); setList(powers.list); } }   // a flick to the right: the other element
    else if (picked >= 0) { powers.pick(picked); took(); }     // a flick: the one it pointed at, and no cast
    else if (!sleft && !out && held <= RING.tapMs) goBack();      // a tap, which never left the chip: back to the one before
  };
  swap.addEventListener('pointermove', smove);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) swap.addEventListener(t, sup);

  // ---- the power button: down holds and grows, up casts -------------------------------------------------------
  // (every ability is held this way now, not only the two that last: the circle grows while the thumb is down and
  // the cast is made at that size when it lifts, which is also how an ultimate is asked for. Before this the thumb
  // could only ever tap the small casts, because the button slid into the old menu instead of holding.)
  let pid = null, pat = 0;
  btn.addEventListener('pointerdown', (e) => {
    if (pid != null && pid !== e.pointerId) { pid = null; powers.keys.touch = false; btn.classList.remove('pc-down'); if (powers.cancelHold) powers.cancelHold(); }
    if (pid != null) return;
    pid = e.pointerId; pat = nowMs();
    try { btn.setPointerCapture(pid); } catch { /* old browsers */ }
    btn.classList.add('pc-down'); powers.keys.touch = true; e.preventDefault();
  });
  const bup = (e) => {
    if (e.pointerId !== pid) return;
    const held = nowMs() - pat;
    pid = null; btn.classList.remove('pc-down'); powers.keys.touch = false;
    // a quick tap can begin and end inside one slow frame, and the game would never see the thumb at all: say it
    // again as a tap, which the controller casts at the smallest size (tests/powers.test.mjs holds that)
    if (e.type === 'pointerup' && held < 180) powers.tapOnce = true;
  };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, bup);
  // THE SAME TWO, HEARD ON THE WHOLE PAGE as well. A browser that cannot hold the touch to the button it came down
  // on (setPointerCapture above, which some old ones refuse) would otherwise never tell us the thumb had lifted
  // somewhere else: the ring could not be flicked, and worse, a power held down would stay held. Each of these
  // leaves at once when the touch is not the one it is following, so a second word about the same lift does nothing.
  try {
    doc.addEventListener('pointermove', smove);
    for (const t of ['pointerup', 'pointercancel']) { doc.addEventListener(t, sup); doc.addEventListener(t, bup); }
  } catch { /* no document to listen on (a test page) */ }

  let shown = null, wordNow = '', markKey = '';
  powers.onFrame = (p) => {
    const on = p.active;
    // (2026-11-18) THIS SCREEN OWNS keys.touch: no thumb on the button, no hold. Without this, a lift the browser
    // never reports leaves the power held for ever, and then no press is ever seen as a new press again - nothing
    // casts at all for the rest of the session.
    if (pid == null && p.keys.touch) p.keys.touch = false;
    if (!on && pid != null) { pid = null; btn.classList.remove('pc-down'); p.keys.touch = false; if (p.cancelHold) p.cancelHold(); }
    if (!on && spid != null) { spid = null; closeRing(); }
    if (on !== shown) { shown = on; root.classList.toggle('pc-pw-live', on); root.classList.toggle('pc-pw-on', on && coarse); }
    // THE ELEMENT CHANGED SOMEWHERE ELSE (the element key, the pad). Until 2026-11-22 only this screen's own flick
    // to the right told the panel to re-read the list, so pressing the element key left TWELVE WORDS OF THE WRONG
    // ELEMENT on the screen, with the thumb picking by their positions and getting whatever the new list holds
    // there. That is the same fault the panel itself was built to mend (see the note above setList), and it was
    // mended there for one of the two ways in. Now the panel follows the hand whoever changed it.
    if ((p.element | 0) !== elNow) { elNow = p.element | 0; setList(p.list); if (spid == null) { flashT = nowMs() + RING.flashMs; openRing(); } }
    // the ability changed - by the panel, by a key, by the pad: keep the one before for the chip, and when it was not
    // this thumb that did it, show the panel for a moment with the new one marked, so a player at a keyboard or a pad
    // sees which one they are now holding
    if (took()) {
      if (spid == null) { flashT = nowMs() + RING.flashMs; openRing(); } else markTabs();
    }
    if (flashT && spid == null && (nowMs() > flashT || !on)) { flashT = 0; closeRing(); }
    // (how big the cast is being made, while the hand holds it: the owner asked to grow the circle)
    const big = p.size > 1.12 ? '  ×' + p.size.toFixed(1) : '';
    const w = (p.list && p.list[p.ability] ? p.list[p.ability] : ABILITIES[p.ability]).word, shown2 = w + big + (p.note ? '|' + p.note : '');   // (the word follows the element in the hand)
    // (the element's own name comes from the table, not from a question with two answers: that line read
    //  `p.element ? 'fire: ' : 'wind: '` and called space and time "fire" on the screen, 2026-11-22)
    if (shown2 !== wordNow) {
      wordNow = shown2; btn.textContent = w;
      const en = (ELEMENTS[p.element | 0] || ELEMENTS[0]).word;
      // (the note said when the element is swapped IS the element's name, and the line already begins with it:
      //  without this it read "space and time: slow - space and time". Seen in the game, 2026-11-22.)
      const note = p.note && p.note !== en ? '  \u00b7  ' + p.note : '';
      word.textContent = en + ': ' + w + big + note;
    }
    root.classList.toggle('pc-pw-held', on && (p.keys.touch || p.keys.cast || p.keys.mouse || p.keys.pad || !!p.orb || !!p.part));
    // THE AIM MARK: a ring on the ground where the chosen power will act, as wide as what it will do there, lying as
    // the ground lies to the eye; there before the cast, stronger while a power is held. (p.project: main.js; without
    // it, or with the aim behind the eye, no mark.)
    const s = on && p.aim.ok && p.project ? p.project(p.aim.p) : null;
    if (s) {
      const rx = Math.max(7, Math.min(280, p.aim.size * s.k)), ry = Math.max(4, rx * s.flat);
      const key = Math.round(s.x) + ',' + Math.round(s.y) + ',' + Math.round(rx) + ',' + Math.round(ry);
      if (key !== markKey) {
        markKey = key;
        mark.style.width = (2 * rx).toFixed(0) + 'px'; mark.style.height = (2 * ry).toFixed(0) + 'px';
        mark.style.transform = 'translate(' + (s.x - rx).toFixed(0) + 'px, ' + (s.y - ry).toFixed(0) + 'px)';
        mark.style.visibility = 'visible';
      }
    } else if (markKey !== '') { markKey = ''; mark.style.visibility = 'hidden'; }
  };
  // (the handles are given back for the tests, which press them with made-up pointer events)
  return { btn, swap, fan, tabs, word, mark, goBack };
}
