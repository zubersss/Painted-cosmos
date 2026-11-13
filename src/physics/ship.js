// Painted Cosmos physics: the ship as a body with mass. OWNER: PHYSICS. Pure (no three).
//
// PILOT's stepFlight steers the nose and decides what velocity the flight computer should hold
// (throttle x speed limit along the nose, plus lift keys). This file decides what the craft then
// actually does with its 4.2 tonnes:
//   - gravity, inverse-square with altitude; an anti-gravity lift that carries the weight while
//     hover is on (with a spool, so it sags and catches rather than snapping);
//   - engines with a spool-up lag and separate limits forward, in reverse, sideways and
//     vertically; the flight computer asks for the acceleration that closes the velocity error
//     and gets what the engines can give;
//   - drag ~ rho v^2 with different drag areas nose-on, side-on and belly-on, relative to the
//     moving air, so wind drifts the ship, gusts jolt it, and Venus (65 kg/m^3) holds it to
//     about 34 m/s at the ground while Mars and the Moon barely slow it at all;
//   - turbulence buffeting that scales with air density, airspeed and gustiness;
//   - ventral thrusters whose downwash (momentum theory) flattens grass and raises dust, and
//     which gain lift near the ground (ground effect);
//   - landing gear: three spring-damper legs under a rigid body, with stick-slip foot friction,
//     that settle the hull onto whatever slope it meets and then go properly to sleep;
//   - a jerk-limited S-curve for the pulse drive.
// Stiff terms are integrated implicitly or sub-stepped: stable at 60 Hz and at 20 Hz.
// Frame: whatever frame PILOT flies in (body-local near a planet). Allocation-free.
import { clamp, clamp01, noise3 } from './util.js';

export const SHIP_BODY = Object.freeze({
  mass: 4200,              // kg
  // drag areas Cd x A (m^2): a 9 m lifting body nose-on, side-on, and flat belly-on
  cdaForward: 2.4, cdaSide: 14, cdaVertical: 30,
  // engines (accelerations = force / mass, m/s^2)
  accelMain: 22,           // forward: 2.2 g
  accelReverse: 14,        // retro thrusters
  accelSide: 18,           // sideways: thrusters (9) plus the lift of the hull in a banked turn (about 9
                           // at the speeds the flight computer allows; see docs/notes/physics.md)
  accelLift: 14,           // ventral / dorsal thrusters beyond the weight they already carry
  accelSpace: 60,          // main drive in vacuum cruise mode (above the atmosphere): 6 g
  spoolUp: 0.45,           // s: engine thrust rise time
  spoolDown: 0.30,         // s
  // lift
  antigravShare: 0.7,      // fraction of the hover weight carried by the anti-gravity field ...
  liftSpool: 0.35,         // s
  thrusterArea: 6,         // m^2: total exit area of the ventral thrusters (the other 30 % of hover)
  thrusterRadius: 2.2,     // m: radius of the thruster footprint, for ground effect
  groundAir: 0.01,         // kg/m^3: air density at which the ground cushion is half what it is in thick air
  groundComp: 1,           // 0..1: how much of the cushion the flight computer allows for (P12; 0 = the old hang)
  // buffeting
  gustArea: 60,            // m^2: lift-curve slope x planform area, for the response to gusts
  buffetRate: 1.3,         // Hz: main frequency of the chop
  // (P13) the hull's attitude in a wind. The wind's force on the hull does not act through the centre of mass:
  // the side area's centre lies above it and aft of it (the fins), the planform's aft of it. So a side wind
  // rolls the hull away from the wind and swings its nose into it (a weathercock), an updraft tips the nose
  // down, and the attitude hold (a spring and a damper: holdRate, holdDamp) brings it back: in gusts the
  // hull rocks and yaws and corrects. Reported in st.phys.buffetAngle (pitch, roll, yaw), for the drawn hull.
  cpHeight: 0.5,           // m the side area's centre is above the centre of mass
  cpAft: 1.2,              // m it is aft of it
  cpPlan: 0.6,             // m the planform's centre is aft of it
  holdRate: 1.6,           // rad/s: natural frequency of the attitude hold
  holdDamp: 0.45,          // its damping ratio (under 1: it overshoots a little, as a craft in gusts does)
  // (M4) THE HULL IN A STORM (PILOT's critique of PHYSICS, item 4: hands off 30 m over Neptune's storm coast the ship
  // was carried 150 m in 30 s, between 7 and 78 m up, at 5 g, the drawn hull rocking 31 degrees; Earth's storm hardly
  // touched it: a forgiving craft in a game with no fail state has a storm in between). Three things, all here:
  //   - what the hull is handed. Its planform averages the air over its own nine metres and its mass over a second or
  //     two: it feels the wind's mean (its own running mean over windMeanTime) and gusts no stronger than windGust
  //     times it; and the sheet of air a cliff throws up (air.js: the flow follows the ground, 170 m/s upward at the
  //     50 m sea cliff in a 75 m/s squall) is thinner than the hull: its vertical part is at most windUp of the
  //     horizontal;
  //   - the station hold. The flight computer cancels the drag it feels with its thrusters, as before; where the
  //     wind's drag on a hull flying as commanded would be more than windHold of what a set of thrusters can give
  //     (side-on on Neptune: from about 85 m/s), the drive field (the one behind the pulse and the brake) sheds the
  //     rest (st.phys.windShed, m/s^2, for a glow or a sound): the ship drifts a few metres and holds;
  //   - the chop is felt, not thrown: the buffet's acceleration saturates at buffetMax, and the hold's lean in the
  //     wind's moments at rockMax on each axis: a squall rocks the drawn hull 5 to 10 degrees, slowly.
  // cmd.storm === false switches all three off (the hull in the raw wind, as before M4).
  windMeanTime: 3,         // s
  windGust: 1.5,           // gusts handed to the hull, as a multiple of that mean
  windGustTime: 2,         // s: ... and their envelope (the gust as the hull's mass meets it), not the sample of the instant
  // ... and with the hands off (no velocity asked for, hovering, in air) the flight computer HOLDS STATION: from where the
  // hull came to rest it leans on its thrusters against whatever has carried it off over the ground (holdGain per
  // second squared of the level offset, holdAccel at most; its height is left to the pilot and to PILOT's ground
  // assists), and lets go the moment anything is asked of it or it is carried holdReach away.
  holdSpeed: 1.0,          // m/s: the hull is "at rest" under this, and the station is where it then is
  holdGain: 0.6,           // 1/s^2
  holdBrake: 2,            // 1/s
  holdAccel: 4,            // m/s^2
  holdReach: 25,           // m
  windUp: 1 / 3,           // the vertical part handed to it, as a share of the horizontal
  windUpFree: 8,           // m/s: ... or this, whichever is more
  windFrom: 0.25, windFull: 0.6,   // the mean-and-envelope wind comes in between these shares of the side thrusters' authority (the wind's drag side-on)
  windHold: 0.6,           // share of a thruster set's authority the wind's drag may ask for before the field sheds the rest
  buffetMax: 2.2,          // m/s^2: the chop's acceleration saturates here (as it was up to three quarters of this; with its vertical share a third of a g at most: felt, in a seat)
  buffetMeanTime: 2,       // s: ... and it is taken about its own mean over this long (it shakes the hull; it does not carry it)
  rockMax: 0.085,          // rad: the lean the wind's moment holds on one axis saturates here (5 degrees; as it was up to three quarters of this)
  // landing gear: three legs, origin at the centre of the contact plane (COORDINATOR C10)
  legs: Object.freeze([Object.freeze([0, 0, -3.2]), Object.freeze([-2.2, 0, 1.8]), Object.freeze([2.2, 0, 1.8])]),
  gearFrequency: 1.6,      // Hz: bounce frequency of the craft on its legs
  gearDamping: 0.65,       // damping ratio (aircraft oleo struts are 0.5-0.8)
  gearTravel: 0.35,        // m of stroke before the bump stop
  gearSideStiffness: 2.0,  // tangential (tyre / foot) stiffness as a multiple of the vertical
  inertia: Object.freeze([30700, 40950, 15000]),   // kg m^2 about the ship's right, up and forward axes
  sleepSpeed: 0.02,        // m/s and rad/s below which a settled ship goes to sleep
  sleepTime: 0.6,          // s
  // the drive field as a brake (an ASSIST for "let go and it stops"; see cmd.brake)
  fieldBrake: 160,         // m/s^2 at most: the pulse field at 40 % (the crew feel none of it)
  fieldBrakeSpool: 0.35,   // s for the field to come on and go off
  // pulse drive
  pulseAccel: 400,         // m/s^2 at full pulse (inertial dampers: the crew feel none of it)
  pulseJerk: 260,          // m/s^3: how fast the acceleration may change
  pulseSpeed: 30000,       // m/s cruise
});

