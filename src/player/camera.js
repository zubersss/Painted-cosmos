// Camera rigs. Pure (no three): each returns a pose { p, q } in the same frame as its subject,
// with q in the THREE.Camera convention (looks along local -Z, +Y up).
//
// Rule number one: the camera never goes into the ground (or under a liquid surface). The boom
// is tested against sampleSurface along its length and the camera is lifted over terrain first,
// and only pulled in when lifting is not enough.
import {
  V, add, sub, scale, addScaled, len, norm, tangent, rotateAround, cross,
  clamp, mix, damp, qLook, qSlerp, qRotate, lerp,
} from '../core/vec.js';

export const CAMERA = Object.freeze({
  fovFoot: 58,               // vertical degrees
  fovShip: 62,
  fovShipFast: 72,           // at full speed
  pitchMin: -1.15,           // rad: looking down
  pitchMax: 1.25,            // rad: looking up
  boom: 5.2,                 // metres behind the explorer (was 6.4 while the explorer was a placeholder capsule)
  boomMin: 2.2,
  boomMax: 14,
  pivotHeight: 2.05,         // the boom pivots above the head so the landscape fills the frame
  clearance: 0.45,           // metres the camera keeps above ground and liquid
  boomTight: 2.3,            // a boom squeezed shorter than this starts to slide into the eyes
  boomEye: 1.3,              // ...and at this length the view is the explorer's own (a thicket)
  firstPersonClearance: 0.25,
  feetInFrame: 0.85,         // of the half-height: the lowest the feet may sit in a third-person view
  swimLift: 0.6,             // m the view rises over a swimmer (the lens 2 m over the still water: over the chop, looking down on the stroke)
  swimEase: 1.2,             // s
  // From the seat: where the eye sits from the model's seat point (ship axes: up +Y, ahead -Z).
  // PAINTER's critique 9 asked for 0.25 m up and 0.3 m ahead ("a third of the frame is cowl"); tried
  // in M4's fix round: the cowl leaves the frame, but the canopy's hoop then crosses the upper
  // third of the glass as a thick bar (docs/shots/pilot/m4fix/cockpit-eye-tried.jpg). The eye
  // stays at the seat until the hoop is redrawn; this is the one number to set then.
  cockpitEye: Object.freeze({ x: 0, y: 0, z: 0 }),
  shipBoom: 15,              // metres behind the ship
  shipBoomFast: 21,
  shipHeight: 3.6,           // metres above the ship
  shipLag: 4.5,              // 1/s: how quickly the chase camera catches the ship's heading
  // The chase camera rides behind the ship's motion, not on the hull: a change of the hull's
  // velocity reaches the camera over shipFollow seconds and the slack it leaves is taken up over
  // shipSettle (a steady 14 m/s^2 leaves the ship 1.1 m ahead of where the lens expects it; never
  // more than shipSlack). A hop of the hull is then not a jump of the whole picture.
  shipFollow: 0.18,
  shipSettle: 0.45,
  shipSlack: 3,
  shipClearance: 1.2,
  // Crowns round a low ship (review 6: setting down in the wood, the chase camera 15 m back sat
  // inside a birch crown and leaf masses a metre from the lens jumped frame to frame). A tree's
  // crown is taken as a cylinder round its trunk from crownLow to crownTop of its height, of
  // radius crownWidth x height (at least crownMin): PAINTER's far tree, a crown 0.27 of its
  // width round from 0.30 to 1.02 of its height, is 0.24 to 0.31 of the height round on Earth.
  // Which plants carry a crown is CROWN_KITS below (by the plant's kit; a plant whose kit is not
  // known is a tree under columnRadius of footprint and a column from it up). The boom stops
  // crownMargin short of a crown or a trunk.
  shipBoomMin: 5.5,          // the shortest boom crowns may squeeze it to
  crownLow: 0.3,
  crownTop: 1.05,
  crownWidth: 0.32,
  crownMin: 2,
  columnRadius: 0.9,
  crownMargin: 1.2,
  crownIn: 4.5,              // 1/s: how quickly the boom shortens for a crown (eased in and out)...
  crownOut: 1,               // ...and how slowly it lengthens again once the way is clear
  crownLead: 1.5,            // s: the boom also looks where the lens will be this long ahead in a descent
  crownDuck: 1.5,            // m: the most the lens drops under crowns that come down to its height
  // The foot camera among trees (PHYSICS' and PAINTER's critiques, M4: on the jetpack's way up and
  // down the lens went through crowns, flat slabs over half the frame). IN THE AIR ONLY (sim.js
  // footCrowns), the boom is cut short of a crown it would pass into WHEN THAT GIVES THE LENS A
  // PLACE footLens clear of every crown and trunk no nearer the figure than footBoomMin. Where
  // there is no such place (and while the explorer's own head is in a crown) the boom is
  // footBoomMin: the figure is never taken out of the picture for a crown, and what crown is
  // between the lens and the figure is within 3.6 m of the eye, where PAINTER's crowns part
  // into dabs (and its focus window opens round the line of sight to the figure).
  // (The re-fix pass, M4: the first form of this rule ran on the ground too and, with no place for
  // the lens, drew the boom into the explorer's eyes: a walk in a wood cut in and out of first
  // person, the figure not drawn for a fifth of it, and stepping out under a birch showed no explorer.)
  footLens: 1.0,             // m the lens keeps from a crown or a trunk
  footThrough: 0.25,         // m: the boom may graze a crown this closely on its way to the lens
  footStep: 0.4,             // m: how finely the boom is looked along
  footBoomMin: 3.0,          // m: a crown never brings the boom in nearer than this (boomTight is 2.3: the figure stays whole in the frame)
  footAir: 0.35,             // s in the air and...
  footAirHeight: 2,          // ...m over the ground before the rule begins (a hop is 1.3 m and 1 s on Earth)
});

