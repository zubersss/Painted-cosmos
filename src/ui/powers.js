// Painted Cosmos: the elemental powers on the screen. OWNER: PILOT.
// Loaded with core/powers.js when the address says ?powers=1 (main.js), and not otherwise.
//   - a round power button above "jump" for the right thumb (touch): a press casts the chosen ability, or holds it
//     while the thumb stays down; sliding off the button opens a fan of the abilities, and letting go on one chooses
//     it and casts it;
//   - one word at the foot of the screen that names the chosen ability (every device), and a small mark in the middle
//     of the picture while a power is held: the power acts where the view looks.
// Plain HTML over the canvas, in the hand of the game's other buttons (theme.css's .pc-tbtn); its few rules of style
// are added here, so that nothing of the powers is in the page without the flag.
import { ABILITIES } from '../core/powers.js';

// (pointer-events: auto on the button: the HUD's layer lets a finger through to the picture, theme.css .pc-hud, and each
// of its own buttons takes it back. Without it the button was drawn and a finger on it turned the view: found with real
// touch events in a browser, 2026-11-17; tests/powers.test.mjs holds it.)
const CSS = `
.pc-pw-btn { position: absolute; display: none; align-items: center; justify-content: center; box-sizing: border-box; width: 64px; height: 64px;
  right: calc(var(--pc-sr, 0px) + 18px); bottom: calc(var(--pc-sb, 0px) + 98px); border-radius: 50%; pointer-events: auto; touch-action: none; user-select: none;
  -webkit-user-select: none; font: 600 13px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; letter-spacing: .02em;
  background: rgba(250, 246, 236, 0.86); box-shadow: inset 0 0 0 1.5px rgba(47, 58, 93, 0.35), 0 1px 5px rgba(20, 24, 40, 0.25); }
.pc-pw-btn.pc-down { background: rgba(226, 232, 250, 0.94); box-shadow: inset 0 0 0 1.5px rgba(47, 58, 93, 0.5), inset 0 0 22px rgba(77, 96, 178, 0.4); }
.pc-pw-on .pc-pw-btn { display: flex; }
.pc-pw-fan { position: absolute; display: none; right: calc(var(--pc-sr, 0px) + 18px); bottom: calc(var(--pc-sb, 0px) + 98px); width: 64px; height: 64px; pointer-events: none; }
.pc-pw-fan.pc-open { display: block; }
.pc-pw-tab { position: absolute; left: 50%; top: 50%; padding: 7px 11px; border-radius: 14px; white-space: nowrap; transform: translate(-50%, -50%);
  font: 600 13px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; background: rgba(250, 246, 236, 0.92);
  box-shadow: inset 0 0 0 1.2px rgba(47, 58, 93, 0.3), 0 1px 4px rgba(20, 24, 40, 0.22); }
.pc-pw-tab.pc-sel { background: rgba(214, 224, 250, 0.98); box-shadow: inset 0 0 0 1.6px rgba(47, 58, 93, 0.6); }
.pc-pw-word { position: absolute; left: 50%; bottom: calc(var(--pc-sb, 0px) + 14px); transform: translateX(-50%); padding: 4px 10px; border-radius: 11px;
  font: 600 12px/1 Georgia, 'Times New Roman', serif; color: #2f3a5d; background: rgba(250, 246, 236, 0.78); pointer-events: none; display: none; }
.pc-pw-live .pc-pw-word { display: block; }
.pc-pw-mark { position: absolute; left: 0; top: 0; width: 22px; height: 22px; border-radius: 50%; pointer-events: none; display: none; opacity: 0.55;
  box-shadow: 0 0 0 1.5px rgba(250, 246, 236, 0.9), 0 0 0 3px rgba(47, 58, 93, 0.35); }
.pc-pw-live .pc-pw-mark { display: block; }
.pc-pw-held .pc-pw-mark { opacity: 1; }
`;

