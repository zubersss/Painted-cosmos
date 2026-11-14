// Hand lettering, drawn in code: a single-stroke hand (the kind a painter pencils under a
// sketch), built from pen strokes, never from a font file. Pure geometry here (no DOM): text
// in, SVG path data out. src/ui/paint.js puts it on the page.
//
// Every glyph is a few strokes on a grid: baseline y = 0, x-height 6, capitals and ascenders
// 10, descenders -3. A stroke of three or more points is drawn as one flowing curve through
// them; a stroke of two is a straight pull of the pen. The hand's wobble (a little lean, a
// baseline that wanders, points a hair off) is a fixed function of the letter and its place
// in the line: it never changes between frames, so nothing shimmers.
const G = {
  A: [8, '0,0 4,10', '4,10 8,0', '1.5,3.6 6.5,3.6'],
  B: [6.8, '0,0 0,10', '0,10 3.4,10 5.4,8.9 5.4,6.6 3.6,5.4 0,5.2', '3.6,5.4 5.9,4.3 6.2,2.2 4.4,0.3 0,0'],
  C: [7.4, '7,8 5.5,9.7 3.4,10 1.2,8.6 0.3,5.5 0.9,2.2 3,0.2 5.3,0.2 7,2'],
  D: [7.6, '0,0 0,10', '0,10 3,10 5.8,8.4 6.8,5 5.8,1.6 3,0 0,0'],
  E: [6.4, '0,0 0,10', '0,10 6,10', '0,5.2 4.6,5.2', '0,0 6,0'],
  F: [6, '0,0 0,10', '0,10 6,10', '0,5.2 4.4,5.2'],
  G: [8, '7,8 5.5,9.7 3.4,10 1.2,8.6 0.3,5.5 0.9,2.2 3,0.2 5.4,0.2 7.1,1.8 7.2,4.6', '4.4,4.6 7.5,4.6'],
  H: [7.4, '0,0 0,10', '7,0 7,10', '0,5.2 7,5.2'],
  I: [2, '1,0 1,10'],
  J: [5.4, '4.8,10 4.8,2.6 3.9,0.7 2.3,0 0.7,0.8 0,2.4'],
  K: [7, '0,0 0,10', '6.4,10 0,4.4', '2.2,6.2 6.8,0'],
  L: [6, '0,10 0,0', '0,0 5.6,0'],
  M: [9.6, '0,0 0.6,10', '0.6,10 4.6,2', '4.6,2 8.6,10', '8.6,10 9.2,0'],
  N: [7.8, '0,0 0,10', '0,10 7.2,0', '7.2,0 7.2,10'],
  O: [8.4, '4,10 1.6,8.8 0.3,5.2 1.4,1.4 4,0 6.6,1.2 7.8,5 6.6,8.8 4,10'],
  P: [6.4, '0,0 0,10', '0,10 3.6,10 5.8,8.6 5.8,6.2 3.6,4.8 0,4.8'],
  Q: [8.4, '4,10 1.6,8.8 0.3,5.2 1.4,1.4 4,0 6.6,1.2 7.8,5 6.6,8.8 4,10', '5,2.6 8.2,-0.9'],
  R: [7, '0,0 0,10', '0,10 3.6,10 5.8,8.6 5.8,6.2 3.6,4.8 0,4.8', '3,4.8 6.6,0'],
  S: [6.4, '6,8.4 4.6,9.8 2.6,10 0.8,8.8 0.6,7 2,5.6 4.4,4.6 5.8,3.2 5.6,1.4 4,0.2 2,0 0.2,1.4'],
  T: [7, '0,10 7,10', '3.5,10 3.5,0'],
  U: [7.4, '0,10 0,3.4 0.9,1.2 3.4,0 5.9,1.2 6.8,3.4 6.8,10'],
  V: [7.4, '0,10 3.6,0', '3.6,0 7.2,10'],
  W: [10.6, '0,10 2.6,0', '2.6,0 5.1,7.4', '5.1,7.4 7.6,0', '7.6,0 10.2,10'],
  X: [7, '0,10 6.8,0', '6.8,10 0,0'],
  Y: [7, '0,10 3.4,5', '6.8,10 3.4,5', '3.4,5 3.4,0'],
  Z: [7, '0.2,10 6.6,10', '6.6,10 0,0', '0,0 6.8,0'],
  a: [6, '5,3 4.2,5.2 2.6,6 1,5 0.3,3 1,0.9 2.6,0 4.2,0.9 5,3', '5,6 5,0'],
  b: [6, '0,10 0,0', '0,3 0.8,5.1 2.4,6 4.2,5.1 5,3 4.2,0.9 2.4,0 0.8,0.9 0,3'],
  c: [5.4, '4.8,4.6 3.8,5.8 2.4,6 1,5 0.3,3 1,1 2.4,0 3.8,0.3 4.9,1.5'],
  d: [6, '5,3 4.2,5.2 2.6,6 1,5 0.3,3 1,0.9 2.6,0 4.2,0.9 5,3', '5,10 5,0'],
  e: [5.8, '0.4,3.1 5,3.1 4.6,4.9 3.2,6 1.6,5.6 0.4,3.6 0.6,1.6 2,0.2 3.6,0.1 5,1.3'],
  f: [4, '4,9.4 3,10 1.9,9.4 1.5,8 1.5,0', '0,6 3.6,6'],
  g: [6, '5,3 4.2,5.2 2.6,6 1,5 0.3,3 1,0.9 2.6,0 4.2,0.9 5,3', '5,6 5,-1 4.2,-2.6 2.6,-3 0.8,-2.2'],
  h: [5.8, '0,10 0,0', '0,3.6 1,5.2 2.6,6 4.2,5.4 4.8,3.8 4.8,0'],
  i: [2, '1,6 1,0', '0.95,8.4 1.05,8.9'],
  j: [3, '2,6 2,-1.2 1.4,-2.6 0,-3', '1.95,8.4 2.05,8.9'],
  k: [5.4, '0,10 0,0', '4.8,6 0,2.6', '1.8,3.9 5.2,0'],
  l: [2, '1,10 1,0'],
  m: [9.2, '0,6 0,0', '0,3.8 0.8,5.3 2.2,6 3.6,5.3 4.1,3.8 4.1,0', '4.1,3.8 4.9,5.3 6.3,6 7.7,5.3 8.2,3.8 8.2,0'],
  n: [5.8, '0,6 0,0', '0,3.6 1,5.2 2.6,6 4.2,5.4 4.8,3.8 4.8,0'],
  o: [6, '2.7,6 1,5 0.3,3 1,0.9 2.7,0 4.4,0.9 5.1,3 4.4,5 2.7,6'],
  p: [6, '0,6 0,-3', '0,3 0.8,5.1 2.4,6 4.2,5.1 5,3 4.2,0.9 2.4,0 0.8,0.9 0,3'],
  q: [6, '5,3 4.2,5.2 2.6,6 1,5 0.3,3 1,0.9 2.6,0 4.2,0.9 5,3', '5,6 5,-3'],
  r: [4.2, '0,6 0,0', '0,3.4 0.9,5 2.2,6 3.8,5.6'],
  s: [5, '4.4,4.9 3.4,5.9 2,6 0.7,5.2 0.6,4 1.8,3.2 3.4,2.6 4.4,1.6 4,0.5 2.6,0 1.2,0.2 0.2,1.2'],
  t: [4.2, '1.5,9 1.5,1.4 2.1,0.3 3.2,0 4,0.5', '0,6 3.6,6'],
  u: [5.8, '0,6 0,2.2 0.6,0.7 2.1,0 3.7,0.6 4.8,2.4', '4.8,6 4.8,0'],
  v: [5.4, '0,6 2.6,0', '2.6,0 5.2,6'],
  w: [8.4, '0,6 2,0', '2,0 4.1,5', '4.1,5 6.2,0', '6.2,0 8.2,6'],
  x: [5.2, '0,6 5,0', '5,6 0,0'],
  y: [5.4, '0,6 2.7,0.4', '5.2,6 2.2,-1.4 1,-2.8 0,-3'],
  z: [5.2, '0.2,6 4.8,6', '4.8,6 0,0', '0,0 5,0'],
  0: [6, '3,10 1.2,8.8 0.3,5 1.2,1.2 3,0 4.8,1.2 5.7,5 4.8,8.8 3,10'],
  1: [4, '0.6,7.8 2.8,10', '2.8,10 2.8,0'],
  2: [6, '0.5,7.8 1.6,9.6 3.2,10 4.8,9 5.2,7.2 4,5 0.3,0', '0.3,0 5.6,0'],
  3: [6, '0.5,8.6 2,10 3.8,9.8 5,8.4 4.6,6.4 2.8,5.4', '2.8,5.4 4.8,4.4 5.4,2.6 4.4,0.6 2.6,0 0.3,1.2'],
  4: [6.4, '4.2,0 4.2,10', '4.2,10 0,3.2', '0,3.2 6,3.2'],
  5: [6, '5.2,10 1,10', '1,10 0.6,5.6', '0.6,5.6 2.4,6.4 4.2,6 5.4,4.2 5,1.6 3.2,0 1.4,0.2 0.2,1.4'],
  6: [6, '5,9.4 3.4,10 1.6,8.8 0.5,5.6 0.5,2.6 1.6,0.6 3.2,0 4.8,0.9 5.4,2.8 4.8,4.8 3.2,5.6 1.4,4.8 0.5,3'],
  7: [6, '0.2,10 5.6,10', '5.6,10 2,0'],
  8: [6, '3,5.4 1.2,6.6 0.9,8.4 2,9.8 3.6,10 4.8,8.8 4.8,7 3,5.4 0.8,3.8 0.4,1.8 1.6,0.2 3.4,0 5,1 5.4,2.8 4.6,4.4 3,5.4'],
  9: [6, '5.2,7 4.3,5.2 2.7,4.4 1,5.2 0.4,7.2 1,9.1 2.7,10 4.3,9.2 5.3,7.2 5.3,4.2 4.3,1.2 2.6,0 0.9,0.6'],
  '.': [2.2, '0.95,0.1 1.05,0.6'],
  ',': [2.4, '1.2,0.7 1.2,-0.2 0.5,-1.6'],
  ':': [2.2, '0.95,0.1 1.05,0.6', '0.95,4.4 1.05,4.9'],
  ';': [2.4, '1.2,0.7 1.2,-0.2 0.5,-1.6', '1.15,4.4 1.25,4.9'],
  '!': [2.2, '1,10 1,3', '0.95,0.1 1.05,0.6'],
  '?': [5.2, '0.4,8 1.4,9.7 3,10 4.4,9 4.6,7.4 3.4,5.8 2.4,4.4 2.4,3', '2.35,0.1 2.45,0.6'],
  '-': [4.4, '0.5,3.6 3.8,3.6'],
  '–': [6.4, '0.5,3.6 5.8,3.6'],
  '_': [5, '0,-0.8 4.6,-0.8'],
  '/': [4.6, '0,-1 4.4,10.6'],
  '(': [3.2, '2.6,11 1,8 0.6,4.5 1,1 2.6,-2'],
  ')': [3.2, '0.6,11 2.2,8 2.6,4.5 2.2,1 0.6,-2'],
  "'": [1.8, '1,10 0.8,7.6'],
  '"': [3.4, '0.8,10 0.6,7.6', '2.6,10 2.4,7.6'],
  '`': [2.8, '0.6,10 2,8'],
  '·': [3.2, '1.5,3.3 1.6,3.8'],
  '…': [7, '0.95,0.1 1.05,0.6', '3.45,0.1 3.55,0.6', '5.95,0.1 6.05,0.6'],
  '%': [6.8, '0.4,0 6,10', '1.5,10 0.4,9 0.4,7.6 1.5,6.8 2.6,7.6 2.6,9 1.5,10', '4.9,3.2 3.8,2.4 3.8,1 4.9,0 6,1 6,2.4 4.9,3.2'],
  '+': [5, '0.4,3.6 4.6,3.6', '2.5,5.8 2.5,1.4'],
  '=': [5, '0.4,4.8 4.6,4.8', '0.4,2.4 4.6,2.4'],
  '<': [5, '4.4,6.4 0.6,3.6', '0.6,3.6 4.4,0.8'],
  '>': [5, '0.6,6.4 4.4,3.6', '4.4,3.6 0.6,0.8'],
  ' ': [3.4],
};
// Parsed once: char -> { w, strokes: [[x, y, x, y, ...], ...] }.
const FONT = {};
for (const ch of Object.keys(G)) {
  const [w, ...strokes] = G[ch];
  FONT[ch] = { w, strokes: strokes.map((s) => s.split(' ').flatMap((p) => p.split(',').map(Number))) };
}
export const LETTERING = Object.freeze({ gap: 1.7, lineHeight: 16.5, slant: 0.09, ascent: 11.4, descent: 3.6 });

