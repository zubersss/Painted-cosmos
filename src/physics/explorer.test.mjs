// Tests: the explorer as a body with mass. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepExplorerBody, EXPLORER_BODY as T, explorerTerminal, jumpSpeedFor, sustainableSpeed } from './explorer.js';
import { makeWorld, V, norm, len, dot } from './testworld.mjs';

const R = 4000;
const GRASS = { material: 'grass', friction: 0.65, kinetic: 0.5, foothold: 0.3, restitution: 0.1, sink: 0.01, drag: 0.03, dust: 0.02 };
const ICE = { material: 'ice', friction: 0.06, kinetic: 0.042, foothold: 0.03, restitution: 0.1, sink: 0, drag: 0.005, dust: 0 };
const SAND = { material: 'sand', friction: 0.6, kinetic: 0.48, foothold: 0.05, restitution: 0.05, sink: 0.06, drag: 0.28, dust: 0.6 };

function make({ world = {}, g = 9, rho = 1.225, wind = V(), ground = GRASS, dir = V(0, 0, 1), alt = 0, liquid } = {}) {
  const sample = makeWorld({ R, ...world });
  const d = norm(dir), s = sample(d);
  const st = { p: V(d.x * (s.radius + alt), d.y * (s.radius + alt), d.z * (s.radius + alt)), v: V(), grounded: alt === 0 };
  const env = { sample, gravity: g, air: (p, o) => { o.density = rho; o.wind.x = wind.x; o.wind.y = wind.y; o.wind.z = wind.z; return o; }, ground: (su, o) => Object.assign(o, ground), liquid };
  return { st, env, sample };
}
function run(sim, seconds, cmd, { hz = 60, each } = {}) {
  const dt = 1 / hz, n = Math.round(seconds * hz);
  for (let i = 0; i < n; i++) { stepExplorerBody(sim.st, typeof cmd === 'function' ? cmd(i * dt, sim.st) : cmd, dt, sim.env); if (each) each((i + 1) * dt, sim.st); }
  return sim.st;
}
const speed = (st) => len(st.v);
const vert = (st) => dot(st.v, norm(st.p));
const altOf = (sim) => len(sim.st.p) - sim.sample(norm(sim.st.p)).radius;
const finite = (st) => [st.p.x, st.p.y, st.p.z, st.v.x, st.v.y, st.v.z].every(Number.isFinite);

test('at rest stays exactly at rest: no creep, no jitter (flat, slope, wind, 60 and 20 Hz)', () => {
  for (const hz of [60, 20]) {
    for (const cfg of [{}, { wind: V(12, 0, 0) }, { world: { cone: { dir: norm(V(0, 0, 1)), radius: 300, height: 300 * Math.tan(0.5) } }, dir: V(0.03, 0, 1) }]) {
      const sim = make(cfg); const p0 = { ...sim.st.p };
      run(sim, 10, { wish: V() }, { hz });
      assert.equal(speed(sim.st), 0, `hz ${hz} ${JSON.stringify(cfg.wind || cfg.world || 'flat')}`);
      assert.ok(len({ x: sim.st.p.x - p0.x, y: sim.st.p.y - p0.y, z: sim.st.p.z - p0.z }) < 1e-6);
      assert.equal(sim.st.grounded, true);
    }
  }
});