export const SHIP_BODY_STATE = () => ({
  thrust: { x: 0, y: 0, z: 0 },     // spooled engine acceleration, frame coordinates (m/s^2)
  lift01: 0,                        // spooled anti-gravity + hover thruster share of the weight
  buffet: { x: 0, y: 0, z: 0 },     // turbulence acceleration this step (m/s^2)
  buffetAngle: { pitch: 0, roll: 0, yaw: 0 },   // attitude off the commanded one, for the camera and the model (rad; three's rotateX, rotateZ, rotateY of a hull whose nose is -z): the chop, and (P13) the hull rocking and weathercocking in the wind
  gustAtt: { pitch: 0, roll: 0, yaw: 0, pitchV: 0, rollV: 0, yawV: 0 },   // (P13) the attitude hold's state
  windMean: { x: 0, y: 0, z: 0, ok: false },   // (M4) the running mean of the level wind at the hull (frame coordinates, m/s; see SHIP_BODY.windGust)
  windDev: { x: 0, y: 0, z: 0 },    // (M4) the gust's envelope: the level wind less that mean, eased over windGustTime
  buffetMean: { x: 0, y: 0, z: 0 }, // (M4) the chop's own mean over buffetMeanTime (taken out of buffet)
  station: { x: 0, y: 0, z: 0, on: false },   // (M4) the hull's offset from where it came to rest with the hands off (frame coordinates, m), while the hold is on
  windFelt: { x: 0, y: 0, z: 0 },   // (M4) the wind the hull was handed this step (m/s): after the gust and the vertical caps and what the field shed
  windShed: 0,                      // (M4) m/s^2 of the wind's drag the drive field is shedding right now (0 in any ordinary wind)
  q: 0,                             // dynamic pressure (Pa)
  airspeed: 0,                      // m/s relative to the air
  gLoad: 0,                         // felt acceleration in units of 9.81 m/s^2
  heat01: 0,                        // 0..1 entry heating indicator (~ sqrt(rho) v^3)
  downwash: { thrust: 0, speed: 0, q: 0, radius: 0 },   // ventral thruster wake
  groundEffect: 1,
  brake01: 0,                       // spooled field brake command
  fieldBrake: 0,                    // m/s^2 the drive field is shedding right now (for a glow or a sound)
  fieldCarve: 0,                    // m/s^2 the field is pushing sideways right now to turn the path onto the nose
  // touchdown
  w: { x: 0, y: 0, z: 0 },          // angular velocity (rad/s, frame coordinates)
  legLoad: new Float32Array(3),     // N on each leg
  legCompress: new Float32Array(3), // m
  legContact: new Uint8Array(3),
  anchor: new Float64Array(9),      // where each foot is planted
  contacts: 0,
  asleep: false,
  still: 0,
  time: 0,
});

const _air = { density: 0, wind: { x: 0, y: 0, z: 0 }, turbulence: 0 };
// (P18) what feels the air: the hull (its planform's side) at its own velocity, so the sub-second eddies average away
const _recv = { size: 8, vx: 0, vy: 0, vz: 0 };
const _dir = { x: 0, y: 0, z: 0 };
const _f = new Float64Array(3), _r = new Float64Array(3), _u = new Float64Array(3);

function axes(q) {
  // forward = q * (0,0,-1), right = q * (1,0,0), up = q * (0,1,0)
  const x = q.x, y = q.y, z = q.z, w = q.w;
  _r[0] = 1 - 2 * (y * y + z * z); _r[1] = 2 * (x * y + w * z); _r[2] = 2 * (x * z - w * y);
  _u[0] = 2 * (x * y - w * z); _u[1] = 1 - 2 * (x * x + z * z); _u[2] = 2 * (y * z + w * x);
  _f[0] = -2 * (x * z + w * y); _f[1] = -2 * (y * z - w * x); _f[2] = -(1 - 2 * (x * x + y * y));
}

// (M4) x as it is up to capKnee of `max`, then bending over to `max` (smooth: the slope is 1 at the knee): an ordinary
// storm's chop and lean are what they were, to the digit; a squall's saturate.
const CAP_KNEE = 0.75;
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function softCap(x, max) {
  const a = x < 0 ? -x : x, k = CAP_KNEE * max;
  if (a <= k) return x;
  const y = k + (max - k) * Math.tanh((a - k) / (max - k));
  return x < 0 ? -y : y;
}

// Top speed (m/s) at which full main thrust balances drag, nose-on, in air of density rho.
export function shipTopSpeed(rho, T = SHIP_BODY) {
  return rho > 0 ? Math.sqrt(2 * T.mass * T.accelMain / (rho * T.cdaForward)) : Infinity;
}
// Terminal speed (m/s) of the ship falling belly-first with everything off.
export function shipTerminal(g, rho, T = SHIP_BODY) {
  return rho > 0 ? Math.sqrt(2 * T.mass * g / (rho * T.cdaVertical)) : Infinity;
}
// Downwash speed (m/s) under ventral thrusters carrying `thrust` newtons (momentum theory:
// v = sqrt(T / (2 rho A)); in a vacuum the exhaust is its own medium and this is not defined).
export function downwashSpeed(thrust, rho, T = SHIP_BODY) {
  return rho > 1e-4 && thrust > 0 ? Math.sqrt(thrust / (2 * rho * T.thrusterArea)) : 0;
}
// Thrust gain of the ventral thrusters at height h above the ground (Cheeseman and Bennett
// 1955): 1 / (1 - (R / 4h)^2), capped where the formula stops being valid (h < R / 2).
export function groundEffect(h, T = SHIP_BODY) {
  const x = T.thrusterRadius / (4 * Math.max(h, T.thrusterRadius * 0.5));
  return 1 / (1 - x * x);
}

