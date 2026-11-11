// Painted Cosmos physics: the explorer as a body with mass. OWNER: PHYSICS. Pure (no three).
//
// PILOT's stepExplorer turns keys into a COMMAND (a wished velocity, jump, jetpack throttle and
// its assists). This file decides what the body then actually does:
//   - legs push through friction: the force they can put into the ground is limited by the
//     friction circle (mu N), by leg strength, and by leg power (which is what slows you uphill,
//     in sand, in snow, wading, and in the thick air of Venus);
//   - slopes: gravity pulls along the slope; you hold while tan(slope) <= mu + foothold and
//     slide with kinetic friction beyond it;
//   - air: drag on the velocity relative to the wind, so wind leans on you and a fall has the
//     terminal speed of that planet's air (Earth 55 m/s, Venus 7 m/s, none on the Moon);
//   - liquid: buoyancy and drag from the submerged part; you float when buoyancy carries you;
//   - jetpack: a thrust in newtons, vectored toward where you want to go;
//   - contact: an inelastic landing with a Coulomb friction impulse (you skid on ice).
// Every integrator here is implicit or exact where it is stiff (quadratic drag, buoyancy), so the
// step is stable at 60 Hz and at 20 Hz, and a body at rest stays exactly at rest.
//
// Frame: body-local. st.p is the feet, st.v the velocity. Allocation-free.
import { clamp, clamp01, smoothstep } from './util.js';

export const EXPLORER_BODY = Object.freeze({
  mass: 100,              // kg: a 72 kg person in 28 kg of suit and pack
  height: 1.8,            // m
  radius: 0.35,           // m: half-width, for pushing plants aside
  bodyDensity: 1010,      // kg/m^3 of the suited body (used when the float assist is off)
  // air
  cdaUpright: 0.85,       // m^2: drag area standing or walking (Cd 1.2 x 0.7 m^2; pedestrians measure 0.8-0.9)
  cdaFall: 0.60,          // m^2: falling with the pack (a skydiver belly-down is 0.45-0.5 without one)
  // legs
  legAccel: 9.0,          // m/s^2: the hardest the legs push off firm ground (a sprint start is 8-10)
  legPower: 1600,         // W of external work the legs sustain: an athlete's sprint peak (1500-2000 W),
                          // held by the suit. It sets the speed uphill, in sand, snow, water and dense air.
  response: 0.11,         // s: time constant with which the legs cancel a velocity error
  runFoothold: 4.5,       // m/s: above this speed footholds no longer help
  arrest: 0.85,           // sliding out of control, the body digs in heels and hands: friction is this
                          // fraction of the holding traction (never less than the kinetic coefficient)
  // LEGS (P9). st.p is the feet; the mass rides at the hips, one leg above them. The legs are a
  // suspension with a stroke: they fold and reach so the feet follow the ground while the hips
  // take a smoother path. Over a feature lower than the stroke (legFold + legReach = 0.73 m) the
  // hips do not move at all, at any speed. Over one up to `clamber` high the hips must rise and
  // fall, and the limbs keep the body attached: they hold the rock (grip), and the walker holds
  // its pace to what gravity and that grip can follow. See "legs" in stepExplorerBody.
  legLength: 0.9,         // m: hip height standing (documentation: the dynamics need only the stroke)
  legFold: 0.45,          // m the legs shorten: a deep crouch, the foot placed up on something
  legReach: 0.28,         // m the feet reach below the standing stance to keep contact (a step down)
  stickGap: 0.28,         // (the name of legReach before P9; kept, unused)
  legTime: 0.12,          // s: time constant with which the legs level the hips (critically damped)
  legLift: 9.0,           // m/s^2: the hardest the legs raise the hips (the same legs as legAccel)
  trendTime: 0.3,         // s over which the rise of the ground counts as the slope of a hill, not a feature
  legCatch: 30,           // m/s^2: the hardest they take up a descending body (eccentric: 3 g)
  clamber: 1.35,          // m: a leg and a half. A rise or a drop within it is clambered in contact,
                          // hands on the rock; a drop beyond it is a fall
  gripAccel: 10,          // m/s^2 the limbs holding a feature pull the body toward it (1 kN). Only a
                          // convex feature gives a hold; open ground does not (see gripDepth)
  gripDepth: 0.2,         // m: there is a hold when the ground `look` ahead lies this far (beyond the
                          // reach) below the line the hips are moving on: a rock, a ledge, a sharp
                          // ridge (crest radius under about 3.5 m), not a rolling crest
  legStep: 0.15,          // m: the longest step over the ground the legs take in one piece (longer frames are split, 4 at most)
  look: 1.2,              // m ahead the walker looks while its legs are working (one more sample)
  braceAccel: 20,         // m/s^2 the limbs on a hold brake the body with (2 kN), not limited by the soles' grip
  braceDv: 2.5,           // m/s of forward speed the limbs take up in one hold on the way down;
                          // more than that tears the grip off and the body flies
  crestFilter: 0.15,      // (retired in P9: the stroke of the legs does this now; kept, unused)
  crestLaunch: true,      // leave the ground when it falls away faster than gravity (low-g bounding)
  // jumping: the legs do the same work on any planet, so the take-off speed depends on gravity:
  //   v^2 = jumpSpeed^2 + 2 jumpPush (jumpG0 - g)
  jumpSpeed: 4.8,         // m/s at jumpG0 (PILOT's tuning: a suit-assisted hop of 1.3 m on Earth)
  jumpPush: 0.4,          // m: how far the legs extend during the push
  jumpG0: 9.0,            // m/s^2 that jumpSpeed is quoted at
  // jetpack
  jetThrust: 1700,        // N (17 m/s^2 on 100 kg: PILOT's jetThrust)
  jetSpool: 0.08,         // s: thrust rise time
  jetVector: 0.6,         // sideways share of the thrust available for steering (about 31 deg of tilt)
  jetSteerTime: 0.35,     // s: how quickly vectoring closes a sideways velocity error
  rcsAccel: 4.0,          // m/s^2: steering from the suit's small thrusters while falling without the jet
  rcsTime: 0.5,           // s
  retroAccel: 45,         // m/s^2: strongest push of the automatic descent brake (an assist PILOT commands)
  // liquid
  floatAssist: true,      // the suit trims its buoyancy so it floats floatDepth deep in ANY liquid
  floatDepth: 1.25,       // m of the body under the surface when floating (PILOT's swimDepth)
  floatTrimStart: 0.8,    // the trim only comes on as the liquid nears float depth (this fraction of
                          // it): wading in the shallows the suit is as heavy as a person, and grips
  wadeWidth: 0.32,        // m: width of the legs and trunk pushing through liquid (drag area = width x depth)
  swimCda: 0.12,          // m^2: drag area swimming (a good swimmer is 0.05-0.1)
  swimForce: 400,         // N: stroke plus suit thrusters (a strong swimmer makes 100-150 N)
  swimTime: 0.4,          // s
  sinkCdaV: 0.25,         // m^2: drag area moving vertically through liquid
});

