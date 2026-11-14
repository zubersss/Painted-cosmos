// The painted interface (art bible 8: "everything is painted"), all made in code, no assets:
// cold-press paper generated on a canvas, torn edges and rough ink from SVG turbulence
// filters, hand lettering from pen strokes (src/ui/lettering.js), ink rings for the planet
// markers, a brush-tip cursor. Nothing here animates by itself, so nothing can shimmer; the
// only moving part of the theme is the loading dabs, which change twice a second.
import { PAPER, PIGMENTS } from '../data/looks.js';
import { letterPath, measureLettering } from './lettering.js';

const SVG = 'http://www.w3.org/2000/svg';
export const INK = Object.freeze({
  paper: PAPER,
  ink: PIGMENTS.indigo || '#2f3a5d',
  dark: '#232a45',                       // indigo with a touch of sepia: the densest ink
  sepia: PIGMENTS.sepia || '#584435',
  grey: PIGMENTS.paynesGrey || '#4b5669',
  accent: PIGMENTS.burntSienna || '#b5553c',
});

// Lettering sizes (cap height in CSS pixels) by role.
export const SIZE = Object.freeze({ title: 30, head: 17, prompt: 13.5, body: 11.5, small: 10.2, tiny: 9.2, key: 9.6 });

function hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A tile of cold-press paper: warm off-white with a soft mottling, a tooth of fine grain and
// a few fibres. Tileable (the lattice wraps). Returns a data URL, or null without a canvas.
export function paperTile(size = 192, seed = 5) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
    const base = [parseInt(PAPER.slice(1, 3), 16), parseInt(PAPER.slice(3, 5), 16), parseInt(PAPER.slice(5, 7), 16)];
    const lat = (x, y, n, s) => hash(((x % n) + n) % n + s * 57, ((y % n) + n) % n + s * 131);
    const noise = (x, y, cells, s) => {                      // smooth value noise that wraps
      const fx = (x / size) * cells, fy = (y / size) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = lat(ix, iy, cells, s), b = lat(ix + 1, iy, cells, s), cc = lat(ix, iy + 1, cells, s), dd = lat(ix + 1, iy + 1, cells, s);
      return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + dd) * sx * sy;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const mottle = noise(x, y, 4, seed) - 0.5, tooth = noise(x, y, 48, seed + 1) - 0.5, grain = hash(x + seed * 977, y) - 0.5;
        const v = mottle * 7 + tooth * 9 + grain * 5;
        const i = (y * size + x) * 4;
        d[i] = base[0] + v; d[i + 1] = base[1] + v * 0.98; d[i + 2] = base[2] + v * 0.9 - mottle * 3; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  } catch { return null; }
}

// The brush-tip cursor: a small ink cross with an open centre, pale-edged so it shows on indigo.
export function cursorUrl() {
  const p = 'M12 3.4V8.6M12 15.3V20.7M3.3 12.1H8.7M15.4 11.9H20.6';
  const svg = `<svg xmlns="${SVG}" width="24" height="24"><path d="${p}" stroke="${INK.paper}" stroke-width="4.2" stroke-linecap="round" fill="none" opacity="0.9"/><path d="${p}" stroke="${INK.dark}" stroke-width="1.9" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="1.3" fill="${INK.dark}" stroke="${INK.paper}" stroke-width="0.8"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12`;
}

