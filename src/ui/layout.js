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
  reach: 40,                   // a label slides at most this far from its place to keep off a slip
  ringMin: 14, ringMax: 260,   // the drawn ring's diameter (hud.js)
});

// The drawn diameter of a mark's ring (px), in 2 px steps.
export const ringSize = (r) => Math.round(Math.max(MARKS.ringMin, Math.min(MARKS.ringMax, r * 2 + 10)) / 2) * 2;

const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// A label that must show and whose four places all touch something (the nose a few degrees off
// a target, its ring over the ship: under, over, right and left of the ring are all on the hull;
// a place to land just over the prompt) is moved to the nearest clear place. The re-fix pass,
// M4: such a label fell back to its first place, under the ring, on the ship (the nose 4 degrees
// over Mars: "Mars 463.0 km 76 s" over the ship, two wing tips showing).
//
// How far: to keep off a slip (the prompt, the notice, the gauges) a label moves MARKS.reach at
// most from one of its places (away from the ring, and across); with no clear place that near it
// lies on as little of the slip as it can rather than float off from its ring (the pre-ship
// verifier's R3: sliding as far as it took put "a place to land" up to a whole picture away from
// its ring). Off the ship it slides as far as the hull takes, and then at most MARKS.reach further
// to keep off a slip as well.
const AWAY = { below: [0, 1], above: [0, -1], right: [1, 0], left: [-1, 0] };
// The best place within `reach` of the candidates slid `base` px away from the ring: the lowest
// score(rect, displacement) among the places free(rect, soft) allows (score null: not allowed).
function nearest(cands, rect, free, soft, score, base = 0, reach = MARKS.reach) {
  let best = null, bestS = Infinity;
  for (const c of cands) {
    const [ax, ay] = AWAY[c.side];
    for (let d = 0; d <= reach; d += 2) {
      for (let e = 0; e * e + d * d <= reach * reach; e += 2) {
        for (const sgn of e ? [1, -1] : [1]) {
          const moved = { lx: c.lx + ax * (base + d) - ay * e * sgn, ly: c.ly + ay * (base + d) + ax * e * sgn, side: c.side, d: base + d };
          const r = rect(moved);
          if (!free(r, soft)) continue;
          const sc = score(r, Math.hypot(d, e));
          if (sc < bestS) { bestS = sc; best = moved; }
        }
      }
    }
  }
  return best;
}
function slide(cands, rect, free, soft, from, to) {
  for (let d = from; d <= to; d += 2) {
    for (const c of cands) {
      const [ax, ay] = AWAY[c.side];
      const moved = { lx: c.lx + ax * d, ly: c.ly + ay * d, side: c.side, d };
      if (free(rect(moved), soft)) return moved;
    }
  }
  return null;
}
function placeMust(cands, rect, free, w, h, slipCover) {
  const near = nearest(cands, rect, free, true, (r, m) => m);
  if (near) return near;
  // on a slip, then, but on as little of it as a place within reach allows (a little nearer the
  // ring is worth a little more of the slip covered)
  const onSlip = nearest(cands, rect, free, false, (r, m) => slipCover(r) + m * 0.5);
  if (onSlip) return onSlip;
  const offShip = slide(cands, rect, free, false, 2, Math.max(w, h));
  if (!offShip) return null;
  return nearest(cands, rect, free, true, (r, m) => m, offShip.d) || offShip;
}

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
    const below = { lx: 0, ly: m.kind === 'edge' ? M.edgeGap : ring + M.gap, side: 'below' }, above = { lx: 0, ly: -(m.kind === 'edge' ? M.edgeGap : ring + M.gap) - lh, side: 'above' };
    const right = { lx: ring + M.gap + 2 + lw / 2, ly: -lh / 2, side: 'right' }, left = { lx: -(ring + M.gap + 2 + lw / 2), ly: -lh / 2, side: 'left' };
    // (a world not aimed at is named under or over its ring only: of a pile, two names at most)
    const must = m.kind !== 'body' || !!m.keep;
    const cands = m.kind === 'edge' || !must ? (m.above ? [above, below] : [below, above]) : m.above ? [above, below, right, left] : [below, above, right, left];
    const rect = (c) => ({ x0: m.x + c.lx - lw / 2, x1: m.x + c.lx + lw / 2, y0: m.y + c.ly, y1: m.y + c.ly + lh });
    const inside = (r) => r.x0 >= M.margin && r.x1 <= w - M.margin && r.y0 >= M.margin && r.y1 <= h - M.margin;
    const free = (r, soft) => inside(r) && !placed.some((p) => hits(r, p)) && !keep.some((k) => (soft || !k.soft) && hits(r, k));
    // A label that must show slides a little to a place clear of everything before it lies on a
    // slip (M4's blind play-test: "a place to land 256 m" over the "Land here" prompt and the
    // throttle), and off the ship as far as it takes (placeMust).
    let pick = cands.find((c) => free(rect(c), true));
    const slipCover = (r) => keep.reduce((a, k) => a + (k.soft && hits(r, k) ? (Math.min(r.x1, k.x1) - Math.max(r.x0, k.x0)) * (Math.min(r.y1, k.y1) - Math.max(r.y0, k.y0)) : 0), 0);
    if (!pick && must) pick = placeMust(cands, rect, free, w, h, slipCover) || cands[0];
    m.lw = lw; m.lh = lh;
    if (!pick) { m.label = null; m.text = null; continue; }
    m.lx = pick.lx; m.ly = pick.ly;
    placed.push(rect(pick));
  }
  return list;
}

