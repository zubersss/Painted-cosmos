// The words the game says about its controls, for the hand that is on it (W3.3 of the
// sharp-smooth plan). Pure: no DOM.
//
// One name(code) for every control the game names: the key as this keyboard prints it, the touch
// control that does the same thing, or the gamepad's button. A sentence that names a control is
// written once, with {Code} where the control goes (several codes in one pair of braces are named
// together: {KeyW KeyA KeyS KeyD}) and {press} or {click} where the verb goes; words(text, mode)
// letters it for the keyboard (exactly as the game always said it), for the fingers or for the pad.
//
//   modes   'keys'  the keyboard and the mouse (the desktop: every string as it always read)
//           'touch' the touch layer is up (src/core/touch.js): no key and no mouse is ever named
//           'pad'   the gamepad was the last hand on the game (its buttons by their standard names)
//
// Where a sentence reads differently by touch (not just a name swapped), its touch form is in
// TOUCH_FORMS, keyed by the sentence as written. A sentence about a control the touch layer does
// not have (the stroll on C, the mouse's capture) has no touch form: words() gives null and the
// game says nothing.

// The keyboard's names for what is not a letter key (a letter key is its letter: KeyF -> F).
const KEY_NAMES = Object.freeze({
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Backquote: '`', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
});

// The touch control that does what the key does (src/ui/hud.js): the round buttons are lettered
// jump (rise in the ship), sink and brake; the prompts are slips to tap; the tabs in the corner.
// null: no touch control does it (the stroll: the stick's deflection is the pace).
const TOUCH_NAMES = Object.freeze({
  Space: (o) => (o.inShip ? 'rise' : 'jump'),
  KeyC: (o) => (o.inShip ? 'sink' : null),
  KeyX: 'brake',
  KeyE: 'the slip',
  KeyF: 'the pulse slip',
  KeyM: 'the map tab', KeyB: 'the sketchbook tab', KeyH: 'the help tab', KeyV: 'the view tab',
  KeyW: 'the stick forward', KeyS: 'the stick back', KeyA: 'the stick left', KeyD: 'the stick right',
  ShiftLeft: 'the stick at its rim', ShiftRight: 'the stick at its rim',
  Backquote: null, Enter: null, Escape: null, Tab: null,
});

// The standard gamepad's buttons (src/core/gamepad.js maps them to these codes).
const PAD_NAMES = Object.freeze({
  Space: 'A', KeyC: 'B', KeyE: 'X', KeyV: 'Y', KeyX: 'LB', KeyF: 'RB', KeyM: 'Back', KeyH: 'Start', KeyB: 'Up on the d-pad',
  KeyW: (o) => (o.inShip ? 'RT' : 'the left stick'), KeyS: (o) => (o.inShip ? 'LT' : 'the left stick'),
  KeyA: 'the left stick', KeyD: 'the left stick', ShiftLeft: 'L3', ShiftRight: 'L3',
  Enter: 'Down on the d-pad', ArrowLeft: 'Left on the d-pad', ArrowRight: 'Right on the d-pad', Backquote: null, Escape: null, Tab: null,
});

const VERBS = Object.freeze({
  press: { keys: 'press', touch: 'tap', pad: 'press' },
  click: { keys: 'click', touch: 'tap', pad: 'click' },
});

// Sentences that read differently by touch, by the sentence as written (keys form, with its
// tokens). null: not said on a touch screen at all (it is about the mouse).
export const TOUCH_FORMS = Object.freeze({
  'Click or press a key for sound': 'Tap the picture for sound',
  '{KeyH} closes this card': 'a tap anywhere closes this card',
  '{KeyB} opens the sketchbook': 'the sketchbook tab opens the book',
  'click a world, or use the arrow keys, to set a course': 'tap a world to set a course',
  'arrow keys turn the page, {KeyB} closes': 'a swipe turns the page, a tap outside closes it',
  '{KeyW KeyA KeyS KeyD} walk   ·   the mouse looks\n{KeyE} boards the ship   ·   {KeyH} shows every key':
    'the left thumb walks   ·   a drag on the right looks\ntap "Board ship" at the ship   ·   ? shows the controls',
  'click the picture to look around with the mouse': 'drag on the right to look around',
  'hold the left mouse button and drag to look around': 'drag on the right to look around',
  // the mouse's capture (src/core/input.js): never asked for by a finger, never said to one
  'Mouse capture is not available here: hold the left button and drag to look': null,
  'Click again to capture the mouse': null,
  'Mouse capture was refused here: hold the left button and drag to look': null,
  'Mouse capture was refused: click again, or hold the left button and drag to look': null,
  'Mouse capture misbehaved: hold the left button and drag to look (a later click tries capture again)': null,
  'Mouse capture is misbehaving in this browser: hold the left button and drag to look': null,
});

