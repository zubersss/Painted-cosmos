// The ship: forgiving arcade flight. Pure (no three).
//
// The ship is an anti-gravity craft, not an aeroplane: it hovers when you let go, it levels its
// own wings, it will not let you fly into the ground (it rides a cushion and pulls up over
// rising terrain), and if you manage to touch something anyway it bounces softly. Throttle is
// persistent (set it and look around). The mouse points the nose.
import {
  V, add, sub, scale, addScaled, dot, len, norm, cross, reject, tangent, clampLen, lerp,
  clamp, clamp01, mix, damp, smoothstep,
  qMul, qFromAxisAngle, qRotate, qNorm, qSlerp, qLook,
} from '../core/vec.js';

export const SHIP = Object.freeze({
  // speeds (m/s)
  speedGround: 46,           // top speed skimming the ground
  speedAtmoTop: 160,         // top speed at the edge of space
  speedSpace: 750,           // cruise in space (the pulse drive is separate)
  liftSpeed: 18,             // vertical thrusters (Space / C) in the atmosphere
  liftSpeedSpace: 90,
  tauAtmo: 1.0,              // s: time constant of velocity following the nose and throttle
  tauSpace: 1.7,             // s: more glide in space
  throttleRate: 0.8,         // per second while W or S is held
  brakeFactor: 0.45,         // X shortens the velocity time constant by this much
  reverseMax: -0.2,
  // steering
  steerRate: 7.5,            // 1/s: how fast the nose swings to where the mouse asked
  maxTurn: 1.6,              // rad/s
  pendingMax: 0.9,           // rad of mouse aim that may be queued
  keyYawRate: 0.85,          // rad/s from A / D
  pitchLimit: 1.36,          // rad (78 deg) nose up or down in a world's air (above it none: a world's mark overhead must be reachable)
  airPitchGain: 0.8,         // share of the mouse's pitch in a world's air (fast over the ground a 120 px drag
                             // was a dive turned into a climb: M4's blind play-test); 1 above the air
  airTop: 2.5,               // the air's ways (pitch limit, levelling to the horizon, following the curve of
                             // the world, the gentler pitch) fade out from the edge of space to this many times its height
  bankGain: 0.55,            // rad of bank per rad/s of turn
  maxBank: 0.62,             // rad
  rollLevelRate: 3.2,        // 1/s wings-level strength
  spaceLevel: 0.35,          // how much of that levelling survives in deep space (to ecliptic up)
  // ground
  cushionHeight: 7,          // m: below this the descent rate is limited
  cushionDecel: 6.5,         // m/s^2: the braking the cushion plans with at any height
  minClearance: 1.6,         // m: the hull never goes lower in free flight
  fastSkim: 50,              // m/s: faster than this (the thin-air worlds, a dive out of space) the hull rides higher,
  fastSkimRise: 0.25,        // m more for each m/s (8.6 m at 78 m/s, 24 m at 138, 42 m at 210): room to lift over what comes
  lookAhead: 0.8,            // s of terrain look-ahead for the automatic pull-up, at least...
  lookMin: 30,               // m: ...this far, and at least as far as the hull needs to stop in:
  lookDecel: 10,             // m/s^2 (the look reaches v^2 / (2 lookDecel) + v lookAhead: 143 m at 46 m/s; it was 37 m)
  lookAt: Object.freeze([0.03, 0.07, 0.14, 0.25, 0.42, 0.66, 1]),   // where along that reach the ground is looked at (4 to 143 m at 46 m/s)
  assistLift: 14,            // m/s^2 beyond the weight: the most the assist changes the hull's vertical speed by itself (PHYSICS' accelLift)
  assistField: 160,          // m/s^2: the most it brakes a sink that the lift alone could not stop above the ground (the drive field: PHYSICS' fieldBrake)...
  assistFieldSoft: 60,       // m/s^2: ...and above the tree tops, which are not a wall
  assistRise: 8,             // m/s: how fast the assist lifts a hull that is under the tree tops (an abandoned landing)
  assistCrawl: 1.5,          // m/s: the least forward speed kept at the foot of a wall the hull is climbing
  flareHeight: 75,           // m: below this a dive is progressively levelled out
  flareAngle: 0.07,          // rad: the steepest dive allowed at cushion height
  flareRate: 4.5,            // 1/s
  bounceRestitution: 0.35,
  // sequences
  hoverHeight: 9,            // m: where the lift-off sequence leaves you
  liftoffClimb: 4.2,         // m/s: rise speed off the landing gear (with PHYSICS)
  liftoffRise: 8,            // m/s: the rise from the hover height on up through a wood, to clear its crowns
  liftoffClear: 3,           // m over the floor free flight uses (the tree tops) at which the lift-off hands over
  liftoffSeconds: 2.8,
  landGlideSpeed: 14,        // m/s sideways toward the chosen spot
  landMaxDescent: 6,         // m/s near the ground (it was 13: a plunge into the wood)...
  landHighDescent: 9,        // m/s ...and from high up (over landHighAlt), eased between
  landHighAlt: 60,           // m
  landAccel: 8,              // m/s^2: the most the assist changes the hull's level velocity by (the hull's own thrusters give 14 to 18)
  landAccelDown: 5,          // m/s^2: and its vertical velocity (half a g: a lift setting off, not a drop)
  landGlideDecel: 4,         // m/s^2 the glide plans to stop with at the site
  landMinDescent: 1.1,       // m/s at touchdown: soft
  landMaxSlope: 0.62,        // rad: steeper spots are refused
  landClearance: 6,          // m: trees and boulders closer than this to the spot count against it
  landFootprint: 4.5,        // m from the middle: the ground is looked at this far out all round (the legs, the hatch)
});

