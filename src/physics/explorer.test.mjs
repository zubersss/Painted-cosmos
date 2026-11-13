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

test('low gravity: over rolling ground the legs work through their stroke (P22: they see the crests coming and keep contact); on Earth the hips hardly move', () => {
  // (until P22 the legs levelled the hips over the ground under the feet, at its own rate: over rolls of 1 m and 16 m on
  // Pluto the hips were flung off each crest and the run bounded, more than 2 s in the air in 12; seeing the way, the legs
  // fold before a crest and stretch beyond it, within their stroke, and the run keeps its feet down; the low gravity shows
  // as the legs' deep work, about three times Earth's)
  const go = (g) => { const sim = make({ g, rho: 0, world: { bumps: { amp: 0.5, length: 16 } } }); const o = { air: 0, lo: 0, hi: 0 };
    run(sim, 12, { wish: V(7.4, 0, 0) }, { each: (tt, st) => { if (!st.grounded) o.air += 1 / 60; else if (tt > 2) { o.lo = Math.min(o.lo, st.phys.hip); o.hi = Math.max(o.hi, st.phys.hip); } } }); return o; };
  const e = go(9), p = go(1.4);
  assert.ok(e.air < 0.2, 'earth airborne time ' + e.air);
  assert.ok(p.air < 0.2, 'pluto airborne time ' + p.air);
  assert.ok(p.hi - p.lo > 0.5 && p.hi - p.lo > 2 * (e.hi - e.lo), `the legs' stroke used: Pluto ${(p.hi - p.lo).toFixed(2)} m, Earth ${(e.hi - e.lo).toFixed(2)} m`);
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
    // (P22: the hips raised in time, the face of a 1 m boulder is crossed clean faster than the law's 2.75 m/s: 3.3 to 3.8 m/s)
    assert.ok(atFace < 4.5 && atFace > 2.2 && far > 20, `g ${g} pace ${pace}: ${atFace.toFixed(2)} m/s at the face (the law: 2.75), on to ${far.toFixed(0)} m; seen ${seen.toFixed(1)} m out`);
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
      let radial = 0, off = 0, wrong = 0, air = 0, worst = 0, vPrev = 0, far = 0, least = 1e9;
      for (let i = 0; i < hz * 9; i++) {
        const u = norm(st.p), t = Math.atan2(dot(u, h0), dot(u, u0)), c = Math.cos(t), sn = Math.sin(t);
        stepExplorerBody(st, { wish: V(6 * (h0.x * c - u0.x * sn), 6 * (h0.y * c - u0.y * sn), 6 * (h0.z * c - u0.z * sn)) }, 1 / hz, env);
        const B = st.phys, uu = norm(st.p), v = B.speedGround; far = t * R;
        if (far > 2) {
          if (st.grounded) radial = Math.max(radial, Math.abs(dot(st.v, uu))); else air++;
          off = Math.max(off, Math.abs(dot(uu, n0)) * R);
          if (st.grounded && B.material !== (sample(uu).radius > R + 0.01 ? 'rock' : 'sand')) wrong++;
          worst = Math.max(worst, vPrev - v);
          if (far > 5) least = Math.min(least, v);
        }
        vPrev = v;
      }
      const at_ = `at ${JSON.stringify(place)}, g ${g}, ${hz} Hz`;
      assert.ok(radial < 0.05, `${at_}: ${radial.toFixed(3)} m/s radial with the feet on the ground (level ground: none)`);
      assert.ok(off < 0.05, `${at_}: ${off.toFixed(3)} m off the line it was steered along`);
      assert.equal(wrong, 0, `${at_}: ${wrong} steps report a material that is not the ground under the feet`);
      assert.equal(air, 0, `${at_}: the feet leave the ground in ${air} steps`);
      assert.ok(worst <= (T.legCatch + T.braceAccel) / hz + 0.05, `${at_}: ${worst.toFixed(2)} m/s lost in one frame (the legs take a face up at legCatch, a hold braces at braceAccel: ${((T.legCatch + T.braceAccel) / hz).toFixed(2)})`);
      // (and on through the row at a clambering pace: until P19 the ghost was set down in the air when its profile began on
      // the far flank of the boulder before, every trial failed, and the run crawled to the next boulder at the least pace:
      // 0.5 m/s on Earth, 1.0 on the Moon)
      assert.ok(least > 1.5 && far > 20, `${at_}: no slower than ${least.toFixed(2)} m/s past the first boulder, on to ${far.toFixed(0)} m`);
    }
  }
});

// ---- (P21) the brace ---------------------------------------------------------------------------------
// Level ground, then from x = 10 m a straight slope of `deg` degrees (endless, or `H` m high and then falling at 10
// degrees: a crater rim), the normals the slope's own; a run at `v0` started 6 m short of it already at speed, so that the
// way ahead, read from about 9 m out, reads past the foot of the slope and never holds a pace for it.
function kinkRun(g, deg, hz, H = 0, v0 = 6.7) {
  const k = Math.tan(deg * Math.PI / 180), ka = Math.tan(-10 * Math.PI / 180), xTop = H ? 10 + H / k : 1e9;
  const h = (x) => x < 10 ? 0 : x < xTop ? (x - 10) * k : H + (x - xTop) * ka, hs = (x) => x < 10 ? 0 : x < xTop ? k : ka;
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
    return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0 }; };
  const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
  const st = { p: V(Math.sin(4 / R) * R, 0, Math.cos(4 / R) * R), v: V(v0, 0, 0), grounded: true };
  const o = { slowest: Infinity, air: 0, thrown: 0, read: 0, far: 0, finite: true };
  let rel = 0, was = true;
  // (P22: the way ahead now reads on from what it has read and tries a hill, so it no longer misses this foot: the faces'
  // read is switched off here (aheadFrom), so that the brace is what is tested; the crest is read all the same)
  const T2 = { ...T, aheadFrom: 1e9 };
  for (let i = 0; i < hz * 4; i++) {
    const t = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: V(v0 * Math.cos(t), 0, -v0 * Math.sin(t)), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env, T2);
    const B = st.phys, x = Math.atan2(st.p.x, st.p.z) * R, r = len(st.p);
    o.far = x; o.finite = o.finite && finite(st);
    if (x < 10 && B.ahead) o.read++;
    if (x > 10 && x < Math.min(16, xTop)) o.slowest = Math.min(o.slowest, B.speedGround);
    if (!st.grounded) { if (was) rel = r; o.air++; o.thrown = Math.max(o.thrown, r - rel); }
    was = st.grounded;
  }
  return o;
}

test('P21 the brace: a run onto a slope the way ahead missed loses only the speed into it; the speed along it carries on (Moon, Mars, Earth; 29 and 43 degrees; 60 and 30 Hz; P22: over a rim, contact)', () => {
  // Until P21, where the ground rose faster than the hips could follow (the legs folded to their end), the legs took up
  // the WHOLE velocity, legCatch at most: a run on the Moon onto a 29 degree slope was held at 3.72 m/s, onto 43 degrees at
  // 2.21 (P20: a crater rim in the game, 6.7 -> 2.2 m/s in 0.17 s), on Mars 4.04, on Earth 4.85. The ground pushes along
  // its normal: the speed into it goes, the speed along it stays, which over level ground is v cos^2 of the slope (5.13
  // m/s from 6.7 at 29 degrees, 3.58 at 43). (Mars and Earth at 43 degrees read the slope coming and slow before it: the
  // soles, not the brace.)
  for (const [name, g, deg] of [['Moon', 1.62, 29], ['Moon', 1.62, 43], ['Mars', 3.71, 29], ['Earth', 9.81, 29]]) for (const hz of [60, 30]) for (const H of [0, 2.2]) {
    const o = kinkRun(g, deg, hz, H), want = 6.7 * Math.cos(deg * Math.PI / 180) ** 2, tag = `${name} ${deg} degrees ${hz} Hz ${H ? 'a 2.2 m rim' : 'a slope'}`;
    assert.ok(o.finite, `${tag}: NaN`);
    assert.equal(o.read, 0, `${tag}: the way ahead held a pace for it (the case is one it misses)`);
    // (P22: a rim's crest is read, and the run slows on the rim to meet it at the pace the hips can follow over it: the slope
    // alone is held to v cos^2)
    if (!H) assert.ok(o.slowest >= 0.96 * want, `${tag}: ${o.slowest.toFixed(2)} m/s at the slowest on it, the speed along it is ${want.toFixed(2)}`);
    else assert.ok(o.slowest > 1.5, `${tag}: ${o.slowest.toFixed(2)} m/s at the slowest on the rim`);
    // (until P22 over the rim's crest the feet left the falling ground (0.15 to 0.4 m up); now the crest is read: no air)
    assert.equal(o.air, 0, `${tag}: ${o.air} steps in the air`);
    assert.ok(o.thrown <= 0.05 && o.far > 18, `${tag}: thrown up ${o.thrown.toFixed(3)} m, on to ${o.far.toFixed(1)} m`);
  }
});

