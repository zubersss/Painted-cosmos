// Minimal HUD for the vertical slice: one prompt line, a jetpack gauge, a throttle gauge and a
// quiet read-out. Built on Painter's class names (pc-hud, pc-panel, pc-label, pc-button,
// pc-title, pc-icon); src/ui/fallback.css gives them a plain paper look until the painted
// theme exists.
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createHud(root) {
  root.classList.add('pc-hud');
  const prompt = el('div', 'pc-prompt', root);
  const gauges = el('div', 'pc-gauges', root);
  const fuel = el('div', 'pc-gauge pc-gauge-fuel', gauges);
  el('span', 'pc-label', fuel, 'jetpack');
  const fuelBar = el('i', '', el('b', '', fuel));
  const thr = el('div', 'pc-gauge pc-gauge-throttle', gauges);
  el('span', 'pc-label', thr, 'throttle');
  const thrBar = el('i', '', el('b', '', thr));
  const hint = el('div', 'pc-hint', root);
  const notice = el('div', 'pc-notice', root);
  const marks = el('div', 'pc-marks', root);
  const stats = el('div', 'pc-stats', root);
  const readout = el('div', 'pc-readout pc-label', root);
  const dot = el('div', 'pc-reticle', root);
  const card = el('div', 'pc-panel pc-start', root);
  el('div', 'pc-title', card, 'Painted Cosmos');
  const sub = el('div', 'pc-label pc-sub', card, 'a watercolour to walk into');
  // One line that says what the card is waiting for: the paper while loading, then a click.
  const status = el('div', 'pc-status', card, 'click to begin');
  const help = el('div', 'pc-help pc-label', card);
  help.innerHTML = [
    ['W A S D', 'walk'], ['Shift', 'run'], ['Space', 'jump, hold for the jetpack'],
    ['E', 'board, land, step out'], ['V', 'first / third person'],
    ['in the ship', ''], ['Space', 'lift off, rise'], ['C', 'sink'], ['W S', 'throttle'], ['A D', 'turn'],
    ['mouse', 'point the nose'], ['X', 'brake'], ['F', 'pulse drive (in space)'], ['M', 'map'],
    ['anywhere', ''], ['B', 'sketchbook'], ['H', 'this card'], ['`', 'frame read-out'],
  ].map(([k, t]) => (t ? `<span><kbd>${k}</kbd> ${t}</span>` : `<em>${k}</em>`)).join('');

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
  return {
    root,
    setPrompt(p) {
      const key = p ? `${p.key}|${p.text}|${p.key2 || ''}|${p.text2 || ''}` : '';
      if (key === lastPrompt) return;
      lastPrompt = key;
      prompt.innerHTML = '';
      prompt.classList.toggle('pc-on', !!p);
      if (!p) return;
      const add = (k, t) => { const s = el('span', 'pc-button', prompt); el('kbd', '', s, k); el('span', '', s, t); };
      add(p.key, p.text);
      if (p.key2) add(p.key2, p.text2);
    },
    promptText() { return lastPrompt; },
    setFuel(f, show) {
      fuel.classList.toggle('pc-on', !!show);
      fuelBar.style.width = Math.round(f * 100) + '%';
    },
    setThrottle(t, show) {
      thr.classList.toggle('pc-on', !!show);
      thrBar.style.width = Math.round(Math.max(0, t) * 100) + '%';
    },
    setReadout(text, show = true) {
      if (text !== lastReadout) { lastReadout = text; readout.textContent = text; }
      readout.classList.toggle('pc-on', !!show);
    },
    setReticle(on) { dot.classList.toggle('pc-on', !!on); },
    // One line of feedback above the prompt ("Mars ahead", "Too steep to land here").
    setNotice(text) {
      if (text === lastNotice) return;
      lastNotice = text;
      notice.classList.toggle('pc-on', !!text);
      if (text) notice.textContent = text;
    },
    // In-world markers. list: [{ id, x, y (css px), r (px), label, sub, kind: 'target'|'body'|'edge', angle }]
    setMarks(list) {
      while (markEls.length < list.length) {
        const m = el('div', 'pc-mark', marks);
        m._ring = el('i', '', m); m._label = el('span', 'pc-label', m);
        markEls.push(m);
      }
      for (let i = 0; i < markEls.length; i++) {
        const m = markEls[i], d = list[i];
        if (!d) { if (m._on) { m.style.display = 'none'; m._on = false; } continue; }
        if (!m._on) { m.style.display = ''; m._on = true; }
        m.className = 'pc-mark pc-mark-' + d.kind;
        m.style.transform = `translate(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px)`;
        const size = Math.max(14, Math.min(260, d.r * 2 + 10));
        m._ring.style.width = m._ring.style.height = size.toFixed(0) + 'px';
        m._ring.style.margin = `${(-size / 2).toFixed(0)}px 0 0 ${(-size / 2).toFixed(0)}px`;
        m._ring.style.transform = d.kind === 'edge' ? `rotate(${(d.angle || 0).toFixed(2)}rad)` : '';
        m._label.style.top = (size / 2 + 3).toFixed(0) + 'px';
        const text = d.sub ? d.label + '\n' + d.sub : d.label;
        if (m._text !== text) { m._text = text; m._label.textContent = text; }
      }
    },
    // The frame-time read-out (behind ?stats=1 or the ` key).
    setStats(text) {
      stats.classList.toggle('pc-on', !!text);
      if (text && text !== lastStats) { lastStats = text; stats.textContent = text; }
    },
    showStart(on) { if (on) fit(); card.classList.toggle('pc-on', !!on); },
    get startShown() { return card.classList.contains('pc-on'); },
    setSubtitle(text) { sub.textContent = text; },
    // The card's one line of status ("preparing the paper...", "click to begin", "H closes this card").
    setStartStatus(text, waiting = false) {
      if (status.textContent !== text) status.textContent = text;
      status.classList.toggle('pc-wait', !!waiting);
    },
    // While the first view is being built only the title card shows, on the bare sheet.
    setWaiting(on) { root.classList.toggle('pc-waiting', !!on); },
    // A quiet line at the top: how to look around while the mouse is not captured.
    setHint(text) { hint.classList.toggle('pc-on', !!text); if (text && hint.textContent !== text) hint.textContent = text; },
    startCard: card,
  };
}
