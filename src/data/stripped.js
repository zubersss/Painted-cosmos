// Painted Cosmos: the trees the explorer's wind has stripped bare (the powers, wind; docs/POWERS.md).
// OWNER: PAINTER / PILOT. Pure (no three, no page): the tests load it in Node.
//
// One small list, read by both sides of the game, exactly as the felled trees are (data/felled.js):
//   the physics tears leaves out of a crown as the wind goes through it (physics/loose.js _tear) and says so here;
//   the play code turns that into a named tree and keeps the list in the saved game (core/save.js);
//   the world draws that tree's crown with fewer leaves, and leans what is left the way the wind went
//   (world/flora.js).
// A tree is named by its own place in the placement data (world/floraplace.js: the same three numbers wherever that
// tree is listed: its near patch, its far patch, the obstacles), so nothing has to be searched to know it again --
// the same name the felled list uses.
// With nothing ever stripped the list is empty, and every reader makes one comparison (STRIPPED.size) and nothing else.
//
// WHY IT IS A NUMBER AND NOT A YES OR NO. The owner asked (2026-11-18) for the wind to "strip the trees bare with
// there leaves going everywhere" -- stripping, not a switch. So a tree holds how bare it is, 0 to 1, which rises by
// the leaves that are actually torn off it: one cast through a crown takes some of its leaves, a second takes more,
// and only a wind that keeps working on the same tree leaves it bare.
//
// WHY A TREE COMES BACK INTO LEAF. The owner has not said whether a stripped tree should recover, and a wood that
// never recovers is a wood that can be ruined for ever in one afternoon's play. So a bare tree stays bare for
// STRIP.hold seconds -- long enough that the player sees what they did, and walks away and comes back to it -- and
// then comes back into leaf over STRIP.regrow seconds, and leaves the list when it is green again, which also keeps
// the saved game small. This is one setting: STRIP.regrow = 0 means a stripped tree never recovers, if that is what
// the owner wants when they see it. (A felled tree does NOT come back: a trunk on the ground is not a bare crown.)
//
// WHY THE VERSION DOES NOT MOVE EVERY FRAME. The world's renderer rebuilds what it holds when `version` changes
// (the same way it does for the felled trees). Bareness changes a little every single frame while a tree is coming
// back into leaf -- four minutes of that is fourteen thousand frames -- so the version is bumped only when a tree's
// bareness has moved by STRIP.quant since the last bump. A tree therefore asks the world to redraw it about twenty
// times over its whole life as a bare tree, not fourteen thousand times.
//
// MEASURED (in Node on the build machine, not on a device), beside the felled trees' own reader on the same run,
// because that is the cost this had to match: with a hundred trees stripped, and a thousand trees asked about of
// which one in ten is on the list, bareAt() is 226 to 282 ns a read -- 0.23 to 0.28 ms for a THOUSAND reads -- and
// felledAt() is 217 to 281 ns on the very same loop. So they cost the same, as they should: both are one Map lookup,
// and about half of that time is spent BUILDING THE KEY out of three full-sized numbers, not looking it up. With
// nothing stripped anywhere a read is 3 to 4 ns (the one comparison). Walking the whole list instead with
// strippedOn() is 500 to 620 ns for all hundred trees, which is why the world should walk the list when it can
// (the felled trees already do: data/felled.js felledOn, and the note there about the 24.9 ms frame).

