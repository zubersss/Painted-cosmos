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
  throttleRate: 0.55,        // per second while W or S is held
  brakeFactor: 0.45,         // X shortens the velocity time constant by this much
  reverseMax: -0.2,
  // steering
  steerRate: 7.5,            // 1/s: how fast the nose swings to where the mouse asked
  maxTurn: 1.6,              // rad/s
  pendingMax: 0.9,           // rad of mouse aim that may be queued
  keyYawRate: 0.85,          // rad/s from A / D
  pitchLimit: 1.36,          // rad (78 deg) nose up or down near a planet
  bankGain: 0.55,            // rad of bank per rad/s of turn
  maxBank: 0.62,             // rad
  rollLevelRate: 3.2,        // 1/s wings-level strength
  spaceLevel: 0.35,          // how much of that levelling survives in deep space (to ecliptic up)
  // ground
  cushionHeight: 7,          // m: below this the descent rate is limited
  cushionDecel: 6.5,         // m/s^2: the braking the cushion plans with at any height
  minClearance: 1.6,         // m: the hull never goes lower in free flight
  lookAhead: 0.8,            // s of terrain look-ahead for the automatic pull-up
  flareHeight: 75,           // m: below this a dive is progressively levelled out
  flareAngle: 0.07,          // rad: the steepest dive allowed at cushion height
  flareRate: 4.5,            // 1/s
  bounceRestitution: 0.35,
  // sequences
  hoverHeight: 9,            // m: where the lift-off sequence leaves you
  liftoffSeconds: 2.8,
  landGlideSpeed: 14,        // m/s sideways toward the chosen spot
  landMaxDescent: 13,        // m/s
  landMinDescent: 1.1,       // m/s at touchdown: soft
  landMaxSlope: 0.62,        // rad: steeper spots are refused
  landClearance: 6,          // m: trees and boulders closer than this to the spot count against it
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
  return { floor: liquid ? s.liquidRadius : s.radius, normal: liquid ? scale(p, 1 / r) : norm(s.normal, p), slope: liquid ? 0 : s.slope, liquid, r };
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
  const level = mix(T.spaceLevel, 1, w);

  // ---- steering ------------------------------------------------------------------------
  st.pending.yaw = clamp(st.pending.yaw + (input.aimX || 0), -T.pendingMax, T.pendingMax);
  st.pending.pitch = clamp(st.pending.pitch + (input.aimY || 0), -T.pendingMax, T.pendingMax);
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
  if (w > 0.3) {
    // Near a planet the nose cannot go past the pitch limit: no accidental loops.
    const elev = Math.asin(clamp(dot(f, upRef), -1, 1));
    const lim = T.pitchLimit;
    if (pitchStep < 0 && elev - pitchStep > lim) pitchStep = Math.min(0, -(lim - elev));
    if (pitchStep > 0 && elev - pitchStep < -lim) pitchStep = Math.max(0, elev + lim);
  }
  const yawAxis = norm(lerp(shipUp, upRef, level), shipUp);
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
  if (ground && !st.liftoff) {
    const alt = ground.r - ground.floor;
    const minElev = -mix(T.flareAngle, T.pitchLimit, smoothstep(T.cushionHeight, T.flareHeight, alt));
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
  // Near the ground the ship is slow (you are looking at a painting, not racing over it).
  const altForSpeed = ground ? Math.max(0, ground.r - ground.floor) : env.altitude;
  const vmax = maxSpeedAt(altForSpeed, env.spaceAlt, env.hasBody, T);
  const liftDir = w > 0.3 ? upRef : qRotate(st.q, V(0, 1, 0));
  const liftSpeed = clamp(vmax * 0.42, T.liftSpeed, T.liftSpeedSpace);
  let target = add(scale(f, st.throttle * vmax), scale(liftDir, (input.lift || 0) * liftSpeed));
  // X is a real brake: the ship stops in about half the usual time.
  const inAir = env.hasBody && env.altitude < env.spaceAlt;
  const tau = mix(T.tauSpace, T.tauAtmo, inAir ? 1 : 0) * (input.cut ? T.brakeFactor : 1);
  let v;
  // In vacuum the drive field that makes the pulse possible is also the brake: asking for much
  // less speed than the ship has (X, or throttling down) sheds it at the kinematic rate. The
  // body model's retro thrusters (10 m/s^2) would take over a minute from cruise, and "let go
  // and it stops" is the promise of this ship. Acceleration and all flight in air stay with
  // the body model.
  const fieldBrake = !inAir && (input.cut || dot(st.v, f) > st.throttle * vmax + 60 || len(st.v) > vmax + 60);
  const body = env.shipBody && !st.liftoff && env.pulseSpeed == null && !fieldBrake ? env.shipBody : null;
  if (env.pulseSpeed != null) {
    // Pulse drive: the speed is the drive's, the direction is the nose.
    v = add(st.v, scale(sub(scale(f, env.pulseSpeed), st.v), damp(5, dt)));
  } else if (body) {
    // PHYSICS' ship: the flight computer asks for `target`; thrust, drag, gravity, lift and
    // gusts decide what the hull actually does. The assists below shape the request first.
    let tauBody = tau;
    if (ground && up) {
      target = shapeTarget(st, target, ground, up, floorOf, T);
      // Sinking faster than the cushion allows, or terrain rising ahead: the flight computer
      // is told to close that error at once, not at its leisure.
      const vUpNow = dot(st.v, up);
      if (vUpNow < -st.sinkLimit || dot(target, up) > vUpNow + 4) tauBody = Math.min(tau, 0.22);
    }
    const p0 = st.p;
    body(st, { target, tau: tauBody, hover: true, boost: !inAir }, dt, env);
    v = st.v;
    st.p = p0;                                   // position is integrated once, below
  } else {
    v = add(st.v, scale(sub(target, st.v), damp(1 / tau, dt)));
  }

  // ---- lift-off sequence overrides the vertical motion ---------------------------------------
  if (st.liftoff && up) {
    const L = st.liftoff;
    const t0 = L.t;
    L.t = Math.min(T.liftoffSeconds, L.t + dt);
    const e0 = smoothstep(0, 1, t0 / T.liftoffSeconds), e1 = smoothstep(0, 1, L.t / T.liftoffSeconds);
    const rise = (e1 - e0) * T.hoverHeight;
    v = scale(up, dt > 0 ? rise / dt : 0);
    st.gear01 = 1 - smoothstep(0.35, 1, L.t / T.liftoffSeconds);
    st.canopy01 = 0;
    if (L.t >= T.liftoffSeconds) { st.liftoff = null; v = V(); }
  } else if (ground && up) {
    // ---- the ground is never a wall --------------------------------------------------------
    v = shapeTarget(st, v, ground, up, floorOf, T);
    st.gear01 = mix(st.gear01, 0, damp(3, dt));
  } else if (!st.liftoff) {
    st.gear01 = mix(st.gear01, 0, damp(3, dt));
  }

  // ---- integrate, then the soft bounce if we still touched something -------------------------
  let p = add(st.p, scale(v, dt));
  st.bounce += dt;
  if (floorOf && up && !st.liftoff) {
    const g2 = floorOf(p);
    const alt2 = g2.r - g2.floor;
    if (alt2 < T.minClearance) {
      const up2 = scale(p, 1 / g2.r);
      const n = g2.normal;
      const vn = dot(v, n);
      if (vn < -2.5) {
        v = addScaled(v, n, -(1 + T.bounceRestitution) * vn);       // reflect softly
        v = scale(v, 0.8);
        st.throttle *= 0.5;
        st.bounce = 0;
        st.bounces++;
      } else if (vn < 0) v = addScaled(v, n, -vn);
      p = scale(up2, g2.floor + T.minClearance);
    }
    st.altGround = Math.max(0, len(p) - g2.floor);
  } else if (ground) st.altGround = Math.max(0, len(p) - ground.floor);
  else st.altGround = 0;

  // Follow the curve of the world: on a planet a few kilometres across, "level" has to bend
  // with the horizon or every straight line would climb away into the sky.
  if (up && w > 0) {
    const upNew = norm(p);
    const axis = cross(up, upNew);
    const sinA = len(axis);
    if (sinA > 1e-12) {
      const rot = qFromAxisAngle(scale(axis, 1 / sinA), Math.asin(Math.min(1, sinA)) * w);
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

// The ground assists, applied to a velocity (the request to the flight computer, or the
// velocity itself): pull up over terrain that rises ahead, and ride a cushion near the floor.
function shapeTarget(st, v, ground, up, floorOf, T) {
  let vUp = dot(v, up);
  const vh = reject(v, up);
  const alt = ground.r - ground.floor;
  // Only the rise of the terrain counts, so hovering low over flat ground is left alone.
  // (Two looks, near and far, so that nothing between here and the far one is flown into.)
  const vhNow = reject(st.v, up);
  const keep = clamp(alt, T.minClearance + 0.4, T.cushionHeight);
  for (let k = 0.5; k <= 1; k += 0.5) {
    const ahead = floorOf(addScaled(st.p, vhNow, T.lookAhead * k));
    const need = ahead.floor + keep - ground.r;
    if (need > 0) vUp = Math.max(vUp, need / (T.lookAhead * k));
  }
  // The closer to the floor, the slower the ship may sink: never faster than it can still stop
  // from (a hull with mass needs room), and feather-slow in the last metres.
  let maxDown = Math.sqrt(2 * T.cushionDecel * Math.max(0, alt - T.minClearance - 0.5)) + 0.25;
  if (alt < T.cushionHeight) maxDown = Math.min(maxDown, Math.max(0.25, (alt - T.minClearance) * 1.8));
  if (vUp < -maxDown) vUp = -maxDown;
  st.sinkLimit = maxDown;
  return add(vh, scale(up, vUp));
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
export function findLandingSite(p, sample, T = SHIP, obstacles = null) {
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
    const score = g.slope * 60 + (g.liquid ? 14 : 0) + distance * 0.35 + crowd(dir) * 25;
    if (g.slope <= T.landMaxSlope && (!best || score < best.score)) {
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

export function beginLanding(st, sample, T = SHIP, obstacles = null) {
  const site = findLandingSite(st.p, sample, T, obstacles);
  if (!site) return false;
  st.landing = { ...site, phase: 'glide', t: 0 };
  st.liftoff = null;
  st.throttle = 0;
  st.pending.yaw = st.pending.pitch = 0;
  return true;
}

// Returns 'landing' while descending and 'touchdown' on the frame the gear meets the ground.
export function stepLanding(st, dt, sample, T = SHIP) {
  const L = st.landing;
  L.t += dt;
  const up = norm(st.p);
  const r = len(st.p);
  const here = floorAt(sample, st.p);
  const alt = r - here.floor;
  // Sideways toward the site.
  const err = reject(sub(scale(L.dir, r), st.p), up);
  const errLen = len(err);
  const vhWant = clampLen(scale(err, 1.3), T.landGlideSpeed);
  // Down: fast when high, feather-soft at the end. Hold at 10 m until we are over the site.
  let vDown = clamp(alt * 0.85, T.landMinDescent, T.landMaxDescent);
  if (errLen > 5 && alt < 10) vDown = alt < 6 ? -2 : 0;
  L.phase = errLen > 5 ? 'glide' : alt > 8 ? 'descend' : 'settle';
  const want = addScaled(vhWant, up, -vDown);
  st.v = add(st.v, scale(sub(want, st.v), damp(3.5, dt)));

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
  if (g.r - g.floor <= 0.04) {
    p = scale(norm(p), g.floor);
    st.p = p;
    st.v = V();
    st.speed = 0;
    st.altGround = 0;
    st.gear01 = 1;
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
