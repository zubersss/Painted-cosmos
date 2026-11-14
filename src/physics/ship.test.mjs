// Tests: the ship as a body with mass. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepShipBody, stepShipGear, wakeShip, SHIP_BODY as T, shipTopSpeed, shipTerminal, downwashSpeed, groundEffect, gearSag,
  planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
} from './ship.js';
import { makeWorld, V, norm, len, dot } from './testworld.mjs';

const R = 4000;
const Q = () => ({ x: 0, y: 0, z: 0, w: 1 });       // nose toward -Z, up +Y
function flight({ rho = 1.225, g = 9, wind = V(), sigma = 0, alt = 300 } = {}) {
  const st = { p: V(0, R + alt, 0), v: V(), q: Q() };
  const env = { up: V(0, 1, 0), gravity: g, radius: R, altGround: alt, time: 0, air: (p, o) => { o.density = rho; o.wind.x = wind.x; o.wind.y = wind.y; o.wind.z = wind.z; o.turbulence = sigma; return o; } };
  return { st, env };
}
function fly(sim, seconds, cmd, { hz = 60, each } = {}) {
  const dt = 1 / hz;
  for (let i = 0; i < Math.round(seconds * hz); i++) { sim.env.time += dt; stepShipBody(sim.st, typeof cmd === 'function' ? cmd(i * dt, sim.st) : cmd, dt, sim.env); if (each) each((i + 1) * dt, sim.st); }
  return sim.st;
}
const finite = (st) => [st.p.x, st.p.y, st.p.z, st.v.x, st.v.y, st.v.z, st.q.x, st.q.y, st.q.z, st.q.w].every(Number.isFinite);

test('top speed is where full thrust balances drag: v = sqrt(2 m a / (rho CdA))', () => {
  for (const [rho, g] of [[1.225, 9], [65, 8.6], [0.57, 11.5]]) {
    const sim = flight({ rho, g });
    fly(sim, 90, { target: V(0, 0, -1e5), tau: 1 });
    const want = shipTopSpeed(rho);
    assert.ok(Math.abs(-sim.st.v.z - want) < 0.01 * want, `rho ${rho}: ${-sim.st.v.z} vs ${want}`);
    assert.ok(Math.abs(sim.st.p.y - R - 300) < 0.5, 'holds its height meanwhile');
  }
  assert.ok(shipTopSpeed(65) < 40, 'Venus air holds the ship to ' + shipTopSpeed(65));
  assert.equal(shipTopSpeed(0), Infinity);
});

test('acceleration never exceeds the engines; thrust spools up, it does not step', () => {
  const sim = flight({ rho: 0 });
  let amax = 0, pv = 0, jmax = 0, pa = 0;
  fly(sim, 6, { target: V(0, 0, -400), tau: 1 }, { each: (t, st) => { const a = (-st.v.z - pv) * 60; amax = Math.max(amax, a); jmax = Math.max(jmax, Math.abs(a - pa) * 60); pa = a; pv = -st.v.z; } });
  assert.ok(amax <= T.accelMain + 1e-6 && amax > T.accelMain * 0.98, 'peak acceleration ' + amax);
  assert.ok(jmax < T.accelMain / T.spoolUp * 1.05, 'peak jerk ' + jmax + ' (spool-limited)');
  // 0.45 s after the command the engine has reached 63 % of full thrust
  const s2 = flight({ rho: 0 }); fly(s2, T.spoolUp, { target: V(0, 0, -400), tau: 1 });
  assert.ok(Math.abs(len(s2.st.phys.thrust) / T.accelMain - 0.632) < 0.03);
});

test('a small speed change behaves like PILOT\'s first-order follow (time constant tau)', () => {
  const sim = flight({ rho: 0 });
  let t63 = null;
  fly(sim, 6, { target: V(0, 0, -10), tau: 1 }, { each: (t, st) => { if (t63 == null && -st.v.z > 6.32) t63 = t; } });
  assert.ok(t63 > 1.0 && t63 < 1.9, 'reaches 63 % in ' + t63 + ' s (tau 1 s plus the engine spool)');
  assert.ok(Math.abs(-sim.st.v.z - 10) < 0.2);
});

