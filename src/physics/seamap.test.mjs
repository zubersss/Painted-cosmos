// P18: the sea map (seamap.js; water.js SEA_TEX, localAt, the map paths of surfaceAt, heightAt, runupAt; coast.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { coastWorld, norm, V, timing } from './testworld.mjs';
import { setWindScale, WINDS } from './wind.js';
import { BODIES } from '../data/bodies.js';
import { WATER_GLSL, WaterField, SEA_TEX, windSea, foamCover, WATER } from './water.js';
import { SEA_MAP } from './seamap.js';
import { coastReport } from './coast.mjs';
import { weatherWind } from './weather.js';
import { windLarge } from './wind.js';
import { liquidOf, airDensity } from './atmosphere.js';

const RE = BODIES.earth.radius, C = norm(V(0.6, 0.04, 0.8));
const deg = (a) => a * 180 / Math.PI;
const wrapD = (a) => ((a + 540) % 360) - 180;
// the wind's way at C at t = 300 s (upwind, frame axes = geographic at C), on an open sea
function upwindAtC() {
  const p = createPhysics({ sampleSurface: (id, q) => ({ radius: RE - 30, liquidRadius: RE, normal: q, slope: 0, biomeId: 'sea_coast', biomeWeights: { sea_coast: 1 } }), timeBudget: false });
  const P0 = V(C.x * (RE + 1.5), C.y * (RE + 1.5), C.z * (RE + 1.5));
  for (let i = 0; i < 30; i++) p.update(1 / 30, { bodyId: 'earth', time: 300 + i / 30, focus: P0 });
  return { up: Math.atan2(-p.fields.air.cwn, -p.fields.air.cwe), U: Math.hypot(p.fields.air.cwe, p.fields.air.cwn) };
}
function run(f, turn, focusUV, secs = 24, readMap = true) {
  const world = coastWorld(C, f, { R: RE, turn });
  const physics = createPhysics({ sampleSurface: (id, q) => world(q), timeBudget: false });
  // (as PAINTER's shader will once it is wired: reading the map moves the reference sea to the most exposed water)
  if (readMap) void physics.fields.water.uniforms.uPhysSeaMap;
  const fd = world.at(focusUV[0], focusUV[1]), fo = V(fd.x * (RE + 1.5), fd.y * (RE + 1.5), fd.z * (RE + 1.5));
  let ms = 0, worst = 0, msMax = 0;
  for (let i = 0; i < secs * 30; i++) {
    physics.update(1 / 30, { bodyId: 'earth', time: 300 + i / 30, focus: fo });
    if (i > 300) { ms += physics.stats.msFetch; msMax = Math.max(msMax, physics.stats.msFetch); }
    worst = Math.max(worst, physics.stats.fetchSamples);
  }
  const at = (u, v) => { const d = world.at(u, v), p = V(d.x * RE, d.y * RE, d.z * RE); return { o: physics.water('earth', p, {}), L: physics.fields.water.local(p, {}), p }; };
  return { physics, world, at, msMean: ms / (secs * 30 - 301), msMax, worst };
}
const lagoonF = (u, v) => {
  if (u >= 0 && u < 24 && v > -220 && v < 40) return 1.5;
  if (u > -160 && u < 0 && v > -200 && v < 60) return -3;
  return u < 0 ? 4 : -Math.min(20, 0.5 + 0.07 * u);
};

