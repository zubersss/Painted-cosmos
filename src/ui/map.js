// The planet map: a small ink-and-wash chart of the system on a paper panel. Click a world (or
// use the arrow keys) to choose where the pulse drive should take you; M or Enter closes it.
// Drawn in code on a 2D canvas; names and the line under the chart are lettered by hand.
import { BODIES, BODY_IDS } from '../data/bodies.js';
import { ink, inkOnCanvas, SIZE } from './paint.js';

const INK = '#232a45', SEPIA = '#584435';
// Mock pigments per body (the painted palettes are Painter's; these only tell the dots apart).
const TINT = {
  mercury: '#b9a58a', venus: '#d9b860', earth: '#7fa98c', moon: '#b8b8b4', mars: '#c5805c',
  jupiter: '#d9b98c', saturn: '#dcc88e', uranus: '#9fd0c6', neptune: '#7f97cf', pluto: '#c9bfc9',
};
const W = 680, H = 400;

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createMap(root, { onSelect } = {}) {
  const panel = el('div', 'pc-panel pc-map', root);
  ink(el('div', 'pc-title', panel), 'the system', SIZE.head + 3, { rough: true, tracking: 1.1 });
  const canvas = el('canvas', '', panel);
  canvas.width = W * 2; canvas.height = H * 2;
  const line = el('div', 'pc-label pc-map-line', panel);
  const g = canvas.getContext('2d');
  let open = false, spots = [], selected = null, here = null, last = null;

  // Orbit radius on the chart: compressed so Mercury and Pluto both fit.
  const R = (m) => 26 + 150 * Math.log(1 + m / 60e3) / Math.log(1 + 1180e3 / 60e3) * 1.15;
  const wob = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5 + 0.5;

  function draw(data) {
    last = data;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, W, H);                         // the chart is drawn straight on the panel's paper
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
      const rad = (a) => 1 + 0.011 * Math.sin(2 * a + n * 1.7) + 0.007 * Math.sin(5 * a + n * 4.1) + 0.004 * Math.sin(11 * a + n);
      const strokes = 3 + (n % 2), turn = wob(n, 5) * Math.PI * 2;
      for (let k = 0; k < strokes; k++) {
        const a0 = turn + (k / strokes) * Math.PI * 2 + (wob(n, 20 + k) - 0.5) * 0.12;
        const a1 = turn + ((k + 1) / strokes) * Math.PI * 2 + (wob(n, 30 + k) - 0.2) * 0.16;      // some overlap, some gap
        const lift = 1 + (wob(n, 40 + k) - 0.5) * 0.012;                                           // each stroke sits a hair in or out
        g.strokeStyle = `rgba(90, 80, 72, ${(0.3 + 0.16 * wob(n, 50 + k)).toFixed(2)})`; g.lineWidth = 0.75 + 0.35 * wob(n, 60 + k);
        g.beginPath();
        const steps = Math.max(8, Math.round((a1 - a0) * 14));
        for (let i = 0; i <= steps; i++) {
          const a = a0 + ((a1 - a0) * i) / steps, q = r * rad(a) * lift;
          const x = cx + ox + Math.cos(a) * q * 1.55, y = cy + oy + Math.sin(a) * q;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
    });
    // The sun: bare paper with a warm halo.
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, 30);
    halo.addColorStop(0, 'rgba(244,239,228,1)'); halo.addColorStop(0.35, 'rgba(240,200,120,0.55)'); halo.addColorStop(1, 'rgba(240,200,120,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
    spots = [];
    for (const id of BODY_IDS) {
      const b = BODIES[id];
      const p = data.positions[id];
      const pp = b.parent ? data.positions[b.parent] : null;
      const base = pp || p;
      const ang = Math.atan2(base.x, base.z);
      const r = R(Math.hypot(base.x, base.z));
      let x = cx + Math.sin(ang) * r * 1.55, y = cy - Math.cos(ang) * r;
      if (pp) { const a2 = Math.atan2(p.x - pp.x, p.z - pp.z); x += Math.sin(a2) * 13; y -= Math.cos(a2) * 13; }
      const size = pp ? 3.2 : 4 + b.radius / 900;
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
      // A moon's name goes under its dot so it does not sit on its planet's name.
      inkOnCanvas(g, b.name, x, pp ? y + size + 13 : y - size - 7, id === selected ? 10.4 : 9.2, { align: 'center', color: id === selected ? INK : SEPIA, halo: 'rgba(244, 239, 228, 0.7)', seed: 2 });
      spots.push({ id, x, y, size });
    }
    const t = data.target;
    ink(line, t ? `${t.name}: ${fmt(t.distance)} away, about ${Math.max(1, Math.round(t.eta))} s by pulse drive`
      : 'click a world, or use the arrow keys, to set a course', SIZE.body);
  }

  function pick(id) {
    selected = id;
    if (onSelect) onSelect(id);
    if (last) draw({ ...last, target: last.targetOf ? last.targetOf(id) : last.target });
  }

  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let best = null, bd = 26;
    for (const s of spots) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.id; } }
    if (best && best !== here) pick(best);
    e.stopPropagation();
  });

  return {
    get open() { return open; },
    get selected() { return selected; },
    spots: () => spots.map((s) => ({ ...s })),
    canvas,
    // data: { positions: { id: {x,y,z} }, here, target: { name, distance, eta } | null, targetOf(id) }
    show(data) {
      open = true; here = data.here; selected = data.selected || null;
      panel.style.setProperty('--pc-fit', String(Math.min(1, window.innerWidth / 780, window.innerHeight / 520)));
      panel.classList.add('pc-on');
      draw(data);
    },
    hide() { open = false; panel.classList.remove('pc-on'); },
    refresh(data) { if (open) { here = data.here; draw(data); } },
    // Arrow keys step through the worlds in order from the sun.
    step(dir) {
      const ids = BODY_IDS.filter((id) => id !== here);
      const i = ids.indexOf(selected);
      pick(ids[(i + dir + ids.length) % ids.length] || ids[0]);
    },
  };
}

function fmt(m) { return m >= 1000 ? Math.round(m / 1000) + ' km' : Math.round(m) + ' m'; }