export function attachPowersUi(powers, root) {
  const doc = root.ownerDocument;
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
  const el = (cls, text) => { const e = doc.createElement('div'); e.className = cls; if (text) e.textContent = text; root.appendChild(e); return e; };
  const btn = el('pc-pw-btn'), fan = el('pc-pw-fan'), word = el('pc-pw-word'), mark = el('pc-pw-mark');
  // the fan: the abilities beside the button, on its left (away from the screen's edge and from "jump")
  // (a column to the left of the button, bowed a little toward the thumb's arc and set higher than the button, clear
  // of "jump" under it; 32 px from word to word, so no two overlap however many there are. An arc was tried first:
  // with seven words the top ones lay side by side over each other. Seen on a phone-sized screen, 2026-11-17.)
  const NA = ABILITIES.length, MID = (NA - 1) / 2, tabs = ABILITIES.map((a, i) => {
    const t = doc.createElement('div'); t.className = 'pc-pw-tab'; t.textContent = a.word;
    const k = MID > 0 ? (i - MID) / MID : 0;
    t._x = -88 - 16 * (1 - k * k); t._y = (i - MID) * 32 - 30;
    t.style.transform = `translate(calc(-50% + ${t._x.toFixed(0)}px), calc(-50% + ${t._y.toFixed(0)}px))`;
    fan.appendChild(t); return t;
  });
  let coarse = false;
  try { coarse = root.ownerDocument.defaultView.matchMedia('(pointer: coarse)').matches; } catch { /* a mouse */ }
  let pid = null, cx = 0, cy = 0, sel = -1, open = false;
  const choose = (x, y) => {
    const dx = x - cx, dy = y - cy;
    if (!open && Math.hypot(dx, dy) > 30) { open = true; fan.classList.add('pc-open'); powers.keys.touch = false; }
    if (!open) return;
    let best = -1, bd = 46 * 46;
    tabs.forEach((t, i) => { const d = (dx - t._x) * (dx - t._x) + (dy - t._y) * (dy - t._y); if (d < bd) { bd = d; best = i; } });
    if (best !== sel) { sel = best; tabs.forEach((t, i) => t.classList.toggle('pc-sel', i === sel)); }
  };
  btn.addEventListener('pointerdown', (e) => {
    if (pid != null) return;
    pid = e.pointerId; const r = btn.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; sel = -1; open = false;
    try { btn.setPointerCapture(pid); } catch { /* old browsers */ }
    // (an ability that is held begins under the thumb at once; one that is cast is cast when the thumb lifts, so that
    // sliding off the button to open the fan does not cast it first)
    btn.classList.add('pc-down'); powers.keys.touch = !!ABILITIES[powers.ability].hold; e.preventDefault();
  });
  btn.addEventListener('pointermove', (e) => { if (e.pointerId === pid) choose(e.clientX, e.clientY); });
  const up = (e) => {
    if (e.pointerId !== pid) return;
    pid = null; btn.classList.remove('pc-down'); fan.classList.remove('pc-open'); tabs.forEach((t) => t.classList.remove('pc-sel'));
    powers.keys.touch = false;
    if (open && sel >= 0) {
      powers.pick(sel);
      // chosen in the fan: cast it once now (an ability that is held waits for the next press)
      if (!ABILITIES[sel].hold) powers.tapOnce = true;
    } else if (!open && e.type === 'pointerup' && !ABILITIES[powers.ability].hold) powers.tapOnce = true;      // a tap
  };
  btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
  let shown = null, wordNow = '', markKey = '';
  powers.onFrame = (p) => {
    const on = p.active;
    if (on !== shown) { shown = on; root.classList.toggle('pc-pw-live', on); root.classList.toggle('pc-pw-on', on && coarse); }
    const w = ABILITIES[p.ability].word;
    if (w !== wordNow) { wordNow = w; btn.textContent = w; word.textContent = 'wind: ' + w; }
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
  return { btn, fan, word, mark };
}