test('P18 a lagoon behind a barrier is calmer than the open shore beside it: lower sea, no swell, and the map is built in slices within the ration', () => {
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const { up } = upwindAtC();
    // +u upwind: the sea from u = 0 out (20 m deep from 285 m), a barrier at u 0..24 for v -220..40, a lagoon 3 m deep behind it
    const f = (u, v) => {
      if (u >= 0 && u < 24 && v > -220 && v < 40) return 1.5;
      if (u > -160 && u < 0 && v > -200 && v < 60) return -3;
      return u < 0 ? 4 : -Math.min(20, 0.5 + 0.07 * u);
    };
    // (the focus on the barrier's lee shore, the lagoon's middle within the inner level; points 140 m and more from its mouth,
    // where a 16 m grid cannot place the barrier's end closer than a cell and the open sea's fetch leaks round it)
    const R = run(f, up, [-2, -60]);
    const shore = [R.at(40, 40), R.at(40, -100), R.at(30, -160)], lag = [R.at(-80, -100), R.at(-140, -120), R.at(-60, -150)];
    const mean = (a, k) => a.reduce((s, x) => s + x.o[k], 0) / a.length;
    const Hs = mean(shore, 'significant'), Hl = mean(lag, 'significant'), Os = mean(shore, 'open'), Ol = mean(lag, 'open');
    console.log(`# lagoon: open shore Hs ${Hs.toFixed(2)} m (fetch ${shore.map((x) => x.o.fetch.toFixed(0))}, swell reach ${Os.toFixed(2)}, white ${(100 * mean(shore, 'whitecapCover')).toFixed(1)} %); lagoon Hs ${Hl.toFixed(2)} m (fetch ${lag.map((x) => x.o.fetch.toFixed(0))}, swell reach ${Ol.toFixed(2)}, white ${(100 * mean(lag, 'whitecapCover')).toFixed(1)} %); map ${R.msMean.toFixed(3)} ms a frame (worst ${R.msMax.toFixed(2)}), ${R.worst} samples a frame at most`);
    assert.ok(R.physics.fields.water.map.target.on, 'the map is built');
    assert.ok(Hl < 0.5 * Hs, `the lagoon (${Hl}) is calmer than the open shore (${Hs})`);
    assert.ok(Os > 0.9 && Ol < 0.2, `the open sea's swell reaches the open shore (${Os}), not the lagoon (${Ol})`);
    for (const x of shore) assert.ok(x.o.fetch >= 2000, `the open shore faces the open sea: ${x.o.fetch}`);
    assert.ok(R.worst <= 24, 'the outer level and the far rose keep to the old gauge\'s ration');
    timing(R.msMean < 0.25, `the map costs ${R.msMean} ms a frame on average`);
  } finally { setWindScale('earth', s0); }
});

test('P18 waves turn toward the longest fetch: a gale 45 degrees across a long lake raises a sea running along it, over more fetch', () => {
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const { up } = upwindAtC();
    // the lake's long axis (+u) 45 degrees off upwind; 1200 x 200 m, 4 m deep
    const R = run((u, v) => (Math.abs(u) < 600 && Math.abs(v) < 100 ? -4 : 2), up + Math.PI / 4, [400, 0]);
    const pts = [R.at(0, 0), R.at(-200, 20), R.at(200, -20)];
    for (const x of pts) {
      const head = wrapD(deg(Math.atan2(x.L.dirz, x.L.dirx) - (up + Math.PI / 4)));      // the way the waves run, against +u
      // the wind runs at 135 (u-relative): the lake's axis at 180; the sea runs between, turned toward the axis
      console.log(`# lake: heading ${head.toFixed(0)} (wind 135, axis 180), fetch ${x.o.fetch.toFixed(0)} m (straight downwind about 141), Hs ${x.o.significant.toFixed(2)} m`);
      assert.ok(Math.abs(head) > 145 && Math.abs(head) <= 180, `turned toward the axis: ${head}`);
      assert.ok(x.o.fetch > 250, `over the longer fetch: ${x.o.fetch}`);
    }
  } finally { setWindScale('earth', s0); }
});