test('P21 the legs\' base is never carried below the ground the feet have stood on: between close boulders the hips can be raised for the next one (Earth, Moon; 60 and 30 Hz)', async () => {
  // B.base, the ground the hips' reach is counted from while the legs work, was carried on at the rate the ground had been
  // rising, and that rate is a descent's on the far side of a boulder: it went on sinking after the feet had reached the
  // floor, up to 5.3 m under it in P19's row, the hips could not be raised for the next boulder, and it was met braced (the
  // Moon, 60 Hz: 1.74 m/s at the slowest). P19's row of boulders, at one of its places.
  const { scrambleSample } = await import('../player/explorer.js');
  const ROCK = { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 };
  const SANDY = { material: 'sand', friction: 0.6, kinetic: 0.5, foothold: 0.2, restitution: 0.05, sink: 0.05, drag: 0.25, dust: 0.6 };
  const ROW = [[6, 0, 1], [8.6, 0.3, 0.9], [11.4, -0.4, 1.1], [14, 0.5, 1], [16.6, 0, 0.8], [19.4, -0.3, 1.2], [22.2, 0.2, 1], [25, 0, 1]];
  const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const u0 = norm(V(0.3, 0.9, 0.3)), h0 = norm(cross(cross(u0, V(0.2, 1, 0.1)), u0)), n0 = cross(u0, h0);
  const at = (s, o) => { const c = Math.cos(s / R), sn = Math.sin(s / R); return norm(V(u0.x * c + h0.x * sn + n0.x * o / R, u0.y * c + h0.y * sn + n0.y * o / R, u0.z * c + h0.z * sn + n0.z * o / R)); };
  const obs = ROW.map(([s, o, h]) => ({ unitDir: at(s, o), radius: 0.6, height: h }));
  const sample = scrambleSample((d) => ({ radius: R, normal: V(d.x, d.y, d.z), liquidRadius: 0 }), () => obs);
  for (const g of [9.81, 1.62]) for (const hz of [60, 30]) {
    const env = { sample, gravity: g, ground: (s, out) => Object.assign(out, s.radius > R + 0.01 ? ROCK : SANDY) };
    const p0 = at(0, 0), st = { p: V(p0.x * R, p0.y * R, p0.z * R), v: V(), grounded: true };
    let sunk = 0, least = 1e9, far = 0, off = 0, air = 0;
    for (let i = 0; i < hz * 9; i++) {
      const u = norm(st.p), t = Math.atan2(dot(u, h0), dot(u, u0)), c = Math.cos(t), sn = Math.sin(t);
      stepExplorerBody(st, { wish: V(6 * (h0.x * c - u0.x * sn), 6 * (h0.y * c - u0.y * sn), 6 * (h0.z * c - u0.z * sn)) }, 1 / hz, env);
      const B = st.phys; far = t * R;
      if (st.grounded && Math.abs(len(st.p) - R) < 1e-6) sunk = Math.max(sunk, R - B.base);   // (the feet on the floor)
      if (far > 5) least = Math.min(least, B.speedGround);
      if (!st.grounded) air++;
      off = Math.max(off, Math.abs(dot(norm(st.p), n0)) * R);
    }
    const tag = `g ${g}, ${hz} Hz`;
    assert.ok(sunk < 1e-6, `${tag}: the legs' base ${sunk.toFixed(2)} m under the floor the feet stand on`);
    assert.ok(least > 2.1 && far > 20, `${tag}: no slower than ${least.toFixed(2)} m/s past the first boulder, on to ${far.toFixed(0)} m`);
    assert.ok(air === 0 && off < 0.005, `${tag}: ${air} steps in the air, ${off.toFixed(3)} m off the line`);
  }
});

// ---- (P22) the way, seen ----------------------------------------------------------------------------------
// PILOT's boulder (scrambleSample) listed only while it is within 9 m of the explorer, as the game lists them
// (src/core/sim.js: obstaclesNear(..., 9) once a frame): the way ahead, read 12 m out at a run on the Moon, never sees it.
async function gameBoulder(g, v, hz, { height = 0.68, radius = 1.07, at = 14, off = 0 } = {}) {
  const { scrambleSample } = await import('../player/explorer.js');
  const c = norm(V(Math.sin(at / R), off / R, Math.cos(at / R))), rock = { unitDir: c, radius, height };
  const st = { p: V(Math.sin(2 / R) * R, 0, Math.cos(2 / R) * R), v: V(v, 0, 0), grounded: true };
  let list = [];
  const sample = scrambleSample((d) => ({ radius: R, normal: V(d.x, d.y, d.z), liquidRadius: 0 }), () => list);
  const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'dust', friction: 0.6, kinetic: 0.5, foothold: 0.1, restitution: 0.05, sink: 0.02, drag: 0.05, dust: 0.5 }) };
  const o = { slowest: Infinity, brace: 0, held: 0, air: 0, feet: 0, far: 0 };
  for (let i = 0; i < hz * 4; i++) {
    const u = norm(st.p); list = len(V(u.x - c.x, u.y - c.y, u.z - c.z)) * R < 9 ? [rock] : [];
    const t = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: V(v * Math.cos(t), 0, -v * Math.sin(t)), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
    const B = st.phys, x = Math.atan2(st.p.x, st.p.z) * R; o.far = x;
    if (Math.abs(x - at) < radius + 2.5) {
      o.slowest = Math.min(o.slowest, B.speedGround); o.brace = Math.max(o.brace, B.brace);
      if (B.grip && B.paceCap < 1e8 && B.speedGround > B.paceCap + 0.05) o.held++;
      if (!st.grounded) o.air++;
      o.feet = Math.max(o.feet, len(st.p) - sample(norm(st.p)).radius);
    }
  }
  return o;
}

test('P22 the hips are raised in time for a rock the stroke can take: the game\'s Moon boulder (0.68 m, listed within 9 m) is run over at the pace, no brace, no hold checking the run, feet down (Moon, Mars, Earth; 60 and 30 Hz)', async () => {
  // Until P22 the legs levelled the hips over the ground under the feet at its own rate: up the boulder's face as fast as
  // it rose (4 m/s at 7.4 m/s), over its top 0.2 m higher than it asks, and the limbs then checked the run so the feet could
  // follow the far side down: the game's strip, 7.15 -> 2.52 m/s on top (here 2.42 at the slowest). Seeing the way, they are
  // raised before the boulder only as far as its top asks (0.23 m: the legs fold 0.45 m on it and stretch 0.23 m beyond).
  for (const [name, g] of [['Moon', 1.62], ['Mars', 3.71], ['Earth', 9.81]]) for (const hz of [60, 30]) {
    const o = await gameBoulder(g, 7.4, hz), tag = `${name} ${hz} Hz`;
    assert.ok(o.slowest > 7.0, `${tag}: ${o.slowest.toFixed(2)} m/s at the slowest over it`);
    assert.ok(o.brace < 0.05 && o.held === 0, `${tag}: braced ${o.brace.toFixed(2)} m/s in a step, held in ${o.held} steps`);
    assert.ok(o.air === 0 && o.feet < 0.01 && o.far > 20, `${tag}: ${o.air} steps in the air, feet ${o.feet.toFixed(3)} m up, on to ${o.far.toFixed(0)} m`);
  }
});

