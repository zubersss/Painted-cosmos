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
  // buffeting
  gustArea: 60,            // m^2: lift-curve slope x planform area, for the response to gusts
  buffetRate: 1.3,         // Hz: main frequency of the chop
  // landing gear: three legs, origin at the centre of the contact plane (COORDINATOR C10)
  legs: Object.freeze([Object.freeze([0, 0, -3.2]), Object.freeze([-2.2, 0, 1.8]), Object.freeze([2.2, 0, 1.8])]),
  gearFrequency: 1.6,      // Hz: bounce frequency of the craft on its legs
  gearDamping: 0.65,       // damping ratio (aircraft oleo struts are 0.5-0.8)
  gearTravel: 0.35,        // m of stroke before the bump stop
  gearSideStiffness: 2.0,  // tangential (tyre / foot) stiffness as a multiple of the vertical
  inertia: Object.freeze([30700, 40950, 15000]),   // kg m^2 about the ship's right, up and forward axes
  sleepSpeed: 0.02,        // m/s and rad/s below which a settled ship goes to sleep
  sleepTime: 0.6,          // s
  // pulse drive
  pulseAccel: 400,         // m/s^2 at full pulse (inertial dampers: the crew feel none of it)
  pulseJerk: 260,          // m/s^3: how fast the acceleration may change
  pulseSpeed: 30000,       // m/s cruise
});

export const SHIP_BODY_STATE = () => ({
  thrust: { x: 0, y: 0, z: 0 },     // spooled engine acceleration, frame coordinates (m/s^2)
  lift01: 0,                        // spooled anti-gravity + hover thruster share of the weight
  buffet: { x: 0, y: 0, z: 0 },     // turbulence acceleration this step (m/s^2)
  buffetAngle: { pitch: 0, roll: 0 },   // small attitude wobble for the camera and the model (rad)
  q: 0,                             // dynamic pressure (Pa)
  airspeed: 0,                      // m/s relative to the air
  gLoad: 0,                         // felt acceleration in units of 9.81 m/s^2
  heat01: 0,                        // 0..1 entry heating indicator (~ sqrt(rho) v^3)
  downwash: { thrust: 0, speed: 0, q: 0, radius: 0 },   // ventral thruster wake
  groundEffect: 1,
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
const _dir = { x: 0, y: 0, z: 0 };
const _f = new Float64Array(3), _r = new Float64Array(3), _u = new Float64Array(3);

function axes(q) {
  // forward = q * (0,0,-1), right = q * (1,0,0), up = q * (0,1,0)
  const x = q.x, y = q.y, z = q.z, w = q.w;
  _r[0] = 1 - 2 * (y * y + z * z); _r[1] = 2 * (x * y + w * z); _r[2] = 2 * (x * z - w * y);
  _u[0] = 2 * (x * y - w * z); _u[1] = 1 - 2 * (x * x + z * z); _u[2] = 2 * (y * z + w * x);
  _f[0] = -2 * (x * z + w * y); _f[1] = -2 * (y * z - w * x); _f[2] = -(1 - 2 * (x * x + y * y));
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
//                          thrusters, and the ship slides wide in turns like a hovercraft. }
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
  if (env.air) { const a = env.air(st.p, _air, env.altGround); rho = a.density; wx = a.wind.x; wy = a.wind.y; wz = a.wind.z; sigma = a.turbulence || 0; }
  let rx = vx - wx, ry = vy - wy, rz = vz - wz;
  const airspeed = Math.hypot(rx, ry, rz);
  // drag along the three body axes (explicit estimate for the flight computer's feed-forward)
  const kf = 0.5 * rho * T.cdaForward / T.mass, ks = 0.5 * rho * T.cdaSide / T.mass, kv = 0.5 * rho * T.cdaVertical / T.mass;
  const rf = rx * _f[0] + ry * _f[1] + rz * _f[2], rs = rx * _r[0] + ry * _r[1] + rz * _r[2], ru = rx * _u[0] + ry * _u[1] + rz * _u[2];
  // ---- turbulence: a band-limited, deterministic chop ------------------------------------------
  const time = env.time != null ? env.time : B.time + dt;
  const amp = 0.5 * rho * airspeed * sigma * T.gustArea / T.mass;
  const ph = time * T.buffetRate;
  const b1 = noise3(ph, 3.7, 1.1, 911), b2 = noise3(ph * 1.7 + 40, 9.2, 5.5, 912), b3 = noise3(ph * 0.8 - 17, 2.2, 8.8, 913);
  // mostly vertical (lift response), some sideways, little fore-aft
  const bu = amp * b1 * 1.6, bs = amp * b2 * 0.7, bf = amp * b3 * 0.25;
  B.buffet.x = _u[0] * bu + _r[0] * bs + _f[0] * bf;
  B.buffet.y = _u[1] * bu + _r[1] * bs + _f[1] * bf;
  B.buffet.z = _u[2] * bu + _r[2] * bs + _f[2] * bf;
  const wob = clamp(amp * 0.012, 0, 0.05);
  B.buffetAngle.pitch = wob * noise3(ph * 1.3 + 7, 4.4, 2.2, 914);
  B.buffetAngle.roll = wob * 1.6 * noise3(ph * 1.1 - 9, 6.6, 3.3, 915);

  // ---- flight computer: the acceleration that closes the velocity error -------------------------
  const tau = Math.max(cmd.tau || 1, 0.05);
  const tg = cmd.target;
  let ax = 0, ay = 0, az = 0;
  const carried = g * B.lift01;
  if (tg) {
    ax = (tg.x - vx) / tau; ay = (tg.y - vy) / tau; az = (tg.z - vz) / tau;
    // feed-forward: cancel the drag it can feel, and (while hovering) whatever weight the lift
    // has not picked up yet. With no target the computer is off and the engines idle.
    const dF = kf * Math.abs(rf) * rf, dS = ks * Math.abs(rs) * rs, dU = kv * Math.abs(ru) * ru;
    ax += _f[0] * dF + _r[0] * dS + _u[0] * dU; ay += _f[1] * dF + _r[1] * dS + _u[1] * dU; az += _f[2] * dF + _r[2] * dS + _u[2] * dU;
    if (hover) { const rest = g - carried; ax += ux * rest; ay += uy * rest; az += uz * rest; }
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
  const h = env.altGround;
  const ge = h != null && h < T.thrusterRadius * 6 ? groundEffect(Math.max(h, 0.3), T) : 1;
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
  if (cmd.carve01 > 0 && tg) {
    const sp = Math.hypot(vx, vy, vz), ts = Math.hypot(tg.x, tg.y, tg.z);
    if (sp > 0.5 && ts > 0.5) {
      const k = (1 - Math.exp(-dt / tau)) * (cmd.carve01 > 1 ? 1 : cmd.carve01);
      const ax0 = vx / sp, ay0 = vy / sp, az0 = vz / sp, bx = tg.x / ts, by = tg.y / ts, bz = tg.z / ts;
      if (ax0 * bx + ay0 * by + az0 * bz > -0.98) {
        let dx = ax0 + (bx - ax0) * k, dy = ay0 + (by - ay0) * k, dz = az0 + (bz - az0) * k;
        const dl = Math.hypot(dx, dy, dz);
        if (dl > 1e-9) { vx = dx / dl * sp; vy = dy / dl * sp; vz = dz / dl * sp; }
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
