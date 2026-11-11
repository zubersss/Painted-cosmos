// The explorer on foot: a capsule walking on a heightfield wrapped around a sphere.
// Pure (no three). Everything is in the body-local (rotating) frame of the planet, so the
// ground carries you with it. The world is seen only through `env.sample(unitDir)`, which is
// the contract's sampleSurface bound to the current body.
import {
  V, add, sub, scale, addScaled, dot, len, norm, reject, tangent, clampLen, cross,
  clamp01, mix, damp, rotateAround,
} from '../core/vec.js';

// Feel target: unhurried, weightless, generous. All distances in metres, times in seconds.
export const EXPLORER = Object.freeze({
  height: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 4.2,            // m/s, a relaxed walk
  runSpeed: 7.4,             // m/s with Shift
  groundAccel: 26,           // m/s^2 toward the wished velocity on the ground (snappy stop/start)
  airAccel: 6,               // m/s^2 of air control while falling
  jetAirAccel: 11,           // m/s^2 of air control while the jetpack burns
  jumpSpeed: 4.8,            // m/s (about 1.3 m high on Earth: a light hop)
  jetThrust: 17,             // m/s^2 upward while burning (gravity is subtracted from this)
  jetMaxRise: 8.5,           // m/s cap on climb speed
  jetFuelSeconds: 4.2,       // seconds of continuous burn on a full tank
  rechargeGroundSeconds: 2.2,  // seconds to refill standing on the ground
  rechargeAirDelay: 0.9,     // seconds after burning before it starts refilling in the air
  rechargeAirSeconds: 10,    // seconds to refill while falling (slow: you cannot hover forever)
  jetStartDelay: 0.16,       // hold Space this long after a jump before the jetpack lights
  terminalFall: 24,          // m/s: falls stay gentle, there is no fall damage
  softFallHeight: 3,         // metres above ground where a fast fall is cushioned
  softFallSpeed: 7,          // m/s touchdown speed after cushioning
  maxSlope: 0.80,            // rad (46 deg): steeper ground cannot be walked up
  slideSlope: 0.96,          // rad (55 deg): steeper ground slides you down
  slideSpeed: 5,             // m/s
  stepDown: 0.5,             // metres the feet will follow the ground down without falling
  wadeSlowDepth: 1.0,        // metres of liquid at which wading is slowest
  wadeSlowFactor: 0.5,
  swimDepth: 1.25,           // deeper than this the explorer floats (feet this far under)
  swimSpeed: 2.6,
  turnRate: 11,              // 1/s: how fast the body turns to face where it walks
});

export function createExplorerState(p, fwd) {
  const up = norm(p);
  return {
    p: { ...p },                 // feet, body-local
    v: V(),                      // body-local velocity
    fwd: tangent(fwd || V(0, 0, -1), up),   // where the body faces (unit tangent)
    grounded: true,
    fuel: 1,                     // 0..1
    jetting: false,
    jet01: 0,                    // smoothed 0..1 for animation and sound
    sinceJet: 99,                // seconds since the jetpack last burned
    airTime: 0,
    jumpHeld: 0,                 // seconds Space has been held since leaving the ground
    mode: 'idle',                // 'idle' | 'walk' | 'jet' | 'fall' | 'wade'
    liquidDepth: 0,              // metres of liquid above the feet
    swimming: false,
    slope: 0,
    speed: 0,
    altitude: 0,                 // feet above the solid ground
    landedHard: 0,               // touchdown speed of the last landing (for a little squash)
    surface: null,               // last sample under the feet
  };
}

