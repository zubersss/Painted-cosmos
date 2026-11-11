// Tests: dust, sand, hail, leaves, spores, ash, spray; dust devils; other planets' weather.
// Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { cellsAt, weatherAt, weatherWind, saltationThreshold, DEFAULT_SEED, REGIMES } from './weather.js';
import { setWindScale, WINDS } from './wind.js';
import { devilsNear, devilWind, makeDevil, DEVILS } from './features.js';
import { LocalFrame } from './near.js';
import { EVENT } from './particles.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm, len, dot } from './testworld.mjs';

function setup(bodyId, biome, { sea = 0, dir = V(0.31, 0.56, 0.77), alt = 0, seed } = {}) {
  const R = BODIES[bodyId].radius + alt;
  const sample = makeWorld({ R, biome, sea: sea ? R + sea : 0 });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), seed, timeBudget: false });
  const d = norm(dir);
  return { physics, bodyId, R, focus: V(d.x * R, d.y * R, d.z * R), t: 300, up: d };
}
function run(w, seconds, { disturbers, each, hz = 60, sunDir } = {}) {
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    w.t += 1 / hz;
    w.physics.update(1 / hz, { bodyId: w.bodyId, time: w.t, focus: w.focus, sunDir: sunDir === undefined ? w.up : sunDir, disturbers: disturbers ? disturbers(w.t) : undefined });
    if (each) each(w.t);
  }
}
// walk the focus east at `speed` with an explorer disturber
function walk(w, seconds, speed, extra) {
  const fr = w.physics.fields.frame;
  const v = V(fr.ex * speed, fr.ey * speed, fr.ez * speed);
  run(w, seconds, { disturbers: () => {
    w.focus = V(w.focus.x + v.x / 60, w.focus.y + v.y / 60, w.focus.z + v.z / 60); const l = len(w.focus); w.focus = V(w.focus.x * w.R / l, w.focus.y * w.R / l, w.focus.z * w.R / l);
    return [{ kind: 'explorer', p: w.focus, v, radius: 0.35, strength: 1, grounded: true }];
  }, ...extra });
}
const heights = (w, b) => { const out = []; for (let i = 0; i < b.count; i++) out.push(len(V(b.origin.x + b.pos[i * 3], b.origin.y + b.pos[i * 3 + 1], b.origin.z + b.pos[i * 3 + 2])) - w.R); return out; };
const finiteBuf = (b) => { for (let i = 0; i < b.count * 3; i++) if (!Number.isFinite(b.pos[i]) || !Number.isFinite(b.vel[i])) return false; return true; };

test('vacuum: kicked dust flies in clean parabolas and is down again within two seconds', () => {
  const w = setup('moon', 'mare');
  run(w, 1);
  walk(w, 3, 4);
  const P = w.physics.particles;
  assert.ok(P.dust.count > 5, 'dust raised: ' + P.dust.count);
  // no drag: every grain's acceleration is gravity alone, and its horizontal velocity does not change
  const snap = () => { const o = []; for (let i = 0; i < P.dust.count; i++) o.push([P.dust.vel[i * 3], P.dust.vel[i * 3 + 1], P.dust.vel[i * 3 + 2], P.dust.age[i]]); return o; };
  run(w, 1 / 60);                     // let the last emissions settle into the buffer
  const a = snap(); run(w, 1 / 60); const b = snap();
  let checked = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Math.abs(b[i][3] - a[i][3] - 1 / 60) > 1e-4) continue;       // slot was reused
    const dv = V(b[i][0] - a[i][0], b[i][1] - a[i][1], b[i][2] - a[i][2]);
    const g = BODIES.moon.gravity / 60;
    assert.ok(Math.abs(dot(dv, w.up) + g) < 0.02 * g + 1e-4, 'vertical: gravity only');
    assert.ok(len(V(dv.x + w.up.x * g, dv.y + w.up.y * g, dv.z + w.up.z * g)) < 2e-3, 'horizontal: untouched');
    checked++;
  }
  assert.ok(checked > 3);
  const hs = heights(w, P.dust);
  assert.ok(Math.max(...hs) < 2.5 && Math.min(...hs) > -0.2, 'low arcs: ' + Math.max(...hs));
  run(w, 2.5);
  assert.equal(P.dust.count, 0, 'no cloud is left hanging in a vacuum');
  assert.equal(P.sand.count, 0);
});