export const EXPLORER_BODY_STATE = () => ({
  jetThrottle: 0,         // smoothed 0..1
  jetUse: 0,              // thrust fraction actually used this step (for PILOT's fuel)
  slip01: 0,              // 0 gripping .. 1 sliding freely (the ground cannot hold you)
  scramble01: 0,          // 0 easy .. 1 the legs want far more traction than there is (ice, mud)
  sink: 0,                // m the feet are pressed into the ground (for drawing and footprints)
  submerged01: 0,         // fraction of the body under liquid
  windAccel: 0,           // m/s^2 the wind is pushing with
  lean: 0,                // rad the body must lean into the wind to balance it: atan(windAccel / g)
  unload: 0,              // (retired in P9, always 0)
  vvPrev: 0,
  hip: 0,                 // m: leg length now minus standing (-legFold folded .. +legReach reaching down)
  hipV: 0,                // m/s: vertical speed of the hips
  trend: 0,               // m/s: the rate the ground has been rising under the feet (filtered over trendTime)
  base: 0,                // radius of the ground where the legs last stood at their standing length, carried on at `trend`
  clamber01: 0,           // 0 striding .. 1 legs at the end of their stroke (clambering over something)
  clamberT: 0,            // s left of looking ahead after the legs last worked
  grip: 0,                // 1 while the limbs hold a feature (taken at a convex edge, kept until standing again)
  paceCap: 1e9,           // m/s: the pace the walker holds so its feet can follow the ground ahead
  brace: 0,               // m/s of forward speed lost this step against a face or to a hold
  support: 0,             // m/s^2 of normal support from the ground (0 when floating or airborne)
  impact: 0,              // m/s of the last landing (normal speed), set on the landing step
  puff: 0,                // the same, held and decaying over 0.1 s (for dust and sound, read once a frame)
  material: 'soil',
  friction: 0.7,
  dust: 0,                // 0..1 fines raised by the feet right now
  speedGround: 0,         // m/s along the ground
});

const _air = { density: 1.225, wind: { x: 0, y: 0, z: 0 } };
const _gnd = {};
const _dir = { x: 0, y: 0, z: 0 };
const _dir2 = { x: 0, y: 0, z: 0 };
const DEFAULT_GROUND = { material: 'soil', friction: 0.7, kinetic: 0.55, foothold: 0.3, restitution: 0.1, sink: 0.015, drag: 0.03, dust: 0.1 };
const DEFAULT_LIQUID = { density: 999, viscosity: 1.14e-3 };

// Take-off speed of a jump under gravity g (see EXPLORER_BODY.jumpSpeed).
export function jumpSpeedFor(g, T = EXPLORER_BODY) {
  return Math.sqrt(Math.max(0.6, T.jumpSpeed * T.jumpSpeed + 2 * T.jumpPush * (T.jumpG0 - g)));
}

// Terminal fall speed of the explorer in air of density rho under gravity g.
export function explorerTerminal(g, rho, T = EXPLORER_BODY) {
  return rho > 0 ? Math.sqrt(2 * T.mass * g / (rho * T.cdaFall)) : Infinity;
}

// The ground `dist` metres ahead of (px,py,pz) along (hx,hy,hz): its radius (one sample). NaN when not moving.
function groundAhead(env, px, py, pz, hx, hy, hz, dist) {
  const l = Math.hypot(hx, hy, hz);
  if (!(l > 1e-9)) return NaN;
  const k = dist / l, x = px + hx * k, y = py + hy * k, z = pz + hz * k, r = Math.hypot(x, y, z) || 1;
  _dir2.x = x / r; _dir2.y = y / r; _dir2.z = z / r;
  return env.sample(_dir2).radius;
}
// Is there something for the limbs to hold? Yes when the ground `look` ahead (radius hD) lies well below
// the line the hips are moving on (c: hips less a leg, w: their vertical speed, vh: their speed over the
// ground): a convex feature at the scale of a limb; and when that ground is within a clamber of the feet.
function holdAhead(c, w, vh, feet, hD, T) {
  if (!(hD === hD)) return false;
  const m = vh > 0.3 ? clamp(w / vh, -2, 2) : 0;
  return c + m * T.look - hD > T.legReach + T.gripDepth && feet - hD <= T.clamber;
}

