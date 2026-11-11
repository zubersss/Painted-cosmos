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
  const readout = el('div', 'pc-readout pc-label', root);
  const dot = el('div', 'pc-reticle', root);
  const card = el('div', 'pc-panel pc-start', root);
  el('div', 'pc-title', card, 'Painted Cosmos');
  el('div', 'pc-label', card, 'click to begin');
  const help = el('div', 'pc-help pc-label', card);
  help.innerHTML = [
    ['W A S D', 'walk'], ['Shift', 'run'], ['Space', 'jump, hold for the jetpack'],
    ['E', 'board, land, step out'], ['V', 'first / third person'],
    ['in the ship', ''], ['Space', 'lift off, rise'], ['C', 'sink'], ['W S', 'throttle'], ['A D', 'turn'],
    ['mouse', 'point the nose'], ['X', 'stop'],
  ].map(([k, t]) => (t ? `<span><kbd>${k}</kbd> ${t}</span>` : `<em>${k}</em>`)).join('');

  // Keep the start card inside small windows.
  const fit = () => card.style.setProperty('--pc-fit', String(Math.min(1, window.innerWidth / 620, window.innerHeight / 470)));
  window.addEventListener('resize', fit);
  fit();

  let lastPrompt = '';
  let lastReadout = '';
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
    showStart(on) { card.classList.toggle('pc-on', !!on); },
    startCard: card,
  };
}