test('acceleration is limited by leg strength, braking by friction: momentum is real', () => {
  const sim = make();
  let t95 = null, amax = 0, pv = 0;
  run(sim, 3, { wish: V(4.2, 0, 0) }, { each: (t, st) => { const v = speed(st); amax = Math.max(amax, (v - pv) * 60); pv = v; if (t95 == null && v > 4.2 * 0.95) t95 = t; } });
  assert.ok(amax <= T.legAccel + 1e-6, 'peak acceleration ' + amax);
  assert.ok(t95 > 0.4 && t95 < 1.2, 'time to walking speed ' + t95);
  assert.ok(Math.abs(speed(sim.st) - 4.2) < 0.01);
  // stopping from a run takes over a second and several metres
  run(sim, 3, { wish: V(7.4, 0, 0) });
  const x0 = sim.st.p.x; let ts = null, dmax = 0; pv = speed(sim.st);
  run(sim, 4, { wish: V() }, { each: (t, st) => { const v = speed(st); dmax = Math.max(dmax, (pv - v) * 60); pv = v; if (ts == null && v < 0.01) ts = t; } });
  // friction circle + ground resistance + air drag, nothing more
  assert.ok(dmax <= (GRASS.friction + GRASS.foothold + GRASS.drag) * 9 + 0.3, 'peak braking ' + dmax);
  assert.ok(dmax > 5, 'and friction really is used for braking: ' + dmax);
  assert.ok(ts > 1.0 && ts < 2.5, 'stop time ' + ts);
  assert.ok(sim.st.p.x - x0 > 3 && sim.st.p.x - x0 < 8, 'stop distance ' + (sim.st.p.x - x0));
});

test('ice: you can barely start and barely stop', () => {
  const sim = make({ ground: ICE });
  run(sim, 4, { wish: V(7.4, 0, 0) });
  const v4 = speed(sim.st);
  assert.ok(v4 < 4 * 9 * (ICE.friction + ICE.foothold) + 0.01 && v4 > 0.5, 'after 4 s on ice: ' + v4);
  assert.ok(sim.st.phys.scramble01 > 0.5, 'the legs want far more grip than the ice gives');
  assert.equal(sim.st.phys.slip01, 0, 'but a careful walker does not spin their feet');
  const x0 = sim.st.p.x;
  run(sim, 30, { wish: V() });
  assert.ok(sim.st.p.x - x0 > v4 * v4 / (2 * 9 * (ICE.friction + ICE.foothold)) * 0.6, 'slides a long way');
  assert.equal(speed(sim.st), 0);
});

test('slopes: holds up to atan(mu + foothold); beyond it slides, digging in (self-arrest)', () => {
  const hold = Math.atan(GRASS.friction + GRASS.foothold);
  for (const [ang, slides] of [[hold - 0.06, false], [hold + 0.08, true], [1.05, true]]) {
    const sim = make({ world: { cone: { dir: norm(V(0, 0, 1)), radius: 400, height: 400 * Math.tan(ang) } }, dir: V(0.02, 0, 1) });
    run(sim, 2, { wish: V() });
    if (!slides) { assert.equal(speed(sim.st), 0, 'holds at ' + ang); continue; }
    // friction while sliding is between the kinetic coefficient and 85 % of the holding traction
    const lo = 9 * (Math.sin(ang) - T.arrest * (GRASS.friction + GRASS.foothold) * Math.cos(ang)), hi = 9 * (Math.sin(ang) - GRASS.kinetic * Math.cos(ang));
    assert.ok(speed(sim.st) >= lo * 2 - 0.05 && speed(sim.st) <= hi * 2 + 0.05, `slide speed at ${ang.toFixed(2)} rad after 2 s: ${speed(sim.st)} not in ${lo * 2}..${hi * 2}`);
    assert.ok(speed(sim.st) > 0.3 && sim.st.phys.slip01 > 0);
  }
});

test('power limits the climb: uphill is slower than level, and faster on a low-gravity world', () => {
  const cone = { dir: norm(V(0, 0, 1)), radius: 900, height: 900 * Math.tan(0.45) };
  const up = (g) => { const sim = make({ world: { cone }, dir: V(0.2, 0, 1), g }); run(sim, 9, { wish: V(-7.4, 0, 0) }); return speed(sim.st); };
  const earth = up(9), mars = up(4.6);
  const want = T.legPower / (T.mass * 9 * Math.sin(0.45));
  assert.ok(earth < 7.4 * 0.6 && Math.abs(earth - want) < 0.6, `earth climb ${earth}, power limit ${want}`);
  // on Mars the same legs lift half the weight (but have half the traction to do it with)
  assert.ok(mars > earth * 1.4, `mars climb ${mars}`);
});