function rimRun(g, a1, H, a2, v, hz) {
  const k1 = Math.tan(a1 * Math.PI / 180), k2 = Math.tan(a2 * Math.PI / 180), xT = 10 + H / k1;
  const h = (x) => x < 10 ? 0 : x < xT ? (x - 10) * k1 : H - (x - xT) * k2, hs = (x) => x < 10 ? 0 : x < xT ? k1 : -k2;
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
    return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0 }; };
  const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
  const st = { p: V(Math.sin(2 / R) * R, 0, Math.cos(2 / R) * R), v: V(v, 0, 0), grounded: true };
  const o = { air: 0, feet: 0, thrown: 0, far: 0, finite: true };
  let rel = 0, was = true;
  for (let i = 0; i < hz * 8; i++) {
    const t = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: V(v * Math.cos(t), 0, -v * Math.sin(t)), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
    const x = Math.atan2(st.p.x, st.p.z) * R, r = len(st.p); o.far = x; o.finite = o.finite && finite(st);
    if (!st.grounded) { if (was) rel = r; o.air++; o.thrown = Math.max(o.thrown, r - rel); o.feet = Math.max(o.feet, r - R - h(x)); }
    was = st.grounded;
    if (x > xT + 6) break;
  }
  return o;
}

test('P22 the crest: a run up a crater rim reads its crest and keeps its feet on the ground over it, never thrown up (29, 43, 54 degree rims; Moon, Mars, Earth; 60 and 30 Hz)', () => {
  // Until P22 the walker read faces, not crests: up a rim at speed the hips rose at the slope's own rate, and over the crest
  // they could not be turned down in time: the feet left the falling ground (P21: 0.40 m up over a 29 / 10 degree rim on
  // the Moon at 6.7 m/s), and off a steep rim's crest the body was thrown (the game's crater fields: up to 2.4 m above
  // where the feet left the ground). A crest rising at s1 and falling at s2 is followed in contact up to
  // sqrt(2 (g + grip) stroke) / (s1 + s2); measured on the body, within 5 % on every world.
  for (const [name, g] of [['Moon', 1.62], ['Mars', 3.71], ['Earth', 9.81]]) for (const hz of [60, 30]) for (const [a1, H, a2] of [[29, 2.2, 10], [43, 2.2, 10], [54, 4, 7]]) {
    if (g > 9 && a1 > 50) continue;            // (54 degrees is beyond what a run holds on Earth: it does not get up)
    const o = rimRun(g, a1, H, a2, 7.4, hz), tag = `${name} ${hz} Hz, ${a1} degrees ${H} m then ${a2} down`;
    assert.ok(o.finite, `${tag}: NaN`);
    assert.ok(o.feet <= 0.05 && o.thrown <= 0.02, `${tag}: feet ${o.feet.toFixed(2)} m up (${o.air} steps in the air), thrown ${o.thrown.toFixed(3)} m`);
    assert.ok(o.far > 10 + H / Math.tan(a1 * Math.PI / 180) + 4, `${tag}: over the crest (to ${o.far.toFixed(1)} m)`);
  }
});

// (P24) A KNIFE EDGE: level to 10 m, a rise at a1 degrees to H1, a crater's inner wall falling at a2 degrees by D (more than a
// clamber in a look), a level floor.
function knifeEdgeRun(g, a1, H1, a2, D, v, hz) {
  const k1 = Math.tan(a1 * Math.PI / 180), k2 = Math.tan(a2 * Math.PI / 180), xT = 10 + H1 / k1, xF = xT + D / k2;
  const h = (x) => x < 10 ? 0 : x < xT ? (x - 10) * k1 : x < xF ? H1 - (x - xT) * k2 : H1 - D;
  const hs = (x) => x < 10 ? 0 : x < xT ? k1 : x < xF ? -k2 : 0;
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
    return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0 }; };
  const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
  const st = { p: V(Math.sin(2 / R) * R, 0, Math.cos(2 / R) * R), v: V(v, 0, 0), grounded: true };
  const o = { edge: 0, air: 0, thrown: 0, far: 0, finite: true, xF };
  let rel = 0, was = true;
  for (let i = 0; i < hz * 10; i++) {
    const t = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: V(v * Math.cos(t), 0, -v * Math.sin(t)), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
    const x = Math.atan2(st.p.x, st.p.z) * R, r = len(st.p); o.far = x; o.finite = o.finite && finite(st);
    if (x > 10 && x < xT && st.grounded) o.edge = st.phys.speedGround;   // (the pace on the last of the rise)
    if (!st.grounded) { if (was) rel = r; o.air++; o.thrown = Math.max(o.thrown, r - rel); }
    was = st.grounded;
    if (x > xF + 6) break;
  }
  return o;
}

test('P24 the knife edge (the coordinator\'s ruling): a run up a gentle rise to a crater\'s inner wall keeps its pace to the edge and may leave the ground off the wall, but is never thrown up (Moon, Mars, Earth; 60 and 30 Hz; a 60 degree ridge on the Moon)', () => {
  // P22 read the top of a climb whose far side falls more than a clamber in a look as a crest to be followed down at its
  // steepest followable slope, gravity alone turning the hips: sqrt(2 g stroke) / (s1 + clamber / look). Gentle rises to the
  // game's crater walls were run at 1.1-1.4 m/s for 2-3 s (here 1.4-1.8 m/s at the edge on the Moon and Mars, 2.1-2.7 on
  // Earth); PILOT's verdict: too heavy. The ruling: don't throw the runner up. The hips, rising at v s1, are turned to level
  // within the fold by gravity alone, v <= sqrt(2 g fold) / s1 (x crestMargin); beyond the edge the ground falls away and a
  // flight off it is allowed (the crater-wall ruling). Measured: 3.4-4.9 m/s at the edge, thrown up 0.09 m at most.
  for (const [name, g] of [['Moon', 1.62], ['Mars', 3.71], ['Earth', 9.81]]) for (const hz of [60, 30]) for (const [a1, H1, a2, D] of [[10, 1.5, 55, 4], [6, 1, 50, 3]]) {
    const o = knifeEdgeRun(g, a1, H1, a2, D, 7.4, hz), tag = `${name} ${hz} Hz, ${a1} degrees ${H1} m up, a ${a2} degree wall ${D} m down`;
    assert.ok(o.finite, `${tag}: NaN`);
    assert.ok(o.edge > 3.0, `${tag}: ${o.edge.toFixed(2)} m/s at the edge`);
    assert.ok(o.thrown <= 0.15, `${tag}: thrown up ${o.thrown.toFixed(3)} m off the edge (${o.air} steps in the air)`);
    assert.ok(o.far > o.xF + 3, `${tag}: down the wall and on (to ${o.far.toFixed(1)} m)`);
  }
  // (a steep ridge climbed at a crawl: the hips' rise is the climb's, and it is turned within the fold; P22's comment: a 60
  // degree ridge on the Moon, climbed at 2 m/s, threw the body 0.5 m up off its crest)
  for (const hz of [60, 30]) {
    const o = knifeEdgeRun(1.62, 60, 3, 60, 3, 7.4, hz), tag = `Moon ${hz} Hz, a 60 degree ridge`;
    assert.ok(o.finite && o.thrown <= 0.15 && o.far > o.xF + 3, `${tag}: thrown up ${o.thrown.toFixed(3)} m, on to ${o.far.toFixed(1)} m (the foot of the wall ${o.xF.toFixed(1)})`);
  }
});

