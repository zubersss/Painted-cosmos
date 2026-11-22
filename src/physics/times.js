// Painted Cosmos physics: THE PLAYER'S TIME. OWNER: PHYSICS.
//
// The third element is space and time (docs/POWERS-TIME.md; the owner, 2026-11-22). Three of its twelve powers --
// SLOW, HASTE and STILL THE MOMENT -- do one thing between them: they change HOW FAST THE WORLD RUNS in a place.
// This file is that place's list, and it is deliberately the same shape as the wind's (physics/powers.js):
//
//   * a SHORT list of plain shapes, made once and reused, so a cast allocates nothing;
//   * asked by the systems that already step -- the loose grains, the fire -- with one function, timeAt();
//   * with NOTHING in the list, timeAt is one comparison and returns 1, so a game without the powers pays
//     nothing at all, and the game without ?powers=1 never loads this file.
//
// WHY A FIELD AND NOT A GLOBAL CLOCK. A global slow is one line and is not the power the owner asked for: the
// picture of this element is that time is DIFFERENT IN ONE PLACE -- you stand outside a bubble where the rain
// hangs, or you walk into it and the world crawls round you while your own stride does not. That only exists if
// every grain asks where it is.
//
// WHAT A ZONE DOES NOT TOUCH. The player's own body, the camera, and the game's own clock: a slowed place slows
// the WORLD, never the hand that made it. That is the whole feel of the power, and it is why nothing here is
// handed to the explorer's own step.

export const TIMEPOWER = Object.freeze({
  max: 8,                  // zones at once (a cast past this takes the oldest)
  slowRate: 0.2,           // how fast the world runs inside a SLOW bubble
  hasteRate: 4.0,          // ... inside a HASTE one
  stillRate: 0.0,          // ... and inside a STILL one
  radius: 7,               // m: a bubble's own radius at size 1
  ultRadius: 20,           // m: and held to the full
  rim: 0.22,               // of the radius: the band at the edge where the rate eases back to the world's own,
                           // so nothing crosses a hard line and jumps
  slowLife: 6,             // s a slow or haste bubble lasts once let go
  stillLife: 45,           // s a stopped place stays stopped -- it outlives the hand that cast it, which is the
                           // whole point of it: you walk away and come back and the rain is still hanging
  fade: 0.6,               // s it takes to open and to close (nothing in the picture appears or vanishes)
  rateMin: 0,              // the rates are held between these, whatever is asked for
  rateMax: 8,
});

// A zone, made once and reused. `rate` is how fast the world runs inside it: 1 is the world's own time.
function blank() {
  return {
    live: false, bodyId: null,
    px: 0, py: 0, pz: 0,        // where it is, in the body's own axes
    x: 0, z: 0, y: 0,           // ... and in the near grid's, once placed (placeTimes)
    placed: false,
    radius: 0, rate: 1, size: 1,
    age: 0, life: 0, fade: 0, held: false,
    strength: 0,                // 0..1: it opens and closes, so nothing in the picture jumps
    id: 0,
  };
}
let nextId = 1;

export function makeTimes() {
  const T = [];
  for (let i = 0; i < TIMEPOWER.max; i++) T.push(blank());
  T.count = 0;
  T.any = false;             // true while any zone is open: the one comparison every asker makes
  T.bany = false; T.bx0 = 0; T.bx1 = 0; T.bz0 = 0; T.bz1 = 0;    // the box round the lot, in the grid's axes
  return T;
}

// A free slot, or the oldest (a player casting a ninth bubble means the first one has served its turn).
function take(T) {
  if (T.count < TIMEPOWER.max) return T[T.count++];
  let k = 0, a = -1;
  for (let i = 0; i < T.count; i++) if (T[i].age > a) { a = T[i].age; k = i; }
  return T[k];
}

// Cast one. `rate` is the world's pace inside it; `life` how long it lasts once let go; `held` keeps it open
// while the hand is down. Returns the zone.
export function castTime(T, bodyId, p, rate, size = 1, life = TIMEPOWER.slowLife, held = false) {
  const s = take(T), k = size > 1 ? size : 1;
  s.live = true; s.bodyId = bodyId;
  s.px = p.x; s.py = p.y; s.pz = p.z;
  s.placed = false;
  s.radius = (k > 1 ? TIMEPOWER.ultRadius : TIMEPOWER.radius) * (k > 1 ? 1 : 1);
  s.rate = Math.max(TIMEPOWER.rateMin, Math.min(TIMEPOWER.rateMax, rate));
  s.size = k; s.age = 0; s.life = life; s.fade = TIMEPOWER.fade; s.held = held; s.strength = 0;
  s.id = nextId++;
  T.any = true;
  return s;
}