export function createShipState(p, q) {
  return {
    p: { ...p }, v: V(), q: qNorm(q),
    throttle: 0,
    pending: { yaw: 0, pitch: 0 },
    turnRate: 0,               // smoothed right-turn rate (rad/s), drives the bank
    gear01: 1, canopy01: 0, throttle01: 0,
    liftoff: null,             // { t, base } while the lift-off sequence runs
    landing: null,             // { dir, floor, normal, phase } while the landing assist runs
    bounce: 0,                 // seconds since the last soft bounce (for feedback)
    bounces: 0,
    altGround: 0,              // metres above ground or liquid (0 when unknown)
    speed: 0,
  };
}

// Surface under a body-local position: floor = solid ground or liquid, whichever is higher.
export function floorAt(sample, p) {
  const r = len(p);
  const s = sample(scale(p, 1 / r));
  const liquid = (s.liquidRadius || 0) > s.radius;
  return { floor: liquid ? s.liquidRadius : s.radius, normal: liquid ? scale(p, 1 / r) : norm(s.normal, p), slope: liquid ? 0 : s.slope, liquid, r, canopyHeight: s.canopyHeight || 0 };
}

export function maxSpeedAt(altitude, spaceAlt, hasBody, T = SHIP) {
  if (!hasBody) return T.speedSpace;
  const a = altitude / spaceAlt;
  if (a < 1) return mix(T.speedGround, T.speedAtmoTop, smoothstep(0.01, 1, a));
  return mix(T.speedAtmoTop, T.speedSpace, smoothstep(1, 5, a));
}

