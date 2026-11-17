// Painted Cosmos physics: the wind the explorer makes (the elemental powers, wind; docs/POWERS.md).
// OWNER: PHYSICS. Pure (no three, no DOM).
//
// The player's wind is a short list of plain shapes of moving air, at most WINDPOWER.max at once:
//   a JET     a gust: a pulse of wind that leaves the explorer and runs out along the aim, widening and fading
//   a ZONE    wind control: a round place where the wind that is there is quickened, or stilled to a dead calm
//   an ORB    gather and carry: air drawn in to one point and turned round it, which holds what is loose in a ball
//   a VORTEX  a tornado: handed to the game as one more dust devil (features.js), so that all that answers a dust
//             devil answers it
//   a PART    move water: a wall of wind held along a line, under which the water is parted (the painter presses its
//             face down there; the explorer's ground has no water there: partedAt)
// It is given to the systems that already take the dust devils' wind in the same way: the air at a point (air.js
// airAt), the plants' field (flora.js) and the loose things (loose.js). Each of them asks powerWind() for what the
// list adds at a point, exactly, as it asks devilWind(): nothing is put on the wind grid, whose nodes are 16 m apart.
// With no list, or an empty one, each of them makes one comparison and nothing else.
//
// A source lives in the body's own coordinates (the near fields' frame moves with the focus and re-anchors); the
// physics places the list in its frame once a frame (placeWinds), and whoever owns the list ages it (stepWinds).
import { smoothstep } from './util.js';

export const KIND = Object.freeze({ jet: 1, zone: 2, orb: 3, vortex: 4, part: 5 });

export const WINDPOWER = Object.freeze({
  max: 6,                 // sources alive at once (a new one takes the oldest's place)
  // the gust
  gustSpeed: 24,          // m/s in the middle of the pulse as it leaves the hands (a strong gale; a walker's lean is 15)
  gustFront: 26,          // m/s: how fast the pulse runs out
  gustReach: 34,          // m: where the pulse is spent
  gustPulse: 7,           // m: the length of the pulse behind its front (the wind falls to a third over this)
  gustRadius: 1.3,        // m: half its width at the hands ...
  gustSpread: 0.16,       // ... growing by this for each metre run (5.4 m to each side at the end)
  gustLife: 2.4,          // s: after this the air is as it was
  gustLift: 0.24,         // the share of the pulse's speed that blows upward at the ground (what lifts leaves and dust)
  gustCurl: 0.9, gustAxis: 1.2,   // the gust turns about its own line: the turning's share of the pulse's speed one width out, and the line's height (m)
  gustHeight: 2.6,        // m: full strength up to here (growing a little with the distance), fading above
  // wind control
  zoneRadius: 14,         // m
  zoneHeight: 14,         // m: a column this tall, fading above
  zoneLife: 22,           // s
  zoneFade: 2.5,          // s: it comes and goes over this
  quickenGain: 2.3,       // the wind there, times this ...
  quickenPush: 6,         // ... and this much more along the aim, m/s (so that a still day has a wind to quicken)
  // gather and carry
  orbRadius: 9,           // m: loose things within this of the ball are drawn to it
  orbCore: 1.1,           // m: the ball itself
  orbIn: 9,               // m/s: the draw toward it at its strongest (some two core radii out)
  orbSwirl: 7,            // m/s round it at the core's edge
  orbHeight: 1.5,         // m above the ground: where the ball is held
  // the tornado (a devil's numbers, features.js DEVILS, scaled up)
  vortexRadius: 2.6,      // m: the core
  vortexSpeed: 17,        // m/s at the core's edge
  vortexUp: 7,            // m/s in the core
  vortexHeight: 22,       // m
  vortexLife: 16,         // s
  vortexFade: 2.2,        // s
  // move water: the parted channel
  partHalf: 1.7,          // m: half its width
  partReach: 14,          // m: its full length
  partBack: 1.5,          // m: it begins this far behind the explorer
  partOpen: 16,           // m/s: how fast it runs out when held ...
  partClose: 9,           // ... and closes again, from the far end inward, when let go
  partWind: 8,            // m/s along it
  partSpray: 130,         // drops a second thrown off the water along its two walls (loose.js)
  wispPart: 50,           // strokes of air a second along it
  // what a source lifts off the ground under it (loose.js), in grains a second at full strength
  // (2026-11-17, the owner: "fly leaves around and dust around when i use it". Three times what it was, and a gust
  // raises a puff of dust off any ground, not only dry ground.)
  liftGust: 420, liftOrb: 180, liftVortex: 260,
  // LEAVES TORN FROM THE CROWNS the wind goes through, in leaves a second at full strength (loose.js _tear): the wood's
  // own leaves, thrown with the wind at the height they grew at. Nothing where there is no canopy.
  tearGust: 260, tearOrb: 90, tearVortex: 220, tearPart: 0,
  // A BRANCH SNAPS (the owner: "some branches should snap and fall off"). snapChance: the share of the crowns a cast
  // goes through that lose one; snapMax: how many a single cast can break; snapPieces: the pieces one branch falls as;
  // snapLeaves: the leaves that come down with it.
  snapChance: 0.5, snapMax: 2, snapVortex: 5, snapPieces: 3, snapLeaves: 26,
  // THE AIR MADE VISIBLE: pale strokes that ride each source (loose.js: grains of the leaf kind in the colours of snow
  // and ice, short-lived), strokes a second at full strength. Without them a gust over turf or rock moved nothing
  // that could be seen: the first stills of the powers.
  // (2026-11-17, after the wood's own leaves and dust began to fly: a third fewer strokes of air, so what the wind
  // carries leads and the air is the thing between. Over bare rock, where nothing is loose, they are still all there is.)
  wispGust: 115, wispOrb: 150, wispVortex: 165, wispZone: 70,
  wispHush: 90, hushTime: 1.2,   // a stilled place: strokes a second round its rim while it falls still, and for how long (s)
});