// One step of the ship in flight (translation only; PILOT steers the attitude st.q).
//   st:  { p, v, q, phys? }                   PILOT's ship state; st.phys is created on first use
//   cmd: { target:{x,y,z}  velocity the flight computer should hold (m/s, frame coordinates)
//          tau             s: how quickly it tries to close the error (PILOT's tauAtmo / tauSpace)
//          hover           true: lift carries the weight (default true)
//          boost           true: vacuum cruise mode (accelSpace instead of accelMain)
//          carve01         0..1, an ASSIST (default 0): the anti-gravity field turns the velocity
//                          vector toward the target direction with time constant tau, without
//                          changing the speed (a force at right angles to the motion does no
//                          work). 1 = the nose-following feel of an arcade ship; 0 = pure
//                          thrusters, and the ship slides wide in turns like a hovercraft.
//          carveAccel      m/s^2, optional: the most sideways acceleration the carve may give
//                          (absent: unbounded, as before). With it a fast ship runs wide of its
//                          nose and each world turns at its own radius; st.phys.fieldCarve says
//                          what the field is giving now.
//          brake           0..1, an ASSIST (default 0): the drive field (the one behind the pulse)
//                          sheds the speed the thrusters cannot: whatever part of "close the
//                          error in tau" the retro thrusters fall short of, up to
//                          SHIP_BODY.fieldBrake m/s^2, and only ever slowing the ship. It acts
//                          on hull and crew alike, so it adds nothing to gLoad. PILOT decides
//                          where it is allowed (it asked for vacuum only). }
//   env: { up:{x,y,z} | null   unit vector away from the body (null in deep space)
//          gravity          m/s^2 at the body's surface (0 or missing in deep space)
//          radius           m: base radius of the body, for inverse-square gravity (optional)
//          altGround        m above the ground or liquid, if known (for ground effect)
//          air(p, out) -> { density, wind, turbulence }     optional
//          time             s (for the buffet pattern) }
export function stepShipBody(st, cmd, dt, env, T = SHIP_BODY) {
  const fresh = !st.phys;
  const B = st.phys || (st.phys = SHIP_BODY_STATE());
  if (!(dt > 0)) return st;
  if (fresh) B.lift01 = cmd.hover === false ? 0 : 1;      // a ship that is already flying is already hovering
  B.asleep = false; B.still = 0;
  // in flight no foot is on the ground (the gear step sets these while it has the ship)
  if (B.contacts) { B.contacts = 0; B.legContact[0] = B.legContact[1] = B.legContact[2] = 0; B.legLoad[0] = B.legLoad[1] = B.legLoad[2] = 0; B.legCompress[0] = B.legCompress[1] = B.legCompress[2] = 0; }
  let vx = st.v.x, vy = st.v.y, vz = st.v.z;
  if (!(vx === vx && vy === vy && vz === vz)) { vx = vy = vz = 0; }
  axes(st.q);
  const up = env.up;
  // ---- gravity and lift ----------------------------------------------------------------------
  let g = 0, ux = 0, uy = 0, uz = 0;
  if (up && env.gravity > 0) {
    ux = up.x; uy = up.y; uz = up.z;
    g = env.gravity;
    if (env.radius > 0) { const r = Math.hypot(st.p.x, st.p.y, st.p.z); const k = env.radius / Math.max(r, env.radius * 0.5); g *= k * k; }
  }
  const hover = cmd.hover == null ? true : !!cmd.hover;
  B.lift01 += ((hover ? 1 : 0) - B.lift01) * (1 - Math.exp(-dt / T.liftSpool));
  // ---- air ---------------------------------------------------------------------------------------
  let rho = 0, wx = 0, wy = 0, wz = 0, sigma = 0;
  if (env.air) { _recv.size = Math.sqrt(T.gustArea); _recv.vx = st.v.x; _recv.vy = st.v.y; _recv.vz = st.v.z; const a = env.air(st.p, _air, env.altGround, _recv); rho = a.density; wx = a.wind.x; wy = a.wind.y; wz = a.wind.z; sigma = a.turbulence || 0; }
  // (M4) THE HULL IN A STORM (see SHIP_BODY.windGust): what the hull is handed, and what the field sheds
  B.windShed = 0;
  const storm = cmd.storm !== false && rho > 0 && T.windGust > 0;
  if (storm) {
    const M = B.windMean || (B.windMean = { x: 0, y: 0, z: 0, ok: false });
    // the level part and the vertical part (in deep space, with no up, the whole is "level")
    let wu = wx * ux + wy * uy + wz * uz, hx = wx - ux * wu, hy = wy - uy * wu, hz = wz - uz * wu;
    const D = B.windDev || (B.windDev = { x: 0, y: 0, z: 0 });
    if (!M.ok || fresh) { M.x = hx; M.y = hy; M.z = hz; M.ok = true; D.x = D.y = D.z = 0; }
    else {
      const k = 1 - Math.exp(-dt / T.windMeanTime), kg = T.windGustTime > 0 ? 1 - Math.exp(-dt / T.windGustTime) : 1;
      M.x += (hx - M.x) * k; M.y += (hy - M.y) * k; M.z += (hz - M.z) * k;
      D.x += (hx - M.x - D.x) * kg; D.y += (hy - M.y - D.y) * kg; D.z += (hz - M.z - D.z) * kg;
    }
    // the gust's envelope, no stronger than windGust times the mean (and lulls no deeper than the same below it) ...
    {
      const mm = Math.hypot(M.x, M.y, M.z), dl = Math.hypot(D.x, D.y, D.z), lim = (T.windGust - 1) * mm, m = dl > lim && dl > 1e-9 ? lim / dl : 1;
      // ... in a wind that is a storm to THIS hull in THIS air: one whose drag side-on asks more than windFrom of the
      // side thrusters (on Earth from 49 m/s, wholly from windFull, 76 m/s; in Venus' air from 7 m/s). Under it the
      // hull is handed the wind of the instant, as it always was: an ordinary storm's gusts jolt it as they did.
      const w2 = Math.max(hx * hx + hy * hy + hz * hz, mm * mm), load = 0.5 * rho * T.cdaSide * w2 / (T.mass * T.accelSide);
      const b = smooth01((load - T.windFrom) / (T.windFull - T.windFrom));
      hx += (M.x + D.x * m - hx) * b; hy += (M.y + D.y * m - hy) * b; hz += (M.z + D.z * m - hz) * b;
    }
    // the vertical part no more than windUp of the level part (what is under windUpFree passes as it is: a thermal, a
    // dust devil's updraught, a slope's lift in a breeze)
    const hl = Math.hypot(hx, hy, hz), cap = Math.max(T.windUpFree, T.windUp * hl);
    if (wu > cap) wu = cap; else if (wu < -cap) wu = -cap;
    wx = hx + ux * wu; wy = hy + uy * wu; wz = hz + uz * wu;
    // what the field sheds: the drag of this wind on a hull flying as commanded, against what each set of thrusters
    // gives. Only the WIND is shed, never the drag of the hull's own commanded speed (Venus' air at full throttle asks
    // more than windHold of the main engine by itself): the wind is scaled, all of it by one factor, until on every
    // axis the air past the hull is no faster than the thrusters' share allows, or than the commanded speed alone.
    const tg0 = cmd.target;
    if (tg0) {
      const k0 = 0.5 * rho / T.mass;
      const tF = tg0.x * _f[0] + tg0.y * _f[1] + tg0.z * _f[2], tS = tg0.x * _r[0] + tg0.y * _r[1] + tg0.z * _r[2], tU = tg0.x * _u[0] + tg0.y * _u[1] + tg0.z * _u[2];
      const wF = wx * _f[0] + wy * _f[1] + wz * _f[2], wS = wx * _r[0] + wy * _r[1] + wz * _r[2], wU = wx * _u[0] + wy * _u[1] + wz * _u[2];
      let keep = 1;
      for (let a = 0; a < 3; a++) {
        const t = a === 0 ? tF : a === 1 ? tS : tU, w = a === 0 ? wF : a === 1 ? wS : wU, q = t - w;
        const cda = a === 0 ? T.cdaForward : a === 1 ? T.cdaSide : T.cdaVertical;
        const acc = a === 0 ? (q > 0 ? T.accelMain : T.accelReverse) : a === 1 ? T.accelSide : T.accelLift;
        const qmax = Math.max(Math.sqrt(T.windHold * acc / Math.max(1e-12, k0 * cda)), Math.abs(t));
        if (Math.abs(q) > qmax && Math.abs(w) > 1e-9) { const k = (q > 0 ? t - qmax : t + qmax) / w; if (k < keep) keep = k < 0 ? 0 : k; }
      }
      if (keep < 1) {
        const q0x = tg0.x - wx, q0y = tg0.y - wy, q0z = tg0.z - wz;
        wx *= keep; wy *= keep; wz *= keep;
        // (reported: the drag acceleration shed, on the hull as it flies now)
        const q1x = tg0.x - wx, q1y = tg0.y - wy, q1z = tg0.z - wz;
        const d0 = k0 * Math.hypot(T.cdaForward * (q0x * _f[0] + q0y * _f[1] + q0z * _f[2]) ** 2, T.cdaSide * (q0x * _r[0] + q0y * _r[1] + q0z * _r[2]) ** 2, T.cdaVertical * (q0x * _u[0] + q0y * _u[1] + q0z * _u[2]) ** 2);
        const d1 = k0 * Math.hypot(T.cdaForward * (q1x * _f[0] + q1y * _f[1] + q1z * _f[2]) ** 2, T.cdaSide * (q1x * _r[0] + q1y * _r[1] + q1z * _r[2]) ** 2, T.cdaVertical * (q1x * _u[0] + q1y * _u[1] + q1z * _u[2]) ** 2);
        B.windShed = Math.max(0, d0 - d1);
      }
    }
  } else if (B.windMean) B.windMean.ok = false;
  if (B.windFelt) { B.windFelt.x = wx; B.windFelt.y = wy; B.windFelt.z = wz; }
  let rx = vx - wx, ry = vy - wy, rz = vz - wz;
  const airspeed = Math.hypot(rx, ry, rz);
  // drag along the three body axes (explicit estimate for the flight computer's feed-forward)
  const kf = 0.5 * rho * T.cdaForward / T.mass, ks = 0.5 * rho * T.cdaSide / T.mass, kv = 0.5 * rho * T.cdaVertical / T.mass;
  const rf = rx * _f[0] + ry * _f[1] + rz * _f[2], rs = rx * _r[0] + ry * _r[1] + rz * _r[2], ru = rx * _u[0] + ry * _u[1] + rz * _u[2];
  // ---- turbulence: a band-limited, deterministic chop ------------------------------------------
  const time = env.time != null ? env.time : B.time + dt;
  const amp0 = 0.5 * rho * airspeed * sigma * T.gustArea / T.mass;
  const amp = storm && T.buffetMax > 0 ? softCap(amp0, T.buffetMax) : amp0;   // ((M4) the chop saturates: see SHIP_BODY.windGust)
  const ph = time * T.buffetRate;
  const b1 = noise3(ph, 3.7, 1.1, 911), b2 = noise3(ph * 1.7 + 40, 9.2, 5.5, 912), b3 = noise3(ph * 0.8 - 17, 2.2, 8.8, 913);
  // mostly vertical (lift response), some sideways, little fore-aft
  const bu = amp * b1 * 1.6, bs = amp * b2 * 0.7, bf = amp * b3 * 0.25;
  B.buffet.x = _u[0] * bu + _r[0] * bs + _f[0] * bf;
  B.buffet.y = _u[1] * bu + _r[1] * bs + _f[1] * bf;
  B.buffet.z = _u[2] * bu + _r[2] * bs + _f[2] * bf;
  // ((M4) the chop shakes the hull, it does not carry it: its own mean over the last seconds is taken out. The noise's
  // mean over half a minute is not nothing: at the squall's chop it sank a hovering hull 14 m in 30 s.)
  if (storm && T.buffetMeanTime > 0) {
    const Bm = B.buffetMean || (B.buffetMean = { x: 0, y: 0, z: 0 }), k = 1 - Math.exp(-dt / T.buffetMeanTime);
    Bm.x += (B.buffet.x - Bm.x) * k; Bm.y += (B.buffet.y - Bm.y) * k; Bm.z += (B.buffet.z - Bm.z) * k;
    B.buffet.x -= Bm.x; B.buffet.y -= Bm.y; B.buffet.z -= Bm.z;
  }
  const wob = clamp(amp * 0.012, 0, 0.05);
  // (P13) the wind's moments on the hull against the attitude hold (see cpHeight)
  const A = B.gustAtt || (B.gustAtt = { pitch: 0, roll: 0, yaw: 0, pitchV: 0, rollV: 0, yawV: 0 });
  {
    const Fs = -0.5 * rho * T.cdaSide * airspeed * rs, Fu = -0.5 * rho * T.cdaVertical * airspeed * ru, I = T.inertia;
    const w2 = T.holdRate * T.holdRate, c = 2 * T.holdDamp * T.holdRate, h = Math.min(dt, 0.05);
    // ((M4) the lean each moment would hold saturates at rockMax: see SHIP_BODY.windGust)
    let mR = -Fs * T.cpHeight / I[2], mY = Fs * T.cpAft / I[1], mP = -Fu * T.cpPlan / I[0];
    if (storm && T.rockMax > 0) { const L = T.rockMax * w2; mR = softCap(mR, L); mY = softCap(mY, L); mP = softCap(mP, L); }
    A.rollV += (mR - c * A.rollV - w2 * A.roll) * h; A.roll = clamp(A.roll + A.rollV * h, -0.3, 0.3);
    A.yawV += (mY - c * A.yawV - w2 * A.yaw) * h; A.yaw = clamp(A.yaw + A.yawV * h, -0.3, 0.3);
    A.pitchV += (mP - c * A.pitchV - w2 * A.pitch) * h; A.pitch = clamp(A.pitch + A.pitchV * h, -0.3, 0.3);
  }
  B.buffetAngle.pitch = wob * noise3(ph * 1.3 + 7, 4.4, 2.2, 914) + A.pitch;
  B.buffetAngle.roll = wob * 1.6 * noise3(ph * 1.1 - 9, 6.6, 3.3, 915) + A.roll;
  B.buffetAngle.yaw = A.yaw;

  // ---- flight computer: the acceleration that closes the velocity error -------------------------
  const tau = Math.max(cmd.tau || 1, 0.05);
  const tg = cmd.target;
  let ax = 0, ay = 0, az = 0;
  const carried = g * B.lift01;
  // thrust gain of the ventral thrusters near the ground. It is a cushion of AIR (the ground blocks the
  // induced flow): in a vacuum a thruster is a rocket and gains nothing, so it fades with the density
  // (half at 0.01 kg/m^3: Mars 0.67 of the full gain, Earth 0.99, the Moon none).
  const h = env.altGround;
  const ge = h != null && h < T.thrusterRadius * 6 && rho > 0 ? 1 + (groundEffect(Math.max(h, 0.3), T) - 1) * rho / (rho + T.groundAir) : 1;
  // (M4) the station hold (see SHIP_BODY.holdSpeed)
  {
    const Sn = B.station || (B.station = { x: 0, y: 0, z: 0, on: false });
    // (nothing asked for over the ground: a climb asked of it, the pilot's or PILOT's ground assist's, leaves the station as it is)
    let tl = 1;
    if (tg) { const tu = tg.x * ux + tg.y * uy + tg.z * uz; tl = Math.hypot(tg.x - ux * tu, tg.y - uy * tu, tg.z - uz * tu); }
    const idle = storm && hover && tg && !cmd.boost && T.holdGain > 0 && tl < 1e-6;
    if (!idle) Sn.on = false;
    else if (!Sn.on) { const vu = vx * ux + vy * uy + vz * uz; if (vx * vx + vy * vy + vz * vz - vu * vu < T.holdSpeed * T.holdSpeed) { Sn.on = true; Sn.x = Sn.y = Sn.z = 0; } }
    else {
      Sn.x += vx * dt; Sn.y += vy * dt; Sn.z += vz * dt;
      { const su = Sn.x * ux + Sn.y * uy + Sn.z * uz; Sn.x -= ux * su; Sn.y -= uy * su; Sn.z -= uz * su; }   // (level only: the height is the pilot's, and PILOT's ground assists')
      if (Sn.x * Sn.x + Sn.y * Sn.y + Sn.z * Sn.z > T.holdReach * T.holdReach) Sn.on = false;      // carried off: a new station where it next comes to rest
    }
  }
  if (tg) {
    ax = (tg.x - vx) / tau; ay = (tg.y - vy) / tau; az = (tg.z - vz) / tau;
    if (B.station && B.station.on) {
      const Sn = B.station; let hx = -T.holdGain * Sn.x, hy = -T.holdGain * Sn.y, hz = -T.holdGain * Sn.z;
      // (and it closes its drift over the ground harder than a commanded speed: holdBrake more per second)
      { const vu = vx * ux + vy * uy + vz * uz; hx -= T.holdBrake * (vx - ux * vu); hy -= T.holdBrake * (vy - uy * vu); hz -= T.holdBrake * (vz - uz * vu); }
      const hl = Math.hypot(hx, hy, hz); if (hl > T.holdAccel) { const m = T.holdAccel / hl; hx *= m; hy *= m; hz *= m; }
      ax += hx; ay += hy; az += hz;
    }
    // feed-forward: cancel the drag it can feel, and (while hovering) whatever weight the lift
    // has not picked up yet. With no target the computer is off and the engines idle.
    const dF = kf * Math.abs(rf) * rf, dS = ks * Math.abs(rs) * rs, dU = kv * Math.abs(ru) * ru;
    ax += _f[0] * dF + _r[0] * dS + _u[0] * dU; ay += _f[1] * dF + _r[1] * dS + _u[1] * dU; az += _f[2] * dF + _r[2] * dS + _u[2] * dU;
    if (hover) { const rest = g - carried; ax += ux * rest; ay += uy * rest; az += uz * rest; }
    // (P12) and the cushion: near the ground the ventral thrusters give `ge` times their thrust, and a
    // computer that asks them for the open-air figure gets more lift than it wanted. Left alone, a
    // commanded 0.6 m/s descent hung at 0.05 m/s between 1.3 and 1.0 m (the extra lift balanced the
    // whole velocity error: 2.1 s for the last 0.6 m above the gear). It knows its height and its
    // thrusters, so it asks for less: the thrust that, multiplied by ge, is what it wanted. The cushion
    // is still there, in the thrust and the downwash (both fall as the ground comes up), and in the
    // engine's lag behind it. T.groundComp 0 switches the compensation off.
    if (ge > 1 && T.groundComp !== 0) {
      const cv = carried * (1 - T.antigravShare), aUp = ax * ux + ay * uy + az * uz;
      if (cv + aUp > 0) { const d = (cv + aUp) * (1 / ge - 1) * (T.groundComp == null ? 1 : T.groundComp); ax += ux * d; ay += uy * d; az += uz * d; }
    }
  }
  // in body axes, limited by what each set of engines can give
  let cf = ax * _f[0] + ay * _f[1] + az * _f[2], cs = ax * _r[0] + ay * _r[1] + az * _r[2], cu = ax * _u[0] + ay * _u[1] + az * _u[2];
  const main = cmd.boost ? T.accelSpace : T.accelMain;
  cf = clamp(cf, -T.accelReverse, main);
  cs = clamp(cs, -T.accelSide, T.accelSide);
  cu = clamp(cu, -T.accelLift, T.accelLift);
  const cx = _f[0] * cf + _r[0] * cs + _u[0] * cu, cy = _f[1] * cf + _r[1] * cs + _u[1] * cu, cz = _f[2] * cf + _r[2] * cs + _u[2] * cu;
  // engine spool: thrust follows the command with a lag (faster down than up)
  const cur = Math.hypot(B.thrust.x, B.thrust.y, B.thrust.z), want = Math.hypot(cx, cy, cz);
  const k = 1 - Math.exp(-dt / (want > cur ? T.spoolUp : T.spoolDown));
  B.thrust.x += (cx - B.thrust.x) * k; B.thrust.y += (cy - B.thrust.y) * k; B.thrust.z += (cz - B.thrust.z) * k;

  // ---- ventral thrusters, downwash, ground effect ----------------------------------------------
  const thrUp = B.thrust.x * ux + B.thrust.y * uy + B.thrust.z * uz;
  const ventral = Math.max(0, carried * (1 - T.antigravShare) + thrUp) * T.mass;      // N
  B.groundEffect = ge;
  B.downwash.thrust = ventral;
  B.downwash.speed = downwashSpeed(ventral, rho, T);
  B.downwash.q = ventral / (2 * T.thrusterArea);
  B.downwash.radius = T.thrusterRadius * (1 + 0.5 * clamp01((h == null ? 99 : h) / 12));
  const geAcc = (ge - 1) * ventral / T.mass;                                          // extra lift near the ground

  // ---- integrate ---------------------------------------------------------------------------------
  const lift = carried + geAcc;
  const feltX = B.thrust.x + B.buffet.x + ux * lift, feltY = B.thrust.y + B.buffet.y + uy * lift, feltZ = B.thrust.z + B.buffet.z + uz * lift;
  vx += (feltX - ux * g) * dt; vy += (feltY - uy * g) * dt; vz += (feltZ - uz * g) * dt;
  // drag, implicit per body axis (exact for quadratic drag, so no speed can make it unstable)
  rx = vx - wx; ry = vy - wy; rz = vz - wz;
  let nf = rx * _f[0] + ry * _f[1] + rz * _f[2], ns = rx * _r[0] + ry * _r[1] + rz * _r[2], nu = rx * _u[0] + ry * _u[1] + rz * _u[2];
  const dragF = nf - nf / (1 + kf * Math.abs(nf) * dt), dragS = ns - ns / (1 + ks * Math.abs(ns) * dt), dragU = nu - nu / (1 + kv * Math.abs(nu) * dt);
  nf -= dragF; ns -= dragS; nu -= dragU;
  vx = wx + _f[0] * nf + _r[0] * ns + _u[0] * nu; vy = wy + _f[1] * nf + _r[1] * ns + _u[1] * nu; vz = wz + _f[2] * nf + _r[2] * ns + _u[2] * nu;
  // ---- assist: the field turns the velocity toward the commanded direction ----------------------
  let carve = 0;
  if (cmd.carve01 > 0 && tg) {
    const sp = Math.hypot(vx, vy, vz), ts = Math.hypot(tg.x, tg.y, tg.z);
    if (sp > 0.5 && ts > 0.5) {
      const k = (1 - Math.exp(-dt / tau)) * (cmd.carve01 > 1 ? 1 : cmd.carve01);
      const ax0 = vx / sp, ay0 = vy / sp, az0 = vz / sp, bx = tg.x / ts, by = tg.y / ts, bz = tg.z / ts;
      if (ax0 * bx + ay0 * by + az0 * bz > -0.98) {
        let dx = ax0 + (bx - ax0) * k, dy = ay0 + (by - ay0) * k, dz = az0 + (bz - az0) * k;
        let dl = Math.hypot(dx, dy, dz);
        if (dl > 1e-9) {
          // What that costs: turning a velocity v through an angle a in dt is a sideways
          // acceleration v a / dt, and the field is not infinite. cmd.carveAccel (m/s^2, optional)
          // is the most it gives: beyond it the path runs wide of the nose, more the faster the
          // ship flies (at 77 m/s a 45 deg/s turn asks for 60 m/s^2, six g).
          dx /= dl; dy /= dl; dz /= dl;
          let c = ax0 * dx + ay0 * dy + az0 * dz; c = c > 1 ? 1 : c < -1 ? -1 : c;
          let a = Math.acos(c);
          const lim = cmd.carveAccel > 0 ? cmd.carveAccel * dt / sp : Infinity;
          if (a > lim && a > 1e-9) {
            const f = lim / a; dx = ax0 + (dx - ax0) * f; dy = ay0 + (dy - ay0) * f; dz = az0 + (dz - az0) * f;
            dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl; a = lim;
          }
          carve = dt > 0 ? sp * a / dt : 0;
          vx = dx * sp; vy = dy * sp; vz = dz * sp;
        }
      }
    }
  }
  B.fieldCarve += (carve - B.fieldCarve) * (dt < 0.1 ? dt / 0.1 : 1);     // (eased over a tenth of a second, for a read-out or a glow)
  // ---- assist: the drive field as a brake ---------------------------------------------------------
  B.brake01 += (clamp01(cmd.brake || 0) - B.brake01) * (1 - Math.exp(-dt / T.fieldBrakeSpool));
  B.fieldBrake = 0;
  if (B.brake01 > 1e-3 && tg) {
    // the speed the flight computer wanted to have shed by now, against what it has
    const ex = vx - tg.x, ey = vy - tg.y, ez = vz - tg.z, e = Math.hypot(ex, ey, ez);
    const e0 = Math.hypot(st.v.x - tg.x, st.v.y - tg.y, st.v.z - tg.z);
    const want = e0 * Math.exp(-dt / tau);
    if (e > want && e > 1e-6) {
      let dv = Math.min(e - want, T.fieldBrake * B.brake01 * dt);
      // only ever slowing: no more than the part of the error that lies along the motion
      const sp = Math.hypot(vx, vy, vz);
      const along = sp > 1e-6 ? (ex * vx + ey * vy + ez * vz) / (e * sp) : 0;
      if (along > 0) {
        dv *= along;
        vx -= ex / e * dv; vy -= ey / e * dv; vz -= ez / e * dv;
        B.fieldBrake = dv / dt;
      }
    }
  }
  st.p.x += vx * dt; st.p.y += vy * dt; st.p.z += vz * dt;
  st.v.x = vx; st.v.y = vy; st.v.z = vz;

  // ---- report ------------------------------------------------------------------------------------
  B.airspeed = Math.hypot(rx, ry, rz);
  B.q = 0.5 * rho * B.airspeed * B.airspeed;
  // what the crew would feel: every force except gravity (thrust, lift, buffet, drag), as a vector
  const gx = feltX - (_f[0] * dragF + _r[0] * dragS + _u[0] * dragU) / dt;
  const gy = feltY - (_f[1] * dragF + _r[1] * dragS + _u[1] * dragU) / dt;
  const gz = feltZ - (_f[2] * dragF + _r[2] * dragS + _u[2] * dragU) / dt;
  B.gLoad = Math.hypot(gx, gy, gz) / 9.81;
  // convective heating ~ sqrt(rho) v^3 (Sutton-Graves), normalised to a brisk Earth entry at 600 m/s
  B.heat01 = clamp01(Math.sqrt(rho) * B.airspeed * B.airspeed * B.airspeed / (Math.sqrt(0.3) * 600 * 600 * 600));
  B.time = time;
  return st;
}

