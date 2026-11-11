// Tests: the arithmetic of the draw kits (src/physics/three/expand.js: pure, so it runs in Node;
// the three.js wrappers are exercised in physics-lab.html). Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAW, RING, makeEye, expandStreaks, expandDabs, dabSize, thinned, own01, expandShades, expandMats, expandMarks, expandRings, expandWater, quadIndices, quadUvs, gridIndices } from './three/expand.js';
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
  assert.ok(PARTICLE_GLSL.includes('91573.37') && PARTICLE_GLSL.includes('(keep * 1.18 - h) / (0.3 * h + 1e-4)') && PARTICLE_GLSL.includes('min(sl, 4.0 * h)'), 'thinning and smear as in expand.js');
});

test('the floor: far marks are never smaller than the least size, there are fewer of them, and they cover what they covered', () => {
  const eye = makeEye(); eye.pix = 2 * Math.tan(24 * Math.PI / 180) / 540;      // a 48 degree lens, 540 pixels high
  const near = buf([{ p: [0, 0, -2], v: [0, -6.5, 0] }]);
  const out1 = new Float32Array(12);
  expandStreaks(near, DRAW.rain, eye, out1);
  assert.ok(Math.abs(len(sub(V(out1, 1), V(out1, 0))) - DRAW.rain.width) < 1e-6, 'at 2 m: its own width');
  expandDabs(near, { ...DRAW.snow, exposure: 0 }, eye, out1);
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
  const D = { ...DRAW.snow, size: 0.1, minPx: 3.5, maxPx: 9, exposure: 0 };
  const b = buf([{ p: [0, 0, -1] }, { p: [0, 0, -8] }]); const out = new Float32Array(24);
  expandDabs(b, D, eye, out);
  assert.ok(Math.abs(len(sub(V(out, 1), V(out, 0))) - 9 * 0.002 * 1) < 1e-6, 'at 1 m: 9 px');
  assert.ok(Math.abs(len(sub(V(out, 5), V(out, 4))) - 0.1) < 1e-6, 'at 8 m: its own 10 cm (6 px)');
  // a flake blown across the picture at 5 m/s, 30 ms exposure: 15 cm of travel on a 10 cm dab
  const w = buf([{ p: [0, 0, -8], v: [5, 0, 0] }, { p: [0, 0, -8], v: [0, -1, 0] }, { p: [0, 0, -8], v: [0, 0, 10] }, { p: [0, 0, -8], v: [40, 0, 0] }]); const o = new Float32Array(48);
  expandDabs(w, { ...D, exposure: 0.03 }, eye, o);
  const along = (q) => len(sub(V(o, q * 4 + 1), V(o, q * 4))), across = (q) => len(sub(V(o, q * 4 + 3), V(o, q * 4)));
  assert.ok(Math.abs(along(0) - 0.25) < 1e-6 && Math.abs(across(0) - 0.1) < 1e-6, `blown: ${along(0)} by ${across(0)} m`);
  assert.ok(Math.abs(along(3) - 0.3) < 1e-6, 'in a gale: never more than three dabs long');
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

test('the kits stay inside the budget PILOT set: 12 draw calls and far fewer than 60 k triangles with every buffer full', () => {
  let tris = 0, calls = 0;
  for (const k of PARTICLES.kinds) { tris += PARTICLES.capacity[k][2] * 2; calls++; }
  tris += PARTICLES.events * 2 + 256 * 2 + 40 * 40 * 2; calls += 3;      // rings, marks, the water patch
  assert.ok(calls <= 12, 'draw calls: ' + calls);
  assert.ok(tris <= 32000, 'triangles, everything full at the highest quality: ' + tris);
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