// input: { aimX, aimY (radians of mouse aim this step: +X right, +Y nose down), yawKey (-1..1),
//          throttle (-1..1 from W/S), cut (bool), lift (-1..1 from Space/C) }
// env:   { up (unit, frame space, toward "above the planet"; null in deep space),
//          universeUp (unit, frame space), upWeight (0..1, 1 near a planet),
//          altitude (m above the body's base radius), spaceAlt, hasBody,
//          sample (body-local sampler, only in the ground frame; else null) }
export function stepFlight(st, input, dt, env, T = SHIP) {
  const w = env.up ? clamp01(env.upWeight) : 0;
  const upRef = env.up ? norm(lerp(env.universeUp, env.up, w), env.up) : env.universeUp;
  // How much of the air's ways hold here: all of them in a world's air, none from airTop times
  // the height of the air on (M4's blind play-test: climbing out of Venus with its mark overhead,
  // the 78 degree limit, held to 9 km up, kept the mark an arrow at the top of the picture, and
  // A / D, turning round Venus' up, only swung that arrow round the edge).
  const wa = env.hasBody && env.up ? w * (1 - smoothstep(env.spaceAlt, env.spaceAlt * T.airTop, env.altitude)) : 0;
  const level = mix(T.spaceLevel, 1, wa);

  // ---- steering ------------------------------------------------------------------------
  st.pending.yaw = clamp(st.pending.yaw + (input.aimX || 0), -T.pendingMax, T.pendingMax);
  st.pending.pitch = clamp(st.pending.pitch + (input.aimY || 0) * mix(1, T.airPitchGain, wa), -T.pendingMax, T.pendingMax);
  const k = damp(T.steerRate, dt);
  const turn = env.pulseSpeed != null ? (env.turnScale == null ? 0.3 : env.turnScale) : 1;
  let yawStep = clamp(st.pending.yaw * k, -T.maxTurn * dt, T.maxTurn * dt) * turn;       // + = right
  let pitchStep = clamp(st.pending.pitch * k, -T.maxTurn * dt, T.maxTurn * dt) * turn;   // + = nose down
  st.pending.yaw -= yawStep / turn;
  st.pending.pitch -= pitchStep / turn;
  yawStep += (input.yawKey || 0) * T.keyYawRate * dt * turn;
  if (st.liftoff) { pitchStep = 0; st.pending.pitch = 0; }

  let q = st.q;
  let f = qRotate(q, V(0, 0, -1));
  const shipUp = qRotate(q, V(0, 1, 0));
  if (w > 0.3 && env.hasBody && env.altitude < env.spaceAlt) {
    // In a world's air the nose cannot go past the pitch limit: no accidental loops (above it,
    // in space, a world's mark overhead must be reachable).
    const elev = Math.asin(clamp(dot(f, upRef), -1, 1));
    const lim = T.pitchLimit;
    if (pitchStep < 0 && elev - pitchStep > lim) pitchStep = Math.min(0, -(lim - elev));
    if (pitchStep > 0 && elev - pitchStep < -lim) pitchStep = Math.max(0, elev + lim);
  }
  // A / D turn round the world's up while the nose is near its horizon, round the ship's own up
  // as it points up or down (round the world's up they would only roll the picture).
  const cosE0 = Math.sqrt(Math.max(0, 1 - dot(f, upRef) ** 2));
  const yawAxis = norm(lerp(shipUp, upRef, level * smoothstep(0.17, 0.5, cosE0)), shipUp);
  const right = qRotate(q, V(1, 0, 0));
  q = qMul(qFromAxisAngle(yawAxis, -yawStep), qMul(qFromAxisAngle(right, -pitchStep), q));
  st.turnRate = mix(st.turnRate, dt > 0 ? yawStep / dt : 0, damp(5, dt));

  // ---- wings level, with a bank into turns -----------------------------------------------
  f = qRotate(q, V(0, 0, -1));
  const cosElev = Math.sqrt(Math.max(0, 1 - dot(f, upRef) ** 2));
  if (cosElev > 0.06) {
    const rWant = norm(cross(f, upRef));
    const r = qRotate(q, V(1, 0, 0));
    const roll = Math.atan2(dot(cross(rWant, r), f), dot(rWant, r));     // + = right wing down
    const want = clamp(st.turnRate * T.bankGain, -T.maxBank, T.maxBank) * clamp01(cosElev * 2);
    const corr = (want - roll) * damp(T.rollLevelRate * level, dt) * clamp01(cosElev * 3);
    q = qMul(qFromAxisAngle(f, corr), q);
  }
  // ---- flare: the lower the ship, the less steeply it may point at the ground -----------------
  const up = env.up || null;
  // The floor under the ship: ground or liquid, plus the tree canopy when the caller knows it.
  const floorOf = env.floor || (env.sample ? (q) => floorAt(env.sample, q) : null);
  let ground = null;
  if (floorOf && up) ground = floorOf(st.p);
  // Near the ground the ship is slow (you are looking at a painting, not racing over it).
  const altForSpeed = ground ? Math.max(0, ground.r - ground.floor) : env.altitude;
  // Each world flies at its own pace near the ground: fast and loose in thin air, slow and
  // heavy in thick (env.speedScale, from the body's air; 1 on Earth and without PHYSICS).
  const paceBlend = env.hasBody ? 1 - smoothstep(env.spaceAlt, env.spaceAlt * 4, env.altitude) : 0;
  const vmax = maxSpeedAt(altForSpeed, env.spaceAlt, env.hasBody, T) * mix(1, env.speedScale || 1, paceBlend);
  const liftSpeed = clamp(vmax * 0.42, T.liftSpeed, T.liftSpeedSpace);
  // The ground assists of this step (the climb the ground ahead asks for, the sink the cushion
  // allows, the forward speed to keep), worked out once and used on the request and on the hull.
  if (ground && !st.liftoff) {
    const alt = ground.r - ground.floor;
    let minElev = -mix(T.flareAngle, T.pitchLimit, smoothstep(T.cushionHeight, T.flareHeight, alt));
    // Ground rising ahead (the last step's look): the nose comes up to level with the climb (it
    // used to stay pointed at the slope while the hull was lifted over it).
    if (st._assist && st._assist.ahead > 1) minElev = Math.max(minElev, 0);
    const elev = Math.asin(clamp(dot(f, up), -1, 1));
    if (elev < minElev && cosElev > 0.06) {
      const lift = Math.min((minElev - elev) * damp(T.flareRate, dt), T.maxTurn * dt);
      q = qMul(qFromAxisAngle(norm(cross(f, up)), lift), q);
      st.pending.pitch = Math.min(st.pending.pitch, 0);        // forget queued nose-down
    }
  }
  st.q = qNorm(q);
  f = qRotate(st.q, V(0, 0, -1));

  // ---- throttle and velocity ---------------------------------------------------------------
  if (!st.liftoff) {
    st.throttle = clamp(st.throttle + (input.throttle || 0) * T.throttleRate * dt, T.reverseMax, 1);
    if (input.cut) st.throttle = mix(st.throttle, 0, damp(6, dt));
  }
  const liftDir = w > 0.3 ? upRef : qRotate(st.q, V(0, 1, 0));
  let target = add(scale(f, st.throttle * vmax), scale(liftDir, (input.lift || 0) * liftSpeed));
  // C sinks and Space rises whatever the nose does: the lift's speed is the least of it (with
  // the nose up at speed, C held 12 s climbed from 225 to 320 m: M4's blind play-test).
  if (input.lift && w > 0.3) {
    const vu = dot(target, liftDir), want = input.lift * liftSpeed;
    if (input.lift < 0 ? vu > want : vu < want) target = addScaled(target, liftDir, want - vu);
  }
  // The ground assists of this step (the climb the ground ahead asks for, the sink the cushion
  // allows, the forward speed the hull may keep), worked out once and used on the request and
  // on the hull.
  const assist = ground && !st.liftoff ? groundAssist(st, target, ground, up, floorOf, liftSpeed, T) : null;
  // X is a real brake: the ship stops in about half the usual time.
  const inAir = env.hasBody && env.altitude < env.spaceAlt;
  const tau = mix(T.tauSpace, T.tauAtmo, inAir ? 1 : 0) * (input.cut ? T.brakeFactor : 1);
  let v;
  const vUpWas = up ? dot(st.v, up) : 0;      // (PHYSICS' body moves st.v in place)
  // In vacuum the drive field that makes the pulse possible is also the brake (PHYSICS'
  // `cmd.brake`): it sheds the speed the 14 m/s2 retro thrusters cannot, so X or throttling
  // down stops the ship in seconds, not minutes. Flight in air stays on thrusters alone.
  const body = env.shipBody && !st.liftoff && env.pulseSpeed == null ? env.shipBody : null;
  if (env.pulseSpeed != null) {
    // Pulse drive: the speed is the drive's, the direction is the nose.
    v = add(st.v, scale(sub(scale(f, env.pulseSpeed), st.v), damp(5, dt)));
  } else if (body) {
    // PHYSICS' ship: the flight computer asks for `target`; thrust, drag, gravity, lift and
    // gusts decide what the hull actually does. The assists below shape the request first.
    let tauBody = tau;
    if (assist) {
      target = shapeTarget(target, assist, up, true);
      // Sinking faster than the cushion allows, or terrain rising ahead: the flight computer
      // is told to close that error at once, not at its leisure.
      const vUpNow = dot(st.v, up);
      if (vUpNow < -st.sinkLimit || dot(target, up) > vUpNow + 4 || assist.vhCap < len(reject(st.v, up))) tauBody = Math.min(tau, 0.22);
    }
    // (The body model moves st.p in place; this function integrates the position once, below,
    // after the assists have had their say, so the starting point is kept by value.)
    const p0 = { x: st.p.x, y: st.p.y, z: st.p.z };
    // carve01: PHYSICS' named assist that turns the velocity onto the nose without changing
    // the speed, so steering stays arcade while every change of speed keeps its mass.
    // (PHYSICS' suggestion, taken: no carve at low speed, where a little slide reads as weight;
    // full carve from 70 m/s, so a turn at cruise does not cost a third of the speed.)
    const cmd = st._cmd || (st._cmd = { hover: true });
    cmd.target = target; cmd.tau = tauBody; cmd.boost = !inAir; cmd.carve01 = smoothstep(20, 70, st.speed);
    // In vacuum the field brake is whole; in thin air (Mars, the airless worlds' ground frame)
    // X gets the share the world allows (env.airBrake); in thick air the thrusters and the air do it.
    cmd.brake = inAir ? (input.cut ? env.airBrake || 0 : 0) : 1;
    if (assist && assist.brake > cmd.brake) cmd.brake = assist.brake;
    cmd.carveAccel = env.carveAccel;           // undefined: unbounded, as before
    // While the ground assist is what raises the climb, the field turns the velocity upward no
    // harder than the hull's lift (at tau 0.22 it gave 40 m/s^2 on top of the thrusters' 14).
    if (assist && assist.climb > -Infinity && dot(target, up) <= assist.climb + 1e-9 && !(cmd.carveAccel < T.assistLift)) cmd.carveAccel = T.assistLift;
    body(st, cmd, dt, env);
    v = { x: st.v.x, y: st.v.y, z: st.v.z };
    st.p = p0;
  } else {
    if (assist) target = shapeTarget(target, assist, up, true);
    v = add(st.v, scale(sub(target, st.v), damp(1 / tau, dt)));
  }

  // ---- lift-off sequence overrides the vertical motion ---------------------------------------
  if (st.liftoff && up && env.shipBody && st.liftoff.air) {
    // Lift-off, second half, through PHYSICS' body: the feet have left the ground (the first
    // half is the landing gear's, see Sim.stepGearLiftoff); rise to the hover height and hold.
    const L = st.liftoff;
    L.t += dt;
    const g0 = env.sample ? floorAt(env.sample, st.p) : ground;
    const alt = g0 ? g0.r - g0.floor : T.hoverHeight;
    // The lift-off ends where free flight can take the hull over: at the hover height over the
    // ground AND clear of the floor free flight uses (the tree tops: the ship stands in a glade
    // and the wood's crowns are 23 m up). It used to end 9 m over the bare ground, and the next
    // step's clearance put the hull on top of the crowns: 16 m in one frame, at the first
    // lift-off of every game. Now it rises out of the wood, a little faster once it is off the gear.
    const togo = Math.max(T.hoverHeight - alt, ground ? T.liftoffClear - (ground.r - ground.floor) : 0);
    const cap = mix(T.liftoffClimb, T.liftoffRise, smoothstep(T.hoverHeight * 0.5, T.hoverHeight, alt));
    const p0 = { x: st.p.x, y: st.p.y, z: st.p.z };
    env.shipBody(st, { target: scale(up, clamp(togo * 0.9, 0.3, cap)), tau: 0.5, hover: true }, dt, env);
    v = { x: st.v.x, y: st.v.y, z: st.v.z };
    st.p = p0;
    st.gear01 = 1 - smoothstep(0.25, 0.9, alt / T.hoverHeight);
    st.canopy01 = 0;
    if (togo <= 0.5 || L.t > 30) st.liftoff = null;
  } else if (st.liftoff && up) {
    const L = st.liftoff;
    if (L.t < T.liftoffSeconds) {
      const t0 = L.t;
      L.t = Math.min(T.liftoffSeconds, L.t + dt);
      const e0 = smoothstep(0, 1, t0 / T.liftoffSeconds), e1 = smoothstep(0, 1, L.t / T.liftoffSeconds);
      const rise = (e1 - e0) * T.hoverHeight;
      v = scale(up, dt > 0 ? rise / dt : 0);
      st.gear01 = 1 - smoothstep(0.35, 1, L.t / T.liftoffSeconds);
    } else {
      // At the hover height but still under the tree tops: on up, to where free flight takes over.
      L.t += dt;
      const togo = ground ? T.liftoffClear - (ground.r - ground.floor) : 0;
      v = scale(up, clamp(togo * 0.9, 0.3, T.liftoffRise));
      st.gear01 = 0;
    }
    st.canopy01 = 0;
    if (L.t >= T.liftoffSeconds && (!ground || ground.r - ground.floor >= T.liftoffClear - 0.5 || L.t > 30)) { st.liftoff = null; v = V(); }
  } else if (assist) {
    // ---- the ground is never a wall --------------------------------------------------------
    // ...and the hull has mass: what the assist adds to the hull's own motion in one step is
    // bounded by what its lift can do (it used to rewrite the velocity outright: one-frame
    // jolts of 3.5 to 8.5 m/s, 16 to 35 g, and a 22 g climb at the foot of a steep slope).
    v = boundAssist(v, assist, up, dt, env.gravity, dot(v, up) - vUpWas, T);
    st.gear01 = mix(st.gear01, 0, damp(3, dt));
  } else if (!st.liftoff) {
    st.gear01 = mix(st.gear01, 0, damp(3, dt));
  }

  // ---- integrate, then the soft bounce if we still touched something -------------------------
  let p = add(st.p, scale(v, dt));
  st.bounce += dt;
  if (floorOf && up && !st.liftoff) {
    const g2 = floorOf(p);
    // Only the ground and the liquid are solid: the hull is never moved onto the tree tops (the
    // crowns' share of the floor, g2.canopy, is kept off by the assist above, through the
    // velocity; a clamp here once lifted the hull 16 m in a frame).
    const hard = g2.floor - (g2.canopy || 0);
    if (g2.r - hard < T.minClearance) {
      const up2 = scale(p, 1 / g2.r);
      const n = g2.normal;
      const vn = dot(v, n);
      if (vn < -Math.max(2.5, 0.06 * len(v))) {
        v = addScaled(v, n, -(1 + T.bounceRestitution) * vn);       // reflect softly
        v = scale(v, 0.8);
        st.throttle *= 0.5;
        st.bounce = 0;
        st.bounces++;
      } else if (vn < 0) v = addScaled(v, n, -vn);
      p = scale(up2, hard + T.minClearance);
    }
    st.altGround = Math.max(0, len(p) - g2.floor);
  } else if (ground) st.altGround = Math.max(0, len(p) - ground.floor);
  else st.altGround = 0;

  // Follow the curve of the world: on a planet a few kilometres across, "level" has to bend
  // with the horizon or every straight line would climb away into the sky.
  // (Not in a pulse, and not above the air: there a straight line is straight, or a pulse past a
  // world bends round it into its sphere.)
  const wc = env.pulseSpeed != null ? 0 : wa;
  if (up && wc > 0) {
    const upNew = norm(p);
    const axis = cross(up, upNew);
    const sinA = len(axis);
    if (sinA > 1e-12) {
      const rot = qFromAxisAngle(scale(axis, 1 / sinA), Math.asin(Math.min(1, sinA)) * wc);
      st.q = qNorm(qMul(rot, st.q));
      v = add(v, scale(sub(qRotate(rot, v), v), 1));
    }
  }

  st.p = p;
  st.v = v;
  st.speed = len(v);
  st.throttle01 = mix(st.throttle01, clamp01(Math.abs(st.throttle) * 0.85 + (st.liftoff ? 0.5 : 0.15)), damp(4, dt));
  return st;
}