// Put the theme on the page: colours, the paper tile, the filters, the cursor. Safe to call
// once; returns false where there is no document (tests in Node).
export function installTheme(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || doc.getElementById('pc-defs')) return !!doc;
  const st = doc.documentElement.style;
  st.setProperty('--pc-paper', INK.paper); st.setProperty('--pc-ink', INK.ink); st.setProperty('--pc-dark', INK.dark);
  st.setProperty('--pc-sepia', INK.sepia); st.setProperty('--pc-accent', INK.accent);
  const tile = paperTile();
  if (tile) st.setProperty('--pc-paper-img', `url(${tile})`);
  st.setProperty('--pc-cursor', cursorUrl());
  // Four pencil rings for the keys: none quite alike, none quite closed.
  for (let i = 0; i < 4; i++) st.setProperty('--pc-key-' + 'abcd'[i], pencilRing(i + 1));
  // Pencil: three loose frames for the sketches not yet made, and a rule drawn along a page.
  st.setProperty('--pc-frame-a', pencilFrame(130, 73, 1)); st.setProperty('--pc-frame-b', pencilFrame(130, 73, 2));
  st.setProperty('--pc-frame-c', pencilFrame(130, 73, 3)); st.setProperty('--pc-rule', pencilRule(1)); st.setProperty('--pc-rule-b', pencilRule(2));
  // Filters. pc-torn (-b, -c): the ragged edge of a torn sheet, a different tear for each
  // panel. pc-rag (-b, -c): the same, finer, for small slips (-c for the long thin ones). pc-rough: the broken edge of ink or a wash on rough paper. pc-wash: a small
  // wash (a key, a tab): an uneven edge, and pigment settled into the grain so that the paper
  // shows through in specks. pc-stroke: the body of one broad stroke of a loaded brush (a
  // wandering edge, dense pigment). pc-brush: where that stroke runs dry: long streaks along
  // it where the hairs ran out of paint.
  const holder = doc.createElement('div');
  holder.id = 'pc-defs';
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<svg xmlns="${SVG}" width="0" height="0"><defs>
    <filter id="pc-torn" x="-4%" y="-6%" width="108%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.028 0.034" numOctaves="3" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="pc-rag" x="-6%" y="-20%" width="112%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.06 0.075" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="pc-torn-b" x="-4%" y="-6%" width="108%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.022 0.04" numOctaves="3" seed="37" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="G" yChannelSelector="R"/></filter>
    <filter id="pc-torn-c" x="-4%" y="-6%" width="108%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.034 0.026" numOctaves="3" seed="73" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="B"/></filter>
    <filter id="pc-rag-b" x="-6%" y="-24%" width="112%" height="148%"><feTurbulence type="fractalNoise" baseFrequency="0.045 0.09" numOctaves="2" seed="19" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="G" yChannelSelector="R"/></filter>
    <filter id="pc-rag-c" x="-4%" y="-34%" width="108%" height="168%"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.11" numOctaves="2" seed="52" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8.5" xChannelSelector="R" yChannelSelector="B"/></filter>
    <filter id="pc-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="pc-wash" x="-18%" y="-30%" width="136%" height="160%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.1 0.13" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4.2" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 0 0 0 1.6" result="ga"/><feComposite in="d" in2="ga" operator="in"/></filter>
    <filter id="pc-stroke" x="-7%" y="-34%" width="114%" height="168%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.075" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.7 0 0 0 1.32" result="ga"/><feComposite in="d" in2="ga" operator="in"/></filter>
    <filter id="pc-brush" x="-7%" y="-34%" width="114%" height="168%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.075" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.007 0.25" numOctaves="2" seed="5" result="s"/><feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.25" result="sa"/><feComposite in="d" in2="sa" operator="in"/></filter>
  </defs></svg>`;
  (doc.body || doc.documentElement).appendChild(holder);
  return true;
}

// Letter `text` into `el` by hand. The words stay in the DOM (a <desc>, so textContent and
// screen readers still have them). Cheap to call every frame: nothing happens unless the
// text, the size or the options changed.
// opts: { seed, tracking, align, rough (ink edge on large lettering), wobble }
export function ink(el, text, size = SIZE.body, opts = {}) {
  const t = text == null ? '' : String(text);
  const key = t + '|' + size + '|' + (opts.align || '') + '|' + (opts.seed || 0) + '|' + (opts.rough ? 1 : 0);
  if (el._inkKey === key) return el;
  el._inkKey = key;
  if (!t) { el.textContent = ''; return el; }
  const p = letterPath(t, size, opts);
  const esc = t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  // (data-size: the cap height it was lettered at, so a test can tell its size on the screen)
  el.innerHTML = `<svg class="pc-ink" xmlns="${SVG}" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}" data-size="${size}" role="img" aria-label="${esc.replace(/"/g, '&quot;')}"><desc>${esc}</desc><path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${p.stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${opts.rough ? ' filter="url(#pc-rough)"' : ''}/></svg>`;
  return el;
}

// How wide `text` is lettered at `size` (css px, as ink() and inkOnCanvas() draw it).
export const measureInk = (text, size = SIZE.body, tracking = 1) => ({ width: measureLettering(text, size, tracking) + 2 });

// The same hand on a 2D canvas (the map). (x, y) is the left end (or the centre) of the baseline.
export function inkOnCanvas(g, text, x, y, size = SIZE.small, opts = {}) {
  const p = letterPath(text, size, opts);
  g.save();
  g.translate(Math.round(x - (opts.align === 'center' ? p.width / 2 : 0)), Math.round(y - p.baseline));
  g.lineWidth = p.stroke; g.lineCap = 'round'; g.lineJoin = 'round';
  if (opts.halo) { g.strokeStyle = opts.halo; g.lineWidth = p.stroke + 3; g.stroke(new Path2D(p.d)); g.lineWidth = p.stroke; }
  g.strokeStyle = opts.color || INK.dark;
  g.stroke(new Path2D(p.d));
  g.restore();
  return p.width;
}

// Graphite, as a CSS image. A loose frame: each side drawn twice with a soft pencil, bowed a
// little, running past the corners; a few hatching strokes in one corner where the drawing
// will start. The wobble is fixed by `seed`, so three seeds give three different frames.
const GRAPHITE = '#5a5048';
function svgUrl(svg) { return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`; }
export function pencilFrame(w = 130, h = 73, seed = 1) {
  const r = (i) => hash(seed * 31 + i, 7 + seed) - 0.5;
  const m = 5, x0 = m, y0 = m, x1 = w - m, y1 = h - m;
  let d1 = '', d2 = '', n = 0;
  const side = (ax, ay, bx, by, pass) => {
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
    const o0 = 1.5 + 4.5 * (r(n++) + 0.5), o1 = 1.5 + 4.5 * (r(n++) + 0.5);      // how far past each corner
    const j = () => r(n++) * (pass ? 3.2 : 2.2);
    const sx = ax - ux * o0 + j(), sy = ay - uy * o0 + j(), ex = bx + ux * o1 + j(), ey = by + uy * o1 + j();
    const bow = r(n++) * 3.4;
    const cx = (sx + ex) / 2 - uy * bow, cy = (sy + ey) / 2 + ux * bow;
    return `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  };
  for (const pass of [0, 1]) {
    const d = side(x0, y0, x1, y0, pass) + side(x1, y0, x1, y1, pass) + side(x1, y1, x0, y1, pass) + side(x0, y1, x0, y0, pass);
    if (pass) d2 = d; else d1 = d;
  }
  // hatching: five quick strokes in a corner (which corner depends on the seed)
  let hatch = '';
  const left = seed % 2 === 0, hx = left ? x0 + 6 : x1 - 30, hy = y1 - 6;
  for (let i = 0; i < 5; i++) {
    const a = hx + i * 5 + r(n++) * 2, b = hy + r(n++) * 2, l = 9 + i * 2.2 + r(n++) * 3;
    hatch += `M${a.toFixed(1)} ${b.toFixed(1)}l${(l * 0.62).toFixed(1)} ${(-l * 0.78).toFixed(1)}`;
  }
  return svgUrl(`<svg xmlns="${SVG}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><filter id="g" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G"/></filter><g fill="none" stroke="${GRAPHITE}" stroke-linecap="round" filter="url(#g)"><path d="${d1}" stroke-width="1.15" opacity="0.62"/><path d="${d2}" stroke-width="0.8" opacity="0.36"/><path d="${hatch}" stroke-width="0.8" opacity="0.3"/></g></svg>`);
}

// A key's outline: a soft pencil pulled once round a rounded box, not quite closed, the end
// running past the start; stretched to the key by the browser (the line keeps its weight).
export function pencilRing(seed = 1) {
  const r = (i) => hash(seed * 53 + i, 11) - 0.5;
  const W = 40, H = 24, m = 2.2, n = 22, start = hash(seed, 5) * Math.PI * 2, sweep = Math.PI * 2 * (0.9 + 0.13 * hash(seed, 6));
  const pt = (k) => {
    const a = start + (sweep * k) / n, c = Math.cos(a), sn = Math.sin(a);
    // a superellipse: a box with soft corners
    const q = 3.4, x = Math.sign(c) * Math.pow(Math.abs(c), 2 / q), y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / q);
    const grow = 1 + 0.05 * (k / n - 0.5);                      // the hand drifts outward as it goes round
    return [W / 2 + x * (W / 2 - m) * grow + r(20 + k) * 1.3, H / 2 + y * (H / 2 - m) * grow + r(60 + k) * 1.3];
  };
  let d = '';
  for (let k = 0; k <= n; k++) { const p0 = pt(k); d += (k ? 'L' : 'M') + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1); }
  // a second, lighter touch over a third of the way where the pencil went back
  const k0 = Math.floor(hash(seed, 9) * n * 0.6); let d2 = '';
  for (let k = k0; k <= k0 + n / 3; k++) { const p0 = pt(k); d2 += (k > k0 ? 'L' : 'M') + (p0[0] + 0.8).toFixed(1) + ' ' + (p0[1] - 0.7).toFixed(1); }
  return svgUrl(`<svg xmlns="${SVG}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g fill="none" stroke="${GRAPHITE}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke-width="1.15" opacity="0.72" vector-effect="non-scaling-stroke"/><path d="${d2}" stroke-width="0.8" opacity="0.4" vector-effect="non-scaling-stroke"/></g></svg>`);
}

// A rule drawn freehand along the page: it wanders a pixel, and the pencil was lifted once.
export function pencilRule(seed = 1) {
  const r = (i) => hash(seed * 17 + i, 3) - 0.5;
  const y = (i) => (3 + r(i) * 1.7).toFixed(2), lift = 230 + r(9) * 120;
  const a = `M2 ${y(1)}C${(lift * 0.3).toFixed(0)} ${y(2)} ${(lift * 0.7).toFixed(0)} ${y(3)} ${lift.toFixed(0)} ${y(4)}`;
  const b = `M${(lift - 9).toFixed(0)} ${y(5)}C${(lift + 60).toFixed(0)} ${y(6)} ${(lift + 140).toFixed(0)} ${y(7)} 398 ${y(8)}`;
  return svgUrl(`<svg xmlns="${SVG}" width="400" height="6" viewBox="0 0 400 6" preserveAspectRatio="none"><g fill="none" stroke="${GRAPHITE}" stroke-linecap="round"><path d="${a}" stroke-width="1.2" opacity="0.6" vector-effect="non-scaling-stroke"/><path d="${b}" stroke-width="1.05" opacity="0.5" vector-effect="non-scaling-stroke"/></g></svg>`);
}

// A ring pulled once round with a loaded brush: not quite closed, not quite round. Path data
// for a circle of radius r centred on (0, 0); the wobble is fixed by `seed`.
export function ringPath(r, seed = 1) {
  const n = 14, start = -2.2 + hash(seed, 3) * 0.6, sweep = Math.PI * 2 - 0.34;
  const P = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (sweep * i) / n, rr = r * (1 + 0.045 * (hash(seed, 10 + i) - 0.5) + 0.03 * (i / n - 0.5));
    P.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  let d = `M${P[0].toFixed(1)} ${P[1].toFixed(1)}`;
  const at = (i) => { const k = Math.max(0, Math.min(n, i)); return [P[2 * k], P[2 * k + 1]]; };
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// Ink-and-wash icons: a wash laid first, ink lines over it. 24 x 24, currentColor ink.
const ICONS = {
  // the jetpack's flame
  jet: ['M12 3.5C8.6 8 7.4 11.6 8.2 15.4C8.9 18.6 10.4 20.4 12 20.6C13.7 20.4 15.2 18.6 15.8 15.4C16.6 11.6 15.4 8 12 3.5Z', 'M12 4C9.2 8.2 8 11.6 8.6 15.2C9.2 18.2 10.5 20 12 20.2C13.5 20 14.9 18.2 15.4 15.2C16 11.6 14.8 8.2 12 4M12 11.4C10.9 13.4 10.6 15.2 11 16.8'],
  // the ship's throttle: an arrowhead of thrust
  thrust: ['M4.6 18.6L12 4.6L19.4 18.6L12 15.2Z', 'M4.8 18.4L12 5L19.2 18.4M7.4 17.4L12 15.4L16.6 17.4'],
  // a view found: an eye of the horizon with the sun in it
  view: ['M2.6 12.6C6 7.8 9 6.2 12 6.2C15 6.2 18 7.8 21.4 12.6C18 16.8 15 18.2 12 18.2C9 18.2 6 16.8 2.6 12.6Z', 'M2.8 12.4C6 8 9 6.6 12 6.6C15 6.6 18 8 21.2 12.4C18 16.4 15 17.8 12 17.8C9 17.8 6 16.4 2.8 12.4M12 9.4A2.9 2.9 0 1 0 12.1 9.4'],
  // the map: a chart folded in three, an orbit pencilled across it, a world on it
  map: ['M3 6.2L9 4.2L15 6.2L21 4.2V17.8L15 19.8L9 17.8L3 19.8Z', 'M3.2 6.4L9 4.4L15 6.4L20.8 4.4V17.6L15 19.6L9 17.6L3.2 19.6ZM9 4.6V17.4M15 6.6V19.4M4.6 15.4C7.6 10.6 12.4 8.6 18.6 9.4M17.2 7.9A1.5 1.5 0 1 0 17.3 7.9'],
  // the sketchbook
  book: ['M4.4 5.4H19L19.6 19.4H5Z', 'M4.6 5.6H18.8L19.4 19.2H5.2ZM8 5.6L8.5 19.2M11 9.4H16.4M11 12.4H15.4'],
};
// A pencilled cross: the corner that closes a sheet on a touch screen (fills its box).
export const CLOSE_SVG = `<svg class="pc-ink" xmlns="${SVG}" viewBox="0 0 20 20" width="100%" height="100%" aria-hidden="true"><path d="M5.2 4.6C8.4 8 11.6 11.6 15 15.6M14.6 4.8C11.4 8.2 8.4 11.8 5 15.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" filter="url(#pc-rough)"/></svg>`;
// The touch controls drawn small, for the help card on a touch screen (W3.3): the stick's ring
// with a thumb on it, a finger dragging, two fingers pinching, the round paper buttons, a prompt's
// slip, the tabs. 44 x 34, pencil and wash, currentColor ink.
const TOUCH_ICONS = {
  stick: '<circle cx="20" cy="17" r="13.5" fill="rgba(77,96,178,0.08)" stroke="currentColor" stroke-width="1.3" filter="url(#pc-rough)"/>'
    + '<circle cx="25" cy="13" r="6.2" fill="rgba(77,96,178,0.45)" filter="url(#pc-wash)"/><path d="M20 17L25 13" stroke="currentColor" stroke-width="0.9" opacity="0.5"/>',
  drag: '<circle cx="12" cy="22" r="5.4" fill="rgba(77,96,178,0.4)" filter="url(#pc-wash)"/>'
    + '<path d="M14 18C19 10 27 8 36 10M31.5 6.4L36.4 10.2L31.4 13.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  pinch: '<circle cx="16" cy="19" r="4.6" fill="rgba(77,96,178,0.4)" filter="url(#pc-wash)"/><circle cx="28" cy="15" r="4.6" fill="rgba(77,96,178,0.4)" filter="url(#pc-wash)"/>'
    + '<path d="M11 22L5 25M8.4 21.4L5 25L9.4 26.6M33 12L39 9M35.4 7.6L39 9L37.8 12.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  jump: '<circle cx="22" cy="17" r="14.5" fill="#fbf8f1" stroke="rgba(88,68,53,0.55)" stroke-width="1.1" filter="url(#pc-rough)"/><circle cx="22" cy="17" r="11" fill="none" stroke="rgba(77,96,178,0.25)" stroke-width="3"/>',
  buttons: '<circle cx="13" cy="20" r="10" fill="#fbf8f1" stroke="rgba(88,68,53,0.55)" stroke-width="1.1" filter="url(#pc-rough)"/>'
    + '<circle cx="32" cy="12" r="9" fill="#fbf8f1" stroke="rgba(88,68,53,0.55)" stroke-width="1.1" filter="url(#pc-rough)"/>',
  slip: '<path d="M3 9.5L41 8.4L41.6 25.6L3.4 26.4Z" fill="#fbf8f1" stroke="rgba(88,68,53,0.55)" stroke-width="1.1" filter="url(#pc-rag)"/><path d="M10 17.6H34" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>',
  tabs: [0, 1, 2, 3].map((i) => `<rect x="${1.5 + i * 10.6}" y="11" width="8.6" height="8.6" rx="1.6" fill="#fbf8f1" stroke="rgba(88,68,53,0.6)" stroke-width="1"/>`).join(''),
};
export function touchIconSvg(name) {
  const i = TOUCH_ICONS[name];
  return i ? `<svg class="pc-icon" xmlns="${SVG}" width="44" height="34" viewBox="0 0 44 34" aria-hidden="true">${i}</svg>` : '';
}
export function iconSvg(name, size = 18, wash = INK.accent) {
  const i = ICONS[name];
  if (!i) return '';
  return `<svg class="pc-icon" xmlns="${SVG}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${i[0]}" fill="${wash}" opacity="0.42" filter="url(#pc-rough)"/><path d="${i[1]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