function blank() {
  return { kind: 0, bodyId: null, px: 0, py: 0, pz: 0, dx: 0, dy: 0, dz: 0, age: 0, life: 0, fade: 0, strength: 0,
    speed: 0, radius: 0, reach: 0, spread: 0, front: 0, pulse: 0, height: 0, gain: 1, push: 0, up: 0, spin: 1, held: false,
    x: 0, z: 0, de: 0, dn: 1, y: 0, placed: false, carry: 0, curl: 0, axis: 0, len: 0, snap: 0, tear: 0 };
}

// The list. `count` sources are alive, in slots 0 .. count - 1.
export function makeWinds() {
  const S = [];
  for (let i = 0; i < WINDPOWER.max; i++) S.push(blank());
  S.count = 0;
  return S;
}

function take(S, kind, bodyId, p, d) {
  let s;
  if (S.count < WINDPOWER.max) s = S[S.count++];
  else {
    // the oldest gives way (never one that is being held)
    let k = -1, a = -1;
    for (let i = 0; i < S.count; i++) if (!S[i].held && S[i].age > a) { a = S[i].age; k = i; }
    if (k < 0) k = 0;
    s = S[k];
  }
  Object.assign(s, blank());
  s.kind = kind; s.bodyId = bodyId;
  s.px = p.x; s.py = p.y; s.pz = p.z;
  // the aim, level: what of it lies along the ground at that place
  const r = Math.hypot(p.x, p.y, p.z) || 1, ux = p.x / r, uy = p.y / r, uz = p.z / r;
  let ax = d ? d.x : 0, ay = d ? d.y : 0, az = d ? d.z : 0;
  const k = ax * ux + ay * uy + az * uz; ax -= ux * k; ay -= uy * k; az -= uz * k;
  const l = Math.hypot(ax, ay, az);
  if (l > 1e-6) { s.dx = ax / l; s.dy = ay / l; s.dz = az / l; }
  return s;
}