// The crown a tall plant carries, by its kit (PAINTER's src/world/florakit.js): [from, to (of its
// height), radius (of its height)], or null for a plant with none (a crystal needle, a kelp
// ribbon, a spire, a frozen wave: only the thing itself is solid). A broadleaf and a conifer:
// PAINTER's far tree, a crown 0.27 of its width round from 0.30 to 1.02 of its height. A fungal
// tower: a stalk that leans up to 0.15 of its height under a drooping cap 0.3 to 0.4 of it round.
export const CROWN_KITS = Object.freeze({
  broadleaf: Object.freeze([CAMERA.crownLow, CAMERA.crownTop, CAMERA.crownWidth]),
  conifer: Object.freeze([CAMERA.crownLow, CAMERA.crownTop, CAMERA.crownWidth]),
  fungus: Object.freeze([0.8, 1.15, 0.45]),
});
// kit: the plant's kit when it is known (a name), undefined when it is not: then a footprint under
// columnRadius is taken for a tree with a crown, as before.
export function crownShape(kit, radius, C = CAMERA) {
  if (kit == null) return radius >= C.columnRadius ? null : CROWN_KITS.broadleaf;
  return CROWN_KITS[kit] || null;
}

// Signed distance (m) from body-local `p` to the nearest tree of `crowns` ([{ base, u, h, r, c }]:
// the trunk's foot, its unit up, its height, its trunk radius, its crown (crownShape: [from, to,
// radius] of its height, null for none, undefined: by its footprint)): negative inside a crown or
// a trunk.
export function crownDistance(crowns, p, C = CAMERA) {
  let best = Infinity;
  for (const t of crowns) {
    const dx = p.x - t.base.x, dy = p.y - t.base.y, dz = p.z - t.base.z;
    const along = dx * t.u.x + dy * t.u.y + dz * t.u.z;
    const horiz = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
    const c = t.c === undefined ? crownShape(undefined, t.r, C) : t.c;
    // (a plant with no crown is solid for its whole height)
    const lo = c ? c[0] * t.h : t.h;
    let d = Infinity, a, b;
    if (c) {
      // the crown: a cylinder from lo to hi
      a = horiz - Math.max(C.crownMin, c[2] * t.h); b = Math.max(lo - along, along - c[1] * t.h);
      d = a < 0 && b < 0 ? Math.max(a, b) : Math.hypot(Math.max(a, 0), Math.max(b, 0));
    }
    // the trunk under it (or the whole column)
    a = horiz - (t.r + 0.3); b = Math.max(-along, along - lo);
    d = Math.min(d, a < 0 && b < 0 ? Math.max(a, b) : Math.hypot(Math.max(a, 0), Math.max(b, 0)));
    if (d < best) best = d;
  }
  return best;
}