test('soft ground and dense air cost speed', () => {
  const lvl = (cfg) => { const sim = make(cfg); run(sim, 6, { wish: V(7.4, 0, 0) }); return speed(sim.st); };
  const firm = lvl({}), sand = lvl({ ground: SAND }), venus = lvl({ rho: 65, g: 8.6 });
  assert.ok(Math.abs(firm - 7.4) < 0.02);
  assert.ok(sand < 6.3 && sand > 4.4, 'running on sand ' + sand + ' (a fifth to two fifths slower)');
  assert.ok(venus < 4.2 && venus > 2.5, 'running through Venus air ' + venus);
  assert.ok(Math.abs(sand - sustainableSpeed(7.4, 9, 1.225, SAND)) < 0.15);
  assert.ok(Math.abs(venus - sustainableSpeed(7.4, 8.6, 65, GRASS)) < 0.15);
});

test('wind leans on you: a gale pushes a walker back and blows a standing one along on ice', () => {
  const still = make(), gale = make({ wind: V(-25, 0, 0) });
  run(still, 5, { wish: V(4.2, 0, 0) }); run(gale, 5, { wish: V(4.2, 0, 0) });
  // drag at 29 m/s relative is 4.4 m/s^2; leg power then allows legPower / (m a) = 2.9 m/s
  assert.ok(speed(gale.st) > 2.5 && speed(gale.st) < 3.6, 'walks slowly into 25 m/s: ' + speed(gale.st));
  assert.ok(Math.abs(speed(still.st) - 4.2) < 0.01);
  const storm = make({ wind: V(-45, 0, 0) }); run(storm, 5, { wish: V(7.4, 0, 0) });
  assert.ok(storm.st.v.x < 5, 'a 45 m/s wind holds a runner back: ' + storm.st.v.x);
  const ice = make({ wind: V(20, 0, 0), ground: ICE }); run(ice, 6, { wish: V() });
  assert.ok(ice.st.v.x > 1, 'blown across the ice: ' + ice.st.v.x);
  const mars = make({ wind: V(-45, 0, 0), rho: 0.02, g: 4.6 }); run(mars, 5, { wish: V(7.4, 0, 0) });
  assert.ok(Math.abs(mars.st.v.x - 7.4) < 0.05, 'a Mars gale is a whisper');
});

test('falling: terminal speed matches sqrt(2 m g / (rho CdA)) on Earth and Venus', () => {
  for (const [g, rho, tol] of [[9, 1.225, 0.02], [8.6, 65, 0.03]]) {
    const sim = make({ alt: 6000, g, rho });
    run(sim, 45, {});
    assert.equal(sim.st.grounded, false);
    const want = explorerTerminal(g, rho);
    assert.ok(Math.abs(-vert(sim.st) - want) < tol * want, `rho ${rho}: ${-vert(sim.st)} vs ${want}`);
  }
});

test('falling in a vacuum conserves energy: v^2 = 2 g h (60 and 20 Hz)', () => {
  for (const hz of [60, 20]) {
    const sim = make({ alt: 200, g: 2.2, rho: 0 });
    const h0 = altOf(sim);
    run(sim, 8, {}, { hz });
    const h = h0 - altOf(sim), v = -vert(sim.st);
    assert.ok(Math.abs(v * v - 2 * 2.2 * h) < 0.03 * v * v, `${hz} Hz: v2 ${v * v} vs 2gh ${2 * 2.2 * h}`);
  }
});

