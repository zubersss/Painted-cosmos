// The painted interface (art bible 8: "everything is painted"), all made in code, no assets:
// cold-press paper generated on a canvas, torn edges and rough ink from SVG turbulence
// filters, hand lettering from pen strokes (src/ui/lettering.js), ink rings for the planet
// markers, a brush-tip cursor. Nothing here animates by itself, so nothing can shimmer; the
// only moving part of the theme is the loading dabs, which change twice a second.
import { PAPER, PIGMENTS } from '../data/looks.js';
import { letterPath } from './lettering.js';

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
  // Filters. pc-torn: the ragged edge of a torn sheet (panels). pc-rag: the same, finer, for
  // small slips. pc-rough: the broken edge of ink or a wash on rough paper.
  const holder = doc.createElement('div');
  holder.id = 'pc-defs';
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<svg xmlns="${SVG}" width="0" height="0"><defs>
    <filter id="pc-torn" x="-4%" y="-6%" width="108%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.028 0.034" numOctaves="3" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="pc-rag" x="-6%" y="-20%" width="112%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.06 0.075" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="pc-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter>
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
  el.innerHTML = `<svg class="pc-ink" xmlns="${SVG}" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}" role="img" aria-label="${esc.replace(/"/g, '&quot;')}"><desc>${esc}</desc><path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${p.stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${opts.rough ? ' filter="url(#pc-rough)"' : ''}/></svg>`;
  return el;
}

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
  // the sketchbook
  book: ['M4.4 5.4H19L19.6 19.4H5Z', 'M4.6 5.6H18.8L19.4 19.2H5.2ZM8 5.6L8.5 19.2M11 9.4H16.4M11 12.4H15.4'],
};
export function iconSvg(name, size = 18, wash = INK.accent) {
  const i = ICONS[name];
  if (!i) return '';
  return `<svg class="pc-icon" xmlns="${SVG}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${i[0]}" fill="${wash}" opacity="0.42" filter="url(#pc-rough)"/><path d="${i[1]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