// A gust from p (body-local, at the hands) along d (body-local, any length). power 0..1 scales its speed.
export function castGust(S, bodyId, p, d, power = 1) {
  const s = take(S, KIND.jet, bodyId, p, d), W = WINDPOWER;
  s.life = W.gustLife; s.speed = W.gustSpeed * power; s.front = W.gustFront; s.reach = W.gustReach; s.pulse = W.gustPulse;
  s.radius = W.gustRadius; s.spread = W.gustSpread; s.height = W.gustHeight; s.up = W.gustLift; s.strength = 1;
  s.curl = W.gustCurl; s.axis = W.gustAxis; s.snap = W.snapMax * power;
  return s;
}
// Wind control at p (on the ground): mode 'calm' stills the wind there, 'quicken' speeds it (and adds some along d).
export function castZone(S, bodyId, p, d, mode) {
  const s = take(S, KIND.zone, bodyId, p, d), W = WINDPOWER;
  s.life = W.zoneLife; s.fade = W.zoneFade; s.radius = W.zoneRadius; s.height = W.zoneHeight;
  if (mode === 'calm') { s.gain = 0; s.push = 0; } else { s.gain = W.quickenGain; s.push = W.quickenPush; }
  return s;
}
// Gather: a ball of turning air at p (held until released). Move it with moveWind(); end it with releaseWind().
export function castOrb(S, bodyId, p) {
  const s = take(S, KIND.orb, bodyId, p, null), W = WINDPOWER;
  s.life = 1e9; s.fade = 0.5; s.held = true; s.radius = W.orbRadius; s.speed = W.orbIn; s.height = W.orbHeight;
  return s;
}
// A tornado at p (on the ground).
export function castVortex(S, bodyId, p, spin = 1) {
  const s = take(S, KIND.vortex, bodyId, p, null), W = WINDPOWER;
  s.life = W.vortexLife; s.fade = W.vortexFade; s.radius = W.vortexRadius; s.speed = W.vortexSpeed; s.up = W.vortexUp;
  s.height = W.vortexHeight; s.spin = spin < 0 ? -1 : 1; s.snap = W.snapVortex;
  return s;
}
// Move water: a channel that begins at p (on the water or the ground, body-local) and runs along d; held until released.
// While held it runs out to its full length; let go, it closes from the far end inward and is gone (stepWinds).
export function castPart(S, bodyId, p, d) {
  const s = take(S, KIND.part, bodyId, p, d), W = WINDPOWER;
  s.life = 1e9; s.held = true; s.radius = W.partHalf; s.reach = W.partReach; s.speed = W.partWind; s.len = 0; s.strength = 1;
  return s;
}
export function moveWind(s, p) { s.px = p.x; s.py = p.y; s.pz = p.z; }
// Turns a source to lie along d (levelled at its own place).
export function turnWind(s, d) {
  const r = Math.hypot(s.px, s.py, s.pz) || 1, ux = s.px / r, uy = s.py / r, uz = s.pz / r;
  const k = d.x * ux + d.y * uy + d.z * uz, ax = d.x - ux * k, ay = d.y - uy * k, az = d.z - uz * k, l = Math.hypot(ax, ay, az);
  if (l > 1e-6) { s.dx = ax / l; s.dy = ay / l; s.dz = az / l; }
}
// Is the water parted at (x, y, z) (body-local)? 0: no .. 1: wholly (the channel's floor; its walls are in between).
// The painter presses the water's face down by the same shape (render/materials.js WATER_VERT, PC_POWERS).
export function partedAt(S, bodyId, x, y, z) {
  let m = 0;
  for (let i = 0; i < S.count; i++) {
    const s = S[i];
    if (s.kind !== KIND.part || s.bodyId !== bodyId || !(s.len > 0)) continue;
    const rx = x - s.px, ry = y - s.py, rz = z - s.pz, a = rx * s.dx + ry * s.dy + rz * s.dz;
    if (a < -1.2 || a > s.len) continue;
    let cx = rx - s.dx * a, cy = ry - s.dy * a, cz = rz - s.dz * a;
    const r = Math.hypot(s.px, s.py, s.pz) || 1, ux = s.px / r, uy = s.py / r, uz = s.pz / r, k = cx * ux + cy * uy + cz * uz;
    cx -= ux * k; cy -= uy * k; cz -= uz * k;
    const c = Math.hypot(cx, cy, cz), v = partShape(a, c, s.len, s.radius);
    if (v > m) m = v;
  }
  return m;
}
// The channel's shape: a metres along it, c metres to its side, its length now and its half width. 1 on its floor.
// (The same lines, in GLSL, are in WATER_VERT.)
export function partShape(a, c, len, half) {
  return (1 - smoothstep(half - 0.5, half, c)) * smoothstep(-1.2, 0, a) * (1 - smoothstep(len - 1.5, len, a));
}
// A held source is let go: it fades out over its fade time.
export function releaseWind(s) { if (s && s.held) { s.held = false; if (s.kind !== KIND.part) s.life = s.age + s.fade; } }   // (a part closes by its length: stepWinds)

