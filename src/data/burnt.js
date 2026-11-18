// !! NOT WIRED INTO THE GAME (2026-11-18). This file is built and tested but nothing calls it yet. Before it is
// !! wired, read the faults an independent reader measured in it, in docs/COORDINATOR.md under the fire entry:
// !!   1. THE CAP IS TOO SMALL FOR ONE FIRE. It keeps BURN.max marks and forgets the oldest; one 44 m wood writes
// !!      302 marks and an 80 m wood 899. With the fire relying on this record to know where it has already been,
// !!      a fire in an ordinary wood NEVER GOES OUT (measured: still burning after ten minutes, 4,524 patches).
// !!      Settle that before wiring: either the fire keeps its own memory, or this record does not forget a mark
// !!      while a fire is still near it, or the cap is raised to cover the largest fire anyone can light.
// !!   2. A SPREADING MARK IS A CIRCLE GROWN ABOUT ITS FIRST MIDDLE, which blackens up to 11 m of ground the fire
// !!      never reached. A creeping fire's honest shape is a short capsule: two ends and a radius.
// Painted Cosmos: what fire has left behind — the scorched ground, the burnt crowns and the melted ice
// (the powers, fire; docs/POWERS.md).
// OWNER: PAINTER / PILOT. Pure (no three, no page): the tests load it in Node.
//
// One small list, read by both sides of the game, exactly as the felled trees are (data/felled.js):
//   the play code marks what the fire has reached, and keeps the list in the saved game (core/save.js);
//   the world paints it — black bare ground where it burned, a bare black crown on a tree whose leaves went,
//   and ice that is gone to the depth it melted to.
// Three things are kept, because the owner asked for three (2026-11-18): "the place it leaves behind actually
// gets burnt if its leaves ... or ground[,] ice melts away to reveal ground or if there's is no ground it just
// keeps melting away".
//   GROUND  a round scorched place: where it was, how wide, and how black it went.
//   CROWN   one tree whose leaves have burned. Named by its own place in the placement data
//           (world/floraplace.js: the same three numbers wherever that tree is listed), so nothing has to be
//           searched to know it again — the same name the felled list uses.
//   MELT    a round place where ice has been melted away, AND HOW DEEP. This one is not a yes-or-no: it goes on
//           getting deeper while the fire burns. If there is ground under the ice the melt stops when it reaches
//           it and the ground is bare; if there is none it keeps going (BURN.deep is as far as we will remember).
//
// WHY A GRID OF CELLS AND NOT A PLAIN LIST. A felled tree is a named thing, so felled.js answers in one lookup.
// A scorch is a round area instead: the world asks "is the floor burnt here" at many points in a frame (the
// ground's own paint, where the explorer's feet are, whether a seed will grow), and a fire that has spread leaves
// hundreds of marks. Walking them all for every point would be hundreds of times the work. So each area mark is
// also filed in the 16-metre cells it covers, and a read looks in the one cell its point falls in and tries only
// the marks filed there — one or two, where a fire has been. With nothing burnt anywhere each reader makes one
// comparison (BURNT.scorches, BURNT.melts, BURNT.crowns) and nothing else.
// MEASURED (tests/burnt.test.mjs, in Node on the build machine, not on a device): 73 ns for one read of the burnt
// ground with a hundred marks on the list, so a thousand reads in a frame cost 0.07 ms; the same reads trying every
// mark instead were 191 ns each. With the list full (300 marks) a read is still 70 ns, which is the whole point of
// the cells: three times the marks is not three times the work.

export const BURN = Object.freeze({
  cell: 16,            // m: the side of a filing cell (the same spacing the wind grid uses, and wider than any one
                       // mark, so a small mark is filed in eight cells and the widest in twenty-seven at the worst)
  max: 300,            // round marks kept, scorched and melted together (the oldest is forgotten first: that place
                       // is clean again). A spreading fire would otherwise fill the saved game.
  maxCrowns: 400,      // burnt crowns kept (the oldest is forgotten first: that tree is green again)
  core: 0.55,          // the share of a mark's width that is burnt right through; from there it fades to its rim,
                       // so a scorch has a soft edge and two marks side by side read as one burnt patch
  scorchR: 3,          // m: how wide a scorch is when the fire first takes hold in a place
  scorchWide: 14,      // m: as wide as one scorch mark may ever grow. Past that the fire starts another mark, so a
                       // long fire front is a line of marks and not one enormous circle that swallows the wood.
  charTime: 2.6,       // s: how long the floor takes to go from singed to black while a fire sits on it
  crownTime: 1.8,      // s: how long a crown takes to burn through, from catching to bare and black
  meltR: 3,            // m: how wide a melted place begins
  meltWide: 10,        // m: as wide as one melted place may grow
  deep: 120,           // m: how far down a melt is remembered where there is no ground under the ice. The owner
                       // asked that it "just keeps melting away"; a saved number cannot be endless, and 120 m of
                       // ice gone is a hole nobody will see the bottom of.
});