test('air: kicked dust hangs and drifts with the wind; wet ground and rock raise none', () => {
  const w = setup('earth', 'desert_canyon');
  run(w, 1); walk(w, 3, 4);
  const P = w.physics.particles;
  assert.ok(P.dust.count > 5 && P.sand.count > 0, `dust ${P.dust.count}, sand ${P.sand.count}`);
  run(w, 2.5);
  assert.ok(P.dust.count > 3, 'still hanging after 2.5 s: ' + P.dust.count);
  assert.ok(P.sand.count < 3, 'the coarse grains have fallen back');
  let fall = 0; for (let i = 0; i < P.dust.count; i++) fall += -dot(V(P.dust.vel[i * 3], P.dust.vel[i * 3 + 1], P.dust.vel[i * 3 + 2]), w.up);
  assert.ok(Math.abs(fall / P.dust.count) < 0.8, 'dust barely falls: ' + fall / P.dust.count);
  assert.ok(finiteBuf(P.dust) && finiteBuf(P.sand));
  // hard smooth ground has nothing to raise
  const rock = setup('mercury', 'obsidian_fields'); run(rock, 1); walk(rock, 3, 4);
  assert.equal(rock.physics.particles.dust.count, 0, 'volcanic glass: ' + rock.physics.particles.dust.count);
  // rain has soaked the sand: find a rainy place and walk there
  let wet = null;
  for (let t = 0; t < 6000 && !wet; t += 53) for (const c of cellsAt('earth', t)) { const x = weatherAt('earth', c.x, c.y, c.z, 0, t, DEFAULT_SEED, { moist: 1 }, {}); if (x.precipitation.rate > 8) { wet = setup('earth', 'sea_coast', { dir: c }); wet.t = t; break; } }
  run(wet, 20); walk(wet, 3, 4);
  assert.ok(wet.physics.here.weather.wetness01 > 0.4);
  assert.equal(wet.physics.particles.dust.count, 0, 'no dust from wet ground');
});

test('saltation: above the threshold wind, sand hops along the ground in low arcs', () => {
  const calm = setup('earth', 'desert_canyon'); run(calm, 6);
  const u = calm.physics.here.air.speed;
  assert.ok(u < saltationThreshold('earth', 1.2) * 0.6, 'the test place is not windy to begin with: ' + u);
  assert.equal(calm.physics.particles.sand.count, 0);
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.22);                       // a 25 m/s sand-storm wind
    const w = setup('earth', 'desert_canyon'); run(w, 6);
    const P = w.physics.particles;
    assert.ok(P.sand.count > 80, 'sand in motion: ' + P.sand.count);
    const hs = heights(w, P.sand).sort((a, b) => a - b);
    assert.ok(hs[Math.floor(hs.length * 0.9)] < 1.2, '90 % of the grains are within ' + hs[Math.floor(hs.length * 0.9)].toFixed(2) + ' m of the ground');
    // the streamers run downwind
    const air = w.physics.here.air; let along = 0;
    for (let i = 0; i < P.sand.count; i++) along += (P.sand.vel[i * 3] * air.wind.x + P.sand.vel[i * 3 + 1] * air.wind.y + P.sand.vel[i * 3 + 2] * air.wind.z) / air.speed;
    assert.ok(along / P.sand.count > 0.5, 'mean downwind speed of the grains ' + along / P.sand.count);
    assert.ok(P.dust.count > 10, 'and fines are lifted as dust: ' + P.dust.count);
    // grass does not saltate
    const g = setup('earth', 'alpine_meadow'); run(g, 5);
    assert.equal(g.physics.particles.sand.count, 0);
  } finally { setWindScale('earth', s0); }
});

