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
//   air: PHYSICS' air at the focus (physics.here.air: density, gust01), or nothing.
export function figureArgs(ex, lookPitch, out = {}, air = null) {
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
  figureBody(ex, ph, air, out);
  return out;
}

// M4: the rest of PHYSICS' body state (physics.md, "For PILOT and PAINTER: the figure's state,
// M4"), turned into the figure's OWN axes so the model needs no world: forward is the way the
// figure faces (the model's -Z), right its right hand (+X), up away from the ground (+Y). All
// plain numbers, all 0 when there is nothing to say; none is ever NaN. The names are listed for
// PAINTER at the top of docs/notes/pilot.md ("For PAINTER (M4)").
//   leanFwd, leanRight  rad: the lean into the wind, as the way the TOP of the body goes
//                       (leanFwd +: tips forward, leanRight +: tips to its right); lean: its size
//   hunker01            0 upright .. 1 down on hands and knees in a gale
//   windFwd, windRight, windUp   m/s: the air's velocity PAST the body (the wind less the body's
//                       own motion: a run in still air is windFwd -7.4): cloth streams along it
//   windSpeed           m/s: its length; windLoad01: 0 .. 1, its load on cloth (the square of the
//                       speed by the air's density; 1 = flat out, 15 m/s in Earth's air)
//   gust01              0 .. 1: the gust of the moment (the flap)
//   windBrace           N the suit's thrusters brace against the wind with (0 .. 1700)
//   swim                1 afloat and swimming, else 0 (mode is then 'swim')
//   stroke              0 .. 1: the phase of the arms' cycle (kept while treading)
//   strokeRate          cycles a second (0.625 treading water, about 1.1 at the swim's 2 m/s)
//   swimSpeed           m/s made through the liquid; submerged01: the share of the body under it
//   arc                 1 rising in the air, -1 falling, 0 on the ground or afloat
//   vUp                 m/s: vertical speed, + up; airTime: s since the feet left the ground
//   altitude            m: the feet over the ground (the last metre before a landing)
//   wall                1 held at a wall's foot (hands on the rock), 2 riding up it, else 0
//   slip01              0 .. 1 sliding back
const WIND_FLAT_OUT = 15, EARTH_AIR = 1.2;
function figureBody(ex, ph, air, out) {
  const p = ex.p, f = ex.fwd;
  let ux = 0, uy = 1, uz = 0, fx = 0, fy = 0, fz = -1;
  if (p) { const l = Math.hypot(p.x, p.y, p.z) || 1; ux = p.x / l; uy = p.y / l; uz = p.z / l; }
  if (f) { fx = f.x; fy = f.y; fz = f.z; }
  const rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;      // right = fwd x up
  const L = ph && ph.leanV, W = ph && ph.relWind;
  out.leanFwd = L ? num(L.x * fx + L.y * fy + L.z * fz) : 0;
  out.leanRight = L ? num(L.x * rx + L.y * ry + L.z * rz) : 0;
  out.lean = L ? Math.hypot(out.leanFwd, out.leanRight) : 0;
  out.hunker01 = ph ? Math.max(0, Math.min(1, num(ph.hunker01))) : 0;
  out.windFwd = W ? num(W.x * fx + W.y * fy + W.z * fz) : 0;
  out.windRight = W ? num(W.x * rx + W.y * ry + W.z * rz) : 0;
  out.windUp = W ? num(W.x * ux + W.y * uy + W.z * uz) : 0;
  out.windSpeed = W ? Math.hypot(out.windFwd, out.windRight, out.windUp) : 0;
  const rho = air && Number.isFinite(air.density) ? air.density : EARTH_AIR;
  out.windLoad01 = Math.max(0, Math.min(1, (rho / EARTH_AIR) * (out.windSpeed / WIND_FLAT_OUT) ** 2));
  out.gust01 = air ? Math.max(0, Math.min(1, num(air.gust01))) : 0;
  out.windBrace = ph ? num(ph.windBrace) : 0;
  // Afloat: PHYSICS' flag and stroke; without PHYSICS, PILOT's own flag and no stroke.
  out.swim = ph && ph.swim != null ? (ph.swim ? 1 : 0) : ex.swimming ? 1 : 0;
  out.stroke = ph ? num(ph.stroke) : 0;
  out.strokeRate = ph ? num(ph.strokeRate) : 0;
  out.swimSpeed = ph ? num(ph.swimSpeed) : 0;
  out.submerged01 = ph ? Math.max(0, Math.min(1, num(ph.submerged01))) : 0;
  // The arc of a flight: PHYSICS' when it says, else from the explorer's own velocity.
  const v = ex.v, vu = v ? num(v.x * ux + v.y * uy + v.z * uz) : 0;
  const inAir = !ex.grounded && !ex.swimming;
  out.vUp = ph && Number.isFinite(ph.vUp) ? ph.vUp : vu;
  out.airTime = ph && Number.isFinite(ph.airTime) ? ph.airTime : inAir ? num(ex.airTime) : 0;
  out.arc = ph && Number.isFinite(ph.arc) ? ph.arc : inAir ? (vu > 0 ? 1 : -1) : 0;
  out.altitude = num(ex.altitude);
  out.wall = ph && Number.isFinite(ph.wall) ? ph.wall : 0;
  out.slip01 = ph ? Math.max(0, Math.min(1, num(ph.slip01))) : 0;
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