// ---- landing gear ------------------------------------------------------------------------------------
function qRot(q, x, y, z, o) {
  const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
  o[0] = x + q.w * tx + (q.y * tz - q.z * ty);
  o[1] = y + q.w * ty + (q.z * tx - q.x * tz);
  o[2] = z + q.w * tz + (q.x * ty - q.y * tx);
  return o;
}
const _a = new Float64Array(3), _b = new Float64Array(3), _n = new Float64Array(9), _gr = new Float64Array(3), _mu = new Float64Array(6);
const _gnd = {};

// One step of the ship as a rigid body on its landing gear: the last metre of a landing, the
// settle, and standing on the ground. Translation AND attitude are integrated here.
//   st:  { p, v, q, phys? }
//   cmd: { lift01    0..1 share of the weight the anti-gravity still carries (PILOT ramps it
//                    from 1 to 0 over a second or two once the feet touch; default 0)
//          hold      optional {x,y,z} velocity target for hover thrusters while lift01 > 0 }
// LIFT-OFF with it: wakeShip(st); then every frame raise lift01 from 0 to 1 over a second or
// two and pass hold = up * (climb speed * lift01). The legs unload and stretch (the hull rises
// a few centimetres), the thruster wash comes on (st.phys.downwash), and when the lift passes
// the weight the feet leave the ground: st.phys.contacts === 0. From that frame on call
// stepShipBody with hover: true and the same climb target; st.phys.lift01 is already 1, so
// nothing sags at the hand-over. Retract the gear when you like.
//   env: { sample(unitDir) -> contract surface, gravity, ground(surface, out) optional,
//          air(p, out) optional }
// Returns st. st.phys.contacts = number of feet on the ground; st.phys.asleep = settled.
// While asleep the function returns at once (zero cost, zero drift); call wakeShip to disturb it.
export function stepShipGear(st, cmd, dt, env, T = SHIP_BODY) {
  const B = st.phys || (st.phys = SHIP_BODY_STATE());
  if (!(dt > 0)) return st;
  if (B.asleep) { st.v.x = st.v.y = st.v.z = 0; B.w.x = B.w.y = B.w.z = 0; return st; }
  const m = T.mass, g = env.gravity;
  const lift01 = clamp01(cmd && cmd.lift01 != null ? cmd.lift01 : 0);
  const wn = 2 * Math.PI * T.gearFrequency;
  const kLeg = m * wn * wn / 3;                             // N/m per leg
  const cLeg = 2 * T.gearDamping * m * wn / 3;              // N s/m per leg
  const kSide = kLeg * T.gearSideStiffness, cSide = 2 * Math.sqrt(kSide * m / 3) * 0.7;
  // ground under each leg (sampled once per call; the plane of each foot is its own)
  const q0 = st.q;
  let mus = 0.7, muk = 0.55;
  for (let i = 0; i < 3; i++) {
    const L = T.legs[i];
    qRot(q0, L[0], L[1], L[2], _a);
    const fx = st.p.x + _a[0], fy = st.p.y + _a[1], fz = st.p.z + _a[2];
    const r = Math.hypot(fx, fy, fz) || 1;
    _dir.x = fx / r; _dir.y = fy / r; _dir.z = fz / r;
    const s = env.sample(_dir);
    const floor = Math.max(s.radius, s.liquidRadius || 0);
    _gr[i] = floor;
    const liquid = (s.liquidRadius || 0) > s.radius;
    let nx = liquid ? _dir.x : s.normal.x, ny = liquid ? _dir.y : s.normal.y, nz = liquid ? _dir.z : s.normal.z;
    const l = Math.hypot(nx, ny, nz) || 1;
    _n[i * 3] = nx / l; _n[i * 3 + 1] = ny / l; _n[i * 3 + 2] = nz / l;
    if (env.ground) { const G = env.ground(s, _gnd); _mu[i * 2] = G.friction; _mu[i * 2 + 1] = G.kinetic; }
    else { _mu[i * 2] = mus; _mu[i * 2 + 1] = muk; }
  }
  const steps = Math.max(1, Math.ceil(dt / 0.009));
  const h = dt / steps;
  const I = T.inertia;
  let px = st.p.x, py = st.p.y, pz = st.p.z, vx = st.v.x, vy = st.v.y, vz = st.v.z;
  let wx = B.w.x, wy = B.w.y, wz = B.w.z;
  const q = st.q;
  let contacts = 0;
  for (let sIt = 0; sIt < steps; sIt++) {
    const r = Math.hypot(px, py, pz) || 1;
    const ux = px / r, uy = py / r, uz = pz / r;
    let Fx = -ux * g * m * (1 - lift01), Fy = -uy * g * m * (1 - lift01), Fz = -uz * g * m * (1 - lift01);
    let Tx = 0, Ty = 0, Tz = 0;
    if (cmd && cmd.hold && lift01 > 0) {
      const kk = lift01 * m / 0.6;
      Fx += (cmd.hold.x - vx) * kk; Fy += (cmd.hold.y - vy) * kk; Fz += (cmd.hold.z - vz) * kk;
    }
    contacts = 0;
    for (let i = 0; i < 3; i++) {
      const L = T.legs[i];
      qRot(q, L[0], L[1], L[2], _a);                         // lever arm, frame coordinates
      const fx = px + _a[0], fy = py + _a[1], fz = pz + _a[2];
      const nx = _n[i * 3], ny = _n[i * 3 + 1], nz = _n[i * 3 + 2];
      // penetration of the foot below the local ground plane (through the ground point under it)
      const fr = Math.hypot(fx, fy, fz) || 1;
      const gx = fx / fr * _gr[i], gy = fy / fr * _gr[i], gz = fz / fr * _gr[i];
      const pen = (gx - fx) * nx + (gy - fy) * ny + (gz - fz) * nz;
      if (pen <= 0) { B.legContact[i] = 0; B.legLoad[i] = 0; B.legCompress[i] = 0; continue; }
      // foot velocity = v + w x arm
      const fvx = vx + wy * _a[2] - wz * _a[1], fvy = vy + wz * _a[0] - wx * _a[2], fvz = vz + wx * _a[1] - wy * _a[0];
      const vn = fvx * nx + fvy * ny + fvz * nz;
      // spring-damper along the ground normal; a stiffer bump stop past the stroke; never pulls
      let N = kLeg * pen - cLeg * vn;
      if (pen > T.gearTravel) N += kLeg * 6 * (pen - T.gearTravel);
      if (N < 0) N = 0;
      // stick-slip friction: the foot is planted at an anchor; a tangential spring holds it
      // until the force passes mu N, then the anchor slides to keep the force on the cone
      const ai = i * 3;
      if (!B.legContact[i]) { B.anchor[ai] = fx; B.anchor[ai + 1] = fy; B.anchor[ai + 2] = fz; }
      let dx = fx - B.anchor[ai], dy = fy - B.anchor[ai + 1], dz = fz - B.anchor[ai + 2];
      let dn = dx * nx + dy * ny + dz * nz; dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
      const tvx = fvx - vn * nx, tvy = fvy - vn * ny, tvz = fvz - vn * nz;
      let ftx = -kSide * dx - cSide * tvx, fty = -kSide * dy - cSide * tvy, ftz = -kSide * dz - cSide * tvz;
      const ft = Math.hypot(ftx, fty, ftz), fmax = _mu[i * 2] * N;
      if (ft > fmax) {
        const fk = _mu[i * 2 + 1] * N, s = ft > 1e-9 ? fk / ft : 0;
        ftx *= s; fty *= s; ftz *= s;
        // slide the anchor so the spring alone would give the kinetic force
        const dl = Math.hypot(dx, dy, dz);
        if (dl > 1e-9) { const keep = Math.min(1, fk / (kSide * dl)); B.anchor[ai] = fx - dx * keep; B.anchor[ai + 1] = fy - dy * keep; B.anchor[ai + 2] = fz - dz * keep; }
      }
      const lx = nx * N + ftx, ly = ny * N + fty, lz = nz * N + ftz;
      Fx += lx; Fy += ly; Fz += lz;
      Tx += _a[1] * lz - _a[2] * ly; Ty += _a[2] * lx - _a[0] * lz; Tz += _a[0] * ly - _a[1] * lx;
      B.legContact[i] = 1; B.legLoad[i] = N; B.legCompress[i] = pen; contacts++;
    }
    // linear
    vx += Fx / m * h; vy += Fy / m * h; vz += Fz / m * h;
    // angular: torque into body axes, divide by the principal inertias, back out
    axes(q);
    const tr = Tx * _r[0] + Ty * _r[1] + Tz * _r[2], tu = Tx * _u[0] + Ty * _u[1] + Tz * _u[2], tf = Tx * _f[0] + Ty * _f[1] + Tz * _f[2];
    const ar = tr / I[0], au = tu / I[1], af = tf / I[2];
    wx += (_r[0] * ar + _u[0] * au + _f[0] * af) * h; wy += (_r[1] * ar + _u[1] * au + _f[1] * af) * h; wz += (_r[2] * ar + _u[2] * au + _f[2] * af) * h;
    // a little structural and aerodynamic damping of rotation
    const wd = Math.exp(-0.6 * h); wx *= wd; wy *= wd; wz *= wd;
    px += vx * h; py += vy * h; pz += vz * h;
    // q += 0.5 * (w, 0) * q * h
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w, hh = 0.5 * h;
    q.x = qx + hh * (wx * qw + wy * qz - wz * qy);
    q.y = qy + hh * (wy * qw + wz * qx - wx * qz);
    q.z = qz + hh * (wz * qw + wx * qy - wy * qx);
    q.w = qw + hh * (-wx * qx - wy * qy - wz * qz);
    const ql = Math.hypot(q.x, q.y, q.z, q.w) || 1; q.x /= ql; q.y /= ql; q.z /= ql; q.w /= ql;
  }
  st.p.x = px; st.p.y = py; st.p.z = pz;
  st.v.x = vx; st.v.y = vy; st.v.z = vz;
  B.w.x = wx; B.w.y = wy; B.w.z = wz;
  B.contacts = contacts;
  // sleep: three feet down, lift off, nothing moving for a while
  // The ventral thrusters are lit whenever the lift is: their wash blows dust and grass about
  // before the feet leave the ground and until the lift is shut down after landing.
  {
    const lifted = lift01 * g * m * (1 - T.antigravShare);
    let rho = 0;
    if (env.air && lifted > 0) rho = env.air(st.p, _air, 0).density;
    // (P12) on the gear the thrusters are deep in the cushion: the same lift for less thrust, as in the
    // last metre of the flight model (so the wash does not step up 6 % when the gear takes the hull)
    const ge = rho > 0 ? 1 + (groundEffect(0.5, T) - 1) * rho / (rho + T.groundAir) : 1, ventral = lifted / ge;
    B.downwash.thrust = ventral; B.downwash.speed = downwashSpeed(ventral, rho, T);
    B.downwash.q = ventral / (2 * T.thrusterArea); B.downwash.radius = T.thrusterRadius;
    B.groundEffect = ge;
    B.thrust.x = B.thrust.y = B.thrust.z = 0; B.brake01 = 0; B.fieldBrake = 0;
    B.airspeed = Math.hypot(vx, vy, vz); B.q = 0; B.gLoad = contacts ? g / 9.81 : g * lift01 / 9.81; B.heat01 = 0;
  }
  const moving = Math.hypot(vx, vy, vz) > T.sleepSpeed || Math.hypot(wx, wy, wz) > T.sleepSpeed;
  if (contacts === 3 && lift01 <= 0 && !moving) {
    B.still += dt;
    if (B.still >= T.sleepTime) { B.asleep = true; st.v.x = st.v.y = st.v.z = 0; B.w.x = B.w.y = B.w.z = 0; }
  } else B.still = 0;
  B.lift01 = lift01;
  return st;
}
export function wakeShip(st) {
  if (st.phys) { st.phys.asleep = false; st.phys.still = 0; }
}
// How far each leg sinks under the static weight (m): g / (2 pi f)^2.
export function gearSag(g, T = SHIP_BODY) {
  const wn = 2 * Math.PI * T.gearFrequency;
  return g / (wn * wn);
}

