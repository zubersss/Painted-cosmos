// Tests: the arithmetic of the draw kits (src/physics/three/expand.js: pure, so it runs in Node;
// the three.js wrappers are exercised in physics-lab.html). Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAW, DRAW_PAINTED, cellFor, RING, makeEye, expandStreaks, expandDabs, dabSize, thinned, own01, expandShades, expandMats, expandMarks, expandRings, expandWater, quadIndices, quadUvs, gridIndices } from './three/expand.js';
import { PARTICLE_GLSL, SHAPE_GLSL } from './three/chunks.glsl.js';
import { LocalFrame } from './near.js';
import { WaterField } from './water.js';
import { MARK, MARK_STRIDE } from './deform.js';
import { PARTICLES } from './particles.js';

const buf = (list) => { const n = list.length, b = { count: n, capacity: n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), size: new Float32Array(n), age: new Float32Array(n), origin: { x: 0, y: 0, z: 0 } }; list.forEach((p, i) => { b.pos.set(p.p, i * 3); b.vel.set(p.v || [0, 0, 0], i * 3); b.size[i] = p.size ?? 0.002; b.age[i] = p.age ?? 1; }); return b; };
const V = (a, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalOf = (out, q = 0) => cross(sub(V(out, q * 4 + 1), V(out, q * 4)), sub(V(out, q * 4 + 2), V(out, q * 4)));

test('every particle kind has a way to be drawn', () => {
  for (const k of PARTICLES.kinds) { assert.ok(DRAW[k], k); assert.ok(DRAW[k].shape === 'streak' ? DRAW[k].width > 0 && DRAW[k].exposure > 0 : DRAW[k].size > 0, k); }
});

test('a streak is the drop\'s path during the exposure, as wide as asked, facing the eye', () => {
  const eye = makeEye(); eye.x = 0; eye.y = 1.6; eye.z = 5;                 // looking at a drop 5 m away
  const b = buf([{ p: [0, 2, 0], v: [0, -6.5, 0] }]);
  const out = new Float32Array(12);
  assert.equal(expandStreaks(b, DRAW.rain, eye, out), 1);
  const head = [(out[0] + out[3]) / 2, (out[1] + out[4]) / 2, (out[2] + out[5]) / 2], tail = [(out[6] + out[9]) / 2, (out[7] + out[10]) / 2, (out[8] + out[11]) / 2];
  assert.ok(len(sub(head, [0, 2, 0])) < 1e-6, 'the head is where the drop is');
  assert.ok(Math.abs(tail[1] - (2 + 6.5 * DRAW.rain.exposure)) < 1e-6 && Math.abs(tail[0]) < 1e-6, 'the tail is where it was: ' + tail);
  assert.ok(Math.abs(len(sub(V(out, 1), V(out, 0))) - DRAW.rain.width) < 1e-6, 'width');
  assert.ok(dot(normalOf(out), sub([eye.x, eye.y, eye.z], head)) > 0, 'front face toward the eye');
  // run through the rain at 7 m/s: the streak slants, as if the rain came from ahead
  eye.vx = 7;
  expandStreaks(b, DRAW.rain, eye, out);
  const t2 = [(out[6] + out[9]) / 2, (out[7] + out[10]) / 2, (out[8] + out[11]) / 2];
  assert.ok(Math.abs(Math.atan2(t2[0], t2[1] - 2) - Math.atan2(7, 6.5)) < 1e-6, 'slant ' + Math.atan2(t2[0], t2[1] - 2));
  // a particle hanging still is still a mark of the least length, and one coming straight at the eye is not degenerate
  eye.vx = 0;
  const still = buf([{ p: [0, 2, 0], v: [0, 0, 0] }, { p: [0, 1.6, 0], v: [0, 0, 3] }]);
  const o2 = new Float32Array(24); expandStreaks(still, DRAW.rain, eye, o2);
  assert.ok(Math.abs(len(sub(V(o2, 3), V(o2, 0))) - DRAW.rain.min) < 1e-6);
  for (const x of o2) assert.ok(Number.isFinite(x));
  assert.ok(len(sub(V(o2, 5), V(o2, 4))) > DRAW.rain.width * 0.99);
});

test('a dab faces the picture, grows in from nothing, and shrinks to nothing at the edge of the volume', () => {
  const eye = makeEye(); eye.z = 10; eye.fx = 0; eye.fy = 0; eye.fz = 0; eye.radius = 24;
  const b = buf([{ p: [1, 2, 0], age: 5 }, { p: [1, 2, 0], age: 0 }, { p: [24, 0, 0], age: 5 }, { p: [21.6, 0, 0], age: 5 }, { p: [3, 0, 0], age: DRAW.snow.fadeIn / 2 }]);
  const out = new Float32Array(60);
  assert.equal(expandDabs(b, DRAW.snow, eye, out), 5);
  const side = (q) => len(sub(V(out, q * 4 + 1), V(out, q * 4)));
  assert.ok(Math.abs(side(0) - DRAW.snow.size) < 1e-6);
  assert.ok(dot(normalOf(out, 0), [0, 0, 1]) > 0, 'faces the camera (which looks down -z)');
  assert.ok(side(1) < 1e-9, 'new: no size yet');
  assert.ok(side(2) < 1e-9, 'at the edge of the volume: gone');
  assert.ok(Math.abs(side(3) - DRAW.snow.size * 0.5) < 1e-3, 'halfway through the outer fifth: half size, ' + side(3));
  assert.ok(Math.abs(side(4) - DRAW.snow.size * 0.5) < 1e-6);
  // dust spreads as it ages; leaves turn but keep their size
  const d = buf([{ p: [0, 0, 0], age: 2 }]); const o = new Float32Array(12);
  expandDabs(d, DRAW.dust, eye, o); assert.ok(Math.abs(len(sub(V(o, 1), V(o, 0))) - (DRAW.dust.size + 2 * DRAW.dust.grow)) < 1e-6);
  expandDabs(d, DRAW.leaves, eye, o); assert.ok(Math.abs(len(sub(V(o, 1), V(o, 0))) - DRAW.leaves.size) < 1e-6);
  const a0 = V(o, 1).slice(); d.age[0] = 2.3; expandDabs(d, DRAW.leaves, eye, o);
  assert.ok(len(sub(V(o, 1), a0)) > 0.01, 'it has turned');
});

test('a particle\'s shade is its own: it does not change when the buffer is reshuffled', () => {
  const b = buf([{ p: [0, 0, 0], size: 0.0021 }, { p: [0, 0, 0], size: 0.0034 }, { p: [0, 0, 0], size: 0.0027 }]);
  const a = new Float32Array(36), c = new Float32Array(36);
  expandShades(b, 0.5, a);
  for (let i = 0; i < 36; i++) assert.ok(a[i] <= 1 && a[i] >= 0.5);
  assert.ok(a[0] !== a[12] && a[12] !== a[24]);
  const s = b.size[0]; b.size[0] = b.size[2]; b.size[2] = s;              // the swap-with-last the simulation does
  expandShades(b, 0.5, c);
  assert.equal(c[0], a[24]); assert.equal(c[24], a[0]);
});

function markRing(list) {
  const M = { data: new Float32Array(8 * MARK_STRIDE), capacity: 8, head: 0, total: 0, origin: { x: 0, y: 4000, z: 0 }, stride: MARK_STRIDE };
  list.forEach((m, i) => { M.data.set([m.x, m.y ?? 0, m.z, m.d[0], m.d[1], m.d[2], m.length, m.width, m.depth, m.kind ?? 0, m.born ?? 0, m.life ?? 100, m.rim ?? 0, 0], i * MARK_STRIDE); M.total++; });
  return M;
}

test('marks: a quad per live mark, its own size, lying on the ground the near field knows, face up', () => {
  const frame = new LocalFrame(); frame.anchor('earth', 0, 4000, 0);
  const M = markRing([
    { x: 2, z: 1, d: [1, 0, 0], length: 0.30, width: 0.12, depth: 0.04, kind: MARK.footLeft, rim: 0.008 },
    { x: 5, z: 1, d: [0, 0, 1], length: 0.64, width: 0.64, depth: 0.1, kind: MARK.gear, born: 0, life: 10 },      // expired at t = 20
    { x: 40, z: 0, d: [1, 0, 0], length: 0.30, width: 0.12, depth: 0.04 },                                          // beyond the near field
  ]);
  const slope = 0.3, heightAt = (x, z) => (Math.abs(x) < 16 && Math.abs(z) < 16 ? slope * x : NaN);
  const pos = new Float32Array(8 * 12), data = new Float32Array(8 * 16), shade = new Float32Array(8 * 12);
  const n = expandMarks(M, frame, heightAt, 20, 0.015, pos, data, shade);
  assert.equal(n, 2, 'the expired pad is not drawn');
  // first quad: along x (the slope direction), on the slope
  const c = [0, 1, 2, 3].map((k) => V(pos, k));
  assert.ok(Math.abs(len(sub(c[1], c[0])) - 0.12) < 2e-3, 'width ' + len(sub(c[1], c[0])));
  const along = len(sub(c[3], c[0]));
  assert.ok(Math.abs(along - 0.30 * Math.hypot(1, slope)) < 3e-3, 'length along the slope ' + along);
  assert.ok(dot(normalOf(pos, 0), [0, 1, 0]) > 0, 'faces the sky');
  for (const p of c) { const gx = frame.lx(p[0], p[1] + 4000, p[2]), r = Math.hypot(p[0], p[1] + 4000, p[2]); assert.ok(Math.abs(r - (4000 + slope * gx + 0.015)) < 2e-3, 'on the ground plus the lift: ' + (r - 4000 - slope * gx)); }
  assert.ok(Math.abs(data[0] - 0.04) < 1e-6 && Math.abs(data[1] - 0.008) < 1e-6 && data[2] === MARK.footLeft && Math.abs(data[3] - 0.8) < 1e-6, 'depth, rim, kind, fade');
  assert.ok(shade[0] < 1 && shade[0] > 0.2);
  // the far one lies in its own tangent plane, flat, still its own size
  const f = [4, 5, 6, 7].map((k) => V(pos, k));
  assert.ok(Math.abs(len(sub(f[1], f[0])) - 0.12) < 1e-3 && Math.abs(len(sub(f[3], f[0])) - 0.30) < 1e-3);
  for (const p of f) assert.ok(Number.isFinite(p[0] + p[1] + p[2]));
});

test('rings: only the events still alive, growing as they age, flat on the ground', () => {
  const frame = new LocalFrame(); frame.anchor('earth', 0, 4000, 0);
  const E = { data: new Float32Array(4 * 8), capacity: 4, head: 0, total: 0, origin: { x: 0, y: 4000, z: 0 } };
  E.data.set([1, 0, 1, 1, 0.8, 9.5, 0.003, 0], 0);        // a ripple, 0.5 s old at t = 10
  E.data.set([2, 0, 2, 0, 0.8, 9.0, 0.003, 0], 8);        // a splash, 1 s old: over
  E.data.set([3, 0, 3, 1, 0.8, 9.9, 0.003, 0], 16);       // a ripple, 0.1 s old
  const pos = new Float32Array(48), data = new Float32Array(64);
  assert.equal(expandRings(E, frame, 10, 0.01, pos, data), 2);
  const r0 = len(sub(V(pos, 1), V(pos, 0))) / 2, r1 = len(sub(V(pos, 5), V(pos, 4))) / 2;
  assert.ok(r0 > r1 && Math.abs(r0 - (RING[1][1] + RING[1][2] * 0.5) * (0.6 + 0.8 * 0.8)) < 1e-6, `older is wider: ${r0} > ${r1}`);
  assert.ok(dot(normalOf(pos, 0), [0, 1, 0]) > 0);
  assert.ok(Math.abs(data[2] - 0.5 / RING[1][0]) < 1e-6 && data[0] === 1);
});

test('water: the grid rides the same waves as the JS twin, moves in whole steps, normals lean against the slope', () => {
  const frame = new LocalFrame(); frame.anchor('earth', 0, 4000, 0);
  const W = new WaterField();
  for (let i = 0; i < 400; i++) W.update(1 / 60, frame, 14, 3, 1.5, 30, 2500, 9.8, 1.2, 999, 0, 0);
  assert.ok(W.height > 0.3);
  const N = 16, step = 1.5, nv = (N + 1) * (N + 1);
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), pos2 = new Float32Array(nv * 3);
  assert.equal(expandWater(W, frame, 3.2, -1.1, N, step, pos, nrm), nv);
  let worst = 0, tilt = 0;
  for (let v = 0; v < nv; v++) {
    const p = [pos[v * 3] + frame.ox, pos[v * 3 + 1] + frame.oy, pos[v * 3 + 2] + frame.oz];
    const gx = frame.lx(...p), gz = frame.lz(...p);
    worst = Math.max(worst, Math.abs(Math.hypot(...p) - (frame.r0 + W.level + W.heightAt(gx, gz))));
    const nl = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); assert.ok(Math.abs(nl - 1) < 1e-5);
    tilt = Math.max(tilt, Math.acos(Math.min(1, nrm[v * 3 + 1])));
  }
  assert.ok(worst < 2e-3, 'surface against the twin: ' + worst + ' m');           // float32 at 4 km
  assert.ok(tilt > 0.05 && tilt < 0.6, 'steepest normal ' + tilt + ' rad');
  // nudge the centre by less than half a step: the same vertices
  expandWater(W, frame, 3.2 + 0.3, -1.1 + 0.2, N, step, pos2, null);
  for (let i = 0; i < pos.length; i++) assert.equal(pos2[i], pos[i]);
  expandWater(W, frame, 3.2 + step, -1.1, N, step, pos2, null);
  assert.ok(Math.abs(pos2[0] - pos[0] - step) < 1e-3, 'a whole step moves it a whole step');
});