test('P18 refraction: on a beach the wind meets at 45 degrees the crests turn toward the shore in the shallows; the twin\'s slope is its height\'s', () => {
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const { up } = upwindAtC();
    // a straight beach (+u out to sea, 0.07 slope to 20 m), facing 45 degrees off the wind
    const turn = up - Math.PI / 4, R = run((u, v) => -Math.min(20, 0.07 * u - 0.3), turn, [-3, 0]);
    const off = (x) => Math.abs(wrapD(deg(Math.atan2(x.L.dirz, x.L.dirx) - turn) - 180));    // degrees off the shore's normal (waves running in: 180)
    const deep = R.at(200, 0), mid = R.at(40, 10), shallow = R.at(10, 0);
    console.log(`# beach: waves ${off(deep).toFixed(0)} deg off the normal 200 m out (14 m deep), ${off(mid).toFixed(0)} at 40 m (2.5 m), ${off(shallow).toFixed(0)} at 10 m (0.4 m); Hs ${deep.o.significant.toFixed(2)}, ${mid.o.significant.toFixed(2)}, ${shallow.o.significant.toFixed(2)} m`);
    assert.ok(off(shallow) < off(deep) - 10, `turned toward the shore in the shallows: ${off(shallow)} against ${off(deep)}`);
    assert.ok(off(deep) > 30 && off(deep) < 70, `offshore they come in at about the wind's angle: ${off(deep)}`);
    // the twin: with the map on, the slope it reports is the gradient of the height it reports (the warp's Jacobian and
    // the scales' gradients included)
    const W = R.physics.fields.water.field, x0 = R.physics.fields.water.field._mg[0] + 5 * 16 + 3.3, z0 = R.physics.fields.water.field._mg[1] + 7 * 16 + 5.1;
    assert.ok(W._mapOn, 'the map is on');
    let worst = 0;
    const g = W._mg, onLine = (a, a0) => { const r = ((a - a0) / 16) % 1; return r < 0.01 || r > 0.99; };
    for (let k = 0; k < 40; k++) {
      const x = x0 + k * 2.7, z = z0 + k * 1.9, e = 0.01, s = W.surfaceAt(x, z, {});
      // (P19: not across a line of nodes, where the bilinear twin's slope is each cell's own and a central difference
      // straddles two: k = 31 lies on one to the last digit)
      if (onLine(x, g[0]) || onLine(z, g[1])) continue;
      const he = (W.heightAt(x + e, z) - W.heightAt(x - e, z)) / (2 * e), hn = (W.heightAt(x, z + e) - W.heightAt(x, z - e)) / (2 * e);
      assert.ok(Math.abs(s.height - W.heightAt(x, z)) < 1e-9, 'surfaceAt and heightAt agree');
      worst = Math.max(worst, Math.abs(he - s.de), Math.abs(hn - s.dn));
    }
    assert.ok(worst < 2e-3, `slope against the height's gradient: ${worst}`);
  } finally { setWindScale('earth', s0); }
});

test('P18 the chunk carries the sea map behind PC_PHYS_SEA_MAP; without the define it is the chunk as before', () => {
  for (const k of ['uPhysSeaMap', 'uPhysSeaGrid', 'uPhysSeaGrid2', 'uPhysSeaBand', 'pcPhysSeaTap', 'pcPhysSeaP', 'pcPhysSeaWarp', 'pcPhysSeaLocal', 'pcPhysSeaDir', 'pcPhysWaterCrestAt', 'pcPhysWaterSurfAt']) assert.ok(WATER_GLSL.includes(k), k);
  // every use of the map's uniforms sits inside an #ifdef PC_PHYS_SEA_MAP block
  let depth = 0, inMap = 0; const stack = [];
  for (const line of WATER_GLSL.split('\n')) {
    const t = line.trim();
    if (t.startsWith('#if')) { stack.push(t.includes('PC_PHYS_SEA_MAP')); if (stack[stack.length - 1]) inMap++; depth++; continue; }
    if (t.startsWith('#endif')) { if (stack.pop()) inMap--; depth--; continue; }
    if (/uPhysSea(Map|Grid|Band)/.test(t)) assert.ok(inMap > 0, 'outside the define: ' + t);
  }
  assert.equal(depth, 0);
  const W = new WaterField(), u = W.uniforms;
  assert.ok(u.uPhysSeaMap instanceof Float32Array && u.uPhysSeaMap.length === SEA_TEX.N * SEA_TEX.rows * 4);
  assert.equal(u.uPhysSeaGrid[3], 0, 'no map until one is built');
});

// The coast report on synthetic coasts: an open coast facing a gale passes, the lagoon behind a barrier does not
test('P18 the coast report (coast.mjs): an open coast facing the storm passes the marks, a lagoon behind a barrier does not', () => {
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const { up } = upwindAtC();
    const mk = (f, stand) => { const world = coastWorld(C, f, { R: RE, turn: up });
      return { createPhysics, sampleSurfacePure: (id, x, y, z) => world({ x, y, z }), getStandPure: () => ({ unitDir: world.at(stand[0], stand[1]) }), BODIES, windLarge, weatherWind, windSea, foamCover, WATER, liquidOf, airDensity }; };
    const open = coastReport(mk((u) => -Math.min(20, 0.08 * u - 0.5), [-4, 0]), 'earth', 'sea_coast', { t: 420, settle: 120 });
    const lag = coastReport(mk((u, v) => (u >= 0 && u < 30 ? 1.5 : u > -200 && u < 0 && Math.abs(v) < 250 ? -3 : u < 0 ? 4 : -Math.min(20, 0.08 * u)), [-180, 0]), 'earth', 'sea_coast', { t: 420, settle: 60 });
    const r80 = (r) => r.rows.find((x) => x.out === 80);
    console.log(`# coast report: open coast 80 m out fetch ${r80(open).fetch} m, depth ${r80(open).meanDepth}, Hs ${r80(open).Hs} (target ${open.target.Hs}), white ${r80(open).whitePct} % => ${open.pass}; lagoon fetch ${r80(lag).fetch}, Hs ${r80(lag).Hs} => ${lag.pass}`);
    assert.equal(open.pass, true, JSON.stringify(open.checks));
    assert.equal(lag.pass, false);
    assert.equal(lag.checks.fetch, false);
  } finally { setWindScale('earth', s0); }
});

