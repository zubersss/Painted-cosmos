// The planet map: a small ink-and-wash chart of the system on a paper panel. Click a world (or
// use the arrow keys) to choose where the pulse drive should take you; M or Enter closes it.
// Drawn in code on a 2D canvas; names and the line under the chart are lettered by hand.
import { BODIES, BODY_IDS } from '../data/bodies.js';
import { ink, inkOnCanvas, measureInk, SIZE, CLOSE_SVG } from './paint.js';
import { words } from '../core/words.js';
import { wrapLettering } from './layout.js';

const INK = '#232a45', SEPIA = '#584435';
// Mock pigments per body (the painted palettes are Painter's; these only tell the dots apart).
const TINT = {
  mercury: '#b9a58a', venus: '#d9b860', earth: '#7fa98c', moon: '#b8b8b4', mars: '#c5805c',
  jupiter: '#d9b98c', saturn: '#dcc88e', uranus: '#9fd0c6', neptune: '#7f97cf', pluto: '#c9bfc9',
};
const W = 680, H = 400;
// On a touch screen (W3.3) the chart fills the screen and is drawn at its own size in css px:
// the names lettered at TOUCH.name css px at least, a world taken by a finger within TOUCH.hit css
// px of its dot, and a moon drawn TOUCH.moon css px from its planet, so that Earth and the Moon
// are two places for a finger, not one (8.5 css px apart on a phone at the sheet's old scale).
export const MAP_TOUCH = Object.freeze({ name: 11.5, hit: 26, moon: 46, maxRatio: 1.35 });

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