test('indices, uvs and the GLSL chunks', () => {
  const idx = quadIndices(3); assert.deepEqual(Array.from(idx.slice(6, 12)), [4, 5, 6, 4, 6, 7]);
  assert.ok(quadIndices(20000) instanceof Uint32Array && quadIndices(100) instanceof Uint16Array);
  assert.deepEqual(Array.from(quadUvs(1)), [0, 0, 1, 0, 1, 1, 0, 1]);
  const g = gridIndices(2); assert.equal(g.length, 24); assert.ok(Math.max(...g) === 8);
  for (const [src, names] of [[PARTICLE_GLSL, ['pcPhysStreak', 'pcPhysDab', 'pcPhysShade', 'aPcPos', 'aPcVel', 'aPcSize', 'aPcAge', 'uPcEye', 'uPcEyeVel', 'uPcRight', 'uPcUp', 'uPcFocus', 'uPcDraw']], [SHAPE_GLSL, ['pcPhysMarkCover', 'pcPhysMarkRim', 'pcPhysRingCover']]]) {
    for (const n of names) assert.ok(src.includes(n), n);
    assert.equal((src.match(/{/g) || []).length, (src.match(/}/g) || []).length);
    assert.equal((src.match(/\(/g) || []).length, (src.match(/\)/g) || []).length);
  }
  // the constants the shader and the JS share
  assert.ok(PARTICLE_GLSL.includes('51413.7') && PARTICLE_GLSL.includes('73856.093'));
  assert.ok(PARTICLE_GLSL.includes('91573.37') && PARTICLE_GLSL.includes('(keep * 1.18 - h) / (0.3 * h + 1e-4)') && PARTICLE_GLSL.includes('min(sl, max(uPcSmear * h, travel))') && PARTICLE_GLSL.includes('aPcLeft / uPcDraw3.x'), 'thinning, smear and fade-out as in expand.js');
});