// What a mark is, and the same numbers in the saved game's rows.
export const MARK = Object.freeze({ ground: 1, melt: 2, crown: 3 });

const A = new Map();        // the round marks (scorched and melted), by their own number, oldest first
const C = new Map();        // the burnt crowns, by their place in the placement data, oldest first
const G = new Map();        // body -> its filing cells: cell number -> the marks that reach into it
let nextId = 1, ns = 0, nm = 0;   // the next mark's number; how many scorched and how many melted

// version: goes up with every change (the world's renderers compare it, as they do for the felled trees)
// scorches / melts / crowns: how many of each, so that a reader that only cares about one of them pays one
// comparison when nothing of its own kind has happened.
export const BURNT = {
  version: 0,
  get size() { return A.size + C.size; },
  get scorches() { return ns; },
  get melts() { return nm; },
  get crowns() { return C.size; },
};

const crownKey = (bodyId, x, y, z) => bodyId + '|' + x + '|' + y + '|' + z;
const ok3 = (x, y, z) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

// A cell is named by ONE NUMBER, mixed from its three whole-number coordinates (the same stirring the physics uses
// for its lattice hashes). A name spelled out as text ("earth|6|398187|12") was measured at 188 ns to look up and
// this at 45 ns, and the world will look up hundreds of points a frame. Two far-apart cells can land on the same
// number; that costs a couple of extra distance sums and nothing else, because every reader measures the real
// distance to each mark it finds anyway.
function cellHash(i, j, k) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const cellAt = (x, y, z) => cellHash(Math.floor(x / BURN.cell), Math.floor(y / BURN.cell), Math.floor(z / BURN.cell));

// How burnt (or how deep) a mark is at a point `d` metres from its middle: right through in its core, fading to
// nothing at its rim. 0 outside.
function fade(d, r) {
  const a = r * BURN.core;
  if (d <= a) return 1;
  if (d >= r || !(r > a)) return 0;
  const t = (r - d) / (r - a);
  return t * t * (3 - 2 * t);
}

// Files a mark in every cell its square reaches into (eight for a small one; twenty-seven for the widest), and
// remembers which, so it can be taken out again when it is forgotten or when it has grown. Filing happens when
// something burns, not when something is read, so a few cells more here cost nothing in a frame.
function file(m) {
  let cells = G.get(m.bodyId);
  if (!cells) G.set(m.bodyId, cells = new Map());
  const c = BURN.cell, r = m.r;
  const i0 = Math.floor((m.x - r) / c), i1 = Math.floor((m.x + r) / c);
  const j0 = Math.floor((m.y - r) / c), j1 = Math.floor((m.y + r) / c);
  const k0 = Math.floor((m.z - r) / c), k1 = Math.floor((m.z + r) / c);
  m.cells = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
    const key = cellHash(i, j, k);
    let b = cells.get(key);
    if (!b) cells.set(key, b = []);
    b.push(m);
    m.cells.push(key);
  }
}
function unfile(m) {
  const cells = G.get(m.bodyId);
  if (cells) for (const key of m.cells || []) {
    const b = cells.get(key);
    if (!b) continue;
    const i = b.indexOf(m);
    if (i >= 0) b.splice(i, 1);
    if (!b.length) cells.delete(key);
  }
  m.cells = [];
}
function forget(m) {
  unfile(m);
  A.delete(m.id);
  if (m.kind === MARK.ground) ns--; else nm--;
}
function capped() {
  while (A.size > BURN.max) forget(A.get(A.keys().next().value));
}

