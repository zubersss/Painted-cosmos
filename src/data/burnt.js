// WIRED INTO THE GAME (2026-11-18, the same day): core/powers.js _keepBurns writes every burning patch in here, the
// world paints the marks (world/index.js syncBurnt), and core/save.js keeps them in the saved game beside the felled
// trees. (The banner that stood here said it was wired to nothing and pointed at a patch to apply; it had been true
// for a few hours and was false by the evening, which an independent reader caught. Do not trust a banner over a
// grep.) The two faults an independent reader measured in it are both settled here:
// !!   1. A MARK IS NOW A SHORT CAPSULE -- two ends and a radius -- and not a circle grown about its first middle.
// !!      It grows ALONG ITS OWN LINE as the fire creeps, and never wider than a flame is (BURN.scorchWide), so a
// !!      fire that turns a corner starts another mark instead of swelling one circle over ground it never reached.
// !!   2. THE FIRE NO LONGER LEANS ON THIS RECORD TO KNOW WHERE IT HAS BEEN. physics/fire.js keeps its own memory of
// !!      the ground one casting has burned, so a fire goes out whatever this record has forgotten. What is
// !!      forgotten here is only ever a patch of ground that reads clean again -- never an endless fire.
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
//   GROUND  a scorched place: the line the fire crept along (two ends), how wide it burned, and how black it went.
//   CROWN   one tree whose leaves have burned. Named by its own place in the placement data
//           (world/floraplace.js: the same three numbers wherever that tree is listed), so nothing has to be
//           searched to know it again — the same name the felled list uses.
//   MELT    a place where ice has been melted away, AND HOW DEEP. This one is not a yes-or-no: it goes on
//           getting deeper while the fire burns. If there is ground under the ice the melt stops when it reaches
//           it and the ground is bare; if there is none it keeps going (BURN.deep is as far as we will remember).
//
// WHAT SHAPE A MARK IS, AND WHY (changed 2026-11-18, after a reader measured the old one). A mark is a CAPSULE: two
// ends and a radius, which is a sausage of burnt ground with round caps. A fire does not sit still: it creeps, two
// metres at a time, and the honest picture of where it has been is the LINE it crept along, as wide as its flame.
// A mark therefore only ever grows ALONG ITS OWN LINE (and never wider than BURN.scorchWide, which is about as wide
// as a burning patch is). The shape before this was a circle grown about the first place that caught, so a fire
// creeping eleven metres left a circle of eleven metres' radius: it blackened the ground to EVERY side of its path,
// including ground the fire never came near. A fire that turns a corner now starts another mark instead, so a long
// fire front is a few strokes laid end to end. It costs one more subtraction and one more dot product to read.
//
// WHY A GRID OF CELLS AND NOT A PLAIN LIST. A felled tree is a named thing, so felled.js answers in one lookup.
// A mark is an area instead: the world asks "is the floor burnt here" at many points in a frame (the ground's own
// paint, where the explorer's feet are, whether a seed will grow), and a fire that has spread leaves hundreds of
// marks. Walking them all for every point would be hundreds of times the work. So each area mark is also filed in
// the 16-metre cells its own box reaches into, and a read looks in the one cell its point falls in and tries only
// the marks filed there — one or two, where a fire has been. With nothing burnt anywhere each reader makes one
// comparison (BURNT.scorches, BURNT.melts, BURNT.crowns) and nothing else.
// MEASURED (tests/burnt.test.mjs, in Node on the build machine, not on a device): see the numbers the test prints;
// as this was written, 89 to 95 ns for one read of the burnt ground with a hundred marks on the list, each of them a
// stroke eight metres long, so a thousand reads in a frame cost 0.09 ms. The same reads trying every mark on the
// list instead were 481 to 563 ns. With the record full (600 marks) a read is 89 to 113 ns, which is the whole
// point of the cells: six times the marks is not six times the work.