test('the floor: far marks are never smaller than the least size, there are fewer of them, and they cover what they covered', () => {
  const eye = makeEye(); eye.pix = 2 * Math.tan(24 * Math.PI / 180) / 540;      // a 48 degree lens, 540 pixels high
  const near = buf([{ p: [0, 0, -2], v: [0, -6.5, 0] }]);
  const out1 = new Float32Array(12);
  expandStreaks(near, DRAW.rain, eye, out1);
  assert.ok(Math.abs(len(sub(V(out1, 1), V(out1, 0))) - DRAW.rain.width) < 1e-6, 'at 2 m: its own width');
  expandDabs(near, { ...DRAW.snow, exposure: 0, near: 0 }, eye, out1);
  assert.ok(Math.abs(len(sub(V(out1, 1), V(out1, 0))) - DRAW.snow.size) < 1e-6);
  // 4000 of a kind at one distance, each with its own size (as the simulation gives them)
  const N = 4000, many = (d) => buf(Array.from({ length: N }, (_, i) => ({ p: [Math.sin(i) * 0.3 * d, Math.cos(i * 1.3) * 0.2 * d, -d], v: [0, -6.5, 0], size: 0.0008 + 0.0000031 * i + 0.0007 * Math.abs(Math.sin(i * 12.9898)) })));
  const out = new Float32Array(N * 12);
  const widths = (o) => { const w = []; for (let i = 0; i < N; i++) w.push(len(sub(V(o, i * 4 + 1), V(o, i * 4)))); return w; };
  for (const [D, pow, name] of [[{ ...DRAW.rain, minPx: 3 }, 1, 'streak'], [{ ...DRAW.snow, minPx: 3.5, exposure: 0 }, 2, 'dab']]) {
    const own = D.shape === 'streak' ? D.width : D.size;
    let prevShown = N + 1;
    for (const d of [6, 20, 45, 90]) {
      const b = many(d);
      if (D.shape === 'streak') expandStreaks(b, D, eye, out); else expandDabs(b, D, eye, out);
      const w = widths(out), dl = (i) => Math.hypot(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]);
      let shown = 0, cover = 0, smallest = 1e9;
      for (let i = 0; i < N; i++) {
        const floor = D.minPx * eye.pix * dl(i), f = Math.max(1, floor / own);
        assert.ok(w[i] <= Math.max(own, floor) + 2e-5, 'never larger than the floor asks');
        if (w[i] > 0.97 * Math.max(own, floor)) { shown++; smallest = Math.min(smallest, w[i] / (eye.pix * dl(i))); }
        cover += Math.pow(w[i] / own, pow) / Math.pow(f, 0);            // width (streak) or area (dab), in units of its own
      }
      const f = Math.max(1, D.minPx * eye.pix * d * 1.03 / own);
      assert.ok(shown <= prevShown && shown >= 1, `${name} at ${d} m: ${shown} shown`); prevShown = shown;
      if (f > 1.2) assert.ok(smallest > D.minPx * 0.97, `${name} at ${d} m: the smallest mark drawn whole is ${smallest.toFixed(2)} px`);
      const expect = N / Math.pow(f, pow), tol = expect > 150 ? 0.25 : 0.6;      // (few are left far away: counting noise)
      assert.ok(Math.abs(shown / expect - 1) < tol || f < 1.2, `${name} at ${d} m (${f.toFixed(1)} x its size): one in ${(N / shown).toFixed(1)} drawn whole, the floor asks for one in ${Math.pow(f, pow).toFixed(1)}`);
      assert.ok(Math.abs(cover / N - 1) < 0.2, `${name} at ${d} m: the marks cover ${(cover / N).toFixed(2)} of what they covered`);
    }
  }
  // which ones are drawn does not change when the buffer is reshuffled, and nothing pops as a mark recedes
  const D = { ...DRAW.snow, minPx: 3.5, exposure: 0 }, one = buf([{ p: [0, 0, -5], size: 0.00233 }]); let prev = null, worst = 0;
  for (let d = 5; d < 120; d += 0.05) { one.pos[2] = -d; expandDabs(one, D, eye, out1); const px = len(sub(V(out1, 1), V(out1, 0))) / (eye.pix * d); if (prev != null) worst = Math.max(worst, Math.abs(px - prev)); prev = px; }
  assert.ok(worst < 0.25 && prev === 0, `receding 5 cm at a time, its size on screen changes by at most ${worst.toFixed(2)} px a step, and it is gone in the end`);
  assert.ok(thinned(0.3, 1) === 1 && thinned(0.3, 0.2) === 0 && thinned(0.3, 0.3) > 0 && thinned(0.3, 0.3) < 1);
  assert.equal(own01(0.00233), own01(0.00233));
});

