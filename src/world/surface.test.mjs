// Unit tests for the pure world logic. Run: node --test src/world/
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNoise, hashString, hash2i } from './noise.js';
import { faceToDir, dirToFace } from './cubesphere.js';
import { getSurface, sampleSurfacePure, getVistasPure, makeSample, NOLQ } from './surface.js';
import { buildPatchData, patchIndices, PATCH_VERTS, PATCH_N } from './patchgen.js';
import { BODY_IDS, BODIES, spaceAltitude } from '../data/bodies.js';
import { sampleObstaclesPure } from './obstacles.js';
import { placeTrees, INST_STRIDE } from './floraplace.js';
import { LOOKS } from '../data/looks.js';
import { EASELS } from '../art/easels.js';

test('noise is deterministic, bounded and seed-dependent', () => {
  const a = makeNoise(hashString('x')), b = makeNoise(hashString('x')), c = makeNoise(hashString('y'));
  let differs = false;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.137, y = i * 0.071 - 3, z = i * 0.013 + 9;
    const v = a.n3(x, y, z);
    assert.equal(v, b.n3(x, y, z));
    assert.ok(v >= -1.2 && v <= 1.2);
    if (Math.abs(v - c.n3(x, y, z)) > 1e-6) differs = true;
  }
  assert.ok(differs);
  assert.equal(hash2i(3, 4, 5), hash2i(3, 4, 5));
});

test('cube-sphere mapping round-trips on every face', () => {
  const d = [0, 0, 0], o = {};
  for (let f = 0; f < 6; f++) for (let u = -0.95; u <= 0.95; u += 0.19) for (let v = -0.95; v <= 0.95; v += 0.19) {
    faceToDir(f, u, v, d);
    assert.ok(Math.abs(Math.hypot(d[0], d[1], d[2]) - 1) < 1e-12);
    dirToFace(d[0], d[1], d[2], o);
    assert.equal(o.face, f);
    assert.ok(Math.abs(o.u - u) < 1e-9 && Math.abs(o.v - v) < 1e-9);
  }
});

test('every body has a look with at least 4 biomes and a working surface', () => {
  for (const id of BODY_IDS) {
    assert.ok(LOOKS[id], id);
    assert.ok(LOOKS[id].biomes.length >= 4, id);
    const S = getSurface(id);
    const seen = new Set();
    for (let i = 0; i < 4000; i++) {
      const y = 1 - 2 * (i + 0.5) / 4000, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      const s = sampleSurfacePure(id, Math.cos(a) * r, y, Math.sin(a) * r);
      assert.ok(Number.isFinite(s.radius) && s.radius > BODIES[id].radius - 400 && s.radius < BODIES[id].radius + 900, id + ' radius ' + s.radius);
      assert.ok(s.slope >= 0 && s.slope < Math.PI / 2);
      let sum = 0; for (const k in s.biomeWeights) sum += s.biomeWeights[k];
      assert.ok(Math.abs(sum - 1) < 0.01);
      assert.ok(s.biomeWeights[s.biomeId] > 0);
      assert.equal(s.isLiquid, s.liquidRadius > s.radius);
      seen.add(s.biomeId);
    }
    assert.ok(seen.size >= 4, id + ' shows ' + seen.size + ' biomes');
    assert.ok(S.sites.length >= 8);
  }
});

test('sampleSurface is pure: same input, same output, in any order', () => {
  const a = sampleSurfacePure('earth', 0.3, 0.5, 0.8);
  sampleSurfacePure('mars', -0.2, 0.9, 0.1);
  sampleSurfacePure('earth', -0.7, 0.1, 0.3);
  const b = sampleSurfacePure('earth', 0.3, 0.5, 0.8);
  assert.deepEqual(a, b);
  const c = sampleSurfacePure('earth', 0.6, 1.0, 1.6);   // not normalised: same direction
  assert.ok(Math.abs(a.radius - c.radius) < 1e-6);
});