// A mark of one kind that the point falls inside, on this body: the one that covers it most. Looks in the one cell
// the point belongs to and tries only the marks filed there.
// The answer is written into one shared pair and handed back, rather than a fresh little object each time: the world
// asks this hundreds of times a frame and throws the answer away at once, and a new object each time would leave the
// browser clearing up rubbish in the middle of play.
const _hit = { m: null, v: 0 };
function coverAt(bodyId, x, y, z, kind) {
  const cells = G.get(bodyId);
  if (!cells) return null;
  const b = cells.get(cellAt(x, y, z));
  if (!b) return null;
  let best = null, bv = 0;
  for (let i = 0; i < b.length; i++) {
    const m = b[i];
    if (m.kind !== kind) continue;             // (the cells are kept per body, so there is no body to check here)
    const dx = x - m.x, dy = y - m.y, dz = z - m.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= m.r * m.r) continue;                     // (no square root unless the point is really inside)
    const v = fade(Math.sqrt(d2), m.r);
    if (v > bv) { bv = v; best = m; }
  }
  if (!best) return null;
  _hit.m = best; _hit.v = bv;
  return _hit;
}

// Adds a round mark, or widens one that is already there, so that a fire creeping across the ground does not leave a
// thousand overlapping circles behind it. A mark is widened when the new circle touches it and the two together
// still fit inside `wide`; otherwise this is a new mark.
function area(kind, bodyId, x, y, z, radius, wide) {
  if (!ok3(x, y, z) || !(radius > 0)) return null;
  const nr = radius > wide ? wide : radius;
  const cells = G.get(bodyId);
  const b = cells && cells.get(cellAt(x, y, z));
  if (b) for (let i = 0; i < b.length; i++) {
    const m = b[i];
    if (m.kind !== kind) continue;
    const d = Math.hypot(x - m.x, y - m.y, z - m.z);
    if (d > m.r + nr) continue;                       // they do not even touch: another mark
    const want = d + nr;
    if (want > wide) continue;                        // widening it would make one great blot: another mark
    if (want > m.r) { unfile(m); m.r = want; file(m); BURNT.version++; }
    return m;
  }
  const m = { id: nextId++, kind, bodyId, x, y, z, r: nr, c: 0, d: 0, floor: -1, cells: [] };
  A.set(m.id, m);
  file(m);
  if (kind === MARK.ground) ns++; else nm++;
  capped();
  BURNT.version++;
  return m;
}

// ---- burnt ground ---------------------------------------------------------------------------------------------

// The fire has taken hold of the floor at (x, y, z) on a body (body-local). `radius` m across; `char` 0..1 is how
// black it is already (1: burnt right out). A place that is burning again only ever gets blacker, never greener.
// Returns the mark (new, or the one that was already there, widened), or null for a nonsense place.
export function scorch(bodyId, x, y, z, radius = BURN.scorchR, char = 1) {
  const m = area(MARK.ground, bodyId, x, y, z, radius, BURN.scorchWide);
  if (!m) return null;
  const c = char > 1 ? 1 : char > 0 ? char : 0;
  if (c > m.c) { m.c = c; BURNT.version++; }
  return m;
}
// A fire that goes on sitting in one place blackens it: dt seconds more of burning. (The fire holds its own mark,
// the way the wind holds its own source; it is cheaper than finding the place again every frame.)
export function charMore(m, dt) {
  if (!m || m.kind !== MARK.ground) return 0;
  const c0 = m.c, c = c0 + (dt > 0 ? dt / BURN.charTime : 0);
  m.c = c > 1 ? 1 : c;
  // (2026-11-18, found by the reader who checked this file) ONLY WHEN IT REALLY CHANGED, as deepenMelt below does.
  // The version is how the world is told to lay its trees and its ground again; bumping it for a fire sitting on
  // ground that is already black had the whole near field thrown away and re-sampled every frame - measured at
  // 3,840 bumps a second with a full fire, against a re-sample that costs milliseconds. This file's own header
  // promises one comparison when nothing of its own kind has happened, and now it keeps that promise.
  if (m.c !== c0) BURNT.version++;
  return m.c;
}
// How burnt the floor is at a point (body-local): 0 clean, 1 burnt right out. The world paints it darker and bare
// by this. One cell's worth of marks is tried; with nothing scorched anywhere this is one comparison.
export function burntAt(bodyId, x, y, z) {
  if (!ns) return 0;
  const hit = coverAt(bodyId, x, y, z, MARK.ground);
  return hit ? hit.m.c * hit.v : 0;
}
// Every scorched place on one body, into `out` (for a renderer that lays them all out again when the list changes).
export function scorchesOn(bodyId, out = []) {
  out.length = 0;
  if (ns) for (const m of A.values()) if (m.kind === MARK.ground && m.bodyId === bodyId) out.push(m);
  return out;
}