test('turning: thrusters alone slide wide; the carve assist turns the velocity without changing the speed', () => {
  const turn = (carve01) => {
    const sim = flight({ rho: 0 }); sim.st.v = V(0, 0, -100);
    // the nose (and so the target) swings 90 degrees to the right at once
    sim.st.q = { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    let t10 = null, smin = 1e9, smax = 0;
    fly(sim, 12, { target: V(100, 0, 0), tau: 1, carve01 }, { each: (t, st) => { const sp = len(st.v); smin = Math.min(smin, sp); smax = Math.max(smax, sp); const ang = Math.acos(Math.min(1, st.v.x / sp)); if (t10 == null && ang < 10 * Math.PI / 180) t10 = t; } });
    return { t10, smin, smax };
  };
  const pure = turn(0), carved = turn(1);
  assert.ok(pure.t10 > 5, 'with thrusters alone a 90 degree turn at 100 m/s takes ' + pure.t10 + ' s');
  assert.ok(carved.t10 < 3, 'with the carve assist: ' + carved.t10 + ' s');
  assert.ok(carved.smin > 85 && carved.smax < 106, `speed through the carved turn: ${carved.smin}..${carved.smax}`);
});

test('the carve is a force and says so; bounded, the path runs wide of the nose, wider the faster the ship flies', () => {
  // the nose swings 90 degrees at once; how long until the path has come round to within 10 degrees, and the hardest the field pushed
  const turn = (speed, carveAccel) => {
    const sim = flight({ rho: 0 }); sim.st.v = V(0, 0, -speed);
    sim.st.q = { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    let t10 = null, peak = 0, smin = 1e9, smax = 0;
    fly(sim, 30, { target: V(speed, 0, 0), tau: 0.5, carve01: 1, carveAccel }, { each: (t, st) => { const sp = len(st.v); smin = Math.min(smin, sp); smax = Math.max(smax, sp); peak = Math.max(peak, st.phys.fieldCarve); if (t10 == null && Math.acos(Math.min(1, st.v.x / sp)) < 10 * Math.PI / 180) t10 = t; } });
    return { t10, peak, smin, smax, end: sim.st.phys.fieldCarve };
  };
  // unbounded (as PILOT flies it today): the field gives whatever it takes, and now it is reported
  const free = turn(77);
  assert.ok(free.peak > 100, `unbounded at 77 m/s the field pushes ${free.peak.toFixed(0)} m/s2 sideways`);
  assert.ok(free.end < 0.5, 'and nothing once the path is on the nose');
  // bounded to 30 m/s2: never more than that, the speed is still not changed, and the turn takes v (pi / 2) / a
  for (const v of [46, 77, 137]) {
    const b = turn(v, 30);
    assert.ok(b.peak <= 30.001, `${v} m/s: peak ${b.peak}`);
    assert.ok(b.smin > v * 0.85 && b.smax < v * 1.08, `${v} m/s: speed ${b.smin.toFixed(1)}..${b.smax.toFixed(1)}`);    // (the thrusters work too: a few percent)
    // 80 degrees of turning: no faster than the field and every thruster together could (30 + 22 m/s2), no slower than the field alone
    const fast = v * (80 * Math.PI / 180) / 52, slowest = v * (80 * Math.PI / 180) / 30;
    assert.ok(b.t10 > fast * 0.8 && b.t10 < slowest * 1.2 + 1, `${v} m/s: within 10 degrees after ${b.t10.toFixed(2)} s (between ${fast.toFixed(2)} and ${slowest.toFixed(2)} s)`);
  }
  assert.ok(turn(137, 30).t10 > 2 * turn(46, 30).t10, 'three times the speed: the turn takes more than twice as long');
  // a gentle turn the field can afford is not changed by the bound
  const slow = turn(20, 30), slowFree = turn(20);
  assert.ok(Math.abs(slow.t10 - slowFree.t10) < 0.35, `${slow.t10} against ${slowFree.t10}`);
});

test('hover: holds position exactly; no drift, no bobbing (60 and 20 Hz)', () => {
  for (const hz of [60, 20]) {
    const sim = flight();
    fly(sim, 20, { target: V(), tau: 1 }, { hz });
    assert.ok(len(sim.st.v) < 1e-9 && Math.abs(sim.st.p.y - R - 300) < 1e-6, `${hz} Hz: v ${len(sim.st.v)}`);
  }
});

test('lift spool: cutting hover drops the ship, restoring it catches the fall', () => {
  const sim = flight({ rho: 0 });
  fly(sim, 1.0, { target: null, hover: false });
  const g = 9 * (R / (R + 300)) ** 2;
  assert.ok(sim.st.v.y < -0.7 * g && sim.st.v.y > -1.01 * g, 'falls when the lift is cut: ' + sim.st.v.y);
  fly(sim, 6, { target: V(), tau: 1 });
  assert.ok(len(sim.st.v) < 0.01, 'caught: ' + len(sim.st.v));
});

test('free fall with everything off reaches the belly-first terminal speed', () => {
  const sim = flight({ alt: 30000 });
  sim.env.radius = 0;            // constant gravity for the comparison
  fly(sim, 40, { target: null, hover: false });
  const want = shipTerminal(9, 1.225);
  assert.ok(Math.abs(-sim.st.v.y - want) < 0.01 * want, `${-sim.st.v.y} vs ${want}`);
});

test('wind: the flight computer holds station against it with side thrust', () => {
  const sim = flight({ wind: V(15, 0, 0) });
  fly(sim, 15, { target: V(), tau: 1 });
  assert.ok(len(sim.st.v) < 0.01);
  const need = 0.5 * 1.225 * T.cdaSide * 225 / T.mass;      // well inside accelSide
  assert.ok(Math.abs(-sim.st.phys.thrust.x - need) < 0.02 * need, `side thrust ${-sim.st.phys.thrust.x} vs drag ${need}`);
  // engines off: the ship drifts downwind toward the wind speed
  const s2 = flight({ wind: V(15, 0, 0) }); fly(s2, 60, { target: null, hover: true });
  // dv/dt = k (w - v)^2  ->  v = w - 1 / (k t + 1 / w)
  const k = 0.5 * 1.225 * T.cdaSide / T.mass, want = 15 - 1 / (k * 60 + 1 / 15);
  assert.ok(Math.abs(s2.st.v.x - want) < 0.02 * want, `drifts with the wind: ${s2.st.v.x} vs ${want}`);
});

test('turbulence: chop grows with air density, airspeed and gustiness; none in a vacuum', () => {
  const rms = (cfg, speed) => { const sim = flight(cfg); let s = 0, n = 0; fly(sim, 30, { target: V(0, 0, -speed), tau: 1 }, { each: (t, st) => { if (t > 8) { s += len(st.phys.buffet) ** 2; n++; } } }); return Math.sqrt(s / n); };
  const calm = rms({ sigma: 0 }, 46), breeze = rms({ sigma: 1 }, 46), storm = rms({ sigma: 4 }, 46), fast = rms({ sigma: 1 }, 150), mars = rms({ sigma: 4, rho: 0.02 }, 46);
  assert.equal(calm, 0);
  assert.ok(breeze > 0.05 && breeze < 0.6, 'breeze chop ' + breeze + ' m/s2');
  assert.ok(Math.abs(storm / breeze - 4) < 0.2 && fast > breeze * 2.5);
  assert.ok(mars < breeze * 0.1, 'thin air: ' + mars);
  // the chop is a smooth signal (band-limited), not white noise
  const sim = flight({ sigma: 3 }); let worst = 0, prev = null;
  fly(sim, 10, { target: V(0, 0, -60), tau: 1 }, { each: (t, st) => { const b = st.phys.buffet.y; if (prev != null) worst = Math.max(worst, Math.abs(b - prev)); prev = b; } });
  assert.ok(worst < 0.25, 'largest change of the buffet in one frame: ' + worst);
});

test('drag is stable at any speed and any air (implicit integration)', () => {
  for (const hz of [60, 20, 5]) for (const rho of [1.225, 65, 1e4]) {
    const sim = flight({ rho }); sim.st.v = V(3000, -2000, 5000);
    let prev = len(sim.st.v);
    fly(sim, 5, { target: null, hover: true }, { hz, each: (t, st) => { const v = len(st.v); assert.ok(v <= prev + 9 / hz + 1e-6, 'never speeds up'); prev = v; } });
    assert.ok(finite(sim.st));
  }
});

test('downwash and ground effect follow momentum theory', () => {
  const v = downwashSpeed(0.3 * T.mass * 9, 1.225);
  assert.ok(Math.abs(v - Math.sqrt(0.3 * T.mass * 9 / (2 * 1.225 * T.thrusterArea))) < 1e-9 && v > 15 && v < 40, 'hover downwash ' + v + ' m/s');
  assert.equal(downwashSpeed(1e4, 0), 0);
  assert.ok(groundEffect(100) < 1.001 && groundEffect(T.thrusterRadius) > 1.05 && groundEffect(0.1) <= 1.34);
  const sim = flight({ alt: 2 }); fly(sim, 3, { target: V(), tau: 1 });
  assert.ok(sim.st.phys.downwash.thrust > 0.25 * T.mass * 9 && sim.st.phys.groundEffect > 1.05);
  const high = flight({ alt: 300 }); fly(high, 3, { target: V(), tau: 1 });
  assert.equal(high.st.phys.groundEffect, 1);
});

// ---- landing gear ---------------------------------------------------------------------------
function landing({ slopeDeg = 0, g = 9, hz = 60, drop = 0.6, sink = 1.1, ground } = {}) {
  const cone = slopeDeg ? { dir: norm(V(0, 1, 0)), radius: 400, height: 400 * Math.tan(slopeDeg * Math.PI / 180) } : null;
  const sample = makeWorld({ R, cone });
  const d = norm(V(Math.sin(200 / R), Math.cos(200 / R), 0)), s0 = sample(d);
  const st = { p: V(d.x * (s0.radius + drop), d.y * (s0.radius + drop), d.z * (s0.radius + drop)), v: V(-d.x * sink, -d.y * sink, -d.z * sink), q: Q() };
  const env = { sample, gravity: g, ground: ground ? (su, o) => Object.assign(o, ground) : undefined };
  return { st, env, sample, hz };
}
function settle(L, seconds, liftFade = 1.5) {
  const out = { peak: 0, slept: null, energy: [] };
  for (let i = 0; i < seconds * L.hz; i++) {
    const t = i / L.hz;
    stepShipGear(L.st, { lift01: Math.max(0, 1 - t / liftFade) }, 1 / L.hz, L.env);
    const B = L.st.phys;
    out.peak = Math.max(out.peak, B.legLoad[0] + B.legLoad[1] + B.legLoad[2]);
    if (B.asleep && out.slept == null) out.slept = t;
  }
  return out;
}
const shipUp = (q) => V(2 * (q.x * q.y - q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z), 2 * (q.y * q.z + q.w * q.x));

test('gear: settles on level ground, compresses by the static sag, and goes to sleep', () => {
  for (const hz of [60, 20]) for (const g of [9, 2.2, 11.5]) {
    const L = landing({ hz, g });
    const r = settle(L, 10);
    assert.ok(r.slept != null && r.slept < 6, `${hz} Hz g ${g}: asleep at ${r.slept}`);
    const B = L.st.phys;
    const mean = (B.legCompress[0] + B.legCompress[1] + B.legCompress[2]) / 3;
    assert.ok(Math.abs(mean - gearSag(g)) < 0.12 * gearSag(g) + 0.002, `compression ${mean} vs sag ${gearSag(g)}`);
    const load = B.legLoad[0] + B.legLoad[1] + B.legLoad[2];
    assert.ok(Math.abs(load - T.mass * g) < 0.02 * T.mass * g, 'the legs carry the weight');
    // a spring-damper meeting the ground at v: at most the weight plus about m w v (1 + 2 zeta) / 2
    const wn = 2 * Math.PI * T.gearFrequency;
    assert.ok(r.peak < T.mass * g + 1.4 * T.mass * wn * 1.1, 'a soft touchdown: peak load ' + r.peak / (T.mass * g) + ' weights');
    // asleep means exactly still, for ever
    const p0 = { ...L.st.p }, q0 = { ...L.st.q };
    for (let i = 0; i < 600; i++) stepShipGear(L.st, { lift01: 0 }, 1 / hz, L.env);
    assert.deepEqual(L.st.p, p0); assert.deepEqual(L.st.q, q0);
  }
});

test('gear: on a slope the hull settles parallel to the ground and stays put', () => {
  for (const hz of [60, 20]) for (const deg of [8, 20]) {
    const L = landing({ slopeDeg: deg, hz });
    const p0 = { ...L.st.p };
    const r = settle(L, 12);
    assert.ok(r.slept != null, `${hz} Hz ${deg} deg: never slept`);
    const n = L.sample(norm(L.st.p)).normal;
    const tilt = Math.acos(Math.min(1, dot(shipUp(L.st.q), n))) * 180 / Math.PI;
    assert.ok(tilt < 1.2, `hull is ${tilt} degrees off the ground plane`);
    assert.ok(len({ x: L.st.p.x - p0.x, y: 0, z: L.st.p.z - p0.z }) < 1.2, 'did not slide away');
  }
});

test('gear: too steep or too slippery and it slides (friction is real), but never explodes', () => {
  const icy = landing({ slopeDeg: 12, ground: { friction: 0.08, kinetic: 0.05 } });
  settle(icy, 6);
  assert.ok(len(icy.st.v) > 1, 'sliding on ice at ' + len(icy.st.v));
  assert.ok(finite(icy.st) && len(icy.st.v) < 30);
  const steep = landing({ slopeDeg: 50 }); settle(steep, 5);
  assert.ok(finite(steep.st) && len(steep.st.v) < 60);
});

test('gear: a hard drop bounces less each time (energy only leaves)', () => {
  for (const hz of [60, 20]) {
    const L = landing({ hz, drop: 3, sink: 0 });
    const peaks = []; let rising = false, hmax = 0, prevV = 0;
    for (let i = 0; i < 12 * hz; i++) {
      stepShipGear(L.st, { lift01: 0 }, 1 / hz, L.env);
      const up = norm(L.st.p), vv = dot(L.st.v, up), h = len(L.st.p) - R;
      if (vv > 0) { rising = true; hmax = Math.max(hmax, h); } else if (rising) { peaks.push(hmax); rising = false; hmax = 0; }
      prevV = vv;
    }
    assert.ok(peaks.length >= 1 && peaks[0] < 3, `${hz} Hz first rebound ${peaks[0]}`);
    for (let k = 1; k < peaks.length; k++) assert.ok(peaks[k] <= peaks[k - 1] + 1e-3, `${hz} Hz rebounds grow: ${peaks}`);
    assert.ok(L.st.phys.asleep, 'ends asleep');
  }
});

test('gear: wakeShip lets a sleeping ship move again', () => {
  const L = landing(); settle(L, 8);
  assert.ok(L.st.phys.asleep);
  wakeShip(L.st); L.st.v = V(0.5, 0, 0);
  stepShipGear(L.st, { lift01: 0 }, 1 / 60, L.env);
  assert.ok(!L.st.phys.asleep);
});

// ---- pulse drive ---------------------------------------------------------------------------
test('pulse plan: an S-curve with continuous acceleration, bounded jerk, exact distance', () => {
  for (const [v0, v1] of [[0, 30000], [30000, 0], [200, 900], [0, 50]]) {
    const plan = planSpeedChange(v0, v1, T.pulseAccel, T.pulseJerk);
    const o = {}; let pa = 0, s = 0, pv = v0;
    const n = 20000, dt = plan.T / n;
    for (let i = 1; i <= n; i++) {
      sampleSpeedChange(plan, i * dt, o);
      assert.ok(Math.abs(o.a) <= T.pulseAccel + 1e-6);
      assert.ok(Math.abs(o.a - pa) <= T.pulseJerk * dt * 1.001 + 1e-9, 'jerk bound');
      s += 0.5 * (pv + o.v) * dt; pa = o.a; pv = o.v;
    }
    assert.ok(Math.abs(o.v - v1) < 1e-6 * (1 + Math.abs(v1)) && Math.abs(o.a) < 1e-6);
    assert.ok(Math.abs(s - plan.distance) < 1e-4 * plan.distance + 1e-6, `distance ${s} vs ${plan.distance}`);
    assert.ok(Math.abs(o.s - plan.distance) < 1e-6 * plan.distance + 1e-6);
  }
  assert.ok(pulseBrakeDistance(30000) > 1e6, 'stopping from pulse speed takes over a thousand kilometres');
});

test('stepPulse: reaches the wanted speed without overshoot, jerk-limited, at 60 and 20 Hz', () => {
  for (const hz of [60, 20]) {
    const ps = { a: 0, v: 0 }; let t = 0, amax = 0, jmax = 0, pa = 0, over = 0;
    while (ps.v < 30000 && t < 300) { stepPulse(ps, 30000, 1 / hz); t += 1 / hz; amax = Math.max(amax, ps.a); jmax = Math.max(jmax, Math.abs(ps.a - pa) * hz); pa = ps.a; over = Math.max(over, ps.v - 30000); }
    const plan = planSpeedChange(0, 30000, T.pulseAccel, T.pulseJerk);
    assert.equal(ps.v, 30000); assert.equal(over, 0);
    assert.ok(Math.abs(t - plan.T) < 0.02 * plan.T + 2 / hz, `${hz} Hz: ${t} s vs plan ${plan.T}`);
    assert.ok(amax <= T.pulseAccel + 1e-9 && jmax <= T.pulseJerk * 1.001 + 1e-6, `a ${amax}, jerk ${jmax}`);
    // and back down; changing the goal mid-way is fine
    for (let i = 0; i < 400 * hz; i++) stepPulse(ps, i < 2 * hz ? 20000 : 0, 1 / hz);
    assert.equal(ps.v, 0); assert.ok(Math.abs(ps.a) < T.pulseJerk / hz * 2);
  }
});

test('extreme inputs never produce NaN', () => {
  for (const cmd of [{ target: V(1e12, -1e12, 1e12), tau: 0 }, { target: V(NaN, 0, 0), tau: 1 }, { target: null }, { target: V(), tau: 1e-9, boost: true }]) {
    const sim = flight({ rho: 500, wind: V(900, 900, 900), sigma: 1e4 });
    fly(sim, 3, cmd, { hz: 20 });
    if (cmd.target && Number.isNaN(cmd.target.x)) continue;
    assert.ok(finite(sim.st), JSON.stringify(cmd)); assert.ok(len(sim.st.v) < 5000);
  }
  const L = landing({ drop: 40, sink: 80 }); settle(L, 5); assert.ok(finite(L.st));
  const sim = flight(); sim.st.v = V(NaN, 0, 0); fly(sim, 1, { target: V(), tau: 1 }); assert.ok(finite(sim.st));
});

test('field brake (assist): in vacuum the ship stops from cruise in seconds, never speeds up, and the crew feel only the thrusters', () => {
  const run = (brake) => {
    const st = { p: V(0, 0, 0), v: V(0, 0, -750), q: { x: 0, y: 0, z: 0, w: 1 } };
    let t = 0, gMax = 0, worstGain = 0, peak = 0;
    while (Math.hypot(st.v.x, st.v.y, st.v.z) > 5 && t < 200) {
      const s0 = Math.hypot(st.v.x, st.v.y, st.v.z);
      stepShipBody(st, { target: V(0, 0, 0), tau: 1.7 * 0.45, hover: false, boost: true, brake }, 1 / 60, { up: null, gravity: 0 });
      worstGain = Math.max(worstGain, Math.hypot(st.v.x, st.v.y, st.v.z) - s0);
      if (t > 1) gMax = Math.max(gMax, st.phys.gLoad);
      peak = Math.max(peak, st.phys.fieldBrake);
      t += 1 / 60;
    }
    return { t, gMax, worstGain, peak };
  };
  const off = run(0), on = run(1);
  assert.ok(off.t > 45, 'thrusters alone: ' + off.t.toFixed(1) + ' s');
  assert.ok(on.t > 3 && on.t < 9, 'with the field: ' + on.t.toFixed(1) + ' s');
  assert.ok(on.peak <= T.fieldBrake + 1e-9 && on.peak > 100, 'field deceleration ' + on.peak);
  assert.ok(on.worstGain <= 1e-9, 'never speeds the ship up');
  assert.ok(on.gMax <= T.accelReverse / 9.81 + 0.05, 'felt: ' + on.gMax + ' g');
  // it only ever slows: asked to speed up, the brake does nothing
  const st = { p: V(0, 0, 0), v: V(0, 0, -100), q: { x: 0, y: 0, z: 0, w: 1 } };
  for (let i = 0; i < 120; i++) stepShipBody(st, { target: V(0, 0, -700), tau: 1.7, hover: false, boost: true, brake: 1 }, 1 / 60, { up: null, gravity: 0 });
  assert.equal(st.phys.fieldBrake, 0);
  assert.ok(st.v.z < -180 && st.v.z > -100 - 60 * 2 - 1, 'accelerating on the main drive only: ' + st.v.z);
});

test('lift-off on the gear: the legs unload, the wash comes on, the feet leave, and the hand-over to flight has no sag', () => {
  for (const [bodyId, g, rho] of [['earth', 9.81, 1.225], ['moon', 1.62, 0], ['jupiter', 24.8, 0.57]]) {
    const R = 4000, sample = makeWorld({ R, biome: 'alpine_meadow' });
    const up = norm(V(0.3, 0.5, 0.81));
    const st = { p: V(up.x * (R + 0.4), up.y * (R + 0.4), up.z * (R + 0.4)), v: V(0, 0, 0), q: { x: 0, y: 0, z: 0, w: 1 } };
    // stand the ship upright on the ground: rotate +Y onto `up`
    { const ax = norm(V(up.z, 0, -up.x)), a = Math.acos(up.y), s = Math.sin(a / 2); st.q = { x: ax.x * s, y: 0, z: ax.z * s, w: Math.cos(a / 2) }; }
    const air = (p, o) => { o.density = rho; o.wind = o.wind || V(0, 0, 0); o.turbulence = 0; return o; };
    const envG = { sample, gravity: g, air }, envB = { up, gravity: g, radius: R, air, altGround: 1 };
    for (let i = 0; i < 600 && !(st.phys && st.phys.asleep); i++) stepShipGear(st, { lift01: 0 }, 1 / 60, envG);
    assert.ok(st.phys.asleep, bodyId + ': parked and asleep');
    const h0 = len(st.p) - R;
    wakeShip(st);
    let lift01 = 0, t = 0, tOff = -1, hMin = Infinity, hPrev = h0, washOnGround = 0, worstDrop = 0, gMax = 0;
    const climb = 2.5;
    while (t < 6) {
      t += 1 / 60;
      if (st.phys.contacts > 0 || tOff < 0) {
        lift01 = Math.min(1, lift01 + (1 / 60) / 1.2);
        stepShipGear(st, { lift01, hold: V(up.x * climb * lift01, up.y * climb * lift01, up.z * climb * lift01) }, 1 / 60, envG);
        if (st.phys.contacts > 0) washOnGround = Math.max(washOnGround, st.phys.downwash.thrust);
        if (st.phys.contacts === 0 && tOff < 0) tOff = t;
      } else {
        envB.altGround = len(st.p) - R;
        stepShipBody(st, { target: V(up.x * climb, up.y * climb, up.z * climb), tau: 1, hover: true }, 1 / 60, envB);
        gMax = Math.max(gMax, st.phys.gLoad);
      }
      const h = len(st.p) - R;
      worstDrop = Math.max(worstDrop, hPrev - h); hPrev = h;
      if (tOff > 0) hMin = Math.min(hMin, h);
    }
    assert.ok(tOff > 0.4 && tOff < 1.6, `${bodyId}: feet off at ${tOff.toFixed(2)} s`);
    assert.ok(washOnGround > 0.12 * 4200 * g, `${bodyId}: thruster wash before the feet leave: ${washOnGround.toFixed(0)} N`);
    assert.ok(worstDrop < 0.004, `${bodyId}: never sinks on the way up (worst ${worstDrop.toFixed(4)} m in a frame)`);
    assert.ok(hMin >= h0 - 1e-3 && hPrev > h0 + 5, `${bodyId}: ${hPrev.toFixed(1)} m up after 6 s`);
    assert.ok(gMax < g / 9.81 + 0.6, `${bodyId}: a gentle hand-over, ${gMax.toFixed(2)} g felt`);
  }
});

test('P12 the last metre: a commanded 0.6 m/s descent does not hang on the ground cushion', () => {
  // Before: the extra lift of the thrusters near the ground (a third more at 1 m) balanced the flight
  // computer's whole velocity error: 0.05 m/s at 1.1 m, 2.1 s for the 0.6 m above the gear. Now the
  // computer allows for the cushion; what is left is the engine's lag behind it, a real, small slowing.
  const descend = (rho, g, tau, T2) => {
    const sim = flight({ rho, g, alt: 6 }); const dt = 1 / 60; let tIn = 0, slow = 9, n = 0, wash16 = 0;
    for (; n < 60 * 30; n++) {
      const alt = sim.st.p.y - R; if (alt <= 1.0) break;
      sim.env.altGround = alt; sim.env.time += dt;
      stepShipBody(sim.st, { target: V(0, -Math.min(1.5, Math.max(0.6, (alt - 1.0) * 0.9)), 0), tau, hover: true }, dt, sim.env, T2);
      if (alt >= 1.6) { tIn = n; wash16 = sim.st.phys.downwash.speed; } else slow = Math.min(slow, -sim.st.v.y);
    }
    return { time: (n - tIn) * dt, slow, wash16, wash10: sim.st.phys.downwash.speed, ge: sim.st.phys.groundEffect };
  };
  const earth = descend(1.225, 9.81, 0.5);
  assert.ok(earth.time < 1.0 && earth.slow > 0.4 && earth.slow < 0.6, `Earth: 1.6 to 1.0 m in ${earth.time} s, slowest ${earth.slow} m/s`);
  assert.ok(earth.ge > 1.3 && earth.wash10 < earth.wash16 * 0.97, `the cushion is still there: less thrust for the same lift (wash ${earth.wash16} -> ${earth.wash10})`);
  const old = descend(1.225, 9.81, 0.5, { ...T, groundComp: 0 });
  assert.ok(old.time > 1.8 && old.slow < 0.1, `without the compensation it hangs: ${old.time} s, ${old.slow} m/s`);
  for (const [rho, g, tau] of [[1.225, 9.81, 1.0], [0.02, 3.71, 0.5], [65, 8.87, 0.5]]) {
    const r = descend(rho, g, tau); assert.ok(r.time < 1.0 && r.slow > 0.4, `rho ${rho} tau ${tau}: ${r.time} s, slowest ${r.slow}`);
  }
  // no air, no cushion: in a vacuum a thruster is a rocket
  const moon = descend(0, 1.62, 0.5); assert.equal(moon.ge, 1);
});

test('P13 the hovering hull in a wind: it rolls away from a side wind and swings its nose into it, by its own mass and areas (half a degree in a breeze, degrees in a storm), overshoots and corrects; level in still air and in a vacuum', () => {
  const D = 180 / Math.PI, hover = { target: V(), hover: true };
  // a steady wind from the left (blowing toward +x; the nose is -z): the top of the hull goes downwind, the nose upwind
  const a = flight({ wind: V(8, 0, 0), alt: 10 }); fly(a, 20, hover);
  const s = a.st.phys.buffetAngle;
  assert.ok(s.roll < 0 && s.roll * D > -0.8 && s.roll * D < -0.2, `8 m/s: roll ${s.roll * D} deg`);
  assert.ok(s.yaw > 0 && s.yaw * D < 0.8 && s.yaw * D > 0.2, `8 m/s: yaw ${s.yaw * D} deg (rotateY +: the nose toward -x, into the wind)`);
  // the force goes with the square of the wind
  const b = flight({ wind: V(20, 0, 0), alt: 10 }); fly(b, 20, hover);
  assert.ok(Math.abs(b.st.phys.buffetAngle.roll / s.roll - 6.25) < 0.5, `20 m/s over 8 m/s: ${b.st.phys.buffetAngle.roll / s.roll}`);
  // a gust arriving: the hull swings past its new trim and comes back (the hold is underdamped)
  const c = flight({ wind: V(8, 0, 0), alt: 10 }); fly(c, 20, hover);
  c.env.air = (p, o) => { o.density = 1.225; o.wind.x = 14; o.wind.y = 0; o.wind.z = 0; o.turbulence = 0; return o; };
  let far = 0; fly(c, 12, hover, { each: (t, st) => { far = Math.min(far, st.phys.buffetAngle.roll); } });
  const end = c.st.phys.buffetAngle.roll;
  assert.ok(far < end * 1.1 && far > end * 1.35, `overshoot: furthest ${far * D} deg, settles at ${end * D} deg`);
  // nothing to rock it in still air or with no air
  for (const cfg of [{ alt: 10 }, { rho: 0, wind: V(30, 0, 0), alt: 10 }]) { const z = flight(cfg); fly(z, 5, hover); const k = z.st.phys.buffetAngle; assert.ok(Math.abs(k.roll) < 1e-6 && Math.abs(k.yaw) < 1e-6 && Math.abs(k.pitch) < 1e-6); }
});

// ---- (M4) the hull in a storm ------------------------------------------------------------------------------------
test('M4 the hull in a storm: hands off in a squall (60 to 240 m/s in gusts, a cliff\'s sheet of air going up at 150) the ship is carried a few metres, rocks 5 to 10 degrees and holds; in an ordinary storm the hull is handed the wind of the instant as it was, and holds its station; the field sheds the wind, never the hull\'s own drag (60 and 20 Hz)', () => {
  // PILOT's critique of PHYSICS, item 4: 30 m over Neptune's storm coast the ship was carried 150 m in 30 s, between 7
  // and 78 m up, at 5 g (12 g where the cliff's updraught took it), the drawn hull rocking 31 degrees.
  const D = 180 / Math.PI, hover = { target: V(), hover: true, tau: 1 };
  // a squall as air.js hands it at that stand: a level wind of 110 m/s in gusts from 0.55 to 2.2 of it, swinging, with a
  // sheet of rising air 1.4 times as fast as the level wind for seconds at a time; Neptune's air and gravity
  const squall = (st0) => (p, o) => {
    const t = st0.env.time, gust = 1 + 0.6 * Math.sin(t * 2.3) + 0.4 * Math.sin(t * 5.1 + 1) + 0.2 * Math.sin(t * 11 + 2), W = 110 * Math.max(0.55, gust), a = 0.5 * Math.sin(t * 0.7);
    o.density = 0.92; o.wind.x = W * Math.cos(a); o.wind.z = W * Math.sin(a); o.wind.y = Math.sin(t * 0.45) > 0.2 ? 1.4 * W : 0.1 * W; o.turbulence = 18; return o;
  };
  const run = (hz, cmd, seconds = 30) => {
    const sim = flight({ g: 11.15, alt: 30 }); sim.env.air = squall(sim);
    const p0 = { ...sim.st.p }; let far = 0, lo = 0, hi = 0, gHalf = 0, gFrame = 0, rock = 0, rockSum = 0, n = 0, shed = 0, felt = 0, k = 0, pv = { ...sim.st.v }, v2 = { ...sim.st.v };
    fly(sim, seconds, cmd, { hz, each: (t, st) => {
      const dx = st.p.x - p0.x, dy = st.p.y - p0.y, dz = st.p.z - p0.z; far = Math.max(far, Math.hypot(dx, dz)); lo = Math.min(lo, dy); hi = Math.max(hi, dy);
      gFrame = Math.max(gFrame, Math.hypot(st.v.x - pv.x, st.v.y - pv.y, st.v.z - pv.z) * hz / 9.81); pv = { ...st.v };
      if (++k % Math.round(hz / 2) === 0) { gHalf = Math.max(gHalf, Math.hypot(st.v.x - v2.x, st.v.y - v2.y, st.v.z - v2.z) * 2 / 9.81); v2 = { ...st.v }; }
      const b = st.phys.buffetAngle, r = Math.hypot(b.pitch, b.roll, b.yaw) * D; rock = Math.max(rock, r); if (t > 5) { rockSum += r; n++; }
      shed = Math.max(shed, st.phys.windShed || 0); if (st.phys.windFelt) felt = Math.max(felt, Math.hypot(st.phys.windFelt.x, st.phys.windFelt.z));
      assert.ok(finite(st), 'NaN');
    } });
    return { far, lo, hi, gHalf, gFrame, rock, rockMean: rockSum / Math.max(1, n), shed, felt };
  };
  for (const hz of [60, 20]) {
    const s = run(hz, hover);
    console.log(`# M4 hands off in the squall, ${hz} Hz, 30 s: carried ${s.far.toFixed(1)} m, height ${s.lo.toFixed(1)} to ${s.hi.toFixed(1)} m, ${s.gFrame.toFixed(2)} g in a step, ${s.gHalf.toFixed(2)} g over half a second, rock ${s.rock.toFixed(1)} deg at most (mean ${s.rockMean.toFixed(1)}), the field shed up to ${s.shed.toFixed(0)} m/s^2, the level wind handed to the hull up to ${s.felt.toFixed(0)} m/s`);
    assert.ok(s.far < 15, `${hz} Hz: carried ${s.far.toFixed(1)} m (before M4: over 100)`);
    assert.ok(s.lo > -10 && s.hi < 10, `${hz} Hz: height ${s.lo.toFixed(1)} to ${s.hi.toFixed(1)} m`);
    assert.ok(s.gHalf < 1.0 && s.gFrame < 1.5, `${hz} Hz: ${s.gHalf.toFixed(2)} g over half a second, ${s.gFrame.toFixed(2)} g in a step`);
    assert.ok(s.rock < 12 && s.rockMean > 3, `${hz} Hz: the drawn hull rocks ${s.rock.toFixed(1)} deg at most, ${s.rockMean.toFixed(1)} in the mean`);
    assert.ok(s.shed > 5 && s.felt < 110, `${hz} Hz: the field sheds what the thrusters cannot hold: ${s.shed.toFixed(1)} m/s^2, ${s.felt.toFixed(0)} m/s handed`);
  }
  // the same squall with the storm law off (cmd.storm false) is the hull in the raw wind: carried away
  const raw = run(60, { ...hover, storm: false });
  assert.ok(raw.far > 60 || raw.hi > 30, `the raw squall: carried ${raw.far.toFixed(0)} m, ${raw.hi.toFixed(0)} m up`);

  // an ordinary storm (30 m/s on Earth, gusting 18 to 42, a chop of 5 m/s): the wind of the instant, as it always was
  const storm30 = (cmd) => {
    const sim = flight({ alt: 60 }); sim.env.air = (p, o) => { const t = sim.env.time, W = 30 * (1 + 0.4 * Math.sin(t * 1.9)); o.density = 1.115; o.wind.x = W; o.wind.y = 0; o.wind.z = 0.3 * W * Math.sin(t * 0.8); o.turbulence = 5; return o; };
    const p0 = { ...sim.st.p }; let far = 0, rock = 0, same = true;
    fly(sim, 20, cmd, { each: (t, st) => { far = Math.max(far, Math.hypot(st.p.x - p0.x, st.p.z - p0.z)); const b = st.phys.buffetAngle; rock = Math.max(rock, Math.hypot(b.pitch, b.roll, b.yaw) * D); if (st.phys.windFelt && Math.abs(st.phys.windFelt.x - 30 * (1 + 0.4 * Math.sin(sim.env.time * 1.9))) > 1e-9) same = false; } });
    return { far, rock, same, shed: sim.st.phys.windShed };
  };
  const on = storm30(hover), off = storm30({ ...hover, storm: false });
  assert.ok(on.same && on.shed === 0, 'in an ordinary storm the hull is handed the wind of the instant and the field sheds nothing');
  assert.ok(on.rock > 3 && on.rock < 9 && on.rock < off.rock, `side-on to 42 m/s it rocks ${on.rock.toFixed(1)} deg (${off.rock.toFixed(1)} without the law: the lean saturates at rockMax on each axis)`);
  assert.ok(on.far < 3 && on.far <= off.far + 0.05, `and holds its station: ${on.far.toFixed(2)} m (${off.far.toFixed(2)} m without the hold)`);

  // the field sheds the WIND only: Venus' still air at full throttle is the main engine's to push through, as before
  for (const cmd of [{ target: V(0, 0, -1e5), tau: 1 }, { target: V(0, 0, -1e5), tau: 1, storm: false }]) {
    const sim = flight({ rho: 65, g: 8.6 }); fly(sim, 60, cmd);
    assert.ok(Math.abs(-sim.st.v.z - shipTopSpeed(65)) < 0.01 * shipTopSpeed(65) && (sim.st.phys.windShed || 0) === 0, `Venus: ${-sim.st.v.z} m/s`);
  }
  // the station is where the hull came to rest, not where the throttle was cut: no pull back after a stop
  {
    const sim = flight({}); fly(sim, 6, { target: V(0, 0, -40), tau: 1 });
    let rest = null, back = 0;
    fly(sim, 20, hover, { each: (t, st) => { if (!rest && len(st.v) < 0.05) rest = { ...st.p }; if (rest) back = Math.max(back, Math.hypot(st.p.x - rest.x, st.p.z - rest.z)); } });
    assert.ok(rest && back < 0.5, `after a stop the hull stays where it stopped: ${back.toFixed(2)} m`);
    // and anything asked of it lets the station go
    fly(sim, 3, { target: V(5, 0, 0), tau: 1 }); assert.equal(sim.st.phys.station.on, false);
  }
  // still air, hands off: nothing to hold against, nothing moves
  { const sim = flight({ alt: 30 }); const p0 = { ...sim.st.p }; fly(sim, 10, hover); assert.ok(Math.hypot(sim.st.p.x - p0.x, sim.st.p.y - p0.y, sim.st.p.z - p0.z) < 1e-6); }
});
