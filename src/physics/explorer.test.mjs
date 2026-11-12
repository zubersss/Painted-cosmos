// Tests: the explorer as a body with mass. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepExplorerBody, EXPLORER_BODY as T, explorerTerminal, jumpSpeedFor, sustainableSpeed, gaitOf } from './explorer.js';
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

test('other liquids: lava is honey (slow, never stuck), the cloud froth of the giants barely drags', () => {
  const LAVA = { density: 2600, viscosity: 100 }, FROTH = { density: 120, viscosity: 1e-4 }, WATER = { density: 999, viscosity: 1.14e-3 };
  const wade = (liquid) => { const s = make({ world: { sea: R + 0.5 }, dir: V(0, 0, 1), liquid }); s.st.p = V(0, 0, R); run(s, 6, { wish: V(4.2, 0, 0) }); return speed(s.st); };
  const swim = (liquid) => { const s = make({ world: { sea: R + 6 }, alt: 8, liquid }); run(s, 25, {}); const depth = R + 6 - len(s.st.p); run(s, 8, { wish: V(2.6, 0, 0) }); return { v: speed(s.st), depth, st: s.st }; };
  const wl = wade(LAVA), ww = wade(WATER), wf = wade(FROTH);
  assert.ok(wl > 0.25 && wl < 1.2 && wl < ww * 0.6, `wading knee-deep in lava: ${wl} m/s (water ${ww})`);
  assert.ok(wf > ww * 1.25 && wf < 4.3, `in cloud froth: ${wf} m/s`);
  const sl = swim(LAVA), sw = swim(WATER), sf = swim(FROTH);
  assert.ok(sl.v > 0.1 && sl.v < 0.8, `swimming in lava: ${sl.v} m/s`);
  assert.ok(sf.v >= sw.v, `swimming in froth ${sf.v} vs water ${sw.v}`);
  for (const x of [sl, sf]) assert.ok(Math.abs(x.depth - T.floatDepth) < 0.08 && finite(x.st), 'the suit trims to the float depth in any liquid: ' + x.depth);
  // the liquid at a place wins over the world's usual one
  const s = make({ world: { sea: R + 0.5 }, dir: V(0, 0, 1), liquid: WATER }); s.env.liquidOf = () => LAVA; s.st.p = V(0, 0, R); run(s, 6, { wish: V(4.2, 0, 0) });
  assert.ok(Math.abs(speed(s.st) - wl) < 1e-9);
  // and you can always get out: the jetpack lifts you clear of lava
  const j = make({ world: { sea: R + 6 }, alt: 8, liquid: LAVA }); run(j, 20, {}); run(j, 2.5, { jet: 1 });
  assert.ok(len(j.st.p) > R + 6 + 1, 'out of the lava on the pack: ' + (len(j.st.p) - R - 6));
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

test('a wind never makes downwind the slow way: on level ground the speed made good downwind is at least the speed upwind (review 5, P6)', () => {
  // (the lead measured 0.6 m/s downwind against 3.5 upwind on Neptune's storm coast: there is a 4.5 m
  // cliff 14 m downwind of that stand; with the wind switched off the same heading makes the same)
  const ROCK = { material: 'rock', friction: 0.85, kinetic: 0.65, foothold: 0.4, restitution: 0.2, sink: 0, drag: 0.01, dust: 0 };
  const WET = { ...ROCK, friction: 0.47, kinetic: 0.36 };
  const made = (wind, sign, ground, assist, wish) => {
    const s = make({ wind: V(wind, 0, 0), ground, g: 10.2, rho: 0.99 });
    run(s, 3, { wish: V(sign * wish, 0, 0), assistAccel: assist }); const x0 = s.st.p.x;
    run(s, 6, { wish: V(sign * wish, 0, 0), assistAccel: assist });
    return sign * (s.st.p.x - x0) / 6;
  };
  for (const ground of [ROCK, WET, GRASS, SAND, ICE]) for (const assist of [0, 4]) for (const wind of [5, 15, 25, 33, 45, 60]) for (const wish of [4.2, 7.4]) {
    const down = made(wind, 1, ground, assist, wish), up = made(wind, -1, ground, assist, wish);
    assert.ok(down >= up - 0.01, `${ground.material} assist ${assist} wind ${wind} wish ${wish}: downwind ${down.toFixed(2)} upwind ${up.toFixed(2)}`);
    if (wind <= 15 && wish < 5 && ground !== ICE && ground !== SAND) assert.ok(Math.abs(down - wish) < 0.05 && up > wish - 0.3, `a fresh wind does not slow a walker: ${ground.material} ${wind} ${down} ${up}`);
  }
});

test('cmd.shelter01 is the share of the wind force the suit cancels: none by default, all of it at 1 (PILOT\'s lever, P8)', () => {
  const lean = (shelter01) => { const s = make({ wind: V(30, 0, 0) }); run(s, 2, { wish: V(), shelter01 }); return s.st.phys.windAccel; };
  const full = lean(undefined), zero = lean(0), half = lean(0.5), none = lean(1);
  assert.equal(full, zero); assert.ok(full > 3, 'a 30 m/s wind pushes: ' + full);
  assert.ok(Math.abs(half / full - 0.5) < 0.01, 'half the force: ' + half / full);
  assert.equal(none, 0);
  const ice = (shelter01) => { const s = make({ wind: V(25, 0, 0), ground: ICE }); run(s, 6, { wish: V(), shelter01 }); return s.st.v.x; };
  assert.ok(ice(0) > 1 && ice(1) === 0, 'blown across the ice without it, standing with it: ' + [ice(0), ice(1)]);
  const still = make(); run(still, 5, { wish: V(4.2, 0, 0), shelter01: 1 }); assert.ok(Math.abs(speed(still.st) - 4.2) < 0.01, 'still air: nothing changes');
});

// ---- P9: legs ---------------------------------------------------------------------------------------
// Ground with low boulders on it, near the pole (0,0,1) of a sphere of radius R, x and y in metres.
// `pilot`: PILOT's own profile (src/player/explorer.js scrambleSample): the radius raised by a smoothstep
// dome that begins `skirt` outside the boulder's edge, the normal left that of the ground underneath.
// Otherwise a cosine dome over the same footprint with its own normals (flanks to 64 degrees).
function boulders(rocks, { pilot = true, skirt = 0.7, step = null } = {}) {
  const h = (x, y) => {
    let top = step ? step(x) : 0;
    for (const o of rocks) {
      const d = Math.hypot(x - o.x, y - o.y), reach = o.radius + (o.skirt == null ? skirt : o.skirt);
      if (d >= reach) continue;
      const q = 1 - d / reach, v = pilot ? o.height * q * q * (3 - 2 * q) : o.height * 0.5 * (1 - Math.cos(Math.PI * q));
      if (v > top) top = v;
    }
    return top;
  };
  const sample = (d) => {
    const l = Math.hypot(d.x, d.y, d.z), x = d.x / l * R, y = d.y / l * R, e = 0.02;
    const gx = pilot ? 0 : (h(x + e, y) - h(x - e, y)) / (2 * e), gy = pilot ? 0 : (h(x, y + e) - h(x, y - e)) / (2 * e), nl = Math.hypot(gx, gy, 1);
    return { radius: R + h(x, y), liquidRadius: 0, normal: { x: d.x / l - gx / nl, y: d.y / l - gy / nl, z: d.z / l / nl }, biomeId: 'test' };
  };
  return sample;
}
function cross(sample, g, v, { hz = 60, secs = 40, until = 1e9, jumpAt = -1, air = 1.225 } = {}) {
  const st = { p: V(0, 0, sample(V(0, 0, 1)).radius), v: V(), grounded: true };
  const env = { sample, gravity: g, air: (p, o) => { o.density = air; o.wind.x = o.wind.y = o.wind.z = 0; return o; } };
  const out = { top: 0, airTime: 0, slowest: Infinity, still: 0, t: 0, st };
  for (let i = 0; i < secs * hz && st.p.x < until; i++) {
    const t = i / hz;
    stepExplorerBody(st, { wish: V(v, 0, 0), jump: jumpAt >= 0 && Math.abs(t - jumpAt) < 0.5 / hz, assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
    out.top = Math.max(out.top, len(st.p) - sample(st.p).radius);
    if (!st.grounded) out.airTime += 1 / hz;
    if (t > 1.5) { const sp = Math.hypot(st.v.x, st.v.y); out.slowest = Math.min(out.slowest, sp); if (sp < 0.3) out.still += 1 / hz; }
    out.t = t;
  }
  return out;
}
const FIELD = (() => { let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const a = [{ x: 6, y: 0, radius: 0.6, height: 1.3 }, { x: 70, y: 0, radius: 0.3, height: 1.3 }];
  for (let i = 0; i < 24; i++) a.push({ x: 10 + i * 2.4 + rnd() * 1.5, y: (rnd() - 0.5) * 2.4, radius: 0.3 + rnd(), height: 0.3 + rnd() }); return a; })();

test('legs: a walk and a run across a field of low boulders never lift the feet 0.3 m off the ground, and never stall (Earth, Mars, Moon; 60 and 20 Hz)', () => {
  for (const pilot of [true, false]) for (const [name, g, air] of [['Earth', 9.81, 1.225], ['Mars', 3.71, 0.02], ['Moon', 1.62, 0]]) for (const v of [4.2, 7.4]) for (const hz of [60, 20]) {
    const o = cross(boulders(FIELD, { pilot }), g, v, { hz, until: 75, air }), tag = `${pilot ? "PILOT's profile" : 'steep normals'} ${name} ${v} m/s ${hz} Hz`;
    assert.ok(o.top <= 0.3, `${tag}: feet ${o.top.toFixed(2)} m off the ground`);
    assert.ok(o.st.p.x >= 75, `${tag}: did not get across, x ${o.st.p.x.toFixed(1)} after ${o.t.toFixed(0)} s`);
    assert.ok(o.still < 0.5 && 75 / o.t > 1.2, `${tag}: stalled (${o.still.toFixed(2)} s under 0.3 m/s, mean ${(75 / o.t).toFixed(2)} m/s)`);
  }
});

test('legs: the 1.3 m boulder that flew the body in P8 (57 degree flanks) is clambered: no air at all, at a clambering pace', () => {
  const rock = [{ x: 12, y: 0, radius: 1.3, height: 1.3, skirt: 0 }];
  for (const g of [9, 3.7, 1.62]) for (const v of [4.2, 7.4]) {
    const o = cross(boulders(rock, { pilot: false }), g, v, { until: 20, air: 0 });
    assert.ok(o.top < 0.05 && o.airTime === 0, `g ${g} v ${v}: ${o.top.toFixed(2)} m, ${o.airTime.toFixed(2)} s in the air`);
    assert.ok(o.slowest > 0.5 && o.slowest < 3 && o.st.p.x >= 20, `g ${g} v ${v}: slowest ${o.slowest.toFixed(2)} m/s`);
  }
});

test('legs: a feature lower than their stroke is taken in stride, and one the hips must climb costs pace: more in low gravity', () => {
  const low = cross(boulders([{ x: 12, y: 0, radius: 0.4, height: 0.4 }]), 9.81, 7.4, { until: 20 });
  assert.ok(low.slowest > 7.2 && low.airTime === 0, 'a 0.4 m rock at a run: slowest ' + low.slowest.toFixed(2));
  const pace = (g) => cross(boulders([{ x: 12, y: 0, radius: 0.6, height: 1.3 }]), g, 7.4, { until: 20, air: 0 }).slowest;
  // (P16: the pace over a face the hips must climb is the pace it can be crossed at in contact, planned from where the
  // walker sees it; measured, that pace is the same on every world within 10 % (the hold's pull, not gravity, sets it),
  // so the old 'lower on the Moon than on Earth' (the face checked a lunar run harder) is now 'no faster on the Moon')
  assert.ok(pace(9.81) < 4.5 && pace(1.62) < 4.5 && pace(1.62) < pace(9.81) * 1.1, `Earth ${pace(9.81).toFixed(2)}, Moon ${pace(1.62).toFixed(2)}`);
});

test('legs: what is not a low feature is as it was: a cliff is a fall, a wall stops the body, a jump is a jump, and a step up to a clamber high is climbed', () => {
  const cliff = cross(boulders([], { step: (x) => (x > 12 ? -3 : 0) }), 9.81, 4.2, { until: 20 });
  assert.ok(cliff.top > 2.5 && cliff.airTime > 0.6, 'a 3 m cliff: ' + cliff.top.toFixed(2) + ' m, ' + cliff.airTime.toFixed(2) + ' s');
  const wall = cross(boulders([], { step: (x) => (x > 12 ? 2.5 : 0) }), 9.81, 4.2, { secs: 8 });
  assert.ok(wall.st.p.x < 12.01 && wall.st.grounded, 'a 2.5 m wall: x ' + wall.st.p.x.toFixed(2));
  const up = cross(boulders([], { step: (x) => (x > 12 ? 1.3 : 0) }), 1.62, 4.2, { until: 20, air: 0 });
  assert.ok(up.st.p.x >= 20 && up.top < 0.3, 'a 1.3 m step on the Moon: x ' + up.st.p.x.toFixed(1));
  const rock = [{ x: 12, y: 0, radius: 0.6, height: 1.3 }];
  const hop = cross(boulders(rock), 9.81, 4.2, { until: 20, jumpAt: 3.4 });
  assert.ok(hop.top > 0.9, 'a jump from the boulder: ' + hop.top.toFixed(2) + ' m');
  // standing on it: at rest, exactly
  const st = { p: V(0, 0, 0), v: V(), grounded: true }, sample = boulders(rock), d = norm(V(11.6 / R, 0, 1)), env = { sample, gravity: 1.62 };
  const r0 = sample(d).radius; st.p = V(d.x * r0, d.y * r0, d.z * r0);
  for (let i = 0; i < 240; i++) stepExplorerBody(st, {}, 1 / 60, env);
  assert.ok(st.grounded && len(st.v) === 0 && Math.abs(len(st.p) - r0) < 1e-6, 'standing on the flank on the Moon');
});

test('P12 legs: stepping off the far side of a 0.72 m boulder gives no upward kick (Moon, Mars, Earth; a walk and a run)', () => {
  // The ground rises 0.72 m over a metre (PILOT's smoothstep skirt) and its far side falls away in one frame.
  // Before: the hips, heaved up the face at up to 2 m/s, were still rising at 1.1 m/s when the step down had been
  // taken, and the body left the far ground at +0.9 to +1.5 m/s: 0.25 to 0.30 m of rise and 1.1 to 1.25 s in the
  // air on the Moon (PILOT's trace of the game: +1.06 m/s, 0.29 m, 1.4 s).
  const h = (x) => x < 8 ? 0 : x < 9 ? 0.72 * (x - 8) * (x - 8) * (3 - 2 * (x - 8)) : 0;
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z); return { radius: R + h(d.x / l * R), liquidRadius: 0, normal: { x: d.x / l, y: d.y / l, z: d.z / l }, biomeId: 'test' }; };
  for (const [name, g] of [['Moon', 1.62], ['Mars', 3.71], ['Earth', 9.81]]) for (const v of [4.2, 7.4]) {
    const st = { p: V(0, 0, R), v: V(), grounded: true }, env = { sample, gravity: g, air: (p, o) => { o.density = 0; o.wind.x = o.wind.y = o.wind.z = 0; return o; } };
    let kick = 0, rise = 0, rel = 0, was = true, air = 0;
    for (let i = 0; i < 60 * 12 && st.p.x < 14; i++) {
      stepExplorerBody(st, { wish: V(v, 0, 0), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / 60, env);
      const r = len(st.p), vu = dot(st.v, st.p) / r;
      if (!st.grounded) { if (was) { kick = Math.max(kick, vu); rel = r; } rise = Math.max(rise, r - rel); air += 1 / 60; }
      was = st.grounded;
    }
    assert.ok(st.p.x >= 14, `${name} ${v} m/s: got over it`);
    assert.ok(kick <= 0.4 && rise <= 0.05, `${name} ${v} m/s: leaves the ground at +${kick.toFixed(2)} m/s and rises ${rise.toFixed(2)} m`);
    assert.ok(air < 0.5, `${name} ${v} m/s: ${air.toFixed(2)} s in the air`);
  }
});

// ---- (P13) the gait ----------------------------------------------------------------------------------
// a steady pace on level grass: the stride's numbers over the last `secs` seconds
function stride(g, pace, secs = 6) {
  const sim = make({ g }); let lo = 1e9, hi = -1e9, fl = 0, n = 0, s0 = 0, air = 0, lowPh = 0, hiPh = 0, vAtHi = 0, vAtLo = 0;
  const falls = [];
  run(sim, 6 + secs, { wish: V(pace, 0, 0), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, { each: (t, st) => {
    const B = st.phys; if (!st.grounded) air++;
    if (t <= 6) { s0 = B.steps; return; }
    if (B.bob < lo) { lo = B.bob; lowPh = B.stepPhase; vAtLo = B.pulse; } if (B.bob > hi) { hi = B.bob; hiPh = B.stepPhase; vAtHi = B.pulse; }
    fl += B.flight; n++;
    if (B.footfall && (!falls.length || falls[falls.length - 1].n !== B.footfall.n)) falls.push({ n: B.footfall.n, foot: B.footfall.foot, p: { ...B.footfall.p }, force: B.footfall.force });
  } });
  const B = sim.st.phys;
  return { sim, B, lo, hi, bob: hi - lo, flight: fl / n, counted: (B.steps - s0) / secs, air, lowPh, hiPh, vAtLo, vAtHi, falls };
}

test('P13 gait: a stroll is a walk, PILOT\'s walk and run are runs; the hips rise and fall a few centimetres with every step', () => {
  const a = stride(9, 1.5), b = stride(9, 4.2), c = stride(9, 7.4);
  assert.equal(a.B.gait, 1); assert.equal(b.B.gait, 2); assert.equal(c.B.gait, 2);
  // a walk: both feet down for part of every step, never neither; 4 to 7 cm of rise (people: 3 to 5 cm at this pace)
  assert.equal(a.flight, 0); assert.ok(a.B.duty > 0.5);
  assert.ok(a.bob > 0.035 && a.bob < 0.07, `walk bob ${a.bob}`);
  assert.ok(a.hi > -0.005 && a.hi <= 1e-9, 'a walker is at standing height over the stance foot, never above it');
  // a run: a flight in every step; 5 to 9 cm between mid-stance and the top of the flight (runners: 6 to 10 cm)
  for (const r of [b, c]) { assert.ok(r.flight > 0.25 && r.flight < 0.7, `flight ${r.flight}`); assert.ok(r.B.duty < 0.5); assert.ok(r.bob > 0.05 && r.bob < 0.09, `run bob ${r.bob}`); assert.ok(r.hi < 0, 'a runner rides below standing height'); }
  // cadence: 1.8 to 2.2 steps a second strolling, 2.7 to 3.2 at 4.2 m/s, 3.3 to 3.9 at 7.4 m/s; and it is the cadence the footfalls come at
  for (const [r, lo, hi] of [[a, 1.8, 2.2], [b, 2.7, 3.2], [c, 3.3, 3.9]]) {
    assert.ok(r.B.cadence > lo && r.B.cadence < hi, `cadence ${r.B.cadence}`);
    assert.ok(Math.abs(r.counted - r.B.cadence) < 0.25, `counted ${r.counted} against ${r.B.cadence}`);
    assert.ok(Math.abs(r.B.cadence * r.B.stepLength - r.B.speedGround) < 1e-6, 'cadence x step length is the pace');
    assert.equal(r.air, 0, 'st.grounded stays true through the stride (the flights of a run are the gait\'s own)');
  }
});

test('P13 gait: a walk is lowest with both feet down and slowest at the top; a run is lowest in mid-stance, highest in flight, and falls as a free body between', () => {
  const a = stride(9, 1.5), b = stride(9, 4.2);
  const ds = 2 * a.B.duty - 1;
  assert.ok(a.lowPh < ds + 0.02, `walk lowest at step phase ${a.lowPh}, double support until ${ds}`);
  assert.ok(a.vAtHi < 0 && a.vAtLo > 0, 'the walk is slowest over the foot and fastest at double support (the pendulum)');
  const o = gaitOf(4.2, 9), fc = o.contact / o.period;
  assert.ok(Math.abs(b.lowPh - 0.5 * fc) < 0.06, `run lowest at ${b.lowPh}, mid-stance ${0.5 * fc}`);
  assert.ok(Math.abs(b.hiPh - 0.5 * (1 + fc)) < 0.06, `run highest at ${b.hiPh}, mid-flight ${0.5 * (1 + fc)}`);
  assert.ok(Math.abs(o.rise - 9 * o.flight * o.flight / 8) < 1e-9, 'the flight is ballistic under the planet\'s gravity');
  // the stance's force carries the weight over the whole step: its impulse (half a sine: 2/pi x peak x contact) = g x period
  assert.ok(Math.abs(2 / Math.PI * o.peak * 9 * o.contact - 9 * o.period) < 1e-9);
  assert.ok(o.peak > 2 && o.peak < 3, `peak force ${o.peak} body weights at 4.2 m/s (runners: 2 to 3)`);
});

test('P13 gait: on the Moon the same run is a lope (longer steps, fewer of them, most of the time in flight); in heavy gravity short quick steps', () => {
  const e = stride(9, 7.4), m = stride(2.2, 7.4), h = gaitOf(7.4, 24.8), ge = gaitOf(7.4, 9), gm = gaitOf(7.4, 2.2);
  assert.ok(m.B.stepLength > 1.5 * e.B.stepLength, `steps ${e.B.stepLength} m on Earth, ${m.B.stepLength} m on the Moon`);
  assert.ok(m.B.cadence < 0.7 * e.B.cadence);
  assert.ok(gm.flight > 2 * ge.flight && m.flight > 0.65, `flight ${ge.flight} s on Earth, ${gm.flight} s on the Moon (${m.flight} of the time)`);
  assert.ok(Math.abs(gm.contact - ge.contact) < 1e-9, 'the foot is down as long: the leg sweeps the same angle at the same pace');
  assert.ok(h.step < 0.75 * ge.step && h.cadence > 1.35 * ge.cadence && h.flight < 0.5 * ge.flight, 'heavy gravity: short, quick, hardly off the ground');
  // dynamic similarity: the same Froude number, the same gait and the same step in leg lengths
  const a = gaitOf(Math.sqrt(2 * 9 * T.legLength), 9), b = gaitOf(Math.sqrt(2 * 2.2 * T.legLength), 2.2);
  assert.ok(Math.abs(a.step - b.step) < 1e-9 && a.gait === b.gait && Math.abs(a.duty - b.duty) < 1e-9);
  // the walk becomes a run at Froude 0.5: 2.0 m/s on Earth, 1.0 m/s on the Moon
  assert.equal(gaitOf(1.9, 9).gait, 1); assert.equal(gaitOf(2.2, 9).gait, 2); assert.equal(gaitOf(0.9, 2.2).gait, 1); assert.equal(gaitOf(1.1, 2.2).gait, 2);
});

test('P13 gait: footfalls alternate, a step length apart, each to its own side, on the ground, with the stance\'s force; a landing is one of both feet', () => {
  for (const [g, pace] of [[9, 1.5], [9, 7.4], [2.2, 4.2]]) {
    const r = stride(g, pace), f = r.falls;
    assert.ok(f.length >= 6, `${f.length} footfalls`);
    for (let i = 1; i < f.length; i++) {
      assert.equal(f[i].n, f[i - 1].n + 1, 'none missed'); assert.equal(f[i].foot, 1 - f[i - 1].foot, 'left, right, left');
      const d = len({ x: f[i].p.x - f[i - 1].p.x, y: f[i].p.y - f[i - 1].p.y, z: f[i].p.z - f[i - 1].p.z }), want = Math.hypot(r.B.stepLength, T.stepWidth);
      assert.ok(Math.abs(d - want) < 0.03 + pace / 60, `${d} m between footfalls, step ${want}`);
      assert.ok(Math.abs(len(f[i].p) - R) < 1e-6, 'on the ground');
    }
    const o = gaitOf(pace, g);
    assert.ok(Math.abs(f[f.length - 1].force - T.mass * g * o.peak) < 1, `force ${f[f.length - 1].force} N`);
  }
  const sim = make({ alt: 2 }); let fall = null;
  run(sim, 2, { wish: V() }, { each: (t, st) => { if (st.phys.footfall && !fall) fall = { ...st.phys.footfall }; } });
  assert.ok(fall && fall.foot === 2 && fall.speed > 5 && fall.force > T.mass * 9, 'a 2 m drop lands on both feet');
});

test('P13 gait: it does not touch the body: the path and the pace are the stride\'s mean, the same to the last digit with or without it', () => {
  // (the gait reads st.p and st.v and writes only its own numbers; two runs with different stride phases must agree exactly)
  const a = make({ world: { bumps: { amp: 0.3, length: 9 } } }), b = make({ world: { bumps: { amp: 0.3, length: 9 } } });
  stepExplorerBody(b.st, { wish: V() }, 1 / 60, b.env); b.st.phys.stride = 0.77;
  stepExplorerBody(a.st, { wish: V() }, 1 / 60, a.env);
  const cmd = (t) => ({ wish: t < 3 ? V(7.4, 0, 0) : t < 5 ? V(0, 4.2, 0) : V(), assistAccel: 4 });
  run(a, 7, cmd); run(b, 7, cmd);
  assert.deepEqual(a.st.p, b.st.p); assert.deepEqual(a.st.v, b.st.v);
  assert.equal(a.st.phys.gait, 0); assert.ok(Math.abs(a.st.phys.bob) < 1e-9 && Math.abs(a.st.phys.ride) < 1e-3, 'standing again, the hips are at standing height');
  assert.equal(a.st.phys.footDown, 3);
});

test('P13 jump: the legs fold before they push: the feet leave the ground jumpCrouch after the command, the hips dropping no faster than gravity; cmd.jumpCrouch 0 is the old jump', () => {
  for (const g of [9, 2.2]) {
    const sim = make({ g }); let tOff = -1, low = 0, c1 = 0;
    run(sim, 0.5, { wish: V() });
    run(sim, 0.6, (t) => ({ wish: V(), jump: t === 0 }), { each: (t, st) => { if (st.grounded && tOff < 0) { low = Math.min(low, st.phys.hip); c1 = Math.max(c1, st.phys.crouch01); } else if (tOff < 0) tOff = t; } });
    assert.ok(Math.abs(tOff - T.jumpCrouch) < 1.01 / 60, `g ${g}: off the ground after ${tOff} s`);
    assert.ok(low < 0 && -low <= 0.5 * g * T.jumpCrouch * T.jumpCrouch + 1e-9, `g ${g}: the hips fell ${-low} m, free fall gives ${0.5 * g * T.jumpCrouch * T.jumpCrouch}`);
    assert.ok(c1 > 0.7, 'crouch01 runs up to the push');
    const s2 = make({ g }); run(s2, 0.5, { wish: V() });
    stepExplorerBody(s2.st, { wish: V(), jump: true, jumpCrouch: 0 }, 1 / 60, s2.env);
    assert.equal(s2.st.grounded, false); assert.ok(Math.abs(vert(s2.st) - (jumpSpeedFor(g) - g / 60)) < 0.02, 'the same take-off speed at once');
    // and the same height either way
    let top = 0; run(sim, 6, { wish: V() }, { each: () => { top = Math.max(top, altOf(sim)); } });
    let top2 = 0; run(s2, 6, { wish: V() }, { each: () => { top2 = Math.max(top2, altOf(s2)); } });
    assert.ok(Math.abs(top - top2) < 0.01 && top > 1, `the same height either way: ${top} m and ${top2} m`);
  }
});

test('P13 legs: a run into the face of a 1 m boulder is taken up by the legs (legCatch at most), not stopped in one step; still in contact (Moon, Mars, Earth)', async () => {
  const { scrambleSample } = await import('../player/explorer.js');
  for (const [g, pace] of [[2.2, 7.4], [2.2, 4.2], [4.6, 7.4], [9, 7.4]]) {
    const c = norm(V(Math.sin(12 / R), 0, Math.cos(12 / R)));
    const sample = scrambleSample((d) => ({ radius: R, normal: d, liquidRadius: 0 }), () => [{ unitDir: c, radius: 0.6, height: 1 }]);
    const st = { p: V(0, 0, R), v: V(), grounded: true }, env = { sample, gravity: g };
    let worst = 0, vPrev = 0, air = 0, slow = 99, far = 0, surge = 0;
    for (let i = 0; i < 60 * 9; i++) {
      stepExplorerBody(st, { wish: V(pace, 0, 0), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / 60, env);
      const v = st.phys.speedGround, x = Math.atan2(st.p.x, st.p.z) * R; far = x;
      if (x > 9 && x < 15) { worst = Math.max(worst, vPrev - v); if (!st.grounded) air++; slow = Math.min(slow, v); surge = Math.max(surge, Math.abs(st.phys.surge)); }
      vPrev = v;
    }
    assert.ok(worst <= T.legCatch / 60 + 0.36, `g ${g} pace ${pace}: ${worst} m/s lost in one step`);       // (+ braceAccel / 60 from a hold)
    assert.equal(air, 0, `g ${g} pace ${pace}: in contact`); assert.ok(slow > 1.5 && slow < pace - 1, `slowest ${slow}`);
    assert.ok(surge < 0.45, `the body is never further over its feet than half a stance: ${surge} m`); assert.ok(far > 20, 'and it goes on');
  }
});

test('P13 the descent brake lights before its limit and settles the fall onto it: no step in the acceleration, the limit never passed by more than before', () => {
  const sim = make({ alt: 60 }); let worstJerk = 0, aPrev = -9, vMax = 0, vPrev = 0;
  run(sim, 4, { wish: V(), descentLimit: 12 }, { each: (t, st) => { const v = vert(st), a = (v - vPrev) * 60; if (t > 0.05) worstJerk = Math.max(worstJerk, Math.abs(a - aPrev)); aPrev = a; vPrev = v; vMax = Math.max(vMax, -v); } });
  assert.ok(vMax > 11.5 && vMax < 12.05, `settles at the limit: ${vMax}`);
  assert.ok(worstJerk < 1.2, `largest change of acceleration in one step ${worstJerk} m/s^2 (the brake at full at the limit gave 9)`);
});

test('P16 the way ahead: a run at a 1 m boulder sheds its pace with its soles before the face, within the grip, and crosses with no brace at the face; a hill is not a face (Moon, Mars, Earth)', async () => {
  const { scrambleSample } = await import('../player/explorer.js');
  for (const [g, pace] of [[2.2, 7.4], [3.7, 7.4], [9, 7.4], [2.2, 4.2]]) {
    const c = norm(V(Math.sin(12 / R), 0, Math.cos(12 / R)));
    const sample = scrambleSample((d) => ({ radius: R, normal: d, liquidRadius: 0 }), () => [{ unitDir: c, radius: 0.6, height: 1 }]);
    const st = { p: V(0, 0, R), v: V(), grounded: true }, env = { sample, gravity: g }, assist = 4 * Math.min(1, Math.max(0.45, g / 9));
    let brace = 0, worst = 0, vPrev = 0, air = 0, top = 0, far = 0, seen = Infinity, atFace = 0;
    for (let i = 0; i < 60 * 9; i++) {
      stepExplorerBody(st, { wish: V(pace, 0, 0), assistAccel: assist }, 1 / 60, env);
      const B = st.phys, v = B.speedGround, x = Math.atan2(st.p.x, st.p.z) * R; far = x;
      if (B.ahead && seen === Infinity) seen = 12 - x;
      if (x > 4 && x < 15) { brace = Math.max(brace, B.brace); if (!st.grounded) air++; top = Math.max(top, len(st.p) - sample(norm(st.p)).radius); }
      if (x > 4 && x < 11.4) worst = Math.max(worst, vPrev - v);          // (the approach and the near flank: the soles' work)
      if (x < 11.4) atFace = v;
      vPrev = v;
    }
    // the grip on this ground (testworld-like: no material, the default friction) and the suit's assist bound the slowing
    const grip = 1.0 * g + assist;
    assert.ok(brace < 0.05, `g ${g} pace ${pace}: the face braced ${brace} m/s in a step`);
    assert.ok(worst <= grip / 60 + 0.05, `g ${g} pace ${pace}: ${worst.toFixed(3)} m/s lost in one step of the approach (grip and assist give ${(grip / 60).toFixed(3)})`);
    assert.ok(air === 0 && top < 0.05, `g ${g} pace ${pace}: in contact (${air} steps in the air, feet ${top.toFixed(3)} m up)`);
    assert.ok(atFace < 3.3 && atFace > 2.2 && far > 20, `g ${g} pace ${pace}: ${atFace.toFixed(2)} m/s at the face (the law: 2.75), on to ${far.toFixed(0)} m; seen ${seen.toFixed(1)} m out`);
  }
  // a hill (a 20 % slope from 10 m on, and a 40 % one) is run at the pace the legs' power allows, never read as a face
  for (const k of [0.2, 0.4]) {
    const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), x = Math.atan2(d.x / l, d.z / l) * R; return { radius: R + Math.max(0, x - 10) * k, normal: { x: d.x / l, y: d.y / l, z: d.z / l }, liquidRadius: 0 }; };
    const st = { p: V(0, 0, R), v: V(), grounded: true }, env = { sample, gravity: 9 };
    let ahead = 0; for (let i = 0; i < 60 * 5; i++) { stepExplorerBody(st, { wish: V(7.4, 0, 0), assistAccel: 4 }, 1 / 60, env); if (st.phys.ahead) ahead++; }
    assert.equal(ahead, 0, `a ${k * 100} % hill read as a face in ${ahead} steps`);
  }
});

test('P17 the way ahead, tried: a boulder met off the middle of the path (its flank a lower, narrower hump) is crossed with no brace and no hold checking the run (Moon, Mars, Earth)', async () => {
  // Until P17 the way ahead counted only rises over the legs' stroke as faces: the flank of a 1 m boulder 0.5 m off the
  // line of the run is a 0.67 m hump, and a run at 6 m/s met it braced (two steps of 0.5 m/s) and held back over the top
  // (6 -> 2.9 m/s in a quarter of a second on the Moon). Now it is tried with the body itself and met at its pace.
  const { scrambleSample } = await import('../player/explorer.js');
  for (const g of [2.2, 3.7, 9]) {
    for (const off of [0, 0.3, 0.5, 0.55]) {
      const c = norm(V(Math.sin(12 / R), off / R, Math.cos(12 / R)));
      const sample = scrambleSample((d) => ({ radius: R, normal: { x: d.x, y: d.y, z: d.z }, liquidRadius: 0 }), () => [{ unitDir: c, radius: 0.6, height: 1 }]);
      const st = { p: V(0, 0, R), v: V(), grounded: true }, env = { sample, gravity: g };
      let brace = 0, worst = 0, vPrev = 0, air = 0, top = 0, held = 0, least = 1e9;
      for (let i = 0; i < 60 * 8; i++) {
        const t = Math.atan2(st.p.x, st.p.z);
        stepExplorerBody(st, { wish: V(6 * Math.cos(t), 0, -6 * Math.sin(t)) }, 1 / 60, env);
        const B = st.phys, v = B.speedGround, x = t * R;
        if (x > 4 && x < 16) {
          brace = Math.max(brace, B.brace); if (!st.grounded) air++; top = Math.max(top, len(st.p) - sample(norm(st.p)).radius);
          worst = Math.max(worst, vPrev - v); least = Math.min(least, v);
          if (B.grip && B.paceCap < 1e8 && v > B.paceCap + 0.05) held++;
        }
        vPrev = v;
      }
      assert.ok(brace < 0.05, `g ${g}, ${off} m off: braced ${brace.toFixed(2)} m/s in a step`);
      assert.ok(held === 0, `g ${g}, ${off} m off: a hold checked the run in ${held} steps`);
      assert.ok(worst <= g / 60 + 0.05, `g ${g}, ${off} m off: ${worst.toFixed(3)} m/s lost in one step (the soles give ${(g / 60).toFixed(3)})`);
      assert.ok(air === 0 && top < 0.05, `g ${g}, ${off} m off: in contact (${air} steps in the air, feet ${top.toFixed(3)} m up)`);
      assert.ok(least > 2.2, `g ${g}, ${off} m off: no slower than ${least.toFixed(2)} m/s over it`);
    }
  }
});

test('P17: strideBob is the hips the body lays in a steady stride (for a figure drawn without the body)', async () => {
  const { strideBob, bobAt, gaitOf, stepExplorerBody, EXPLORER_BODY } = await import('./explorer.js');
  const { createPhysics } = await import('./index.js');
  assert.equal(typeof createPhysics({ sampleSurface: () => ({ radius: 1, normal: { x: 0, y: 1, z: 0 } }) }).explorer.bob, 'function');
  for (const [v, g] of [[1.4, 9.81], [4.2, 9.81], [6.5, 9.81], [3, 1.62]]) {
    const R = 4000, env = { sample: (d) => ({ radius: R, normal: d, liquidRadius: 0 }), gravity: g };
    const st = { p: { x: 0, y: 0, z: R }, v: { x: v, y: 0, z: 0 }, grounded: true };
    let worst = 0, span = 0, lo = 1e9, hi = -1e9;
    for (let i = 0; i < 60 * 8; i++) {
      const r = Math.hypot(st.p.x, st.p.y, st.p.z), ux = st.p.x / r, uz = st.p.z / r;
      stepExplorerBody(st, { wish: { x: v * uz, y: 0, z: -v * ux } }, 1 / 60, env);
      const B = st.phys;
      if (i > 60 * 5) {
        const want = strideBob(B.gaitV, g, B.stride);
        worst = Math.max(worst, Math.abs(B.bob - want * B.gaitAmp - B.bobFix)); lo = Math.min(lo, B.bob); hi = Math.max(hi, B.bob);
        // the same as bobAt on gaitOf, which is what it wraps
        const o = gaitOf(Math.max(B.gaitV, 0.12), g, EXPLORER_BODY, {});
        assert.equal(want, bobAt((B.stride * 2) % 1, o, g));
      }
    }
    span = hi - lo;
    assert.ok(worst < 1e-9, `v ${v} g ${g}: the body's bob and strideBob differ by ${worst}`);
    assert.ok(span > 0.01, `v ${v} g ${g}: the hips move ${span.toFixed(3)} m over a stride`);
  }
});


test('P19 the ghost keeps to its own scratch: a run through a row of boulders OFF the x-z plane keeps its velocity in the ground, keeps to its line and reports the ground under its feet (Earth, Moon; 60 and 30 Hz)', async () => {
  // Review 7, finding 1: the ghost (P17's trials, run from inside the walker's step) wrote the walker's own module scratch:
  // its up (which lays the velocity along the ground while clambering) and its ground (material, sink, dust). The ghost
  // runs on the great circle through +z, so in the x-z plane (P17's test) its up was nearly the walker's and nothing showed;
  // anywhere else a run through boulders gained 0.6 to 1.1 m/s of radial speed with its feet on level ground, strayed
  // 0.2 to 2.4 m off its line and reported the far point's material. PILOT's boulders (scrambleSample, as src/core/sim.js
  // builds the explorer's ground): rock on a boulder, sand elsewhere.
  const { scrambleSample } = await import('../player/explorer.js');
  const ROCK = { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 };
  const SANDY = { material: 'sand', friction: 0.6, kinetic: 0.5, foothold: 0.2, restitution: 0.05, sink: 0.05, drag: 0.25, dust: 0.6 };
  const ROW = [[6, 0, 1], [8.6, 0.3, 0.9], [11.4, -0.4, 1.1], [14, 0.5, 1], [16.6, 0, 0.8], [19.4, -0.3, 1.2], [22.2, 0.2, 1], [25, 0, 1]];
  const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  for (const place of [V(0.3, 0.9, 0.3), V(0.8, 0.2, -0.55)]) {
    const u0 = norm(place), h0 = norm(cross(cross(u0, V(0.2, 1, 0.1)), u0)), n0 = cross(u0, h0);
    const at = (s, o) => { const c = Math.cos(s / R), sn = Math.sin(s / R); return norm(V(u0.x * c + h0.x * sn + n0.x * o / R, u0.y * c + h0.y * sn + n0.y * o / R, u0.z * c + h0.z * sn + n0.z * o / R)); };
    const obs = ROW.map(([s, o, h]) => ({ unitDir: at(s, o), radius: 0.6, height: h }));
    const sample = scrambleSample((d) => ({ radius: R, normal: V(d.x, d.y, d.z), liquidRadius: 0 }), () => obs);
    for (const g of [9.81, 1.62]) for (const hz of [60, 30]) {
      const env = { sample, gravity: g, ground: (s, out) => Object.assign(out, s.radius > R + 0.01 ? ROCK : SANDY) };
      const p0 = at(0, 0), st = { p: V(p0.x * R, p0.y * R, p0.z * R), v: V(), grounded: true };
      let radial = 0, off = 0, wrong = 0, air = 0, worst = 0, vPrev = 0, far = 0;
      for (let i = 0; i < hz * 9; i++) {
        const u = norm(st.p), t = Math.atan2(dot(u, h0), dot(u, u0)), c = Math.cos(t), sn = Math.sin(t);
        stepExplorerBody(st, { wish: V(6 * (h0.x * c - u0.x * sn), 6 * (h0.y * c - u0.y * sn), 6 * (h0.z * c - u0.z * sn)) }, 1 / hz, env);
        const B = st.phys, uu = norm(st.p), v = B.speedGround; far = t * R;
        if (far > 2) {
          if (st.grounded) radial = Math.max(radial, Math.abs(dot(st.v, uu))); else air++;
          off = Math.max(off, Math.abs(dot(uu, n0)) * R);
          if (st.grounded && B.material !== (sample(uu).radius > R + 0.01 ? 'rock' : 'sand')) wrong++;
          worst = Math.max(worst, vPrev - v);
        }
        vPrev = v;
      }
      const at_ = `at ${JSON.stringify(place)}, g ${g}, ${hz} Hz`;
      assert.ok(radial < 0.05, `${at_}: ${radial.toFixed(3)} m/s radial with the feet on the ground (level ground: none)`);
      assert.ok(off < 0.05, `${at_}: ${off.toFixed(3)} m off the line it was steered along`);
      assert.equal(wrong, 0, `${at_}: ${wrong} steps report a material that is not the ground under the feet`);
      assert.equal(air, 0, `${at_}: the feet leave the ground in ${air} steps`);
      assert.ok(worst <= T.legCatch / hz + 0.05, `${at_}: ${worst.toFixed(2)} m/s lost in one frame (the legs take a face up at legCatch: ${(T.legCatch / hz).toFixed(2)})`);
      // (on, at least past the fifth boulder: P19 found the run crawling at 0.5 m/s at the sixth on Earth, in the x-z plane
      // as off it, before this fix as after: see the notes, P19, "Not done")
      assert.ok(far > 17, `${at_}: on to ${far.toFixed(0)} m`);
    }
  }
});