test('P22 a run across the field of low boulders on the Moon keeps its feet down and hardly braces: the way ahead is read without gaps (PILOT\'s profile and steep normals; 60 and 20 Hz)', () => {
  // Until P22 (a) the way ahead jumped forward as the pace and its far point grew, and ground between was never read, and
  // (b) the rise of a face was counted over the line of the slope being run on, carried 8 m on: climbing the flank of one
  // boulder, the next was under that line. A 0.9 m boulder was met unread at 7.4 m/s, braced and held: 21 steps losing
  // more than 0.3 m/s, the feet 0.19 to 0.21 m up.
  for (const pilot of [true, false]) for (const hz of [60, 20]) {
    const sample = boulders(FIELD, { pilot }), st = { p: V(0, 0, sample(V(0, 0, 1)).radius), v: V(), grounded: true };
    const env = { sample, gravity: 1.62, air: (p, o) => { o.density = 0; o.wind.x = o.wind.y = o.wind.z = 0; return o; } };
    let top = 0, lossy = 0, vPrev = 0;
    for (let i = 0; i < 40 * hz && st.p.x < 75; i++) {
      stepExplorerBody(st, { wish: V(7.4, 0, 0), assistAccel: 4 * 0.45 }, 1 / hz, env);
      const sp = Math.hypot(st.v.x, st.v.y); top = Math.max(top, len(st.p) - sample(st.p).radius);
      if (i > 1.5 * hz && vPrev - sp > 0.3 * 60 / hz) lossy++;
      vPrev = sp;
    }
    const tag = `${pilot ? "PILOT's profile" : 'steep normals'} ${hz} Hz`;
    assert.ok(st.p.x >= 75, `${tag}: got across`);
    assert.ok(top <= 0.06, `${tag}: feet ${top.toFixed(2)} m off the ground`);
    assert.ok(lossy <= 6, `${tag}: ${lossy} steps lose more than 0.3 m/s (at 60 Hz; P21: 22, 5, 21 and 3)`);
  }
});

test('P22 a hill is not a face: a run onto a 35 or 43 degree hill seen coming is not slowed before it; its foot takes the speed into it (v cos^2 kept) and up it the pace is the legs\' own (Moon, Mars, Earth; 60 and 30 Hz)', () => {
  // Until P22 a steep hill read 12 m out was a face to P16's law (a rise of more than the stroke within a span, and the
  // profile went on rising, so it was not tried): the run was slowed to the law's pace before its foot, 2.0 to 2.5 m/s, and
  // the foot then took the speed into it: 1.07 to 1.26 m/s on a 43 degree hill on the Moon, Mars and Earth. A hill (still
  // rising more than a clamber over the profile's last two looks) has no top to bring the hips down from.
  for (const [name, g] of [['Moon', 1.62], ['Mars', 3.71], ['Earth', 9.81]]) for (const deg of [35, 43]) for (const hz of [60, 30]) {
    const k = Math.tan(deg * Math.PI / 180), X = 25, h = (x) => Math.max(0, x - X) * k, hs = (x) => x < X ? 0 : k;
    const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
      return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0 }; };
    const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
    const st = { p: V(Math.sin(2 / R) * R, 0, Math.cos(2 / R) * R), v: V(7.4, 0, 0), grounded: true };
    let foot = 0, on = Infinity, up = 0, nUp = 0, air = 0;
    for (let i = 0; i < hz * 8; i++) {
      const t = Math.atan2(st.p.x, st.p.z);
      stepExplorerBody(st, { wish: V(7.4 * Math.cos(t), 0, -7.4 * Math.sin(t)), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
      const x = Math.atan2(st.p.x, st.p.z) * R, v = st.phys.speedGround;
      if (x < X) foot = v; else if (x < X + 6) { on = Math.min(on, v); if (!st.grounded) air++; if (x > X + 3) { up += v; nUp++; } }
      if (x > X + 6) break;
    }
    const want = 7.4 * Math.cos(deg * Math.PI / 180) ** 2, tag = `${name} ${deg} degrees ${hz} Hz`;
    assert.ok(foot > 7.2, `${tag}: ${foot.toFixed(2)} m/s at the foot (slowed before it)`);
    assert.ok(on > 0.9 * want, `${tag}: ${on.toFixed(2)} m/s at the slowest on it, v cos^2 is ${want.toFixed(2)}`);
    assert.ok(nUp > 0 && up / nUp > 3.5 && air === 0, `${tag}: ${(up / Math.max(1, nUp)).toFixed(2)} m/s up it (level), ${air} steps in the air`);
  }
});

// ---- (P23) the gale -----------------------------------------------------------------------------------------
// Neptune's squall at the storm stand, as the game's air gives it at a walker: 60 to 70 m/s a metre up, the sub-second
// eddies swinging it from a third to well over twice that, gusts to 175 m/s (PAINTER 13 saw 141 m/s, and the walker
// blown 19 m and up the cliff behind the beach in 15 s). The wind's speed at a height h over sand: the log law.
function galeRun({ g = 11.15, rho = 0.99, U1 = 65, hz = 60, secs = 30, slope = 0, wish = 0, ground = 'sand' } = {}) {
  const k = Math.tan(slope * Math.PI / 180);
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, n = Math.hypot(1, k);
    return { radius: R - k * x, normal: { x: (ux + uz * k) / n, y: d.y / l / n, z: (uz - ux * k) / n }, liquidRadius: 0 }; };
  let t = 0;
  const U = (tt) => { const base = U1 * (1 + 0.35 * Math.sin(2 * Math.PI * tt / 3.1) + 0.3 * Math.sin(2 * Math.PI * tt / 0.7 + 1)); const pk = Math.exp(-(((tt % 10) - 6) ** 2) / 0.18); return Math.max(0.3 * U1, base) * (1 - pk) + 2.7 * U1 * pk; };   // (a gust of 2.7 times the mean every 10 s: 175 m/s)
  const z0 = 0.005;
  const env = { sample, gravity: g,
    air: (p, o, h) => { const f = Math.log(Math.max(0.1, h) / z0) / Math.log(1 / z0), s = U(t) * f, l = Math.hypot(p.x, p.y, p.z) || 1, ux = p.x / l, uz = p.z / l;
      o.density = rho; o.wind.x = uz * s; o.wind.y = 0; o.wind.z = -ux * s; return o; },   // (blowing toward +x, downhill on the slope)
    ground: (s, o) => Object.assign(o, ground === 'sand' ? { material: 'sand', friction: 0.6, kinetic: 0.5, foothold: 0.2, restitution: 0.05, sink: 0.05, drag: 0.25, dust: 0.6 } : { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
  const st = { p: V(0, 0, sample(V(0, 0, 1)).radius), v: V(), grounded: true };
  const o = { far: 0, fast: 0, air: 0, hunker: 0, lean: 0, brace: 0, finite: true };
  for (let i = 0; i < hz * secs; i++) {
    t = i / hz;
    const th = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: V(wish * Math.cos(th), 0, -wish * Math.sin(th)) }, 1 / hz, env);
    const B = st.phys, x = th * R;
    o.far = Math.max(o.far, Math.abs(x)); o.fast = Math.max(o.fast, Math.hypot(st.v.x, st.v.y, st.v.z));
    if (!st.grounded) o.air++;
    o.hunker = Math.max(o.hunker, B.hunker01); o.lean = Math.max(o.lean, B.lean); o.brace = Math.max(o.brace, B.windBrace);
    o.finite = o.finite && Number.isFinite(st.p.x + st.v.x);
    o.x = x;
  }
  return o;
}

test('P23 the gale: in Neptune\'s squall (60-70 m/s at a metre, gusts to 175 m/s) a walker gets low, leans into it and is braced: never carried off; it can still walk out of it; an ordinary storm leaves it upright', () => {
  // Until P23 the wind's push on a standing body (0.85 m^2: three to nine times what sand holds at Neptune) slid it across
  // the beach and up the cliff behind it (PAINTER 13: 19 m in 15 s). Now it gets low (less drag, the wind read nearer the
  // ground, hands and knees on it) and the suit braces against what the soles cannot hold (its jet's thrust at most).
  for (const hz of [60, 30]) for (const [slope, ground] of [[0, 'sand'], [10, 'sand'], [0, 'rock']]) {
    const tag = `${hz} Hz, ${slope} degrees, ${ground}`;
    const o = galeRun({ hz, slope, ground });
    assert.ok(o.finite, `${tag}: NaN`);
    assert.ok(o.far < 2 && o.fast < 2 && o.air === 0, `${tag}: standing, staggered ${o.far.toFixed(2)} m, at ${o.fast.toFixed(2)} m/s at most, ${o.air} steps in the air`);
    assert.ok(o.hunker > 0.5 && o.lean > 0.3 && o.brace > 0, `${tag}: down low ${o.hunker.toFixed(2)}, leaning ${o.lean.toFixed(2)} rad, braced ${o.brace.toFixed(0)} N`);
    // walking: into the wind it crawls on, with it it is not blown along faster than a run
    const up = galeRun({ hz, slope, ground, wish: -4, secs: 10 }), dn = galeRun({ hz, slope, ground, wish: 4, secs: 10 });
    assert.ok(up.x < -3 && dn.x > 3, `${tag}: walked ${up.x.toFixed(1)} m into it and ${dn.x.toFixed(1)} m with it in 10 s`);
    assert.ok(dn.fast < 5 && up.air === 0 && dn.air === 0, `${tag}: with it at ${dn.fast.toFixed(2)} m/s at most`);
  }
  // an ordinary storm (Earth's coast storm: 10 m/s at a metre, gusts to 27): upright (a crouch at most in its gusts), no brace
  const e = galeRun({ g: 9.81, rho: 1.2, U1: 10, secs: 12 });
  assert.ok(e.hunker < 0.2 && e.brace === 0 && e.far < 0.05, `Earth's storm: down low ${e.hunker.toFixed(2)}, braced ${e.brace.toFixed(0)} N, moved ${e.far.toFixed(2)} m`);
});