// The ground assists of one step. `ground` is the floor under the hull (the ground or the liquid,
// raised to the tree tops where the caller knows them: ground.canopy is the crowns' share);
// `target` is what the pilot asks for.
//   climb    m/s: the least vertical speed asked for (-Infinity: none): the ground ahead rises, or
//            the hull is under the floor's clearance (in among the crowns after a landing was
//            abandoned) and is lifted out at assistRise
//   ahead    m/s: the part of it that comes from the ground ahead (for the nose)
//   maxDown  m/s: the fastest the hull may sink here (the cushion)
//   vhCap    m/s: the most level speed to ask for (Infinity: any): where the ground ahead rises
//            faster than the hull can climb at this speed, it slows down and goes up the slope;
//            it is not shot up it
//   hardAlt  m over the solid ground or the liquid
//   brake    0..1: the drive field's share asked for to slow down in the room there is
//   mustUp   m/s^2: the steady lift it takes not to touch the solid ground ahead (a dive at a
//            mountain face): the one thing the assist exceeds the hull's own lift for
function groundAssist(st, target, ground, up, floorOf, liftSpeed, T) {
  const alt = ground.r - ground.floor;
  const A = st._assist || (st._assist = { climb: 0, ahead: 0, maxDown: 0, vhCap: Infinity, hardAlt: 0, alt: 0, brake: 0 });
  A.hardAlt = alt + (ground.canopy || 0); A.alt = alt;
  // Only the rise of the terrain counts, so hovering low over flat ground is left alone.
  // The look goes where the hull is going: along its velocity, turned a little toward what is
  // asked of it (a start from a hover, a turn). It reaches as far as the hull needs to stop in,
  // so that a wall is seen while there is still room to slow down for it (0.8 s ahead at 46 m/s
  // was 37 m: the climb a 60 degree slope then asked for was a rocket's, 22 g to 71 m/s).
  const vhNow = reject(st.v, up), u = lerp(vhNow, reject(target, up), 0.3), sp = len(u);
  // The height the hull stands off the floor at: the clearance, and more the faster it flies.
  const stand = T.minClearance + Math.max(0, len(vhNow) - T.fastSkim) * T.fastSkimRise;
  const keep = clamp(alt, stand + 0.4, Math.max(T.cushionHeight, stand + 0.4));
  let ahead = 0, vhCap = Infinity, brake = 0, mustUp = 0;
  if (sp > 0.5) {
    const reach = Math.max(T.lookMin, sp * sp / (2 * T.lookDecel) + sp * T.lookAhead), spNow = len(vhNow), vUpNow = dot(st.v, up);
    for (let k = 0; k < T.lookAt.length; k++) {
      const d = reach * T.lookAt[k], t = d / sp;
      const g = floorOf(addScaled(st.p, u, t));
      const need = g.floor + keep - ground.r;
      // The steady lift it takes from here to clear the SOLID ground there by the clearance (a
      // quarter of a second off or more: nearer than that the last-two-metres rule has it).
      if (t >= 0.25) {
        const a = 2 * (g.floor - (g.canopy || 0) + T.minClearance - ground.r - vUpNow * t) / (t * t);
        if (a > mustUp) mustUp = a;
      }
      if (need <= 0) continue;
      const rate = need / t;
      if (rate > ahead) ahead = rate;
      // More than the hull climbs at: it must take longer to get there (need / liftSpeed, and
      // the second its climb takes to build).
      if (rate > liftSpeed) {
        const cap = Math.max(T.assistCrawl, d / (need / liftSpeed + 1));
        if (cap < vhCap) vhCap = cap;
        // ...and if its own thrusters cannot slow it to that in the room there is (a hull still
        // at 200 m/s from a dive, low over thin-air ground), the drive field brakes it, by what it takes.
        if (spNow > cap) brake = Math.max(brake, (spNow * spNow - cap * cap) / (2 * d));
      }
    }
    if (ahead > liftSpeed) ahead = liftSpeed;
  }
  A.brake = brake > T.lookDecel ? Math.min(1, 1.25 * brake / T.assistField) : 0;
  A.mustUp = Math.min(T.assistField, 1.25 * mustUp);
  let climb = ahead > 0 ? ahead : -Infinity;
  // Under the floor's clearance (a landing abandoned among the trees, a canopy that came up
  // round a hovering hull): out of it at a calm rise, and no dash through the trunks meanwhile.
  if (alt < stand) {
    climb = Math.max(climb, Math.min(T.assistRise, Math.sqrt(2 * 3 * (stand - alt)) + 0.2));
    if (alt < 0) vhCap = Math.min(vhCap, Math.max(T.assistCrawl, len(reject(target, up)) * clamp01(1 + alt / 8)));
  }
  // The closer to the floor, the slower the ship may sink: never faster than it can still stop
  // from (a hull with mass needs room), and feather-slow in the last metres (to a stand 0.2 m
  // over the clearance: the floor itself is no longer a wall the hull is set on).
  let maxDown = Math.sqrt(2 * T.cushionDecel * Math.max(0, alt - stand - 0.5)) + 0.25;
  if (alt < T.cushionHeight + stand - T.minClearance) maxDown = Math.min(maxDown, Math.max(0, (alt - stand - 0.2) * 1.8));
  A.climb = climb; A.ahead = ahead; A.maxDown = maxDown; A.vhCap = vhCap;
  st.sinkLimit = maxDown;
  return A;
}