// The same for the pad, where its sentence is not the keys' one with the names swapped.
export const PAD_FORMS = Object.freeze({
  '{KeyW KeyA KeyS KeyD} walk   \u00b7   the mouse looks\n{KeyE} boards the ship   \u00b7   {KeyH} shows every key':
    'the left stick walks   \u00b7   the right stick looks\n{KeyE} boards the ship   \u00b7   {KeyH} shows every control',
  'arrow keys turn the page, {KeyB} closes': 'the d-pad turns the page, Down closes',
  'click a world, or use the arrow keys, to set a course': 'the d-pad steps through the worlds, to set a course',
});

const call = (v, o) => (typeof v === 'function' ? v(o) : v);

// The name of the control `code` (an input code: 'KeyF', 'Space') in this mode. opts: { labels
// (the keyboard layout's letters, src/core/input.js keyLabels), inShip }. null where the mode has
// no such control.
export function name(code, mode = 'keys', opts = {}) {
  const o = opts || {};
  if (mode === 'touch') return code in TOUCH_NAMES ? call(TOUCH_NAMES[code], o) : null;
  if (mode === 'pad') {
    if (code in PAD_NAMES) return call(PAD_NAMES[code], o);
    return null;
  }
  const labels = o.labels || {};
  if (labels[code]) return labels[code];
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  return /^Key[A-Z]$/.test(code) ? code.slice(3) : code;
}

// Several codes named together ("W A S D"; by touch "the stick"), or null if one has no name.
function names(codes, mode, o) {
  if (mode === 'touch' && codes.length > 1 && codes.every((c) => /^Key[WASD]$/.test(c))) return 'the stick';
  if (mode === 'pad' && codes.length > 1 && codes.every((c) => /^Key[WASD]$/.test(c))) return 'the left stick';
  const out = [];
  for (const c of codes) { const n = name(c, mode, o); if (n == null) return null; if (!out.includes(n) || mode === 'keys') out.push(n); }
  return out.join(' ');
}

const TOKEN = /\{([A-Za-z][A-Za-z ]*)\}/g;

// Fill the tokens of `text` for this mode; null if the sentence is not said in it.
function fill(text, mode, o) {
  let gone = false;
  const out = text.replace(TOKEN, (m, inner) => {
    const v = VERBS[inner];
    if (v) return v[mode] || v.keys;
    const n = names(inner.trim().split(/\s+/), mode, o);
    if (n == null) { gone = true; return ''; }
    return n;
  });
  return gone ? null : out;
}

// `text` lettered for this mode: 'keys' (and any unknown mode) as the game always said it, 'touch'
// with no key and no mouse named, 'pad' by the pad's buttons. null: not said in this mode.
export function words(text, mode = 'keys', opts = {}) {
  if (text == null) return null;
  const t = String(text), o = opts || {};
  const m = mode === 'touch' || mode === 'pad' ? mode : 'keys';
  const forms = m === 'touch' ? TOUCH_FORMS : m === 'pad' ? PAD_FORMS : null;
  if (forms && Object.prototype.hasOwnProperty.call(forms, t)) return forms[t] == null ? null : fill(forms[t], m, o);
  let out = fill(t, m, o);
  if (out == null) return null;
  // (a sentence's form written out above has its own capitals; a sentence whose first word was a
  // key's letter starts with a capital however the control is named)
  if (m !== 'keys' && out) {
    const keysForm = fill(t, 'keys', o) || '';
    if (/^[A-Z]/.test(keysForm) && /^[a-z]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

// Does this string name a key, a key's letter, or the mouse? (For the touch screen's words: the
// tests hold every touch-mode string to it.) The article "A" at a sentence's start is not a key.
export function namesAKey(s) {
  if (!s) return false;
  const t = String(s);
  if (/\b(click|clicks|clicking|mouse|key|keys|keyboard|wheel|backquote|arrow keys)\b/i.test(t)) return true;
  if (/\b(Space|SPACE|Shift|Enter|Esc|Escape|Tab)\b/.test(t)) return true;
  // a lone capital that is one of the game's keys (W A S D E V C X F M B H), standing as a word
  return /(^|[^A-Za-z'])[WSDEVCXFMBH](?=$|[^A-Za-z'])/.test(t) || /(^|[^A-Za-z])A [SDW]\b|\bW A\b/.test(t);
}