export const BURN = Object.freeze({
  cell: 16,            // m: the side of a filing cell (the same spacing the wind grid uses, and a little wider than
                       // the longest mark, so a short mark is filed in eight cells and the longest in twenty-seven
  // HOW MANY MARKS ARE KEPT. The oldest is forgotten first, and a forgotten mark means that patch of ground reads
  // clean again: a real limit to tell the owner about, not a bug. It was 300, which one 80 m wood overran twice
  // over; with the capsule shape a mark covers a stroke of ground instead of a dot, so the same woods want far
  // fewer marks. MEASURED by burning real woods out (src/physics/fire.test.mjs, and in the whole physics):
  // 14 marks for a wood 24 m across, 38 to 41 for one 44 m across, 124 to 152 for one 80 m across.
  // So 600 is several big fires' worth, and the saved game can carry it: measured at 44 kB of rows with the record
  // full (68 kB with 400 burnt crowns as well), where a save today is a few kB and the browser's store holds
  // megabytes. A forest fire left to run in endless wood still overruns it, and then the ground it burned first
  // reads clean again -- which the owner should be told, and which no longer leaves a fire burning for ever
  // (physics/fire.js keeps its own memory now).
  max: 600,
  maxCrowns: 400,      // burnt crowns kept (the oldest is forgotten first: that tree is green again)
  // THE GROUND GREENS AGAIN (the owner, 2026-11-18: "make sure that felled woods or burnt areas eventually do return
  // to normal so it isn't taking up memory"). A scorch waits `life` seconds of play, then fades over `fade`; a burnt
  // crown waits and comes back into leaf the same way; melted ice fills in over `freeze`. It happens out of sight:
  // nothing begins to heal until the explorer is more than `quiet` metres away, or, if they stay to watch, until it
  // has waited twice as long. The mark is dropped the moment it is clean, so the record is bounded by TIME as well
  // as by count -- which is the owner's own reason for asking.
  life: 600,           // s of play before a mark starts to heal
  fade: 150,           // s a scorch and a burnt crown take to go
  freeze: 240,         // s melted ice takes to fill back in
  quiet: 200,          // m: how far the explorer must be for it to happen unseen
  core: 0.55,          // the share of a mark's width that is burnt right through; from there it fades to its rim,
                       // so a scorch has a soft edge and two marks side by side read as one burnt patch
  scorchR: 3,          // m: how wide a scorch is when the fire first takes hold in a place
  scorchWide: 5,       // m: as WIDE as one scorch mark may ever grow (its radius). A burning patch is 1.4 to 3.8 m
                       // across (physics/fire.js FIRE.litRadius), so a mark is never much wider than the flame that
                       // made it. This is the number that keeps a mark honest about the ground the fire reached.
  scorchLong: 18,      // m: and as LONG as one may grow along the line the fire crept. Past that the fire starts
                       // another mark, so a long fire front is a line of strokes and not one enormous blot.
  charTime: 2.6,       // s: how long the floor takes to go from singed to black while a fire sits on it
  crownTime: 1.8,      // s: how long a crown takes to burn through, from catching to bare and black
  meltR: 3,            // m: how wide a melted place begins
  meltWide: 10,        // m: as wide as one melted place may grow (a hole in ice really does open out round a flame)
  meltLong: 12,        // m: and as long, where the heat has crept along the ice
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

// HOW FAR A POINT IS FROM A MARK'S LINE, squared (no square root unless a reader needs the real distance). The line
// is the mark's two ends; off the ends it is the distance to the nearer end, so the shape is a capsule. A mark the
// fire never crept out of has both ends in one place, and this is then the plain distance to that place.
function segDist2(m, x, y, z) {
  const ax = x - m.x, ay = y - m.y, az = z - m.z;
  const bx = m.x2 - m.x, by = m.y2 - m.y, bz = m.z2 - m.z;
  const bb = bx * bx + by * by + bz * bz;
  if (bb <= 1e-12) return ax * ax + ay * ay + az * az;
  let t = (ax * bx + ay * by + az * bz) / bb;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = ax - bx * t, dy = ay - by * t, dz = az - bz * t;
  return dx * dx + dy * dy + dz * dz;
}

// Where a new circle lies in relation to a mark's own line, for the merging below: how far ALONG the line from its
// first end (metres, which may be negative or past the far end), how far to the SIDE of it, and how far from the
// capsule itself. Only something burning asks this, a few times a second, so a little arithmetic is nothing here.
const _sg = { along: 0, side: 0, d: 0, len: 0 };
function toMark(m, x, y, z) {
  const ax = x - m.x, ay = y - m.y, az = z - m.z;
  const bx = m.x2 - m.x, by = m.y2 - m.y, bz = m.z2 - m.z;
  const len = Math.hypot(bx, by, bz);
  const q2 = ax * ax + ay * ay + az * az;
  if (!(len > 1e-6)) {           // both ends in one place: every way is along its line, and the first move sets it
    _sg.len = 0; _sg.along = Math.sqrt(q2); _sg.side = 0; _sg.d = _sg.along;
    return _sg;
  }
  const along = (ax * bx + ay * by + az * bz) / len;
  const side = Math.sqrt(Math.max(0, q2 - along * along));
  _sg.len = len; _sg.along = along; _sg.side = side;
  _sg.d = along < 0 ? Math.sqrt(q2) : along > len ? Math.hypot(x - m.x2, y - m.y2, z - m.z2) : side;
  return _sg;
}

// How burnt (or how deep) a mark is at a point `d` metres from its line: right through in its core, fading to
// nothing at its rim. 0 outside.
function fade(d, r) {
  const a = r * BURN.core;
  if (d <= a) return 1;
  if (d >= r || !(r > a)) return 0;
  const t = (r - d) / (r - a);
  return t * t * (3 - 2 * t);
}

// Files a mark in every cell its box reaches into (eight for a short one; twenty-seven for the longest), and
// remembers which, so it can be taken out again when it is forgotten or when it has grown. The box is round both
// ends of the capsule. Filing happens when something burns, not when something is read, so a few cells more here
// cost nothing in a frame.
function file(m) {
  let cells = G.get(m.bodyId);
  if (!cells) G.set(m.bodyId, cells = new Map());
  const c = BURN.cell, r = m.r;
  const lox = m.x < m.x2 ? m.x : m.x2, hix = m.x > m.x2 ? m.x : m.x2;
  const loy = m.y < m.y2 ? m.y : m.y2, hiy = m.y > m.y2 ? m.y : m.y2;
  const loz = m.z < m.z2 ? m.z : m.z2, hiz = m.z > m.z2 ? m.z : m.z2;
  const i0 = Math.floor((lox - r) / c), i1 = Math.floor((hix + r) / c);
  const j0 = Math.floor((loy - r) / c), j1 = Math.floor((hiy + r) / c);
  const k0 = Math.floor((loz - r) / c), k1 = Math.floor((hiz + r) / c);
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

// WHAT THE FIRE LEFT, GROWING BACK. Called once a frame by whoever owns the explorer's powers (core/powers.js: this
// record exists only because of them). `dt` seconds of play; `p` where the explorer is, or null to heal anywhere.
// Nearly every frame of a game this walks a record that is empty and returns at once.
export function healBurnt(dt, p = null) {
  if (!(dt > 0) || (!A.size && !C.size)) return 0;
  let gone = 0, moved = false;
  const ready = (o, x, y, z) => {
    o.age = (o.age || 0) + dt;
    if (o.age < BURN.life) return false;
    if (p && o.age < BURN.life * 2 && Math.hypot(x - p.x, y - p.y, z - p.z) <= BURN.quiet) return false;
    return true;
  };
  for (const m of [...A.values()]) {
    if (!ready(m, m.x, m.y, m.z)) continue;
    if (m.kind === MARK.ground) {
      m.c -= dt / BURN.fade; moved = true;
      if (m.c <= 0) { forget(m); gone++; }
    } else {
      // the hollow fills from the bottom, and a deep one takes as long as a shallow one: `freeze` is the time to
      // fill, whatever the depth, so a 2 m melt does not vanish in four seconds while a 100 m one takes four minutes
      if (!(m.d0 > 0)) m.d0 = m.d;
      m.d -= dt / BURN.freeze * m.d0; moved = true;
      if (m.d <= 0) { forget(m); gone++; }
    }
  }
  for (const [k, cr] of [...C]) {
    if (!ready(cr, cr.x, cr.y, cr.z)) continue;
    cr.c -= dt / BURN.fade; moved = true;
    if (cr.c <= 0) { C.delete(k); gone++; }
  }
  if (moved) BURNT.version++;
  return gone;
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
    const d2 = segDist2(m, x, y, z);
    if (d2 >= m.r * m.r) continue;                     // (no square root unless the point is really inside)
    const v = fade(Math.sqrt(d2), m.r);
    if (v > bv) { bv = v; best = m; }
  }
  if (!best) return null;
  _hit.m = best; _hit.v = bv;
  return _hit;
}

// Adds a mark, or grows one that is already there, so that a fire creeping across the ground does not leave a
// thousand overlapping circles behind it. A mark grows in only two ways, and both keep it honest about the ground
// the fire really crossed:
//   ALONG ITS OWN LINE, when the new patch is beyond one end of it and nearly in line with it (`inLine` below): that
//     end moves out to the new patch, up to `wideL` of line in all. This is a fire creeping.
//   A LITTLE WIDER, when the new patch lies over the line it has already laid but reaches further to the side, up to
//     `wideR` across. This is a fire burning more fiercely in the same place.
// Anything else -- a fire turning a corner, or coming back beside its own path -- is A NEW MARK. That is the whole
// point: the old shape was one circle grown about the first place that caught, and it blackened every way at once.
function area(kind, bodyId, x, y, z, radius, wideR, wideL) {
  if (!ok3(x, y, z) || !(radius > 0)) return null;
  const nr = radius > wideR ? wideR : radius;
  const cells = G.get(bodyId);
  const b = cells && cells.get(cellAt(x, y, z));
  if (b) for (let i = 0; i < b.length; i++) {
    const m = b[i];
    if (m.kind !== kind) continue;
    const s = toMark(m, x, y, z);
    if (s.d > m.r + nr) continue;                     // they do not even touch: another mark
    if (s.along >= 0 && s.along <= s.len) {
      // over the stroke already: it may only get wider, never longer
      const want = s.side + nr;
      if (want > wideR) continue;                     // it would have to be wider than a mark may be: another mark
      if (want > m.r) { unfile(m); m.r = want; file(m); BURNT.version++; }
      return m;
    }
    // beyond one end: the stroke may run on, if the new patch is near enough its line that the stroke does not
    // swing sideways over ground nothing burned
    if (s.side > m.r * 0.6) continue;
    const len = s.along < 0 ? s.len - s.along : s.along;
    if (len > wideL) continue;                        // long enough: the fire starts another mark here
    unfile(m);
    if (s.along < 0) { m.x = x; m.y = y; m.z = z; } else { m.x2 = x; m.y2 = y; m.z2 = z; }
    if (nr > m.r) m.r = nr;
    file(m);
    BURNT.version++;
    return m;
  }
  const m = { id: nextId++, kind, bodyId, x, y, z, x2: x, y2: y, z2: z, r: nr, c: 0, d: 0, floor: -1, cells: [] };
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
// Returns the mark (new, or the one already there with its stroke run on to here), or null for a nonsense place.
export function scorch(bodyId, x, y, z, radius = BURN.scorchR, char = 1) {
  const m = area(MARK.ground, bodyId, x, y, z, radius, BURN.scorchWide, BURN.scorchLong);
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
// Each is a stroke: (x, y, z) to (x2, y2, z2), `r` metres wide, `c` how black. Both ends are the same place where
// the fire never crept, which a renderer may read as a plain circle.
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
  const m = area(MARK.melt, bodyId, x, y, z, radius, BURN.meltWide, BURN.meltLong);
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
// Every melted place on one body, into `out` (a stroke too: (x, y, z) to (x2, y2, z2), `r` wide, `d` deep).
export function meltsOn(bodyId, out = []) {
  out.length = 0;
  if (nm) for (const m of A.values()) if (m.kind === MARK.melt && m.bodyId === bodyId) out.push(m);
  return out;
}

// ---- the saved game -------------------------------------------------------------------------------------------

// The whole record as plain rows, and back. One row shape for all three kinds, so the loader is one check:
//   [bodyId, kind, x, y, z, r, a, b, dx, dy, dz]
//   ground: r how wide, a how black (0..1), b unused.   melt: r how wide, a how deep, b the floor (-1: none).
//   crown:  r 0, a how far it has burned, b unused, and no dx/dy/dz: a tree is a place, not a stroke.
// dx, dy, dz are THE FAR END OF THE STROKE, as metres from the first end, which is how the capsule is kept. They
// are an offset and not a place because an offset is a handful of metres where a place is a planet's radius: one
// short number in the save instead of a long one. A row without them (a save written before marks were strokes)
// comes back as a mark whose two ends are in one place, which is a plain circle and is exactly what it was.
// The first end (x, y, z) is kept exactly as it is: a crown is known by its place in the placement data, and a
// rounded number would be a different tree. Only the widths, depths and the offset are rounded, to keep the save
// small.
export function burntRows() {
  const rows = [];
  for (const m of A.values()) rows.push([m.bodyId, m.kind, m.x, m.y, m.z, +m.r.toFixed(3), +(m.kind === MARK.ground ? m.c : m.d).toFixed(3), +m.floor.toFixed(3),
    +(m.x2 - m.x).toFixed(2), +(m.y2 - m.y).toFixed(2), +(m.z2 - m.z).toFixed(2)]);
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
      C.set(crownKey(r[0], r[2], r[3], r[4]), { bodyId: r[0], x: r[2], y: r[3], z: r[4], c: 1 });
      if (C.size > BURN.maxCrowns) C.delete(C.keys().next().value);
      continue;
    }
    if (kind !== MARK.ground && kind !== MARK.melt) continue;
    if (!(r[5] > 0)) continue;
    const wide = kind === MARK.ground ? BURN.scorchWide : BURN.meltWide;
    const long = kind === MARK.ground ? BURN.scorchLong : BURN.meltLong;
    // the far end of the stroke, if the row carries one, brought back inside the longest a stroke may be
    let ox = 0, oy = 0, oz = 0;
    if (r.length >= 11 && Number.isFinite(r[8]) && Number.isFinite(r[9]) && Number.isFinite(r[10])) {
      ox = r[8]; oy = r[9]; oz = r[10];
      const L = Math.hypot(ox, oy, oz);
      if (L > long) { const k = long / L; ox *= k; oy *= k; oz *= k; }
    }
    const m = { id: nextId++, kind, bodyId: r[0], x: r[2], y: r[3], z: r[4], x2: r[2] + ox, y2: r[3] + oy, z2: r[4] + oz, r: Math.min(r[5], wide), c: 0, d: 0, floor: -1, cells: [] };
    if (kind === MARK.ground) { m.c = Math.min(1, Math.max(0, r[6])); ns++; } else {
      m.floor = r[7] >= 0 ? r[7] : -1;
      m.d = Math.min(Math.max(0, r[6]), m.floor >= 0 ? Math.min(m.floor, BURN.deep) : BURN.deep);
      nm++;
    }
    A.set(m.id, m);
    file(m);
    // (2026-11-18, found by an independent reader) A LOADER MUST FORGET THE SAME END PLAY FORGETS. This used to stop
    // reading once the record was full, so a save with more rows than the cap kept the OLDEST marks and threw away
    // the newest: the player lost the fire burning in front of them and kept the one they lit an hour ago on the
    // other side of the world. Play evicts the oldest (capped, burnCrown), and so do the felled and stripped
    // records; burnt was the one that disagreed.
    capped();
  }
  BURNT.version++;
}