// ---- pulse drive: a jerk-limited speed change ---------------------------------------------------
// Plan the fastest change of speed from v0 to v1 with |acceleration| <= aMax and |jerk| <= jMax:
// ramp the acceleration up, hold it, ramp it down (a trapezoid in acceleration, an S in speed).
// Returns { v0, v1, dir, aPeak, tj, ta, T, distance }.
export function planSpeedChange(v0, v1, aMax, jMax) {
  const dv = Math.abs(v1 - v0), dir = v1 >= v0 ? 1 : -1;
  let tj = aMax / jMax, aPeak = aMax, ta;
  if (dv < aMax * tj) { tj = Math.sqrt(dv / jMax); aPeak = jMax * tj; ta = 0; }     // never reaches aMax
  else ta = dv / aMax - tj;
  const Ttot = 2 * tj + ta;
  // distance: the profile is symmetric in time, so the mean speed is (v0 + v1) / 2
  return { v0, v1, dir, aPeak, tj, ta, T: Ttot, distance: 0.5 * (v0 + v1) * Ttot, jMax };
}
// Sample a plan at time t: fills o { a, v, s } (acceleration, speed, distance travelled).
export function sampleSpeedChange(plan, t, o = {}) {
  const { v0, dir, aPeak, tj, ta, jMax } = plan;
  const T = plan.T;
  if (t <= 0) { o.a = 0; o.v = v0; o.s = 0; return o; }
  if (t >= T) { o.a = 0; o.v = plan.v1; o.s = plan.distance + plan.v1 * (t - T); return o; }
  let a, v, s;
  if (t < tj) {
    a = jMax * t; v = 0.5 * jMax * t * t; s = jMax * t * t * t / 6;
  } else if (t < tj + ta) {
    const u = t - tj;
    const v1 = 0.5 * jMax * tj * tj, s1 = jMax * tj * tj * tj / 6;
    a = aPeak; v = v1 + aPeak * u; s = s1 + v1 * u + 0.5 * aPeak * u * u;
  } else {
    const u = t - tj - ta;
    const v1 = 0.5 * jMax * tj * tj, s1 = jMax * tj * tj * tj / 6;
    const v2 = v1 + aPeak * ta, s2 = s1 + v1 * ta + 0.5 * aPeak * ta * ta;
    a = aPeak - jMax * u; v = v2 + aPeak * u - 0.5 * jMax * u * u; s = s2 + v2 * u + 0.5 * aPeak * u * u - jMax * u * u * u / 6;
  }
  o.a = dir * a; o.v = v0 + dir * v; o.s = v0 * t + dir * s;
  return o;
}
// Distance needed to come from speed v down to rest under the pulse limits (for "when must I
// start braking").
export function pulseBrakeDistance(v, T = SHIP_BODY) {
  return planSpeedChange(v, 0, T.pulseAccel, T.pulseJerk).distance;
}