// ---- (P26) a wall -------------------------------------------------------------------------------------------
// Level ground to 10 m, a face at `deg` degrees H m high, level beyond it (the same along y: a wall met at `ang` degrees
// off square on is a wish turned by that). Shift+W as the game gives it (a wish of 7.4 m/s, PILOT's assist), from x0 at v0
// (up0: set down on the face that high, at rest). The ground: rock (holds 52 degrees to the soles, 61 to a scramble).
function wallRun(g, deg, H, hz, { secs = 10, x0 = 2, v0 = 0, ang = 0, up0 = 0, friction = 0.9, foothold = 0.4 } = {}) {
  const k = Math.tan(deg * Math.PI / 180), xT = 10 + H / k, a = ang * Math.PI / 180, v = 7.4;
  const h = (x) => x < 10 ? 0 : x < xT ? (x - 10) * k : H, hs = (x) => x < 10 || x >= xT ? 0 : k;
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
    return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0, slope: Math.atan(Math.abs(s)) }; };
  const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction, kinetic: 0.78 * friction, foothold, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
  if (up0 > 0) x0 = 10 + up0 / k;
  const r0 = R + h(x0), st = { p: V(Math.sin(x0 / R) * r0, 0, Math.cos(x0 / R) * r0), v: V(v0, 0, 0), grounded: true };
  const o = { top: 0, air: 0, finite: true, x: x0, up: 0, y: 0, v: 0, wall: 0, thrown: 0 };
  let rel = 0, was = true;
  for (let i = 0; i < hz * secs; i++) {
    const t = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: V(v * Math.cos(a) * Math.cos(t), v * Math.sin(a), -v * Math.cos(a) * Math.sin(t)), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
    o.finite = o.finite && finite(st);
    o.x = Math.atan2(st.p.x, st.p.z) * R; o.up = len(st.p) - R; o.y = st.p.y; o.v = st.phys.speedGround;
    if (o.up > o.top) o.top = o.up;
    if (!st.grounded) { if (was) rel = len(st.p); o.air++; o.thrown = Math.max(o.thrown, len(st.p) - rel); }
    was = st.grounded;
    if (st.phys.wall) o.wall++;
  }
  return o;
}

test('P26 a wall is not run up: Shift+W into a 70 degree face 10 m high gains less than a clamber and the walker stands at its foot (Earth, Mars, Moon; 60 and 30 Hz; rock and turf; 66 to 89 degrees)', () => {
  // PILOT's critique, item 1: the explorer ran up Earth's sea cliffs (70 to 79 degrees), 50 m at 6 m/s, feet on the face.
  // Any rising ground gave the limbs a hold once the legs were at work, and since P22 they are at work at the foot of
  // every rise; carried on its limbs, the walker felt no gravity along the face. Now a face steeper than the limbs
  // scramble (the soles' hold and the hands' pull, EXPLORER_BODY.scrambleSlope) that rises on more than a clamber is a
  // wall: no step, no hold, and a walker does not put a foot on it. (On the head every case here ends on top of the
  // face: 10 m.)
  for (const [name, g] of [['Earth', 9.81], ['Mars', 3.71], ['Moon', 1.62]]) for (const hz of [60, 30]) {
    for (const [deg, friction, foothold] of [[70, 0.9, 0.4], [70, 0.65, 0.3], [66, 0.9, 0.4], [79, 0.9, 0.4], [89, 0.9, 0.4]]) {
      const o = wallRun(g, deg, 10, hz, { friction, foothold }), tag = `${name} ${hz} Hz, ${deg} degrees, hold ${friction + foothold}`;
      assert.ok(o.finite, `${tag}: NaN`);
      assert.ok(o.top < T.clamber, `${tag}: ${o.top.toFixed(2)} m up the face`);
      assert.ok(o.top < 0.3 && Math.abs(o.x - 10) < 0.6 && o.up < 0.05 && o.v < 0.3 && o.air === 0, `${tag}: at its foot (x ${o.x.toFixed(2)}, ${o.up.toFixed(2)} m up, ${o.v.toFixed(2)} m/s, highest ${o.top.toFixed(2)} m, ${o.air} steps in the air)`);
    }
    // met at the pace, with no room to shed it (0.4 m short of a face 60 m high at 7.4 m/s): the wall takes the speed into
    // it and the body rides up on what is left along it, as far as its momentum has it (2.5 m/s along the face: 0.16 m
    // on Earth, 1.0 m on Mars, 1.2 m on the Moon), and slides back to the foot: the wall does not carry it up
    const f = wallRun(g, 70, 60, hz, { x0: 9.6, v0: 7.4 }), tag = `${name} ${hz} Hz, met at 7.4 m/s`;
    assert.ok(f.finite && f.top < T.clamber && f.thrown < 0.3 && Math.abs(f.x - 10) < 0.6 && f.up < 0.05 && f.v < 0.3, `${tag}: highest ${f.top.toFixed(2)} m, thrown ${f.thrown.toFixed(2)} m, ends x ${f.x.toFixed(2)}, ${f.up.toFixed(2)} m up at ${f.v.toFixed(2)} m/s`);
    // set down on it 3 m up (a landing): it slides back to the foot, whatever the keys ask
    const s = wallRun(g, 70, 60, hz, { up0: 3 }), tag2 = `${name} ${hz} Hz, set down 3 m up it`;
    assert.ok(s.finite && s.top < 3.05 && s.up < 0.3, `${tag2}: highest ${s.top.toFixed(2)} m, ends ${s.up.toFixed(2)} m up`);
    // met at 45 degrees: the walker goes along its foot with the speed it has along it
    const d = wallRun(g, 70, 60, hz, { ang: 45 }), tag3 = `${name} ${hz} Hz, met at 45 degrees`;
    assert.ok(d.finite && d.top < 0.3 && d.y > 5, `${tag3}: highest ${d.top.toFixed(2)} m, ${d.y.toFixed(1)} m along its foot in 10 s`);
  }
});

test('P26 what the limbs scramble is still climbed: a 70 degree face a clamber high is a step; rock a little steeper than the soles hold is scrambled, steeper in low gravity (Earth 53, Mars 56, Moon 60 degrees; 60 and 30 Hz)', () => {
  for (const [name, g, deg] of [['Earth', 9.81, 53], ['Mars', 3.71, 56], ['Moon', 1.62, 60]]) for (const hz of [60, 30]) {
    const step = wallRun(g, 70, 1.3, hz), tag = `${name} ${hz} Hz`;
    assert.ok(step.finite && step.x > 12 && Math.abs(step.up - 1.3) < 0.05, `${tag}: a 70 degree face 1.3 m high: x ${step.x.toFixed(1)}, ${step.up.toFixed(2)} m up`);
    // (the soles hold 52.4 degrees of this rock; the hands add scramblePull / g)
    const slope = wallRun(g, deg, 6, hz);
    assert.ok(slope.finite && slope.wall === 0 && slope.top > 5.9, `${tag}: a ${deg} degree rock slope 6 m high: ${slope.top.toFixed(2)} m up, ${slope.wall} steps at a wall`);
  }
  // (what Earth's gravity makes a wall is scrambled on the Moon: the hands hold a force, not a share of the weight)
  const e = wallRun(9.81, 58, 6, 60), m = wallRun(1.62, 58, 6, 60);
  assert.ok(e.top < T.clamber && m.top > 5.9, `58 degrees of rock: ${e.top.toFixed(2)} m up on Earth, ${m.top.toFixed(2)} m on the Moon`);
});