export const STRIP = Object.freeze({
  max: 600,           // trees kept (the oldest is forgotten first: it is in leaf again). A gale over a wood touches
                      // many crowns lightly, so this is larger than the felled list's cap.
  full: 90,           // leaves torn out of ONE CROWN that take it from full to bare.
                      // (2026-11-18, re-measured against the real tearing after a reader rebuilt its geometry: one
                      //  crown receives about 20 torn leaves from the smallest cast and about 44 from one held to
                      //  the full - NOT the few hundred a gust tears in all, which are shared over every crown it
                      //  passes through. At 24 the smallest tap left 7 of 19 trees wholly bare and a held gust left
                      //  107 trees bare: one cast stripped a wood. At 90 a held cast takes a crown about half way,
                      //  so stripping one tree bare is two or three casts aimed at it, which is what was meant.)
  step: 0.34,         // the most bareness ONE REPORT may add, whatever it carries.
                      // (2026-11-18, said plainly after a reader measured it: this is per REPORT, and one cast
                      //  through one crown arrives as several reports, so it does NOT on its own keep the promise
                      //  that a single cast cannot take a green crown bare. What keeps that promise is `full`
                      //  above, set from the leaves one crown really receives. This step only stops one freak
                      //  report doing the whole job.)
  hold: 40,           // s: how long a tree stays as bare as the wind left it before it begins to come back
  regrow: 240,        // s: from bare to full leaf again. 0: a stripped tree stays stripped for ever.
  quant: 0.05,        // how far bareness must move before the world is asked to draw the tree again (see above)
  bend: 0.10,         // rad: how far a wholly bare tree leans away, about the level line across the wind that
                      // stripped it (six degrees: the owner asked that the leaves go "folling the direction of the
                      // wind", so what is left of the tree should show which way that was). 0: it stands straight.
  inbox: 24,          // torn crowns held for the play code to name (below)
  merge: 3,           // m: leaves torn within this of an earlier report in the same frame are the same crown
  lean: 0.6,          // how much of a new report's wind direction is taken into a tree's kept direction, when that
                      // report carries as much as one may (STRIP.step), so the lean follows the last wind that
                      // really worked on the tree and is not dragged about by every stray leaf
});

const M = new Map();
// version: goes up when a tree is stripped, or has come back by STRIP.quant (the world's renderer compares it);
// size: how many trees are stripped at all
export const STRIPPED = { version: 0, get size() { return M.size; } };

const keyOf = (bodyId, x, y, z) => bodyId + '|' + x + '|' + y + '|' + z;

// Asks the world to draw this tree again -- but only once its bareness has really moved, as the note at the top of
// this file explains. Three things always count, whatever the step:
//   `fresh`   a tree that has just joined the list, however few leaves it lost: the world has to be told the tree is
//             on the list at all before it can draw it any differently;
//   bare, and in full leaf again, which are both worth drawing -- but only the first time the tree reaches them, or
//             a player holding a gust on a tree that is already bare would ask for it to be redrawn every frame.
const touch = (R, fresh) => {
  if (fresh || Math.abs(R.b - R.vb) >= STRIP.quant || ((R.b <= 0 || R.b >= 1) && R.b !== R.vb)) { R.vb = R.b; STRIPPED.version++; }
};

// Tears `leaves` leaves out of the crown of the tree that stands at (x, y, z) on a body (its place in the placement
// data, body-local), in a wind going (dx, dy, dz). Bareness rises by the leaves taken, never by more than STRIP.step
// in one report, and the kept direction leans toward this wind by as much of it as was taken.
// Returns the record (new or the one that was there).
export function stripTree(bodyId, x, y, z, leaves, dx = 0, dy = 0, dz = 0) {
  const k = keyOf(bodyId, x, y, z);
  const add = Math.min(STRIP.step, Math.max(0, leaves) / STRIP.full);
  const l = Math.hypot(dx, dy, dz);
  let R = M.get(k);
  const fresh = !R;
  if (!R) {
    R = { bodyId, x, y, z, b: 0, vb: 0, hold: STRIP.hold, dx: l ? dx / l : 0, dy: l ? dy / l : 0, dz: l ? dz / l : 0 };
  } else {
    // the most recently stripped tree is the youngest on the list, so the cap never forgets the tree the player is
    // working on right now
    M.delete(k);
    if (l) {
      const w = Math.min(1, add * STRIP.lean / Math.max(1e-6, STRIP.step));
      let nx = R.dx + (dx / l - R.dx) * w, ny = R.dy + (dy / l - R.dy) * w, nz = R.dz + (dz / l - R.dz) * w;
      const nl = Math.hypot(nx, ny, nz);
      if (nl > 1e-6) { R.dx = nx / nl; R.dy = ny / nl; R.dz = nz / nl; }
    }
  }
  R.b = Math.min(1, R.b + add);
  R.hold = STRIP.hold;                       // more wind through it: it starts its wait over
  M.set(k, R);
  if (M.size > STRIP.max) M.delete(M.keys().next().value);
  touch(R, fresh);
  return R;
}