// input: { moveX, moveZ, run, jump (pressed this step), jet (Space held), viewFwd (unit tangent
//          of the camera, body-local), faceView (first person: body faces the view) }
// env:   { sample(unitDir) -> contract surface, gravity (m/s^2) }
export function stepExplorer(st, input, dt, env, T = EXPLORER) {
  const up = norm(st.p);
  const r = len(st.p);
  const s0 = env.sample(up);
  const groundR = s0.radius;
  const liquidR = s0.liquidRadius > groundR ? s0.liquidRadius : 0;
  const wasGrounded = st.grounded;
  const depth = liquidR ? Math.max(0, liquidR - r) : 0;
  const n0 = norm(s0.normal, up);

  // ---- wish direction in the tangent plane -------------------------------------------
  const f = tangent(input.viewFwd || st.fwd, up, st.fwd);
  const right = cross(f, up);
  let wish = add(scale(f, input.moveZ || 0), scale(right, input.moveX || 0));
  wish = clampLen(wish, 1);

  let maxSpeed = input.run ? T.runSpeed : T.walkSpeed;
  const swimming = liquidR > 0 && liquidR - groundR > T.swimDepth && r <= liquidR - T.swimDepth + 0.25;
  if (swimming) maxSpeed = T.swimSpeed;
  else if (depth > 0.05 && wasGrounded) maxSpeed *= mix(1, T.wadeSlowFactor, clamp01(depth / T.wadeSlowDepth));

  // ---- slope limits (only while standing on something) -------------------------------
  let slide = V();
  if (wasGrounded && !swimming) {
    const downhill = reject(n0, up);                 // horizontal direction the ground falls away
    const dl = len(downhill);
    if (dl > 1e-5) {
      const dh = scale(downhill, 1 / dl);
      if (s0.slope > T.maxSlope) {
        const uphillWish = -dot(wish, dh);
        if (uphillWish > 0) wish = addScaled(wish, dh, uphillWish);       // cannot push uphill
      }
      if (s0.slope > T.slideSlope) {
        slide = scale(dh, T.slideSpeed * clamp01((s0.slope - T.slideSlope) / 0.3 + 0.25));
      }
    }
    // Look one stride ahead so a wall is felt before the heightfield would lift us up it.
    const wl = len(wish);
    if (wl > 1e-3) {
      const stride = Math.max(0.35, maxSpeed * dt * 2);
      const ahead = norm(addScaled(st.p, wish, stride / wl));
      const s1 = env.sample(ahead);
      const rise = s1.radius - groundR;
      if (rise / stride > Math.tan(T.maxSlope)) {
        const n1 = norm(s1.normal, up);
        const d1 = reject(n1, up);
        const d1l = len(d1);
        if (d1l > 1e-5) {
          const dh1 = scale(d1, 1 / d1l);
          const uphill1 = -dot(wish, dh1);
          if (uphill1 > 0) wish = addScaled(wish, dh1, uphill1);          // slide along the wall
        } else wish = V();
      }
    }
  }

  // ---- horizontal velocity ------------------------------------------------------------
  let vv = dot(st.v, up);
  let vh = reject(st.v, up);
  const target = add(scale(wish, maxSpeed), slide);
  let jetting = false;

  // ---- vertical: jump, jetpack, gravity ------------------------------------------------
  let grounded = wasGrounded;
  if (input.jump && (wasGrounded || swimming)) {
    vv = T.jumpSpeed;
    grounded = false;
    st.jumpHeld = 0;
  }
  if (input.jet) st.jumpHeld += dt; else st.jumpHeld = 0;
  const jetArmed = !grounded && st.jumpHeld >= T.jetStartDelay;
  if (input.jet && jetArmed && st.fuel > 0) {
    jetting = true;
    vv += T.jetThrust * dt;
    if (vv > T.jetMaxRise) vv = Math.max(T.jetMaxRise, vv - T.jetThrust * dt);
    st.fuel = Math.max(0, st.fuel - dt / T.jetFuelSeconds);
    st.sinceJet = 0;
  } else st.sinceJet += dt;

  const accel = grounded || swimming ? T.groundAccel : jetting ? T.jetAirAccel : T.airAccel;
  vh = add(vh, clampLen(sub(target, vh), accel * dt));

  if (swimming && !jetting && vv <= T.jumpSpeed * 0.5) {
    // Float: a soft spring holds the feet `swimDepth` below the surface.
    const floatR = liquidR - T.swimDepth;
    vv += ((floatR - r) * 14 - vv * 6) * dt;
    grounded = false;
  } else if (!grounded) {
    vv -= env.gravity * dt;
    if (vv < -T.terminalFall) vv = -T.terminalFall;
    // Cushion the last few metres of a fast fall: generous, never a thud.
    const alt = r - Math.max(groundR, liquidR);
    if (alt < T.softFallHeight && vv < -T.softFallSpeed) {
      vv = mix(vv, -T.softFallSpeed, damp(10, dt));
    }
  } else {
    vv = 0;
  }

  // ---- integrate and collide with the ground ------------------------------------------
  let p = add(st.p, scale(add(vh, scale(up, vv)), dt));
  const up2 = norm(p);
  const s2 = env.sample(up2);
  const r2 = len(p);
  const gap = r2 - s2.radius;
  let landedHard = 0;
  if (gap <= 0 || (grounded && vv <= 0.01 && gap < T.stepDown)) {
    if (!wasGrounded && vv < 0) landedHard = -vv;
    p = scale(up2, s2.radius);
    vv = 0;
    grounded = true;
  } else if (grounded && gap >= T.stepDown) {
    grounded = false;                              // walked off an edge
  }
  if (swimming && !jetting) grounded = false;
  // Never under the floating level in deep liquid, even after a dive.
  const liq2 = s2.liquidRadius > s2.radius ? s2.liquidRadius : 0;
  if (liq2 && liq2 - s2.radius > T.swimDepth && len(p) < liq2 - T.swimDepth - 0.6) {
    p = scale(up2, liq2 - T.swimDepth - 0.6);
    if (vv < 0) vv *= 0.5;
  }

  st.p = p;
  st.v = add(reject(vh, up2), scale(up2, vv));     // carry the velocity along the sphere
  st.grounded = grounded;
  st.swimming = swimming && !grounded;
  st.jetting = jetting;
  st.jet01 = mix(st.jet01, jetting ? 1 : 0, damp(12, dt));
  st.airTime = grounded ? 0 : st.airTime + dt;
  st.slope = s2.slope;
  st.surface = s2;
  st.altitude = len(p) - s2.radius;
  st.liquidDepth = liq2 ? Math.max(0, liq2 - len(p)) : 0;
  st.speed = len(reject(st.v, up2));
  if (landedHard) st.landedHard = landedHard;

  // ---- fuel ------------------------------------------------------------------------------
  if (!jetting) {
    if (grounded || st.swimming) st.fuel = Math.min(1, st.fuel + dt / T.rechargeGroundSeconds);
    else if (st.sinceJet > T.rechargeAirDelay) st.fuel = Math.min(1, st.fuel + dt / T.rechargeAirSeconds);
  }

  // ---- facing ----------------------------------------------------------------------------
  let fwd = tangent(st.fwd, up2, f);
  if (input.faceView) fwd = tangent(f, up2, fwd);
  else if (len(wish) > 0.1) {
    const want = tangent(wish, up2, fwd);
    fwd = tangent(add(scale(fwd, 1 - damp(T.turnRate, dt)), scale(want, damp(T.turnRate, dt))), up2, want);
  }
  st.fwd = fwd;

  // ---- animation mode ----------------------------------------------------------------------
  if (jetting) st.mode = 'jet';
  else if (st.swimming || (grounded && st.liquidDepth > 0.3)) st.mode = 'wade';
  else if (!grounded) st.mode = st.airTime > 0.12 ? 'fall' : st.mode;
  else st.mode = st.speed > 0.4 ? 'walk' : 'idle';
  return st;
}