export function moveTime(s, p) { if (s) { s.px = p.x; s.py = p.y; s.pz = p.z; s.placed = false; } }
export function releaseTime(s) { if (s && s.held) { s.held = false; s.age = Math.min(s.age, Math.max(0, s.life - s.fade)); } }

// Step the list: open, hold, close, and give back the slots of the ones that have gone.
export function stepTimes(T, dt) {
  if (!T.count) { T.any = false; return 0; }
  let n = 0, any = false;
  for (let i = 0; i < T.count; i++) {
    const s = T[i];
    if (!s.live) continue;
    if (!s.held) s.age += dt; else s.age = Math.min(s.age, s.life * 0.5);
    const up = s.fade > 0 ? Math.min(1, s.age / s.fade) : 1;
    const down = s.held || s.fade <= 0 ? 1 : Math.min(1, Math.max(0, (s.life - s.age) / s.fade));
    s.strength = Math.min(up, down);
    if (!s.held && s.age >= s.life) { s.live = false; continue; }
    any = true;
    if (n !== i) { const t = T[n]; T[n] = T[i]; T[i] = t; }
    n++;
  }
  T.count = n; T.any = any;
  return n;
}

// Put the zones in the near grid's axes (the same service placeWinds does for the wind), and take the box round
// the lot so that an asker far from every zone is turned away on two comparisons.
export function placeTimes(T, frame, bodyId) {
  if (!T.count) { T.bany = false; return false; }
  let any = false, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < T.count; i++) {
    const s = T[i];
    s.placed = s.live && s.bodyId === bodyId;
    if (!s.placed) continue;
    s.x = frame.lx(s.px, s.py, s.pz); s.z = frame.lz(s.px, s.py, s.pz);
    s.y = frame.ly ? frame.ly(s.px, s.py, s.pz) : 0;
    const r = s.radius;
    if (s.x - r < x0) x0 = s.x - r; if (s.x + r > x1) x1 = s.x + r;
    if (s.z - r < z0) z0 = s.z - r; if (s.z + r > z1) z1 = s.z + r;
    any = true;
  }
  T.bany = any; T.bx0 = x0; T.bx1 = x1; T.bz0 = z0; T.bz1 = z1;
  return any;
}

// HOW FAST THE WORLD RUNS AT (x, z) in the grid's axes: 1 where the player has done nothing. With nothing cast
// this is ONE comparison. Where bubbles overlap the slowest wins, because a stopped place inside a hastened one
// is still stopped -- the stronger hand on the world is the one that holds it.
export function timeAt(T, x, z) {
  if (!T || !T.any || !T.bany) return 1;
  if (x < T.bx0 || x > T.bx1 || z < T.bz0 || z > T.bz1) return 1;
  let k = 1;
  for (let i = 0; i < T.count; i++) {
    const s = T[i];
    if (!s.placed || !(s.strength > 0.001)) continue;
    const dx = x - s.x, dz = z - s.z, d2 = dx * dx + dz * dz, r = s.radius;
    if (d2 > r * r) continue;
    // eased back to the world's own time through the rim band, so nothing crosses a hard line and jumps
    const d = Math.sqrt(d2), inner = r * (1 - TIMEPOWER.rim);
    const m = (d <= inner ? 1 : 1 - (d - inner) / Math.max(r - inner, 1e-6)) * s.strength;
    const rate = 1 + (s.rate - 1) * (m * m * (3 - 2 * m));
    if (rate < k) k = rate;
    else if (k >= 1 && rate > k) k = rate;      // (a hastened place, where nothing is slowing it)
  }
  return k;
}

// The same question in the body's own axes, for anything that has not been through the grid (the fire asks this).
export function timeAtBody(T, px, py, pz) {
  if (!T || !T.any) return 1;
  let k = 1;
  for (let i = 0; i < T.count; i++) {
    const s = T[i];
    if (!s.live || !(s.strength > 0.001)) continue;
    const dx = px - s.px, dy = py - s.py, dz = pz - s.pz, d2 = dx * dx + dy * dy + dz * dz, r = s.radius;
    if (d2 > r * r) continue;
    const d = Math.sqrt(d2), inner = r * (1 - TIMEPOWER.rim);
    const m = (d <= inner ? 1 : 1 - (d - inner) / Math.max(r - inner, 1e-6)) * s.strength;
    const rate = 1 + (s.rate - 1) * (m * m * (3 - 2 * m));
    if (rate < k) k = rate;
    else if (k >= 1 && rate > k) k = rate;
  }
  return k;
}