// A small fixed hash to (-1, 1): the hand's wobble. Same inputs, same value, on every frame.
function wob(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}
const r1 = (v) => Math.round(v * 10) / 10;

// The path of one stroke through its points (already in pixels): a straight pull for two
// points, a Catmull-Rom curve (as cubic Beziers) through three or more; closed loops stay round.
function strokePath(P) {
  const n = P.length / 2;
  let d = `M${r1(P[0])} ${r1(P[1])}`;
  if (n === 2) return d + `L${r1(P[2])} ${r1(P[3])}`;
  const closed = Math.abs(P[0] - P[2 * n - 2]) < 0.01 && Math.abs(P[1] - P[2 * n - 1]) < 0.01;
  const at = (i) => {
    if (closed) { const k = ((i % (n - 1)) + (n - 1)) % (n - 1); return [P[2 * k], P[2 * k + 1]]; }
    const k = Math.max(0, Math.min(n - 1, i));
    return [P[2 * k], P[2 * k + 1]];
  };
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

// Width in pixels of `text` at cap height `size` (the widest line).
export function measureLettering(text, size = 12, tracking = 1) {
  const k = size / 10;
  let best = 0;
  for (const line of String(text).split('\n')) {
    let x = 0;
    for (const ch of line) x += ((FONT[ch] || FONT[ch.toLowerCase()] || FONT[' ']).w + LETTERING.gap) * tracking;
    best = Math.max(best, x * k);
  }
  return best;
}

// text -> { d (SVG path data, y down, origin at the top left of the block), width, height,
// baseline (y of the first line's baseline), stroke (a pen width that suits the size) }.
// opts: { seed, tracking, wobble (0..1.5, default 1), align: 'left' | 'center' }
export function letterPath(text, size = 12, opts = {}) {
  const k = size / 10, seed = opts.seed | 0, tr = opts.tracking || 1, wb = opts.wobble == null ? 1 : opts.wobble;
  const lines = String(text).split('\n');
  const width = measureLettering(text, size, tr);
  const top = LETTERING.ascent * k;
  let d = '';
  lines.forEach((line, li) => {
    let x = opts.align === 'center' ? (width - measureLettering(line, size, tr)) / 2 / k : 0;
    const base = top + li * LETTERING.lineHeight * k;
    let i = 0;
    for (const ch of line) {
      const g = FONT[ch] || FONT[ch.toLowerCase()] || FONT[' '];
      const code = ch.codePointAt(0) + seed * 131 + li * 17;
      // This letter's share of the hand: a lean, a lift, a touch larger or smaller.
      const lean = LETTERING.slant + 0.035 * wb * wob(code, i, 1);
      const lift = 0.32 * wb * wob(code, i, 2);
      const grow = 1 + 0.045 * wb * wob(code, i, 3);
      for (let s = 0; s < g.strokes.length; s++) {
        const S = g.strokes[s], P = new Array(S.length);
        for (let j = 0; j < S.length; j += 2) {
          const jx = 0.16 * wb * wob(code + s * 7, i, 10 + j), jy = 0.16 * wb * wob(code + s * 7, i, 11 + j);
          const gx = S[j] * grow + jx, gy = S[j + 1] * grow + jy + lift;
          P[j] = (x + gx + gy * lean) * k;
          P[j + 1] = base - gy * k;
        }
        d += strokePath(P);
      }
      x += (g.w + LETTERING.gap) * tr;
      i++;
    }
  });
  return {
    d, width: Math.ceil(width + 2), height: Math.ceil((LETTERING.ascent + LETTERING.descent + (lines.length - 1) * LETTERING.lineHeight) * k),
    baseline: top, stroke: Math.max(1.05, size * 0.118),
  };
}

export const hasGlyph = (ch) => !!(FONT[ch] || FONT[String(ch).toLowerCase()]);
