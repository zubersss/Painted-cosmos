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
  stickGap: 0.28,         // m: how far the feet reach down to keep contact over an edge
  crestFilter: 0.15,      // s: the legs absorb bumps shorter than this before the body goes ballistic
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
  unload: 0,              // filtered vertical acceleration of the ground being followed
  vvPrev: 0,
  support: 0,             // m/s^2 of normal support from the ground (0 when floating or airborne)
  impact: 0,              // m/s of the last landing (normal speed), set on the landing step
  material: 'soil',
  friction: 0.7,
  dust: 0,                // 0..1 fines raised by the feet right now
  speedGround: 0,         // m/s along the ground
});

const _air = { density: 1.225, wind: { x: 0, y: 0, z: 0 } };
const _gnd = {};
const _dir = { x: 0, y: 0, z: 0 };
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
//          liquid: { density }                       optional (default: water) }
// Returns st. Sets st.grounded, st.p, st.v and st.phys.*; never allocates after the first call.
export function stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY) {
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
  const G = env.ground ? env.ground(s0, _gnd) : DEFAULT_GROUND;
  const liq = env.liquid || DEFAULT_LIQUID;
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
      if (tl > 1e-9) { const m = qlen / tl; tx *= m; ty *= m; tz *= m; }
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
      const pmax = T.legPower / T.mass / sp;
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
    if (liqK > 0) { const m = 1 / (1 + liqK * Math.hypot(sx, sy, sz) * dt); sx *= m; sy *= m; sz *= m; }
    // snap to rest: never creep
    if (qlen < 1e-6 && B.slip01 === 0 && Math.hypot(sx, sy, sz) < 0.02) { sx = sy = sz = 0; }

    // move, then meet the ground again
    let p1x = px + sx * dt, p1y = py + sy * dt, p1z = pz + sz * dt;
    const r1 = Math.hypot(p1x, p1y, p1z) || 1;
    _dir.x = p1x / r1; _dir.y = p1y / r1; _dir.z = p1z / r1;
    const s1 = env.sample(_dir);
    const gap = r1 - s1.radius;
    let n1x = s1.normal.x, n1y = s1.normal.y, n1z = s1.normal.z;
    { const l = Math.hypot(n1x, n1y, n1z); if (l > 1e-9) { n1x /= l; n1y /= l; n1z /= l; } else { n1x = _dir.x; n1y = _dir.y; n1z = _dir.z; } }
    const vsep = sx * n1x + sy * n1y + sz * n1z;
    // does the ground fall away faster than gravity can follow? (filtered: legs absorb bumps)
    const vvNow = sx * _dir.x + sy * _dir.y + sz * _dir.z;
    const aFollow = (vvNow - B.vvPrev) / dt;
    B.vvPrev = vvNow;
    B.unload += (aFollow - B.unload) * (1 - Math.exp(-dt / T.crestFilter));
    const launch = T.crestLaunch && B.unload < -g * (1 - buoy) * 1.05 && sp > 1.5;
    if (gap > T.stickGap || vsep > Math.sqrt(2 * g * T.stickGap) || launch) {
      // off an edge or over a crest: ballistic from here
      grounded = false;
      vx = sx; vy = sy; vz = sz;
      px = p1x; py = p1y; pz = p1z;
      B.unload = 0;
    } else {
      px = _dir.x * s1.radius; py = _dir.y * s1.radius; pz = _dir.z * s1.radius;
      vx = sx - vsep * n1x; vy = sy - vsep * n1y; vz = sz - vsep * n1z;
      // keep the speed when the slope merely changes under the feet
      const a = Math.hypot(sx, sy, sz), b = Math.hypot(vx, vy, vz);
      if (b > 1e-6 && a > b && vsep > 0) { const m = a / b; vx *= m; vy *= m; vz *= m; }
    }
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
      vv /= 1 + kv * Math.abs(vv) * dt;
      const hm = 1 / (1 + kh * Math.hypot(hx, hy, hz) * dt);
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
      if (vn < 0) {
        // inelastic landing; Coulomb friction impulse on the tangential part
        vx -= vn * n1x; vy -= vn * n1y; vz -= vn * n1z;
        const vt = Math.hypot(vx, vy, vz);
        const G1 = env.ground ? env.ground(s1, _gnd) : DEFAULT_GROUND;
        const cut = G1.kinetic * (-vn);
        const m = vt > 1e-6 ? Math.max(0, 1 - cut / vt) : 0;
        vx *= m; vy *= m; vz *= m;
        B.impact = -vn;
      }
      // touching down only counts when buoyancy does not carry the body there
      const l1 = (s1.liquidRadius || 0) > s1.radius ? s1.liquidRadius - s1.radius : 0;
      if (clamp01(l1 / T.height) * liq.density / rhoBody < 1) { grounded = true; B.vvPrev = vx * _dir.x + vy * _dir.y + vz * _dir.z; B.unload = 0; }
    }
    B.support = 0;
    B.slip01 = grounded ? 0 : B.slip01 * 0.9;
    B.scramble01 = 0;
  }

  // ---- report ------------------------------------------------------------------------------------
  const rF = Math.hypot(px, py, pz) || 1;
  const vvF = (vx * px + vy * py + vz * pz) / rF;
  B.speedGround = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - vvF * vvF));
  B.material = G.material; B.friction = G.friction;
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
