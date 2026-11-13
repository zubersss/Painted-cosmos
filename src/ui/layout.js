// Where the slips go. Pure (no DOM): the sizes of lettered slips and one small layout pass for
// the markers' labels, so that a label never lies on the ship, on the prompt, the notice or the
// gauges, or on another label (PAINTER's critique of the interface, M4: "the slips lie on the
// subject and on each other").
import { measureLettering, LETTERING } from './lettering.js';

// Break `text` into lines no wider than `maxWidth` pixels at cap height `size` (the lettering
// does not wrap by itself). Lines already in the text are kept; a word longer than a line stays whole.
export function wrapLettering(text, size, maxWidth) {
  const fill = (para, width) => {
    const lines = [];
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && measureLettering(next, size) > width) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
    return lines;
  };
  const out = [];
  for (const para of String(text == null ? '' : text).split('\n')) {
    let lines = fill(para, maxWidth);
    // No widow: the same number of lines, of about one length ("... Temperate / Forest" left one
    // word alone on the second line).
    if (lines.length > 1) {
      const share = measureLettering(para, size) / lines.length;
      for (let f = 1.02; share * f < maxWidth; f += 0.06) {
        const even = fill(para, share * f);
        if (even.length === lines.length) { lines = even; break; }       // the narrowest width that keeps the count
      }
    }
    out.push(...lines);
  }
  return out.join('\n');
}

// The size in pixels of a block of lettering (as src/ui/lettering.js letterPath draws it).
export function letteringSize(text, size) {
  const lines = String(text).split('\n').length, k = size / 10;
  return { w: Math.ceil(measureLettering(text, size) + 2), h: Math.ceil((LETTERING.ascent + LETTERING.descent + (lines - 1) * LETTERING.lineHeight) * k) };
}

export const MARKS = Object.freeze({
  padX: 9, padY: 3,            // the slip round a label (theme.css .pc-mark span: 4px 9px 2px)
  gap: 7,                      // between a ring and its label
  edgeGap: 14,                 // between an edge arrow and its label
  margin: 4,                   // a label keeps this far inside the picture
  ringMin: 14, ringMax: 260,   // the drawn ring's diameter (hud.js)
});

// The drawn diameter of a mark's ring (px), in 2 px steps.
export const ringSize = (r) => Math.round(Math.max(MARKS.ringMin, Math.min(MARKS.ringMax, r * 2 + 10)) / 2) * 2;

const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// One pass over this frame's marks. list: [{ kind: 'target' | 'body' | 'edge', x, y, r, label, sub,
// above (prefer the label over the ring), keep (a label that must show: a place to land, a view) }].
// view: { w, h, sizeOf(mark) -> lettering cap height, keep: [{ x0, y0, x1, y1, soft }] } where
// keep are rectangles a label stays out of (the ship, the slips that are up; `soft` ones give way
// to a label that must show and has nowhere else to go).
// Sets on each mark: text (label and sub as lettered), lw, lh (the slip's size), lx (the slip's
// centre, px right of the ring's centre), ly (its top, px below the ring's centre); a 'body'
// mark with no free place for its name keeps its ring and loses the name (label = null).
// Order: the target first, then what must show, then the worlds from the middle of the picture
// (the nose) outward, so that of a pile of names the one aimed at is the one written.
export function layoutMarks(list, view) {
  const M = MARKS, w = view.w, h = view.h, keep = view.keep || [], placed = [];
  const rank = (m) => (m.kind === 'target' ? 0 : m.kind === 'edge' ? 1 : m.keep ? 2 : 3);
  const order = list.map((m, i) => i).sort((a, b) => {
    const A = list[a], B = list[b], ra = rank(A), rb = rank(B);
    if (ra !== rb) return ra - rb;
    return Math.hypot(A.x - w / 2, A.y - h / 2) - Math.hypot(B.x - w / 2, B.y - h / 2);
  });
  for (const i of order) {
    const m = list[i];
    if (m.label == null) { m.text = null; continue; }
    m.text = m.sub ? m.label + '\n' + m.sub : m.label;
    const s = letteringSize(m.text, view.sizeOf ? view.sizeOf(m) : 10);
    const lw = s.w + 2 * M.padX, lh = s.h + 2 * M.padY, ring = m.kind === 'edge' ? 0 : ringSize(m.r) / 2;
    const below = { lx: 0, ly: m.kind === 'edge' ? M.edgeGap : ring + M.gap }, above = { lx: 0, ly: -(m.kind === 'edge' ? M.edgeGap : ring + M.gap) - lh };
    const right = { lx: ring + M.gap + 2 + lw / 2, ly: -lh / 2 }, left = { lx: -(ring + M.gap + 2 + lw / 2), ly: -lh / 2 };
    // (a world not aimed at is named under or over its ring only: of a pile, two names at most)
    const must = m.kind !== 'body' || !!m.keep;
    const cands = m.kind === 'edge' || !must ? (m.above ? [above, below] : [below, above]) : m.above ? [above, below, right, left] : [below, above, right, left];
    const rect = (c) => ({ x0: m.x + c.lx - lw / 2, x1: m.x + c.lx + lw / 2, y0: m.y + c.ly, y1: m.y + c.ly + lh });
    const inside = (r) => r.x0 >= M.margin && r.x1 <= w - M.margin && r.y0 >= M.margin && r.y1 <= h - M.margin;
    const free = (r, soft) => inside(r) && !placed.some((p) => hits(r, p)) && !keep.some((k) => (soft || !k.soft) && hits(r, k));
    let pick = cands.find((c) => free(rect(c), true));
    if (!pick && must) pick = cands.find((c) => free(rect(c), false)) || cands[0];
    m.lw = lw; m.lh = lh;
    if (!pick) { m.label = null; m.text = null; continue; }
    m.lx = pick.lx; m.ly = pick.ly;
    placed.push(rect(pick));
  }
  return list;
}