test('Mars: a dust storm keeps sand hopping in winds far below the fluid threshold (impact threshold)', () => {
  let hit = null;
  for (let t = 0; t < 9000 && !hit; t += 41) for (const c of cellsAt('mars', t)) if (c.kindId === 'dust' && c.w > 0.8) { hit = { t, c }; break; }
  assert.ok(hit, 'found a dust storm');
  const w = setup('mars', 'dust_dunes', { dir: hit.c }); w.t = hit.t;
  run(w, 8);
  const wx = w.physics.here.weather, air = w.physics.here.air;
  assert.equal(wx.kind, 'dust storm');
  assert.ok(wx.visibility01 < 0.35, 'visibility ' + wx.visibility01);
  assert.ok(air.speed < saltationThreshold('mars', air.density) * 0.8, `wind ${air.speed} is below the fluid threshold ${saltationThreshold('mars', air.density)}`);
  const P = w.physics.particles;
  assert.ok(P.sand.count > 30, 'sand hopping: ' + P.sand.count);
  assert.ok(P.dust.count > 100, 'dust in the air: ' + P.dust.count);
  // Martian hops are long and high: weak gravity, thin air
  const hs = heights(w, P.sand);
  assert.ok(Math.max(...hs) > 0.15, 'highest hop ' + Math.max(...hs));
  assert.equal(P.rain.count + P.snow.count, 0, 'nothing wet falls on Mars');
});

test('hail: falls fast in a storm core and bounces', () => {
  let hit = null;
  for (let t = 0; t < 9000 && !hit; t += 31) for (const c of cellsAt('earth', t)) { const x = weatherAt('earth', c.x, c.y, c.z, 0, t, DEFAULT_SEED, { moist: 1 }, {}); if (x.precipitation.hail01 > 0.3) { hit = { t, c }; break; } }
  assert.ok(hit, 'found hail');
  const w = setup('earth', 'alpine_meadow', { dir: hit.c }); w.t = hit.t;
  run(w, 6);
  const P = w.physics.particles;
  assert.ok(P.hail.count > 5, 'hailstones: ' + P.hail.count);
  let fast = 0; for (let i = 0; i < P.hail.count; i++) if (-dot(V(P.hail.vel[i * 3], P.hail.vel[i * 3 + 1], P.hail.vel[i * 3 + 2]), w.up) > 8) fast++;
  assert.ok(fast > 0, 'falling at over 8 m/s');
  let bounces = 0; const E = P.events; for (let k = 0; k < Math.min(E.total, E.capacity); k++) if (E.data[k * 8 + 3] === EVENT.bounce) bounces++;
  assert.ok(bounces > 0, 'bounce events');
});

test('each biome has its own drift: leaves in the autumn wood, spores among the fungal towers, ash by the lava', () => {
  const count = (bodyId, biome, kind) => { const w = setup(bodyId, biome); run(w, 25); return { n: w.physics.particles[kind].count, w }; };
  const leaves = count('earth', 'autumn_woodland', 'leaves');
  assert.ok(leaves.n > 4, 'leaves falling: ' + leaves.n);
  let fall = 0; const L = leaves.w.physics.particles.leaves;
  for (let i = 0; i < L.count; i++) fall += -dot(V(L.vel[i * 3], L.vel[i * 3 + 1], L.vel[i * 3 + 2]), leaves.w.up);
  assert.ok(fall / L.count > 0.6 && fall / L.count < 2.6, 'a leaf falls at about ' + (fall / L.count).toFixed(2) + ' m/s');
  assert.equal(count('earth', 'desert_canyon', 'leaves').n, 0);
  assert.ok(count('venus', 'fungal_towers', 'spores').n > 20);
  assert.ok(count('venus', 'lava_rivers', 'ash').n > 20);
  assert.equal(count('moon', 'mare', 'spores').n, 0, 'nothing drifts without air');
});