// The names on the touch chart (src/ui/map.js). Each name is placed where its ink, the halo
// included, lies on no world's dot and on no other name, and inside the chart: tried first on the
// sides `prefer` lists (up, down, right, left), right by its dot; then round its dot in sixteen
// directions, a little further out each round (CHART_NAMES.rings), and only where it lies nearer
// the edge of its own dot than of any other (by closeMargin px when it is within close px of its
// own, by nearer px further out: a name is read as the dot's it lies by); the first clear place is
// taken.
// With none, a name in the way may move to another clear place of its own; then (on a small chart)
// a smaller size is tried; then a name that may be left off is, and the others take the place that
// covers least (a dot counts four times a name). The re-fix pass of release 1: with all four
// sides taken a name fell back to its first side, over another name ('Mercury' touching 'Saturn'
// on the 400x225 chart), and the box it was tested with missed the halo and the descenders by
// about 2 px.
// list: [{ id, name, x, y (the dot's centre, css px), r (what round the dot is kept clear: its
// radius, or its ring's), rd (the dot's own radius, when r is more), s (the lettering's cap
// height), sMin (optional: it may be lettered as small as this where it has no room at s), mayHide
// (optional: with no clear place at all it is left off), prefer: ['up', ...] }], the chosen world
// first. bounds: { w, h }. Returns, in the
// list's order, [{ id, x, y (the name's centre and baseline, for inkOnCanvas), s (the size it
// takes), box: { x0, y0, x1, y1 } (its ink with the halo), clear (true: it touches nothing),
// hidden (true: left off) }].
export const CHART_NAMES = Object.freeze({ pad: 2, dotPad: 1.5, gap: 1, nearer: 3, close: 9, closeMargin: 0, rings: [2, 6, 11, 17, 24, 32], mustRings: [42, 54] });
// The ink of a name as letterPath and inkOnCanvas draw it (centred on x, baseline y): the
// lettering's width, its ascent and descent, the halo (its pen width + 3) and the pixel the pen's
// start is rounded to.
export function chartNameBox(name, s, x, y) {
  const k = s / 10, w = measureLettering(name, s), halo = (Math.max(1.05, s * 0.118) + 3) / 2 + 0.5;
  return { x0: x - w / 2 - 1.5 - halo, x1: x + w / 2 + 1.5 + halo, y0: y - LETTERING.ascent * k - halo, y1: y + LETTERING.descent * k + halo };
}
export function placeChartNames(list, bounds) {
  const C = CHART_NAMES;
  const dots = list.map((n) => ({ x: n.x, y: n.y, r: n.r * 1.1 + C.dotPad }));
  const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const near = (b, x, y) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
  const grow = (b) => ({ x0: b.x0 - C.gap, y0: b.y0 - C.gap, x1: b.x1 + C.gap, y1: b.y1 + C.gap });
  const onDots = (b) => { let c = 0; for (const d of dots) if (near(b, d.x, d.y) < d.r) c += 4 * Math.PI * d.r * d.r; return c; };
  const inside = (b) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= bounds.w && b.y1 <= bounds.h;
  const DIRS = { up: -Math.PI / 2, down: Math.PI / 2, right: 0, left: Math.PI };
  // Every place each name may take, in its order of preference: at its own size first, round its
  // dot; then (where it may be lettered smaller, n.sMin) a size between and its smallest. Only
  // boxes inside the chart; with none, its first place pulled in.
  const places = list.map((n) => {
    const sizes = n.sMin && n.sMin < n.s ? [n.s, (n.s + n.sMin) / 2, n.sMin] : [n.s];
    const all = [];
    let first = null;
    for (const s of sizes) {
      const b0 = chartNameBox(n.name, s, 0, 0);          // extents about (0, 0): x0, y0 < 0 < x1, y1
      const hw = (b0.x1 - b0.x0) / 2, hh = (b0.y1 - b0.y0) / 2, mx = (b0.x0 + b0.x1) / 2, my = (b0.y0 + b0.y1) / 2;
      // the place (centre, baseline) whose box lies `gap` px off the dot's clear circle in direction a
      const toward = (a, gap) => {
        const ux = Math.cos(a), uy = Math.sin(a), want = n.r + gap;
        let lo = 0, hi = want + hw + hh;
        for (let i = 0; i < 16; i++) {
          const t = (lo + hi) / 2, dx = Math.max(Math.abs(ux * t) - hw, 0), dy = Math.max(Math.abs(uy * t) - hh, 0);
          if (Math.hypot(dx, dy) < want) lo = t; else hi = t;
        }
        return [n.x + ux * hi - mx, n.y + uy * hi - my];
      };
      const prefer = (n.prefer && n.prefer.length ? n.prefer : ['up', 'down', 'right', 'left']).filter((k) => k in DIRS);
      const a0 = DIRS[prefer[0]];
      const at = prefer.map((k) => toward(DIRS[k], C.pad));
      for (const g of n.mayHide ? C.rings : C.rings.concat(C.mustRings)) {
        // sixteen directions, the ones nearest the first side first (a name that must show, a
        // little further out still)
        for (let k = 0; k < 16; k++) at.push(toward(a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), g));
      }
      const box = (c) => ({ x0: c[0] + b0.x0, x1: c[0] + b0.x1, y0: c[1] + b0.y0, y1: c[1] + b0.y1 });
      // (and nearer its own dot than any other, or it names the wrong world: the reader takes a
      // name for the dot it lies by)
      const own = (b) => {
        const e0 = near(b, n.x, n.y) - (n.rd || n.r), margin = e0 <= C.close ? C.closeMargin : C.nearer;
        return list.every((m) => m === n || near(b, m.x, m.y) - (m.rd || m.r) > e0 + margin);
      };
      for (const c of at) { const b = box(c); if (inside(b) && own(b)) all.push({ c, b, s }); }
      // (a name that must show may, with nothing better, lie where another dot is as near)
      if (!n.mayHide) for (const c of at) { const b = box(c); if (inside(b) && !own(b)) all.push({ c, b, s, far: true }); }
      if (!first) { const c = [Math.max(-b0.x0, Math.min(bounds.w - b0.x1, at[0][0])), Math.max(-b0.y0, Math.min(bounds.h - b0.y1, at[0][1]))]; first = { c, b: box(c), s }; }
    }
    for (const q of all) q.dots = onDots(q.b);
    // (no place at all: the first, pulled into the chart; for a name that may be left off, as
    // one that covers a dot, so that it is: it would lie by another world's dot)
    if (!all.length) { first.dots = n.mayHide ? Infinity : onDots(first.b); all.push(first); }
    return all;
  });
  // The chosen world first, then the others that must show, then the most hemmed in (the most
  // dots near): the inner worlds, round the sun, have the least room.
  const crowd = list.map((n) => list.reduce((a, m) => a + (Math.hypot(m.x - n.x, m.y - n.y) < 70 ? 1 : 0), 0));
  const must = (i) => (i === 0 ? 2 : list[i].mayHide ? 0 : 1);
  const order = list.map((n, i) => i).sort((a, b) => must(b) - must(a) || crowd[b] - crowd[a] || a - b);
  const at = new Array(list.length).fill(null);          // the place each name has taken
  const hitsNames = (b, skip) => { const g = grow(b), out = []; for (let i = 0; i < at.length; i++) if (i !== skip && at[i] && area(g, at[i].b) > 0) out.push(i); return out; };
  const coverOf = (q, skip) => { const g = grow(q.b); let c = q.dots; for (let i = 0; i < at.length; i++) if (i !== skip && at[i]) c += area(g, at[i].b); return c; };
  const clearPlace = (i) => places[i].find((q) => q.dots === 0 && hitsNames(q.b, i).length === 0);
  // A clear place whose names in the way can each move to another clear place of their own
  // (not the chosen world's): they move, and this name takes it.
  const shove = (i) => {
    for (const c of places[i]) {
      if (c.dots) continue;
      const inWay = hitsNames(c.b, i);
      if (!inWay.length || inWay.length > 3 || inWay.includes(order[0])) continue;
      const keep = inWay.map((j) => at[j]), before = at[i];
      at[i] = c;
      for (const j of inWay) at[j] = null;
      let ok = true;
      for (const j of inWay) { const m = clearPlace(j); if (!m) { ok = false; break; } at[j] = m; }
      if (ok) return c;
      inWay.forEach((j, k) => { at[j] = keep[k]; });
      at[i] = before;
    }
    return null;
  };
  const leastBad = (i) => places[i].reduce((best, c) => (coverOf(c, i) < coverOf(best, i) ? c : best), places[i][0]);
  for (const i of order) at[i] = clearPlace(i) || shove(i) || leastBad(i);
  // A second look at the names left on something: what moved since may have made room.
  for (let round = 0; round < 2; round++) {
    for (const i of order) {
      if (at[i].dots === 0 && hitsNames(at[i].b, i).length === 0) continue;
      const was = at[i];
      at[i] = null;
      at[i] = clearPlace(i) || shove(i) || was;
    }
  }
  // A name with no clear place left that may be left off (n.mayHide) is: its dot stays, and a tap
  // on it names it in the sheet's line (the desktop's marks do the same: a world whose name has no
  // room keeps its ring). The others lie where they cover least.
  const hidden = new Array(list.length).fill(false);
  const isClear = (i) => at[i].dots === 0 && hitsNames(at[i].b, i).length === 0;
  // (the last placed are left off first: one left off may clear a name placed before it)
  for (const i of order.slice().reverse()) {
    if (!list[i].mayHide || isClear(i)) continue;
    hidden[i] = true;
    at[i] = null;
  }
  for (const i of order) {
    if (hidden[i] || isClear(i)) continue;
    const was = at[i];
    at[i] = null;
    at[i] = clearPlace(i) || was;
    // (a name that must show, the chosen world's or yours, still on another: that one is left off)
    if (!isClear(i)) for (const j of hitsNames(at[i].b, i)) if (list[j].mayHide) { hidden[j] = true; at[j] = null; }
  }
  return list.map((n, i) => {
    const q = at[i];
    if (hidden[i] || !q) return { id: n.id, hidden: true, x: 0, y: 0, s: 0, box: null, clear: true };
    return { id: n.id, x: q.c[0], y: q.c[1], s: q.s, box: q.b, clear: q.dots === 0 && hitsNames(q.b, i).length === 0 };
  });
}