// ---- burnt leaves ---------------------------------------------------------------------------------------------

// The crown of the tree that stands at (x, y, z) catches fire (its place in the placement data, body-local).
// `wait` (s): how long before it really catches, so that a fire reaching a tree is seen to climb it first.
// Returns the record, or null when that crown has already burned.
// The record's `c` is how far the burning has gone: below 0 it has not caught yet, 1 is bare and black. The world
// steps it (as world/flora.js steps a felled tree's fall), by dt / BURN.crownTime.
export function burnCrown(bodyId, x, y, z, wait = 0) {
  if (!ok3(x, y, z)) return null;
  const k = crownKey(bodyId, x, y, z);
  if (C.has(k)) return null;
  const B = { bodyId, x, y, z, c: -Math.max(0, wait) / BURN.crownTime };
  C.set(k, B);
  if (C.size > BURN.maxCrowns) C.delete(C.keys().next().value);
  BURNT.version++;
  return B;
}
// The record for the tree at that place, or null. One lookup, as for a felled tree.
export function burntCrownAt(bodyId, x, y, z) { return C.size ? C.get(crownKey(bodyId, x, y, z)) || null : null; }
// The crowns of one body that are still burning (so the world can step just those), into `out`.
export function burningOn(bodyId, out = []) {
  out.length = 0;
  for (const B of C.values()) if (B.bodyId === bodyId && B.c < 1) out.push(B);
  return out;
}
// Every burnt crown of one body, burning or already bare, into `out`. (Asked for when the list has changed, so that
// the trees' renderer can touch the few trees that have burned instead of asking of every tree it holds whether it
// is burnt: the same lesson the felled trees taught, data/felled.js.)
export function burntCrownsOn(bodyId, out = []) {
  out.length = 0;
  if (C.size) for (const B of C.values()) if (B.bodyId === bodyId) out.push(B);
  return out;
}

// ---- melted ice -----------------------------------------------------------------------------------------------

// Ice begins to melt at (x, y, z) on a body. `radius` m across. `floor` is how much ice there is under this place
// before the ground beneath shows (m); pass -1 (the default) where there is NO ground under the ice, which is the
// case the owner asked about: there the melt just keeps going down.
// Returns the melted place (new, or the one already there, widened). Deepen it with deepenMelt().
export function meltIce(bodyId, x, y, z, radius = BURN.meltR, floor = -1) {
  const m = area(MARK.melt, bodyId, x, y, z, radius, BURN.meltWide);
  if (!m) return null;
  // A place that was bottomless as far as we knew, and now has a real floor given for it, takes the floor; a floor
  // already known is kept, so one caller guessing -1 cannot turn solid ground into a bottomless hole.
  if (m.floor < 0 && floor >= 0) { m.floor = floor; BURNT.version++; }
  return m;
}
// More heat on a melted place: `metres` of ice gone (the fire works out how fast from its own strength).
// It stops where the ground is, if there is ground; where there is none it goes on to BURN.deep.
// Returns how deep the melt is now.
export function deepenMelt(m, metres) {
  if (!m || m.kind !== MARK.melt) return 0;
  const lim = m.floor >= 0 ? (m.floor < BURN.deep ? m.floor : BURN.deep) : BURN.deep;
  let d = m.d + (metres > 0 ? metres : 0);
  if (d > lim) d = lim;
  if (d !== m.d) { m.d = d; BURNT.version++; }
  return m.d;
}
// How much ice is gone at a point (body-local), in metres: deepest in the middle of a melted place, nothing at its
// rim, so the ice dips into a bowl. 0 where no ice has melted. With nothing melted anywhere, one comparison.
export function meltedAt(bodyId, x, y, z) {
  if (!nm) return 0;
  const hit = coverAt(bodyId, x, y, z, MARK.melt);
  return hit ? hit.m.d * hit.v : 0;
}
// How far the ground under the ice has been laid bare at a point: 0 still covered, 1 the ice is gone and the ground
// shows. Always 0 where there is no ground under the ice (there is nothing to reveal: it just keeps melting, and
// meltedAt says how far down it has got).
export function meltedBare(bodyId, x, y, z) {
  if (!nm) return 0;
  const hit = coverAt(bodyId, x, y, z, MARK.melt);
  if (!hit || hit.m.floor < 0) return 0;
  if (!(hit.m.floor > 0)) return 1;                   // (ice no thicker than nothing: the ground was always there)
  const f = (hit.m.d * hit.v) / hit.m.floor;
  return f > 1 ? 1 : f;
}
// Is the melt at this point a hole with nothing under it? (true where ice is gone and there was no ground below.)
export function meltedThrough(bodyId, x, y, z) {
  if (!nm) return false;
  const hit = coverAt(bodyId, x, y, z, MARK.melt);
  return !!hit && hit.m.floor < 0 && hit.m.d > 0;
}
// Every melted place on one body, into `out`.
export function meltsOn(bodyId, out = []) {
  out.length = 0;
  if (nm) for (const m of A.values()) if (m.kind === MARK.melt && m.bodyId === bodyId) out.push(m);
  return out;
}