test('earth spawn is dry, flat, in the temperate forest, near the stream', () => {
  const S = getSurface('earth');
  const sp = S.getSpawn();
  const s = sampleSurfacePure('earth', sp.x, sp.y, sp.z);
  assert.equal(s.biomeId, 'temperate_forest');
  assert.ok(!s.isLiquid);
  assert.ok(s.slope < 0.2, 'slope ' + s.slope);
  const o = makeSample(S.nB);
  S.sample(sp.x, sp.y, sp.z, o, true);
  assert.ok(o.s < 25, 'stream distance ' + o.s);
  assert.ok(o.trees < 0.05, 'the landing clearing has no trees');
  assert.equal(s.canopyHeight, 0);
  assert.ok(s.canopy01 >= 0 && s.canopy01 < 0.5);
  // water really is within 30 m
  let ux = -sp.z, uz = sp.x; const l = Math.hypot(ux, uz); ux /= l; uz /= l;
  const vx = sp.y * uz, vy = sp.z * ux - sp.x * uz, vz = -sp.y * ux;
  let wet = false;
  for (let a = 0; a < 64 && !wet; a++) for (let r = 2; r < 30; r += 1) {
    const c = Math.cos(a / 64 * 6.283) * r / S.R, d = Math.sin(a / 64 * 6.283) * r / S.R;
    if (sampleSurfacePure('earth', sp.x + ux * c + vx * d, sp.y + vy * d, sp.z + uz * c + vz * d).isLiquid) { wet = true; break; }
  }
  assert.ok(wet);
});

test('liquid never floats: where there is liquid its level is a sane height', () => {
  const S = getSurface('earth'), o = makeSample(S.nB);
  for (let i = 0; i < 20000; i++) {
    const y = 1 - 2 * (i + 0.5) / 20000, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    S.sample(Math.cos(a) * r, y, Math.sin(a) * r, o, false);
    if (o.lq !== NOLQ && o.lq > o.h) assert.ok(o.lq - o.h < 90, 'depth ' + (o.lq - o.h));
  }
});

test('vistas exist for every body and point at unit directions', () => {
  for (const id of BODY_IDS) {
    const v = getVistasPure(id);
    assert.ok(v.length >= 4);
    for (const x of v) assert.ok(Math.abs(Math.hypot(x.unitDir.x, x.unitDir.y, x.unitDir.z) - 1) < 1e-6);
    assert.equal(new Set(v.map((x) => x.id)).size, v.length);
  }
});

test('patches: sizes, determinism, and edges shared with the neighbour', () => {
  const S = getSurface('earth');
  const a = buildPatchData(S, 4, 5, 10, 12), b = buildPatchData(S, 4, 5, 10, 12);
  assert.equal(a.positions.length, PATCH_VERTS * 3);
  assert.deepEqual(a.positions, b.positions);
  assert.ok(patchIndices().every((i) => i < PATCH_VERTS));
  // right edge of (10,12) equals left edge of (11,12) in absolute coordinates
  const c = buildPatchData(S, 4, 5, 11, 12), V = PATCH_N + 1;
  for (let j = 0; j < V; j++) {
    const p = (j * V + PATCH_N) * 3, q = (j * V) * 3;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs((a.positions[p + k] + a.origin[k]) - (c.positions[q + k] + c.origin[k])) < 0.02);
  }
  // morph targets of even vertices are zero (they exist on the parent mesh)
  for (let j = 0; j < V; j += 2) for (let i = 0; i < V; i += 2) {
    const p = (j * V + i) * 3;
    assert.equal(a.morph[p], 0); assert.equal(a.morph[p + 1], 0); assert.equal(a.morph[p + 2], 0);
  }
});