test('a mark near the lens is never larger than the most asked for; a dab is drawn out along its motion', () => {
  const eye = makeEye(); eye.pix = 0.002;
  const D = { ...DRAW.snow, size: 0.1, minPx: 3.5, maxPx: 9, exposure: 0, strobe: 0, near: 0, tumble: 0 };   // (round flakes here: their shape has its own test)
  const b = buf([{ p: [0, 0, -1] }, { p: [0, 0, -8] }]); const out = new Float32Array(24);
  expandDabs(b, D, eye, out);
  assert.ok(Math.abs(len(sub(V(out, 1), V(out, 0))) - 9 * 0.002 * 1) < 1e-6, 'at 1 m: 9 px');
  assert.ok(Math.abs(len(sub(V(out, 5), V(out, 4))) - 0.1) < 1e-6, 'at 8 m: its own 10 cm (6 px)');
  // a flake blown across the picture at 5 m/s, 30 ms exposure: 15 cm of travel on a 10 cm dab
  const w = buf([{ p: [0, 0, -8], v: [5, 0, 0] }, { p: [0, 0, -8], v: [0, -1, 0] }, { p: [0, 0, -8], v: [0, 0, 10] }, { p: [0, 0, -8], v: [40, 0, 0] }]); const o = new Float32Array(48);
  expandDabs(w, { ...D, exposure: 0.03 }, eye, o);
  const along = (q) => len(sub(V(o, q * 4 + 1), V(o, q * 4))), across = (q) => len(sub(V(o, q * 4 + 3), V(o, q * 4)));
  assert.ok(Math.abs(along(0) - 0.25) < 1e-6 && Math.abs(across(0) - 0.1) < 1e-6, `blown: ${along(0)} by ${across(0)} m`);
  assert.ok(Math.abs(along(3) - 0.3) < 1e-6, 'in a gale: never drawn out by more than two dab sizes');
  expandDabs(w, { ...D, exposure: 0.03, smear: 1 }, eye, o); assert.ok(Math.abs(along(3) - 0.2) < 1e-6, 'or by as much as the kind allows');
  // no two flakes the same size, the mean unchanged
  const many = buf(Array.from({ length: 500 }, (_, i) => ({ p: [0, 0, -8], size: 0.002 + i * 3.1e-6 }))), om = new Float32Array(500 * 12);
  expandDabs(many, { ...D, varySize: 0.4 }, eye, om);
  let lo = 9, hi = 0, mean = 0; for (let i = 0; i < 500; i++) { const s2 = len(sub(V(om, i * 4 + 1), V(om, i * 4))); lo = Math.min(lo, s2); hi = Math.max(hi, s2); mean += s2 / 500; }
  assert.ok(lo > 0.059 && lo < 0.07 && hi > 0.13 && hi < 0.141 && Math.abs(mean - 0.1) < 0.006, `sizes ${lo.toFixed(3)} .. ${hi.toFixed(3)}, mean ${mean.toFixed(3)}`);
  assert.ok(Math.abs(Math.max(o[3], o[6]) - 0.05) < 1e-6, 'its head is where the flake is, the smear behind it');
  assert.ok(Math.abs(along(1) - 0.13) < 1e-6, 'falling at 1 m/s: nearly round');
  assert.ok(Math.abs(along(2) - 0.1) < 1e-6, 'moving along the line of sight: round');
  // leaves turn instead
  expandDabs(w, { ...DRAW.leaves, exposure: 0.03 }, eye, o); assert.ok(Math.abs(along(0) - DRAW.leaves.size) < 1e-6);
});

test('dabs sized by the physics: the marks hide what the dust in the air hides, up to the largest mark allowed', () => {
  const D = { ...DRAW.dust, size: 0.5, sizeMax: 3, fill: 0.4 }, o = {};
  assert.equal(dabSize(D, 0, 200, 18000, o), 0.5); assert.equal(o.cover, 1);
  // a dust storm with 200 m of visual range: 3.912 / 200 per metre, 206 puffs in 18 000 m3
  const s = dabSize(D, 3.912 / 200, 206, 18432, o);
  assert.ok(Math.abs(206 * 0.4 * s * s - 3.912 / 200 * 18432) < 1e-6 && s > 1.5 && s < 3 && o.cover === 1, 'size ' + s);
  // a thicker storm needs more than the largest mark gives: the rest is the sky's haze
  const s2 = dabSize(D, 3.912 / 40, 206, 18432, o);
  assert.equal(s2, 3); assert.ok(o.cover > 0.2 && o.cover < 0.6, 'cover ' + o.cover);
  assert.equal(dabSize(D, 1e-5, 500, 18432, o), 0.5, 'thin haze: the puffs keep their own size');
});

test('cost of the arithmetic: a downpour, a full ring of marks and the water grid', () => {
  const n = 1600, list = []; for (let i = 0; i < n; i++) list.push({ p: [Math.sin(i) * 20, 5 + Math.cos(i * 1.7) * 8, Math.cos(i) * 20], v: [2, -6.5, 1], size: 0.002 + (i % 7) * 1e-4 });
  const b = buf(list), eye = makeEye(); eye.z = 6; eye.pix = 0.0016; eye.radius = 24;
  const out = new Float32Array(n * 12), col = new Float32Array(n * 12);
  const time = (fn, reps) => { fn(); let best = 1e9; for (let k = 0; k < 5; k++) { const t0 = performance.now(); for (let i = 0; i < reps; i++) fn(); best = Math.min(best, (performance.now() - t0) / reps); } return best; };
  const tS = time(() => expandStreaks(b, DRAW.rain, eye, out), 50), tD = time(() => expandDabs(b, DRAW.leaves, eye, out), 50), tC = time(() => expandShades(b, 0.4, col), 50);
  const frame = new LocalFrame(); frame.anchor('earth', 0, 4000, 0);
  const M = { data: new Float32Array(256 * MARK_STRIDE), capacity: 256, head: 0, total: 256, origin: { x: 0, y: 4000, z: 0 }, stride: MARK_STRIDE };
  for (let i = 0; i < 256; i++) M.data.set([Math.sin(i) * 12, 0, Math.cos(i) * 12, 1, 0, 0, 0.3, 0.12, 0.03, i % 2, 0, 1000, 0.005, 0], i * MARK_STRIDE);
  const mp = new Float32Array(256 * 12), md = new Float32Array(256 * 16), ms = new Float32Array(256 * 12);
  const tM = time(() => expandMarks(M, frame, (x, z) => 0.1 * x, 10, 0.015, mp, md, ms), 20);
  const W = new WaterField(); for (let i = 0; i < 300; i++) W.update(1 / 60, frame, 14, 3, 1.5, 30, 2500, 9.8, 1.2, 999, 0, 0);
  const N = 40, wp = new Float32Array((N + 1) * (N + 1) * 3), wn = new Float32Array((N + 1) * (N + 1) * 3);
  const tW = time(() => expandWater(W, frame, 0, 0, N, 1.5, wp, wn), 20);
  console.log(`      kit arithmetic: 1600 streaks ${(tS * 1000).toFixed(0)} us, 1600 dabs ${(tD * 1000).toFixed(0)} us, shades ${(tC * 1000).toFixed(0)} us, 256 marks ${(tM * 1000).toFixed(0)} us, water 41x41 ${(tW * 1000).toFixed(0)} us`);
  assert.ok(tS < 0.4 && tD < 0.4 && tC < 0.2 && tM < 0.5 && tW < 0.4, 'each well under half a millisecond');
});

test('what the kits can draw with every buffer full at the highest quality (reported; the owner removed the budget of 12 draw calls and 60 k triangles)', () => {
  let tris = 0, calls = 0;
  for (const k of PARTICLES.kinds) { tris += PARTICLES.capacity[k][2] * 2; calls++; }
  tris += PARTICLES.events * 2 + 256 * 2 + 40 * 40 * 2; calls += 3;      // rings, marks, the water patch
  console.log(`# kits, everything full at the highest quality: ${calls} draw calls, ${tris} triangles`);
  // (no count is a gate any more: COORDINATOR E, "OWNER'S INSTRUCTION". What is held is that the numbers are known.)
  assert.ok(calls > 0 && tris > 0 && Number.isFinite(tris));
});

