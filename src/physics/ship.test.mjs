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
  const need = 0.5 * 1.225 * T.cdaSide * 225 / T.mass;
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