test('P26 on PAINTER\'s real Earth: Shift+W from the sea_coast stand into its cliffs (70 to 79 degrees) gains less than a clamber on ground steeper than 50 degrees (the three headings that ran up them)', async () => {
  let real;
  try { real = await import('../world/surface.js'); } catch (e) { console.log('# (skipped: src/world/surface.js did not load in Node: ' + e.message + ')'); return; }
  if (typeof real.sampleSurfacePure !== 'function' || typeof real.getStandPure !== 'function') { console.log('# (skipped: sampleSurfacePure / getStandPure not exported)'); return; }
  const { createPhysics } = await import('./index.js');
  const sampleSurface = (id, d) => real.sampleSurfacePure(id, d.x, d.y, d.z);
  const d0 = norm(real.getStandPure('earth', 'sea_coast').unitDir), hz = 30;
  const cr = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  for (const heading of [0, 270, 315]) {
    const physics = createPhysics({ sampleSurface, seed: 1 });
    // (the surface as PILOT's Sim hands it to the explorer: plain numbers, a copy)
    const sample = (d) => { const s = sampleSurface('earth', d); return { radius: s.radius, normal: { x: s.normal.x, y: s.normal.y, z: s.normal.z }, slope: s.slope || 0, liquidRadius: s.liquidRadius || 0, biomeId: s.biomeId, biomeWeights: s.biomeWeights }; };
    const env = physics.bindEnv('earth', { sample, gravity: 9.81 });
    const r0 = sample(d0).radius, st = { p: V(d0.x * r0, d0.y * r0, d0.z * r0), v: V(), grounded: true };
    physics.update(1 / hz, { bodyId: 'earth', time: 30, focus: st.p, sunDir: d0 });
    let steep = 0, top = 0, prev = r0, fin = true;
    for (let i = 0; i < hz * 10; i++) {
      const up = norm(st.p), east = norm(cr(V(0, 1, 0), up)), north = cr(up, east), a = heading * Math.PI / 180;
      const f = V(north.x * Math.cos(a) + east.x * Math.sin(a), north.y * Math.cos(a) + east.y * Math.sin(a), north.z * Math.cos(a) + east.z * Math.sin(a));
      stepExplorerBody(st, { wish: V(f.x * 7.4, f.y * 7.4, f.z * 7.4), assistAccel: 4 }, 1 / hz, env);
      const r = len(st.p), s = sample(norm(st.p));
      if (st.grounded && s.slope * 57.3 > 50 && r > prev) steep += r - prev;
      prev = r; top = Math.max(top, r - r0); fin = fin && finite(st);
    }
    console.log(`# P26 Earth sea_coast heading ${heading}: ${steep.toFixed(2)} m gained on ground over 50 degrees (head: 49 to 50 m), ${top.toFixed(2)} m above the stand at most`);
    assert.ok(fin, `heading ${heading}: NaN`);
    assert.ok(steep < T.clamber, `heading ${heading}: ${steep.toFixed(2)} m up ground steeper than 50 degrees`);
    assert.ok(top < 3, `heading ${heading}: ${top.toFixed(2)} m above the stand`);
  }
});

// ---- (P26) the figure's state ---------------------------------------------------------------------------------
test('P26 the figure\'s state: the lean is a vector into the wind, the air past the body is given, a swimmer has a stroke, a flight an arc; none of it moves the body', () => {
  // PILOT and PAINTER draw the figure leaning into the wind, crouching in a gale, swimming, and rising or falling in an
  // arc (PHYSICS' critique of PAINTER, items 1, 2 and 5). Until P26 the lean was an angle with no direction, there was
  // no swimmer's flag or stroke, and nothing said whether a body in the air was going up or coming down.
  // a wind from the west (blowing toward +x) on a standing body: it leans west, as far as lean; the air streams past it east
  // ((M4) the vector is eased over the gust's envelope, EXPLORER_BODY.figureGust: in a steady wind it comes to the lean)
  const w = make({ wind: V(18, 0, 0) }); run(w, 15, { wish: V() });
  const B = w.st.phys, up = norm(w.st.p);
  assert.ok(B.lean > 0.05 && Math.abs(len(B.leanV) - B.lean) < 1e-4 * B.lean, `lean ${B.lean}, |leanV| ${len(B.leanV)}`);
  assert.ok(B.leanV.x < -0.9 * B.lean && Math.abs(dot(B.leanV, up)) < 1e-9, `into the wind, level: ${JSON.stringify(B.leanV)}`);
  assert.ok(Math.abs(B.relWind.x - 18) < 1e-6 && Math.abs(B.relWindSpeed - 18) < 1e-6 && B.arc === 0 && B.airTime === 0 && B.swim === 0, 'standing in it: the air passes at the wind\'s speed');
  // running with it at 7.4 m/s: the air passes at the difference
  run(w, 4, { wish: V(7.4, 0, 0) });
  assert.ok(Math.abs(w.st.phys.relWind.x - (18 - w.st.v.x)) < 1e-6 && w.st.phys.relWindSpeed < 11.5, `running with it: ${w.st.phys.relWindSpeed} m/s past the body`);
  // still air: a run makes its own wind, and the runner leans a little into it (forward: 2 degrees at 7.4 m/s); standing, none
  const c = make(); run(c, 3, { wish: V(7.4, 0, 0) });
  assert.ok(c.st.phys.leanV.x > 0.02 && len(c.st.phys.leanV) < 0.05 && Math.abs(c.st.phys.relWind.x + 7.4) < 0.05, `still air, running: lean ${JSON.stringify(c.st.phys.leanV)}, the air past the body ${c.st.phys.relWind.x}`);
  run(c, 20, { wish: V() });
  assert.ok(len(c.st.phys.leanV) === 0 && c.st.phys.relWindSpeed === 0, 'still air, standing: no lean, no air past the body');
  // a jump: rising, then falling, then down; the time in the air counts up and is 0 again on the ground
  const j = make(); run(j, 1, { wish: V(4.2, 0, 0) });
  const seen = []; let tMax = 0;
  run(j, 2.5, (t) => ({ wish: V(4.2, 0, 0), jump: t < 0.05 }), { each: (t, st) => { const P = st.phys; if (seen[seen.length - 1] !== P.arc) seen.push(P.arc); tMax = Math.max(tMax, P.airTime);
    if (!st.grounded) assert.equal(P.arc, vert(st) > 0 ? 1 : -1); else assert.ok(P.arc === 0 && P.airTime === 0);
    assert.ok(Math.abs(P.vUp - vert(st)) < 1e-9); } });
  assert.deepEqual(seen, [0, 1, -1, 0], 'the arc of a jump: ' + seen);
  assert.ok(tMax > 0.6 && tMax < 1.4, 'in the air for ' + tMax + ' s');
  // a swimmer: afloat in deep water the flag is up and the stroke turns once for every swimStroke metres, never slower than a tread
  const s = make({ world: { sea: R + 6 }, alt: 4.75, g: 9.81 });
  run(s, 3, { wish: V() });
  assert.ok(!s.st.grounded && s.st.phys.swim === 1 && s.st.phys.arc === 0 && s.st.phys.airTime === 0, 'afloat: swimming, not in an arc');
  assert.ok(Math.abs(s.st.phys.strokeRate - 1 / T.treadTime) < 1e-9 && s.st.phys.swimSpeed < 0.05, `treading water: ${s.st.phys.strokeRate} cycles a second`);
  let turns = 0, prev = s.st.phys.stroke, x0 = null, x1 = 0;
  run(s, 8, { wish: V(7.4, 0, 0) }, { each: (t, st) => { const p = st.phys.stroke; if (t > 3) { if (x0 == null) x0 = st.p.x; x1 = st.p.x; turns += p >= prev ? p - prev : p + 1 - prev; } prev = p; assert.ok(p >= 0 && p < 1); } });
  const v = s.st.phys.swimSpeed;
  assert.ok(v > 1 && v < 3 && Math.abs(s.st.phys.strokeRate - v / T.swimStroke) < 1e-9, `swimming at ${v} m/s: ${s.st.phys.strokeRate} strokes a second`);
  assert.ok(Math.abs((x1 - x0) / turns - T.swimStroke) < 0.1, `${((x1 - x0) / turns).toFixed(2)} m a stroke`);
  // wading is not swimming
  const wd = make({ world: { sea: R + 0.6 } }); run(wd, 3, { wish: V(4.2, 0, 0) });
  assert.ok(wd.st.grounded && wd.st.phys.swim === 0 && wd.st.phys.strokeRate === 0 && wd.st.phys.submerged01 > 0.2, 'wading: feet down, no stroke');
  // output only: the same run with the figure's state wiped at every step goes the same way to the last digit
  const a = make({ wind: V(9, 0, 4) }), b = make({ wind: V(9, 0, 4) });
  const cmd = (t) => ({ wish: V(7.4 * Math.cos(t), 0, 7.4 * Math.sin(t)), jump: Math.abs(t - 2) < 0.02 });
  for (let i = 0; i < 300; i++) {
    stepExplorerBody(a.st, cmd(i / 60), 1 / 60, a.env); stepExplorerBody(b.st, cmd(i / 60), 1 / 60, b.env);
    const P = b.st.phys; P.leanV.x = 9; P.relWind.z = -7; P.stroke = 0.5; P.vUp = 3; P.airTime = 9; P.arc = 1; P.swim = 1; P.strokeRate = 2; P.swimSpeed = 5; P.relWindSpeed = 1;
  }
  assert.deepEqual([a.st.p, a.st.v], [b.st.p, b.st.v]);
});