test('ink for the kits: a particle\'s material on its four vertices, a mark\'s on its quad', () => {
  const b = buf([{ p: [0, 0, 0] }, { p: [1, 0, 0] }, { p: [2, 0, 0] }]);
  b.mat = Uint8Array.from([4, 255, 9]);
  const out = new Uint8Array(12);
  assert.equal(expandMats(b, out), 3);
  assert.deepEqual(Array.from(out), [4, 4, 4, 4, 255, 255, 255, 255, 9, 9, 9, 9]);
  delete b.mat; expandMats(b, out); assert.ok(out.every((x) => x === 255), 'a buffer without materials says none');
  const frame = new LocalFrame(); frame.anchor('earth', 0, 4000, 0);
  const M = markRing([{ x: 1, z: 1, d: [1, 0, 0], length: 0.3, width: 0.12, depth: 0.04 }, { x: 2, z: 1, d: [1, 0, 0], length: 0.3, width: 0.12, depth: 0.04 }]);
  M.data[13] = 8; M.data[MARK_STRIDE + 13] = 3;
  const pos = new Float32Array(8 * 12), mat = new Uint8Array(8 * 4);
  assert.equal(expandMarks(M, frame, null, 1, 0.015, pos, null, null, mat), 2);
  assert.deepEqual(Array.from(mat.slice(0, 8)), [8, 8, 8, 8, 3, 3, 3, 3]);
  assert.ok(PARTICLE_GLSL.includes('attribute float aPcMat;'));
});

test('snow shown modulo a cell round the eye: the same flakes, whole cells away, none under the hull; room from the physics spares the far ones', () => {
  const eye = makeEye(); eye.pix = 0.002; eye.x = 3; eye.y = 1.6; eye.z = -4; eye.shelters = new Float32Array(16);
  // local axes of a flat patch: east = +x, north = -z, up = +y (east x north = up)
  const D = { ...DRAW.snow, size: 0.1, minPx: 0, exposure: 0, cell: 9, near: 0 };
  const N = 600, b = buf(Array.from({ length: N }, (_, i) => ({ p: [Math.sin(i * 1.7) * 24, 1 + (i % 17), Math.cos(i * 2.9) * 24], size: 0.003 + i * 1e-6 })));
  const out = new Float32Array(N * 12);
  expandDabs(b, D, eye, out);
  let whole = 0, small = 0;
  for (let i = 0; i < N; i++) {
    const c = [0, 1, 2].map((k) => (out[i * 12 + k] + out[i * 12 + 6 + k]) / 2), w = len(sub(V(out, i * 4 + 1), V(out, i * 4)));
    const de = c[0] - eye.x, dn = -(c[2] - eye.z);
    assert.ok(Math.abs(de) <= 9 + 1e-4 && Math.abs(dn) <= 9 + 1e-4, 'inside the cell round the eye');
    const se = (c[0] - b.pos[i * 3]) / 18, sn = (c[2] - b.pos[i * 3 + 2]) / 18;
    assert.ok(Math.abs(se - Math.round(se)) < 1e-4 && Math.abs(sn - Math.round(sn)) < 1e-4 && Math.abs(c[1] - b.pos[i * 3 + 1]) < 1e-5, 'moved by whole cells, at its own height');
    const m = Math.max(Math.abs(de), Math.abs(dn)) / 9;
    if (m < 0.8) { assert.ok(Math.abs(w - 0.1) < 1e-5); whole++; } else if (w < 0.099) small++;
  }
  assert.ok(whole > N * 0.5 && small > N * 0.2, `${whole} whole, ${small} shrinking toward the cell's wall`);
  // a hull 4 m east of the eye, its top 1 m above the eye: nothing is drawn under it
  eye.shelters.set([4, 0, 1, 3.5]); eye.shelterCount = 1;
  expandDabs(b, D, eye, out);
  let under = 0, gone = 0;
  for (let i = 0; i < N; i++) {
    const de0 = b.pos[i * 3] - eye.x, dn0 = -(b.pos[i * 3 + 2] - eye.z), we = de0 - 18 * Math.round(de0 / 18), wn = dn0 - 18 * Math.round(dn0 / 18);
    if (Math.hypot(we - 4, wn) < 3.5 && b.pos[i * 3 + 1] - eye.y < 1) { under++; if (len(sub(V(out, i * 4 + 1), V(out, i * 4))) === 0) gone++; }
  }
  assert.ok(under > 3 && gone === under, `${gone} of ${under} under the hull are not drawn`);
  // the floor thins a kind only as far as the physics does not leave room
  eye.shelterCount = 0;
  const F = { ...DRAW.snow, size: 0.05, minPx: 6, exposure: 0 }, far = buf(Array.from({ length: 400 }, (_, i) => ({ p: [3 + Math.sin(i) * 3, 1.6, -4 - 20], size: 0.002 + i * 2e-6 })));
  const o2 = new Float32Array(400 * 12), count = (room) => { expandDabs(far, F, eye, o2, F.size, room); let n = 0; for (let i = 0; i < 400; i++) if (len(sub(V(o2, i * 4 + 1), V(o2, i * 4))) > 0.2) n++; return n; };
  const tight = count(1), roomy = count(30);
  assert.ok(tight < 400 * 0.08 && roomy === 400, `at 20 m a 5 cm flake is drawn 24 cm: one in 23 if it must keep its cover (${tight} of 400), all of them where the physics says the snow hides far more than the flakes paint (${roomy})`);
  assert.ok(PARTICLE_GLSL.includes('uPcDraw2.z * f * f') && PARTICLE_GLSL.includes('uniform vec4 uPcShelter'));
});