// Where the chase camera's boom should be among crowns. here(b): metres from the lens at boom
// length b to the nearest crown; down(b): the same for the whole way the lens has still to come
// down (a landing to the ground, free flight the next moments) as well. The lens never travels
// through a crown to reach a length:
// - with room where it is and on its way down, it stays, or goes out while the way stays clear
//   (never while sinking in free flight, where only the next moments are looked at);
// - inside a crown, it leaves it by the shortest way, in or out;
// - clear where it is but not on the way down, it goes to the nearest length clear all the way
//   down that it can reach without passing through a crown (in when as near: the ship stands in a
//   clearing), else to the reachable length with the most room (the shorter when as good).
function shipBoomTarget(here, down, full, now, sinking, C) {
  const lo = Math.min(C.shipBoomMin, full), step = 0.75, m = C.crownMargin;
  const b0 = clamp(now, lo, full), top = sinking ? b0 : full;
  const inward = (k) => Math.max(lo, b0 - k * step), outward = (k) => Math.min(top, b0 + k * step);
  const steps = Math.ceil((full - lo) / step) + 1;
  if (down(b0) >= m * 0.5) {                      // (half the margin to stay: no flicker at an edge)
    let b = b0;
    while (b < top) { const nb = Math.min(top, b + step); if (down(nb) < m) break; b = nb; }
    return b;
  }
  if (here(b0) < 0) {
    for (let k = 1; k <= steps; k++) {
      if (here(inward(k)) >= m * 0.5) return inward(k);
      if (here(outward(k)) >= m * 0.5) return outward(k);
    }
    return lo;
  }
  let a = b0, z = b0;
  while (a > lo && here(Math.max(lo, a - step)) >= 0) a = Math.max(lo, a - step);
  while (z < top && here(Math.min(top, z + step)) >= 0) z = Math.min(top, z + step);
  for (let k = 1; k <= steps; k++) {
    const i = inward(k), o = outward(k);
    if (i >= a && down(i) >= m) return i;
    if (o <= z && down(o) >= m) return o;
  }
  let best = a, most = -Infinity;
  for (let k = 0, b = a; k <= steps; k++, b = Math.min(z, b + step)) {
    const r = down(b);
    if (r > most + 0.05) { most = r; best = b; }
    if (b >= z) break;
  }
  return best;
}

function clearanceAt(sample, p, margin) {
  // How far `p` (body-local) would have to rise to keep `margin` above ground and liquid.
  const r = len(p);
  const s = sample(scale(p, 1 / r));
  const floor = Math.max(s.radius, s.liquidRadius || 0);
  const m = margin / Math.max(0.35, Math.cos(Math.min(s.slope || 0, 1.2)));
  return floor + m - r;
}

export function createFootCamera(viewFwd, up) {
  return {
    viewFwd: tangent(viewFwd, up),   // unit tangent the camera looks along (yaw)
    pitch: -0.12,                    // rad, positive looks up
    boom: CAMERA.boom,               // wished boom length (mouse wheel)
    boomNow: CAMERA.boom,            // boom after collision, smoothed
    lift: 0,                         // extra height from terrain avoidance, smoothed
    firstPerson: false,
    tight01: 0,                      // 0 = the boom has room; 1 = squeezed into the explorer's eyes
  };
}