test('jets scour loose ground: a ring of dust in air, a fast flat sheet in vacuum, spray over water', () => {
  const blast = (bodyId, biome, opts) => {
    const w = setup(bodyId, biome, opts); run(w, 1);
    const up = w.up, p = V(w.focus.x + up.x * 2, w.focus.y + up.y * 2, w.focus.z + up.z * 2);
    run(w, 1.2, { disturbers: () => [{ kind: 'jet', p, v: V(), radius: 0.15, strength: 1700 }] });
    return w;
  };
  const e = blast('earth', 'desert_canyon'), Pe = e.physics.particles;
  assert.ok(Pe.dust.count + Pe.sand.count > 30, 'earth: ' + (Pe.dust.count + Pe.sand.count));
  // outward: velocity points away from the jet's foot
  let out = 0, n = 0;
  for (let i = 0; i < Pe.dust.count; i++) { const rel = V(Pe.dust.origin.x + Pe.dust.pos[i * 3] - e.focus.x, Pe.dust.origin.y + Pe.dust.pos[i * 3 + 1] - e.focus.y, Pe.dust.origin.z + Pe.dust.pos[i * 3 + 2] - e.focus.z); const hgt = dot(rel, e.up); const hr = V(rel.x - e.up.x * hgt, rel.y - e.up.y * hgt, rel.z - e.up.z * hgt); if (len(hr) < 0.3 || Pe.dust.age[i] > 0.3) continue; out += dot(norm(hr), V(Pe.dust.vel[i * 3], Pe.dust.vel[i * 3 + 1], Pe.dust.vel[i * 3 + 2])); n++; }
  assert.ok(n > 3 && out / n > 1, 'young grains fly outward at ' + (out / n).toFixed(1) + ' m/s');
  const m = blast('moon', 'mare'), Pm = m.physics.particles;
  assert.ok(Pm.dust.count > 30);
  const hm = heights(m, Pm.dust);
  assert.ok(Math.max(...hm) < 6, 'a flat sheet on the Moon: highest grain ' + Math.max(...hm).toFixed(1) + ' m');
  run(m, 6);
  assert.equal(Pm.dust.count, 0, 'and it has all landed');
  const s = blast('earth', 'sea_coast', { sea: 0.5 }), Ps = s.physics.particles;
  assert.ok(Ps.spray.count > 20 && Ps.dust.count === 0, `spray ${Ps.spray.count}, dust ${Ps.dust.count}`);
  let rip = 0; const E = Ps.events; for (let k = 0; k < Math.min(E.total, E.capacity); k++) if (E.data[k * 8 + 3] === EVENT.ripple) rip++;
  assert.ok(rip > 0, 'ripples on the water');
  // from 80 m up the jet has spread too thin to move anything
  const hi = setup('earth', 'desert_canyon'); run(hi, 1);
  const ph = V(hi.focus.x + hi.up.x * 80, hi.focus.y + hi.up.y * 80, hi.focus.z + hi.up.z * 80);
  run(hi, 1, { disturbers: () => [{ kind: 'jet', p: ph, v: V(), radius: 0.15, strength: 1700 }] });
  assert.equal(hi.physics.particles.dust.count, 0);
});

test('wading throws spray and leaves rings; snow kicks up as powder', () => {
  const w = setup('earth', 'sea_coast', { sea: 0.4 }); run(w, 1); walk(w, 3, 2.5);
  const P = w.physics.particles;
  assert.ok(P.spray.count > 3, 'spray: ' + P.spray.count);
  let rip = 0; const E = P.events; for (let k = 0; k < Math.min(E.total, E.capacity); k++) if (E.data[k * 8 + 3] === EVENT.ripple) rip++;
  assert.ok(rip >= 3, 'rings: ' + rip);
  const s = setup('earth', 'stub-polar'); run(s, 1);
  assert.ok(s.physics.here.weather.snowDepth > 0.1);
  walk(s, 3, 4);
  let most = 0;
  walk(s, 2, 4, { each: () => { most = Math.max(most, s.physics.particles.snow.count); } });
  assert.ok(most > 4, 'powder in the air at once: ' + most);
  assert.equal(s.physics.particles.dust.count, 0);
});