// ---- (M4) short steps: a slope the soles hold only with their footholds ------------------------------------------
test('M4 short steps: a slope the soles hold only with their footholds (wet leaves, wet grass) and a soft slope they do hold (dry sand) are walked up, never stood on with the key down (60 and 30 Hz)', async () => {
  // PILOT's critique of PHYSICS, item 2: in the rain W held up 23 to 26 degrees of leaf litter left the figure standing
  // (0.07 to 0.2 m/s for 4 to 6 s). Two causes: the ground's drag (the work of pressing a footprint) was counted as a
  // load the soles must hold, so a walk up a slope near their limit "slid" at every stride, friction against it; and
  // nothing held the pace to what the footholds serve. On dry sand (drag 0.28) the same stood a walker on any dune
  // face from 22 to 36 degrees.
  const { groundAt } = await import('./ground.js');
  const gr = (biome, slope, wet) => groundAt('earth', { radius: R, slope, liquidRadius: 0, biomeId: biome, biomeWeights: { [biome]: 1 } }, { wetness01: wet, snowDepth: 0, temperature: 288 }, {});
  const climb = (biome, wet, deg, hz, wish = 4.2, way = -1) => {
    const a = deg * Math.PI / 180, H = 400, rad = H / Math.tan(a), x0 = (way < 0 ? 0.75 : 0.35) * rad;
    const sim = make({ world: { cone: { dir: norm(V(0, 0, 1)), radius: rad, height: H } }, dir: V(Math.sin(x0 / R), 0, Math.cos(x0 / R)), g: 9.81, ground: gr(biome, a, wet) });
    let sum = 0, n = 0, slip = 0, worst = 99, last = { ...sim.st.p }, k = 0;
    run(sim, 9, { wish: V(way * wish, 0, 0), assistAccel: 4 }, { hz, each: (t, st) => {
      if (t > 3) { sum += speed(st); n++; if (st.phys.slip01 > 0) slip++; }
      if (++k % hz === 0) { const m = len(V(st.p.x - last.x, st.p.y - last.y, st.p.z - last.z)); if (k > hz) worst = Math.min(worst, m); last = { ...st.p }; }
    } });
    assert.ok(finite(sim.st), `${biome} ${deg}: NaN`);
    return { mean: sum / n, worst, slip: slip / n, hold: sim.st.phys.paceHold };
  };
  for (const hz of [60, 30]) {
    // wet leaves over soil: the soles hold to 19.8 degrees at a run, to about 25 with their footholds
    let prev = 9;
    for (const deg of [16, 20, 22, 24]) {
      const c = climb('temperate_forest', 1, deg, hz);
      assert.ok(c.worst > 1.5, `wet litter ${deg} degrees, ${hz} Hz: slowest second ${c.worst.toFixed(2)} m/s (head: 0.78, 0.37, 0.17 at 20, 22, 24)`);
      assert.ok(c.mean <= prev + 0.05, `wet litter: no faster on steeper ground (${deg}: ${c.mean.toFixed(2)} after ${prev.toFixed(2)})`);
      assert.ok(c.slip < 0.05, `wet litter ${deg} degrees: the feet hold (slipping ${c.slip.toFixed(2)} of the steps)`);
      prev = c.mean;
    }
    assert.ok(prev > 1.8 && prev < 3.2, `wet litter at 24 degrees: short steps (${prev.toFixed(2)} m/s)`);
    assert.ok(climb('temperate_forest', 1, 12, hz).hold > 1e8, 'no limit where the soles hold at a run');
    for (const deg of [22, 24, 26]) { const c = climb('alpine_meadow', 1, deg, hz); assert.ok(c.worst > 1.5 && c.slip < 0.05, `wet grass ${deg} degrees, ${hz} Hz: ${c.worst.toFixed(2)} m/s, slipping ${c.slip.toFixed(2)}`); }
    // a dune's face: the soles hold it (0.60 to 31 degrees); pressing footprints is the legs' work
    for (const deg of [22, 26, 30]) { const c = climb('desert_canyon', 0, deg, hz); assert.ok(c.worst > 2.5 && c.slip < 0.05, `dry sand ${deg} degrees, ${hz} Hz: ${c.worst.toFixed(2)} m/s (head: 0.6 to 0.1), slipping ${c.slip.toFixed(2)}`); }
    // down the same wet bank: the same short steps, no runaway
    const d = climb('temperate_forest', 1, 24, hz, 4.2, 1);
    assert.ok(d.mean > 1.5 && d.mean < 3.4 && d.slip < 0.05, `down 24 degrees of wet litter: ${d.mean.toFixed(2)} m/s, slipping ${d.slip.toFixed(2)}`);
    // wet and level: the walk's own pace, no limit
    const lv = make({ g: 9.81, ground: gr('temperate_forest', 0, 1) }); run(lv, 4, { wish: V(4.2, 0, 0), assistAccel: 4 }, { hz });
    assert.ok(Math.abs(speed(lv.st) - 4.2) < 0.1 && lv.st.phys.paceHold > 1e8, `wet and level: ${speed(lv.st).toFixed(2)} m/s`);
  }
});