// Mouse look. dx, dy are radians (already scaled by sensitivity); +dx turns right, +dy looks down.
export function lookFootCamera(cam, up, dx, dy, C = CAMERA) {
  cam.viewFwd = tangent(rotateAround(cam.viewFwd, up, -dx), up, cam.viewFwd);
  cam.pitch = clamp(cam.pitch - dy, C.pitchMin, C.pitchMax);
}

// Shorten a boom (from `o` along unit `d`) so it stops in front of any obstacle sphere.
function boomThroughSpheres(o, d, boom, spheres, minBoom) {
  let out = boom;
  for (const s of spheres) {
    const ox = o.x - s.p.x, oy = o.y - s.p.y, oz = o.z - s.p.z;
    const cc = ox * ox + oy * oy + oz * oz - s.radius * s.radius;
    if (cc <= 0) continue;                           // the pivot is inside: nothing sensible to do
    const b = ox * d.x + oy * d.y + oz * d.z;
    const disc = b * b - cc;
    if (disc <= 0 || b >= 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t - 0.35 < out) out = Math.max(minBoom, t - 0.35);
  }
  return out;
}

// How long a third-person boom could be at this spot, looking along `viewFwd` at `pitch`,
// before something solid (obstacle spheres) cuts it. Used to choose where the view faces
// when the explorer steps out of the ship: never into the hull at its back.
export function boomRoom(feet, viewFwd, pitch, obstacles, C = CAMERA) {
  const up = norm(feet), f = tangent(viewFwd, up, viewFwd);
  const look = norm(add(scale(f, Math.cos(pitch)), scale(up, Math.sin(pitch))));
  return boomThroughSpheres(addScaled(feet, up, C.pivotHeight), scale(look, -1), C.boom, obstacles || [], 0);
}

// How long the foot boom should be among `crowns` ([{ base, u, h, r, c }], see crownDistance):
// from `pivot` along unit `back`, at most `boom`. The longest length whose lens is footLens clear
// of every crown and trunk and whose way there enters none, IF that is no shorter than
// footBoomMin. Where a crown leaves no such place (or the head itself is in a crown), footBoomMin:
// never nearer (the figure stays whole in the frame, never the explorer's eyes), and no further
// either, so that all of the crown between the lens and the figure is within PAINTER's 3.6 m,
// where a crown parts into dabs (render/materials.js), and none of it a solid wash over the figure.
export function footBoomAmongCrowns(pivot, back, boom, crowns, C = CAMERA) {
  if (!crowns || !crowns.length) return boom;
  const floor = Math.min(boom, C.footBoomMin);
  if (crownDistance(crowns, pivot, C) < C.footThrough) return floor;
  let best = 0;
  for (let t = C.footStep; t < boom + C.footStep; t += C.footStep) {
    const b = Math.min(t, boom), d = crownDistance(crowns, addScaled(pivot, back, b), C);
    if (d < C.footThrough) break;                 // the boom would pass into a crown or a trunk here
    if (d >= C.footLens) best = b;                // a place the lens may be
    if (b >= boom) break;
  }
  return best >= floor ? best : floor;
}

