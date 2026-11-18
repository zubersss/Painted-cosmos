// Painted Cosmos: the elemental powers on the screen. OWNER: PILOT.
// Loaded with core/powers.js when the address says ?powers=1 (main.js), and not otherwise.
//   - a round POWER BUTTON above "jump" for the right thumb (touch): the thumb down begins the cast and the circle
//     grows while it stays down, the lift casts it at that size;
//   - a SWAP CHIP beside it: a tap goes back to the ability before, and a short flick out of it in one of seven
//     directions chooses any of the seven (THE RING). Choosing casts nothing;
//   - one word at the foot of the screen that names the chosen ability (every device), and a small mark in the middle
//     of the picture while a power is held: the power acts where the view looks.
// Plain HTML over the canvas, in the hand of the game's other buttons (theme.css's .pc-tbtn); its few rules of style
// are added here, so that nothing of the powers is in the page without the flag.
//
// WHY THE RING AND THE CHIP (the owner, 2026-11-18: "make it easy to switch between thr abilities and also make the
// choosing the abilities ui better this one is hard to back fast").
// What stood here before: the thumb held the power button and slid off it, a column of seven words 32 px apart
// opened beside it, and the thumb had to let go on the right word - a press, a slide and an accurate release to
// change ability, with nothing wider than 32 px to aim at and no way back to the one just used. Now:
//   - WHICH ability a flick asks for is read FROM ITS DIRECTION, not from where the thumb lands. Each of the seven
//     owns a 30-degree wedge that runs from the chip to the edge of the screen, so none of them needs an accurate
//     press and the same flick works wherever the phone is held;
//   - the ring sits on ITS OWN chip, not on the power button. A thumb that drifts while a power is held no longer
//     opens a menu - it must not, now that holding is how a cast is grown - and choosing never casts;
//   - the ring opens THE INSTANT the thumb lands on the chip, with the ability you have marked: there is no hold to
//     wait out before the seven can be seen;
//   - a TAP on the chip swaps the last two abilities, so going back and coming again is one press each way. The chip
//     carries the word of the one it would go to, so the player can read it without opening anything;
//   - a flick back onto the chip, or out to the right where the screen's edge is, chooses nothing: a way out of the
//     ring that costs no cast.
// The keyboard (1 to 7) and the pad's bumper still choose, and when they do the ring shows itself for a moment with
// the new ability marked, so that a player who never touches the screen sees the same picture.
//
// NOT PRESSED BY A HAND YET. This was built and driven by made-up pointer events in Node (tests/powersui.test.mjs);
// no finger has been on it. It must be pressed on a real phone before anyone calls it done.
import { ABILITIES } from '../core/powers.js';

// THE RING, in numbers. The seven lie 30 degrees apart, from straight up (the first) round through the left to
// straight down (the last): the whole left half of the screen, which is where a right thumb on the chip can reach,
// and nothing out to the right where the screen's edge and the power button are.
//   dead:  how far the thumb must leave the chip's middle before the ring chooses at all (below this, nothing);
//   rx, ry: only how far out the WORDS are drawn - the wedges do not depend on it, so a cramped screen may draw the
//          ring smaller and the flicks stay exactly the same;
//   tapMs: a press no longer than this that never left the chip is a tap, and goes back to the ability before. Hold
//          the chip still and let go, and nothing changes (the player was reading the seven);
//   flashMs: how long the ring shows itself when a key or the pad changed the ability.
export const RING = Object.freeze({ from: 90, step: 30, dead: 22, rx: 132, ry: 96, tapMs: 400, flashMs: 1200 });

// Which ability a thumb this far from the chip's middle is asking for (dx right, dy down, in css pixels), or -1 for
// none: too near the middle, or pointing out to the right where no ability lies.
export function ringPick(dx, dy, n = ABILITIES.length) {
  if (Math.hypot(dx, dy) < RING.dead) return -1;
  let a = Math.atan2(-dy, dx) * 180 / Math.PI;            // degrees, straight up is 90
  a = ((a % 360) + 360) % 360;
  const k = Math.floor((a - RING.from) / RING.step + 0.5);
  return k >= 0 && k < n ? k : -1;
}

// Where each word is drawn, as offsets in css pixels from the chip's middle (`ry` flattens the ring on a short screen).
export function ringPlaces(ry = RING.ry, n = ABILITIES.length) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (RING.from + i * RING.step) * Math.PI / 180;
    out.push({ x: Math.cos(a) * RING.rx, y: -Math.sin(a) * ry });
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
/* the ring: a point at the chip's middle, with the seven words hung round it (the flick is read from its angle, so
   the words are a legend and take no touches of their own) */