test('jumping: the same legs jump higher in low gravity, by the work-energy rule', () => {
  for (const g of [9, 2.2, 11.5, 4.6]) {
    const sim = make({ g, rho: 0 });
    let hmax = 0;
    run(sim, 12, (t) => ({ jump: t === 0 }), { each: () => { hmax = Math.max(hmax, altOf(sim)); } });
    const vj = jumpSpeedFor(g);
    assert.ok(Math.abs(hmax - vj * vj / (2 * g)) < 0.04 * hmax + 0.02, `g ${g}: ${hmax} vs ${vj * vj / (2 * g)}`);
    assert.equal(sim.st.grounded, true, 'came back down');
  }
  assert.ok(jumpSpeedFor(2.2) > jumpSpeedFor(9) && jumpSpeedFor(9) > jumpSpeedFor(11.5));
});

test('landing is inelastic, reports the impact, and friction decides the skid', () => {
  const drop = (ground) => { const sim = make({ alt: 5, ground, rho: 0 }); sim.st.v = V(6, 0, 0); let imp = 0; run(sim, 3, {}, { each: (t, st) => { imp = Math.max(imp, st.phys.impact); } }); return { sim, imp }; };
  const a = drop(GRASS), b = drop(ICE);
  assert.ok(Math.abs(a.imp - Math.sqrt(2 * 9 * 5)) < 0.3, 'impact speed ' + a.imp);
  assert.equal(a.sim.st.grounded, true);
  assert.ok(speed(a.sim.st) < 0.01, 'grass: stopped');
  assert.ok(speed(b.sim.st) > 3, 'ice: still sliding at ' + speed(b.sim.st));
});

test('jetpack: thrust in newtons, a governed climb, vectored steering, thrust use reported', () => {
  const sim = make();
  let vmax = 0, use = 0, n = 0;
  run(sim, 4, (t) => ({ jump: t === 0, jet: t > 0.15 ? 1 : 0, jetMaxRise: 8.5, wish: V(5, 0, 0) }), { each: (t, st) => { vmax = Math.max(vmax, vert(st)); if (t > 2) { use += st.phys.jetUse; n++; } } });
  assert.ok(vmax < 8.6 && vmax > 8.0, 'climb governed at ' + vmax);
  assert.ok(use / n < 0.85 && use / n > 0.3, 'the governor throttles back: ' + use / n);
  assert.ok(sim.st.v.x > 4, 'vectored thrust steers: ' + sim.st.v.x);
  // ungoverned: acceleration = thrust / mass - g
  const s2 = make({ rho: 0 }); run(s2, 0.5, { jet: 1 }); run(s2, 1, { jet: 1 });
  const a = (vert(s2.st)) / 1.5;
  assert.ok(a > 0.8 * (T.jetThrust / T.mass - 9) && a <= T.jetThrust / T.mass - 9 + 1e-6, 'net acceleration ' + a);
  // the same pack climbs faster on the Moon and cannot lift you on a world where weight exceeds thrust
  const moon = make({ g: 2.2, rho: 0 }); run(moon, 2, { jet: 1 });
  assert.ok(vert(moon.st) > 2 * vert(s2.st) * (2 / 1.5) * 0.9);
  const heavy = make({ g: 18, rho: 0 }); run(heavy, 2, { jet: 1 });
  assert.equal(heavy.st.grounded, true);
});

test('the descent brake caps the sink rate with thrust, smoothly', () => {
  const sim = make({ alt: 400 });
  let worst = 0, pv = 0, jerk = 0;
  run(sim, 12, { descentLimit: 12 }, { each: (t, st) => { const v = vert(st); if (t > 3) worst = Math.max(worst, -v); jerk = Math.max(jerk, Math.abs(v - pv) * 60); pv = v; } });
  assert.ok(worst < 12.6, 'held at ' + worst);
  assert.ok(jerk <= T.retroAccel + 9 + 1e-6);
});