// The assists on a velocity (the request to the flight computer): pull up over terrain that
// rises ahead, ride a cushion near the floor and, on the request only (`slow`), approach a
// slope the hull cannot climb at this speed more slowly.
function shapeTarget(v, A, up, slow) {
  let vUp = dot(v, up);
  let vh = reject(v, up);
  if (vUp < A.climb) vUp = A.climb;
  if (vUp < -A.maxDown) vUp = -A.maxDown;
  if (slow && A.vhCap < Infinity) vh = clampLen(vh, A.vhCap);
  return add(vh, scale(up, vUp));
}

// The assists on the hull's own velocity, after the flight computer (and PHYSICS' body) has
// moved it: the same shape, but the hull's vertical speed changes in one step by no more than
// its lift can give (assistLift beyond its weight; `moved` is what this step has already
// changed it by, which counts against that). More only where the alternative is to touch the
// ground: in the last two metres over it, for a sink the lift could not stop in the room
// there is (a dive out of space arrives at 200 m/s 500 m up: the drive field brakes it, at
// just what it takes, steadily, where it used to be cut to the cushion's speed in one frame;
// over the tree tops, which are no wall, by less), and for solid ground ahead that the lift
// could not clear (A.mustUp).
function boundAssist(v, A, up, dt, gravity, moved, T) {
  const vUp = dot(v, up);
  let want = vUp;
  if (want < A.climb) want = A.climb;
  if (want < -A.maxDown) want = -A.maxDown;
  if (want <= vUp) return v;
  const near = clamp01((T.minClearance + 2 - A.hardAlt) / 2);
  const lift = (T.assistLift + (gravity > 0 ? gravity : 9.8)) * (1 + 8 * near * near);
  const need = (room) => 1.25 * vUp * vUp / (2 * Math.max(0.25, room - T.minClearance - 0.3));
  // (a hull already in under the tree tops has nothing left to stop above: the lift brings it out)
  const must = vUp < 0 ? Math.max(Math.min(T.assistField, need(A.hardAlt)), A.alt > T.minClearance ? Math.min(T.assistFieldSoft, need(A.alt)) : 0) : 0;
  return addScaled(v, up, Math.min(want - vUp, Math.max(0, Math.max(lift, must, A.mustUp || 0) * dt - Math.max(0, moved))));
}

