// Camera rigs. Pure (no three): each returns a pose { p, q } in the same frame as its subject,
// with q in the THREE.Camera convention (looks along local -Z, +Y up).
//
// Rule number one: the camera never goes into the ground (or under a liquid surface). The boom
// is tested against sampleSurface along its length and the camera is lifted over terrain first,
// and only pulled in when lifting is not enough.
import {
  V, add, sub, scale, addScaled, len, norm, tangent, rotateAround,
  clamp, mix, damp, qLook, qSlerp, qRotate, lerp,
} from '../core/vec.js';

export const CAMERA = Object.freeze({
  fovFoot: 58,               // vertical degrees
  fovShip: 62,
  fovShipFast: 72,           // at full speed
  pitchMin: -1.15,           // rad: looking down
  pitchMax: 1.25,            // rad: looking up
  boom: 6.4,                 // metres behind the explorer (longer while the explorer is a placeholder)
  boomMin: 2.2,
  boomMax: 14,
  pivotHeight: 2.05,         // the boom pivots above the head so the landscape fills the frame
  clearance: 0.45,           // metres the camera keeps above ground and liquid
  boomTight: 2.3,            // a boom squeezed shorter than this starts to slide into the eyes
  boomEye: 1.3,              // ...and at this length the view is the explorer's own (a thicket)
  firstPersonClearance: 0.25,
  shipBoom: 15,              // metres behind the ship
  shipBoomFast: 21,
  shipHeight: 3.6,           // metres above the ship
  shipLag: 4.5,              // 1/s: how quickly the chase camera catches the ship's heading
  shipClearance: 1.2,
});

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

// feet: explorer position (body-local). obstacles: [{ p, radius }] spheres the camera must not
// enter (the ship's hull). Returns { p, q, fov, look } and updates the smoothing.
export function updateFootCamera(cam, feet, dt, sample, C = CAMERA, obstacles = null) {
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
  return { q: null, cockpit: false, lift: 0 };
}

// ship: { p, q } in its flight frame. opts: { upRef (unit, frame space, or null in deep space),
// level01 (how strongly the camera keeps its horizon), speed01, seat (ship-local eye point),
// sample (body-local sampler or null), toLocal (frame position -> body-local position or null) }
export function updateShipCamera(cam, ship, dt, opts, C = CAMERA) {
  const fwd = qRotate(ship.q, V(0, 0, -1));
  const shipUp = qRotate(ship.q, V(0, 1, 0));
  const fov = mix(C.fovShip, C.fovShipFast, opts.speed01 || 0);

  if (cam.cockpit) {
    const seat = opts.seat || V(0, 2.2, -1.2);
    cam.q = ship.q;
    return { p: add(ship.p, qRotate(ship.q, seat)), q: ship.q, fov, look: fwd };
  }

  // The camera's own up: the planet's up near a planet (the horizon stays level while the ship
  // banks), easing toward the ship's up in open space.
  let up = shipUp;
  if (opts.upRef) up = norm(lerp(shipUp, opts.upRef, opts.level01 == null ? 1 : opts.level01), shipUp);
  const want = qLook(fwd, up);
  cam.q = cam.q ? qSlerp(cam.q, want, damp(C.shipLag, dt)) : want;

  const back = qRotate(cam.q, V(0, 0, 1));
  const camUp = qRotate(cam.q, V(0, 1, 0));
  const boom = mix(C.shipBoom, C.shipBoomFast, opts.speed01 || 0);
  let p = add(add(ship.p, scale(back, boom)), scale(camUp, C.shipHeight + cam.lift));

  if (opts.sample && opts.toLocal) {
    // Keep the chase camera above the terrain (only meaningful in the ground frame).
    const local = opts.toLocal(p);
    const need = clearanceAt(opts.sample, local, C.shipClearance);
    const lift = Math.max(0, cam.lift + need);
    cam.lift = lift > cam.lift ? mix(cam.lift, lift, damp(25, dt)) : mix(cam.lift, lift, damp(2, dt));
    p = add(add(ship.p, scale(back, boom)), scale(camUp, C.shipHeight + cam.lift));
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