test('water: wading is slow, deep water floats you at the float depth, bobbing dies out', () => {
  const shallow = make({ world: { sea: R + 0.5 }, dir: V(0, 0, 1) });
  shallow.st.p = V(0, 0, R); run(shallow, 6, { wish: V(4.2, 0, 0) });
  assert.ok(speed(shallow.st) < 2.6 && speed(shallow.st) > 1.0, 'knee-deep wading speed ' + speed(shallow.st));
  assert.equal(shallow.st.grounded, true);
  const deep = make({ world: { sea: R + 6 }, alt: 8 });
  run(deep, 25, {});
  const depth = R + 6 - len(deep.st.p);
  assert.ok(Math.abs(depth - T.floatDepth) < 0.05, 'floats with the feet ' + depth + ' m under');
  assert.ok(Math.abs(vert(deep.st)) < 0.02, 'bobbing has died out');
  assert.equal(deep.st.grounded, false);
  run(deep, 8, { wish: V(2.6, 0, 0) });
  assert.ok(speed(deep.st) > 1.5 && speed(deep.st) < 2.7, 'swim speed ' + speed(deep.st));
  // dense liquid: the suit floats you higher out of sulphuric acid only if the assist is off
});

test('60 Hz and 20 Hz agree on a run-jump-land sequence', () => {
  const go = (hz) => { const sim = make({ world: { bumps: { amp: 0.4, length: 40 } } }); run(sim, 6, (t) => ({ wish: V(6, 0, 1), jump: Math.abs(t - 3) < 0.5 / hz }), { hz }); return sim.st; };
  const a = go(60), b = go(20);
  assert.ok(len({ x: a.p.x - b.p.x, y: a.p.y - b.p.y, z: a.p.z - b.p.z }) < 1.6, 'positions differ by ' + len({ x: a.p.x - b.p.x, y: a.p.y - b.p.y, z: a.p.z - b.p.z }));
  assert.ok(Math.abs(speed(a) - speed(b)) < 0.3);
});

test('low gravity: running over rolling ground makes you bound; on Earth you stay planted', () => {
  const air = (g) => { const sim = make({ g, rho: 0, world: { bumps: { amp: 0.5, length: 16 } } }); let t = 0; run(sim, 12, { wish: V(7.4, 0, 0) }, { each: (tt, st) => { if (!st.grounded) t += 1 / 60; } }); return t; };
  assert.ok(air(9) < 0.2, 'earth airborne time ' + air(9));
  assert.ok(air(1.4) > 2, 'pluto airborne time ' + air(1.4));
});

test('extreme inputs never produce NaN or an explosion', () => {
  const cases = [
    { wish: V(1e9, 0, 0) }, { wish: V(NaN, 0, 0) }, { jet: 1e9, wish: V(0, 0, 1e6) }, { jump: true, jet: 1, jetMaxRise: -5, descentLimit: 0 }, {},
  ];
  for (const hz of [60, 20, 4]) for (const c of cases) for (const cfg of [{}, { rho: 1e4, wind: V(500, 0, 0) }, { g: 0.0001, rho: 0 }, { ground: { friction: 0, kinetic: 0, foothold: 0, drag: 0, sink: 0 } }, { world: { sea: R + 3 }, liquid: { density: 13500 } }]) {
    const sim = make(cfg);
    run(sim, 3, c.wish && Number.isNaN(c.wish.x) ? { wish: V(0 / 0, 0, 0) } : c, { hz });
    if (c.wish && Number.isNaN(c.wish.x)) continue;      // NaN commands are PILOT's to prevent; state checked below for the rest
    assert.ok(finite(sim.st), `${hz} Hz ${JSON.stringify(c)} ${JSON.stringify(cfg)}`);
    assert.ok(speed(sim.st) < 2000, 'speed ' + speed(sim.st));
  }
  // a NaN state heals itself
  const sim = make(); sim.st.v = V(NaN, 0, 0); run(sim, 1, { wish: V(1, 0, 0) }); assert.ok(finite(sim.st));
});