// One step of the body.
//   st:  { p:{x,y,z}, v:{x,y,z}, grounded:bool, phys? }  (PILOT's explorer state; st.phys is
//        created on first use and holds EXPLORER_BODY_STATE)
//   cmd: { wish:{x,y,z}   wished velocity, horizontal, m/s (PILOT: wish direction x speed)
//          jump: bool     push off this step
//          jet: 0..1      jetpack throttle
//          jetMaxRise:    m/s, optional governor on the climb speed
//          descentLimit:  m/s, optional automatic descent brake (the soft-landing assist)
//          airControl:    0..1, default 1
//          assistAccel:   m/s^2, optional: extra authority from the suit's thrusters for starting
//                         and stopping on the ground, NOT limited by traction (an assist: 0 is
//                         pure legs; 3 makes a 4 m/s stop take 0.35 s instead of 0.5) }
//   env: { sample(unitDir) -> contract surface,  gravity (m/s^2),
//          air(p, out) -> { density, wind }          optional (default: still Earth air)
//          ground(surface, out) -> contact props     optional (default: firm soil)
//          liquid: { density, viscosity }            optional (default: water)
//          liquidOf(surface) -> { density, viscosity }   optional: the liquid at a place (lava, cloud froth) }
// Returns st. Sets st.grounded, st.p, st.v and st.phys.*; never allocates after the first call.
export function stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY) {
  // On the ground a step is never longer than the legs resolve (legStep): at a low frame rate a run would
  // otherwise cross the flank of a boulder in two samples. At 60 Hz a run is one step, as before.
  if (st.grounded && dt > 0 && st.v) {
    let n = Math.ceil(Math.hypot(st.v.x, st.v.y, st.v.z) * dt / T.legStep);
    if (n > 1) {
      if (!(n <= 4)) n = 4;
      const jump = cmd.jump, h = dt / n;
      let brace = 0;
      for (let i = 0; i < n; i++) { stepOnce(st, cmd, h, env, T); brace += st.phys.brace; if (i === 0 && jump) cmd.jump = false; }
      cmd.jump = jump; st.phys.brace = brace;
      return st;
    }
  }
  return stepOnce(st, cmd, dt, env, T);
}
function stepOnce(st, cmd, dt, env, T) {
  const B = st.phys || (st.phys = EXPLORER_BODY_STATE());
  if (!(dt > 0)) return st;
  let px = st.p.x, py = st.p.y, pz = st.p.z;
  let vx = st.v.x, vy = st.v.y, vz = st.v.z;
  if (!(px === px && py === py && pz === pz)) { px = 0; py = 1; pz = 0; }
  if (!(vx === vx && vy === vy && vz === vz)) { vx = vy = vz = 0; }
  const r = Math.hypot(px, py, pz) || 1;
  const ux = px / r, uy = py / r, uz = pz / r;
  _dir.x = ux; _dir.y = uy; _dir.z = uz;
  const s0 = env.sample(_dir);
  const g = env.gravity;
  const groundR = s0.radius;
  const liquidR = (s0.liquidRadius || 0) > groundR ? s0.liquidRadius : 0;
  let nx = s0.normal.x, ny = s0.normal.y, nz = s0.normal.z;
  { const l = Math.hypot(nx, ny, nz); if (l > 1e-9) { nx /= l; ny /= l; nz /= l; } else { nx = ux; ny = uy; nz = uz; } }
  let nu = nx * ux + ny * uy + nz * uz;
  if (nu < 0.05) { nx = ux; ny = uy; nz = uz; nu = 1; }

  // ---- surroundings ------------------------------------------------------------------------
  let rho = 1.225, wx = 0, wy = 0, wz = 0;
  if (env.air) { const a = env.air(st.p, _air, Math.max(0, r - groundR) + 1.0); rho = a.density; wx = a.wind.x; wy = a.wind.y; wz = a.wind.z; }
  // A named assist (PILOT's lever; default 0 = the real wind): cmd.shelter01, 0..1, is the share of the
  // wind's FORCE on the body that the suit cancels. The force goes with the square of the wind, so the
  // body is given wind x sqrt(1 - shelter01); its own drag through still air is untouched.
  if (cmd.shelter01 > 0) { const k = Math.sqrt(1 - clamp01(cmd.shelter01)); wx *= k; wy *= k; wz *= k; }
  const G = env.ground ? env.ground(s0, _gnd) : DEFAULT_GROUND;
  const liq = env.liquidOf ? env.liquidOf(s0) : env.liquid || DEFAULT_LIQUID;
  // viscous (Stokes) drag: nothing in water, everything in lava. 3 pi mu L v on a body of length L.
  const visc = 3 * Math.PI * (liq.viscosity || 0) / T.mass;
  const depth = liquidR ? Math.max(0, liquidR - r) : 0;
  const sub = clamp01(depth / T.height);
  let rhoBody = T.bodyDensity;
  if (T.floatAssist) {
    const trim = smoothstep(T.floatDepth * T.floatTrimStart, T.floatDepth, depth);
    const floatRho = liq.density * T.floatDepth / T.height;
    rhoBody = floatRho < rhoBody ? rhoBody + (floatRho - rhoBody) * trim : (depth > 0 ? floatRho : rhoBody);
  }
  const buoy = sub * liq.density / rhoBody;            // buoyant force as a fraction of weight
  B.submerged01 = sub;

  // wished velocity, made horizontal
  let qx = 0, qy = 0, qz = 0;
  if (cmd.wish) {
    qx = cmd.wish.x || 0; qy = cmd.wish.y || 0; qz = cmd.wish.z || 0;
    const d = qx * ux + qy * uy + qz * uz;
    qx -= d * ux; qy -= d * uy; qz -= d * uz;
  }
  const qlen = Math.hypot(qx, qy, qz);

  // jetpack throttle with spool
  const jetCmd = clamp01(cmd.jet || 0);
  B.jetThrottle += (jetCmd - B.jetThrottle) * (1 - Math.exp(-dt / T.jetSpool));
  if (B.jetThrottle < 1e-4 && jetCmd === 0) B.jetThrottle = 0;
  let aJet = T.jetThrust / T.mass * B.jetThrottle;      // m/s^2 available

  let grounded = !!st.grounded;
  B.impact = 0;
  // floating: buoyancy carries the whole weight, the feet leave the bottom
  if (grounded && buoy >= 1) grounded = false;
  // jump
  if (cmd.jump && (grounded || sub > 0.3)) {
    const vj = jumpSpeedFor(g, T) * (grounded ? 1 : 0.5);
    const vv = vx * ux + vy * uy + vz * uz;
    const add = Math.max(0, vj - Math.max(0, vv));
    vx += ux * add; vy += uy * add; vz += uz * add;
    grounded = false;
  }
  // a jet stronger than the weight lifts the feet off
  if (grounded && aJet > g * (1 - buoy) + 0.3) grounded = false;

  const airK = 0.5 * rho * (grounded ? T.cdaUpright : T.cdaFall) / T.mass * (1 - sub);   // 1/m
  const onGround = grounded;

  if (onGround) {
    // ================= on the ground: dynamics in the plane of the terrain ===================
    // LEGS, 1: what carries the body. On open ground the facet under the boots does (exactly as
    // before). Clambering, with a hold on a feature (B.grip), the feet stand on holds and the body
    // is carried on its limbs, not on the facet: gravity acts along the path of the hips, and the
    // tilt of the rock under the boot does not count.
    let q = B.grip ? 0 : 1;
    // A face too steep to hold by friction, but low (the ground one look ahead is within a
    // clamber of the feet), is a step: the walker goes up it on its legs and hands.
    if (q > 0 && qlen > 1e-6 && nu < 0.995 && Math.sqrt(1 - nu * nu) / nu > G.friction + G.foothold && qx * nx + qy * ny + qz * nz < 0) {
      const hS = groundAhead(env, px, py, pz, qx, qy, qz, T.look);
      if (hS - r <= T.clamber) q = 0;
    }
    if (q < 1) {
      nx = ux + (nx - ux) * q; ny = uy + (ny - uy) * q; nz = uz + (nz - uz) * q;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      nu = nx * ux + ny * uy + nz * uz;
    }
    const support = g * nu * (1 - buoy);               // normal acceleration the ground supplies
    // velocity along the surface
    let d = vx * nx + vy * ny + vz * nz;
    let sx = vx - d * nx, sy = vy - d * ny, sz = vz - d * nz;
    const sp = Math.hypot(sx, sy, sz);
    // gravity along the slope (downhill), less buoyancy
    const gk = -g * (1 - buoy);
    let ex = gk * (ux - nu * nx), ey = gk * (uy - nu * ny), ez = gk * (uz - nu * nz);
    // wind load: drag on the velocity relative to the wind, its part along the surface
    let rx = sx - wx, ry = sy - wy, rz = sz - wz;
    const rl = Math.hypot(rx, ry, rz);
    let ax = -airK * rl * rx, ay = -airK * rl * ry, az = -airK * rl * rz;
    d = ax * nx + ay * ny + az * nz; ax -= d * nx; ay -= d * ny; az -= d * nz;
    B.windAccel = Math.hypot(ax, ay, az);
    B.lean = Math.atan2(B.windAccel, g > 1e-6 ? g : 1e-6);
    ex += ax; ey += ay; ez += az;
    // soft ground: the work of pressing a footprint at every step opposes the motion
    if (sp > 1e-6) {
      const res = G.drag * support * Math.tanh(sp / 0.5) / sp;
      ex -= sx * res; ey -= sy * res; ez -= sz * res;
    }
    // wading: liquid drag on the submerged legs and trunk (implicit below), as a rate
    const liqK = depth > 0 ? 0.5 * liq.density * T.wadeWidth * Math.min(depth, T.height) / T.mass : 0;

    // target velocity along the surface: same heading as the wish, same speed
    let tx = 0, ty = 0, tz = 0;
    if (qlen > 1e-6) {
      const k = (qx * nx + qy * ny + qz * nz) / nu;
      tx = qx - ux * k; ty = qy - uy * k; tz = qz - uz * k;
      const tl = Math.hypot(tx, ty, tz);
      // LEGS, 2: clambering, the walker holds the pace at which its feet can follow the ground ahead
      if (tl > 1e-9) { const m = Math.min(qlen, B.paceCap) / tl; tx *= m; ty *= m; tz *= m; }
    }
    // what the legs would like to do: close the velocity error and cancel the outside loads
    let fx = (tx - sx) / T.response - ex, fy = (ty - sy) / T.response - ey, fz = (tz - sz) / T.response - ez;
    // ... limited by leg strength when pushing (braking uses the legs as struts)
    let fl = Math.hypot(fx, fy, fz);
    const along = sp > 0.05 ? (fx * sx + fy * sy + fz * sz) / sp : fl;       // + = propulsive
    if (along > 0 && fl > T.legAccel) { const m = T.legAccel / fl; fx *= m; fy *= m; fz *= m; fl = T.legAccel; }
    // ... by leg power: the propulsive part times the speed cannot exceed legPower / mass
    if (sp > 0.3) {
      const al = (fx * sx + fy * sy + fz * sz) / sp;
      // (the legs' power also lifts the hips when they rise faster than the ground carries them)
      const lift = Math.max(0, B.hipV - (sx * ux + sy * uy + sz * uz));
      const pmax = Math.max(0.2 * T.legPower / T.mass, T.legPower / T.mass - g * (1 - buoy) * lift) / sp;
      if (al > pmax) { const cut = (al - pmax) / sp; fx -= sx * cut; fy -= sy * cut; fz -= sz * cut; fl = Math.hypot(fx, fy, fz); }
    }
    // ... and by the friction circle. A walker does not spin their feet: they push only as hard
    // as the ground will hold (traction control), so the force is the holding force (-outside
    // loads) plus as much of the wanted change as fits inside mu N. Only when the holding force
    // alone exceeds mu N does the body really slide, on kinetic friction.
    const hold = G.friction + G.foothold * (1 - smoothstep(T.runFoothold * 0.4, T.runFoothold, sp));
    const fmax = Math.max(0, hold * support);
    const hl = Math.hypot(ex, ey, ez);
    if (hl > fmax) {
      // cannot even hold: sliding. Friction is kinetic, or better when the body digs in
      const fk = Math.max(0, Math.max(G.kinetic, T.arrest * hold) * support);
      let kx, ky, kz;
      if (sp > 0.05) { kx = -sx / sp; ky = -sy / sp; kz = -sz / sp; } else { kx = -ex / hl; ky = -ey / hl; kz = -ez / hl; }
      // the legs still steer a little within the kinetic circle
      fx = kx * fk; fy = ky * fk; fz = kz * fk;
      B.slip01 = clamp01(1 - fmax / hl);
      B.scramble01 = 1;
    } else {
      B.slip01 = 0;
      if (fl > fmax) {
        const dx = fx + ex, dy = fy + ey, dz = fz + ez;           // wanted change beyond holding
        const a = dx * dx + dy * dy + dz * dz, b = -(ex * dx + ey * dy + ez * dz), c = hl * hl - fmax * fmax;
        const lam = a > 1e-12 ? clamp01((-b + Math.sqrt(Math.max(0, b * b - a * c))) / a) : 0;
        fx = -ex + dx * lam; fy = -ey + dy * lam; fz = -ez + dz * lam;
        B.scramble01 = clamp01(1 - fmax / fl);
      } else B.scramble01 = 0;
    }
    // the suit's thrusters, if PILOT asks for them: close what is left of the velocity error
    let zx = 0, zy = 0, zz = 0;
    if (cmd.assistAccel > 0) {
      zx = (tx - sx) / T.response - (ex + fx); zy = (ty - sy) / T.response - (ey + fy); zz = (tz - sz) / T.response - (ez + fz);
      const zl = Math.hypot(zx, zy, zz);
      if (zl > cmd.assistAccel) { const m = cmd.assistAccel / zl; zx *= m; zy *= m; zz *= m; }
    }
    // integrate along the surface
    sx += (ex + fx + zx) * dt; sy += (ey + fy + zy) * dt; sz += (ez + fz + zz) * dt;
    if (liqK > 0) { const m = 1 / (1 + (liqK * Math.hypot(sx, sy, sz) + visc * Math.min(depth, T.height)) * dt); sx *= m; sy *= m; sz *= m; }
    // LEGS, 2b: with a hold on the rock the limbs brace the body back to that pace (braceAccel), whatever the soles grip
    if (B.grip && B.paceCap < 1e8) {
      const sn = Math.hypot(sx, sy, sz);
      if (sn > B.paceCap) { const m = Math.max(B.paceCap, sn - T.braceAccel * dt) / sn; sx *= m; sy *= m; sz *= m; }
    }
    // snap to rest: never creep
    if (qlen < 1e-6 && B.slip01 === 0 && Math.hypot(sx, sy, sz) < 0.02) { sx = sy = sz = 0; }

    // ---- LEGS, 3: the feet follow the ground, the hips ride above them --------------------------
    // c is the radius of the hips less one leg (c = the ground when standing), B.hip = c - ground,
    // B.hipV the hips' vertical speed. The legs level the hips over the ground (critically damped,
    // legTime) but can only push: the hips fall no faster than gravity, are raised no harder than
    // legLift and caught no harder than legCatch. Between the fold and the reach of the legs the
    // ground may do what it likes under the feet; at the end of the stroke the ground acts:
    //   folded out (the ground rises faster than the hips can be raised): the body is braced
    //     against the face and goes on at the pace its hips can be lifted, never faster than
    //     gravity (and a hold) can stop them again within the stroke;
    //   reached out (the ground falls away faster than the hips fall): with a hold (a convex
    //     feature, holdAhead) the limbs pull the hips down, gripAccel at most, and brace; with
    //     none, or a drop beyond a clamber, the feet leave the ground: a fall, or a bound in low
    //     gravity, with the hips' own velocity.
    const fold = T.legFold, reach = T.legReach;
    const hip0 = B.hip, c0 = r + hip0, w = B.hipV;
    const su = sx * ux + sy * uy + sz * uz;
    const vh = Math.sqrt(Math.max(0, sx * sx + sy * sy + sz * sz - su * su));
    // (the hips' weight in this radial frame: gravity less buoyancy less v^2/r, the round world falling away)
    const gE = g * (1 - buoy) - vh * vh / r;
    let p1x = px + sx * dt, p1y = py + sy * dt, p1z = pz + sz * dt;
    let r1 = Math.hypot(p1x, p1y, p1z) || 1;
    _dir.x = p1x / r1; _dir.y = p1y / r1; _dir.z = p1z / r1;
    let s1 = env.sample(_dir);
    let h1 = s1.radius, n1x = s1.normal.x, n1y = s1.normal.y, n1z = s1.normal.z;
    let dh = h1 - r;
    const gr = dh / dt;                                  // m/s the ground rises under the feet
    // the walker looks ahead while its legs are working (and for half a second after)
    const working = hip0 < -0.06 || hip0 > 0.1;
    let looked = false, feat = false, hD = NaN;
    if ((working || B.clamberT > 0) && vh > 0.2) {
      hD = groundAhead(env, p1x, p1y, p1z, sx, sy, sz, T.look); looked = true;
      // (what stands out of the ground the legs last stood on, B.base, is a feature too: a hold underfoot)
      feat = holdAhead(c0, w, vh, r, hD, T) || (h1 - B.base > 0.1 && r - hD <= T.clamber);
      // a hold once taken is kept until the legs are back at their standing length on plain ground
      if (feat) B.grip = 1; else if (B.grip && r - hD <= T.clamber) feat = true;
    } else if (B.grip) feat = true;                      // (standing still on it, the hold is kept)
    B.clamberT = working ? 0.5 : Math.max(0, B.clamberT - dt);
    if (!working && B.clamberT <= 0) B.grip = 0;
    const pull = feat ? T.gripAccel : 0;
    const trend = Math.max(0, B.trend);
    if (!working) { B.trend += (clamp(gr, -20, 20) - B.trend) * (1 - Math.exp(-dt / T.trendTime)); B.base = r; }   // (a feature the legs are working on is not a hill)
    else B.base += B.trend * dt;
    // level the hips over the ground; about to climb down, stay low instead of standing up on top
    let tgt = h1;
    if (feat && hD < h1) tgt = Math.max(h1 - fold, hD);   // (false when hD is unknown)
    const om = 1 / T.legTime, y0 = c0 - (tgt - dh), v0 = w - gr, ee = Math.exp(-om * dt), kk = v0 + om * y0;
    let c1 = tgt + (y0 + kk * dt) * ee, w1 = gr + (v0 - om * kk * dt) * ee;
    {
      let a = (w1 - w) / dt, cut = false;
      const aMax = w < -0.2 ? T.legCatch : T.legLift, aMin = T.crestLaunch ? -(gE + pull) : -1e9;
      if (a > aMax) { a = aMax; cut = true; } else if (a < aMin) { a = aMin; cut = true; }
      let wn = w + a * dt;
      // the legs do not throw the hips up: beyond the rate the ground has been rising at (B.trend, the
      // slope of the hill being climbed) they raise them no faster than gravity, and a hold, can stop
      // again within the reach that is left
      // (the reach is counted from where the ground was before the legs began to work, B.base, carried on
      // at that rate: what rises under the feet may fall away again as fast)
      if (a > 0 && gE > 0) { const cap = trend + Math.sqrt(Math.max(0, 2 * (gE + pull) * (B.base + reach - c0))); if (wn > cap) { wn = Math.max(w, cap); cut = true; } }
      if (cut) { w1 = wn; c1 = c0 + 0.5 * (w + w1) * dt; }
    }
    let lam = 1, held = true;
    if (c1 < h1 - fold) {
      // folded out
      const capB = Math.max(w, Math.sqrt(Math.max(0, 0.5 * (gE + pull) * (fold + reach))));   // (a quarter of the stroke: the rest is kept for the far side)
      const cUp = Math.min(c0 + capB * dt, Math.max(c0, r + reach));
      if (h1 - fold <= cUp) { c1 = h1 - fold; w1 = Math.max(w1, Math.min(capB, (c1 - c0) / dt)); }
      else if (dh > T.clamber && vh * dt > 1e-6) { c1 = Math.max(c0, r - fold); w1 = 0; lam = 0; }   // a wall, not a step: it stops the body
      else { c1 = cUp; w1 = Math.min(capB, Math.max(w1, (c1 - c0) / dt)); lam = dh > 1e-9 ? clamp01((c1 + fold - r) / dh) : 1; }
    } else if (c1 > h1 + reach) {
      // reached out
      if (!looked) { hD = groundAhead(env, p1x, p1y, p1z, sx, sy, sz, T.look); feat = feat || holdAhead(c0, w, vh, r, hD, T) || (h1 - B.base > 0.1 && r - hD <= T.clamber); if (feat) B.grip = 1; }
      held = false;
      if (feat || !T.crestLaunch) {
        const gp = gE + T.gripAccel, cLow = c0 + w * dt - 0.5 * gp * dt * dt;    // the lowest the hold can bring the hips
        if (h1 + reach >= cLow) { c1 = h1 + reach; w1 = Math.max((c1 - c0) / dt, w - gp * dt); held = true; }
        else if (cLow <= r + reach + 1e-6 || !T.crestLaunch) {
          const l2 = dh < -1e-9 ? clamp01((cLow - reach - r) / dh) : 0;
          if ((1 - l2) * vh <= T.braceDv || !T.crestLaunch) { lam = l2; c1 = cLow; w1 = w - gp * dt; held = true; }
        }
      }
    }
    B.brace = 0;
    if (held && lam < 1) {
      // braced: the feet take only part of the step, and the rest of the forward speed is lost
      B.brace = (1 - lam) * vh;
      sx *= lam; sy *= lam; sz *= lam;
      p1x = px + sx * dt; p1y = py + sy * dt; p1z = pz + sz * dt;
      r1 = Math.hypot(p1x, p1y, p1z) || 1;
      _dir.x = p1x / r1; _dir.y = p1y / r1; _dir.z = p1z / r1;
      s1 = env.sample(_dir);
      h1 = s1.radius; n1x = s1.normal.x; n1y = s1.normal.y; n1z = s1.normal.z;
      if (c1 < h1 - fold) c1 = h1 - fold;                // (a face the legs cannot fold onto: the hips are heaved up it)
      else if (c1 > h1 + reach) c1 = h1 + reach;
    }
    if (!held) {
      // the feet leave the ground at full stretch, with the hips' velocity
      grounded = false;
      const rr = Math.max(h1, c1 - reach), vv1 = w1 - su;
      px = _dir.x * rr; py = _dir.y * rr; pz = _dir.z * rr;
      vx = sx + vv1 * ux; vy = sy + vv1 * uy; vz = sz + vv1 * uz;
      B.hip = 0; B.hipV = 0; B.trend = 0; B.paceCap = 1e9; B.clamberT = 0; B.grip = 0;
    } else {
      px = _dir.x * h1; py = _dir.y * h1; pz = _dir.z * h1;
      B.hip = clamp(c1 - h1, -fold, reach); B.hipV = w1;
      // the pace the feet can follow: the hips must be down within reach of the ground one look
      // ahead by the time the feet are there
      B.paceCap = 1e9;
      if (feat && hD === hD) {
        const gp = Math.max(0.1, gE + T.gripAccel), D = c1 - hD - reach;
        if (D > 0) {
          B.paceCap = T.look * gp / (w1 + Math.sqrt(w1 * w1 + 2 * gp * D));
          // ... and on the way there the ground must not fall away faster than the hips can be
          // brought down within the reach that is left: v x slope <= -w + sqrt(2 (g + grip) room)
          const slope = Math.max(vh > 0.2 ? -(h1 - r) / (vh * lam * dt + 1e-9) : 0, (h1 - hD) / T.look);
          if (slope > 0.05) { const cap = (-w1 + Math.sqrt(2 * gp * Math.max(0, reach - B.hip))) / slope; if (cap < B.paceCap) B.paceCap = cap; }
          if (B.paceCap < 0.5) B.paceCap = 0.5;
        }
      }
      // the velocity lies along the ground as the legs carry it (see LEGS, 1) at the new place
      { const l = Math.hypot(n1x, n1y, n1z); if (l > 1e-9) { n1x /= l; n1y /= l; n1z /= l; } else { n1x = _dir.x; n1y = _dir.y; n1z = _dir.z; } }
      const q1 = q === 0 || B.grip ? 0 : 1;
      if (q1 < 1) {
        n1x = _dir.x + (n1x - _dir.x) * q1; n1y = _dir.y + (n1y - _dir.y) * q1; n1z = _dir.z + (n1z - _dir.z) * q1;
        const l = Math.hypot(n1x, n1y, n1z); n1x /= l; n1y /= l; n1z /= l;
      }
      const vsep = sx * n1x + sy * n1y + sz * n1z;
      vx = sx - vsep * n1x; vy = sy - vsep * n1y; vz = sz - vsep * n1z;
      // keep the speed when the slope merely changes under the feet
      const a = Math.hypot(sx, sy, sz), b = Math.hypot(vx, vy, vz);
      if (b > 1e-6 && a > b && vsep > 0) { const m = a / b; vx *= m; vy *= m; vz *= m; }
    }
    B.clamber01 = grounded ? clamp01(Math.max(-B.hip / fold, B.hip / reach)) : 0;
    B.support = grounded ? support : 0;
    B.jetUse = 0;
  }

  if (!onGround) {
    // ======================= in the air or afloat =============================================
    let vv = vx * ux + vy * uy + vz * uz;
    let hx = vx - vv * ux, hy = vy - vv * uy, hz = vz - vv * uz;
    // steering: vectored jet thrust, or the suit's small thrusters, or swimming strokes
    let lx = 0, ly = 0, lz = 0, lat = 0;
    const ac = cmd.airControl == null ? 1 : cmd.airControl;
    if (sub > 0.3) {
      const amax = T.swimForce / T.mass;
      lx = (qx - hx) / T.swimTime; ly = (qy - hy) / T.swimTime; lz = (qz - hz) / T.swimTime;
      lat = Math.hypot(lx, ly, lz);
      if (lat > amax) { const m = amax / lat; lx *= m; ly *= m; lz *= m; lat = amax; }
    } else if (qlen > 1e-6 || aJet > 0) {
      const tau = aJet > 0 ? T.jetSteerTime : T.rcsTime;
      const amax = Math.max(aJet * T.jetVector, T.rcsAccel) * ac;
      if (qlen > 1e-6) {
        lx = (qx - hx) / tau; ly = (qy - hy) / tau; lz = (qz - hz) / tau;
        lat = Math.hypot(lx, ly, lz);
        if (lat > amax) { const m = amax / lat; lx *= m; ly *= m; lz *= m; lat = amax; }
      }
    }
    // the jet's sideways share comes out of its lift (thrust is one vector)
    let jetUp = aJet;
    if (aJet > 0 && lat > T.rcsAccel * ac) {
      const side = Math.min(lat - T.rcsAccel * ac, aJet * T.jetVector);
      jetUp = Math.sqrt(Math.max(0, aJet * aJet - side * side));
    }
    // governor: ease the thrust off as the climb reaches its cap
    const gEff = g * (1 - buoy);
    if (aJet > 0 && cmd.jetMaxRise != null && cmd.jetMaxRise < 1e8) {
      const want = gEff + (cmd.jetMaxRise - vv) / 0.25;
      if (jetUp > want) jetUp = Math.max(0, want);
    }
    B.jetUse = aJet > 0 ? clamp01(B.jetThrottle * (0.25 + 0.75 * jetUp / aJet)) : 0;
    // automatic descent brake
    let retro = 0;
    if (cmd.descentLimit != null && cmd.descentLimit < 1e8 && vv < -cmd.descentLimit && sub < 0.3) {
      retro = clamp((-vv - cmd.descentLimit) / 0.12 + gEff, 0, T.retroAccel);
    }
    vv += (-gEff + jetUp + retro) * dt;
    hx += lx * dt; hy += ly * dt; hz += lz * dt;
    vx = hx + vv * ux; vy = hy + vv * uy; vz = hz + vv * uz;
    // air drag on the velocity relative to the wind (implicit: exact for quadratic drag)
    if (airK > 0) {
      const rx = vx - wx, ry = vy - wy, rz = vz - wz;
      const m = 1 / (1 + airK * Math.hypot(rx, ry, rz) * dt);
      vx = wx + rx * m; vy = wy + ry * m; vz = wz + rz * m;
      B.windAccel = airK * Math.hypot(wx, wy, wz) * Math.hypot(wx, wy, wz);
    } else B.windAccel = 0;
    // liquid drag: vertical and horizontal
    if (sub > 0) {
      const kv = 0.5 * liq.density * T.sinkCdaV / T.mass * Math.min(1, sub * 3);
      const kh = 0.5 * liq.density * (T.swimCda + T.wadeWidth * 0.25 * sub) / T.mass;
      vv = vx * ux + vy * uy + vz * uz;
      hx = vx - vv * ux; hy = vy - vv * uy; hz = vz - vv * uz;
      const kvis = visc * sub * T.height;
      vv /= 1 + (kv * Math.abs(vv) + kvis) * dt;
      const hm = 1 / (1 + (kh * Math.hypot(hx, hy, hz) + kvis) * dt);
      // bobbing is damped by wave-making as well as by drag
      vv *= Math.exp(-2.2 * dt * Math.min(1, sub * 3));
      vx = hx * hm + vv * ux; vy = hy * hm + vv * uy; vz = hz * hm + vv * uz;
    }
    px += vx * dt; py += vy * dt; pz += vz * dt;
    // meet the ground
    const r1 = Math.hypot(px, py, pz) || 1;
    _dir.x = px / r1; _dir.y = py / r1; _dir.z = pz / r1;
    const s1 = env.sample(_dir);
    if (r1 <= s1.radius) {
      let n1x = s1.normal.x, n1y = s1.normal.y, n1z = s1.normal.z;
      { const l = Math.hypot(n1x, n1y, n1z); if (l > 1e-9) { n1x /= l; n1y /= l; n1z /= l; } else { n1x = _dir.x; n1y = _dir.y; n1z = _dir.z; } }
      px = _dir.x * s1.radius; py = _dir.y * s1.radius; pz = _dir.z * s1.radius;
      const vn = vx * n1x + vy * n1y + vz * n1z;
      let hipIn = 0;
      if (vn < 0) {
        // (P11) A LEGGED landing. Until P11 this was the landing of a rigid block: the whole normal speed
        // gone in one step and a Coulomb impulse (kinetic friction x that speed) off the tangential part,
        // so a jump from a walk came down with the legs straight (hip 0 on the landing frame and after)
        // and lost half its forward speed at the touch (4.17 to 2.04 m/s on Earth, 4.13 to 2.19 on the
        // Moon: the filmstrips). A person lands on the legs: the feet stop, the hips go on down and the
        // legs take them up over their stroke (legCatch at most, legFold deep: up to 5.2 m/s), and since
        // no blow is struck there is no friction impulse: the forward speed is kept, as in every stride
        // of a run. Only the part of the normal speed the stroke cannot take is a blow, with its friction.
        const soft = Math.min(-vn, Math.sqrt(2 * T.legCatch * T.legFold)), hard = -vn - soft;
        vx -= vn * n1x; vy -= vn * n1y; vz -= vn * n1z;
        if (hard > 0) {
          const vt = Math.hypot(vx, vy, vz);
          const G1 = env.ground ? env.ground(s1, _gnd) : DEFAULT_GROUND;
          const cut = G1.kinetic * hard;
          const m = vt > 1e-6 ? Math.max(0, 1 - cut / vt) : 0;
          vx *= m; vy *= m; vz *= m;
        }
        B.impact = -vn;
        hipIn = -soft * (n1x * _dir.x + n1y * _dir.y + n1z * _dir.z);
      }
      // touching down only counts when buoyancy does not carry the body there
      const l1 = (s1.liquidRadius || 0) > s1.radius ? s1.liquidRadius - s1.radius : 0;
      if (clamp01(l1 / T.height) * liq.density / rhoBody < 1) { grounded = true; B.hip = 0; B.hipV = vx * _dir.x + vy * _dir.y + vz * _dir.z + hipIn; }
    }
    B.support = 0; B.brace = 0; B.paceCap = 1e9; B.clamber01 = 0; B.clamberT = 0;
    if (!grounded) { B.hip = 0; B.hipV = 0; B.trend = 0; B.grip = 0; }
    B.slip01 = grounded ? 0 : B.slip01 * 0.9;
    B.scramble01 = 0;
  }

  // ---- report ------------------------------------------------------------------------------------
  const rF = Math.hypot(px, py, pz) || 1;
  const vvF = (vx * px + vy * py + vz * pz) / rF;
  B.speedGround = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - vvF * vvF));
  B.material = G.material; B.friction = G.friction;
  B.puff = B.impact > B.puff ? B.impact : B.puff * Math.exp(-dt / 0.1);
  if (B.puff < 0.05) B.puff = 0;
  const sinkT = grounded ? G.sink * (0.7 + 0.3 * Math.min(1, B.speedGround / 3)) + Math.min(0.1, B.impact * 0.01) : 0;
  B.sink += (sinkT - B.sink) * (1 - Math.exp(-dt / 0.08));
  B.dust = grounded ? clamp01((G.dust || 0) * (0.15 + B.speedGround / 6 + B.slip01 + B.impact * 0.15)) : 0;
  st.p.x = px; st.p.y = py; st.p.z = pz;
  st.v.x = vx; st.v.y = vy; st.v.z = vz;
  st.grounded = grounded;
  return st;
}

// The steady speed (m/s) the legs can hold on level ground of contact `G` in air of density rho
// under gravity g, for a wished speed: the smaller of the wish and what power, friction and
// drag allow. For PILOT's HUD or tests; the step function needs none of it.
export function sustainableSpeed(wish, g, rho, G = DEFAULT_GROUND, T = EXPLORER_BODY) {
  const k = 0.5 * rho * T.cdaUpright / T.mass;
  let lo = 0, hi = wish;
  if (!(g > 0)) return 0;
  const ok = (v) => {
    const need = G.drag * g * Math.tanh(v / 0.5) + k * v * v;      // m/s^2 of propulsion needed
    return need <= Math.min(T.legAccel, (G.friction + G.foothold * (1 - smoothstep(T.runFoothold * 0.4, T.runFoothold, v))) * g) && need * v <= T.legPower / T.mass;
  };
  if (ok(hi)) return hi;
  for (let i = 0; i < 30; i++) { const m = 0.5 * (lo + hi); if (ok(m)) lo = m; else hi = m; }
  return lo;
}