test('P18 until the shader reads the map, the trains it draws everywhere are the sea of the water nearest the focus (a lagoon keeps its chop); once read, the most exposed water\'s', () => {
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const { up } = upwindAtC();
    const A = run(lagoonF, up, [-100, -110], 24, false), B = run(lagoonF, up, [-100, -110], 24, true);
    const lag = A.at(-100, -110), Ha = A.physics.fields.water.field.significant, Hb = B.physics.fields.water.field.significant;
    console.log(`# the trains drawn everywhere: ${Ha.toFixed(2)} m with the map unread (the lagoon here: ${lag.o.significant.toFixed(2)} m), ${Hb.toFixed(2)} m once read (the open sea about); mapRead ${A.physics.fields.water.field.mapRead} / ${B.physics.fields.water.field.mapRead}`);
    assert.equal(A.physics.fields.water.field.mapRead, false);
    assert.ok(Math.abs(Ha - lag.o.significant) < 0.25 * Math.max(Ha, 0.05), `unread: the trains are the lagoon's sea (${Ha} against ${lag.o.significant})`);
    assert.ok(Hb > 2 * Ha, `read: the trains are the open sea's (${Hb} against ${Ha})`);
  } finally { setWindScale('earth', s0); }
});

// (P19) Review 7, findings 2 and 3: the shown map seen from FIXED places while the focus walks along a coast at 6 m/s
// (PILOT's docs/lead/evidence/review7/seamap-seams.mjs, shortened to one re-anchor of the frame)
function walk(f, turn, secs, path, places, each) {
  const world = coastWorld(C, f, { R: RE, turn });
  const physics = createPhysics({ sampleSurface: (id, q) => world(q), timeBudget: false });
  void physics.fields.water.uniforms.uPhysSeaMap;
  const pts = places.map(([u, v]) => { const d = world.at(u, v); return V(d.x * RE, d.y * RE, d.z * RE); });
  let ra = 0, pv = -1;
  for (let i = 0; i < secs * 30; i++) {
    const t = i / 30, [u, v] = path(t), fd = world.at(u, v);
    physics.update(1 / 30, { bodyId: 'earth', time: 300 + t, focus: V(fd.x * (RE + 1.5), fd.y * (RE + 1.5), fd.z * (RE + 1.5)) });
    const M = physics.fields.water.map, kind = physics.stats.reanchors !== ra ? 'reanchor' : M.target.version !== pv ? 'build' : 'other';
    each(t, kind, physics, pts);
    ra = physics.stats.reanchors; pv = M.target.version;
  }
}