test('M4 on PAINTER\'s real Earth, soaked: W from the spawn on sixteen headings for 14 s is never under 1 m/s for a second on dry land under 30 degrees (the bank under the wood east of the first view)', async () => {
  let real;
  try { real = await import('../world/surface.js'); } catch (e) { console.log('# (skipped: src/world/surface.js did not load in Node: ' + e.message + ')'); return; }
  if (typeof real.sampleSurfacePure !== 'function' || typeof real.getSurface !== 'function') { console.log('# (skipped: sampleSurfacePure / getSurface not exported)'); return; }
  const { groundAt } = await import('./ground.js');
  const sampleSurface = (id, d) => real.sampleSurfacePure(id, d.x, d.y, d.z);
  const d0 = norm(real.getSurface('earth').getSpawn()), hz = 30;
  const cr = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  // (the surface as PILOT's Sim hands it to the explorer: plain numbers, a copy; the ground soaked, as 100 s into the first storm)
  const sample = (d) => { const s = sampleSurface('earth', d); return { radius: s.radius, normal: { x: s.normal.x, y: s.normal.y, z: s.normal.z }, slope: s.slope || 0, liquidRadius: s.liquidRadius || 0, biomeId: s.biomeId, biomeWeights: s.biomeWeights }; };
  const WET = { wetness01: 0.99, snowDepth: 0, temperature: 290 };
  let stalled = 0, total = 0; const rows = [];
  for (let heading = 0; heading < 360; heading += 22.5) {
    const env = { sample, gravity: 9.81, air: (p, o) => { o.density = 1.2; o.wind.x = 0; o.wind.y = 0; o.wind.z = 0; return o; }, ground: (su, o) => groundAt('earth', su, WET, o) };
    const r0 = sample(d0).radius, st = { p: V(d0.x * r0, d0.y * r0, d0.z * r0), v: V(), grounded: true };
    let slow = 0, worst = 99, k = 0, last = { ...st.p }, steepest = 0, land = true, under30 = true;
    for (let i = 0; i < hz * 14; i++) {
      const up = norm(st.p), east = norm(cr(V(0, 1, 0), up)), north = cr(up, east), a = heading * Math.PI / 180;
      const f = V(north.x * Math.cos(a) + east.x * Math.sin(a), north.y * Math.cos(a) + east.y * Math.sin(a), north.z * Math.cos(a) + east.z * Math.sin(a));
      stepExplorerBody(st, { wish: V(f.x * 4.2, f.y * 4.2, f.z * 4.2), assistAccel: 4 }, 1 / hz, env);
      const s = sample(norm(st.p));
      if (s.liquidRadius > s.radius + 0.3) land = false;
      if (s.slope * 57.3 >= 30) under30 = false;
      if (++k % hz === 0) {
        const m = len(V(st.p.x - last.x, st.p.y - last.y, st.p.z - last.z));
        if (k > hz && land && under30) { worst = Math.min(worst, m); if (m < 1) { slow++; steepest = Math.max(steepest, s.slope * 57.3); } }
        last = { ...st.p }; land = true; under30 = true;
      }
      assert.ok(finite(st), `heading ${heading}: NaN`);
    }
    total += len(V(st.p.x - d0.x * r0, st.p.y - d0.y * r0, st.p.z - d0.z * r0));
    if (slow > 0) { stalled++; rows.push(`h${heading}: ${slow} s under 1 m/s on up to ${steepest.toFixed(0)} degrees (slowest ${worst.toFixed(2)} m/s)`); }
  }
  console.log(`# M4 Earth spawn, soaked, W on sixteen headings for 14 s: ${total.toFixed(0)} m in all; ${stalled} headings with a second under 1 m/s on dry land under 30 degrees${rows.length ? ': ' + rows.join('; ') : ''}`);
  assert.equal(stalled, 0, rows.join('; '));
});

// ---- (M4) the gust, not the sample ----------------------------------------------------------------------------------
test('M4 the gust, not the sample: in a squall whose wind at the walker goes 77, 61, 52, 69, 25, 12, 24, 15, 49, 108, 77 m/s in a second, the figure is handed a lean, a crouch and an air past the body that hold through the gust; the body\'s own forces are the instant\'s', () => {
  // PAINTER's critique of PHYSICS, item 5 (the numbers are its own, from Neptune's storm coast): "a sixfold change inside
  // half a second is noise, and noise cannot be painted ... crouch with the lean, and hold the crouch through the gust".
  const seq = [77, 61, 52, 69, 25, 12, 24, 15, 49, 108, 77], D = 180 / Math.PI;
  const mk = () => {
    const sim = make({ g: 11.15, rho: 0.92 }); let t = 0;
    sim.env.air = (p, o) => { const i = t * 10, a = Math.floor(i) % seq.length, b = (a + 1) % seq.length, f = i - Math.floor(i), W = seq[a] + (seq[b] - seq[a]) * f, ang = 0.5 * Math.sin(t * 4.1); o.density = 0.92; o.wind.x = W * Math.cos(ang); o.wind.y = W * Math.sin(ang); o.wind.z = 0; return o; };      // (the body stands at +z: x and y are level)
    sim.tick = (dt) => { t += dt; };
    return sim;
  };
  const sim = mk(); let leanJump = 0, turn = 0, airJump = 0, hkDrop = 0, nowDrop = 0, leanLo = 9, leanHi = 0, prev = null, k = 0; const hk = [], hn = [];
  run(sim, 14, { wish: V() }, { each: (t, st) => {
    sim.tick(1 / 60); const B = st.phys;
    if (t < 4 || ++k % 6) return;                       // every tenth of a second, once the gale has blown a while
    const L = B.leanV, l = len(L) * D;
    leanLo = Math.min(leanLo, l); leanHi = Math.max(leanHi, l); hk.push(B.hunker01); hn.push(B.hunkerNow);
    if (prev) {
      leanJump = Math.max(leanJump, Math.abs(l - prev.l)); airJump = Math.max(airJump, Math.abs(B.relWindSpeed - prev.rw));
      const c = (L.x * prev.x + L.y * prev.y + L.z * prev.z) / Math.max(1e-9, len(L) * Math.hypot(prev.x, prev.y, prev.z)); turn = Math.max(turn, Math.acos(Math.min(1, c)) * D);
    }
    prev = { l, rw: B.relWindSpeed, x: L.x, y: L.y, z: L.z };
  } });
  for (let i = 5; i < hk.length; i++) { hkDrop = Math.max(hkDrop, hk[i - 5] - hk[i]); nowDrop = Math.max(nowDrop, hn[i - 5] - hn[i]); }
  console.log(`# M4 the figure in the squall: lean ${leanLo.toFixed(1)} to ${leanHi.toFixed(1)} deg, ${leanJump.toFixed(2)} deg in a tenth of a second at most, turning ${turn.toFixed(1)} deg; the air past it changing ${airJump.toFixed(1)} m/s in a tenth; the drawn crouch ${Math.min(...hk).toFixed(2)} to ${Math.max(...hk).toFixed(2)}, falling ${hkDrop.toFixed(2)} in half a second at most (the body's own: ${Math.min(...hn).toFixed(2)} to ${Math.max(...hn).toFixed(2)}, ${nowDrop.toFixed(2)})`);
  assert.ok(leanLo > 5 && leanHi < 4 * leanLo, `the lean holds: ${leanLo.toFixed(1)} to ${leanHi.toFixed(1)} deg (the head: 2 to 54)`);
  assert.ok(leanJump < 3 && turn < 10, `and does not jump: ${leanJump.toFixed(2)} deg and a turn of ${turn.toFixed(1)} deg in a tenth of a second (the head: 20 and more)`);
  assert.ok(airJump < 6, `the air past the body: ${airJump.toFixed(1)} m/s in a tenth of a second (the sample: up to 59)`);
  assert.ok(Math.min(...hk) > 0.6 && hkDrop < 0.12, `the crouch is held through the lull: ${Math.min(...hk).toFixed(2)} at its least, ${hkDrop.toFixed(2)} lost in half a second`);
  assert.ok(Math.min(...hk) >= Math.min(...hn) - 1e-9 && hk.every((v, i) => v >= hn[i] - 1e-9), 'never less than the body\'s own crouch');
  // the body is not carried off, and it goes exactly as it would with the figure's state thrown away at every step
  assert.ok(Math.hypot(sim.st.p.x, sim.st.p.y) < 3 && sim.st.grounded, 'braced: it stands');
  const a = mk(), b = mk();
  run(a, 6, { wish: V(3, 0, 0) }, { each: () => a.tick(1 / 60) });
  run(b, 6, { wish: V(3, 0, 0) }, { each: (t, st) => { b.tick(1 / 60); const B = st.phys; B.leanV = { x: 9, y: 9, z: 9 }; B.relWind = { x: 1, y: 2, z: 3 }; B.windE = { x: 5, y: 5, z: 5 }; B.hunker01 = 0.123; } });
  assert.ok(a.st.p.x === b.st.p.x && a.st.p.y === b.st.p.y && a.st.v.x === b.st.v.x, 'output only: no step reads it');
  // when the wind drops for good the figure straightens: upright again within ten seconds
  const c = mk(); run(c, 6, { wish: V() }, { each: () => c.tick(1 / 60) });
  c.env.air = (p, o) => { o.density = 0.92; o.wind.x = 3; o.wind.y = 0; o.wind.z = 0; return o; };
  run(c, 10, { wish: V() });
  assert.ok(c.st.phys.hunker01 < 0.05 && len(c.st.phys.leanV) * D < 1, `the wind gone: crouch ${c.st.phys.hunker01.toFixed(3)}, lean ${(len(c.st.phys.leanV) * D).toFixed(2)} deg`);
});