test('dust devils: deterministic, continuous, only on dusty sunlit ground in light wind', () => {
  const frame = new LocalFrame();
  const p = V(0.31 * 3000, 0.56 * 3000, 0.77 * 3000), l = len(p), q = V(p.x * 3000 / l, p.y * 3000 / l, p.z * 3000 / l);
  frame.anchor('mars', q.x, q.y, q.z);
  const env = { dustSource: 1, sun01: 0.8, wind: 4, storm01: 0, we: 3, wn: 1, rho: 0.02 };
  const at = (t, e = env, body = 'mars') => { const o = []; o.count = 0; devilsNear(body, q.x, q.y, q.z, t, 14, e, frame, o); return o; };
  let seen = 0, worstMove = 0, worstStrength = 0, prev = new Map();
  for (let t = 0; t < 1500; t += 0.25) {
    const d = at(t);
    assert.equal(JSON.stringify(Array.from({ length: d.count }, (_, i) => [d[i].id, d[i].x])), JSON.stringify(Array.from({ length: at(t).count }, (_, i) => [at(t)[i].id, at(t)[i].x])));
    const now = new Map();
    for (let i = 0; i < d.count; i++) {
      const D = d[i]; seen++;
      assert.ok(D.radius > 2 && D.height > 30 && D.speed >= 7 && Math.abs(D.spin) === 1 && D.strength > 0 && D.strength <= 1);
      const pr = prev.get(D.id);
      if (pr) { worstMove = Math.max(worstMove, Math.hypot(D.x - pr.x, D.z - pr.z)); worstStrength = Math.max(worstStrength, Math.abs(D.strength - pr.s)); }
      else if (t > 0) assert.ok(D.strength < 0.2, 'a devil fades in: ' + D.strength);
      now.set(D.id, { x: D.x, z: D.z, s: D.strength });
    }
    prev = now;
  }
  assert.ok(seen > 150, 'devils near this spot over 25 minutes: ' + seen + ' quarter-seconds');
  assert.ok(worstMove < 2.5, 'moves at most ' + worstMove.toFixed(2) + ' m in a quarter second');
  assert.ok(worstStrength < 0.08);
  for (const e of [{ ...env, sun01: -0.2 }, { ...env, dustSource: 0 }, { ...env, wind: 15 }, { ...env, storm01: 0.8 }, { ...env, rho: 0 }]) {
    let n = 0; for (let t = 0; t < 1500; t += 5) n += at(t, e).count;
    assert.equal(n, 0, JSON.stringify(e));
  }
  let n = 0; for (let t = 0; t < 1500; t += 5) n += at(t, env, 'venus').count + at(t, { ...env, rho: 0 }, 'moon').count;
  assert.equal(n, 0, 'none on Venus or the Moon');
  // bigger on Mars than on Earth
  assert.ok(DEVILS.scale.mars > DEVILS.scale.earth);
});

test('a dust devil is a Rankine vortex: solid rotation in the core, 1/r outside, inflow and updraught', () => {
  const D = makeDevil(); Object.assign(D, { x: 0, z: 0, radius: 6, height: 100, speed: 15, up: 6, spin: 1, strength: 1 });
  const list = [D]; list.count = 1; const o = new Float64Array(3);
  const at = (r) => { devilWind(list, r, 0, 2, o); return { tan: o[1], rad: o[0], up: o[2] }; };
  assert.ok(Math.abs(at(3).tan - 7.5) < 1e-9 && Math.abs(at(6).tan - 15) < 1e-9 && Math.abs(at(12).tan - 7.5) < 1e-9);
  assert.ok(at(6).rad < -4, 'inflow at the foot'); assert.ok(at(3).up === 6 && at(30).up === 0);
  assert.equal(devilWind(list, 200, 0, 2, o), false);
  assert.equal(devilWind(list, 3, 0, 150, o), false, 'nothing above its top');
  D.spin = -1; assert.ok(at(6).tan < 0);
});