test('P19 the shown sea map does not step when a build lands after the focus has moved: at fixed places the sea changes on those frames no more than on any other (a coast with lagoons, a walk at 6 m/s)', () => {
  // Until P19 a build landing moved the band between the levels by whole cells, gave new nodes the build's value at once,
  // and after a re-anchor snapped the outer level: 60 m out Hs fell 0.242 m in a frame, in a lagoon the waves turned
  // 27.9 degrees (p99 of other frames 0.0036 m). Now the band is a rectangle whose edges move continuously.
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const { up } = upwindAtC();
    const inLag = (v) => ((v % 400) + 400) % 400 < 260;
    const f = (u, v) => (u >= 0 && u < 24 && inLag(v) ? 1.5 : u > -160 && u < 0 && inLag(v) ? -3 : u < 0 ? 4 : -Math.min(20, 0.5 + 0.07 * u));
    const S = [0, 1].map(() => ({ build: [], other: [], wb: [], wo: [] }));
    let prev = null, builds = 0;
    walk(f, up, 100, (t) => [-6, -380 + 6 * t], [[60, 0], [-80, 100]], (t, kind, physics, pts) => {
      const cur = pts.map((p) => { const o = physics.water('earth', p, {}); return [o.significant, Math.atan2(o.dir.y, o.dir.x)]; });
      if (prev && t > 30 && kind !== 'reanchor') {
        if (kind === 'build') builds++;
        cur.forEach((c, k) => {
          const dh = Math.abs(c[0] - prev[k][0]), dw = Math.abs(Math.atan2(Math.sin(c[1] - prev[k][1]), Math.cos(c[1] - prev[k][1]))) * 180 / Math.PI;
          S[k][kind === 'build' ? 'build' : 'other'].push(dh); S[k][kind === 'build' ? 'wb' : 'wo'].push(dw);
        });
      }
      prev = cur;
    });
    const q99 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.99)], max = (a) => Math.max(...a);
    S.forEach((s, k) => {
      const name = k ? 'in a lagoon' : '60 m out';
      console.log(`# ${name}: Hs steps on ${builds} build frames at most ${max(s.build).toFixed(4)} m, other frames p99 ${q99(s.other).toFixed(4)}, at most ${max(s.other).toFixed(4)}; the waves' way ${max(s.wb).toFixed(2)} against ${q99(s.wo).toFixed(2)} (p99), ${max(s.wo).toFixed(2)} degrees`);
      assert.ok(max(s.build) <= Math.max(1.5 * max(s.other), 5 * q99(s.other)), `${name}: Hs stepped ${max(s.build)} m on a build frame (other frames: p99 ${q99(s.other)}, at most ${max(s.other)})`);
      assert.ok(max(s.wb) <= Math.max(1.5 * max(s.wo), 0.5), `${name}: the waves turned ${max(s.wb)} degrees on a build frame (other frames at most ${max(s.wo)})`);
    });
    assert.ok(builds > 50, `builds landed: ${builds}`);
  } finally { setWindScale('earth', s0); }
});

test('P19 after a re-anchor of the frame the crests stay where they were: the warp moves no more in the 5 s after it than in any 5 s (an oblique beach, a walk along it at 6 m/s)', () => {
  // Until P19 SeaMap.rebase left the published target in the old frame: the next build's warp started cold and the crests
  // slid 14.6 m in the 5 s after a re-anchor (2.9 m in a typical 5 s).
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.25);
    const f = (u, v) => { const s = u * 0.8 + v * 0.6; return s < 0 ? 3 : -Math.min(20, 0.3 + 0.03 * s); };
    const steps = [];
    let prevW = null;
    walk(f, 0, 100, (t) => { const a = -380 + 6 * t; return [-4 * 0.8 - 0.6 * a, -4 * 0.6 + 0.8 * a]; }, [], (t, kind, physics) => {
      const W = physics.fields.water.field, F = physics.fields.frame, b = -380 + 6 * t - 40;
      const d = coastWorld(C, f, { R: RE, turn: 0 }).at(50 * 0.8 - 0.6 * b, 50 * 0.6 + 0.8 * b), p = V(d.x * RE, d.y * RE, d.z * RE);
      const m = W._mapOn ? W._seaAt(F.lx(p.x, p.y, p.z), F.lz(p.x, p.y, p.z)) : null, w = m ? [m[12], m[13]] : null;
      if (w && prevW && t > 30) steps.push({ t, dw: Math.hypot(w[0] - prevW[0], w[1] - prevW[1]), re: kind === 'reanchor' });
      prevW = w;
    });
    const re = steps.filter((s) => s.re).map((s) => s.t), sum = (a) => a.reduce((x, y) => x + y, 0);
    assert.equal(re.length, 1, 'one re-anchor in the walk');
    const after = sum(steps.filter((s) => s.t >= re[0] && s.t < re[0] + 5).map((s) => s.dw));
    const rest = steps.filter((s) => !(s.t >= re[0] && s.t < re[0] + 5)).map((s) => s.dw), typical = sum(rest) / (rest.length / 150);
    console.log(`# the warp 50 m out: ${after.toFixed(2)} m in the 5 s after the re-anchor, ${typical.toFixed(2)} m in a typical 5 s`);
    assert.ok(after < 2 * typical, `the crests slid ${after} m after the re-anchor (typical ${typical})`);
  } finally { setWindScale('earth', s0); }
});