// Ages the list by dt and drops what is over. Each source's `strength` (0..1) is its coming and going.
export function stepWinds(S, dt) {
  let n = 0;
  for (let i = 0; i < S.count; i++) {
    const s = S[i];
    s.age += dt;
    if (!(s.age < s.life)) continue;
    if (s.kind === KIND.part) {
      s.len = s.held ? Math.min(s.reach, s.len + WINDPOWER.partOpen * dt) : s.len - WINDPOWER.partClose * dt;
      if (!(s.len > 0)) continue;
      s.strength = 1;
    } else
    if (s.kind === KIND.jet) s.strength = 1 - smoothstep(s.life * 0.6, s.life, s.age);
    else s.strength = (s.fade > 0 ? smoothstep(0, s.fade, s.age) : 1) * (s.held ? 1 : 1 - smoothstep(s.life - s.fade, s.life, s.age));
    if (n !== i) { const t = S[n]; S[n] = s; S[i] = t; }
    n++;
  }
  S.count = n;
  return n;
}

// Puts the list in the near fields' frame (grid x, z in metres; the aim as east, north): once a frame, by the
// physics. A source on another body, or too far to matter, is marked not placed and adds nothing.
export function placeWinds(S, frame, bodyId) {
  let any = false;
  for (let i = 0; i < S.count; i++) {
    const s = S[i];
    s.placed = s.bodyId === bodyId && frame.bodyId === bodyId;
    if (!s.placed) continue;
    s.x = frame.lx(s.px, s.py, s.pz); s.z = frame.lz(s.px, s.py, s.pz);
    s.y = Math.hypot(s.px, s.py, s.pz) - frame.r0;
    s.de = s.dx * frame.ex + s.dy * frame.ey + s.dz * frame.ez; s.dn = s.dx * frame.nx + s.dy * frame.ny + s.dz * frame.nz;
    if (Math.abs(s.x) > 400 || Math.abs(s.z) > 400) { s.placed = false; continue; }
    any = true;
  }
  return any;
}