// A stateful, jerk-limited throttle for the pulse drive: call every step with the speed you
// want; it ramps the acceleration so that it arrives at that speed with zero acceleration.
//   ps: { a, v }   (create with { a: 0, v: currentSpeed })
export function stepPulse(ps, vWant, dt, T = SHIP_BODY) {
  const aMax = T.pulseAccel, j = T.pulseJerk;
  const err = vWant - ps.v;
  // The acceleration from which a ramp down at full jerk lands exactly on the wanted speed is
  // a = sqrt(2 j |err|) (the switching curve of the time-optimal law). Far away that is more
  // than aMax, so the drive ramps up and holds; near the goal it follows the curve down to zero.
  // (0.9 j on the curve leaves the discrete steps room to keep up with it.)
  let aWant = Math.sign(err) * Math.sqrt(2 * 0.9 * j * Math.abs(err));
  if (aWant > aMax) aWant = aMax; else if (aWant < -aMax) aWant = -aMax;
  const a0 = ps.a;
  ps.a = clamp(a0 + clamp(aWant - a0, -j * dt, j * dt), -aMax, aMax);
  const dv = 0.5 * (a0 + ps.a) * dt;
  // arrive exactly rather than step past the goal
  if ((err > 0 && dv >= err) || (err < 0 && dv <= err) || Math.abs(err) < 1e-9) { ps.v = vWant; if (Math.abs(ps.a) <= j * dt * 1.5) ps.a = 0; }
  else ps.v += dv;
  return ps;
}