// feet: explorer position (body-local). obstacles: [{ p, radius }] spheres the camera must not
// enter (the ship's hull). Returns { p, q, fov, look } and updates the smoothing.
// crowns: the trees the boom is cut short of (footBoomAmongCrowns), or null (on the ground).
export function updateFootCamera(cam, feet, dt, sample, C = CAMERA, obstacles = null, crowns = null) {
  const up = norm(feet);
  cam.viewFwd = tangent(cam.viewFwd, up, cam.viewFwd);        // carry the yaw along the sphere
  const f = cam.viewFwd;
  const look = norm(add(scale(f, Math.cos(cam.pitch)), scale(up, Math.sin(cam.pitch))));

  if (cam.firstPerson) {
    cam.tight01 = 0;
    let p = add(addScaled(feet, up, 1.62), scale(f, 0.1));
    const need = clearanceAt(sample, p, C.firstPersonClearance);
    if (need > 0) p = addScaled(p, norm(p), need);
    return { p, q: qLook(look, up), fov: C.fovFoot, look };
  }

  const pivot = addScaled(feet, up, C.pivotHeight);
  const back = scale(look, -1);
  // Walk the boom outward; find the lift that keeps every point of it clear of the terrain.
  const N = 5;
  let lift = 0, boom = cam.boom;
  if (obstacles) boom = boomThroughSpheres(pivot, back, boom, obstacles, 0.8);
  if (crowns) boom = footBoomAmongCrowns(pivot, back, boom, crowns, C);
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const q = addScaled(pivot, back, boom * t);
    const need = clearanceAt(sample, q, C.clearance);
    if (need > 0) lift = Math.max(lift, need / t);
  }
  // Lifting more than the boom is long looks wrong: pull in instead.
  const maxLift = cam.boom * 0.9 + 1;
  if (lift > maxLift) {
    boom = Math.min(boom, Math.max(C.boomMin, cam.boom * (maxLift / lift)));
    lift = maxLift;
  }
  // Move toward the obstacle-free pose quickly when blocked, slowly when the way clears.
  cam.lift = lift > cam.lift ? mix(cam.lift, lift, damp(30, dt)) : mix(cam.lift, lift, damp(3, dt));
  cam.boomNow = boom < cam.boomNow ? mix(cam.boomNow, boom, damp(30, dt)) : mix(cam.boomNow, boom, damp(3, dt));

  let p = addScaled(addScaled(pivot, back, cam.boomNow), up, cam.lift);
  // Hard guarantee after smoothing.
  const need = clearanceAt(sample, p, C.clearance);
  if (need > 0) { p = addScaled(p, norm(p), need); cam.lift += need; }

  // Aim at a point ahead of the pivot so the explorer stays in the lower third of the frame.
  const aim = add(pivot, scale(look, 9));
  let dir = norm(sub(aim, p), look);
  // However high the boom had to lift (a rise at the explorer's back), the explorer stays in the
  // frame: the feet no further from the middle of the view than C.feetInFrame of its half-height
  // (on level ground they sit at about 0.7 of it and nothing changes). Review 6: at a stand under a
  // rise the lifted camera kept aiming 9 m ahead and showed only the top of the hat.
  const toFeet = norm(sub(addScaled(feet, up, 0.05), p), dir);
  const off = Math.acos(clamp(dir.x * toFeet.x + dir.y * toFeet.y + dir.z * toFeet.z, -1, 1));
  const most = (C.fovFoot * Math.PI) / 360 * C.feetInFrame;
  if (off > most) {
    const ax = norm(cross(dir, toFeet), up);
    dir = rotateAround(dir, ax, off - most);
  }

  // A thicket (trunks, crystals, a hull at the explorer's back): a boom squeezed to a metre or
  // two frames the back of a head and nothing else. Rather than that, the view slides forward
  // into the explorer's own eyes while the boom is short, and back out when there is room.
  // (Only things in the way squeeze the boom this far; the player's own wheel stops at boomMin.)
  const tight = clamp((C.boomTight - cam.boomNow) / (C.boomTight - C.boomEye), 0, 1);
  const want = tight * tight * (3 - 2 * tight);
  // Its own ease in time (a third of a second): the boom itself snaps in within a few frames.
  cam.tight01 = mix(cam.tight01 || 0, want, damp(want > cam.tight01 ? 9 : 5, dt));
  if (Math.abs(cam.tight01 - want) < 0.003) cam.tight01 = want;
  if (cam.tight01 > 0) {
    let eye = add(addScaled(feet, up, 1.62), scale(f, 0.1));
    const lift1 = clearanceAt(sample, eye, C.firstPersonClearance);
    if (lift1 > 0) eye = addScaled(eye, norm(eye), lift1);
    p = lerp(p, eye, cam.tight01);
    dir = norm(lerp(dir, look, cam.tight01), look);
  }
  return { p, q: qLook(dir, norm(p)), fov: C.fovFoot, look: dir };
}