test('in the game loop: a devil on Mars swirls the air, lifts a helix of dust, and is reported', () => {
  // wait for a devil in its prime somewhere near, then walk over to stand beside it
  const w = setup('mars', 'dust_dunes'); run(w, 2);
  let found = null;
  for (let k = 0; k < 9000 && !found; k++) {
    w.t += 0.5; w.physics.update(0, { bodyId: 'mars', time: w.t, focus: w.focus, sunDir: w.up });
    const F = w.physics.features.devils;
    for (let i = 0; i < F.count; i++) if (F[i].strength > 0.95 && F[i].life - F[i].age > 40) found = F[i];
  }
  assert.ok(found, 'a devil is about');
  { const l = len(found.p); w.focus = V(found.p.x * w.R / l + w.physics.fields.frame.ex * 15, found.p.y * w.R / l + w.physics.fields.frame.ey * 15, found.p.z * w.R / l + w.physics.fields.frame.ez * 15); const l2 = len(w.focus); w.focus = V(w.focus.x * w.R / l2, w.focus.y * w.R / l2, w.focus.z * w.R / l2); }
  found = { id: found.id };
  run(w, 4);
  const F = w.physics.features.devils; let D = null; for (let i = 0; i < F.count; i++) if (F[i].id === found.id) D = F[i];
  assert.ok(D, 'still there 4 s later');
  const fr = w.physics.fields.frame;
  // air just outside the core, east of it: the swirl is felt by physics.air
  const pt = V(D.p.x + fr.ex * D.radius, D.p.y + fr.ey * D.radius, D.p.z + fr.ez * D.radius), l = len(pt), on = V(pt.x * (w.R + 1) / l, pt.y * (w.R + 1) / l, pt.z * (w.R + 1) / l);
  const a = w.physics.air('mars', on, {}, 1);
  const tan = a.wind.x * fr.nx + a.wind.y * fr.ny + a.wind.z * fr.nz;
  assert.ok(Math.abs(tan) > D.speed * 0.5, `swirl ${tan.toFixed(1)} of ${D.speed.toFixed(1)} m/s`);
  const dust = w.physics.particles.dust;
  assert.ok(dust.count > 30, 'dust in the column: ' + dust.count);
  const hs = heights(w, dust);
  assert.ok(Math.max(...hs) > 3, 'lifted to ' + Math.max(...hs).toFixed(1) + ' m');
  assert.ok(finiteBuf(dust));
});

test('Venus: acid drizzle is virga on low ground (no drop lands) and reaches the mesas', () => {
  let hit = null;
  for (let t = 0; t < 9000 && !hit; t += 41) for (const c of cellsAt('venus', t)) if (c.kindId === 'acid' && c.w > 0.8) { hit = { t, c }; break; }
  assert.ok(hit);
  const low = setup('venus', 'acid_terraces', { dir: hit.c, alt: 20 }); low.t = hit.t; run(low, 25);
  assert.equal(low.physics.here.weather.kind, 'virga');
  assert.ok(low.physics.particles.rain.count > 3, 'drops are in the air: ' + low.physics.particles.rain.count);
  assert.equal(low.physics.particles.events.total, 0, 'and none of them reaches the ground');
  const mesa = setup('venus', 'pale_mesas', { dir: hit.c, alt: 280 }); mesa.t = hit.t; run(mesa, 40);
  assert.equal(mesa.physics.here.weather.kind, 'acid drizzle');
  assert.ok(mesa.physics.particles.events.total > 3, 'drops land on the mesa: ' + mesa.physics.particles.events.total);
  let fall = 0; const b = mesa.physics.particles.rain; for (let i = 0; i < b.count; i++) fall += -dot(V(b.vel[i * 3], b.vel[i * 3 + 1], b.vel[i * 3 + 2]), mesa.up);
  assert.ok(fall / b.count < 0.6, 'they drift down at ' + (fall / b.count).toFixed(2) + ' m/s through air a twentieth as dense as water');
});