.pc-pw-fan { position: absolute; display: none; width: 0; height: 0; right: calc(var(--pc-sr, 0px) + 128px); bottom: calc(var(--pc-sb, 0px) + 130px); pointer-events: none; }
.pc-pw-fan.pc-open { display: block; }
.pc-pw-tab { position: absolute; left: 0; top: 0; box-sizing: border-box; min-height: 24px; padding: 5px 9px; border-radius: 13px; white-space: nowrap;
  font: 600 13px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; background: rgba(250, 246, 236, 0.92);
  box-shadow: inset 0 0 0 1.2px rgba(47, 58, 93, 0.3), 0 1px 4px rgba(20, 24, 40, 0.22); }
/* the one the thumb is pointing at now */
.pc-pw-tab.pc-sel { background: rgba(214, 224, 250, 0.98); box-shadow: inset 0 0 0 1.6px rgba(47, 58, 93, 0.6), 0 0 0 2px rgba(250, 246, 236, 0.5); }
/* the one in hand (so the ring always says where the player is standing) */
.pc-pw-tab.pc-now { box-shadow: inset 0 0 0 1.6px rgba(47, 58, 93, 0.55), inset 0 0 14px rgba(77, 96, 178, 0.28); }
/* the number of the key that does the same, for a keyboard; a phone is shown no keys */
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
   are only ever on foot, so the two never show at once. The ring's middle moves with the chip. */
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
  const NA = ABILITIES.length;
  const tabs = ABILITIES.map((a, i) => {
    const t = doc.createElement('div'); t.className = 'pc-pw-tab';
    const s = doc.createElement('span'); s.textContent = a.word; t.appendChild(s);
    const n = doc.createElement('i'); n.textContent = String(i + 1); t.appendChild(n);     // the key that does the same
    fan.appendChild(t); return t;
  });
  let coarse = false;
  try { coarse = win.matchMedia('(pointer: coarse)').matches; } catch { /* a mouse */ }
  if (!coarse) root.classList.add('pc-pw-keys');          // a keyboard: the ring names its keys

  // THE ONE BEFORE, which the chip's tap goes back to. It is kept here, not in the controller, so that this screen
  // needs nothing added to core/powers.js; `took` notices the change whoever made it - the ring the moment it picks,
  // a key or the pad by the next frame - and at the start it points at the second ability, so the chip does
  // something useful before anything has been changed. (If the controller grows a `swapBack` of its own one day,
  // that one is used and the two agree.)
  let lastAb = powers.ability, prevAb = (powers.ability + 1) % NA;
  const sayPrev = () => { swapName.textContent = ABILITIES[prevAb] ? ABILITIES[prevAb].word : ''; };
  sayPrev();
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
    let ry = RING.ry, ox = 0, oy = 0;
    try {
      const f = fan.getBoundingClientRect(), h = (win && win.innerHeight) || 0;
      // (f.top > 0: a thing the page is not showing measures as nothing at all, and a ring squashed to nothing is
      // what you get if this is asked before the ring is on the screen - so openRing shows it first, then places it)
      if (h > 0 && f.top > 0) ry = Math.max(28, Math.min(ry, f.top - 44, h - f.top - 30));
      // the words belong round the CHIP, which is what the thumb flicks from; if the two ever drift apart in the
      // style sheet, the drawing follows the chip and the flicks stay honest
      const c = swap.getBoundingClientRect();
      if (c.width > 0) { ox = c.left + c.width / 2 - f.left; oy = c.top + c.height / 2 - f.top; }
    } catch { /* no window to ask: the full ring */ }
    ringPlaces(ry, NA).forEach((p, i) => {
      tabs[i].style.transform = `translate(calc(-50% + ${fix(p.x + ox)}px), calc(-50% + ${fix(p.y + oy)}px))`;
    });
  };
  const openRing = () => { fan.classList.add('pc-open'); place(); markTabs(); };
  const closeRing = () => { sel = -1; fan.classList.remove('pc-open'); tabs.forEach((t) => { t.classList.remove('pc-sel'); t.classList.remove('pc-now'); }); };

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
  const smove = (e) => {
    if (e.pointerId !== spid) return;
    const dx = e.clientX - scx, dy = e.clientY - scy;
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
    if (picked >= 0) { powers.pick(picked); took(); }     // a flick: the one it pointed at, and no cast
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
    // the ability changed - by the ring, by a key, by the pad: keep the one before for the chip, and when it was not
    // this thumb that did it, show the ring for a moment with the new one marked, so a player at a keyboard or a pad
    // sees which of the seven they are now holding
    if (took()) {
      if (spid == null) { flashT = nowMs() + RING.flashMs; openRing(); } else markTabs();
    }
    if (flashT && spid == null && (nowMs() > flashT || !on)) { flashT = 0; closeRing(); }
    // (how big the cast is being made, while the hand holds it: the owner asked to grow the circle)
    const big = p.size > 1.12 ? '  ×' + p.size.toFixed(1) : '';
    const w = ABILITIES[p.ability].word, shown2 = w + big + (p.note ? '|' + p.note : '');
    if (shown2 !== wordNow) { wordNow = shown2; btn.textContent = w; word.textContent = 'wind: ' + w + big + (p.note ? '  ·  ' + p.note : ''); }
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