// press(code): on a touch screen (W3.2) the corner that closes the sheet and the 'set course'
// slip press the map's key (the game puts the sheet away on it; the course is set by the pick).
// mode(): which hand is on the game ('keys', 'touch', 'pad': src/core/words.js), for the line.
export function createMap(root, { onSelect, press, mode } = {}) {
  const panel = el('div', 'pc-panel pc-map', root);
  ink(el('div', 'pc-title', panel), 'the system', SIZE.head + 3, { rough: true, tracking: 1.1 });
  const chart = el('div', 'pc-map-chart', panel);
  const canvas = el('canvas', '', chart);
  canvas.width = W * 2; canvas.height = H * 2;
  const line = el('div', 'pc-label pc-map-line', panel);
  const go = el('div', 'pc-button pc-map-go', panel);
  const close = el('div', 'pc-close', panel);
  close.innerHTML = CLOSE_SVG;
  for (const e of [go, close]) {
    e.addEventListener('touchstart', (ev) => { if (ev.cancelable) ev.preventDefault(); }, { passive: false });
    e.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); if (press) press('KeyM'); });
  }
  const g = canvas.getContext('2d');
  let open = false, spots = [], selected = null, here = null, last = null, goSize = SIZE.prompt;
  // How the chart's 680 x 400 lie on the canvas: k canvas px per css px, (sx, sy) css px per chart
  // unit, (ox, oy) the chart's corner in css px. The desktop: the canvas is the chart, at 2x.
  const DESK = Object.freeze({ k: 2, sx: 1, sy: 1, ox: 0, oy: 0, w: W, h: H, touch: false });
  let view = DESK, labelSizes = [];
  const touchOn = () => root.classList.contains('pc-touch');
  const sayMode = () => (touchOn() ? 'touch' : (mode && mode()) || 'keys');
  // (re)fit the canvas to its box: on a touch screen the box is the sheet's (theme.css), and the
  // chart is stretched to it up to MAP_TOUCH.maxRatio one way, centred the other
  function layout() {
    if (!touchOn()) {
      if (view !== DESK) { view = DESK; canvas.width = W * 2; canvas.height = H * 2; }
      return;
    }
    const r = chart.getBoundingClientRect();
    const cw = Math.max(80, Math.round(r.width)), ch = Math.max(60, Math.round(r.height));
    const k = Math.min(2, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    let sx = cw / W, sy = ch / H;
    if (sx > sy * MAP_TOUCH.maxRatio) sx = sy * MAP_TOUCH.maxRatio;
    if (sy > sx * MAP_TOUCH.maxRatio) sy = sx * MAP_TOUCH.maxRatio;
    view = { k, sx, sy, ox: (cw - W * sx) / 2, oy: (ch - H * sy) / 2, w: cw, h: ch, touch: true };
    if (canvas.width !== Math.round(cw * k) || canvas.height !== Math.round(ch * k)) { canvas.width = Math.round(cw * k); canvas.height = Math.round(ch * k); }
  }

  // Orbit radius on the chart: compressed so Mercury and Pluto both fit.
  const R = (m) => 26 + 150 * Math.log(1 + m / 60e3) / Math.log(1 + 1180e3 / 60e3) * 1.15;
  const wob = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5 + 0.5;

  function draw(data) {
    last = data;
    const V = view, sm = Math.min(V.sx, V.sy), lw = V.touch ? Math.max(1, sm) : 1;
    const X = (x) => V.ox + x * V.sx, Y = (y) => V.oy + y * V.sy;
    g.setTransform(V.k, 0, 0, V.k, 0, 0);
    g.clearRect(0, 0, V.w, V.h);                     // the chart is drawn straight on the panel's paper
    const cx = W / 2, cy = H / 2 + 4;
    // Orbits: pencilled freehand. Each is pulled round in three or four strokes that do not
    // quite meet and do not quite keep their distance; where two strokes overlap the line is
    // doubled. The wobble is fixed per orbit, so the chart never moves.
    g.lineCap = 'round'; g.lineJoin = 'round';
    BODY_IDS.forEach((id, n) => {
      const b = BODIES[id];
      if (b.parent) return;
      const r = R(b.orbitRadius);
      const ox = (wob(n, 3) - 0.5) * 2.4, oy = (wob(n, 4) - 0.5) * 2;
      const rad = (a) => 1 + 0.017 * Math.sin(2 * a + n * 1.7) + 0.01 * Math.sin(5 * a + n * 4.1) + 0.005 * Math.sin(11 * a + n);
      const strokes = 3 + (n % 2), turn = wob(n, 5) * Math.PI * 2;
      for (let k = 0; k < strokes; k++) {
        const a0 = turn + (k / strokes) * Math.PI * 2 + (wob(n, 20 + k) - 0.5) * 0.12;
        const a1 = turn + ((k + 1) / strokes) * Math.PI * 2 + (wob(n, 30 + k) - 0.2) * 0.16;      // some overlap, some gap
        const lift = 1 + (wob(n, 40 + k) - 0.5) * 0.012;                                           // each stroke sits a hair in or out
        // Dry brush: the line swells where the hand pressed and thins to nothing where it
        // lifted; here and there the paper's tooth breaks it.
        const alpha = 0.32 + 0.2 * wob(n, 50 + k), heavy = 0.9 + 0.9 * wob(n, 60 + k);
        const steps = Math.max(10, Math.round((a1 - a0) * 16));
        let px = 0, py = 0;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps, a = a0 + (a1 - a0) * u, q = r * rad(a) * lift;
          const x = X(cx + ox + Math.cos(a) * q * 1.55), y = Y(cy + oy + Math.sin(a) * q);
          if (i && wob(n * 7 + k, 90 + i) > 0.1) {
            const press = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7 * (0.75 + 0.5 * wob(n * 3 + k, 130 + (i >> 2)));
            g.strokeStyle = `rgba(90, 80, 72, ${(alpha * (0.55 + 0.45 * press)).toFixed(2)})`; g.lineWidth = (0.35 + heavy * press) * lw;
            g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
          }
          px = x; py = y;
        }
      }
    });
    // The sun: bare paper with a warm halo.
    const hr = V.touch ? 30 * Math.max(0.75, sm) : 30, scx = X(cx), scy = Y(cy);
    const halo = g.createRadialGradient(scx, scy, 2, scx, scy, hr);
    halo.addColorStop(0, 'rgba(244,239,228,1)'); halo.addColorStop(0.35, 'rgba(240,200,120,0.55)'); halo.addColorStop(1, 'rgba(240,200,120,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(scx, scy, hr, 0, Math.PI * 2); g.fill();
    spots = [];
    const names = [];
    for (const id of BODY_IDS) {
      const b = BODIES[id];
      const p = data.positions[id];
      const pp = b.parent ? data.positions[b.parent] : null;
      const base = pp || p;
      const ang = Math.atan2(base.x, base.z);
      const r = R(Math.hypot(base.x, base.z));
      let x = X(cx + Math.sin(ang) * r * 1.55), y = Y(cy - Math.cos(ang) * r);
      // (a moon is drawn off its planet toward where it is: on a touch screen far enough for a finger)
      let mdx = 0, mdy = 0;
      if (pp) {
        const a2 = Math.atan2(p.x - pp.x, p.z - pp.z), off = V.touch ? Math.max(13 * sm, MAP_TOUCH.moon) : 13;
        mdx = Math.sin(a2); mdy = -Math.cos(a2);
        x += mdx * off; y += mdy * off;
      }
      const size = (pp ? 3.2 : 4 + b.radius / 900) * (V.touch ? Math.max(1, sm) : 1);
      // A dab of wash: not round, thin in the middle, the pigment pooled along its edge; then
      // a pen line most of the way round, a little off register.
      const k = BODY_IDS.indexOf(id), tint = TINT[id] || '#bbbbbb';
      const rgb = [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16)).join(', ');
      const wash = g.createRadialGradient(x - size * 0.2, y - size * 0.25, size * 0.1, x, y, size * 1.08);
      wash.addColorStop(0, `rgba(${rgb}, 0.6)`); wash.addColorStop(0.62, `rgba(${rgb}, 0.82)`); wash.addColorStop(0.9, `rgba(${rgb}, 1)`); wash.addColorStop(1, `rgba(${rgb}, 0.9)`);
      g.fillStyle = wash; g.beginPath();
      const N = 9;
      const pt = (i) => { const a = (i / N) * Math.PI * 2, q = size * (1 + 0.2 * (wob(k, 70 + ((i % N) + N) % N) - 0.5)); return [x + Math.cos(a) * q, y + Math.sin(a) * q]; };
      for (let i = 0; i <= N; i++) {
        const p0 = pt(i), p1 = pt(i + 1), mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
        if (!i) g.moveTo(mx, my); else g.quadraticCurveTo(p0[0], p0[1], mx, my);
      }
      g.fill();
      g.strokeStyle = 'rgba(44, 51, 80, 0.5)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x + 0.4, y + 0.3, size * 1.02, size * 0.96, 0.4, 0.5 + wob(k, 80), Math.PI * 1.75 + wob(k, 81)); g.stroke();
      if (id === selected) {
        g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y, size + 6, size + 5, 0.3, 0.2, Math.PI * 2 - 0.15); g.stroke();
      }
      if (id === here) {
        g.strokeStyle = '#b5553c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - size - 9, y + size + 7); g.lineTo(x - size - 3, y + size + 2); g.stroke();
        g.beginPath(); g.moveTo(x - size - 9, y + size + 7); g.lineTo(x - size - 2, y + size + 8); g.stroke();
      }
      if (!V.touch) {
        // A moon's name goes under its dot so it does not sit on its planet's name.
        inkOnCanvas(g, b.name, x, pp ? y + size + 13 : y - size - 7, id === selected ? 10.4 : 9.2, { align: 'center', color: id === selected ? INK : SEPIA, halo: 'rgba(244, 239, 228, 0.7)', seed: 2 });
      } else names.push({ id, name: b.name, x, y, size, moon: !!pp, mdx, mdy, parent: b.parent || null });
      // (spots in the chart's units, as they always were; sx, sy: in css px on the canvas)
      spots.push({ id, x: (x - V.ox) / V.sx, y: (y - V.oy) / V.sy, size, sx: x, sy: y });
    }
    labelSizes = [];
    if (V.touch) placeNames(names, V, sm);
    const t = data.target;
    const said = t ? `${t.name}: ${fmt(t.distance)} away, about ${Math.max(1, Math.round(t.eta))} s by pulse drive`
      : words('click a world, or use the arrow keys, to set a course', sayMode()) || '';
    // (on a touch screen the line and the slip are wrapped to their column)
    const col = V.touch ? Math.max(140, line.clientWidth || 0) : 0;
    ink(line, col ? wrapLettering(said, SIZE.body, col) : said, SIZE.body, V.touch ? { align: 'center' } : {});
    panel.classList.toggle('pc-has-course', !!t);
    if (t) ink(go, col ? wrapLettering('set course for ' + t.name, goSize, Math.max(120, col - 46)) : 'set course for ' + t.name, goSize, V.touch ? { align: 'center' } : {});
  }

  // The names on a touch screen, lettered at MAP_TOUCH.name css px or more: each where it collides
  // with no other name and no dot (above, below, then beside its dot; a moon's on its far side
  // from its planet, its planet's on the other), the chosen world first.
  function placeNames(list, V, sm) {
    const size = Math.max(MAP_TOUCH.name, 9.2 * sm), big = size + 1.2;
    const boxes = list.map((n) => ({ x0: n.x - n.size - 2, x1: n.x + n.size + 2, y0: n.y - n.size - 2, y1: n.y + n.size + 2 }));
    const hit = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const moonOf = {};
    for (const n of list) if (n.moon) moonOf[n.parent] = n;
    const order = list.slice().sort((a, b) => (b.id === selected) - (a.id === selected));
    for (const n of order) {
      const s = n.id === selected ? big : size, m = measureInk(n.name, s), wdt = m.width, asc = s, gap = 5 + n.size;
      // baseline positions to try: (x centre, baseline y)
      const up = [n.x, n.y - gap - 1], down = [n.x, n.y + gap + asc + 1], right = [n.x + gap + wdt / 2 + 2, n.y + asc / 2], left = [n.x - gap - wdt / 2 - 2, n.y + asc / 2];
      const away = n.moon ? (n.mdy > 0.3 ? [down, right, left, up] : n.mdy < -0.3 ? [up, right, left, down] : n.mdx > 0 ? [right, up, down, left] : [left, up, down, right])
        : moonOf[n.id] ? (moonOf[n.id].mdy > 0.3 ? [up, left, right, down] : moonOf[n.id].mdy < -0.3 ? [down, left, right, up] : moonOf[n.id].mdx > 0 ? [left, up, down, right] : [right, up, down, left])
          : [up, down, right, left];
      let at = away[0];
      for (const c of away) {
        const b = { x0: c[0] - wdt / 2 - 2, x1: c[0] + wdt / 2 + 2, y0: c[1] - asc - 2, y1: c[1] + 4 };
        if (b.x0 >= 0 && b.x1 <= V.w && b.y0 >= 0 && b.y1 <= V.h && !hit(b)) { at = c; break; }
      }
      boxes.push({ x0: at[0] - wdt / 2 - 2, x1: at[0] + wdt / 2 + 2, y0: at[1] - asc - 2, y1: at[1] + 4 });
      inkOnCanvas(g, n.name, at[0], at[1], s, { align: 'center', color: n.id === selected ? INK : SEPIA, halo: 'rgba(244, 239, 228, 0.75)', seed: 2 });
      labelSizes.push({ id: n.id, size: s, x: at[0], y: at[1] });
    }
  }

  // A finger's tap on the chart (css px from the canvas' corner): the nearest world within
  // MAP_TOUCH.hit css px of its dot (not the one you are at).
  function touchPick(px, py) {
    let best = null, bd = MAP_TOUCH.hit;
    for (const s of spots) { const d = Math.hypot(s.sx - px, s.sy - py); if (d < bd && s.id !== here) { bd = d; best = s.id; } }
    if (best) pick(best);
  }

  function pick(id) {
    selected = id;
    if (onSelect) onSelect(id);
    if (last) draw({ ...last, target: last.targetOf ? last.targetOf(id) : last.target });
  }

  // A finger: its own pointer event, and no mouse event made up from it (touchstart cancelled).
  canvas.addEventListener('touchstart', (ev) => { if (ev.cancelable) ev.preventDefault(); }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const r = canvas.getBoundingClientRect();
    if (view.touch) touchPick(e.clientX - r.left, e.clientY - r.top);
    else {
      // (a touch on the desktop's chart: the same rule as the mouse, in the chart's units)
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let best = null, bd = 26;
      for (const s of spots) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.id; } }
      if (best && best !== here) pick(best);
    }
    e.stopPropagation();
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let best = null, bd = 26;
    for (const s of spots) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.id; } }
    if (best && best !== here) pick(best);
    e.stopPropagation();
  });

  // A turned phone, a resized window: the open chart is fitted again.
  if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (open && last) { layout(); draw(last); } });

  return {
    get open() { return open; },
    get selected() { return selected; },
    spots: () => spots.map((s) => ({ ...s })),
    // where a world is on the screen (client css px), and the names' sizes (css px) on a touch screen
    spotOnScreen(id) {
      const s = spots.find((q) => q.id === id), r = canvas.getBoundingClientRect();
      if (!s) return null;
      return view.touch ? { x: r.left + s.sx, y: r.top + s.sy } : { x: r.left + (s.x / W) * r.width, y: r.top + (s.y / H) * r.height };
    },
    labelSizes: () => labelSizes.map((l) => ({ ...l })),
    get touchLayout() { return view.touch; },
    canvas,
    // data: { positions: { id: {x,y,z} }, here, target: { name, distance, eta } | null, targetOf(id) }
    show(data) {
      open = true; here = data.here; selected = data.selected || null;
      // (on a touch screen the sheet fills the screen at its own size, theme.css: no scale)
      const touch = touchOn();
      panel.style.setProperty('--pc-fit', touch ? '1' : String(Math.min(1, window.innerWidth / 780, window.innerHeight / 520)));
      goSize = SIZE.prompt;
      panel.classList.add('pc-on');
      layout();
      draw(data);
    },
    hide() { open = false; panel.classList.remove('pc-on'); },
    refresh(data) { if (open) { here = data.here; layout(); draw(data); } },
    get courseSlip() { return go; },
    // Arrow keys step through the worlds in order from the sun.
    step(dir) {
      const ids = BODY_IDS.filter((id) => id !== here);
      const i = ids.indexOf(selected);
      pick(ids[(i + dir + ids.length) % ids.length] || ids[0]);
    },
  };
}

function fmt(m) { return m >= 1000 ? Math.round(m / 1000) + ' km' : Math.round(m) + ' m'; }
