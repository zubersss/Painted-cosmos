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
  assert.ok(pace(9.81) < 4.5 && pace(1.62) < pace(9.81), `Earth ${pace(9.81).toFixed(2)}, Moon ${pace(1.62).toFixed(2)}`);
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