test('Jupiter: storms are born on the jets and run along them; the Great Red Spot never dies and turns', () => {
  const jets = REGIMES.jupiter.tracks;
  let east = 0, west = 0, off = 0, n = 0;
  for (let t = 0; t < 6000; t += 97) for (const c of cellsAt('jupiter', t)) {
    if (c.life === Infinity) continue;
    const lat = Math.asin(c.y) * 180 / Math.PI, step = 180 / jets;
    const d = Math.abs(lat / step - Math.round(lat / step)) * step;
    if (d > 3.5) off++;
    if (c.ve > 2) east++; else if (c.ve < -2) west++;
    assert.equal(c.vn, 0, 'a storm on a jet stays on it');
    n++;
  }
  assert.ok(off / n < 0.02, `${off} of ${n} cells are off the jets`);
  assert.ok(east > n * 0.2 && west > n * 0.2, `eastward ${east}, westward ${west}: neighbouring jets run opposite ways`);
  for (const t of [0, 4000, 1e6]) {
    const spot = cellsAt('jupiter', t).filter((c) => c.life === Infinity);
    assert.equal(spot.length, 1);
    assert.ok(Math.abs(Math.asin(spot[0].y) * 180 / Math.PI + 22) < 1e-6 && spot[0].w > 0.7);
    const w = weatherAt('jupiter', spot[0].x, spot[0].y, spot[0].z, 0, t, DEFAULT_SEED, { moist: 1 }, {});
    assert.equal(w.kind, 'thunderstorm');
    // the wind circles: opposite directions on opposite sides of the centre
    const c = spot[0], R = BODIES.jupiter.radius, k = c.r * 0.7 / R, o = new Float64Array(5);
    let ex = c.z, ez = -c.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
    const nrt = V(c.y * ez, c.z * ex - c.x * ez, -c.y * ex);
    const side = (s) => { const p = norm(V(c.x + ex * k * s, c.y, c.z + ez * k * s)); weatherWind('jupiter', p.x, p.y, p.z, t, DEFAULT_SEED, o); return o[1] * nrt.x + o[2] * nrt.y + o[3] * nrt.z; };
    assert.ok(side(1) * side(-1) < 0 && Math.abs(side(1)) > 4, `swirl ${side(1).toFixed(1)} and ${side(-1).toFixed(1)} m/s`);
  }
  // Neptune's dark spot is the fastest storm in the game
  const speed = (id) => { const a = cellsAt(id, 0).find((c) => c.life === Infinity), b = cellsAt(id, 10).find((c) => c.life === Infinity); return BODIES[id].radius * Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / 10; };
  assert.ok(speed('neptune') > 8 * speed('jupiter'), `Neptune ${speed('neptune').toFixed(1)} m/s, Jupiter ${speed('jupiter').toFixed(1)} m/s`);
});

test('every body, every kind: nothing is NaN and the frame stays inside the budget with all emitters busy', () => {
  for (const [bodyId, biome] of [['earth', 'desert_canyon'], ['mars', 'dust_dunes'], ['moon', 'mare'], ['venus', 'lava_rivers'], ['neptune', 'aurora_tundra'], ['pluto', 'nitrogen_dunes'], ['mercury', 'ochre_basins']]) {
    const w = setup(bodyId, biome); run(w, 1);
    const up = w.up, fr = w.physics.fields.frame;
    const ms = [];
    for (let i = 0; i < 400; i++) {
      w.t += 1 / 60;
      const v = V(fr.ex * 5, fr.ey * 5, fr.ez * 5);
      w.focus = V(w.focus.x + v.x / 60, w.focus.y + v.y / 60, w.focus.z + v.z / 60); const l = len(w.focus); w.focus = V(w.focus.x * w.R / l, w.focus.y * w.R / l, w.focus.z * w.R / l);
      const hov = V(w.focus.x + up.x * 3, w.focus.y + up.y * 3, w.focus.z + up.z * 3);
      const t0 = performance.now();
      w.physics.update(1 / 60, { bodyId, time: w.t, focus: w.focus, sunDir: up, disturbers: [{ kind: 'explorer', p: w.focus, v, radius: 0.35, strength: 1, grounded: true, impact: i % 60 === 0 ? 5 : 0 }, { kind: 'jet', p: hov, v, radius: 0.15, strength: 1700 }, { kind: 'downwash', p: hov, v, radius: 2.4, strength: 12000 }] });
      if (i > 150) ms.push(performance.now() - t0);
    }
    for (const k of ['rain', 'snow', 'hail', 'dust', 'sand', 'ash', 'spores', 'leaves', 'spray']) assert.ok(finiteBuf(w.physics.particles[k]), bodyId + ' ' + k);
    ms.sort((a, b) => a - b);
    assert.ok(ms[Math.floor(ms.length / 2)] < 1.5, `${bodyId}: median frame ${ms[Math.floor(ms.length / 2)].toFixed(2)} ms with ${w.physics.stats.particles} particles`);
  }
});
