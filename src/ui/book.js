// The sketchbook: one page per world, with a small sketch for every landscape walked and every
// view found (kept at the moment it happened), and empty frames for the ones still to find.
// B opens and closes it; the arrow keys (or a click on a tab) turn the pages.
// A plain paper look until Painter's theme arrives.
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createBook(root) {
  const panel = el('div', 'pc-panel pc-book', root);
  const head = el('div', 'pc-book-head', panel);
  el('div', 'pc-title', head, 'sketchbook');
  const tally = el('div', 'pc-label pc-book-tally', head, '');
  const body = el('div', 'pc-book-body', panel);
  const tabs = el('div', 'pc-book-tabs', body);
  const page = el('div', 'pc-book-page', body);
  const foot = el('div', 'pc-label pc-book-foot', panel, '');
  let open = false, pages = [], at = 0, hintText = '';

  const count = (p) => {
    const all = p.biomes.concat(p.vistas);
    return { done: all.filter((x) => x.done).length, total: all.length };
  };

  function tile(parent, x, kind) {
    const t = el('figure', 'pc-sketch' + (x.done ? ' pc-on' : '') + (kind === 'vista' ? ' pc-sketch-vista' : ''), parent);
    const frame = el('div', 'pc-sketch-frame', t);
    if (x.done && x.sketch) { const img = el('img', '', frame); img.alt = x.name; img.draggable = false; img.src = x.sketch; }
    else el('span', '', frame, x.done ? 'no sketch kept' : kind === 'vista' ? 'a view to find' : 'not yet walked');
    el('figcaption', '', t, x.name);
    return t;
  }

  function draw() {
    const p = pages[at];
    tabs.innerHTML = '';
    pages.forEach((q, i) => {
      const c = count(q);
      const b = el('button', 'pc-book-tab' + (i === at ? ' pc-on' : '') + (q.visited ? '' : ' pc-dim'), tabs);
      el('b', '', b, q.name);
      el('span', '', b, c.total ? `${c.done}/${c.total}` : '');
      b.addEventListener('click', () => { at = i; draw(); });
    });
    page.innerHTML = '';
    if (!p) return;
    const nb = p.biomes.filter((x) => x.done).length, nv = p.vistas.filter((x) => x.done).length;
    el('div', 'pc-book-world', page, p.name);
    el('div', 'pc-label pc-book-sub', page, !p.visited ? 'not yet visited' + (p.biomes.length ? `: ${p.biomes.length} landscapes and ${p.vistas.length} views wait here` : '')
      : `${nb} of ${p.biomes.length} landscape${p.biomes.length === 1 ? '' : 's'} walked` + (p.vistas.length ? `, ${nv} of ${p.vistas.length} views found` : ''));
    if (p.biomes.length) {
      el('div', 'pc-label pc-book-kind', page, 'landscapes');
      const g = el('div', 'pc-book-grid', page);
      for (const x of p.biomes) tile(g, x, 'biome');
    }
    if (p.vistas.length) {
      el('div', 'pc-label pc-book-kind', page, 'views');
      const g = el('div', 'pc-book-grid', page);
      for (const x of p.vistas) tile(g, x, 'vista');
    }
    let done = 0, total = 0;
    for (const q of pages) { const c = count(q); done += c.done; total += c.total; }
    tally.textContent = total ? `${done} of ${total} pages drawn` : '';
    foot.textContent = (hintText ? hintText + '  \u00b7  ' : '') + 'arrow keys turn the page, B closes';
    // Fit the open book inside small windows (its laid-out size is not changed by the scale).
    panel.style.setProperty('--pc-fit', String(Math.min(1, window.innerWidth / (panel.offsetWidth + 30), window.innerHeight / (panel.offsetHeight + 30))));
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
      hintText = hint ? `the nearest view not yet drawn: ${hint.name}, ${hint.distance >= 1000 ? (hint.distance / 1000).toFixed(1) + ' km' : Math.round(hint.distance) + ' m'} ${where(hint.bearingDeg)}` : '';
      panel.classList.add('pc-on');
      draw();
    },
    step(n) { if (open && pages.length) { at = (at + n + pages.length) % pages.length; draw(); } },
    hide() { open = false; panel.classList.remove('pc-on'); },
    panel,
  };
}