// Turn a view direction (unit tangent) by a mouse yaw, keeping it on the tangent plane.
export function yawView(viewFwd, up, angle) {
  return tangent(rotateAround(viewFwd, up, angle), up, viewFwd);
}

// Solid things that are not in the heightfield: tree trunks, boulders (world.sampleObstacles).
// Each is an upright cylinder { unitDir, radius, height } standing on the ground. The explorer
// is pushed out sideways and loses only the part of the velocity that points into it, so
// walking into a trunk slides round it. Above the top (jetpack) there is nothing to hit.
export function collideObstacles(st, obstacles, bodyRadius = 0.35) {
  if (!obstacles || !obstacles.length) return 0;
  let hits = 0;
  for (const ob of obstacles) {
    if (st.altitude > ob.height) continue;
    const r = len(st.p);
    const up = scale(st.p, 1 / r);
    const d = reject(sub(st.p, scale(ob.unitDir, r)), up);
    const dist = len(d);
    const min = ob.radius + bodyRadius;
    if (dist >= min) continue;
    const n = dist > 1e-4 ? scale(d, 1 / dist) : scale(st.fwd, -1);
    st.p = scale(norm(addScaled(st.p, n, min - dist)), r);
    const vn = dot(st.v, n);
    if (vn < 0) st.v = addScaled(st.v, n, -vn);
    hits++;
  }
  return hits;
}