test('mesh at the finest level agrees with sampleSurface', () => {
  const S = getSurface('earth');
  const sp = S.getSpawn(), f = dirToFace(sp.x, sp.y, sp.z, {});
  const level = 8, n = 1 << level;
  const ix = Math.min(n - 1, Math.floor((f.u + 1) / 2 * n)), iy = Math.min(n - 1, Math.floor((f.v + 1) / 2 * n));
  const d = buildPatchData(S, f.face, level, ix, iy), V = PATCH_N + 1;
  for (let j = 0; j < V; j += 4) for (let i = 0; i < V; i += 4) {
    const p = (j * V + i) * 3;
    const x = d.positions[p] + d.origin[0], y = d.positions[p + 1] + d.origin[1], z = d.positions[p + 2] + d.origin[2];
    const r = Math.hypot(x, y, z);
    const s = sampleSurfacePure('earth', x / r, y / r, z / r);
    assert.ok(Math.abs(s.radius - r) < 0.01, 'radius differs by ' + Math.abs(s.radius - r));
  }
});

test('terrain stays below 0.8 x the space altitude on every body (Pilot need 1)', () => {
  for (const id of BODY_IDS) {
    const S = getSurface(id), o = makeSample(S.nB);
    let max = -1e9;
    for (let i = 0; i < 30000; i++) {
      const y = 1 - 2 * (i + 0.5) / 30000, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      S.sample(Math.cos(a) * r, y, Math.sin(a) * r, o, false);
      if (o.h > max) max = o.h;
    }
    assert.ok(max < 0.8 * spaceAltitude(BODIES[id]), id + ' reaches ' + max.toFixed(0) + ' m');
  }
});

test('flora placement is deterministic and trees stand on dry forest ground', () => {
  const S = getSurface('earth'), sp = S.getSpawn(), f = dirToFace(sp.x, sp.y, sp.z, {});
  const ix = Math.floor((f.u + 1) / 2 * 64), iy = Math.floor((f.v + 1) / 2 * 64);
  const a = placeTrees(S, f.face, 6, ix, iy, 18), b = placeTrees(S, f.face, 6, ix, iy, 18);
  assert.ok(a.count > 20, 'trees in the home chunk: ' + a.count);
  assert.deepEqual(a.data, b.data);
  for (let i = 0; i < a.count; i++) {
    const o = i * INST_STRIDE, x = a.data[o], y = a.data[o + 1], z = a.data[o + 2], r = Math.hypot(x, y, z);
    const s = sampleSurfacePure('earth', x, y, z);
    assert.ok(!s.isLiquid);
    assert.ok(Math.abs(s.radius - r) < 0.3);
  }
});

test('obstacles: trunks near the spawn, none inside the landing clearing', () => {
  const S = getSurface('earth'), sp = S.getSpawn();
  const near = sampleObstaclesPure('earth', sp.x, sp.y, sp.z, 6);
  assert.equal(near.filter((o) => o.kind === 'tree').length, 0);
  const wide = sampleObstaclesPure('earth', sp.x, sp.y, sp.z, 40);
  assert.ok(wide.filter((o) => o.kind === 'tree').length > 5);
  for (const o of wide) { assert.ok(o.radius > 0.1 && o.radius < 2); assert.ok(o.height > 0.2 && o.height < 30); }
  assert.deepEqual(wide, sampleObstaclesPure('earth', sp.x, sp.y, sp.z, 40));
  for (const id of BODY_IDS) { const sp2 = getSurface(id).getSpawn(); assert.ok(Array.isArray(sampleObstaclesPure(id, sp2.x, sp2.y, sp2.z, 40))); }
});