test('nothing strobes: a dab is drawn out as far as it travels in a frame, and shrinks away where that would make it a hairline', () => {
  const eye = makeEye(); eye.pix = 0.002;
  const D = { ...DRAW.snow, size: 0.1, minPx: 0, maxPx: 0, exposure: 0.04, smear: 1.2, strobe: 0.02, tumble: 0 };
  // at 8 m, blown across the picture at 5, 10, 20, 30 and 45 m/s
  const w = buf([5, 10, 20, 30, 45].map((v) => ({ p: [0, 0, -8], v: [v, 0, 0] }))), o = new Float32Array(60);
  expandDabs(w, D, eye, o);
  const along = (q) => len(sub(V(o, q * 4 + 1), V(o, q * 4))), across = (q) => len(sub(V(o, q * 4 + 3), V(o, q * 4)));
  // 5 m/s: 10 cm a frame; the smear cap (1.2 sizes) already covers it
  assert.ok(Math.abs(along(0) - 0.22) < 1e-6 && Math.abs(across(0) - 0.1) < 1e-6, `5 m/s: ${along(0)}`);
  // 10 m/s: the cap would leave gaps between one frame's mark and the next; drawn out to its travel
  assert.ok(Math.abs(along(1) - 0.3) < 1e-6 && Math.abs(across(1) - 0.1) < 1e-6, `10 m/s: ${along(1)} by ${across(1)}`);
  for (let q = 0; q < 2; q++) assert.ok(along(q) >= w.vel[q * 3] * 0.02 - 1e-6, 'never shorter than its travel in a frame');
  // 20 m/s: four of its sizes a frame, more than the three a dab may be drawn out to: it is thinning
  // (still as long as its travel); 30 m/s and more: a camera would smear it to nothing
  assert.ok(across(2) > 0.02 && across(2) < 0.08 && along(2) >= 0.4, `20 m/s: ${along(2)} by ${across(2)}`);
  assert.ok(across(3) < 1e-9 && across(4) < 1e-9, '30 and 45 m/s: gone');
  // a hand from the lens the same 5 m/s flake is a flash (it is capped at 9 px = 0.36 cm at 20 cm, and crosses 10 cm a frame)
  const near = buf([{ p: [0, 0, -0.2], v: [5, 0, 0] }, { p: [0, 0, -3], v: [5, 0, 0] }]);
  expandDabs(near, { ...D, maxPx: 9 }, eye, o);
  assert.ok(across(0) < 1e-9, 'at the lens: gone'); assert.ok(Math.abs(across(1) - 0.054) < 1e-6, 'at 3 m: there, 9 px');
  // and in still air too nothing is painted at arm's length: full size from `near` on, nothing inside 0.4 of it
  const still = buf([0.5, 0.8, 1.4, 2, 6].map((d) => ({ p: [0, 0, -d] })));
  expandDabs(still, { ...D, near: 2 }, eye, o); assert.equal(DRAW.snow.near, 3);
  assert.ok(across(0) < 1e-9 && across(1) < 1e-9 && across(2) > 0.02 && across(2) < 0.09 && Math.abs(across(3) - 0.1) < 1e-6 && Math.abs(across(4) - 0.1) < 1e-6, `${[0, 1, 2, 3, 4].map((q) => across(q).toFixed(3))}`);
});

test('nothing pops out: a mark shrinks to nothing over the last moments the physics gives it', () => {
  const eye = makeEye(); eye.pix = 0;
  const b = buf([{ p: [0, 0, -5] }, { p: [1, 0, -5] }, { p: [2, 0, -5] }, { p: [3, 0, -5] }]); b.age.fill(5);
  b.left = new Float32Array([1e9, 0.35, 0.175, 0]);
  const o = new Float32Array(48), D = { ...DRAW.dust, size: 1, grow: 0, minPx: 0, vary: 0, fadeOut: 0.7 };
  expandDabs(b, D, eye, o);
  const w = (q) => len(sub(V(o, q * 4 + 1), V(o, q * 4)));
  assert.ok(Math.abs(w(0) - 1) < 1e-6 && Math.abs(w(1) - 0.5) < 1e-6 && Math.abs(w(2) - 0.25) < 1e-6 && w(3) === 0, `${[0, 1, 2, 3].map(w)}`);
  // streaks too (sand, spray); rain is where it is to the end
  const st = buf([{ p: [0, 0, -5], v: [0, -5, 0] }, { p: [1, 0, -5], v: [0, -5, 0] }]); st.age.fill(5); st.left = new Float32Array([1e9, 0.05]);
  expandStreaks(st, { ...DRAW.sand, width: 0.1, minPx: 0, fadeOut: 0.1 }, eye, o);
  assert.ok(Math.abs(w(0) - 0.1) < 1e-6 && Math.abs(w(1) - 0.05) < 1e-6);
  expandStreaks(st, { ...DRAW.hail, width: 0.1, minPx: 0 }, eye, o); assert.ok(Math.abs(w(1) - 0.1) < 1e-6, 'a hailstone is there until it strikes');
  // every kind that grows, tumbles or hangs has a fade-out; a buffer without `left` draws as before
  for (const k of ['rain', 'snow', 'dust', 'ash', 'spores', 'leaves', 'sand', 'spray']) assert.ok(DRAW[k].fadeOut > 0, k);
  delete b.left; expandDabs(b, D, eye, o); assert.ok(Math.abs(w(3) - 1) < 1e-6);
});

test('the cell divides the simulated box: a particle the simulation wraps from wall to wall is shown where it was', () => {
  const eye = makeEye(); eye.pix = 0; eye.x = 2; eye.y = 1.6; eye.z = -3; eye.radius = PARTICLES.radius; eye.fx = 0; eye.fy = 0; eye.fz = 0;
  const D = { ...DRAW.snow, ...DRAW_PAINTED.snow, minPx: 0, maxPx: 0, exposure: 0 };
  assert.equal(cellFor(D, eye), 8, 'asked for 9 m in a 24 m box: 8 m (three cells across the box)');
  assert.equal(cellFor({ cell: 12 }, eye), 12); assert.equal(cellFor({ cell: 30 }, eye), 24); assert.equal(cellFor({ cell: 0 }, eye), 0);
  assert.equal(cellFor({ cell: 9 }, makeEye()), 9, 'no box known: as asked');
  for (let c = 2; c < 30; c += 0.7) { const k = 2 * PARTICLES.radius / (2 * cellFor({ cell: c }, eye)); assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `${c}`); }
  // flakes just inside the east wall of the box, and the same flakes after the wrap (48 m west)
  const N = 40, a = buf(Array.from({ length: N }, (_, i) => ({ p: [23.9, 1 + i * 0.3, -20 + i], size: 0.003 + i * 1e-5 })));
  const b2 = buf(Array.from({ length: N }, (_, i) => ({ p: [23.9 - 48, 1 + i * 0.3, -20 + i], size: 0.003 + i * 1e-5 })));
  const oa = new Float32Array(N * 12), ob = new Float32Array(N * 12);
  expandDabs(a, D, eye, oa); expandDabs(b2, D, eye, ob);
  let worst = 0, seen = 0; for (let i = 0; i < N * 12; i++) { worst = Math.max(worst, Math.abs(oa[i] - ob[i])); }
  for (let i = 0; i < N; i++) if (len(sub(V(oa, i * 4 + 1), V(oa, i * 4))) > 0.05) seen++;
  assert.ok(worst < 1e-4, `moved by ${worst} m`); assert.ok(seen > N * 0.5, `${seen} of them in sight`);
  // with the cell as it was asked for (9 m: 48 m is not a whole number of 18 m cells) they would have jumped 6 m
  const far = makeEye(); Object.assign(far, eye, { radius: 0 });
  expandDabs(a, D, far, oa); expandDabs(b2, D, far, ob);
  let jump = 0; for (let i = 0; i < N; i++) jump = Math.max(jump, Math.abs(oa[i * 12] - ob[i * 12]));
  assert.ok(jump > 5.9, `${jump}`);
});

// ---- P7: tuned against the painted picture ------------------------------------------------------