// ---- ship chase camera -----------------------------------------------------------------
export function createShipCamera() {
  // short: metres the boom is held in by crowns, eased (null: take the room at once, as on boarding)
  return { q: null, cockpit: false, lift: 0, short: 0 };
}

// ship: { p, q } in its flight frame. opts: { upRef (unit, frame space, or null in deep space),
// level01 (how strongly the camera keeps its horizon), speed01, seat (ship-local eye point),
// sample (body-local sampler or null), toLocal (frame position -> body-local position or null),
// solid (body-local point -> signed metres to the nearest crown, or null: see crownDistance),
// descent (metres a landing still has to come down, or null) }
export function updateShipCamera(cam, ship, dt, opts, C = CAMERA) {
  const fwd = qRotate(ship.q, V(0, 0, -1));
  const shipUp = qRotate(ship.q, V(0, 1, 0));
  const fov = mix(C.fovShip, C.fovShipFast, opts.speed01 || 0);

  if (cam.cockpit) {
    const seat = opts.seat || V(0, 2.2, -1.2), e = C.cockpitEye;
    cam.q = ship.q;
    return { p: add(ship.p, qRotate(ship.q, V(seat.x + e.x, seat.y + e.y, seat.z + e.z))), q: ship.q, fov, look: fwd };
  }

  // The camera's own up: the planet's up near a planet (the horizon stays level while the ship
  // banks), easing toward the ship's up in open space.
  let up = shipUp;
  if (opts.upRef) up = norm(lerp(shipUp, opts.upRef, opts.level01 == null ? 1 : opts.level01), shipUp);
  const want = qLook(fwd, up);
  cam.q = cam.q ? qSlerp(cam.q, want, damp(C.shipLag, dt)) : want;

  const back = qRotate(cam.q, V(0, 0, 1));
  const camUp = qRotate(cam.q, V(0, 1, 0));
  const full = mix(C.shipBoom, C.shipBoomFast, opts.speed01 || 0);
  // Crowns: the boom comes in, eased, to keep the lens out of every crown, now and all the way
  // down while the ship comes down (opts.descent: the metres a landing still has to go; in free
  // flight the sink of the next crownLead seconds), and goes back out slowly while the way is
  // clear. With no crowns about nothing changes.
  let room = full, inCrown = false, duck = 0;
  if (opts.solid && opts.toLocal) {
    const base = add(ship.p, scale(camUp, C.shipHeight + cam.lift));
    const sink = opts.upRef && ship.v ? -(ship.v.x * opts.upRef.x + ship.v.y * opts.upRef.y + ship.v.z * opts.upRef.z) : 0;
    const drop = opts.descent != null ? Math.max(0, opts.descent) : sink > 0.05 ? Math.min(8, sink * C.crownLead) : 0;
    const solidAt = (q) => opts.solid(opts.toLocal(q));
    const here = (b, dh = 0) => solidAt(addScaled(addScaled(base, back, b), camUp, -dh));
    const at = (b, dh = 0) => {
      const q = addScaled(base, back, b), d = drop + dh;
      let r = solidAt(dh ? addScaled(q, camUp, -dh) : q);
      for (let h = 2.5; r > -1 && h < d + 2.5; h += 2.5) r = Math.min(r, solidAt(addScaled(q, camUp, -Math.min(h, d))));
      return r;
    };
    const lo = Math.min(C.shipBoomMin, full);
    const now = clamp(cam.short == null ? full : full - cam.short, lo, full);
    // (a landing's whole way down is looked at, so a clear length is clear to the ground; in free
    // flight only the next moments are, and a sinking lens only comes in)
    room = shipBoomTarget((b) => here(b, cam.duck || 0), (b) => at(b, cam.duck || 0), full, now, drop > 0.5 && opts.descent == null, C);
    // Under the crowns: where the lens has no room at its length (crowns that overhang the
    // clearing come down to its height), it ducks under them, by up to crownDuck.
    if (at(room, cam.duck || 0) < C.crownMargin) {
      let most = -Infinity;
      for (let dh = 0; dh <= C.crownDuck + 1e-6; dh += C.crownDuck / 3) { const r = at(room, dh); if (r > most + 0.05) { most = r; duck = dh; } }
    }
    inCrown = here(now, cam.duck || 0) < 0;
  }
  const held = full - room;
  cam.room = room;
  // A critically damped follow (it eases in and out: the camera's speed never jumps); quick
  // whenever the lens is in a crown or must come in, slow going back out through clear air.
  const follow = (x, xv, target, w) => {
    const n = Math.max(1, Math.ceil(dt * 30)), h = dt / n;
    for (let i = 0; i < n; i++) { xv += (w * w * (target - x) - 2 * w * xv) * h; x += xv * h; }
    return [x, xv];
  };
  if (cam.short == null) { cam.short = held; cam.shortV = 0; cam.duck = duck; cam.duckV = 0; }
  else {
    if (held > 0 || cam.short > 0) {
      [cam.short, cam.shortV] = follow(cam.short, cam.shortV || 0, held, held > cam.short || inCrown ? C.crownIn : C.crownOut);
      if (cam.short <= 1e-3 && held === 0) { cam.short = 0; cam.shortV = 0; }
    }
    if (duck > 0 || cam.duck > 0) {
      [cam.duck, cam.duckV] = follow(cam.duck || 0, cam.duckV || 0, duck, duck > cam.duck || inCrown ? C.crownIn : C.crownOut);
      if (cam.duck <= 1e-3 && duck === 0) { cam.duck = 0; cam.duckV = 0; }
    }
  }
  cam.short = clamp(cam.short, 0, Math.max(0, full - C.shipBoomMin));
  cam.duck = clamp(cam.duck || 0, 0, C.crownDuck);
  const boom = full - cam.short, height = C.shipHeight - cam.duck;
  // Where the boom hangs from: the ship, less the slack its changes of velocity have left (only
  // in a body's ground frame, where the velocity is continuous; the look stays on the ship).
  let hang = ship.p;
  if (opts.sample && ship.v && dt > 0) {
    const F = cam.follow || (cam.follow = { v: { ...ship.v }, e: V() });
    F.v = lerp(F.v, ship.v, damp(1 / C.shipFollow, dt));
    const keep = Math.exp(-dt / C.shipSettle);
    F.e = add(scale(F.e, keep), scale(sub(F.v, ship.v), dt));
    const l = len(F.e);
    if (l > C.shipSlack) F.e = scale(F.e, C.shipSlack / l);
    hang = add(ship.p, F.e);
  } else if (!opts.sample || !ship.v) cam.follow = null;
  else if (cam.follow) hang = add(ship.p, cam.follow.e);
  let p = add(add(hang, scale(back, boom)), scale(camUp, height + cam.lift));

  if (opts.sample && opts.toLocal) {
    // Keep the chase camera above the terrain (only meaningful in the ground frame).
    const local = opts.toLocal(p);
    const need = clearanceAt(opts.sample, local, C.shipClearance);
    const lift = Math.max(0, cam.lift + need);
    cam.lift = lift > cam.lift ? mix(cam.lift, lift, damp(25, dt)) : mix(cam.lift, lift, damp(2, dt));
    p = add(add(hang, scale(back, boom)), scale(camUp, height + cam.lift));
    const need2 = clearanceAt(opts.sample, opts.toLocal(p), C.shipClearance);
    if (need2 > 0) { p = addScaled(p, norm(opts.upRef || camUp), need2); }
  } else cam.lift = mix(cam.lift, 0, damp(2, dt));

  // Look a little ahead of the ship so it sits low in the frame.
  const aim = add(add(ship.p, scale(fwd, 30)), scale(camUp, 2));
  const dir = norm(sub(aim, p), fwd);
  return { p, q: qLook(dir, camUp), fov, look: dir };
}

// Blend two poses (boarding and stepping out). t in 0..1, eased by the caller.
export function blendPose(a, b, t) {
  return { p: lerp(a.p, b.p, t), q: qSlerp(a.q, b.q, t), fov: mix(a.fov, b.fov, t) };
}
