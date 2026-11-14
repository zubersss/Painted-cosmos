// Camera near/far management. Pure (no three).
//
// Depth strategy (COORDINATOR.md C7): reversed-Z with a float depth target where
// EXT_clip_control exists, logarithmic depth otherwise. Both survive 0.1 m to millions of
// metres, but a larger near plane is still free precision, so the near plane grows with
// height above the ground and the far plane always reaches the farthest body.

export const DEPTH = Object.freeze({
  nearFoot: 0.08,            // first and third person on foot
  nearCockpit: 0.12,
  nearChase: 0.35,
  nearMax: 60,
  nearPerMetre: 0.012,       // near plane gained per metre of clearance above the ground
  farMin: 60e3,
  farMargin: 1.2,
});

// view: 'foot' | 'cockpit' | 'chase'. clearance: metres between the camera and the nearest
// surface (ground, liquid, or the subject it orbits). farthest: distance from the camera to the
// far side of the farthest thing that must be drawn.
export function cameraPlanes(view, clearance, farthest, D = DEPTH) {
  const base = view === 'foot' ? D.nearFoot : view === 'cockpit' ? D.nearCockpit : D.nearChase;
  // The near plane may never reach the subject itself: the ship is about 15 m from the chase
  // camera and the cockpit frame is centimetres from the eye, so only empty air counts.
  let near = base;
  if (view === 'chase') near = Math.min(D.nearMax, Math.max(base, Math.min(clearance * D.nearPerMetre, 4)));
  else if (view === 'foot') near = Math.min(0.25, Math.max(base, clearance * 0.002));
  const far = Math.max(D.farMin, farthest * D.farMargin);
  return { near, far };
}

// Distance from the camera to the far side of the farthest body (or the sun).
export function farthestExtent(cameraU, items) {
  let m = 0;
  for (const it of items) {
    const d = Math.hypot(it.p.x - cameraU.x, it.p.y - cameraU.y, it.p.z - cameraU.z) + it.radius;
    if (d > m) m = d;
  }
  return m;
}
