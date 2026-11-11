// The sketchbook: every world you have stood on, the biomes you walked through, the views you
// found. B opens and closes it. A plain paper panel until Painter's theme arrives.
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const pretty = (id) => String(id).replace(/[_-]+/g, ' ');

export function createBook(root) {
  const panel = el('div', 'pc-panel pc-book', root);
  el('div', 'pc-title', panel, 'sketchbook');
  const list = el('div', 'pc-book-list', panel);
  const foot = el('div', 'pc-label pc-book-foot', panel, '');
  let open = false;
  return {
    get open() { return open; },
    // pages: sim.sketchbook(); hint: { name, distance, bearingDeg } | null; totals: { bodyId: n biomes }
    show(pages, hint, totals = {}) {
      open = true;
      panel.style.setProperty('--pc-fit', String(Math.min(1, window.innerWidth / 700, window.innerHeight / 560)));
      list.innerHTML = '';
      for (const p of pages) {
        const row = el('div', 'pc-book-row' + (p.visited ? ' pc-on' : ''), list);
        el('b', '', row, p.name);
        if (!p.visited) { el('span', 'pc-label', row, 'not yet visited'); continue; }
        const total = totals[p.id];
        el('span', 'pc-label', row, `${p.biomes.length}${total ? ' of ' + total : ''} landscape${p.biomes.length === 1 && !total ? '' : 's'}: ${p.biomes.map(pretty).join(', ')}`);
        el('span', 'pc-label', row, p.vistasTotal ? `${p.vistasFound.length} of ${p.vistasTotal} views${p.vistasFound.length ? ': ' + p.vistasFound.join(', ') : ''}` : '');
      }
      const where = (deg) => (Math.abs(deg) < 25 ? 'ahead' : Math.abs(deg) > 155 ? 'behind you' : deg > 0 ? (deg < 90 ? 'ahead to the right' : 'behind to the right') : (deg > -90 ? 'ahead to the left' : 'behind to the left'));
      foot.textContent = hint ? `the nearest view not yet drawn: ${hint.name}, ${hint.distance >= 1000 ? (hint.distance / 1000).toFixed(1) + ' km' : Math.round(hint.distance) + ' m'} ${where(hint.bearingDeg)}` : '';
      panel.classList.add('pc-on');
    },
    hide() { open = false; panel.classList.remove('pc-on'); },
    panel,
  };
}