test('rain laid parallel: every stroke of a frame has one direction in the picture, however near, and none is longer than asked', () => {
  const eye = makeEye(); eye.pix = 0.002;
  // looking along -z, a little down: picture right = +x, picture up = (0, cos, sin) tilted
  const pitch = 0.35; eye.ux = 0; eye.uy = Math.cos(pitch); eye.uz = -Math.sin(pitch);
  const drops = [];
  for (let i = 0; i < 60; i++) drops.push({ p: [(i % 10 - 4.5) * 1.3, 1 + (i % 7) * 0.8, -3 - (i % 6) * 2.5], v: [3 + 0.4 * Math.sin(i), -8 - (i % 5) * 0.5, 1], size: 0.002 + i * 1e-5 });
  const b = buf(drops), out = new Float32Array(60 * 12);
  const D = { ...DRAW.rain, ...DRAW_PAINTED.rain, minPx: 0, share: 1, near: 0, fadeIn: 0, fadeOut: 0 };
  assert.equal(D.parallel, 1); assert.ok(D.maxLen > 0.5 && D.maxLen <= 1.5);
  const fwd = cross([eye.rx, eye.ry, eye.rz], [eye.ux, eye.uy, eye.uz]);     // toward the eye (right x up)
  const screen = (v) => { const d = -dot(v, fwd); return [dot(v, [eye.rx, eye.ry, eye.rz]) / d, dot(v, [eye.ux, eye.uy, eye.uz]) / d]; };
  const dirs = (o) => { const a = []; for (let q = 0; q < 60; q++) { const h = V(o, q * 4), t = V(o, q * 4 + 3), sh = screen(h), st = screen(t); a.push(Math.atan2(st[1] - sh[1], st[0] - sh[0])); } return a; };
  expandStreaks(b, D, eye, out);
  const par = dirs(out), spread = Math.max(...par) - Math.min(...par);
  assert.ok(spread < 1e-3, `parallel: the strokes differ by ${spread} rad`);
  for (let q = 0; q < 60; q++) { const l = len(sub(V(out, q * 4 + 3), V(out, q * 4))); assert.ok(l <= D.maxLen + 1e-6 && l >= D.min - 1e-6, `stroke ${l} m`); }
  // each along its own path in perspective: they fan out by a quarter of a radian and more (what PAINTER saw crossing)
  expandStreaks(b, { ...D, parallel: 0 }, eye, out);
  const per = dirs(out); assert.ok(Math.max(...per) - Math.min(...per) > 0.25, `in perspective they fan by ${Math.max(...per) - Math.min(...per)}`);
  // the frame's direction is the mean motion as the picture sees it: down, and to the right with this wind
  const mean = par[0]; assert.ok(Math.cos(mean) < 0 && Math.sin(mean) > 0.5, `tails up and to the left (heads lead down and right): ${mean}`);
  // Jupiter: 30 m/s for 0.12 s would be 3.6 m; no stroke is longer than maxLen, parallel or not
  const fast = buf([{ p: [0, 3, -9], v: [0, -30, 0] }, { p: [2, 3, -9], v: [0, -30, 0] }]), o2 = new Float32Array(24);
  for (const parallel of [0, 1]) { expandStreaks(fast, { ...D, parallel }, eye, o2); assert.ok(Math.abs(len(sub(V(o2, 3), V(o2, 0))) - D.maxLen) < 1e-6, 'capped'); }
  // looking straight down the rain there is no direction to see: dots of the least length
  const down = makeEye(); down.pix = 0.002; down.rx = 1; down.ry = 0; down.rz = 0; down.ux = 0; down.uy = 0; down.uz = -1;
  const fall = buf([{ p: [1, -6, 1], v: [0, -9, 0] }, { p: [-2, -8, 0], v: [0, -9, 0] }]);
  expandStreaks(fall, D, down, o2); assert.ok(Math.abs(len(sub(V(o2, 3), V(o2, 0))) - D.min) < 1e-6, 'seen from above: a dot');
  // nothing near the lens: gone inside 0.4 of `near`, whole from `near` on
  const nearB = buf([1, 2.3, 4, 6.5, 12].map((d) => ({ p: [0, 0, -d], v: [0, -8, 0] }))), o3 = new Float32Array(60);
  expandStreaks(nearB, { ...D, near: 6 }, eye, o3);
  const wid = (q) => len(sub(V(o3, q * 4 + 1), V(o3, q * 4)));
  assert.ok(wid(0) < 1e-9 && wid(1) < 1e-9 && wid(2) > 0.005 && wid(2) < 0.04 && Math.abs(wid(3) - D.width) < 1e-6 && Math.abs(wid(4) - D.width) < 1e-6, `${[0, 1, 2, 3, 4].map((q) => wid(q).toFixed(3))}`);
  // a third of the strokes: the painted table draws about a third of what it drew
  const many = buf(Array.from({ length: 900 }, (_, i) => ({ p: [(i % 30 - 15) * 0.7, (i % 9) * 0.6, -6 - (i % 17)], v: [0, -8, 0], size: 0.001 + i * 2.3e-6 }))), om = new Float32Array(900 * 12);
  const count = (DD) => { expandStreaks(many, DD, eye, om); let c = 0; for (let q = 0; q < 900; q++) if (len(sub(V(om, q * 4 + 1), V(om, q * 4))) > 1e-4) c++; return c; };
  const all = count({ ...D, minPx: 4 }), few = count({ ...D, minPx: 4, share: DRAW_PAINTED.rain.share });
  assert.ok(few > 0.22 * all && few < 0.48 * all, `${few} of ${all} strokes`);
});

