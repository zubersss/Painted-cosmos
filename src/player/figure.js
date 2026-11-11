// What the drawn figure, the drawn hull and the footsteps take from PHYSICS' bodies. Pure
// logic (no three, no DOM): src/core/game.js hands the results to the models and the mixer, and
// the unit tests (tests/figure.test.mjs) drive it with the real explorer.
//
// The explorer's body (PHYSICS stage P13) is the stride's mean: st.p and st.v are where the
// camera stands and what the controls tune. Within the stride the hips ride the gait
// (st.phys.ride = hip + the stride's bob), the feet are placed (st.phys.feet), and each
// footfall is an event with moment, place, foot and force (st.phys.footfall, counted by
// st.phys.steps). The figure is drawn from those; the camera never rides them, so the view
// does not bob.

const num = (x, d = 0) => (Number.isFinite(x) ? x : d);

// The argument to explorerModel.animate. `out` is reused from frame to frame.
//   ex: sim.ex (the explorer: mode, speed, jet01, grounded, phys), lookPitch: the foot camera's pitch.
// `hip` carries `ride` (PHYSICS: "pass ride where hip is passed"), so a figure that reads only
// `hip` (folded knees under the hips) steps too; `ride` is also given by name, with the stride.
export function figureArgs(ex, lookPitch, out = {}) {
  const ph = ex.phys || null;
  const ride = ph ? num(ph.ride, num(ph.hip)) : 0;
  out.mode = ex.mode; out.speed = ex.speed; out.jet01 = ex.jet01; out.lookPitch = lookPitch;
  out.hip = ride;
  out.ride = ride;
  out.clamber01 = ph ? num(ph.clamber01) : 0;
  out.grounded = !!ex.grounded;
  // The stride (0..1: the left foot down at 0, the right at 0.5), which feet are down (1 left,
  // 2 right, 3 both, 0 neither: a run's flight), each foot's place ([left, right] { fwd, up,
  // side, down } in metres from st.p along the heading), how far the body is ahead of st.p
  // within the stride, the fold before a jump (0..1), and the gait (0 standing, 1 walk, 2 run).
  out.stride = ph ? num(ph.stride) : 0;
  out.footDown = ph && Number.isFinite(ph.footDown) ? ph.footDown : 3;
  out.feet = ph && Array.isArray(ph.feet) && ph.feet.length === 2 ? ph.feet : null;
  out.surge = ph ? num(ph.surge) : 0;
  out.crouch01 = ph ? num(ph.crouch01) : 0;
  out.gait = ph && Number.isFinite(ph.gait) ? ph.gait : 0;
  return out;
}

// The drawn hull's attitude in the air (PHYSICS' buffetAngle: the chop and the wind's trim),
// clamped. Never applied to the flight: only the model turns.
export const HULL_TRIM_MAX = 0.12;   // rad
export function hullTrim(buf, out = { pitch: 0, roll: 0, yaw: 0 }) {
  const c = (a) => Math.max(-HULL_TRIM_MAX, Math.min(HULL_TRIM_MAX, num(a)));
  out.pitch = buf ? c(buf.pitch) : 0;
  out.roll = buf ? c(buf.roll) : 0;
  out.yaw = buf ? c(buf.yaw) : 0;
  return out;
}

// Footsteps from PHYSICS' footfalls. `seen` is the count of footfalls already sounded (null
// before the first look, so nothing sounds for footfalls that happened before the sound was
// listening). Returns the new footfall, or null; at most one a frame (PHYSICS gives at most one
// a step at any frame rate down to 20 Hz). Without PHYSICS' gait (stubs) phys.steps is
// undefined and the mixer keeps its own cadence.
export function hasFootfalls(phys) { return !!phys && Number.isFinite(phys.steps); }

// Loudness of one footfall from its force over the body's weight (PHYSICS: 100 kg; 1.3 weights
// strolling, about 2.5 at the 4.2 m/s pace, 3.6 at a run, more for a landing): a gain on the
// footstep's level, 1 at the pace a player walks at.
export function footLoudness(force, gravity) {
  const w = 100 * Math.max(0.5, num(gravity, 9));
  const r = num(force) / w;
  return Math.max(0.5, Math.min(1.25, 0.35 + 0.26 * r));
}
