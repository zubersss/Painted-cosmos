// Minimal HUD: one prompt line, a jetpack gauge, a throttle gauge, a quiet read-out, markers
// for the worlds, the title and help card. Everything on it is painted (src/ui/paint.js):
// torn paper slips, hand lettering, ink rings; src/ui/theme.css lays it out.
import { installTheme, ink, ringPath, iconSvg, SIZE } from './paint.js';
import { layoutMarks, ringSize, wrapLettering } from './layout.js';

// el(tag, class, parent, text, size): `text` is lettered by hand at `size` (cap height, px).
function el(tag, cls, parent, text, size) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) ink(e, text, size || SIZE.body);
  if (parent) parent.appendChild(e);
  return e;
}

export function createHud(root) {
  installTheme();
  root.classList.add('pc-hud');
  const prompt = el('div', 'pc-prompt', root);
  const gauges = el('div', 'pc-gauges', root);
  const fuel = el('div', 'pc-gauge pc-gauge-fuel', gauges);
  fuel.insertAdjacentHTML('beforeend', iconSvg('jet', 19));
  el('span', 'pc-label', fuel, 'jetpack', SIZE.small);
  const fuelBar = el('i', '', el('b', '', fuel));
  const thr = el('div', 'pc-gauge pc-gauge-throttle', gauges);
  thr.insertAdjacentHTML('beforeend', iconSvg('thrust', 19, '#4d60b2'));
  el('span', 'pc-label', thr, 'throttle', SIZE.small);
  const thrBar = el('i', '', el('b', '', thr));
  const hint = el('div', 'pc-hint', root);
  const notice = el('div', 'pc-notice', root);
  const marks = el('div', 'pc-marks', root);
  const stats = el('div', 'pc-stats', root);
  // A new page in the sketchbook: the sketch itself, shown for a few seconds as it is made.
  const fresh = el('div', 'pc-newsketch', root);
  const freshImg = el('img', '', fresh); freshImg.alt = ''; freshImg.draggable = false;
  const freshTitle = el('b', '', fresh);
  const freshSub = el('span', 'pc-label', fresh);
  let freshTimer = 0;
  const readout = el('div', 'pc-readout pc-label', root);
  const dot = el('div', 'pc-reticle', root);
  const card = el('div', 'pc-panel pc-start', root);
  ink(el('div', 'pc-title', card), 'Painted Cosmos', SIZE.title, { rough: true, tracking: 1.12 });
  const sub = el('div', 'pc-label pc-sub', card, 'a watercolour to walk into', SIZE.prompt);
  // One line that says what the card is waiting for: the paper while loading, then a click.
  const status = el('div', 'pc-status', card);
  const statusText = el('span', '', status, 'click to begin', SIZE.prompt);
  status.insertAdjacentHTML('beforeend', '<i class="pc-dabs"><b></b><b></b><b></b></i>');
  // The title is the title (PAINTER's critique 7: "the title card is the manual, and it covers the
  // painting"): until the game has begun the card is small, in the upper third, and carries the
  // name, the line under it, the stroke that says "click to begin" and one line of the keys a
  // newcomer needs; the painting is open under it. The whole list of keys is the same card on H.
  const first = el('div', 'pc-label pc-first', card);
  const firstLine = () => ink(first, `${keyName(['KeyW', 'KeyA', 'KeyS', 'KeyD'])} walk   \u00b7   the mouse looks\n${keyName(['KeyE'])} boards the ship   \u00b7   ${keyName(['KeyH'])} shows every key`, SIZE.small, { align: 'center' });
  card.classList.add('pc-title-only');
  const help = el('div', 'pc-help pc-label', card);
  // Keys named by code are relabelled for the player's keyboard layout (setKeyLabels; the
  // walking keys are by position, so on AZERTY "W A S D" reads "Z Q S D").
  const rows = [
    [['KeyW', 'KeyA', 'KeyS', 'KeyD'], 'walk'], ['Shift', 'run'], [['KeyC'], 'stroll / pace'], ['Space', 'jump, hold for the jetpack'],
    ['mouse', 'look (click the picture)'], ['wheel', 'camera nearer / farther'],
    [['KeyE'], 'board, land, step out'], [['KeyV'], 'first / third person'],
    ['in the ship', ''], ['Space', 'lift off, rise'], [['KeyC'], 'sink'], [['KeyW', 'KeyS'], 'throttle'], [['KeyA', 'KeyD'], 'turn'],
    ['mouse', 'point the nose'], [['KeyX'], 'brake'], [['KeyF'], 'pulse drive (in space)'], [['KeyM'], 'map'], [['KeyV'], 'cockpit / chase'],
    ['anywhere', ''], [['KeyB'], 'sketchbook'], [['KeyH'], 'this card'], ['backquote', 'frame read-out'], ['pad', 'a gamepad works too'],
  ];
  let labels = {};
  function keyName(k) { return Array.isArray(k) ? k.map((c) => labels[c] || c.slice(3)).join(' ') : k; }
  const promptKey = (k) => (typeof k === 'string' && k.length === 1 && labels['Key' + k]) || k;
  const keyEls = [];
  for (const [k, t] of rows) {
    if (!t) { el('em', '', help, k, SIZE.small); continue; }
    const row = el('span', '', help);
    const kb = el('kbd', '', row, keyName(k), SIZE.key);
    if (Array.isArray(k)) keyEls.push([kb, k]);
    el('span', '', row, t, SIZE.body);
  }

  firstLine();
  // Keep the start card inside small windows.
  // (measured, not assumed: the card's laid-out size is not changed by the scale itself)
  const fit = () => card.style.setProperty('--pc-fit', String(Math.min(1,
    window.innerWidth / ((card.offsetWidth || 608) + 36), window.innerHeight / ((card.offsetHeight || 500) + 44))));
  window.addEventListener('resize', fit);
  fit();

  let lastPrompt = '';
  let lastReadout = '';
  let lastNotice = null;
  let lastStats = '';
  const markEls = [];
  // Where the slips that are up lie on the screen (read every few frames: they seldom move):
  // the markers' labels keep off them.
  let slips = [], slipTick = 0;
  const slipRects = () => {
    const out = [];
    const take = (e) => { const r = e.getBoundingClientRect(); if (r.width > 0) out.push({ x0: r.left - 5, y0: r.top - 4, x1: r.right + 5, y1: r.bottom + 4, soft: true }); };
    if (prompt.classList.contains('pc-on')) for (const b of prompt.children) take(b);
    for (const e of [notice, hint, fuel, thr, readout, fresh]) if (e.classList.contains('pc-on')) take(e);
    return out;
  };
  // The widest a line of a notice or the hint may be lettered, for this window: on foot in third
  // person the notice lies at the top, between the edge and the new page's slip in the corner.
  const lineRoom = (share) => Math.max(140, Math.min(640, (window.innerWidth || 1280) * share - 36));
  return {
    root,
    setPrompt(p) {
      const key = p ? `${p.key}|${p.text}|${p.key2 || ''}|${p.text2 || ''}` : '';
      if (key === lastPrompt) return;
      lastPrompt = key;
      prompt.innerHTML = '';
      prompt.classList.toggle('pc-on', !!p);
      if (!p) return;
      const add = (k, t) => { const s = el('span', 'pc-button', prompt); el('kbd', '', s, promptKey(k), SIZE.key); el('span', '', s, t, SIZE.prompt); };
      add(p.key, p.text);
      if (p.key2) add(p.key2, p.text2);
    },
    promptText() { return lastPrompt; },
    // Key names for this keyboard layout ({ KeyW: 'Z', ... } from src/core/input.js keyLabels).
    setKeyLabels(map) {
      labels = map || {};
      for (const [kb, k] of keyEls) ink(kb, keyName(k), SIZE.key);
      firstLine();
      lastPrompt = '';                    // the next prompt is drawn afresh with the new names
      fit();
    },
    keyLabel: (code) => labels[code] || code.slice(3),
    setFuel(f, show) {
      fuel.classList.toggle('pc-on', !!show);
      fuelBar.style.width = Math.round(f * 100) + '%';
    },
    setThrottle(t, show) {
      thr.classList.toggle('pc-on', !!show);
      thrBar.style.width = Math.round(Math.max(0, t) * 100) + '%';
    },
    setReadout(text, show = true) {
      if (text !== lastReadout) { lastReadout = text; ink(readout, text, SIZE.body); }
      readout.classList.toggle('pc-on', !!show);
    },
    setReticle(on) { dot.classList.toggle('pc-on', !!on); },
    // One line of feedback above the prompt ("Mars ahead", "Too steep to land here").
    // (wrapped to the window: the lettering does not wrap by itself, and a long line ran off a small one)
    setNotice(text) {
      const room = lineRoom(root.classList.contains('pc-foot3') ? 0.44 : 0.8);
      const key = text ? text + '|' + room : null;
      if (key === lastNotice) return;
      lastNotice = key;
      notice.classList.toggle('pc-on', !!text);
      if (text) ink(notice, wrapLettering(text, SIZE.prompt, room), SIZE.prompt, { align: 'center' });
    },
    // In-world markers. list: [{ id, x, y (css px), r (px), label, sub, kind: 'target'|'body'|'edge', angle }]
    // view: { w, h (css px of the picture), keep: [{ x0, y0, x1, y1 }] rectangles no label may lie on
    // (the ship in the chase view) }. The labels are laid out here (src/ui/layout.js): off the ship,
    // off the slips that are up, off each other; a world whose name has no room keeps its ring.
    setMarks(list, view) {
      if (list.length) {
        if (slipTick++ % 6 === 0) slips = slipRects();
        layoutMarks(list, {
          w: (view && view.w) || window.innerWidth, h: (view && view.h) || window.innerHeight,
          sizeOf: (d) => (d.kind === 'target' ? SIZE.small : SIZE.tiny), keep: ((view && view.keep) || []).concat(slips),
        });
      } else slipTick = 0;
      while (markEls.length < list.length) {
        const m = el('div', 'pc-mark', marks);
        m._ring = el('i', '', m); m._label = el('span', 'pc-label', m); m._seed = markEls.length + 1;
        markEls.push(m);
      }
      for (let i = 0; i < markEls.length; i++) {
        const m = markEls[i], d = list[i];
        if (!d) { if (m._on) { m.style.display = 'none'; m._on = false; } continue; }
        if (!m._on) { m.style.display = ''; m._on = true; }
        m.className = 'pc-mark pc-mark-' + d.kind;
        m.style.transform = `translate(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px)`;
        // The ring is one pull of a loaded brush (paper-white over a thin ink line, so it
        // reads on indigo and on a bright world alike); its size moves in 2 px steps.
        const size = ringSize(d.r);
        const shape = d.kind + size;
        if (m._shape !== shape) {
          m._shape = shape;
          const half = size / 2 + 6;
          const path = d.kind === 'edge' ? 'M-9 -7.5L7 0.2L-9 7.5M-9 -7.5L-5.4 0.2L-9 7.5' : ringPath(size / 2, m._seed);
          m._ring.innerHTML = `<svg width="${2 * half}" height="${2 * half}" viewBox="${-half} ${-half} ${2 * half} ${2 * half}" style="left:${-half}px;top:${-half}px"><path class="pc-ring-ink" d="${path}"/><path class="pc-ring-paper" d="${path}"/></svg>`;
        }
        m._ring.style.transform = d.kind === 'edge' ? `rotate(${(d.angle || 0).toFixed(2)}rad)` : '';
        const text = d.text || null;
        if (!text) { if (m._text !== null) { m._text = null; m._label.style.display = 'none'; } continue; }
        if (m._text === null || m._text === undefined) m._label.style.display = '';
        m._label.style.left = d.lx.toFixed(0) + 'px'; m._label.style.top = d.ly.toFixed(0) + 'px';
        if (m._text !== text) { m._text = text; ink(m._label, text, d.kind === 'target' ? SIZE.small : SIZE.tiny, { align: 'center' }); }
      }
    },
    // "A new page": the sketch that was just kept, its name, and where it went.
    showSketch(url, title, sub, seconds = 6) {
      freshImg.src = url;
      // (a long name is wrapped to the slip: "Alpine Meadow and Snow Peaks" ran off it and off the screen)
      const room = Math.max(120, (fresh.clientWidth || 160) - 14);
      ink(freshTitle, wrapLettering(title || '', SIZE.body, room), SIZE.body);
      ink(freshSub, wrapLettering(sub || '', SIZE.tiny, room), SIZE.tiny);
      fresh.classList.add('pc-on');
      clearTimeout(freshTimer);
      freshTimer = setTimeout(() => fresh.classList.remove('pc-on'), seconds * 1000);
    },
    hideSketch() { clearTimeout(freshTimer); fresh.classList.remove('pc-on'); },
    get sketchShown() { return fresh.classList.contains('pc-on'); },
    // The frame-time read-out (behind ?stats=1 or the ` key).
    setStats(text) {
      stats.classList.toggle('pc-on', !!text);
      if (text && text !== lastStats) { lastStats = text; stats.textContent = text; }
    },
    // (the first time the card is put away the game has begun: from then on it is the help card, whole)
    showStart(on) {
      if (!on) card.classList.remove('pc-title-only');
      if (on) fit();
      card.classList.toggle('pc-on', !!on);
    },
    get startShown() { return card.classList.contains('pc-on'); },
    setSubtitle(text) { ink(sub, text, SIZE.prompt); },
    // The card's one line of status ("preparing the paper...", "click to begin", "H closes this card").
    setStartStatus(text, waiting = false) {
      ink(statusText, text, SIZE.prompt);
      status.classList.toggle('pc-wait', !!waiting);
    },
    // While the first view is being built only the title card shows, on the bare sheet.
    setWaiting(on) { root.classList.toggle('pc-waiting', !!on); },
    // A quiet line at the top: how to look around while the mouse is not captured.
    setHint(text) { hint.classList.toggle('pc-on', !!text); if (text) ink(hint, wrapLettering(text, SIZE.small, lineRoom(0.86)), SIZE.small, { align: 'center' }); },
    startCard: card,
  };
}