test('a flake has a shape of its own and turns slowly; driven by wind it lies along its motion; nothing flips', () => {
  const eye = makeEye(); eye.pix = 0.002;
  const D = { ...DRAW.snow, ...DRAW_PAINTED.snow, minPx: 0, maxPx: 0, varySize: 0, cell: 0, near: 0, fadeIn: 0, fadeOut: 0 };
  assert.equal(DRAW_PAINTED.snow.size, 0.07); assert.equal(DRAW_PAINTED.snow.minPx, 3.5); assert.equal(DRAW_PAINTED.snow.maxPx, 6.5);
  assert.ok(D.tumble > 0 && D.aspect < 0.8);
  const n = 300, list = Array.from({ length: n }, (_, i) => ({ p: [0, 0, -6], size: 0.004 + i * 2.1e-5, age: 3 }));
  const b = buf(list), o = new Float32Array(n * 12);
  expandDabs(b, D, eye, o);
  const long = (q) => len(sub(V(o, q * 4 + 1), V(o, q * 4))), short = (q) => len(sub(V(o, q * 4 + 3), V(o, q * 4)));
  const ang = (q) => { const a = sub(V(o, q * 4 + 1), V(o, q * 4)); return Math.atan2(a[1], a[0]); };
  let lo = 9, hi = 0; const seen = new Set();
  for (let q = 0; q < n; q++) { const r = short(q) / long(q); lo = Math.min(lo, r); hi = Math.max(hi, r); assert.ok(Math.abs(long(q) - D.size) < 1e-6, 'its long side is its size'); seen.add(Math.floor(((ang(q) + Math.PI) % Math.PI) / (Math.PI / 6))); }
  assert.ok(lo < D.aspect + 0.05 && lo >= D.aspect - 1e-6 && hi > 0.95, `shapes from ${lo.toFixed(2)} to ${hi.toFixed(2)}`);
  assert.equal(seen.size, 6, 'they lie every way');
  // a tenth of a second later each has turned a little (at most tumble rad/s), some one way, some the other
  const a0 = Array.from({ length: n }, (_, q) => ang(q));
  for (let i = 0; i < n; i++) b.age[i] += 0.1;
  expandDabs(b, D, eye, o);
  let cw = 0, ccw = 0, most = 0;
  for (let q = 0; q < n; q++) { let d = ang(q) - a0[q]; d -= Math.PI * Math.round(d / Math.PI); most = Math.max(most, Math.abs(d)); if (d > 1e-4) ccw++; else if (d < -1e-4) cw++; }
  assert.ok(most <= D.tumble * 0.1 + 1e-6 && most > 0.3 * D.tumble * 0.1, `the fastest turns ${most} rad in 0.1 s`);
  assert.ok(cw > n * 0.3 && ccw > n * 0.3, `${cw} one way, ${ccw} the other`);
  // in a 9 m/s wind across the picture every flake lies within a few degrees of its motion, and is drawn out
  for (let i = 0; i < n; i++) { b.vel[i * 3] = 9; }
  expandDabs(b, D, eye, o);
  for (let q = 0; q < n; q++) { let d = ang(q); d -= Math.PI * Math.round(d / Math.PI); assert.ok(Math.abs(d) < 0.3, `along the wind: ${d}`); assert.ok(long(q) > D.size * 1.5); }
  // as the wind rises from nothing the mark changes steadily: between two wind speeds 2 % apart no corner
  // of any flake moves by more than a third of the flake (a flake lying across the wind turns into it
  // while it is all but round, not by flipping)
  const steadiness = (DD) => {
    let worst = 0; const prev = new Float32Array(n * 2).fill(NaN);
    for (let v = 0; v <= 9; v *= 1.02, v += 0.002) {
      for (let i = 0; i < n; i++) b.vel[i * 3] = v;
      expandDabs(b, DD, eye, o);
      for (let q = 0; q < n; q++) {
        // the quad as a shape: the second moments of its two sides (an oval has no head), in units of size^2
        const a = sub(V(o, q * 4 + 1), V(o, q * 4)), bb = sub(V(o, q * 4 + 3), V(o, q * 4)), m0 = a[0] * a[0] - a[1] * a[1] + bb[0] * bb[0] - bb[1] * bb[1], m1 = 2 * a[0] * a[1] + 2 * bb[0] * bb[1];
        if (prev[q * 2] === prev[q * 2]) worst = Math.max(worst, Math.hypot(m0 - prev[q * 2], m1 - prev[q * 2 + 1]) / (D.size * D.size));
        prev[q * 2] = m0; prev[q * 2 + 1] = m1;
      }
    }
    return worst;
  };
  // (what a round flake does as it is drawn out is the measure: a tumbling one changes no faster)
  const round = steadiness({ ...D, tumble: 0 }), tumbling = steadiness(D);
  assert.ok(tumbling <= round * 1.1 + 0.02, `the largest change of shape between two wind speeds: ${tumbling} of the flake (round: ${round})`);
});

test('dust in a storm: low level veils, wider than high, instead of round puffs (P10: six in ten of the marks, it was one in twenty); kicked dust in clear air stays a puff', () => {
  const eye = makeEye(); eye.pix = 0.002;
  // the eye looks north-ish and a little down; local up is +y (east = +x, north = -z in makeEye)
  const pitch = 0.3; eye.ux = 0; eye.uy = Math.cos(pitch); eye.uz = -Math.sin(pitch);
  const D = { ...DRAW.dust, ...DRAW_PAINTED.dust, minPx: 0, maxPx: 0, near: 0, wallNear: 0, fadeIn: 0, fadeOut: 0, wallFade: 0, exposure: 0, grow: 0 };
  const n = 2000, b = buf(Array.from({ length: n }, (_, i) => ({ p: [(i % 40 - 20) * 0.5, 1, -12 - (i % 9)], v: [14, 0, 0], size: 1e-5 + i * 3.7e-8, age: 4 }))), o = new Float32Array(n * 12);
  const wide = (q) => sub(V(o, q * 4 + 1), V(o, q * 4)), high = (q) => sub(V(o, q * 4 + 3), V(o, q * 4));
  // clear air (the size is the kind's own): every puff drawn, round, facing the picture
  eye.wall01 = 0; expandDabs(b, D, eye, o, D.size);
  let drawn = 0; for (let q = 0; q < n; q++) if (len(wide(q)) > 1e-4) { drawn++; assert.ok(Math.abs(len(wide(q)) - D.size) < 1e-6 && Math.abs(len(high(q)) - D.size) < 1e-6); }
  assert.equal(drawn, n);
  // the storm at its height (the weather's dust load is past wallFull; the size the physics asks for is the largest allowed)
  eye.wall01 = 0.9; expandDabs(b, D, eye, o, D.sizeMax);
  drawn = 0;
  for (let q = 0; q < n; q++) {
    const w = len(wide(q)), h = len(high(q)); if (w < 1e-3) continue; drawn++;
    // (those the thinning is still shrinking are narrower: judge the whole ones)
    if (h > D.wallHigh * 0.98) assert.ok(Math.abs(w / h - D.wall) < 1e-3 && h <= D.wallHigh + 1e-6, `${w} by ${h}`);
    const a = wide(q), u = high(q);
    assert.ok(Math.abs(a[1]) < 1e-6 * w, 'its long side is level'); assert.ok(Math.abs(u[0]) < 1e-6 && Math.abs(u[2]) < 1e-6, 'its short side is the local up');
  }
  assert.ok(drawn > n * D.wallShare * 0.5 && drawn < n * D.wallShare * 2.2, `${drawn} walls of ${n} puffs`);
  // half way there are already about as few of them as in the storm (thinned first, widened after)
  // (P10: the limit follows the share, 1.5 x wallShare + 2 %; it was a fixed 12 % when the share was 5 %)
  eye.wall01 = 0.5 * (D.wallFrom + D.wallFull); expandDabs(b, D, eye, o, 0.5 * (D.size + D.sizeMax));
  drawn = 0; for (let q = 0; q < n; q++) if (len(wide(q)) > 1e-3) drawn++;
  assert.ok(drawn < n * (1.5 * D.wallShare + 0.02), `half way: ${drawn} of ${n}`);
  // between the two it goes over steadily: a storm builds over a minute or more, 3600 frames; over 2000 steps
  // no mark changes its width by more than half a metre a step
  let worst = 0; const prev = new Float32Array(n).fill(NaN);
  for (let k = 0; k <= 2000; k++) {
    eye.wall01 = k / 2000; expandDabs(b, D, eye, o, D.size + (D.sizeMax - D.size) * k / 2000);
    for (let q = 0; q < n; q += 5) { const w = len(wide(q)); if (prev[q] === prev[q]) worst = Math.max(worst, Math.abs(w - prev[q])); prev[q] = w; }
  }
  assert.ok(worst < 0.5, `largest step in width: ${worst} m`);
});