// What the list does to the air at grid (x, z), hz metres above the ground.
//   o[0], o[1], o[2]: wind added, east, north, up (m/s);   o[3]: what the wind that is there is multiplied by first
//   (1: left alone; 0: a dead calm).   minR: the least half-width a source is taken to have (a field whose nodes lie
//   far apart passes about its spacing, so that a narrow gust is not lost between two nodes).
// Returns true when anything was added or changed. The vortices are not in here: they go as dust devils (windsToDevils).
export function powerWind(S, x, z, hz, o, minR = 0) {
  o[0] = 0; o[1] = 0; o[2] = 0; o[3] = 1;
  let any = false;
  for (let i = 0; i < S.count; i++) {
    const s = S[i];
    if (!s.placed || !(s.strength > 0)) continue;
    const rx = x - s.x, rz = z - s.z;
    if (s.kind === KIND.jet) {
      const a = rx * s.de + rz * s.dn;                       // along the aim
      if (a < -3 || a > s.reach + 4) continue;
      const c = rz * s.de - rx * s.dn;                       // across it
      let w = s.radius + s.spread * (a > 0 ? a : 0); if (w < minR) w = minR;
      const cw = c / w;
      if (cw > 2.4 || cw < -2.4) continue;
      const top = s.height + 0.08 * (a > 0 ? a : 0), dh = hz > top ? (hz - top) * 0.5 : 0;
      const side = Math.exp(-cw * cw - dh * dh);
      let U;
      if (a < 0) U = 0.22 * Math.exp(a / 1.5) * (1 - smoothstep(0.3, 0.9, s.age));      // the draught at the hands as it leaves
      else {
        const f = Math.min(s.front * s.age, s.reach), u = f - a;           // how far behind the pulse's front
        const e = u < 0 ? Math.exp(u * 1.5) : Math.exp(-u / s.pulse);
        U = e / (1 + 1.2 * a / s.reach) * (1 - smoothstep(s.reach * 0.75, s.reach + 4, a));
      }
      U *= s.speed * side * s.strength;
      if (U < 0.05) continue;
      // along the aim, fanning out a little to the sides, and upward at the ground
      const fan = 0.22 * cw;
      o[0] += U * (s.de - s.dn * fan); o[1] += U * (s.dn + s.de * fan);
      o[2] += U * s.up * (hz < 3 ? 1 - hz / 3 : 0);
      // and curled round its own line: the air turns about the gust's axis as it goes (seen from behind, a blast is
      // strokes wheeling round the aim; without the curl it is dots flying away)
      if (s.curl > 0) { const t = U * s.curl, hy = (hz - s.axis) / w; o[0] += t * hy * s.dn; o[1] -= t * hy * s.de; o[2] += t * cw; }
      any = true;
    } else if (s.kind === KIND.part) {
      // a steady wind along the channel, between its walls
      const a = rx * s.de + rz * s.dn;
      if (a < -1.2 || a > s.len + 1) continue;
      const c = rz * s.de - rx * s.dn;
      let w = s.radius; if (w < minR) w = minR;
      const cw = c / w;
      if (cw > 2 || cw < -2 || hz > 6) continue;
      const U = s.speed * Math.exp(-cw * cw) * smoothstep(-1.2, 0, a) * (1 - smoothstep(s.len - 1.5, s.len + 1, a)) * (hz > 3 ? 1 - (hz - 3) / 3 : 1);
      if (U < 0.05) continue;
      o[0] += U * s.de; o[1] += U * s.dn;
      any = true;
    } else if (s.kind === KIND.zone) {
      let R = s.radius; if (R < minR) R = minR;
      const r = Math.sqrt(rx * rx + rz * rz);
      if (r > R || hz > s.height * 1.5) continue;
      const m = (1 - smoothstep(R * 0.7, R, r)) * (1 - smoothstep(s.height, s.height * 1.5, hz)) * s.strength;
      o[3] *= 1 + (s.gain - 1) * m;
      o[0] += s.push * m * s.de; o[1] += s.push * m * s.dn;
      any = true;
    } else if (s.kind === KIND.orb) {
      const r = Math.sqrt(rx * rx + rz * rz);
      if (r > s.radius + minR) continue;
      const W = WINDPOWER, rc = W.orbCore, ir = r > 1e-3 ? 1 / r : 0, k = s.strength;
      // drawn in from all round (strongest two core radii out, nothing at the middle or at the rim), turned round
      // the ball, and held at its height: up under it, down over it
      // (and not inside the core: there the air only turns, so what is drawn in goes round the ball at its core's
      // radius and is not packed into a knot at its middle)
      const g = (r / (2 * rc)) * Math.exp(1 - r / (2 * rc)) * (1 - smoothstep(s.radius * 0.6, s.radius + minR, r)) * smoothstep(0.7 * rc, 1.7 * rc, r);
      const sw = (r < rc ? r / rc : rc / r) * W.orbSwirl, dy = s.height - hz;
      o[0] += (-rx * ir * s.speed * g - rz * ir * sw) * k; o[1] += (-rz * ir * s.speed * g + rx * ir * sw) * k;
      o[2] += (dy > 2 ? 2 : dy < -2 ? -2 : dy) * 2.6 * (1 - smoothstep(rc * 1.5, rc * 5, r)) * k;
      any = true;
    }
  }
  return any;
}

// The vortices, as dust devils: appended to the game's own list (features.js devilsNear fills it first each frame).
// The record is a devil's: { x, z (grid), radius, speed, up, spin, strength, height }.
export function windsToDevils(S, devils) {
  for (let i = 0; i < S.count; i++) {
    const s = S[i];
    if (s.kind !== KIND.vortex || !s.placed || !(s.strength > 0)) continue;
    // (a whole record, as features.js makeDevil makes it: the game's own devils take these slots again in a later frame
    // and write into every field. A bare {} here broke the physics the first time a real dust devil came by after a
    // whirl: found on a page with real touch events, 2026-11-17; powers.test.mjs holds it.)
    const D = devils[devils.count] || (devils[devils.count] = { x: 0, z: 0, p: { x: 0, y: 0, z: 0 }, radius: 0, height: 0, speed: 0, up: 0, spin: 1, strength: 0, age: 0, life: 0, id: 0 });
    D.x = s.x; D.z = s.z; D.radius = s.radius; D.speed = s.speed; D.up = s.up; D.spin = s.spin; D.strength = s.strength; D.height = s.height;
    D.p.x = s.px; D.p.y = s.py; D.p.z = s.pz; D.age = s.age; D.life = s.life; D.id = 0x70770000 + i;
    devils.count++;
  }
}