// The record of the tree at that place, or null. b: how bare it is (0 full, 1 bare); dx, dy, dz: the way the wind
// was going when it stripped it.
export function strippedAt(bodyId, x, y, z) { return M.size ? M.get(keyOf(bodyId, x, y, z)) || null : null; }

// HOW BARE THE TREE AT THAT PLACE IS, 0 to 1. This is the reader the world uses as it lays a patch, for every tree
// in it: one comparison when nothing anywhere has been stripped, and one Map lookup when something has.
export function bareAt(bodyId, x, y, z) {
  if (!M.size) return 0;
  const R = M.get(keyOf(bodyId, x, y, z));
  return R ? R.b : 0;
}

// Every stripped tree of one body, into `out`. (The trees' renderer asks for this when the list has changed, so that
// it can go to each stripped tree instead of asking of every tree it holds whether it is stripped -- the same reason
// the felled trees are walked as a list, see data/felled.js felledOn.)
export function strippedOn(bodyId, out = []) {
  out.length = 0;
  if (M.size) for (const R of M.values()) if (R.bodyId === bodyId) out.push(R);
  return out;
}

// A second of play: every bare tree waits out its hold and then comes back into leaf, and a tree that is green again
// leaves the list. Nothing at all when nothing is stripped. Returns how many trees are still stripped.
// (It goes by the time played, not the clock, so a game that is shut for a week opens where it was left.)
export function stripStep(dt) {
  if (!M.size || !(dt > 0)) return M.size;
  if (!(STRIP.regrow > 0)) return M.size;              // the owner's choice: stripped stays stripped
  const h = dt > 1 ? 1 : dt;
  let gone = null;
  for (const R of M.values()) {
    if (R.hold > 0) { R.hold -= h; continue; }
    R.b -= h / STRIP.regrow;
    if (R.b <= 0) { R.b = 0; touch(R); (gone || (gone = [])).push(keyOf(R.bodyId, R.x, R.y, R.z)); continue; }
    touch(R);
  }
  if (gone) for (const k of gone) M.delete(k);
  return M.size;
}

// HOW A STRIPPED TREE IS TURNED FROM STANDING: a turn about the level line across the wind that stripped it, through
// its foot, so the tree leans away downwind by as much as it is bare. (The same shape as a felled tree's fallTurn in
// data/felled.js, and much the smaller turn: a felled tree goes most of the way to the ground, a stripped one leans.)
// (ux, uy, uz): up at the tree (unit); R: its record. Fills out[0..3] with the quaternion x, y, z, w.
export function bendTurn(ux, uy, uz, R, out) {
  const a = STRIP.bend * (R.b <= 0 ? 0 : R.b >= 1 ? 1 : R.b);
  if (!(a > 0)) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
  // the wind's own direction, level at the tree
  const k = R.dx * ux + R.dy * uy + R.dz * uz;
  let fx = R.dx - ux * k, fy = R.dy - uy * k, fz = R.dz - uz * k;
  const fl = Math.hypot(fx, fy, fz);
  if (fl < 1e-6) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }   // (a wind straight up or down leans nothing)
  fx /= fl; fy /= fl; fz /= fl;
  // the axis: up x wind (a turn about it carries "up" toward the wind)
  const ax = uy * fz - uz * fy, ay = uz * fx - ux * fz, az = ux * fy - uy * fx;
  const sn = Math.sin(a * 0.5);
  out[0] = ax * sn; out[1] = ay * sn; out[2] = az * sn; out[3] = Math.cos(a * 0.5);
  return out;
}