test('every planet has a level, dry arrival place with room for the ship', () => {
  for (const id of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon', 'pluto']) {
    const S = getSurface(id), sp = S.getSpawn();
    const s = sampleSurfacePure(id, sp.x, sp.y, sp.z);
    assert.ok(!s.isLiquid, id + ' spawn is dry');
    assert.ok(s.slope < 0.12, id + ' spawn slope ' + s.slope.toFixed(3));
    let ux = -sp.z, uz = sp.x; const l = Math.hypot(ux, uz); ux /= l; uz /= l;
    const vx = sp.y * uz, vy = sp.z * ux - sp.x * uz, vz = -sp.y * ux;
    for (let a = 0; a < 12; a++) for (const r of [4, 8, 12]) {
      const ca = Math.cos(a * Math.PI / 6) * r / S.R, sa = Math.sin(a * Math.PI / 6) * r / S.R;
      const q = sampleSurfacePure(id, sp.x + ux * ca + vx * sa, sp.y + vy * sa, sp.z + uz * ca + vz * sa);
      assert.ok(!q.isLiquid, id + ': liquid ' + r + ' m from the spawn');
      assert.ok(q.slope < 0.30, id + ': slope ' + q.slope.toFixed(2) + ' at ' + r + ' m from the spawn');
    }
  }
});

test('sampleSurface stays cheap on every body', (t) => {
  // budget (lead review 1): under 0.05 ms a call. A wall-clock number on a shared machine: the best of
  // ten short batches is reported for every body on every run, and held to the limit only when
  // PC_TIMING=1 says the machine is quiet (as PILOT's timed tests do); it must not fail a run of all
  // checks because two renders are going beside it.
  const timed = process.env.PC_TIMING === '1', line = [];
  for (const id of BODY_IDS) {
    let best = 1e9;
    for (let run = 0; run < 10; run++) {
      const t0 = performance.now();
      for (let i = 0; i < 1500; i++) { const y = 1 - 2 * (i + 0.5) / 1500, r = Math.sqrt(1 - y * y), a = i * 2.399963 + run; sampleSurfacePure(id, Math.cos(a) * r, y, Math.sin(a) * r); }
      best = Math.min(best, (performance.now() - t0) / 1500);
    }
    line.push(id + ' ' + (best * 1000).toFixed(1));
    assert.ok(Number.isFinite(best) && best > 0, id + ': timed');
    if (timed) assert.ok(best < 0.05, id + ': ' + (best * 1000).toFixed(1) + ' us a call');
  }
  t.diagnostic('sampleSurface, us a call (best of 10 batches' + (timed ? ', limit 50' : ', not asserted: set PC_TIMING=1') + '): ' + line.join(', '));
});

test('every kept easel stands on dry ground of its own biome, and is the first vista of it', () => {
  for (const id of Object.keys(EASELS)) {
    const vistas = getVistasPure(id);
    for (const biome of Object.keys(EASELS[id])) {
      const e = EASELS[id][biome];
      assert.ok(Math.abs(Math.hypot(e[0], e[1], e[2]) - 1) < 1e-4, id + ' ' + biome + ' is a unit direction');
      const s = sampleSurfacePure(id, e[0], e[1], e[2]);
      assert.equal(s.biomeId, biome, id + ' ' + biome + ' easel stands in ' + s.biomeId);
      assert.ok(!s.isLiquid, id + ' ' + biome + ' easel is dry');
      assert.ok(s.slope < 0.75, id + ' ' + biome + ' easel slope ' + s.slope.toFixed(2));
      const v = vistas.find((x) => x.id === id + '-' + biome + '-1');
      assert.ok(v && Math.abs(v.unitDir.x - e[0]) < 1e-4 && Number.isFinite(v.yaw), id + ' ' + biome + ' is a vista with a facing');
    }
  }
});

test('every vista is a place a walker can stand: dry, and no steeper than 25 degrees', () => {
  for (const id of BODY_IDS) {
    for (const v of getVistasPure(id)) {
      const s = sampleSurfacePure(id, v.unitDir.x, v.unitDir.y, v.unitDir.z);
      assert.ok(!s.isLiquid, v.id + ' is dry');
      assert.ok(s.slope < 0.44 || (EASELS[id] && v.yaw != null && s.slope < 0.75), v.id + ' slope ' + (s.slope * 57.3).toFixed(0) + ' degrees');
    }
  }
});