export function beginLiftoff(st) {
  st.liftoff = { t: 0 };
  st.landing = null;
  st.throttle = 0;
  st.v = V();
  st.pending.yaw = st.pending.pitch = 0;
}

// ---- landing assist ------------------------------------------------------------------------
// Choose where to set down: the flattest dry spot under or near the ship. Returns a site
// { dir, floor, normal, liquid, slope } or null when everything nearby is too steep.
// `obstacles` (optional): [{ unitDir, radius }] trees and boulders to keep clear of.
// `holds` (optional): (dir, ground) -> bool, whether the ground there will hold a parked ship
// (PHYSICS: friction against the slope). Without it, slopes up to landMaxSlope are accepted.
// `here` (optional): the pilot is settling by hand, so stay under the hull unless that cannot hold.
export function findLandingSite(p, sample, T = SHIP, obstacles = null, holds = null, here = false) {
  const up = norm(p);
  const r = len(p);
  const a = tangent(V(0.31, 0.77, 0.55), up);
  const b = cross(up, a);
  let best = null;
  const crowd = (dir) => {
    // How badly a spot is hemmed in: 0 when nothing stands within the ship's footprint.
    let c = 0;
    if (obstacles) for (const ob of obstacles) {
      const gap = Math.acos(Math.min(1, dot(dir, ob.unitDir))) * r - ob.radius;
      if (gap < T.landClearance) c += 1 + (T.landClearance - gap);
    }
    return c;
  };
  const consider = (dir, distance) => {
    const g = floorAt(sample, scale(dir, r));
    // The ground under all of the hull, not only its middle: the steepest of the middle and four
    // points landFootprint out, and the tilt of the ground between them (a level shelf at the lip
    // of a canyon wall is no place to stand a ship, or to step out of one).
    if (!g.liquid && T.landFootprint > 0) {
      for (let i = 0; i < 4; i++) {
        const off = add(scale(a, Math.cos(i * Math.PI / 2 + 0.4) * T.landFootprint), scale(b, Math.sin(i * Math.PI / 2 + 0.4) * T.landFootprint));
        const q = floorAt(sample, scale(norm(addScaled(scale(dir, r), off, 1)), r));
        const tilt = Math.atan(Math.abs(q.floor - g.floor) / T.landFootprint);
        g.slope = Math.max(g.slope, q.liquid ? 0 : q.slope, tilt);
      }
    }
    const score = g.slope * (here ? 20 : 60) + (g.liquid ? 14 : 0) + distance * (here ? 3 : 0.35) + crowd(dir) * 25;
    const ok = g.liquid || (holds ? holds(dir, g) : g.slope <= T.landMaxSlope);
    if (ok && (!best || score < best.score)) {
      best = { dir, floor: g.floor, normal: g.normal, liquid: g.liquid, slope: g.slope, score, distance };
    }
  };
  consider(up, 0);
  for (const ring of obstacles && obstacles.length ? [12, 26, 45, 70] : [12, 26, 45]) {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + ring;
      const off = add(scale(a, Math.cos(ang) * ring), scale(b, Math.sin(ang) * ring));
      consider(norm(addScaled(p, off, 1)), ring);
    }
  }
  return best;
}

