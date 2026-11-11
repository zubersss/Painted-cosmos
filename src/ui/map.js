// The planet map: a small ink-and-wash chart of the system on a paper panel. Click a world (or
// use the arrow keys) to choose where the pulse drive should take you; M or Enter closes it.
// Drawn in code on a 2D canvas with the fallback palette until Painter's theme supplies its own.
import { BODIES, BODY_IDS } from '../data/bodies.js';

const INK = '#2c3350', SEPIA = '#6b5a48', PAPER = '#f4efe4';
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
  el('div', 'pc-title', panel, 'the system');
  const canvas = el('canvas', '', panel);
  canvas.width = W * 2; canvas.height = H * 2;
  const line = el('div', 'pc-label', panel, '');
  const g = canvas.getContext('2d');
  let open = false, spots = [], selected = null, here = null, last = null;

  // Orbit radius on the chart: compressed so Mercury and Pluto both fit.
  const R = (m) => 26 + 150 * Math.log(1 + m / 60e3) / Math.log(1 + 1180e3 / 60e3) * 1.15;
  const wob = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5 + 0.5;

  function draw(data) {
    last = data;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 4;
    // Orbits: broken, slightly uneven ink lines.
    g.lineCap = 'round';
    BODY_IDS.forEach((id, n) => {
      const b = BODIES[id];
      if (b.parent) return;
      const r = R(b.orbitRadius);
      g.strokeStyle = 'rgba(107, 90, 72, 0.33)'; g.lineWidth = 0.9;
      const segs = 40;
      for (let i = 0; i < segs; i++) {
        if (wob(i, n) < 0.16) continue;                               // the brush skips
        const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 0.92) / segs) * Math.PI * 2;
        g.beginPath(); g.ellipse(cx, cy, r * 1.55, r * (0.98 + 0.03 * wob(i, n + 9)), 0, a0, a1); g.stroke();
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
      // A wash dot with a darker pooled edge.
      g.fillStyle = TINT[id] || '#bbb'; g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(44, 51, 80, 0.45)'; g.lineWidth = 0.8; g.beginPath(); g.arc(x + 0.3, y + 0.3, size, 0.3, Math.PI * 1.7); g.stroke();
      if (id === selected) {
        g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y, size + 6, size + 5, 0.3, 0.2, Math.PI * 2 - 0.15); g.stroke();
      }
      if (id === here) {
        g.strokeStyle = '#b5553c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - size - 9, y + size + 7); g.lineTo(x - size - 3, y + size + 2); g.stroke();
        g.beginPath(); g.moveTo(x - size - 9, y + size + 7); g.lineTo(x - size - 2, y + size + 8); g.stroke();
      }
      g.fillStyle = id === selected ? INK : SEPIA;
      g.font = (id === selected ? 'italic 600 13px' : 'italic 12px') + ' Georgia, serif';
      g.textAlign = 'center';
      g.fillText(b.name, x, y - size - 7);
      spots.push({ id, x, y, size });
    }
    const t = data.target;
    line.textContent = t ? `${t.name}: ${fmt(t.distance)} away, about ${Math.max(1, Math.round(t.eta))} s by pulse drive`
      : 'click a world to set a course';
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