// ---- the saved game -------------------------------------------------------------------------------------------

// The whole record as plain rows, and back. One row shape for all three kinds, so the loader is one check:
//   [bodyId, kind, x, y, z, r, a, b]
//   ground: r how wide, a how black (0..1), b unused.   melt: r how wide, a how deep, b the floor (-1: none).
//   crown:  r 0, a how far it has burned, b unused.
// The places (x, y, z) are kept exactly as they are: a crown is known by its place in the placement data, and a
// rounded number would be a different tree. Only the widths and depths are rounded, to keep the save small.
export function burntRows() {
  const rows = [];
  for (const m of A.values()) rows.push([m.bodyId, m.kind, m.x, m.y, m.z, +m.r.toFixed(3), +(m.kind === MARK.ground ? m.c : m.d).toFixed(3), +m.floor.toFixed(3)]);
  // (a crown's row says 1: a crown that comes back from a save has finished burning, the way a felled tree comes
  // back lying. So a save loaded and saved again is the same save, half-burnt crowns and all.)
  for (const B of C.values()) rows.push([B.bodyId, MARK.crown, B.x, B.y, B.z, 0, 1, 0]);
  return rows;
}
// Rubbish is left out row by row (a save from a broken game, or a hand-edited one, must not take the record with
// it). Marks come back as they were saved: nothing is merged with anything on the way in, so a save that is loaded
// and saved again is the same save. A crown that comes back from a save has finished burning (c = 1), the way a
// felled tree comes back lying.
export function burntLoad(rows) {
  A.clear(); C.clear(); G.clear();
  ns = 0; nm = 0; nextId = 1;
  if (Array.isArray(rows)) for (const r of rows) {
    if (!Array.isArray(r) || r.length < 8 || typeof r[0] !== 'string' || !r[0]) continue;
    let fine = true;
    for (let i = 1; i < 8; i++) if (typeof r[i] !== 'number' || !Number.isFinite(r[i])) fine = false;
    if (!fine) continue;
    const kind = r[1];
    if (kind === MARK.crown) {
      if (C.size >= BURN.maxCrowns) continue;
      C.set(crownKey(r[0], r[2], r[3], r[4]), { bodyId: r[0], x: r[2], y: r[3], z: r[4], c: 1 });
      continue;
    }
    if (kind !== MARK.ground && kind !== MARK.melt) continue;
    if (!(r[5] > 0) || A.size >= BURN.max) continue;
    const wide = kind === MARK.ground ? BURN.scorchWide : BURN.meltWide;
    const m = { id: nextId++, kind, bodyId: r[0], x: r[2], y: r[3], z: r[4], r: Math.min(r[5], wide), c: 0, d: 0, floor: -1, cells: [] };
    if (kind === MARK.ground) { m.c = Math.min(1, Math.max(0, r[6])); ns++; } else {
      m.floor = r[7] >= 0 ? r[7] : -1;
      m.d = Math.min(Math.max(0, r[6]), m.floor >= 0 ? Math.min(m.floor, BURN.deep) : BURN.deep);
      nm++;
    }
    A.set(m.id, m);
    file(m);
  }
  BURNT.version++;
}