// `found` (optional): a site findLandingSite already chose (the one the prompt was offered for).
export function beginLanding(st, sample, T = SHIP, obstacles = null, holds = null, here = false, found = null) {
  const site = found || findLandingSite(st.p, sample, T, obstacles, holds, here);
  if (!site) return false;
  st.landing = { ...site, phase: 'glide', t: 0 };
  st.liftoff = null;
  st.throttle = 0;
  st.pending.yaw = st.pending.pitch = 0;
  return true;
}

// Returns 'landing' while descending, 'touchdown' on the frame the gear meets the ground,
// 'blocked' if the way to the site turned out to be barred and there is no level ground here,
// and 'gear' when the last metre is the landing gear's (see opts.gearAt).
// opts.gearAt (metres, optional): with PHYSICS' landing gear, the assist hands the hull over to
// the legs this far above dry ground: it then returns 'gear' and the caller lets the hull down
// on its three sprung feet (Sim.stepLandingGear) instead of setting it on the floor.
export function stepLanding(st, dt, sample, T = SHIP, opts = null) {
  const L = st.landing;
  L.t += dt;
  const up = norm(st.p);
  const r = len(st.p);
  const here = floorAt(sample, st.p);
  // Sideways toward the site.
  const err = reject(sub(scale(L.dir, r), st.p), up);
  const errLen = len(err);
  // Height above the highest ground that matters: under the hull, a little way along the
  // glide, and the site itself once it is close (so a ledge or a cliff edge on the way is
  // seen before it is met).
  const ahead = floorAt(sample, addScaled(st.p, reject(st.v, up), 0.7));
  const alt = r - Math.max(here.floor, ahead.floor, errLen < 15 ? L.floor : here.floor);
  // (a glide that can stop at the site with landGlideDecel: the hull is no longer turned on the spot)
  const vhWant = clampLen(scale(err, 1.3), Math.min(T.landGlideSpeed, Math.sqrt(2 * T.landGlideDecel * errLen)));
  // Down: steady when high, feather-soft at the end. Hold at 10 m until we are over the site.
  const maxDescent = mix(T.landMaxDescent, T.landHighDescent == null ? T.landMaxDescent : T.landHighDescent, smoothstep((T.landHighAlt || 60) * 0.5, T.landHighAlt || 60, alt));
  let vDown = clamp(alt * 0.85, T.landMinDescent, maxDescent);
  if (errLen > 5 && alt < 10) vDown = alt < 6 ? -2 : 0;
  L.phase = errLen > 5 ? 'glide' : alt > 8 ? 'descend' : 'settle';
  const want = addScaled(vhWant, up, -vDown);
  // The hull has mass: it goes to that velocity from its own, at no more than landAccel level
  // and landAccelDown downward (it used to take 3.5 / s of the whole difference at once: E at
  // full speed braked 46 to 14 m/s in 0.4 s, 18 g, and a hover lurched down and sideways at
  // 4.4 g). Braking a sink is the lift's (assistLift), and whatever it takes in the last metres.
  const dv = scale(sub(want, st.v), damp(3.5, dt));
  const dvUp = dot(dv, up);
  const stop = T.assistLift * dt * (1 + 8 * clamp01((3 - alt) / 2) ** 2);
  st.v = add(st.v, add(clampLen(reject(dv, up), T.landAccel * dt), scale(up, clamp(dvUp, -T.landAccelDown * dt, stop))));

  // Attitude: level out, then lean gently into the slope of the site as the gear comes down.
  const lean = smoothstep(14, 1, alt) * 0.75;
  const siteUp = norm(lerp(up, L.normal, lean), up);
  const f = tangent(qRotate(st.q, V(0, 0, -1)), siteUp, qRotate(st.q, V(0, 1, 0)));
  st.q = qSlerp(st.q, qLook(f, siteUp), damp(2.6, dt));
  st.gear01 = mix(st.gear01, 1, damp(2.5, dt));
  st.throttle = 0;
  st.throttle01 = mix(st.throttle01, 0.3, damp(3, dt));
  st.turnRate = mix(st.turnRate, 0, damp(4, dt));

  let p = add(st.p, scale(st.v, dt));
  const g = floorAt(sample, p);
  st.altGround = Math.max(0, g.r - g.floor);
  st.speed = len(st.v);
  if (g.r - g.floor <= 0.04 && len(reject(st.v, up)) > 3) {
    // Met a wall on the way to the site (a ledge, the edge of a liquid): that is not a landing.
    // Stop and rise clear of it. If what is under the hull now is level (or liquid), set down
    // right here; if it is a slope, give the ship back to the pilot rather than park on a ledge.
    st.v = V();
    st.speed = 0;
    if (!g.liquid && g.slope > 0.3) {
      st.p = scale(norm(p), g.floor + 4);
      st.altGround = 4;
      st.landing = null;
      return 'blocked';
    }
    st.p = scale(norm(p), g.floor + 1.5);
    L.dir = norm(st.p); L.floor = g.floor; L.normal = g.normal; L.liquid = g.liquid;
    st.altGround = 1.5;
    return 'landing';
  }
  if (opts && opts.gearAt && L.phase === 'settle' && !g.liquid && !L.liquid && g.r - g.floor <= opts.gearAt && len(reject(st.v, up)) < 1.5) {
    st.p = p;
    return 'gear';
  }
  if (g.r - g.floor <= 0.04) {
    p = scale(norm(p), g.floor);
    st.p = p;
    st.v = V();
    st.speed = 0;
    st.altGround = 0;
    st.gear01 = 1;
    st.onLiquid = !!g.liquid;
    st.landing = null;
    // Rest squarely on the ground we actually touched.
    const restUp = norm(lerp(norm(p), g.normal, 0.75), norm(p));
    st.restQ = qLook(tangent(qRotate(st.q, V(0, 0, -1)), restUp), restUp);
    return 'touchdown';
  }
  st.p = p;
  return 'landing';
}

// After touchdown: ease into the resting attitude, spool down, open up.
export function stepLanded(st, dt) {
  if (st.restQ) st.q = qSlerp(st.q, st.restQ, damp(4, dt));
  st.v = V();
  st.speed = 0;
  st.throttle = 0;
  st.gear01 = mix(st.gear01, 1, damp(4, dt));
  st.throttle01 = mix(st.throttle01, 0, damp(2.5, dt));
  st.turnRate = 0;
  st.altGround = 0;
}

// Place a ship at rest on the surface along `dir`, nose toward `fwdHint`.
export function restOnSurface(sample, dir, fwdHint) {
  const up = norm(dir);
  const g = floorAt(sample, up);
  const restUp = norm(lerp(up, g.normal, 0.75), up);
  const q = qLook(tangent(fwdHint || V(0, 0, -1), restUp), restUp);
  const st = createShipState(scale(up, g.floor), q);
  st.restQ = q;
  return st;
}