// ---- what the physics hands over ---------------------------------------------------------------
// The physics tears the leaves (physics/loose.js _tear) and knows how many it took and which way the air was going,
// but it works in metres about the explorer and has no idea which tree a crown belongs to: the placement data is the
// world's, not the physics'. So it drops what it tore in here, in body coordinates, and the play code -- which
// already looks trees up in the placement data for the wind knife -- takes them out each frame and names them.
// The inbox is a fixed set of slots that is never grown and never allocates: leaves torn within STRIP.merge of a
// slot already in it are the same crown and are added to that slot, so a whole frame of tearing through one crown is
// one report. When every slot is full the oldest is overwritten -- nothing waits more than a frame, so that only
// happens if nobody is draining it (the powers off), and then it must not grow without end.
const IN = [];
let inN = 0, inNext = 0;

// The physics says: `leaves` leaves came out of a crown at (x, y, z) on a body, in a wind going (dx, dy, dz).
export function tornAt(bodyId, x, y, z, leaves, dx = 0, dy = 0, dz = 0) {
  const r2 = STRIP.merge * STRIP.merge;
  for (let i = 0; i < inN; i++) {
    const S = IN[i];
    if (S.bodyId !== bodyId) continue;
    const ax = S.x - x, ay = S.y - y, az = S.z - z;
    if (ax * ax + ay * ay + az * az > r2) continue;
    S.leaves += leaves; S.dx = dx; S.dy = dy; S.dz = dz;      // the latest wind through it is the one that counts
    return S;
  }
  if (inN < STRIP.inbox) { IN[inN] = { bodyId, x, y, z, leaves, dx, dy, dz }; return IN[inN++]; }
  const S = IN[inNext]; inNext = (inNext + 1) % STRIP.inbox;
  S.bodyId = bodyId; S.x = x; S.y = y; S.z = z; S.leaves = leaves; S.dx = dx; S.dy = dy; S.dz = dz;
  return S;
}

// The play code takes the frame's reports, into `out`, and the inbox is empty again. The numbers are COPIED into
// `out`'s own slots, which it keeps and reuses, so that the caller may hold its array from frame to frame: what it
// was handed cannot be written over underneath it by the next thing the wind tears, and nothing is allocated here.
export function drainTorn(out = []) {
  for (let i = 0; i < inN; i++) {
    const S = IN[i], O = out[i] || (out[i] = { bodyId: '', x: 0, y: 0, z: 0, leaves: 0, dx: 0, dy: 0, dz: 0 });
    O.bodyId = S.bodyId; O.x = S.x; O.y = S.y; O.z = S.z; O.leaves = S.leaves; O.dx = S.dx; O.dy = S.dy; O.dz = S.dz;
  }
  out.length = inN;
  inN = 0; inNext = 0;
  return out;
}

// ---- the saved game ----------------------------------------------------------------------------
// The list as plain rows, and back. A tree that comes back from a save is as bare as it was, and begins its wait
// again: the owner opens the game and sees the wood they left, and it recovers from there.
export function strippedRows() {
  return [...M.values()].map((R) => [R.bodyId, R.x, R.y, R.z, +R.b.toFixed(3), +R.dx.toFixed(4), +R.dy.toFixed(4), +R.dz.toFixed(4)]);
}
export function strippedLoad(rows) {
  M.clear();
  inN = 0; inNext = 0;
  if (Array.isArray(rows)) {
    for (const r of rows.slice(-STRIP.max)) {
      if (!Array.isArray(r) || typeof r[0] !== 'string') continue;
      let ok = true; for (let i = 1; i < 8; i++) if (typeof r[i] !== 'number' || !Number.isFinite(r[i])) ok = false;
      if (!ok) continue;
      const b = r[4] <= 0 ? 0 : r[4] >= 1 ? 1 : r[4];
      if (!(b > 0)) continue;                            // a tree in full leaf is not on this list
      M.set(keyOf(r[0], r[1], r[2], r[3]), { bodyId: r[0], x: r[1], y: r[2], z: r[3], b, vb: b, hold: STRIP.hold, dx: r[5], dy: r[6], dz: r[7] });
    }
  }
  STRIPPED.version++;
}
